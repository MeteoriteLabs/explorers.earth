import { chmodSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
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
  it("creates a fresh unpredictable exclusive leaf without overwriting the prior valid key", () => {
    const root = fixtureRoot();
    const directory = join(root, ".artifacts", "music-token-secrets");
    mkdirSync(directory, { recursive: true });
    const first = prepareFixtureMusicTokenSecret(root, () => Buffer.alloc(32, 0x71), {
      randomNameBytes: () => Buffer.alloc(16, 0x11),
    } as never);
    const firstBytes = readFileSync(first, "utf8");
    const second = prepareFixtureMusicTokenSecret(root, () => Buffer.alloc(32, 0x72), {
      randomNameBytes: () => Buffer.alloc(16, 0x22),
    } as never);

    expect(first).not.toBe(second);
    expect(first).toMatch(/current-[a-f0-9]{32}$/);
    expect(second).toMatch(/current-[a-f0-9]{32}$/);
    expect(firstBytes).toBe(Buffer.alloc(32, 0x71).toString("base64url"));
    expect(readFileSync(first, "utf8")).toBe(firstBytes);
    expect(readFileSync(second, "utf8")).toBe(Buffer.alloc(32, 0x72).toString("base64url"));
    if (process.platform !== "win32") expect(statSync(second).mode & 0o777).toBe(0o600);
  });

  it("leaves the prior key byte-exact when a fresh key write crashes or is short", () => {
    const root = fixtureRoot();
    const prior = prepareFixtureMusicTokenSecret(root, () => Buffer.alloc(32, 0x73), {
      randomNameBytes: () => Buffer.alloc(16, 0x31),
    } as never);
    const priorBytes = readFileSync(prior);

    expect(() => prepareFixtureMusicTokenSecret(root, () => Buffer.alloc(32, 0x74), {
      randomNameBytes: () => Buffer.alloc(16, 0x32),
      write: () => 3,
    } as never)).toThrow(/fixture signing key|short|write/i);

    expect(readFileSync(prior)).toEqual(priorBytes);
    const failedLeaf = join(root, ".artifacts", "music-token-secrets", `current-${Buffer.alloc(16, 0x32).toString("hex")}`);
    expect(lstatSync(failedLeaf).size).toBe(0);
  });

  it("refuses a leaf swapped to an outside symlink before descriptor writes", () => {
    const root = fixtureRoot();
    const outsideRoot = fixtureRoot();
    const directory = join(root, ".artifacts", "music-token-secrets");
    const path = join(directory, `current-${Buffer.alloc(16, 0x41).toString("hex")}`);
    const outside = join(outsideRoot, "outside-sentinel");
    mkdirSync(directory, { recursive: true });
    writeFileSync(path, "owned-old-secret", { mode: 0o600 });
    writeFileSync(outside, "outside-must-not-change", { mode: 0o600 });
    let swapRan = false;

    expect(() => (prepareFixtureMusicTokenSecret as unknown as (
      root: string,
      random: () => Buffer,
      dependencies: { randomNameBytes: () => Buffer; open: (path: string, flags: number, mode: number) => number },
    ) => string)(root, () => Buffer.alloc(32, 0x74), {
      randomNameBytes: () => Buffer.alloc(16, 0x41),
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
    const path = join(directory, `current-${Buffer.alloc(16, 0x42).toString("hex")}`);
    const outside = join(outsideRoot, `current-${Buffer.alloc(16, 0x42).toString("hex")}`);
    mkdirSync(directory, { recursive: true });
    writeFileSync(path, "owned-old-secret", { mode: 0o600 });
    writeFileSync(outside, "outside-must-not-change", { mode: 0o600 });
    let swapRan = false;

    expect(() => prepareFixtureMusicTokenSecret(root, () => Buffer.alloc(32, 0x76), {
      randomNameBytes: () => Buffer.alloc(16, 0x42),
      open: (target, flags, mode) => {
        swapRan = true;
        renameSync(directory, movedDirectory);
        symlinkSync(outsideRoot, directory, "junction");
        return openSync(target, flags, mode);
      },
    })).toThrow(/fixture signing key|regular|link/i);
    expect(swapRan).toBe(true);
    expect(readFileSync(outside, "utf8")).toBe("outside-must-not-change");
    expect(readFileSync(join(movedDirectory, basename(path)), "utf8")).toBe("owned-old-secret");
  });

  it("erases through the verified descriptor and never unlinks an outside target after an ancestor swap", () => {
    const root = fixtureRoot();
    const outsideRoot = fixtureRoot();
    const directory = join(root, ".artifacts", "music-token-secrets");
    const movedDirectory = join(root, ".artifacts", "music-token-secrets-owned");
    const path = prepareFixtureMusicTokenSecret(root, () => Buffer.alloc(32, 0x75), {
      randomNameBytes: () => Buffer.alloc(16, 0x43),
    } as never);
    const outside = join(outsideRoot, path.slice(path.lastIndexOf(process.platform === "win32" ? "\\" : "/") + 1));
    writeFileSync(outside, "outside-must-not-change", { mode: 0o640 });
    const outsideMode = statSync(outside).mode;
    let swapRan = false;
    let swapBlocked = false;

    (cleanupFixtureMusicTokenSecret as unknown as (
      root: string,
      exactPath: string,
      dependencies: { beforeErase: () => void },
    ) => void)(root, path, {
      beforeErase: () => {
        swapRan = true;
        try {
          renameSync(directory, movedDirectory);
          symlinkSync(outsideRoot, directory, "junction");
        } catch (error) {
          if (process.platform !== "win32" || (error as NodeJS.ErrnoException).code !== "EPERM") throw error;
          swapBlocked = true;
        }
      },
    });

    expect(swapRan).toBe(true);
    expect(readFileSync(outside, "utf8")).toBe("outside-must-not-change");
    expect(statSync(outside).mode).toBe(outsideMode);
    const erased = swapBlocked ? path : join(movedDirectory, basename(path));
    expect(lstatSync(erased).size).toBe(0);
  });

  it("erases the exact fixture secret on reset/teardown success or failure without pathname deletion", async () => {
    for (const shouldFail of [false, true]) {
      const root = fixtureRoot();
      const path = prepareFixtureMusicTokenSecret(root, () => Buffer.alloc(32, shouldFail ? 0x77 : 0x76), {
        randomNameBytes: () => Buffer.alloc(16, shouldFail ? 0x45 : 0x44),
      } as never);
      const action = async () => { if (shouldFail) throw new Error("forced fixture teardown failure"); };
      const cleanup = (fixtureSecrets as unknown as {
        withFixtureMusicTokenSecretCleanup: <T>(root: string, path: string, action: () => Promise<T>) => Promise<T>;
      }).withFixtureMusicTokenSecretCleanup(root, path, action);
      if (shouldFail) await expect(cleanup).rejects.toThrow("forced fixture teardown failure");
      else await expect(cleanup).resolves.toBeUndefined();
      expect(lstatSync(path).isFile()).toBe(true);
      expect(lstatSync(path).size).toBe(0);
    }
  });
});
