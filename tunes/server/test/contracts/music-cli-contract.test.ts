import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createEnvironmentFingerprint, readGitSha, redactStructuredData, resolveNpmCommand, terminateBeforeCheckpoint } from "../../../scripts/music-cli.ts";

const tunesRoot = resolve(import.meta.dirname, "../../..");
const repositoryRoot = resolve(tunesRoot, "..");
const tsxCli = join(tunesRoot, "node_modules", "tsx", "dist", "cli.mjs");

function npmCliArgs(args: string[]): string[] {
  if (!process.env.npm_execpath) throw new Error("npm_execpath is required for the public command contract test");
  return [process.env.npm_execpath, ...args];
}

function runCli(args: string[], env: NodeJS.ProcessEnv = process.env) {
  try {
    const stdout = execFileSync(process.execPath, [tsxCli, "scripts/music-cli.ts", ...args], {
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
  it("emits only a JSON envelope through the documented public root command", () => {
    // Production break caught: tests bypass the npm entrypoint, while the
    // documented command prepends npm banners that break JSON parsers.
    const output = execFileSync(process.execPath, npmCliArgs(["run", "--silent", "music:fixtures:capture", "--", "--format", "json"]), {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    const envelope = JSON.parse(output.trim());
    expect(envelope).toMatchObject({ schemaVersion: "music-cli/v1", command: "fixtures:capture", status: "success", phase: "fixture-capture" });
    expect(envelope.runId).toEqual(expect.any(String));
    expect(envelope.checkpoint).toEqual(expect.any(String));
    const rootPackage = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as { scripts: Record<string, string> };
    const tunesPackage = JSON.parse(readFileSync(join(tunesRoot, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(rootPackage.scripts["music-cli"]).toContain("tsx tunes/scripts/music-cli.ts");
    expect(rootPackage.scripts["music:fixtures:capture"]).toContain("npm run --silent music-cli");
    expect(tunesPackage.scripts["music:types:baseline"]).toBe("tsx scripts/music-typescript-baseline.ts --compare");
  });

  it("resolves the actual SHA from a normal checkout whose .git is a directory", () => {
    // Production break caught: SHA resolution always reads `.git` as a text
    // worktree pointer and crashes in a normal clone.
    const checkout = mkdtempSync(join(tmpdir(), "music-git-directory-"));
    mkdirSync(join(checkout, ".git", "refs", "heads"), { recursive: true });
    writeFileSync(join(checkout, ".git", "HEAD"), "ref: refs/heads/main\n");
    writeFileSync(join(checkout, ".git", "refs", "heads", "main"), "0123456789abcdef0123456789abcdef01234567\n");
    expect(readGitSha(checkout)).toBe("0123456789abcdef0123456789abcdef01234567");
  });

  it("changes the resume fingerprint when material configuration changes", () => {
    // Production break caught: resume accepts a changed Compose/application
    // topology because the fingerprint contains only OS, Node and gate values.
    const base = { platform: "win32", node: "22.12.0", configurationHashes: { compose: "hash-a", env: "hash-b" } };
    expect(createEnvironmentFingerprint(base)).not.toBe(createEnvironmentFingerprint({ ...base, configurationHashes: { ...base.configurationHashes, compose: "changed" } }));
  });

  it("awaits owned-child termination before writing an interruption checkpoint", async () => {
    // Production break caught: SIGTERM writes resumable evidence while an
    // owned child can still mutate fixture state.
    const events: string[] = [];
    await terminateBeforeCheckpoint(
      async () => { await new Promise((resolveWait) => setTimeout(resolveWait, 5)); events.push("terminated"); },
      () => { events.push("checkpoint"); },
    );
    expect(events).toEqual(["terminated", "checkpoint"]);
  });

  it("redacts quoted structured secret keys before artifact persistence", () => {
    // Production break caught: rendered Compose JSON persists values under
    // quoted POSTGRES_PASSWORD/authorization keys despite text redaction.
    expect(redactStructuredData({
      POSTGRES_PASSWORD: "quoted-secret",
      nested: { authorization: "Bearer private-token", safe: "visible" },
    })).toEqual({
      POSTGRES_PASSWORD: "[REDACTED]",
      nested: { authorization: "[REDACTED]", safe: "visible" },
    });
  });

  it("persists rendered Compose evidence with structured secrets redacted", () => {
    const result = runCli(["doctor", "--format", "json"]);
    const envelope = JSON.parse(result.stdout) as { artifacts: string[] };
    const composeArtifact = envelope.artifacts.find((artifact) => artifact.includes("compose-config"));
    expect(composeArtifact).toBeDefined();
    const evidence = readFileSync(composeArtifact!, "utf8");
    expect(evidence).toContain("[REDACTED]");
    expect(evidence).not.toContain('"POSTGRES_PASSWORD":"music"');
    expect(evidence).not.toContain("fixture-read-only-token");
  });

  it("returns a typed JSON doctor diagnosis for an invalid environment", () => {
    // Production break caught: run-context parsing throws before doctor can
    // emit its documented JSON failure and recovery guidance.
    const environmentPath = join(repositoryRoot, ".env.music.test");
    const previous = existsSync(environmentPath) ? readFileSync(environmentPath, "utf8") : undefined;
    writeFileSync(environmentPath, "MUSIC_MODE=fixture\nDATABASE_URL_TEST=postgresql://production.example/music\n");
    try {
      const result = runCli(["doctor", "--format", "json"]);
      expect(result.exitCode).toBe(3);
      expect(JSON.parse(result.stdout)).toMatchObject({ command: "doctor", status: "failure", phase: "doctor" });
    } finally {
      if (previous === undefined) rmSync(environmentPath, { force: true });
      else writeFileSync(environmentPath, previous);
    }
  });

  it("returns one typed JSON doctor diagnosis for malformed env-file syntax", () => {
    // Production break caught: a line without '=' throws while constructing
    // run context, before doctor can emit its categorized JSON result.
    const environmentPath = join(repositoryRoot, ".env.music.test");
    const previous = existsSync(environmentPath) ? readFileSync(environmentPath, "utf8") : undefined;
    writeFileSync(environmentPath, "MUSIC_MODE=fixture\nMALFORMED_LINE_WITHOUT_EQUALS\n");
    try {
      const result = runCli(["doctor", "--format", "json"]);
      const lines = result.stdout.trim().split(/\r?\n/);
      expect(result.exitCode).toBe(3);
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0])).toMatchObject({ command: "doctor", status: "failure", phase: "doctor" });
    } finally {
      if (previous === undefined) rmSync(environmentPath, { force: true });
      else writeFileSync(environmentPath, previous);
    }
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
      execFileSync(process.execPath, [tsxCli, "scripts/music-cli.ts", "bootstrap", "--resume", checkpoint, "--format", "json"], {
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

  it("safety-refuses db:migrate without an explicit disposable target", () => {
    // Production break caught: a versioned migrator reads an ambient production
    // DATABASE_URL when the operator did not explicitly select the test target.
    const result = runCli(["db:migrate", "--format", "json"], {
      ...process.env,
      DATABASE_URL: "postgresql://owner:secret@production.example.com:5432/music",
    });

    expect(result.exitCode).toBe(5);
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: "db:migrate",
      status: "blocked",
      phase: "database-target",
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
