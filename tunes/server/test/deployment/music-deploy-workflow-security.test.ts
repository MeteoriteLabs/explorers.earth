import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");
const require = createRequire(import.meta.url);
const { load: parseYaml } = require("js-yaml") as { load(source: string): any };

describe("Tunes workflow provenance and input boundary", () => {
  it("makes manual dispatch rollback-only and keeps deploy inputs internal to workflow_call", () => {
    // Production break caught: a manual caller selects an arbitrary package or commit for production deploy.
    const workflow = parseYaml(read(".github/workflows/tunes-deploy.yml"));
    expect(Object.keys(workflow.on.workflow_dispatch.inputs)).toEqual(["target_digest"]);
    expect(workflow.on.workflow_dispatch.inputs.target_digest.required).toBe(true);
    expect(workflow.on.workflow_call.inputs).toEqual({
      digest: { type: "string", required: true },
      commit: { type: "string", required: true },
    });
  });

  it("derives the canonical repository and verifies GitHub plus OCI provenance", () => {
    // Production break caught: a valid digest from another owner reaches the production pull path.
    const ci = read(".github/workflows/tunes.yml");
    const deploy = read(".github/workflows/tunes-deploy.yml");
    const dockerfile = read("tunes/Dockerfile");
    const executable = read("tunes/deployment/music-deploy.sh");
    expect(ci).toContain("actions/attest-build-provenance@v3");
    expect(deploy).toContain('IMAGE_REPOSITORY="ghcr.io/${owner}/explorers-tunes"');
    expect(deploy).toContain("gh attestation verify");
    expect(executable).toContain("org.opencontainers.image.source");
    expect(executable).toContain("org.opencontainers.image.revision");
    expect(executable).toContain("com.explorers.music.minimum-containment-commit");
    expect(dockerfile).toContain("org.opencontainers.image.source");
    expect(dockerfile).toContain("com.explorers.music.minimum-containment-commit");
  });

  it("transmits only an encoded fixed-schema bundle and runs the checked-in executable", () => {
    // Production break caught: shell metacharacters from a dispatch input enter OpenSSH's remote command string.
    const deploy = read(".github/workflows/tunes-deploy.yml");
    expect(deploy).toContain("music-deploy-request-v2");
    expect(deploy).toContain("base64");
    expect(deploy).toContain("tunes/deployment/music-deploy.sh");
    expect(deploy).not.toMatch(/ssh[^\n]*\$\{\{\s*inputs\./);
    expect(deploy).not.toContain('ghcr.io/*/explorers-tunes');
    expect(deploy).not.toContain("inputs.image_ref");
    expect(deploy).not.toContain("inputs.operation");
  });

  it("admits normal deploys only from the pinned main CI caller with attestation permission", () => {
    // Production break caught: another repository workflow calls the reusable
    // deploy authority with an attacker-selected but otherwise valid request.
    const ci = read(".github/workflows/tunes.yml");
    const deploy = read(".github/workflows/tunes-deploy.yml");
    expect(deploy).toContain("$GITHUB_REPOSITORY/.github/workflows/tunes.yml@refs/heads/main");
    expect(ci).toContain("github.event_name == 'push'");
    expect(ci).toMatch(/deploy-production:[\s\S]*?permissions:[\s\S]*?attestations: read/);
  });

  it("cleans only the fixed bundle files without recursive deletion", () => {
    const deploy = read(".github/workflows/tunes-deploy.yml");
    expect(deploy).not.toContain("rm -rf");
    expect(deploy).toContain('rm -f -- "$bundle/music-deploy.sh"');
    expect(deploy).toContain('rm -f -- "$incoming/music-deploy.sh"');
  });

  it("unexports the injected HMAC secret before the first child process", () => {
    // Secret break caught: mktemp/install/tar/ssh inherit the GitHub-injected
    // HMAC bytes even though only the protected key file needs them.
    const workflow = parseYaml(read(".github/workflows/tunes-deploy.yml"));
    const run = workflow.jobs.deploy.steps.find((step: any) => step.name === "Run checked-in transactional deploy executable").run as string;
    const capture = run.indexOf('hmac_key_value="$MUSIC_DEPLOY_STATE_HMAC_KEY"');
    const unexport = run.indexOf("unset MUSIC_DEPLOY_STATE_HMAC_KEY");
    const firstChild = run.indexOf('bundle="$(mktemp -d)"');
    const persist = run.indexOf('printf \'%s\' "$hmac_key_value" > "$bundle/hmac.key"');
    const eraseShellValue = run.indexOf("unset hmac_key_value");
    expect(capture).toBeGreaterThan(-1);
    expect(unexport).toBeGreaterThan(capture);
    expect(firstChild).toBeGreaterThan(unexport);
    expect(persist).toBeGreaterThan(firstChild);
    expect(eraseShellValue).toBeGreaterThan(persist);
  });

  it("gates the environment-bearing job on a no-secret protected-main policy preflight", () => {
    // Production break caught: a branch dispatch enters tunes-production before
    // proving the ref and external environment policy are protected-main only.
    const workflow = parseYaml(read(".github/workflows/tunes-deploy.yml"));
    const preflight = workflow.jobs["production-authority-preflight"];
    const deploy = workflow.jobs.deploy;
    expect(preflight).toBeDefined();
    expect(preflight.environment).toBeUndefined();
    expect(JSON.stringify(preflight)).not.toContain("secrets.");
    expect(preflight.if).toContain("github.ref != 'refs/heads/main'");
    expect(preflight.if).toContain("vars.GATE_PROD == 'open'");
    expect(preflight.steps.some((step: any) => String(step.run ?? "").includes("verify-production-environment-policy.mjs"))).toBe(true);
    expect(deploy.needs).toBe("production-authority-preflight");
    expect(deploy.if).toContain("github.ref == 'refs/heads/main'");
    expect(deploy.if).toContain("needs.production-authority-preflight.result == 'success'");
    expect(deploy.environment).toBe("tunes-production");
  });

  it("documents protected-main environment policy as a prerequisite rather than a YAML guarantee", () => {
    const runbook = read("docs/operations/music-deploy-runbook.md");
    const prose = runbook.replace(/\s+/g, " ");
    expect(prose).toContain("deployment branch policy");
    expect(prose).toContain("protected branches only");
    expect(prose).toContain("main must be the sole protected branch");
    expect(prose).toContain("main is protected");
    expect(prose).toContain("production credentials are environment-scoped only");
    expect(prose).toContain("YAML check is not the security boundary");
    expect(prose).toContain("GATE_PROD must remain closed");
  });
});
