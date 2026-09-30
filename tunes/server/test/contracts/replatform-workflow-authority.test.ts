import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../../..");
const read = (name: string) => readFileSync(resolve(root, `.github/workflows/${name}.yml`), "utf8");
const require = createRequire(import.meta.url);
const { load } = require("js-yaml") as { load(source: string): any };
const workflow = (name: string) => load(read(name));

describe("replatform workflow authority", () => {
  it("validates every main PR, including drafts, and every integration push without path gaps", () => {
    const ci = workflow("ci");
    expect(ci.on.pull_request.branches).toContain("main");
    expect(ci.on.pull_request).not.toHaveProperty("paths");
    expect(ci.on.pull_request).not.toHaveProperty("paths-ignore");
    expect(ci.on.push.branches).toContain("codex/unified-replatform");
    expect(ci.on.push).not.toHaveProperty("paths");
    expect(ci.on.push).not.toHaveProperty("paths-ignore");
    expect(read("ci")).not.toMatch(/\bdraft\s*==\s*false/);
  });

  it("requires all validation lanes to succeed, including jobs unexpectedly skipped", () => {
    const ci = workflow("ci");
    const required = ci.jobs["replatform-required"];
    expect(required).toBeDefined();
    expect(required.needs).toEqual(expect.arrayContaining([
      "lint", "typecheck", "unit-tests", "build", "integration-tests", "e2e-tests",
    ]));
    expect(ci.jobs["backend-validation"]).toBeUndefined();
    expect(required.if).toContain("always()");
    expect(required.steps.some((step: any) =>
      typeof step.run === "string" && step.run.includes("result !== 'success'"),
    )).toBe(true);
  });

  it("requires retained Music and local fixture lanes without counting optional load as success", () => {
    const music = workflow("test");
    const required = music.jobs["music-required"];
    expect(required.needs).toEqual(expect.arrayContaining([
      "docs-contracts", "static", "unit-coverage", "contracts", "database",
      "security", "frontend", "browser", "image-deploy-contract", "platform-fixture",
    ]));
    expect(required.needs).not.toContain("load-chaos");
    expect(required.if).toContain("always()");
    expect(required.steps.some((step: any) =>
      typeof step.run === "string" && step.run.includes("result !== 'success'"),
    )).toBe(true);
  });

  it("keeps feature pushes and PRs out of all deployment jobs", () => {
    const frontend = workflow("explorers");
    expect(frontend.on).not.toHaveProperty("workflow_run");
    expect(frontend.on).not.toHaveProperty("push");
    expect(frontend.on).not.toHaveProperty("pull_request");
    expect(frontend.jobs["build-and-deploy"].if).toBe("${{ false }}");
    const image = workflow("tunes");
    expect(image.jobs["deploy-production"].if).toContain("github.event_name == 'workflow_dispatch'");
    expect(image.jobs["deploy-production"].if).toContain("inputs.release_production");
    expect(image.jobs["deploy-production"].if).toContain("github.ref == 'refs/heads/main'");
  });

  it("requires exact main source and image digest for a deliberate Tunes release", () => {
    const image = workflow("tunes");
    const deploy = workflow("tunes-deploy");
    expect(image.on.workflow_dispatch.inputs.release_production).toMatchObject({ type: "boolean", default: false });
    expect(image.jobs["deploy-production"].with).toMatchObject({
      digest: "${{ needs.publish-image.outputs.digest }}",
      commit: "${{ needs.publish-image.outputs.commit }}",
    });
    expect(deploy.jobs.deploy.environment).toBe("tunes-production");
    expect(deploy.jobs.deploy.if).toContain("github.ref == 'refs/heads/main'");
    expect(read("tunes-deploy")).not.toContain("GATE_PROD");
    expect(read("tunes-deploy")).toContain("--source-digest \"$COMMIT\"");
    expect(read("tunes-deploy")).toContain('[[ "$commit" == "$GITHUB_SHA" ]]');
  });

  it("requires a successful aggregate from the same main source before registry publication", () => {
    const image = workflow("tunes");
    expect(image.on.workflow_dispatch.inputs.validated_run_id).toMatchObject({ type: "string", required: true });
    expect(image.on.workflow_dispatch.inputs.music_validated_run_id).toMatchObject({ type: "string", required: true });
    const preflight = image.jobs["release-preflight"];
    expect(preflight.permissions).toEqual({ actions: "read", contents: "read" });
    const step = preflight.steps.find((step: any) => typeof step.run === "string");
    const script = step.run as string;
    expect(step.env.VALIDATED_RUN_ID).toBe("${{ inputs.validated_run_id }}");
    expect(script).toContain("replatform-required");
    expect(script).toContain("music-required");
    expect(script).toContain("GITHUB_SHA");
    expect(script).toContain("require_aggregate");
    expect(script).toContain(".github/workflows/ci.yml replatform-required");
    expect(script).toContain(".github/workflows/test.yml music-required");
    expect(image.jobs["publish-image"].needs).toContain("release-preflight");
  });

  it("retired temporary direct deployment has no callable workflow file", () => {
    expect(existsSync(resolve(root, ".github/workflows/tunes-test-direct-deploy.yml"))).toBe(false);
  });

  it("does not give PR validation deploy credentials or package write scope", () => {
    const ci = workflow("ci");
    expect(ci.permissions).toEqual({ contents: "read" });
    expect(read("ci")).not.toMatch(/secrets\.(?:TUNES_DEPLOY|EXPLORERS_DEPLOY)/);
    const image = workflow("tunes");
    expect(image.jobs["build-test-scan-push"].permissions).toEqual({ contents: "read" });
    const publish = image.jobs["publish-image"];
    expect(publish.if).toContain("github.event_name == 'workflow_dispatch'");
    expect(publish.if).toContain("github.ref == 'refs/heads/main'");
  });
});
