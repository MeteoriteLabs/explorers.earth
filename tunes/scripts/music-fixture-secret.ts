import { randomBytes as secureRandomBytes } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  unlinkSync,
  writeSync,
  type BigIntStats,
} from "node:fs";
import { join, resolve } from "node:path";

export const FIXTURE_MUSIC_TOKEN_SECRET_RELATIVE_PATH = join(".artifacts", "music-token-secrets", "current");

export function prepareFixtureMusicTokenSecret(
  repositoryRoot: string,
  randomBytes: (size: number) => Buffer = secureRandomBytes,
): string {
  const { root, artifactDirectory, tokenDirectory, tokenPath } = fixturePaths(repositoryRoot);
  assertOwnedDirectory(root);
  ensureOwnedDirectory(artifactDirectory);
  ensureOwnedDirectory(tokenDirectory);

  const existing = existsSync(tokenPath) ? lstatSync(tokenPath, { bigint: true }) : undefined;
  if (existing) assertOwnedRegularFile(existing);
  const secret = randomBytes(32);
  if (!Buffer.isBuffer(secret) || secret.length < 32) throw fixtureSecretError();
  const encoded = Buffer.from(secret).toString("base64url");
  if (existing) chmodSync(tokenPath, 0o600);
  const descriptor = process.platform === "win32"
    ? openSync(tokenPath, existing ? "w" : "wx", 0o600)
    : openSync(tokenPath, constants.O_WRONLY | constants.O_NOFOLLOW
      | (existing ? constants.O_TRUNC : constants.O_CREAT | constants.O_EXCL), 0o600);
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    assertOwnedRegularFile(opened);
    if (existing && !sameIdentity(existing, opened)) throw fixtureSecretError();
    const bytes = Buffer.from(encoded, "ascii");
    if (writeSync(descriptor, bytes, 0, bytes.length, 0) !== bytes.length) throw fixtureSecretError();
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  chmodSync(tokenPath, 0o600);
  const final = lstatSync(tokenPath, { bigint: true });
  assertOwnedRegularFile(final);
  return tokenPath;
}

export function cleanupFixtureMusicTokenSecret(repositoryRoot: string): void {
  const { root, artifactDirectory, tokenDirectory, tokenPath } = fixturePaths(repositoryRoot);
  assertOwnedDirectory(root);
  if (!existsSync(artifactDirectory) || !existsSync(tokenDirectory) || !existsSync(tokenPath)) return;
  assertOwnedDirectory(artifactDirectory);
  assertOwnedDirectory(tokenDirectory);
  assertOwnedRegularFile(lstatSync(tokenPath, { bigint: true }));
  unlinkSync(tokenPath);
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

function fixtureSecretError(): Error {
  return new Error("Fixture signing key must be the exact owned regular artifact file");
}
