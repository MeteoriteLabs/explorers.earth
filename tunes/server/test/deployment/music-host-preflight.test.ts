import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");
const require = createRequire(import.meta.url);
const { load: parseYaml } = require("js-yaml") as { load(source: string): any };

describe("Tunes host preflight authority", () => {
  it("is manual, uses the proven SSH connection, and cannot deploy", () => {
    const source = read(".github/workflows/tunes-host-preflight.yml");
    const workflow = parseYaml(source);
    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
    expect(workflow.jobs.preflight.if).toContain("github.ref == 'refs/heads/main'");
    expect(workflow.jobs.preflight.environment).toBe("tunes-production");
    expect(workflow.on.workflow_dispatch.inputs.confirm_read_only).toMatchObject({
      required: true,
      type: "boolean",
    });
    expect(source).toContain("secrets.TUNES_DEPLOY_HOST");
    expect(source).toContain("secrets.TUNES_DEPLOY_KEY");
    expect(source).toContain("fingerprint: ${{ secrets.TUNES_DEPLOY_SSH_FINGERPRINT }}");
    expect(source).toContain("username: deploy");
    expect(source).toContain("appleboy/ssh-action@7eaf76671a0d7eec5d98ee897acda4f968735a17");
    expect(source).not.toContain("GATE_PROD");
  });

  it("limits the remote script to sanitized read-only observations", () => {
    const workflow = parseYaml(read(".github/workflows/tunes-host-preflight.yml"));
    const remote = workflow.jobs.preflight.steps.find((step: any) => step.name === "Inspect Tunes host without mutation");
    expect(remote.with).not.toHaveProperty("script_stop");
    const script = String(remote.with.script);
    for (const evidence of ["id", "docker version", "docker compose version", "docker ps", "docker compose ls", "df -P", "stat -c"]) {
      expect(script).toContain(evidence);
    }
    for (const mutation of [
      /docker\s+compose\s+(?:up|down|restart|rm|pull|build)/,
      /docker\s+(?:stop|restart|rm|rmi|prune)/,
      /\b(?:sudo|rm|mv|cp|install|mkdir|chmod|chown|truncate|tee)\b/,
      /\b(?:DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE)\b/i,
      /(^|[^<])>(?!>)/m,
    ]) {
      expect(script).not.toMatch(mutation);
    }
  });
});
