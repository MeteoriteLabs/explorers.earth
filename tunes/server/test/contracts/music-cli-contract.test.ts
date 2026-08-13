import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

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
    writeFileSync(checkpoint, JSON.stringify({ commit: "previous-commit", fixtureVersion: "1", gateValues: "unrecorded", environmentFingerprint: `${process.platform}:${process.version}` }));
    try {
      execFileSync(process.execPath, ["scripts/music-cli.ts", "bootstrap", "--resume", checkpoint, "--format", "json"], {
        cwd: resolve(import.meta.dirname, "../../.."),
        encoding: "utf8",
        env: { ...process.env, GIT_COMMIT: "current-commit" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      throw new Error("expected the resume safety refusal");
    } catch (error) {
      const failure = error as { status?: number; stdout?: string };
      expect(failure.status).toBe(3);
      expect(failure.stdout).toContain("resume checkpoint commit does not match");
    }
  });
});
