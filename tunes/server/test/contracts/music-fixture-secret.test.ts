import { chmodSync, closeSync, fsyncSync, ftruncateSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupAllFixtureMusicTokenSecrets,
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
      write: (descriptor: number, buffer: Uint8Array) => writeSync(descriptor, buffer, 0, 3, 0),
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

  it.each(["truncate", "sync", "close"] as const)("fails closed when descriptor %s erasure fails and a verified retry removes the secret", (failure) => {
    // Production break caught: eraseDescriptor swallows the syscall failure
    // and teardown reports success while credential bytes can remain.
    const root = fixtureRoot();
    const path = prepareFixtureMusicTokenSecret(root, () => Buffer.alloc(32, 0x7a), {
      randomNameBytes: () => Buffer.alloc(16, failure === "truncate" ? 0x51 : failure === "sync" ? 0x52 : 0x53),
    } as never);
    const targetId = basename(path);
    const dependencies = failure === "truncate"
      ? { truncate: () => { throw new Error("truncate-secret-sentinel"); } }
      : failure === "sync"
        ? { sync: () => { throw new Error("sync-secret-sentinel"); } }
        : { close: (descriptor: number) => { closeSync(descriptor); throw new Error("close-secret-sentinel"); } };

    let caught: unknown;
    try {
      cleanupFixtureMusicTokenSecret(root, path, dependencies as never);
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({
      name: "FixtureSecretCleanupError",
      code: "MUSIC_FIXTURE_SECRET_CLEANUP_FAILED",
      targetId,
    });
    expect(String(caught)).not.toContain(root);
    expect(String(caught)).not.toContain(`${failure}-secret-sentinel`);

    cleanupFixtureMusicTokenSecret(root, path);
    expect(lstatSync(path).size).toBe(0);
  });

  it("rejects teardown success when failure-path erasure itself cannot complete", async () => {
    // Production break caught: an action failure hides a second cleanup
    // failure and returns an apparently ordinary teardown error.
    const root = fixtureRoot();
    const path = prepareFixtureMusicTokenSecret(root, () => Buffer.alloc(32, 0x7b), {
      randomNameBytes: () => Buffer.alloc(16, 0x54),
    } as never);
    const cleanup = (fixtureSecrets as unknown as {
      withFixtureMusicTokenSecretCleanup: <T>(root: string, path: string, action: () => Promise<T>, dependencies?: unknown) => Promise<T>;
    }).withFixtureMusicTokenSecretCleanup(root, path, async () => { throw new Error("action-secret-sentinel"); }, {
      truncate: () => { throw new Error("truncate-secret-sentinel"); },
    });

    await expect(cleanup).rejects.toMatchObject({
      name: "FixtureSecretCleanupError",
      code: "MUSIC_FIXTURE_SECRET_CLEANUP_FAILED",
      targetId: basename(path),
    });
    cleanupFixtureMusicTokenSecret(root, path);
    expect(lstatSync(path).size).toBe(0);
  });
});

describe("fixture environment secret persistence", () => {
  type PersistenceDependencies = {
    randomNameBytes?: (size: number) => Buffer;
    open?: typeof openSync;
    write?: typeof writeSync;
    sync?: typeof fsyncSync;
    close?: typeof closeSync;
    truncate?: typeof ftruncateSync;
    rename?: typeof renameSync;
    beforePublish?: () => void;
    syncDirectory?: (path: string) => void;
  };
  type Persist = (root: string, contents: string, dependencies?: PersistenceDependencies) => string;

  function requiredPersist(): Persist {
    const candidate = (fixtureSecrets as unknown as { persistFixtureMusicEnvironment?: Persist }).persistFixtureMusicEnvironment;
    expect(candidate, "secure environment persistence API is required").toBeTypeOf("function");
    return candidate!;
  }

  it("never follows or overwrites a precreated attacker temporary leaf", () => {
    // Production break caught: .env.music.test.<pid>.tmp is opened with `w`
    // and follows a precreated link to an outside sentinel.
    const root = fixtureRoot();
    const attacker = join(root, `.env.music.test.${Buffer.alloc(16, 0x61).toString("hex")}.tmp`);
    const destination = join(root, ".env.music.test");
    writeFileSync(attacker, "attacker-temp-must-not-change", { mode: 0o640 });
    writeFileSync(destination, "PREVIOUS=byte-exact\n", { mode: 0o600 });
    const attackerMode = statSync(attacker).mode;

    expect(() => requiredPersist()(root, "SESSION_SECRET=new-secret-sentinel\n", {
      randomNameBytes: () => Buffer.alloc(16, 0x61),
    })).toThrow(/fixture environment|publish|secure/i);
    expect(readFileSync(attacker, "utf8")).toBe("attacker-temp-must-not-change");
    expect(statSync(attacker).mode).toBe(attackerMode);
    expect(readFileSync(destination, "utf8")).toBe("PREVIOUS=byte-exact\n");
  });

  it.each(["short-write", "sync", "rename"] as const)("preserves the prior environment and leaves no secret residue after %s failure", (failure) => {
    // Production break caught: a populated predictable temp remains after a
    // write/fsync/rename failure and the prior valid environment can be lost.
    const root = fixtureRoot();
    const destination = join(root, ".env.music.test");
    const previous = "PREVIOUS=byte-exact\n";
    const secret = "SESSION_SECRET=raw-secret-residue-sentinel\n";
    writeFileSync(destination, previous, { mode: 0o600 });
    const dependencies: Record<string, unknown> = {
      randomNameBytes: () => Buffer.alloc(16, failure === "short-write" ? 0x62 : failure === "sync" ? 0x63 : 0x64),
    };
    if (failure === "short-write") dependencies.write = () => 3;
    if (failure === "sync") {
      let calls = 0;
      dependencies.sync = (descriptor: number) => {
        calls += 1;
        if (calls === 1) throw new Error("environment-sync-sentinel");
        return fsyncSync(descriptor);
      };
    }
    if (failure === "rename") dependencies.rename = () => { throw new Error("environment-rename-sentinel"); };

    expect(() => requiredPersist()(root, secret, dependencies as PersistenceDependencies))
      .toThrow(/fixture environment|publish|secure/i);
    expect(readFileSync(destination, "utf8")).toBe(previous);
    const temporaryLeaves = readdirSync(root).filter((name) => name.startsWith(".env.music.test.") && name.endsWith(".tmp"));
    expect(temporaryLeaves).toHaveLength(1);
    expect(temporaryLeaves.map((name) => readFileSync(join(root, name), "utf8"))).toEqual([""]);
  });

  it.each(["close", "directory-sync"] as const)("finishes %s before commit and preserves the prior environment on failure", (failure) => {
    // Production break caught: close/directory durability runs after rename,
    // so an injected failure truncates the newly published destination and
    // has already destroyed the byte-exact prior environment.
    const root = fixtureRoot();
    const destination = join(root, ".env.music.test");
    const previous = "PREVIOUS=byte-exact\n";
    const secret = "SESSION_SECRET=must-remain-unpublished\n";
    writeFileSync(destination, previous, { mode: 0o600 });
    const before = lstatSync(destination);
    let closeCalls = 0;
    const dependencies: PersistenceDependencies = {
      randomNameBytes: () => Buffer.alloc(16, failure === "close" ? 0x68 : 0x69),
    };
    if (failure === "close") {
      dependencies.close = (descriptor) => {
        closeCalls += 1;
        if (closeCalls === 1) throw new Error("environment-close-sentinel");
        return closeSync(descriptor);
      };
    } else {
      dependencies.syncDirectory = () => { throw new Error("environment-directory-sync-sentinel"); };
    }

    expect(() => requiredPersist()(root, secret, dependencies)).toThrow(/fixture environment|publish|cleanup/i);
    const after = lstatSync(destination);
    expect(readFileSync(destination, "utf8")).toBe(previous);
    expect({ dev: after.dev, ino: after.ino, mode: after.mode }).toEqual({ dev: before.dev, ino: before.ino, mode: before.mode });
    const temporaryLeaves = readdirSync(root).filter((name) => name.startsWith(".env.music.test.") && name.endsWith(".tmp"));
    expect(temporaryLeaves).toHaveLength(1);
    expect(readFileSync(join(root, temporaryLeaves[0]!), "utf8")).toBe("");
  });

  it("validates the opened temporary inode before commit and never publishes or mutates an attacker replacement", () => {
    // Production break caught: final temporary-path validation happens only
    // after rename, when the prior destination has already been replaced.
    const root = fixtureRoot();
    const destination = join(root, ".env.music.test");
    const previous = "PREVIOUS=byte-exact\n";
    const temporaryName = `.env.music.test.${Buffer.alloc(16, 0x6a).toString("hex")}.tmp`;
    const temporary = join(root, temporaryName);
    const displaced = join(root, "opened-temp-displaced-by-attacker");
    writeFileSync(destination, previous, { mode: 0o600 });
    const before = lstatSync(destination);

    expect(() => requiredPersist()(root, "SESSION_SECRET=opened-secret-sentinel\n", {
      randomNameBytes: () => Buffer.alloc(16, 0x6a),
      beforePublish: () => {
        renameSync(temporary, displaced);
        writeFileSync(temporary, "attacker-replacement-must-not-change", { mode: 0o640 });
      },
    })).toThrow(/fixture environment|publish|cleanup/i);

    const after = lstatSync(destination);
    expect(readFileSync(destination, "utf8")).toBe(previous);
    expect({ dev: after.dev, ino: after.ino, mode: after.mode }).toEqual({ dev: before.dev, ino: before.ino, mode: before.mode });
    expect(readFileSync(temporary, "utf8")).toBe("attacker-replacement-must-not-change");
    expect(readFileSync(displaced, "utf8")).toBe("");
  });

  it("treats an observed completed atomic rename as committed and restarts deterministically", () => {
    // Production break caught: a rename wrapper that reports uncertainty
    // after committing routes the published destination through temp erasure.
    const root = fixtureRoot();
    const destination = join(root, ".env.music.test");
    const first = "SESSION_SECRET=first-committed-value\n";
    const second = "SESSION_SECRET=restart-value\n";
    writeFileSync(destination, "PREVIOUS=byte-exact\n", { mode: 0o600 });

    const result = requiredPersist()(root, first, {
      randomNameBytes: () => Buffer.alloc(16, 0x6b),
      rename: (source, target) => {
        renameSync(source, target);
        throw new Error("rename-result-uncertain-after-commit");
      },
    });
    expect(result).toBe(destination);
    expect(readFileSync(destination, "utf8")).toBe(first);
    expect(readdirSync(root).filter((name) => name.endsWith(".tmp"))).toHaveLength(0);

    expect(requiredPersist()(root, second, {
      randomNameBytes: () => Buffer.alloc(16, 0x6c),
    })).toBe(destination);
    expect(readFileSync(destination, "utf8")).toBe(second);
    expect(readdirSync(root).filter((name) => name.endsWith(".tmp"))).toHaveLength(0);
  });

  it("rejects an ancestor swap before publish without mutating the outside target or prior environment", () => {
    // Production break caught: pathname rename follows a swapped ancestor
    // after the temp descriptor was validated.
    const container = fixtureRoot();
    const root = join(container, "repo");
    const moved = join(container, "repo-owned");
    const outside = join(container, "outside");
    mkdirSync(root);
    mkdirSync(outside);
    writeFileSync(join(root, ".env.music.test"), "PREVIOUS=byte-exact\n", { mode: 0o600 });
    writeFileSync(join(outside, ".env.music.test"), "outside-must-not-change", { mode: 0o640 });
    let swapped = false;
    let swapBlocked = false;
    try {
      expect(() => requiredPersist()(root, "SESSION_SECRET=new-secret-sentinel\n", {
        randomNameBytes: () => Buffer.alloc(16, 0x65),
        beforePublish: () => {
          try {
            renameSync(root, moved);
            symlinkSync(outside, root, "junction");
            swapped = true;
          } catch (error) {
            if (process.platform !== "win32" || (error as NodeJS.ErrnoException).code !== "EPERM") throw error;
            swapBlocked = true;
            throw error;
          }
        },
      })).toThrow(/fixture environment|publish|secure/i);
      expect(swapped || swapBlocked).toBe(true);
      expect(readFileSync(join(outside, ".env.music.test"), "utf8")).toBe("outside-must-not-change");
      const ownedRoot = swapBlocked ? root : moved;
      expect(readFileSync(join(ownedRoot, ".env.music.test"), "utf8")).toBe("PREVIOUS=byte-exact\n");
      const temporary = readdirSync(ownedRoot).find((name) => name.endsWith(".tmp"));
      expect(temporary).toBeDefined();
      expect(readFileSync(join(ownedRoot, temporary!), "utf8")).toBe("");
    } finally {
      if (swapped) unlinkSync(root);
    }
  });

  it("publishes a complete mode-0600 environment through a fresh exclusive descriptor", () => {
    // Production break caught: bootstrap writes a default-mode path-following
    // temporary environment instead of an exclusively opened descriptor.
    const root = fixtureRoot();
    const contents = "SESSION_SECRET=complete-secret\nCOOKIE_SECRET=complete-cookie\n";
    const destination = requiredPersist()(root, contents, {
      randomNameBytes: () => Buffer.alloc(16, 0x66),
    });
    expect(destination).toBe(join(root, ".env.music.test"));
    expect(readFileSync(destination, "utf8")).toBe(contents);
    if (process.platform !== "win32") expect(statSync(destination).mode & 0o777).toBe(0o600);
    expect(readdirSync(root).filter((name) => name.endsWith(".tmp"))).toHaveLength(0);
  });

  it("surfaces failed environment erasure and lets the normal fixture cleanup retry the exact tombstone", () => {
    // Production break caught: a failed temp-file erase has no safe retry
    // path, so reset/down can report success while secret bytes remain.
    const root = fixtureRoot();
    const targetId = `.env.music.test.${Buffer.alloc(16, 0x67).toString("hex")}.tmp`;
    expect(() => requiredPersist()(root, "SESSION_SECRET=raw-secret-residue-sentinel\n", {
      randomNameBytes: () => Buffer.alloc(16, 0x67),
      write: ((descriptor: number, buffer: Uint8Array) => writeSync(descriptor, buffer, 0, 3, 0)) as typeof writeSync,
      truncate: () => { throw new Error("environment-erase-sentinel"); },
    })).toThrow(expect.objectContaining({
      name: "FixtureSecretCleanupError",
      code: "MUSIC_FIXTURE_SECRET_CLEANUP_FAILED",
      targetId,
    }));
    expect(lstatSync(join(root, targetId)).size).toBe(3);

    cleanupAllFixtureMusicTokenSecrets(root);
    expect(lstatSync(join(root, targetId)).size).toBe(0);
  });
});
