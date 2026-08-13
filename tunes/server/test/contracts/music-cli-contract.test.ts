import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveNpmCommand } from "../../../scripts/music-cli.ts";

const tunesRoot = resolve(import.meta.dirname, "../../..");

function runCli(args: string[], env: NodeJS.ProcessEnv = process.env) {
  try {
    const stdout = execFileSync(process.execPath, ["scripts/music-cli.ts", ...args], {
      cwd: tunesRoot,
      encoding: "utf8",
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { exitCode: 0, stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string };
    return { exitCode: failure.status, stdout: failure.stdout ?? "" };
  }
}

describe("music CLI output contract", () => {
  it("emits a final JSON envelope for a successful fixture capture", () => {
    // Production break caught: automation receives exit 0 with no run evidence.
    const output = execFileSync(process.execPath, ["scripts/music-cli.ts", "fixtures:capture", "--format", "json"], {
      cwd: resolve(import.meta.dirname, "../../.."),
      encoding: "utf8",
    });
    const envelope = JSON.parse(output.trim());
    expect(envelope).toMatchObject({ schemaVersion: "music-cli/v1", command: "fixtures:capture", status: "success", phase: "fixture-capture" });
    expect(envelope.runId).toEqual(expect.any(String));
    expect(envelope.checkpoint).toEqual(expect.any(String));
  });

  it("refuses resume when the checkpoint commit differs", () => {
    // Production break caught: a resumed provisioning run could apply evidence
    // produced by another source revision.
    const checkpointDirectory = mkdtempSync(join(tmpdir(), "music-cli-contract-"));
    const checkpoint = join(checkpointDirectory, "checkpoint.json");
    const captured = JSON.parse(runCli(["fixtures:capture", "--format", "json"]).stdout) as { checkpoint: string };
    const currentCheckpoint = JSON.parse(readFileSync(captured.checkpoint, "utf8")) as Record<string, unknown>;
    writeFileSync(checkpoint, JSON.stringify({ ...currentCheckpoint, commit: "previous-commit" }));
    try {
      execFileSync(process.execPath, ["scripts/music-cli.ts", "bootstrap", "--resume", checkpoint, "--format", "json"], {
        cwd: resolve(import.meta.dirname, "../../.."),
        encoding: "utf8",
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      throw new Error("expected the resume safety refusal");
    } catch (error) {
      const failure = error as { status?: number; stdout?: string };
      expect(failure.status).toBe(3);
      expect(failure.stdout).toContain("resume checkpoint commit does not match");
    }
  });

  it("safety-refuses db:migrate while C0 has no versioned migrations", () => {
    // Production break caught: C0 could run drizzle-kit push against an ambient
    // DATABASE_URL before a reviewed versioned migration exists.
    const result = runCli(["db:migrate", "--format", "json"], {
      ...process.env,
      DATABASE_URL: "postgresql://owner:secret@production.example.com:5432/music",
    });

    expect(result.exitCode).toBe(5);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: "db:migrate",
      status: "blocked",
      phase: "migration-safety",
    });
  });

  it("resolves npm through npm_execpath on Windows and Ubuntu/nvm", () => {
    // Production break caught: bootstrap hardcodes the Windows Node install
    // layout and cannot install child lockfiles on Ubuntu under nvm.
    expect(resolveNpmCommand({ npmExecPath: "C:\\node\\npm-cli.js", nodeExecPath: "C:\\node\\node.exe", platform: "win32" })).toEqual({
      file: "C:\\node\\node.exe",
      args: ["C:\\node\\npm-cli.js"],
    });
    expect(resolveNpmCommand({ npmExecPath: "/home/dev/.nvm/versions/node/v22/lib/node_modules/npm/bin/npm-cli.js", nodeExecPath: "/home/dev/.nvm/versions/node/v22/bin/node", platform: "linux" })).toEqual({
      file: "/home/dev/.nvm/versions/node/v22/bin/node",
      args: ["/home/dev/.nvm/versions/node/v22/lib/node_modules/npm/bin/npm-cli.js"],
    });
    expect(resolveNpmCommand({ nodeExecPath: "C:\\Program Files\\nodejs\\node.exe", platform: "win32" })).toEqual({
      file: "C:\\Program Files\\nodejs\\node.exe",
      args: ["C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js"],
    });
  });

  it("emits exactly one JSON object and preserves verification failure category", () => {
    // Production break caught: child stdout corrupts JSON automation and a
    // failed smoke assertion is mislabeled as dependency unavailable.
    const result = runCli(["test:smoke", "--format", "json"]);
    const lines = result.stdout.trim().split(/\r?\n/);

    expect(result.exitCode).toBe(1);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ command: "test:smoke", phase: "smoke", status: "failure" });
  });
});
