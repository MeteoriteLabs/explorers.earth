import { chmodSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupFixtureMusicTokenSecret,
  prepareFixtureMusicTokenSecret,
} from "../../../scripts/music-fixture-secret";
import * as fixtureSecrets from "../../../scripts/music-fixture-secret";

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

  it("refuses a leaf swapped to an outside symlink before descriptor writes", () => {
    const root = fixtureRoot();
    const outsideRoot = fixtureRoot();
    const directory = join(root, ".artifacts", "music-token-secrets");
    const path = join(directory, "current");
    const outside = join(outsideRoot, "outside-sentinel");
    mkdirSync(directory, { recursive: true });
    writeFileSync(path, "owned-old-secret", { mode: 0o600 });
    writeFileSync(outside, "outside-must-not-change", { mode: 0o600 });
    let swapRan = false;

    expect(() => (prepareFixtureMusicTokenSecret as unknown as (
      root: string,
      random: () => Buffer,
      dependencies: { open: (path: string, flags: number, mode: number) => number },
    ) => string)(root, () => Buffer.alloc(32, 0x74), {
      open: (target, flags, mode) => {
        swapRan = true;
        unlinkSync(target);
        symlinkSync(outside, target, "file");
        return openSync(target, flags, mode);
      },
    })).toThrow(/fixture signing key|regular|link/i);

    expect(swapRan).toBe(true);
    expect(readFileSync(outside, "utf8")).toBe("outside-must-not-change");
  });

  it("refuses an ancestor junction swap before descriptor writes and leaves the outside file untouched", () => {
    const root = fixtureRoot();
    const outsideRoot = fixtureRoot();
    const directory = join(root, ".artifacts", "music-token-secrets");
    const movedDirectory = join(root, ".artifacts", "music-token-secrets-owned");
    const path = join(directory, "current");
    const outside = join(outsideRoot, "current");
    mkdirSync(directory, { recursive: true });
    writeFileSync(path, "owned-old-secret", { mode: 0o600 });
    writeFileSync(outside, "outside-must-not-change", { mode: 0o600 });
    let swapRan = false;

    expect(() => prepareFixtureMusicTokenSecret(root, () => Buffer.alloc(32, 0x76), {
      open: (target, flags, mode) => {
        swapRan = true;
        renameSync(directory, movedDirectory);
        symlinkSync(outsideRoot, directory, "junction");
        return openSync(target, flags, mode);
      },
    })).toThrow(/fixture signing key|regular|link/i);
    expect(swapRan).toBe(true);
    expect(readFileSync(outside, "utf8")).toBe("outside-must-not-change");
    expect(readFileSync(join(movedDirectory, "current"), "utf8")).toBe("owned-old-secret");
  });

  it("cleans the exact owned fixture key when fixture reset or teardown fails", async () => {
    const root = fixtureRoot();
    const path = prepareFixtureMusicTokenSecret(root, () => Buffer.alloc(32, 0x75));
    let failure: unknown;
    try {
      await (fixtureSecrets as unknown as {
        withFixtureMusicTokenSecretCleanup: <T>(root: string, action: () => Promise<T>) => Promise<T>;
      }).withFixtureMusicTokenSecretCleanup(root, async () => {
        throw new Error("forced fixture teardown failure");
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ message: "forced fixture teardown failure" });
    expect(() => lstatSync(path)).toThrow();
  });
});
