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
  unlinkSync,
  writeSync,
  type BigIntStats,
} from "node:fs";
import { dirname, join, parse, resolve } from "node:path";

export const FIXTURE_MUSIC_TOKEN_SECRET_RELATIVE_PATH = join(".artifacts", "music-token-secrets", "current");

export interface FixtureMusicTokenSecretDependencies {
  open?: (path: string, flags: number, mode: number) => number;
}

export function prepareFixtureMusicTokenSecret(
  repositoryRoot: string,
  randomBytes: (size: number) => Buffer = secureRandomBytes,
  dependencies: FixtureMusicTokenSecretDependencies = {},
): string {
  const { root, artifactDirectory, tokenDirectory, tokenPath } = fixturePaths(repositoryRoot);
  assertNoLinkedAncestors(root);
  assertOwnedDirectory(root);
  ensureOwnedDirectory(artifactDirectory);
  ensureOwnedDirectory(tokenDirectory);
  assertNoLinkedAncestors(tokenPath);

  const existing = existsSync(tokenPath) ? lstatSync(tokenPath, { bigint: true }) : undefined;
  if (existing) assertOwnedRegularFile(existing);
  const secret = randomBytes(32);
  if (!Buffer.isBuffer(secret) || secret.length < 32) throw fixtureSecretError();
  const encoded = Buffer.from(secret).toString("base64url");
  const directoryBefore = lstatSync(tokenDirectory, { bigint: true });
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  const flags = constants.O_WRONLY | noFollow | (existing ? 0 : constants.O_CREAT | constants.O_EXCL);
  const openFile = dependencies.open ?? openSync;
  let descriptor: number | undefined;
  let opened: BigIntStats | undefined;
  try {
    descriptor = openFile(tokenPath, flags, 0o600);
    opened = fstatSync(descriptor, { bigint: true });
    assertOwnedRegularFile(opened);
    if (existing && !sameIdentity(existing, opened)) throw fixtureSecretError();
    if (!sameIdentity(directoryBefore, lstatSync(tokenDirectory, { bigint: true }))) throw fixtureSecretError();
    fchmodSync(descriptor, 0o600);
    ftruncateSync(descriptor, 0);
    const bytes = Buffer.from(encoded, "ascii");
    if (writeSync(descriptor, bytes, 0, bytes.length, 0) !== bytes.length) throw fixtureSecretError();
    fsyncSync(descriptor);
    const afterWrite = fstatSync(descriptor, { bigint: true });
    assertOwnedRegularFile(afterWrite);
    if (!sameIdentity(opened, afterWrite) || afterWrite.size !== BigInt(bytes.length)) throw fixtureSecretError();
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    descriptor = undefined;
    removeExactOpenedFile(tokenPath, opened, tokenDirectory, directoryBefore);
    throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  const final = lstatSync(tokenPath, { bigint: true });
  assertOwnedRegularFile(final);
  if (!opened || !sameIdentity(opened, final)
      || !sameIdentity(directoryBefore, lstatSync(tokenDirectory, { bigint: true }))) throw fixtureSecretError();
  if (process.platform !== "win32" && (final.mode & BigInt(0o077)) !== BigInt(0)) throw fixtureSecretError();
  return tokenPath;
}

export function cleanupFixtureMusicTokenSecret(repositoryRoot: string): void {
  const { root, artifactDirectory, tokenDirectory, tokenPath } = fixturePaths(repositoryRoot);
  assertNoLinkedAncestors(root);
  assertOwnedDirectory(root);
  if (!existsSync(artifactDirectory) || !existsSync(tokenDirectory) || !existsSync(tokenPath)) return;
  assertOwnedDirectory(artifactDirectory);
  assertOwnedDirectory(tokenDirectory);
  assertOwnedRegularFile(lstatSync(tokenPath, { bigint: true }));
  unlinkSync(tokenPath);
}

export async function withFixtureMusicTokenSecretCleanup<T>(
  repositoryRoot: string,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } finally {
    cleanupFixtureMusicTokenSecret(repositoryRoot);
  }
}

function fixturePaths(repositoryRoot: string) {
  const root = resolve(repositoryRoot);
  const artifactDirectory = join(root, ".artifacts");
  const tokenDirectory = join(artifactDirectory, "music-token-secrets");
  const tokenPath = join(tokenDirectory, "current");
  const expectedPrefix = `${root}${process.platform === "win32" ? "\\" : "/"}`;
  if (!tokenPath.startsWith(expectedPrefix)) throw fixtureSecretError();
  return { root, artifactDirectory, tokenDirectory, tokenPath };
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
  if (!stat.isFile() || stat.isSymbolicLink() || !ownedByCurrentUser(stat.uid)) throw fixtureSecretError();
}

function ownedByCurrentUser(uid: bigint): boolean {
  if (process.platform === "win32") return true;
  const effectiveUserId = process.geteuid?.();
  return effectiveUserId !== undefined && uid === BigInt(effectiveUserId);
}

function sameIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function removeExactOpenedFile(
  path: string,
  opened: BigIntStats | undefined,
  directoryPath: string,
  directoryBefore: BigIntStats,
): void {
  if (!opened) return;
  try {
    if (!sameIdentity(lstatSync(directoryPath, { bigint: true }), directoryBefore)) return;
    const current = lstatSync(path, { bigint: true });
    if (current.isFile() && !current.isSymbolicLink() && sameIdentity(current, opened)) unlinkSync(path);
  } catch {
    // Failure cleanup never broadens beyond the exact descriptor identity.
  }
}

function fixtureSecretError(): Error {
  return new Error("Fixture signing key must be the exact owned regular artifact file");
}
