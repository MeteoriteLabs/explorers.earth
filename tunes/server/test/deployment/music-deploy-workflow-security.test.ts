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
});
