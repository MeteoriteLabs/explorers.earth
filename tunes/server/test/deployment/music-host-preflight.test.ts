import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");
const require = createRequire(import.meta.url);
const { load: parseYaml } = require("js-yaml") as { load(source: string): any };

function sloJob() {
  const workflow = parseYaml(read(".github/workflows/tunes-host-preflight.yml"));
  return { workflow, job: workflow.jobs["authenticated-identity-slo"] };
}

describe("Tunes authenticated identity SLO preflight", () => {
  it("is an explicit manual action restricted to the fingerprint diagnostic branch", () => {
    const { workflow, job } = sloJob();
    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
    expect(workflow.on.workflow_dispatch.inputs.run_authenticated_identity_slo).toEqual({
      description: "Run the authenticated identity SLO probe with one controlled test-app restart",
      required: true,
      default: false,
      type: "boolean",
    });
    expect(job.if).toContain("github.ref == 'refs/heads/codex/tunes-fingerprint-diagnostic'");
    expect(job.if).toContain("inputs.run_authenticated_identity_slo");
    expect(job.if).toContain("!inputs.confirm_test_deploy");
    expect(job.if).toContain("!inputs.diagnose_last_attempt");
    expect(workflow.jobs["diagnose-last-attempt"].if).toContain("!inputs.run_authenticated_identity_slo");
    expect(workflow.jobs["build-arm64"].if).toContain("!inputs.run_authenticated_identity_slo");
    expect(job["runs-on"]).toBe("ubuntu-24.04");
    expect(job.permissions).toEqual({ contents: "read" });
  });

  it("uses the existing SSH/container authority and permits exactly one guarded test-app restart", () => {
    const { job } = sloJob();
    const remote = job.steps.find((step: any) => step.name === "Probe authenticated identity SLO without identity output");
    expect(remote.uses).toBe("appleboy/ssh-action@2ead5e36573f08b82fbfce1504f1a4b05a647c6f");
    expect(remote.with).toMatchObject({
      host: "${{ secrets.TUNES_DEPLOY_HOST }}",
      username: "deploy",
      key: "${{ secrets.TUNES_DEPLOY_KEY }}",
      fingerprint: "SHA256:mkzoRIglhalq6lNwNgM2kyuRLFGLeIbpLQpypShYMSw",
    });
    const script = String(remote.with.script);
    expect(script).toContain(`test "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' tunes-app-1)" = tunes`);
    expect(script).toContain(`test "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' tunes-app-1)" = app`);
    expect(script).toContain(`test "$(docker inspect --format '{{.State.Status}}' tunes-app-1)" = running`);
    expect(script.match(/docker restart --time 30 tunes-app-1/g)).toHaveLength(1);
    expect(script).toContain("docker restart --time 30 tunes-app-1 >/dev/null");
    expect(script).toContain("for attempt in $(seq 1 45)");
    expect(script).toContain("http://127.0.0.1:5000/health/ready");
    expect(script).toContain(`test "$ready" = true`);
    expect(script).toContain("docker exec -i tunes-app-1 node");
    expect(script).not.toMatch(/docker\s+compose\s+(?:up|down|restart|rm|pull|build)/);
    expect(script).not.toMatch(/docker\s+(?:stop|rm|rmi|prune)/);
  });

  it("selects and authenticates an existing completed Strapi identity only inside the app container", () => {
    const { job } = sloJob();
    const script = String(job.steps.find((step: any) => step.name === "Probe authenticated identity SLO without identity output").with.script);
    expect(script).toContain("process.env.STRAPI_ACCESS_TOKEN");
    expect(script).toContain("process.env.STRAPI_JWT_SECRET");
    expect(script).toContain("/api/users?pagination[page]=1&pagination[pageSize]=100&populate=accounts");
    expect(script).toContain("if (!Number.isSafeInteger(candidate.id) || candidate.id < 1 || candidate.blocked !== false) return false");
    expect(script).toContain('(provider === "local" && candidate.confirmed === true) || provider === "google"');
    expect(script).toContain("completedAccounts.length === 1");
    expect(script).toContain("jwt.sign({ id: candidate.id }, secret, { algorithm: \"HS256\", expiresIn: \"5m\" })");
    expect(script).toContain('method: "POST"');
    expect(script).toContain('new URL("/api/music/identity/ensure", tunesOrigin)');
    expect(script).not.toMatch(/body\s*:/);
    expect(script).not.toMatch(/process\.env\.STRAPI_(?:ACCESS_TOKEN|JWT_SECRET)\s*[,}]/);
  });

  it("measures cold, warm, and concurrent calls and emits aggregate metrics only", () => {
    const { job } = sloJob();
    const script = String(job.steps.find((step: any) => step.name === "Probe authenticated identity SLO without identity output").with.script);
    expect(script).toContain("const warmSampleCount = 14");
    expect(script).toContain("const concurrentSampleCount = 15");
    expect(script).toContain("await probeEnsure()");
    expect(script).toContain("Promise.all(Array.from({ length: concurrentSampleCount }, () => probeEnsure()))");
    expect(script).toContain("successRatePercent >= 99.5");
    expect(script).toContain("warmP95Ms <= 1000");
    expect(script).toContain("coldLatencyMs <= 5000");
    expect(script.match(/console\.log/g)).toHaveLength(1);
    expect(script).toContain('const schemaVersion = "music-identity-slo/v1"');
    for (const aggregate of [
      "sampleCount", "successCount", "successRatePercent", "coldLatencyMs", "warmP95Ms", "concurrentP95Ms",
    ]) expect(script).toContain(aggregate);
    for (const forbidden of [
      "requestId", "responseBody", "token:", "jwt:", "userId", "userDocumentId", "accountId", "accountDocumentId", "identity:",
    ]) expect(script).not.toContain(forbidden);
  });

  it("fails closed without logging raw errors or identity data", () => {
    const { job } = sloJob();
    const script = String(job.steps.find((step: any) => step.name === "Probe authenticated identity SLO without identity output").with.script);
    expect(script).toContain('reason: "no_eligible_identity"');
    expect(script).toContain('reason: "probe_failed_closed"');
    expect(script).toContain("process.exitCode = 1");
    expect(script).toContain("await response.body?.cancel()");
    expect(script).not.toMatch(/console\.(?:error|warn|debug|info)/);
    expect(script).not.toMatch(/JSON\.stringify\((?:candidate|users|response|error|cause)/);
  });
});
