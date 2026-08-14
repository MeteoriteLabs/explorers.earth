import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupFixtureMusicTokenSecret,
  prepareFixtureMusicTokenSecret,
} from "../../../scripts/music-fixture-secret";

let roots: string[] = [];
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots = [];
});

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "music-fixture-secret-"));
  roots.push(root);
  return root;
}

describe("disposable fixture Music token secret", () => {
  it("replaces the exact regular file on every run and enforces 0600 where supported", () => {
    const root = fixtureRoot();
    const directory = join(root, ".artifacts", "music-token-secrets");
    const path = join(directory, "current");
    mkdirSync(directory, { recursive: true });
    writeFileSync(path, "stale-fixture-secret", { mode: 0o644 });
    chmodSync(path, 0o644);

    expect(prepareFixtureMusicTokenSecret(root, () => Buffer.alloc(32, 0x71))).toBe(path);
    const first = readFileSync(path, "utf8");
    expect(first).toBe(Buffer.alloc(32, 0x71).toString("base64url"));
    expect(lstatSync(path).isFile()).toBe(true);
    if (process.platform !== "win32") expect(statSync(path).mode & 0o777).toBe(0o600);

    prepareFixtureMusicTokenSecret(root, () => Buffer.alloc(32, 0x72));
    expect(readFileSync(path, "utf8")).toBe(Buffer.alloc(32, 0x72).toString("base64url"));
  });

  it("refuses a junction at the exact artifact and cleanup removes only the exact regular file", () => {
    const root = fixtureRoot();
    const directory = join(root, ".artifacts", "music-token-secrets");
    const path = join(directory, "current");
    const target = fixtureRoot();
    mkdirSync(directory, { recursive: true });
    symlinkSync(target, path, "junction");
    expect(() => prepareFixtureMusicTokenSecret(root)).toThrow(/fixture signing key|regular|link/i);
    expect(statSync(target).isDirectory()).toBe(true);
    rmSync(path, { recursive: true, force: true });

    prepareFixtureMusicTokenSecret(root, () => Buffer.alloc(32, 0x73));
    cleanupFixtureMusicTokenSecret(root);
    expect(() => lstatSync(path)).toThrow();
    expect(statSync(directory).isDirectory()).toBe(true);
  });
});
