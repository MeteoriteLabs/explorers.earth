import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, closeSync, constants, fsyncSync, ftruncateSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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
    afterReferenceCommit?: () => void;
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

    expect(requiredPersist()(root, "SESSION_SECRET=new-secret-sentinel\n", {
      randomNameBytes: () => Buffer.alloc(16, 0x61),
    })).toBe(destination);
    expect(readFileSync(attacker, "utf8")).toBe("attacker-temp-must-not-change");
    expect(statSync(attacker).mode).toBe(attackerMode);
    expect(readFileSync(destination, "utf8")).not.toContain("new-secret-sentinel");
    expect((fixtureSecrets as unknown as { readFixtureMusicEnvironment: (root: string) => string }).readFixtureMusicEnvironment(root)).toBe("SESSION_SECRET=new-secret-sentinel\n");
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
    const byte = failure === "short-write" ? 0x62 : failure === "sync" ? 0x63 : 0x64;
    const generation = join(root, ".artifacts", "music-environment-generations", `generation-${Buffer.alloc(16, byte).toString("hex")}`);
    expect(readFileSync(generation, "utf8")).toBe("");
    expect(readdirSync(root).filter((name) => name.endsWith(".tmp")).every((name) => !readFileSync(join(root, name), "utf8").includes("raw-secret-residue-sentinel"))).toBe(true);
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
    const byte = failure === "close" ? 0x68 : 0x69;
    const generation = join(root, ".artifacts", "music-environment-generations", `generation-${Buffer.alloc(16, byte).toString("hex")}`);
    expect(readFileSync(generation, "utf8")).toBe("");
  });

  it("validates the opened temporary inode before commit and never publishes or mutates an attacker replacement", () => {
    // Production break caught: final temporary-path validation happens only
    // after rename, when the prior destination has already been replaced.
    const root = fixtureRoot();
    const destination = join(root, ".env.music.test");
    const previous = "PREVIOUS=byte-exact\n";
    const temporaryName = `.env.music.test.reference-${Buffer.alloc(16, 0x6a).toString("hex")}.tmp`;
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

    expect(readFileSync(destination, "utf8")).toBe("attacker-replacement-must-not-change");
    expect(readFileSync(displaced, "utf8")).toMatch(/^music-fixture-env\/v1\n/);
    const generation = join(root, ".artifacts", "music-environment-generations", `generation-${Buffer.alloc(16, 0x6a).toString("hex")}`);
    expect(readFileSync(generation, "utf8")).toBe("");
  });

  it("never publishes a secret-bearing source path swapped after final descriptor validation", () => {
    // Production break caught: syncDirectory is the last injected operation
    // before pathname rename, so a Windows source swap publishes attacker
    // content and strands the genuine secret-bearing inode.
    const root = fixtureRoot();
    const destination = join(root, ".env.music.test");
    const previous = "PREVIOUS=byte-exact\n";
    const generation = join(root, ".artifacts", "music-environment-generations", `generation-${Buffer.alloc(16, 0x6d).toString("hex")}`);
    const displaced = join(root, "reviewer-displaced-secret");
    writeFileSync(destination, previous, { mode: 0o600 });

    expect(() => requiredPersist()(root, "SESSION_SECRET=reviewer-secret-sentinel\n", {
      randomNameBytes: () => Buffer.alloc(16, 0x6d),
      syncDirectory: (directory) => {
        if (directory !== join(root, ".artifacts", "music-environment-generations")) return;
        renameSync(generation, displaced);
        writeFileSync(generation, "ATTACKER=published", { mode: 0o666 });
      },
    })).toThrow(/fixture environment|publish|cleanup/i);
    expect(readFileSync(destination, "utf8")).toBe(previous);
    expect(readFileSync(generation, "utf8")).toBe("ATTACKER=published");
    expect(readFileSync(displaced, "utf8")).toBe("");
  });

  it("publishes only a nonsecret generation reference and reads the generation through guarded authority", () => {
    // Production break caught: `.env.music.test` is itself the renamed secret
    // payload and Docker later reopens it through --env-file.
    const root = fixtureRoot();
    const contents = "SESSION_SECRET=reference-secret-sentinel\nMUSIC_MODE=fixture\n";
    const readGeneration = (fixtureSecrets as unknown as {
      readFixtureMusicEnvironment?: (repositoryRoot: string) => string;
    }).readFixtureMusicEnvironment;
    expect(readGeneration, "guarded generation reader is required").toBeTypeOf("function");
    const reference = requiredPersist()(root, contents, {
      randomNameBytes: () => Buffer.alloc(16, 0x6e),
    });

    expect(reference).toBe(join(root, ".env.music.test"));
    expect(readFileSync(reference, "utf8")).toMatch(/^music-fixture-env\/v1\n/);
    expect(readFileSync(reference, "utf8")).not.toContain("reference-secret-sentinel");
    expect(readGeneration!(root)).toBe(contents);
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
    expect((fixtureSecrets as unknown as { readFixtureMusicEnvironment: (root: string) => string }).readFixtureMusicEnvironment(root)).toBe(first);
    expect(readdirSync(root).filter((name) => name.endsWith(".tmp"))).toHaveLength(0);

    expect(requiredPersist()(root, second, {
      randomNameBytes: () => Buffer.alloc(16, 0x6c),
    })).toBe(destination);
    expect((fixtureSecrets as unknown as { readFixtureMusicEnvironment: (root: string) => string }).readFixtureMusicEnvironment(root)).toBe(second);
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
      const generation = join(ownedRoot, ".artifacts", "music-environment-generations", `generation-${Buffer.alloc(16, 0x65).toString("hex")}`);
      expect(readFileSync(generation, "utf8")).toBe("");
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
    expect(readFileSync(destination, "utf8")).toMatch(/^music-fixture-env\/v1\n/);
    expect(readFileSync(destination, "utf8")).not.toContain("complete-secret");
    expect((fixtureSecrets as unknown as { readFixtureMusicEnvironment: (root: string) => string }).readFixtureMusicEnvironment(root)).toBe(contents);
    const generation = join(root, ".artifacts", "music-environment-generations", `generation-${Buffer.alloc(16, 0x66).toString("hex")}`);
    if (process.platform !== "win32") expect(statSync(generation).mode & 0o777).toBe(0o600);
    expect(readdirSync(root).filter((name) => name.endsWith(".tmp"))).toHaveLength(0);
  });

  it("surfaces failed environment erasure and lets the normal fixture cleanup retry the exact tombstone", () => {
    // Production break caught: a failed temp-file erase has no safe retry
    // path, so reset/down can report success while secret bytes remain.
    const root = fixtureRoot();
    const targetId = `generation-${Buffer.alloc(16, 0x67).toString("hex")}`;
    expect(() => requiredPersist()(root, "SESSION_SECRET=raw-secret-residue-sentinel\n", {
      randomNameBytes: () => Buffer.alloc(16, 0x67),
      write: ((descriptor: number, buffer: Uint8Array) => writeSync(descriptor, buffer, 0, 3, 0)) as typeof writeSync,
      truncate: () => { throw new Error("environment-erase-sentinel"); },
    })).toThrow(expect.objectContaining({
      name: "FixtureSecretCleanupError",
      code: "MUSIC_FIXTURE_SECRET_CLEANUP_FAILED",
      targetId,
    }));
    const target = join(root, ".artifacts", "music-environment-generations", targetId);
    expect(lstatSync(target).size).toBe(3);

    cleanupAllFixtureMusicTokenSecrets(root);
    expect(lstatSync(target).size).toBe(0);
    expect(() => cleanupAllFixtureMusicTokenSecrets(root)).not.toThrow();
  });

  it("rotates generations, erases the previous authority, and fails closed on reader races", () => {
    const root = fixtureRoot();
    const reader = (fixtureSecrets as unknown as {
      readFixtureMusicEnvironment: (root: string, dependencies?: { afterReferenceRead?: () => void; afterGenerationOpen?: () => void }) => string;
    }).readFixtureMusicEnvironment;
    requiredPersist()(root, "SESSION_SECRET=first\n", { randomNameBytes: () => Buffer.alloc(16, 0x71) });
    requiredPersist()(root, "SESSION_SECRET=second\n", { randomNameBytes: () => Buffer.alloc(16, 0x72) });
    const first = join(root, ".artifacts", "music-environment-generations", `generation-${Buffer.alloc(16, 0x71).toString("hex")}`);
    const second = join(root, ".artifacts", "music-environment-generations", `generation-${Buffer.alloc(16, 0x72).toString("hex")}`);
    expect(readFileSync(first, "utf8")).toBe("");
    expect(reader(root)).toBe("SESSION_SECRET=second\n");

    const displaced = join(root, "displaced-current-generation");
    expect(() => reader(root, { afterGenerationOpen: () => {
      renameSync(second, displaced);
      writeFileSync(second, "x".repeat("SESSION_SECRET=second\n".length), { mode: 0o600 });
    } })).toThrow(/fixture environment|publish/i);
    expect(readFileSync(second, "utf8")).toBe("x".repeat("SESSION_SECRET=second\n".length));
    expect(readFileSync(displaced, "utf8")).toBe("SESSION_SECRET=second\n");
  });

  it("fails cleanup closed when the referenced generation was attacker-replaced", () => {
    const root = fixtureRoot();
    requiredPersist()(root, "SESSION_SECRET=owned-current\n", {
      randomNameBytes: () => Buffer.alloc(16, 0x73),
    });
    const generation = join(root, ".artifacts", "music-environment-generations", `generation-${Buffer.alloc(16, 0x73).toString("hex")}`);
    const displaced = join(root, "displaced-owned-generation");
    const attacker = "ATTACKER_ENV=unchanged_value\n";
    expect(Buffer.byteLength(attacker)).toBe(Buffer.byteLength("SESSION_SECRET=owned-current\n"));
    renameSync(generation, displaced);
    writeFileSync(generation, attacker, { mode: 0o600 });

    expect(() => cleanupAllFixtureMusicTokenSecrets(root)).toThrow(expect.objectContaining({
      code: "MUSIC_FIXTURE_SECRET_CLEANUP_FAILED",
      targetId: basename(generation),
    }));
    expect(readFileSync(generation, "utf8")).toBe(attacker);
    expect(readFileSync(displaced, "utf8")).toBe("SESSION_SECRET=owned-current\n");
  });

  it("fails a pointer swap closed without reading or mutating the attacker generation", () => {
    const root = fixtureRoot();
    const reader = (fixtureSecrets as unknown as {
      readFixtureMusicEnvironment: (root: string, dependencies?: { afterReferenceRead?: () => void }) => string;
    }).readFixtureMusicEnvironment;
    requiredPersist()(root, "SESSION_SECRET=owned-current\n", {
      randomNameBytes: () => Buffer.alloc(16, 0x74),
    });
    const reference = join(root, ".env.music.test");
    const displacedReference = join(root, "displaced-owned-reference");
    const attackerName = `generation-${Buffer.alloc(16, 0x75).toString("hex")}`;
    const attackerGeneration = join(root, ".artifacts", "music-environment-generations", attackerName);
    const attacker = "ATTACKER_ENV=must_not_be_read\n";
    const attackerDigest = createHash("sha256").update(attacker).digest("hex");
    writeFileSync(attackerGeneration, attacker, { mode: 0o600 });

    expect(() => reader(root, { afterReferenceRead: () => {
      renameSync(reference, displacedReference);
      writeFileSync(reference, `music-fixture-env/v1\ngeneration=${attackerName}\nsha256=${attackerDigest}\nsize=${Buffer.byteLength(attacker)}\n`, { mode: 0o600 });
    } })).toThrow(/fixture environment|publish/i);
    expect(readFileSync(attackerGeneration, "utf8")).toBe(attacker);
    expect(readFileSync(reference, "utf8")).toContain(attackerName);
  });

  it("detects a same-inode pointer rewrite during guarded resolution", () => {
    const root = fixtureRoot();
    const reader = (fixtureSecrets as unknown as {
      readFixtureMusicEnvironment: (root: string, dependencies?: { afterReferenceRead?: () => void }) => string;
    }).readFixtureMusicEnvironment;
    requiredPersist()(root, "SESSION_SECRET=owned-current\n", {
      randomNameBytes: () => Buffer.alloc(16, 0x76),
    });
    const reference = join(root, ".env.music.test");
    const attackerName = `generation-${Buffer.alloc(16, 0x77).toString("hex")}`;
    const attacker = "ATTACKER_ENV=must_not_be_read\n";
    const attackerDigest = createHash("sha256").update(attacker).digest("hex");
    const attackerReference = `music-fixture-env/v1\ngeneration=${attackerName}\nsha256=${attackerDigest}\nsize=${Buffer.byteLength(attacker)}\n`;
    expect(Buffer.byteLength(attackerReference)).toBe(lstatSync(reference).size);

    expect(() => reader(root, { afterReferenceRead: () => {
      const descriptor = openSync(reference, constants.O_WRONLY);
      try { expect(writeSync(descriptor, Buffer.from(attackerReference), 0, Buffer.byteLength(attackerReference), 0)).toBe(Buffer.byteLength(attackerReference)); }
      finally { closeSync(descriptor); }
    } })).toThrow(/fixture environment|publish/i);
  });

  it("keeps the committed generation readable when a postcommit callback fails", () => {
    const root = fixtureRoot();
    requiredPersist()(root, "SESSION_SECRET=prior-authority\n", {
      randomNameBytes: () => Buffer.alloc(16, 0x78),
    });
    const current = "SESSION_SECRET=committed-authority\n";
    expect(() => requiredPersist()(root, current, {
      randomNameBytes: () => Buffer.alloc(16, 0x79),
      afterReferenceCommit: () => { throw new Error("postcommit-callback-sentinel"); },
    })).toThrow(expect.objectContaining({ code: "MUSIC_FIXTURE_SECRET_CLEANUP_FAILED" }));

    expect((fixtureSecrets as unknown as { readFixtureMusicEnvironment: (root: string) => string }).readFixtureMusicEnvironment(root)).toBe(current);
    const generation = join(root, ".artifacts", "music-environment-generations", `generation-${Buffer.alloc(16, 0x79).toString("hex")}`);
    expect(readFileSync(generation, "utf8")).toBe(current);
  });

  it("binds postcommit prior-generation cleanup to the captured inode and digest", () => {
    const root = fixtureRoot();
    const prior = "SESSION_SECRET=prior-authority\n";
    const current = "SESSION_SECRET=current-authority\n";
    requiredPersist()(root, prior, { randomNameBytes: () => Buffer.alloc(16, 0x7a) });
    const priorGeneration = join(root, ".artifacts", "music-environment-generations", `generation-${Buffer.alloc(16, 0x7a).toString("hex")}`);
    const displaced = join(root, "displaced-prior-generation");
    const attacker = "ATTACKER_ENV=do_not_mutate____\n";
    expect(Buffer.byteLength(attacker)).toBe(Buffer.byteLength(prior));

    expect(() => requiredPersist()(root, current, {
      randomNameBytes: () => Buffer.alloc(16, 0x7b),
      afterReferenceCommit: () => {
        renameSync(priorGeneration, displaced);
        writeFileSync(priorGeneration, attacker, { mode: 0o600 });
      },
    })).toThrow(expect.objectContaining({ code: "MUSIC_FIXTURE_SECRET_CLEANUP_FAILED" }));
    expect((fixtureSecrets as unknown as { readFixtureMusicEnvironment: (root: string) => string }).readFixtureMusicEnvironment(root)).toBe(current);
    expect(readFileSync(priorGeneration, "utf8")).toBe(attacker);
    expect(readFileSync(displaced, "utf8")).toBe(prior);
  });
});

describe("fixture bundle rotation transaction", () => {
  type RotationDependencies = fixtureSecrets.FixtureAuthorityRotationDependencies;
  const rotate = fixtureSecrets.rotateFixtureMusicAuthority;
  const recover = fixtureSecrets.recoverFixtureAuthorityRotations;

  function authorityWithSeed(seed: number): RotationDependencies {
    return {
      credentialNameBytes: (index) => Buffer.alloc(16, seed + index),
      credentialSecretBytes: (index) => Buffer.alloc(32, seed + index),
    };
  }

  function environment(root: string, paths: fixtureSecrets.FixtureAuthorityPaths, label: string): string {
    const fixturePath = (path: string) => `./${relative(root, path).replace(/\\/g, "/")}`;
    return `MUSIC_TOKEN_SECRET_FILE_HOST=${fixturePath(paths.tokenPath)}\nMUSIC_DB_MIGRATOR_SECRET_FILE_HOST=${fixturePath(paths.migratorPasswordPath)}\nMUSIC_DB_RUNTIME_SECRET_FILE_HOST=${fixturePath(paths.runtimePasswordPath)}\nROTATION_LABEL=${label}\n`;
  }

  function credentialPaths(root: string, contents: string): string[] {
    const values = Object.fromEntries(contents.trim().split(/\r?\n/).map((line) => line.split("=", 2)));
    return ["MUSIC_TOKEN_SECRET_FILE_HOST", "MUSIC_DB_MIGRATOR_SECRET_FILE_HOST", "MUSIC_DB_RUNTIME_SECRET_FILE_HOST"]
      .map((key) => resolve(root, values[key]!));
  }

  it("preserves the complete prior bundle when replacement credential creation fails", () => {
    const root = fixtureRoot();
    rotate(root, (paths) => environment(root, paths, "prior"), authorityWithSeed(0x21));
    const priorPointer = readFileSync(join(root, ".env.music.test"));
    const priorEnvironment = fixtureSecrets.readFixtureMusicEnvironment(root);
    const priorCredentials = credentialPaths(root, priorEnvironment);
    const priorBytes = priorCredentials.map((path) => readFileSync(path));
    const candidateFirst = join(root, ".artifacts", "music-token-secrets", `current-${Buffer.alloc(16, 0x31).toString("hex")}`);

    expect(() => rotate(root, (paths) => environment(root, paths, "candidate"), {
      ...authorityWithSeed(0x31),
      beforeCandidateCreate: (_kind, index) => {
        if (index === 1) throw new Error("replacement-credential-write-sentinel");
      },
    })).toThrow(/replacement-credential-write-sentinel/);
    expect(readFileSync(join(root, ".env.music.test"))).toEqual(priorPointer);
    expect(fixtureSecrets.readFixtureMusicEnvironment(root)).toBe(priorEnvironment);
    expect(priorCredentials.map((path) => readFileSync(path))).toEqual(priorBytes);
    expect(lstatSync(candidateFirst).size).toBe(0);
  });

  it("retires only the exact prior bundle after a successful pointer commit", () => {
    const root = fixtureRoot();
    rotate(root, (paths) => environment(root, paths, "prior"), authorityWithSeed(0x41));
    const priorEnvironment = fixtureSecrets.readFixtureMusicEnvironment(root);
    const priorCredentials = credentialPaths(root, priorEnvironment);
    const priorReference = readFileSync(join(root, ".env.music.test"), "utf8");
    const priorGeneration = join(root, ".artifacts", "music-environment-generations", priorReference.match(/generation=(generation-[a-f0-9]{32})/)![1]!);

    rotate(root, (paths) => environment(root, paths, "current"), authorityWithSeed(0x51));
    const current = fixtureSecrets.readFixtureMusicEnvironment(root);
    expect(current).toContain("ROTATION_LABEL=current");
    for (const path of [...priorCredentials, priorGeneration]) expect(lstatSync(path).size).toBe(0);
    for (const path of credentialPaths(root, current)) expect(lstatSync(path).size).toBeGreaterThan(0);
    expect(readdirSync(join(root, ".artifacts", "music-rotation-journals"))
      .filter((name) => fixtureRotationJournalForTest(name))
      .every((name) => lstatSync(join(root, ".artifacts", "music-rotation-journals", name)).size === 0)).toBe(true);
    expect(() => recover(root)).not.toThrow();
  });

  it("rolls back only candidate leaves when environment publication fails before commit", () => {
    const root = fixtureRoot();
    rotate(root, (paths) => environment(root, paths, "prior"), authorityWithSeed(0x61));
    const priorPointer = readFileSync(join(root, ".env.music.test"));
    const priorEnvironment = fixtureSecrets.readFixtureMusicEnvironment(root);
    const priorCredentials = credentialPaths(root, priorEnvironment);
    const priorBytes = priorCredentials.map((path) => readFileSync(path));

    expect(() => rotate(root, (paths) => environment(root, paths, "candidate"), {
      ...authorityWithSeed(0x71),
      persistence: {
        randomNameBytes: () => Buffer.alloc(16, 0x74),
        beforePublish: () => { throw new Error("precommit-publish-sentinel"); },
      },
    })).toThrow(/precommit-publish-sentinel|fixture environment/i);
    expect(readFileSync(join(root, ".env.music.test"))).toEqual(priorPointer);
    expect(fixtureSecrets.readFixtureMusicEnvironment(root)).toBe(priorEnvironment);
    expect(priorCredentials.map((path) => readFileSync(path))).toEqual(priorBytes);
    for (const byte of [0x71, 0x72, 0x73]) {
      expect(lstatSync(join(root, ".artifacts", "music-token-secrets", `current-${Buffer.alloc(16, byte).toString("hex")}`)).size).toBe(0);
    }
    expect(lstatSync(join(root, ".artifacts", "music-environment-generations", `generation-${Buffer.alloc(16, 0x74).toString("hex")}`)).size).toBe(0);
  });

  it("uses the retained zero-generation pointer as precommit authority after down", () => {
    const root = fixtureRoot();
    rotate(root, (paths) => environment(root, paths, "prior"), authorityWithSeed(0x25));
    cleanupAllFixtureMusicTokenSecrets(root);
    const retainedPointer = readFileSync(join(root, ".env.music.test"));

    expect(() => rotate(root, (paths) => environment(root, paths, "candidate"), {
      ...authorityWithSeed(0x35),
      persistence: {
        randomNameBytes: () => Buffer.alloc(16, 0x38),
        beforePublish: () => { throw new Error("post-down-precommit-sentinel"); },
      },
    })).toThrow();
    expect(readFileSync(join(root, ".env.music.test"))).toEqual(retainedPointer);
    for (const byte of [0x35, 0x36, 0x37]) {
      expect(lstatSync(join(root, ".artifacts", "music-token-secrets", `current-${Buffer.alloc(16, byte).toString("hex")}`)).size).toBe(0);
    }
    expect(lstatSync(join(root, ".artifacts", "music-environment-generations", `generation-${Buffer.alloc(16, 0x38).toString("hex")}`)).size).toBe(0);
    expect(() => recover(root)).not.toThrow();
  });

  it("does not switch authority when durable rotation-journal publication fails", () => {
    const root = fixtureRoot();
    rotate(root, (paths) => environment(root, paths, "prior"), authorityWithSeed(0x26));
    const priorPointer = readFileSync(join(root, ".env.music.test"));
    const prior = fixtureSecrets.readFixtureMusicEnvironment(root);
    const priorCredentialBytes = credentialPaths(root, prior).map((path) => readFileSync(path));

    expect(() => rotate(root, (paths) => environment(root, paths, "candidate"), {
      ...authorityWithSeed(0x36),
      persistence: { randomNameBytes: () => Buffer.alloc(16, 0x39) },
      syncJournalDirectory: () => { throw new Error("journal-directory-sync-sentinel"); },
    } as RotationDependencies & { syncJournalDirectory: (path: string) => void })).toThrow(/journal|fixture environment/i);
    expect(readFileSync(join(root, ".env.music.test"))).toEqual(priorPointer);
    expect(fixtureSecrets.readFixtureMusicEnvironment(root)).toBe(prior);
    expect(credentialPaths(root, prior).map((path) => readFileSync(path))).toEqual(priorCredentialBytes);
    expect(() => recover(root)).not.toThrow();
  });

  it.each(["generation-write", "generation-fsync", "generation-close", "pointer-rename"] as const)(
    "preserves prior authority at the %s precommit failure phase",
    (phase) => {
      const root = fixtureRoot();
      rotate(root, (paths) => environment(root, paths, "prior"), authorityWithSeed(0xa1));
      const priorPointer = readFileSync(join(root, ".env.music.test"));
      const priorEnvironment = fixtureSecrets.readFixtureMusicEnvironment(root);
      const priorCredentials = credentialPaths(root, priorEnvironment);
      const priorBytes = priorCredentials.map((path) => readFileSync(path));
      const persistence: fixtureSecrets.FixtureEnvironmentPersistenceDependencies = {
        randomNameBytes: () => Buffer.alloc(16, 0xb4),
      };
      if (phase === "generation-write") persistence.write = (() => 3) as typeof writeSync;
      if (phase === "generation-fsync") persistence.sync = () => { throw new Error("candidate-fsync-sentinel"); };
      if (phase === "generation-close") persistence.close = () => { throw new Error("candidate-close-sentinel"); };
      if (phase === "pointer-rename") persistence.rename = () => { throw new Error("pointer-rename-sentinel"); };

      expect(() => rotate(root, (paths) => environment(root, paths, "candidate"), {
        ...authorityWithSeed(0xb1),
        persistence,
      })).toThrow();
      expect(readFileSync(join(root, ".env.music.test"))).toEqual(priorPointer);
      expect(fixtureSecrets.readFixtureMusicEnvironment(root)).toBe(priorEnvironment);
      expect(priorCredentials.map((path) => readFileSync(path))).toEqual(priorBytes);
      for (const byte of [0xb1, 0xb2, 0xb3]) {
        expect(lstatSync(join(root, ".artifacts", "music-token-secrets", `current-${Buffer.alloc(16, byte).toString("hex")}`)).size).toBe(0);
      }
      expect(lstatSync(join(root, ".artifacts", "music-environment-generations", `generation-${Buffer.alloc(16, 0xb4).toString("hex")}`)).size).toBe(0);
    },
  );

  it.each(["callback", "generation-close"] as const)(
    "keeps current authority complete after the %s postcommit failure phase",
    (phase) => {
      const root = fixtureRoot();
      rotate(root, (paths) => environment(root, paths, "prior"), authorityWithSeed(0xc1));
      const prior = fixtureSecrets.readFixtureMusicEnvironment(root);
      const priorCredentials = credentialPaths(root, prior);
      let closeCalls = 0;
      const persistence: fixtureSecrets.FixtureEnvironmentPersistenceDependencies = {
        randomNameBytes: () => Buffer.alloc(16, 0xd4),
        afterReferenceCommit: phase === "callback" ? () => { throw new Error("postcommit-callback-sentinel"); } : undefined,
        close: phase === "generation-close" ? (descriptor) => {
          closeCalls += 1;
          if (closeCalls === 3) throw new Error("postcommit-close-sentinel");
          closeSync(descriptor);
        } : undefined,
      };

      expect(() => rotate(root, (paths) => environment(root, paths, "current"), {
        ...authorityWithSeed(0xd1),
        persistence,
      })).toThrow(expect.objectContaining({ code: "MUSIC_FIXTURE_SECRET_CLEANUP_FAILED" }));
      const current = fixtureSecrets.readFixtureMusicEnvironment(root);
      expect(current).toContain("ROTATION_LABEL=current");
      for (const path of credentialPaths(root, current)) expect(lstatSync(path).size).toBeGreaterThan(0);
      for (const path of priorCredentials) expect(lstatSync(path).size).toBe(0);
      const reference = readFileSync(join(root, ".env.music.test"), "utf8");
      const generation = join(root, ".artifacts", "music-environment-generations", reference.match(/generation=(generation-[a-f0-9]{32})/)![1]!);
      expect(lstatSync(generation).size).toBeGreaterThan(0);
      expect(() => recover(root)).not.toThrow();
    },
  );

  it("keeps new authority live and retries exact old-credential cleanup after a swap", () => {
    const root = fixtureRoot();
    rotate(root, (paths) => environment(root, paths, "prior"), authorityWithSeed(0x81));
    const priorEnvironment = fixtureSecrets.readFixtureMusicEnvironment(root);
    const priorCredentials = credentialPaths(root, priorEnvironment);
    const swapped = priorCredentials[0]!;
    const displaced = join(root, "displaced-prior-credential");
    const attackerPreserved = join(root, "attacker-preserved-after-repair");
    const attacker = Buffer.alloc(readFileSync(swapped).length, 0x5a);

    expect(() => rotate(root, (paths) => environment(root, paths, "current"), {
      ...authorityWithSeed(0x91),
      persistence: { afterReferenceCommit: () => {
        renameSync(swapped, displaced);
        writeFileSync(swapped, attacker, { mode: 0o600 });
      } },
    })).toThrow(expect.objectContaining({ code: "MUSIC_FIXTURE_SECRET_CLEANUP_FAILED" }));
    const current = fixtureSecrets.readFixtureMusicEnvironment(root);
    expect(current).toContain("ROTATION_LABEL=current");
    for (const path of credentialPaths(root, current)) expect(lstatSync(path).size).toBeGreaterThan(0);
    expect(readFileSync(swapped)).toEqual(attacker);
    expect(lstatSync(displaced).size).toBeGreaterThan(0);
    expect(readdirSync(join(root, ".artifacts", "music-rotation-journals")).some((name) => {
      return fixtureRotationJournalForTest(name) && lstatSync(join(root, ".artifacts", "music-rotation-journals", name)).size > 0;
    })).toBe(true);
    expect(() => cleanupAllFixtureMusicTokenSecrets(root)).toThrow(expect.objectContaining({
      code: "MUSIC_FIXTURE_SECRET_CLEANUP_FAILED",
    }));
    expect(readFileSync(swapped)).toEqual(attacker);
    expect(fixtureSecrets.readFixtureMusicEnvironment(root)).toBe(current);

    renameSync(swapped, attackerPreserved);
    renameSync(displaced, swapped);
    recover(root);
    expect(readFileSync(attackerPreserved)).toEqual(attacker);
    expect(lstatSync(swapped).size).toBe(0);
    expect(fixtureSecrets.readFixtureMusicEnvironment(root)).toBe(current);
    expect(readdirSync(join(root, ".artifacts", "music-rotation-journals"))
      .filter((name) => fixtureRotationJournalForTest(name))
      .every((name) => lstatSync(join(root, ".artifacts", "music-rotation-journals", name)).size === 0)).toBe(true);
  });

  it("rejects a replaced candidate credential before commit without retiring prior authority", () => {
    const root = fixtureRoot();
    rotate(root, (paths) => environment(root, paths, "prior"), authorityWithSeed(0x11));
    const priorPointer = readFileSync(join(root, ".env.music.test"));
    const priorEnvironment = fixtureSecrets.readFixtureMusicEnvironment(root);
    const priorCredentials = credentialPaths(root, priorEnvironment);
    const priorBytes = priorCredentials.map((path) => readFileSync(path));
    let candidateCredentials: string[] = [];
    const displaced = join(root, "displaced-candidate-before-commit");
    const attacker = Buffer.alloc(43, 0x5e);

    expect(() => rotate(root, (paths) => {
      const contents = environment(root, paths, "candidate");
      candidateCredentials = credentialPaths(root, contents);
      return contents;
    }, {
      ...authorityWithSeed(0x21),
      persistence: {
        randomNameBytes: () => Buffer.alloc(16, 0x24),
        beforeReferenceCommit: () => {
          renameSync(candidateCredentials[0]!, displaced);
          writeFileSync(candidateCredentials[0]!, attacker, { mode: 0o600 });
        },
      },
    })).toThrow(expect.objectContaining({ code: "MUSIC_FIXTURE_SECRET_CLEANUP_FAILED" }));

    expect(readFileSync(join(root, ".env.music.test"))).toEqual(priorPointer);
    expect(fixtureSecrets.readFixtureMusicEnvironment(root)).toBe(priorEnvironment);
    expect(priorCredentials.map((path) => readFileSync(path))).toEqual(priorBytes);
    expect(readFileSync(candidateCredentials[0]!)).toEqual(attacker);
    expect(lstatSync(displaced).size).toBeGreaterThan(0);
  });

  it("publishes a durable intent journal before creating the first candidate secret", () => {
    const root = fixtureRoot();
    rotate(root, (paths) => environment(root, paths, "prior"), authorityWithSeed(0x31));
    let journalPresentBeforeFirstSecret = false;
    let observedJournals: string[] = [];

    expect(() => rotate(root, (paths) => environment(root, paths, "candidate"), {
      ...authorityWithSeed(0x41),
      beforeCandidateCreate: (_kind, index) => {
        if (index === 0) {
          try {
            observedJournals = readdirSync(join(root, ".artifacts", "music-rotation-journals"));
            journalPresentBeforeFirstSecret = observedJournals
              .some((name) => fixtureRotationJournalForTest(name)
                && lstatSync(join(root, ".artifacts", "music-rotation-journals", name)).size > 0);
          } catch {
            journalPresentBeforeFirstSecret = false;
          }
          throw new Error("hard-exit-before-first-candidate-journal-update");
        }
      },
    })).toThrow(/hard-exit-before-first-candidate-journal-update/);

    expect(journalPresentBeforeFirstSecret, observedJournals.join(",")).toBe(true);
  });

  it("restores prior authority when committed recovery finds a replaced candidate credential", () => {
    const root = fixtureRoot();
    rotate(root, (paths) => environment(root, paths, "prior"), authorityWithSeed(0x51));
    const priorPointer = readFileSync(join(root, ".env.music.test"));
    const priorEnvironment = fixtureSecrets.readFixtureMusicEnvironment(root);
    const priorCredentials = credentialPaths(root, priorEnvironment);
    const priorBytes = priorCredentials.map((path) => readFileSync(path));
    let candidateCredentials: string[] = [];
    const displaced = join(root, "displaced-candidate-after-commit");
    const attacker = Buffer.alloc(43, 0x6e);

    expect(() => rotate(root, (paths) => {
      const contents = environment(root, paths, "candidate");
      candidateCredentials = credentialPaths(root, contents);
      return contents;
    }, {
      ...authorityWithSeed(0x61),
      persistence: {
        randomNameBytes: () => Buffer.alloc(16, 0x64),
        afterReferenceCommit: () => {
          renameSync(candidateCredentials[0]!, displaced);
          writeFileSync(candidateCredentials[0]!, attacker, { mode: 0o600 });
          throw new Error("postcommit-candidate-replacement-sentinel");
        },
      },
    })).toThrow(expect.objectContaining({ code: "MUSIC_FIXTURE_SECRET_CLEANUP_FAILED" }));

    expect(readFileSync(join(root, ".env.music.test"))).toEqual(priorPointer);
    expect(fixtureSecrets.readFixtureMusicEnvironment(root)).toBe(priorEnvironment);
    expect(priorCredentials.map((path) => readFileSync(path))).toEqual(priorBytes);
    expect(readFileSync(candidateCredentials[0]!)).toEqual(attacker);
    expect(lstatSync(displaced).size).toBeGreaterThan(0);
  });

  it.each([0, 1, 2])("rejects a same-inode rewrite of candidate credential %s before commit", (candidateIndex) => {
    const root = fixtureRoot();
    rotate(root, (paths) => environment(root, paths, "prior"), authorityWithSeed(0x71));
    const priorPointer = readFileSync(join(root, ".env.music.test"));
    const priorEnvironment = fixtureSecrets.readFixtureMusicEnvironment(root);
    const priorCredentials = credentialPaths(root, priorEnvironment);
    const priorBytes = priorCredentials.map((path) => readFileSync(path));
    let candidates: string[] = [];

    expect(() => rotate(root, (paths) => {
      const contents = environment(root, paths, "candidate");
      candidates = credentialPaths(root, contents);
      return contents;
    }, {
      ...authorityWithSeed(0x81),
      persistence: { beforeReferenceCommit: () => {
        const length = lstatSync(candidates[candidateIndex]!).size;
        writeFileSync(candidates[candidateIndex]!, Buffer.alloc(length, 0x7e));
      } },
    })).toThrow(expect.objectContaining({ code: "MUSIC_FIXTURE_SECRET_CLEANUP_FAILED" }));

    expect(readFileSync(join(root, ".env.music.test"))).toEqual(priorPointer);
    expect(priorCredentials.map((path) => readFileSync(path))).toEqual(priorBytes);
    expect(lstatSync(candidates[candidateIndex]!).size).toBeGreaterThan(0);
  });

  it.each([0, 1, 2])("restores prior authority after a same-inode rewrite of candidate credential %s postcommit", (candidateIndex) => {
    const root = fixtureRoot();
    rotate(root, (paths) => environment(root, paths, "prior"), authorityWithSeed(0x29));
    const priorPointer = readFileSync(join(root, ".env.music.test"));
    const priorEnvironment = fixtureSecrets.readFixtureMusicEnvironment(root);
    const priorCredentials = credentialPaths(root, priorEnvironment);
    const priorBytes = priorCredentials.map((path) => readFileSync(path));
    let candidates: string[] = [];

    expect(() => rotate(root, (paths) => {
      const contents = environment(root, paths, "candidate");
      candidates = credentialPaths(root, contents);
      return contents;
    }, {
      ...authorityWithSeed(0x39),
      persistence: { afterReferenceCommit: () => {
        const length = lstatSync(candidates[candidateIndex]!).size;
        writeFileSync(candidates[candidateIndex]!, Buffer.alloc(length, 0x6d));
      } },
    })).toThrow(expect.objectContaining({ code: "MUSIC_FIXTURE_SECRET_CLEANUP_FAILED" }));

    expect(readFileSync(join(root, ".env.music.test"))).toEqual(priorPointer);
    expect(fixtureSecrets.readFixtureMusicEnvironment(root)).toBe(priorEnvironment);
    expect(priorCredentials.map((path) => readFileSync(path))).toEqual(priorBytes);
    expect(lstatSync(candidates[candidateIndex]!).size).toBeGreaterThan(0);
  });

  it("erases a failed initial intent publication without leaving an unrecoverable journal", () => {
    const root = fixtureRoot();
    let writes = 0;
    expect(() => rotate(root, (paths) => environment(root, paths, "candidate"), {
      ...authorityWithSeed(0x49),
      journal: { write: ((descriptor: number, buffer: NodeJS.ArrayBufferView, offset?: number | null, length?: number | null, position?: number | null) => {
        writes += 1;
        if (writes === 1) {
          writeSync(descriptor, Buffer.from("{"), 0, 1, 0);
          return 1;
        }
        return writeSync(descriptor, buffer, offset, length, position);
      }) as typeof writeSync },
    })).toThrow();
    expect(() => recover(root)).not.toThrow();
    const journalDirectory = join(root, ".artifacts", "music-rotation-journals");
    expect(readdirSync(journalDirectory).every((name) => lstatSync(join(journalDirectory, name)).size === 0)).toBe(true);
    expect(readdirSync(join(root, ".artifacts", "music-token-secrets"))).toHaveLength(0);
  });

  it("rejects a replayed or root-tampered intent journal before candidate cleanup", () => {
    const root = fixtureRoot();
    rotate(root, (paths) => environment(root, paths, "prior"), authorityWithSeed(0x59));
    const priorPointer = readFileSync(join(root, ".env.music.test"));
    const prior = fixtureSecrets.readFixtureMusicEnvironment(root);
    const priorBytes = credentialPaths(root, prior).map((path) => readFileSync(path));
    let tamperedJournal = "";

    expect(() => rotate(root, (paths) => environment(root, paths, "candidate"), {
      ...authorityWithSeed(0x69),
      afterCandidateCreatedBeforeJournalUpdate: (_kind, index) => {
        if (index !== 0) return;
        const directory = join(root, ".artifacts", "music-rotation-journals");
        const name = readdirSync(directory).find((candidate) => fixtureRotationJournalForTest(candidate)
          && lstatSync(join(directory, candidate)).size > 0)!;
        tamperedJournal = join(directory, name);
        const parsed = JSON.parse(readFileSync(tamperedJournal, "utf8")) as Record<string, unknown>;
        parsed.rootIno = "999999999";
        writeFileSync(tamperedJournal, JSON.stringify(parsed));
        throw new Error("tampered-intent-sentinel");
      },
    })).toThrow(expect.objectContaining({ code: "MUSIC_FIXTURE_SECRET_CLEANUP_FAILED" }));

    expect(readFileSync(join(root, ".env.music.test"))).toEqual(priorPointer);
    expect(credentialPaths(root, prior).map((path) => readFileSync(path))).toEqual(priorBytes);
    expect(lstatSync(tamperedJournal).size).toBeGreaterThan(0);
  });

  it.each([0, 1, 2, 3])("recovers a hard exit after candidate %s creation but before journal update", (candidateIndex) => {
    const root = fixtureRoot();
    rotate(root, (paths) => environment(root, paths, "prior"), authorityWithSeed(0x91));
    const priorPointer = readFileSync(join(root, ".env.music.test"));
    const priorEnvironment = fixtureSecrets.readFixtureMusicEnvironment(root);
    const priorCredentials = credentialPaths(root, priorEnvironment);
    const priorBytes = priorCredentials.map((path) => readFileSync(path));
    const moduleUrl = pathToFileURL(resolve("scripts/music-fixture-secret.ts")).href;
    const seed = 0xa1 + candidateIndex * 4;
    const script = `
      import { rotateFixtureMusicAuthority } from ${JSON.stringify(moduleUrl)};
      const root = process.env.MUSIC_CRASH_ROOT;
      const candidateIndex = Number(process.env.MUSIC_CRASH_INDEX);
      const seed = Number(process.env.MUSIC_CRASH_SEED);
      const rel = (value) => './' + value.slice(root.length + 1).replaceAll('\\\\', '/');
      rotateFixtureMusicAuthority(root, (paths) =>
        'MUSIC_TOKEN_SECRET_FILE_HOST=' + rel(paths.tokenPath) + '\\n'
        + 'MUSIC_DB_MIGRATOR_SECRET_FILE_HOST=' + rel(paths.migratorPasswordPath) + '\\n'
        + 'MUSIC_DB_RUNTIME_SECRET_FILE_HOST=' + rel(paths.runtimePasswordPath) + '\\nROTATION_LABEL=crash\\n', {
          credentialNameBytes: (index) => Buffer.alloc(16, seed + index),
          credentialSecretBytes: (index) => Buffer.alloc(32, seed + index),
          persistence: { randomNameBytes: () => Buffer.alloc(16, seed + 3) },
          afterCandidateCreatedBeforeJournalUpdate: (_kind, index) => {
            if (index === candidateIndex) process.exit(86);
          },
        });
    `;
    const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MUSIC_CRASH_ROOT: root,
        MUSIC_CRASH_INDEX: String(candidateIndex),
        MUSIC_CRASH_SEED: String(seed),
      },
      encoding: "utf8",
      timeout: 15_000,
    });
    expect(child.status, child.stderr).toBe(86);
    expect(readdirSync(join(root, ".artifacts", "music-rotation-journals")).some((name) => {
      return fixtureRotationJournalForTest(name) && lstatSync(join(root, ".artifacts", "music-rotation-journals", name)).size > 0;
    })).toBe(true);
    const journalText = readdirSync(join(root, ".artifacts", "music-rotation-journals"))
      .filter((name) => fixtureRotationJournalForTest(name) && lstatSync(join(root, ".artifacts", "music-rotation-journals", name)).size > 0)
      .map((name) => readFileSync(join(root, ".artifacts", "music-rotation-journals", name), "utf8"))
      .join("\n");
    for (let index = 0; index < 3; index += 1) {
      expect(journalText).not.toContain(Buffer.alloc(32, seed + index).toString("base64url"));
    }
    expect(journalText).not.toContain("ROTATION_LABEL=crash");
    expect(child.stderr).not.toContain(Buffer.alloc(32, seed).toString("base64url"));

    recover(root);
    expect(readFileSync(join(root, ".env.music.test"))).toEqual(priorPointer);
    expect(fixtureSecrets.readFixtureMusicEnvironment(root)).toBe(priorEnvironment);
    expect(priorCredentials.map((path) => readFileSync(path))).toEqual(priorBytes);
    expect(readdirSync(join(root, ".artifacts", "music-rotation-journals"))
      .filter((name) => fixtureRotationJournalForTest(name))
      .every((name) => lstatSync(join(root, ".artifacts", "music-rotation-journals", name)).size === 0)).toBe(true);
  });

  it.each(["journal-write", "journal-rename", "journal-directory-sync", "candidate-directory-sync"] as const)(
    "keeps prior authority and recovers the %s failure",
    (phase) => {
      const root = fixtureRoot();
      rotate(root, (paths) => environment(root, paths, "prior"), authorityWithSeed(0xc1));
      const priorPointer = readFileSync(join(root, ".env.music.test"));
      const prior = fixtureSecrets.readFixtureMusicEnvironment(root);
      const priorCredentialBytes = credentialPaths(root, prior).map((path) => readFileSync(path));
      let writeCalls = 0;
      let directorySyncCalls = 0;
      let candidateDirectorySyncCalls = 0;

      expect(() => rotate(root, (paths) => environment(root, paths, "candidate"), {
        ...authorityWithSeed(0xd1),
        journal: {
          write: phase === "journal-write" ? ((descriptor: number, buffer: NodeJS.ArrayBufferView, offset?: number | null, length?: number | null, position?: number | null) => {
            writeCalls += 1;
            return writeCalls === 2 ? 1 : writeSync(descriptor, buffer, offset, length, position);
          }) as typeof writeSync : undefined,
          rename: phase === "journal-rename" ? (() => { throw new Error("journal-rename-sentinel"); }) : undefined,
        },
        syncJournalDirectory: (path) => {
          directorySyncCalls += 1;
          if (phase === "journal-directory-sync" && directorySyncCalls === 2) throw new Error("journal-directory-sync-sentinel");
          const descriptor = openSync(path, constants.O_RDONLY);
          closeSync(descriptor);
        },
        syncCandidateDirectory: (path) => {
          candidateDirectorySyncCalls += 1;
          if (phase === "candidate-directory-sync" && candidateDirectorySyncCalls === 1) throw new Error("candidate-directory-sync-sentinel");
          const descriptor = openSync(path, constants.O_RDONLY);
          closeSync(descriptor);
        },
      })).toThrow();

      expect(readFileSync(join(root, ".env.music.test"))).toEqual(priorPointer);
      expect(fixtureSecrets.readFixtureMusicEnvironment(root)).toBe(prior);
      expect(credentialPaths(root, prior).map((path) => readFileSync(path))).toEqual(priorCredentialBytes);
      expect(() => recover(root)).not.toThrow();
      const journalDirectory = join(root, ".artifacts", "music-rotation-journals");
      expect(readdirSync(journalDirectory).every((name) => lstatSync(join(journalDirectory, name)).size === 0)).toBe(true);
    },
  );

  it.each(["pointer-renamed", "journal-committed"] as const)(
    "recovers a hard exit at the %s boundary to one complete new bundle",
    (phase) => {
      const root = fixtureRoot();
      rotate(root, (paths) => environment(root, paths, "prior"), authorityWithSeed(0x15));
      const prior = fixtureSecrets.readFixtureMusicEnvironment(root);
      const priorCredentials = credentialPaths(root, prior);
      const moduleUrl = pathToFileURL(resolve("scripts/music-fixture-secret.ts")).href;
      const script = `
        import { rotateFixtureMusicAuthority } from ${JSON.stringify(moduleUrl)};
        const root = process.env.MUSIC_CRASH_ROOT;
        const phase = process.env.MUSIC_CRASH_PHASE;
        const rel = (value) => './' + value.slice(root.length + 1).replaceAll('\\\\', '/');
        rotateFixtureMusicAuthority(root, (paths) =>
          'MUSIC_TOKEN_SECRET_FILE_HOST=' + rel(paths.tokenPath) + '\\n'
          + 'MUSIC_DB_MIGRATOR_SECRET_FILE_HOST=' + rel(paths.migratorPasswordPath) + '\\n'
          + 'MUSIC_DB_RUNTIME_SECRET_FILE_HOST=' + rel(paths.runtimePasswordPath) + '\\nROTATION_LABEL=recovered-new\\n', {
            credentialNameBytes: (index) => Buffer.alloc(16, 0x25 + index),
            credentialSecretBytes: (index) => Buffer.alloc(32, 0x25 + index),
            persistence: {
              randomNameBytes: () => Buffer.alloc(16, 0x28),
              afterReferenceRename: () => { if (phase === 'pointer-renamed') process.exit(87); },
            },
            afterJournalCommit: () => { if (phase === 'journal-committed') process.exit(88); },
          });
      `;
      const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", script], {
        cwd: process.cwd(),
        env: { ...process.env, MUSIC_CRASH_ROOT: root, MUSIC_CRASH_PHASE: phase },
        encoding: "utf8",
        timeout: 15_000,
      });
      expect(child.status, child.stderr).toBe(phase === "pointer-renamed" ? 87 : 88);

      recover(root);
      const current = fixtureSecrets.readFixtureMusicEnvironment(root);
      expect(current).toContain("ROTATION_LABEL=recovered-new");
      for (const path of credentialPaths(root, current)) expect(lstatSync(path).size).toBeGreaterThan(0);
      for (const path of priorCredentials) expect(lstatSync(path).size).toBe(0);
      expect(readdirSync(join(root, ".artifacts", "music-rotation-journals"))
        .filter((name) => fixtureRotationJournalForTest(name))
        .every((name) => lstatSync(join(root, ".artifacts", "music-rotation-journals", name)).size === 0)).toBe(true);
    },
  );

  function fixtureRotationJournalForTest(name: string): boolean {
    return /^rotation-[a-f0-9]{32}\.json$/.test(name);
  }
});
