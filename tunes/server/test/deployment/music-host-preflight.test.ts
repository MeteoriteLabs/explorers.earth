import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { Script, createContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");
const require = createRequire(import.meta.url);
const { load: parseYaml } = require("js-yaml") as { load(source: string): any };

interface Sample { success: boolean; latencyMs: number }
interface ProbeLibrary {
  validateEnsurePayload: (text: string, nowMs: number) => unknown;
  evaluateSlo: (samples: { cold: Sample[]; warm: Sample[]; concurrent: Sample[] }) => {
    passed: boolean; sampleCount: number; successCount: number; successRatePercent: number;
    gatewayProofCacheColdP95Ms: number; warmP95Ms: number; concurrentP95Ms: number;
  };
  probeEnsure: (input: {
    proof: string; fetchImpl: typeof fetch; monotonicNow?: () => number;
    wallNow?: () => number; timeoutMs?: number;
  }) => Promise<Sample>;
}

function sloJob() {
  const workflow = parseYaml(read(".github/workflows/tunes-host-preflight.yml"));
  return { workflow, job: workflow.jobs["authenticated-identity-slo"] };
}

function remoteScript(): string {
  const { job } = sloJob();
  return String(job.steps.find((step: any) =>
    step.name === "Probe authenticated identity SLO without identity output").with.script);
}

function embeddedNodeSource(): string {
  const match = /docker exec -e MUSIC_SLO_EXECUTE=1 -i tunes-app-1 node <<'NODE'\n([\s\S]*?)\nNODE(?:\n|$)/.exec(remoteScript());
  if (!match) throw new Error("embedded probe source missing");
  return match[1];
}

function probeLibrary(): ProbeLibrary {
  const module = { exports: {} as unknown };
  const context = createContext({
    AbortController, AbortSignal, Buffer, URL, URLSearchParams, clearTimeout,
    console: { log: vi.fn() },
    fetch: vi.fn(async () => { throw new Error("unexpected fetch"); }),
    module,
    process: { env: {}, exitCode: 0 },
    require,
    setTimeout,
  });
  new Script(embeddedNodeSource(), { filename: "embedded-music-identity-slo.cjs" }).runInContext(context);
  return module.exports as ProbeLibrary;
}

const credentialToken = `${"a".repeat(24)}.${"b".repeat(24)}.${"c".repeat(32)}`;
const validPayload = (expiresAt = 2_000_000_000_000) => JSON.stringify({
  version: "music-identity/v1",
  identity: { musicUserId: 17, status: "active" },
  credential: { token: credentialToken, expiresAt },
});
const sample = (latencyMs: number, success = true): Sample => ({ success, latencyMs });

afterEach(() => vi.useRealTimers());

describe("Tunes authenticated identity SLO preflight", () => {
  it("requires an exact deployed commit and remains restricted to the fingerprint diagnostic branch", () => {
    const { workflow, job } = sloJob();
    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
    expect(workflow.on.workflow_dispatch.inputs.expected_deployed_commit).toEqual({
      description: "Exact 40-character commit currently deployed to the Tunes test app",
      required: true,
      type: "string",
    });
    expect(job.if).toContain("github.ref == 'refs/heads/codex/tunes-fingerprint-diagnostic'");
    expect(job.if).toContain("inputs.run_authenticated_identity_slo");
    expect(job.if).toContain("!inputs.confirm_test_deploy");
    expect(job.if).toContain("!inputs.diagnose_last_attempt");
    expect(job.env).toEqual({ EXPECTED_DEPLOYED_COMMIT: "${{ inputs.expected_deployed_commit }}" });
    expect(workflow.jobs["diagnose-last-attempt"].if).toContain("!inputs.run_authenticated_identity_slo");
    expect(workflow.jobs["build-arm64"].if).toContain("!inputs.run_authenticated_identity_slo");
    expect(job["runs-on"]).toBe("ubuntu-24.04");
    expect(job["timeout-minutes"]).toBe(25);
    expect(job.permissions).toEqual({ contents: "read" });
  });

  it("attests the immutable test image and commit before exactly one guarded restart", () => {
    const { job } = sloJob();
    const remote = job.steps.find((step: any) => step.name === "Probe authenticated identity SLO without identity output");
    expect(remote.uses).toBe("appleboy/ssh-action@2ead5e36573f08b82fbfce1504f1a4b05a647c6f");
    expect(remote.with).toMatchObject({
      host: "${{ secrets.TUNES_DEPLOY_HOST }}", username: "deploy", key: "${{ secrets.TUNES_DEPLOY_KEY }}",
      fingerprint: "SHA256:mkzoRIglhalq6lNwNgM2kyuRLFGLeIbpLQpypShYMSw",
      command_timeout: "22m", envs: "EXPECTED_DEPLOYED_COMMIT",
    });
    const script = remoteScript();
    expect(script).toContain('[[ "$EXPECTED_DEPLOYED_COMMIT" =~ ^[a-f0-9]{40}$ ]]');
    expect(script).toContain('test "$container_commit" = "$EXPECTED_DEPLOYED_COMMIT"');
    expect(script).toContain('test "$image_revision" = "$EXPECTED_DEPLOYED_COMMIT"');
    expect(script).toContain('[[ "$configured_image" =~ ^ghcr\\.io/[a-z0-9._-]+/explorers-tunes-test@sha256:[a-f0-9]{64}$ ]]');
    expect(script).toContain(`test "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' tunes-app-1)" = tunes`);
    expect(script).toContain(`test "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' tunes-app-1)" = app`);
    expect(script.match(/docker restart --time 30 tunes-app-1/g)).toHaveLength(1);
    expect(script).toContain("docker restart --time 30 tunes-app-1 >/dev/null");
    expect(script).toContain("http://127.0.0.1:5000/health/ready");
    expect(script).toContain(`test "$ready" = true`);
    expect(script).toContain("docker exec -e MUSIC_SLO_EXECUTE=1 -i tunes-app-1 node");
    expect(script).not.toContain("MUSIC_SLO_UNIT_TEST");
    expect(script).not.toMatch(/docker\s+compose\s+(?:up|down|restart|rm|pull|build)/);
    expect(script).not.toMatch(/docker\s+(?:stop|rm|rmi|prune)/);
  });

  it("starts from one provisioned active Music identity and verifies the exact Strapi identity", () => {
    const script = remoteScript();
    expect(script).toContain("require(\"pg\")");
    expect(script).toMatch(/SELECT\s+strapi_user_document_id,strapi_account_document_id\s+FROM users\s+WHERE identity_status='active'/);
    expect(script).toContain("filters[documentId][$eq]");
    expect(script).toContain("candidate.documentId !== provisioned.userDocumentId");
    expect(script).toContain("completedAccounts[0].documentId !== provisioned.accountDocumentId");
    expect(script).not.toContain("sort=id%3Aasc");
    expect(script).toContain("process.env.STRAPI_ACCESS_TOKEN");
    expect(script).toContain("process.env.STRAPI_JWT_SECRET");
    expect(script).toContain('algorithm: "HS256"');
    expect(script).toContain('method: "POST"');
    expect(script).not.toMatch(/body\s*:/);
  });

  it("exports executable credential validation and SLO predicate helpers for contract tests", () => {
    const library = probeLibrary();
    expect(library.validateEnsurePayload).toBeTypeOf("function");
    expect(library.evaluateSlo).toBeTypeOf("function");
    expect(library.probeEnsure).toBeTypeOf("function");
  });

  it("accepts only a fully validated successful credential response", () => {
    const { validateEnsurePayload } = probeLibrary();
    expect(validateEnsurePayload(validPayload(), 1_900_000_000_000)).toEqual({
      token: credentialToken,
      expiresAt: 2_000_000_000_000,
    });
    for (const malformed of [
      "not-json",
      JSON.stringify({ credential: { token: credentialToken, expiresAt: 2_000_000_000_000 } }),
      validPayload(1_900_000_000_000),
      JSON.stringify({ version: "music-identity/v1", identity: { musicUserId: 17, status: "active" }, credential: { token: "", expiresAt: 2_000_000_000_000 } }),
      JSON.stringify({ version: "music-identity/v1", identity: { musicUserId: 17, status: "active" }, credential: { token: "not-a-jwt", expiresAt: 2_000_000_000_000 } }),
      JSON.stringify({ version: "music-identity/v1", identity: { musicUserId: 17, status: "active" }, credential: { token: credentialToken, expiresAt: 2_000_000_000_000 }, extra: true }),
    ]) expect(() => validateEnsurePayload(malformed, 1_900_000_000_000)).toThrow("credential response malformed");
  });

  it("includes complete body read and validation in latency and rejects malformed 200 responses", async () => {
    const { probeEnsure } = probeLibrary();
    let bodyRead = false;
    const valid = await probeEnsure({
      proof: credentialToken,
      fetchImpl: vi.fn(async () => ({ status: 200,
        text: async () => { bodyRead = true; return validPayload(); },
        body: { locked: false, cancel: vi.fn() },
      })) as unknown as typeof fetch,
      monotonicNow: () => bodyRead ? 145 : 100,
      wallNow: () => 1_900_000_000_000,
    });
    expect(valid).toEqual({ success: true, latencyMs: 45 });

    const malformed = await probeEnsure({
      proof: credentialToken,
      fetchImpl: vi.fn(async () => ({ status: 200, text: async () => "{}",
        body: { locked: false, cancel: vi.fn() },
      })) as unknown as typeof fetch,
      monotonicNow: () => 100,
      wallNow: () => 1_900_000_000_000,
    });
    expect(malformed.success).toBe(false);
  });

  it("fails stalled reads and cannot preserve 200 success when read and cancellation fail", async () => {
    vi.useFakeTimers();
    const { probeEnsure } = probeLibrary();
    const stalled = probeEnsure({
      proof: credentialToken,
      fetchImpl: vi.fn(async () => ({ status: 200,
        text: () => new Promise<string>(() => undefined),
        body: { locked: false, cancel: vi.fn(async () => { throw new Error("cancel failed"); }) },
      })) as unknown as typeof fetch,
      monotonicNow: () => 100,
      wallNow: () => 1_900_000_000_000,
      timeoutMs: 25,
    });
    await vi.advanceTimersByTimeAsync(30);
    await expect(stalled).resolves.toEqual({ success: false, latencyMs: 0 });

    const rejected = probeEnsure({
      proof: credentialToken,
      fetchImpl: vi.fn(async () => ({ status: 200,
        text: async () => { throw new Error("read failed"); },
        body: { locked: false, cancel: vi.fn(async () => { throw new Error("cancel failed"); }) },
      })) as unknown as typeof fetch,
      monotonicNow: () => 100,
      wallNow: () => 1_900_000_000_000,
    });
    await expect(rejected).resolves.toEqual({ success: false, latencyMs: 0 });
  });

  it("settles a timed-out read even when response cancellation never settles", async () => {
    vi.useFakeTimers();
    const { probeEnsure } = probeLibrary();
    const stalled = probeEnsure({
      proof: credentialToken,
      fetchImpl: vi.fn(async () => ({ status: 200,
        text: () => new Promise<string>(() => undefined),
        body: { locked: false, cancel: vi.fn(() => new Promise<void>(() => undefined)) },
      })) as unknown as typeof fetch,
      monotonicNow: () => 100,
      wallNow: () => 1_900_000_000_000,
      timeoutMs: 25,
    });
    const bounded = Promise.race([
      stalled,
      new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), 50)),
    ]);
    await vi.advanceTimersByTimeAsync(60);
    await expect(bounded).resolves.toEqual({ success: false, latencyMs: 0 });
  });

  it("requires 199 of 200 and gates cold, sequential warm, and concurrent p95 independently", () => {
    const { evaluateSlo } = probeLibrary();
    const passing = evaluateSlo({
      cold: [sample(4_900, false), ...Array.from({ length: 19 }, () => sample(100))],
      warm: Array.from({ length: 90 }, () => sample(900)),
      concurrent: Array.from({ length: 90 }, () => sample(950)),
    });
    expect(passing).toMatchObject({
      passed: true, sampleCount: 200, successCount: 199, successRatePercent: 99.5,
      gatewayProofCacheColdP95Ms: 100, warmP95Ms: 900, concurrentP95Ms: 950,
    });

    const insufficientSuccess = evaluateSlo({
      cold: [sample(100, false), sample(100, false), ...Array.from({ length: 18 }, () => sample(100))],
      warm: Array.from({ length: 90 }, () => sample(900)),
      concurrent: Array.from({ length: 90 }, () => sample(950)),
    });
    expect(insufficientSuccess).toMatchObject({ passed: false, successCount: 198, successRatePercent: 99 });

    const slowConcurrent = evaluateSlo({
      cold: Array.from({ length: 20 }, () => sample(4_900)),
      warm: Array.from({ length: 90 }, () => sample(900)),
      concurrent: [
        ...Array.from({ length: 85 }, () => sample(950)),
        ...Array.from({ length: 5 }, () => sample(1_001)),
      ],
    });
    expect(slowConcurrent).toMatchObject({ passed: false, concurrentP95Ms: 1_001 });
  });

  it("paces 200 measurements below the fixed source limiter and emits aggregate fields only", () => {
    const script = remoteScript();
    expect(script).toContain("const batchPlans = [");
    expect(script).toContain("cold: 3, warm: 13, concurrent: 14");
    expect(script).toContain("cold: 2, warm: 12, concurrent: 6");
    expect(script).toContain("await sleep(61_000)");
    expect(script).toContain('const coldMode = "gateway_proof_cache_cold"');
    expect(script).toContain("restartCount: 1");
    expect(script).toContain('const ensureMutation = "identity_snapshots_and_sync_timestamps"');
    expect(script.match(/console\.log/g)).toHaveLength(1);
    for (const aggregate of [
      "sampleCount", "successCount", "successRatePercent", "gatewayProofCacheColdP95Ms", "warmP95Ms", "concurrentP95Ms",
    ]) expect(script).toContain(aggregate);
    for (const forbidden of [
      "requestId", "responseBody", "console.log(candidate", "console.log(provisioned", "console.log(response", "console.log(error",
    ]) expect(script).not.toContain(forbidden);
  });

  it("fails closed without logging raw errors or identity data", () => {
    const script = remoteScript();
    expect(script).toContain('reason: "no_provisioned_eligible_identity"');
    expect(script).toContain('reason: "probe_failed_closed"');
    expect(script).toContain("process.exitCode = 1");
    expect(script).not.toMatch(/console\.(?:error|warn|debug|info)/);
    expect(script).not.toMatch(/JSON\.stringify\((?:candidate|users|response|error|cause)/);
  });
});
