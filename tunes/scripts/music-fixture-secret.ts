import { randomBytes as secureRandomBytes } from "node:crypto";
import {
  closeSync,
  constants,
  existsSync,
  fchmodSync,
  fstatSync,
  ftruncateSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  readdirSync,
  renameSync,
  writeSync,
  type BigIntStats,
} from "node:fs";
import { basename, dirname, join, parse, relative, resolve } from "node:path";

export const FIXTURE_MUSIC_TOKEN_SECRET_DIRECTORY_RELATIVE_PATH = join(".artifacts", "music-token-secrets");
const fixtureTokenName = /^current-[a-f0-9]{32}$/;
const fixtureEnvironmentTemporaryName = /^\.env\.music\.test\.[a-f0-9]{32}\.tmp$/;

export class FixtureSecretCleanupError extends Error {
  readonly code = "MUSIC_FIXTURE_SECRET_CLEANUP_FAILED";
  constructor(readonly targetId: string) {
    super(`Fixture secret cleanup failed for target ${targetId}`);
    this.name = "FixtureSecretCleanupError";
  }
}

export class FixtureEnvironmentPersistenceError extends Error {
  readonly code = "MUSIC_FIXTURE_ENVIRONMENT_PUBLISH_FAILED";
  constructor(readonly targetId: string) {
    super(`Fixture environment publish failed for target ${targetId}`);
    this.name = "FixtureEnvironmentPersistenceError";
  }
}

export interface FixtureMusicTokenSecretDependencies {
  randomNameBytes?: (size: number) => Buffer;
  open?: (path: string, flags: number, mode: number) => number;
  write?: typeof writeSync;
  sync?: typeof fsyncSync;
  truncate?: typeof ftruncateSync;
  close?: typeof closeSync;
  beforeErase?: () => void;
}

export interface FixtureEnvironmentPersistenceDependencies extends FixtureMusicTokenSecretDependencies {
  rename?: typeof renameSync;
  beforePublish?: () => void;
  syncDirectory?: (path: string) => void;
}

export function prepareFixtureMusicTokenSecret(
  repositoryRoot: string,
  randomBytes: (size: number) => Buffer = secureRandomBytes,
  dependencies: FixtureMusicTokenSecretDependencies = {},
): string {
  const { root, artifactDirectory, tokenDirectory } = fixtureDirectories(repositoryRoot);
  assertNoLinkedAncestors(root);
  assertOwnedDirectory(root);
  ensureOwnedDirectory(artifactDirectory);
  ensureOwnedDirectory(tokenDirectory);
  assertNoLinkedAncestors(tokenDirectory);

  const nameBytes = (dependencies.randomNameBytes ?? secureRandomBytes)(16);
  if (!Buffer.isBuffer(nameBytes) || nameBytes.length !== 16) throw fixtureSecretError();
  const tokenPath = join(tokenDirectory, `current-${nameBytes.toString("hex")}`);
  assertExactTokenPath(root, tokenPath);
  const secret = randomBytes(32);
  if (!Buffer.isBuffer(secret) || secret.length < 32) throw fixtureSecretError();
  const encoded = Buffer.from(secret).toString("base64url");
  const directoryBefore = lstatSync(tokenDirectory, { bigint: true });
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow;
  const openFile = dependencies.open ?? openSync;
  const writeFile = dependencies.write ?? writeSync;
  const syncFile = dependencies.sync ?? fsyncSync;
  let descriptor: number | undefined;
  let opened: BigIntStats | undefined;
  try {
    descriptor = openFile(tokenPath, flags, 0o600);
    opened = fstatSync(descriptor, { bigint: true });
    assertOwnedRegularFile(opened);
    if (!sameIdentity(directoryBefore, lstatSync(tokenDirectory, { bigint: true }))) throw fixtureSecretError();
    assertNoLinkedAncestors(tokenPath);
    fchmodSync(descriptor, 0o600);
    const bytes = Buffer.from(encoded, "ascii");
    if (writeFile(descriptor, bytes, 0, bytes.length, 0) !== bytes.length) throw fixtureSecretError();
    syncFile(descriptor);
    const afterWrite = fstatSync(descriptor, { bigint: true });
    assertOwnedRegularFile(afterWrite);
    if (!sameIdentity(opened, afterWrite) || afterWrite.size !== BigInt(bytes.length)) throw fixtureSecretError();
    closeDescriptor(descriptor, dependencies, basename(tokenPath));
    descriptor = undefined;
  } catch {
    if (descriptor !== undefined) eraseAndCloseDescriptor(descriptor, dependencies, basename(tokenPath));
    throw fixtureSecretError();
  }
  const final = lstatSync(tokenPath, { bigint: true });
  assertOwnedRegularFile(final);
  if (!opened || !sameIdentity(opened, final)
      || !sameIdentity(directoryBefore, lstatSync(tokenDirectory, { bigint: true }))) throw fixtureSecretError();
  if (process.platform !== "win32" && (final.mode & BigInt(0o077)) !== BigInt(0)) throw fixtureSecretError();
  return tokenPath;
}

export function cleanupFixtureMusicTokenSecret(
  repositoryRoot: string,
  exactTokenPath: string,
  dependencies: FixtureMusicTokenSecretDependencies = {},
): void {
  const { root, artifactDirectory, tokenDirectory } = fixtureDirectories(repositoryRoot);
  assertExactTokenPath(root, exactTokenPath);
  assertNoLinkedAncestors(root);
  assertOwnedDirectory(root);
  if (!existsSync(artifactDirectory) || !existsSync(tokenDirectory) || !existsSync(exactTokenPath)) return;
  assertOwnedDirectory(artifactDirectory);
  assertOwnedDirectory(tokenDirectory);
  assertNoLinkedAncestors(exactTokenPath);
  if (!sameResolvedPath(realpathSync(exactTokenPath), exactTokenPath)) throw fixtureSecretError();
  const directoryBefore = lstatSync(tokenDirectory, { bigint: true });
  const before = lstatSync(exactTokenPath, { bigint: true });
  assertOwnedRegularFile(before);
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  let descriptor: number;
  try {
    descriptor = (dependencies.open ?? openSync)(exactTokenPath, constants.O_RDWR | noFollow, 0o600);
  } catch {
    throw fixtureSecretError();
  }
  let failed = false;
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    assertOwnedRegularFile(opened);
    if (!sameIdentity(before, opened)
        || !sameIdentity(directoryBefore, lstatSync(tokenDirectory, { bigint: true }))) throw fixtureSecretError();
    dependencies.beforeErase?.();
    eraseDescriptor(descriptor, dependencies);
  } catch {
    failed = true;
  }
  try {
    (dependencies.close ?? closeSync)(descriptor);
  } catch {
    failed = true;
  }
  if (failed) throw new FixtureSecretCleanupError(basename(exactTokenPath));
}

export function cleanupAllFixtureMusicTokenSecrets(repositoryRoot: string): void {
  const { root, tokenDirectory } = fixtureDirectories(repositoryRoot);
  let failure: FixtureSecretCleanupError | undefined;
  if (existsSync(tokenDirectory)) {
    assertNoLinkedAncestors(tokenDirectory);
    assertOwnedDirectory(tokenDirectory);
    for (const name of readdirSync(tokenDirectory)) {
      if (!fixtureTokenName.test(name)) continue;
      try {
        cleanupFixtureMusicTokenSecret(repositoryRoot, join(tokenDirectory, name));
      } catch (error) {
        failure ??= error instanceof FixtureSecretCleanupError
          ? error
          : new FixtureSecretCleanupError(name);
      }
    }
  }
  assertNoLinkedAncestors(root);
  assertOwnedDirectory(root);
  for (const name of readdirSync(root)) {
    if (!fixtureEnvironmentTemporaryName.test(name)) continue;
    try {
      cleanupFixtureEnvironmentTemporary(repositoryRoot, join(root, name));
    } catch (error) {
      failure ??= error instanceof FixtureSecretCleanupError
        ? error
        : new FixtureSecretCleanupError(name);
    }
  }
  if (failure) throw failure;
}

export function cleanupFixtureEnvironmentTemporary(
  repositoryRoot: string,
  exactTemporaryPath: string,
  dependencies: FixtureMusicTokenSecretDependencies = {},
): void {
  const root = resolve(repositoryRoot);
  const absolute = resolve(exactTemporaryPath);
  const targetId = basename(absolute);
  if (dirname(absolute) !== root || !fixtureEnvironmentTemporaryName.test(targetId)) {
    throw new FixtureSecretCleanupError(fixtureEnvironmentTemporaryName.test(targetId) ? targetId : "unknown");
  }
  assertNoLinkedAncestors(absolute);
  assertOwnedDirectory(root);
  if (!existsSync(absolute)) return;
  if (!sameResolvedPath(realpathSync(absolute), absolute)) throw new FixtureSecretCleanupError(targetId);
  const directoryBefore = lstatSync(root, { bigint: true });
  const before = lstatSync(absolute, { bigint: true });
  assertOwnedRegularFile(before);
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  let descriptor: number;
  try {
    descriptor = (dependencies.open ?? openSync)(absolute, constants.O_RDWR | noFollow, 0o600);
  } catch {
    throw new FixtureSecretCleanupError(targetId);
  }
  let failed = false;
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    assertOwnedRegularFile(opened);
    if (!sameIdentity(before, opened) || !sameIdentity(directoryBefore, lstatSync(root, { bigint: true }))) {
      throw new FixtureSecretCleanupError(targetId);
    }
    dependencies.beforeErase?.();
    eraseDescriptor(descriptor, dependencies);
  } catch {
    failed = true;
  }
  try {
    (dependencies.close ?? closeSync)(descriptor);
  } catch {
    failed = true;
  }
  if (failed) throw new FixtureSecretCleanupError(targetId);
}

export async function withFixtureMusicTokenSecretCleanup<T>(
  repositoryRoot: string,
  exactTokenPath: string,
  action: () => Promise<T>,
  dependencies: FixtureMusicTokenSecretDependencies = {},
): Promise<T> {
  try {
    return await action();
  } finally {
    cleanupFixtureMusicTokenSecret(repositoryRoot, exactTokenPath, dependencies);
  }
}

export function persistFixtureMusicEnvironment(
  repositoryRoot: string,
  contents: string,
  dependencies: FixtureEnvironmentPersistenceDependencies = {},
): string {
  const root = resolve(repositoryRoot);
  const destination = join(root, ".env.music.test");
  assertNoLinkedAncestors(destination);
  assertOwnedDirectory(root);
  const directoryBefore = lstatSync(root, { bigint: true });
  const destinationBefore = existsSync(destination) ? lstatSync(destination, { bigint: true }) : undefined;
  if (destinationBefore) {
    assertOwnedRegularFile(destinationBefore);
    if (!sameResolvedPath(realpathSync(destination), destination)) throw fixtureSecretError();
  }
  const random = (dependencies.randomNameBytes ?? secureRandomBytes)(16);
  if (!Buffer.isBuffer(random) || random.length !== 16) throw fixtureEnvironmentError("unknown");
  const temporaryName = `.env.music.test.${random.toString("hex")}.tmp`;
  if (!fixtureEnvironmentTemporaryName.test(temporaryName)) throw fixtureEnvironmentError("unknown");
  const temporary = join(root, temporaryName);
  const bytes = Buffer.from(contents, "utf8");
  if (!bytes.length || bytes.length > 65_536) throw fixtureEnvironmentError(temporaryName);
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow;
  let descriptor: number | undefined;
  let opened: BigIntStats | undefined;
  try {
    descriptor = (dependencies.open ?? openSync)(temporary, flags, 0o600);
    opened = fstatSync(descriptor, { bigint: true });
    assertOwnedRegularFile(opened);
    if (!sameIdentity(directoryBefore, lstatSync(root, { bigint: true }))) throw fixtureEnvironmentError(temporaryName);
    assertNoLinkedAncestors(temporary);
    fchmodSync(descriptor, 0o600);
    if ((dependencies.write ?? writeSync)(descriptor, bytes, 0, bytes.length, 0) !== bytes.length) {
      throw fixtureEnvironmentError(temporaryName);
    }
    (dependencies.sync ?? fsyncSync)(descriptor);
    const afterWrite = fstatSync(descriptor, { bigint: true });
    assertOwnedRegularFile(afterWrite);
    if (!sameIdentity(opened, afterWrite) || afterWrite.size !== BigInt(bytes.length)) throw fixtureEnvironmentError(temporaryName);
    dependencies.beforePublish?.();
    assertOwnedDirectory(root);
    if (!sameIdentity(directoryBefore, lstatSync(root, { bigint: true }))) throw fixtureEnvironmentError(temporaryName);
    const temporaryBeforeCommit = lstatSync(temporary, { bigint: true });
    assertOwnedRegularFile(temporaryBeforeCommit);
    if (!sameIdentity(opened, temporaryBeforeCommit) || temporaryBeforeCommit.size !== BigInt(bytes.length)) {
      throw fixtureEnvironmentError(temporaryName);
    }
    if (process.platform !== "win32" && (temporaryBeforeCommit.mode & BigInt(0o077)) !== BigInt(0)) {
      throw fixtureEnvironmentError(temporaryName);
    }
    if (destinationBefore) {
      const current = lstatSync(destination, { bigint: true });
      assertOwnedRegularFile(current);
      if (!sameIdentity(destinationBefore, current)) throw fixtureEnvironmentError(temporaryName);
    } else if (existsSync(destination)) {
      throw fixtureEnvironmentError(temporaryName);
    }
    closeDescriptor(descriptor, dependencies, temporaryName);
    descriptor = undefined;

    // The rename below is the only publication commit point. Every fallible
    // descriptor, identity, mode, and directory-durability operation is
    // complete before it; successful rename has no cleanup afterward.
    const closedTemporary = lstatSync(temporary, { bigint: true });
    assertOwnedRegularFile(closedTemporary);
    if (!sameIdentity(opened, closedTemporary) || closedTemporary.size !== BigInt(bytes.length)
        || !sameIdentity(directoryBefore, lstatSync(root, { bigint: true }))) {
      throw fixtureEnvironmentError(temporaryName);
    }
    if (process.platform !== "win32" && (closedTemporary.mode & BigInt(0o077)) !== BigInt(0)) {
      throw fixtureEnvironmentError(temporaryName);
    }
    (dependencies.syncDirectory ?? syncDirectory)(root);
    assertDestinationUnchanged(destination, destinationBefore, temporaryName);
    (dependencies.rename ?? renameSync)(temporary, destination);
    return destination;
  } catch (error) {
    if (descriptor !== undefined) {
      let cleanupFailure: unknown;
      try {
        eraseAndCloseDescriptor(descriptor, dependencies, temporaryName);
      } catch (cleanupError) {
        cleanupFailure = cleanupError;
      }
      descriptor = undefined;
      if (opened) {
        try {
          eraseTemporaryIfExpectedIdentity(root, temporary, directoryBefore, opened, dependencies);
        } catch (pathCleanupError) {
          cleanupFailure ??= pathCleanupError;
        }
      }
      if (cleanupFailure) throw cleanupFailure;
    } else if (opened && observedIdentity(destination, opened) && !existsSync(temporary)) {
      // A rename adapter may report uncertainty after the atomic rename has
      // committed. The destination is now authoritative; never truncate it.
      return destination;
    } else if (opened) {
      eraseTemporaryIfExpectedIdentity(root, temporary, directoryBefore, opened, dependencies);
    }
    if (error instanceof FixtureSecretCleanupError) throw error;
    throw fixtureEnvironmentError(temporaryName);
  }
}

function assertDestinationUnchanged(
  destination: string,
  destinationBefore: BigIntStats | undefined,
  targetId: string,
): void {
  if (destinationBefore) {
    const current = lstatSync(destination, { bigint: true });
    assertOwnedRegularFile(current);
    if (!sameIdentity(destinationBefore, current)) throw fixtureEnvironmentError(targetId);
  } else if (existsSync(destination)) {
    throw fixtureEnvironmentError(targetId);
  }
}

function eraseTemporaryIfExpectedIdentity(
  root: string,
  temporary: string,
  directoryBefore: BigIntStats,
  expected: BigIntStats,
  dependencies: FixtureMusicTokenSecretDependencies,
): void {
  if (!existsSync(temporary)) return;
  const targetId = basename(temporary);
  let before: BigIntStats;
  try {
    assertNoLinkedAncestors(temporary);
    if (!sameIdentity(directoryBefore, lstatSync(root, { bigint: true }))) return;
    before = lstatSync(temporary, { bigint: true });
    assertOwnedRegularFile(before);
    if (!sameIdentity(expected, before)) return;
  } catch {
    throw new FixtureSecretCleanupError(targetId);
  }
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  let cleanupDescriptor: number;
  try {
    cleanupDescriptor = (dependencies.open ?? openSync)(temporary, constants.O_RDWR | noFollow, 0o600);
  } catch {
    throw new FixtureSecretCleanupError(targetId);
  }
  let failed = false;
  try {
    const current = fstatSync(cleanupDescriptor, { bigint: true });
    assertOwnedRegularFile(current);
    if (!sameIdentity(expected, current)
        || !sameIdentity(directoryBefore, lstatSync(root, { bigint: true }))) {
      throw new FixtureSecretCleanupError(targetId);
    }
    eraseDescriptor(cleanupDescriptor, dependencies);
  } catch {
    failed = true;
  }
  try {
    (dependencies.close ?? closeSync)(cleanupDescriptor);
  } catch {
    failed = true;
  }
  if (failed) throw new FixtureSecretCleanupError(targetId);
}

function observedIdentity(path: string, expected: BigIntStats): boolean {
  try {
    const current = lstatSync(path, { bigint: true });
    assertOwnedRegularFile(current);
    return sameIdentity(current, expected);
  } catch {
    return false;
  }
}

export async function withAllFixtureMusicSecretsCleanup<T>(
  repositoryRoot: string,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } finally {
    cleanupAllFixtureMusicTokenSecrets(repositoryRoot);
  }
}

function fixtureDirectories(repositoryRoot: string) {
  const root = resolve(repositoryRoot);
  const artifactDirectory = join(root, ".artifacts");
  const tokenDirectory = join(root, FIXTURE_MUSIC_TOKEN_SECRET_DIRECTORY_RELATIVE_PATH);
  const expectedPrefix = `${root}${process.platform === "win32" ? "\\" : "/"}`;
  if (!tokenDirectory.startsWith(expectedPrefix)) throw fixtureSecretError();
  return { root, artifactDirectory, tokenDirectory };
}

function assertExactTokenPath(root: string, tokenPath: string): void {
  const expectedDirectory = resolve(root, FIXTURE_MUSIC_TOKEN_SECRET_DIRECTORY_RELATIVE_PATH);
  const absolute = resolve(tokenPath);
  if (dirname(absolute) !== expectedDirectory || !fixtureTokenName.test(basename(absolute)) || relative(expectedDirectory, absolute).startsWith("..")) {
    throw fixtureSecretError();
  }
}

function ensureOwnedDirectory(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { mode: 0o700 });
  assertOwnedDirectory(path);
}

function assertOwnedDirectory(path: string): void {
  const stat = lstatSync(path, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink() || !ownedByCurrentUser(stat.uid)) throw fixtureSecretError();
}

function assertNoLinkedAncestors(path: string): void {
  const absolute = resolve(path);
  const filesystemRoot = parse(absolute).root;
  const paths: string[] = [];
  let current = dirname(absolute);
  while (true) {
    paths.push(current);
    if (current === filesystemRoot) break;
    const parent = dirname(current);
    if (parent === current) throw fixtureSecretError();
    current = parent;
  }
  for (const ancestor of paths.reverse()) {
    const stat = lstatSync(ancestor, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw fixtureSecretError();
  }
}

function assertOwnedRegularFile(stat: BigIntStats): void {
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== BigInt(1) || !ownedByCurrentUser(stat.uid)) throw fixtureSecretError();
}

function ownedByCurrentUser(uid: bigint): boolean {
  if (process.platform === "win32") return true;
  const effectiveUserId = process.geteuid?.();
  return effectiveUserId !== undefined && uid === BigInt(effectiveUserId);
}

function sameIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameResolvedPath(left: string, right: string): boolean {
  const normalize = (value: string) => resolve(value).replace(/^\\\\\?\\/, "");
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function eraseDescriptor(descriptor: number, dependencies: FixtureMusicTokenSecretDependencies): void {
  (dependencies.truncate ?? ftruncateSync)(descriptor, 0);
  (dependencies.sync ?? fsyncSync)(descriptor);
}

function eraseAndCloseDescriptor(
  descriptor: number,
  dependencies: FixtureMusicTokenSecretDependencies,
  targetId: string,
): never | void {
  let failed = false;
  try {
    eraseDescriptor(descriptor, dependencies);
  } catch {
    failed = true;
  }
  try {
    (dependencies.close ?? closeSync)(descriptor);
  } catch {
    failed = true;
  }
  if (failed) throw new FixtureSecretCleanupError(targetId);
}

function closeDescriptor(
  descriptor: number,
  dependencies: FixtureMusicTokenSecretDependencies,
  targetId: string,
): void {
  try {
    (dependencies.close ?? closeSync)(descriptor);
  } catch {
    throw new FixtureSecretCleanupError(targetId);
  }
}

function syncDirectory(path: string): void {
  if (process.platform === "win32") return;
  const descriptor = openSync(path, constants.O_RDONLY);
  let failed = false;
  try {
    fsyncSync(descriptor);
  } catch {
    failed = true;
  }
  try {
    closeSync(descriptor);
  } catch {
    failed = true;
  }
  if (failed) throw fixtureEnvironmentError("environment-directory");
}

function fixtureSecretError(): Error {
  return new Error("Fixture signing key must be an exact owned regular artifact file");
}

function fixtureEnvironmentError(targetId: string): FixtureEnvironmentPersistenceError {
  return new FixtureEnvironmentPersistenceError(targetId);
}
