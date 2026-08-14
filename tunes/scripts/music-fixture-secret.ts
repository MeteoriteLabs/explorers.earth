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
  writeSync,
  type BigIntStats,
} from "node:fs";
import { basename, dirname, join, parse, relative, resolve } from "node:path";

export const FIXTURE_MUSIC_TOKEN_SECRET_DIRECTORY_RELATIVE_PATH = join(".artifacts", "music-token-secrets");
const fixtureTokenName = /^current-[a-f0-9]{32}$/;

export interface FixtureMusicTokenSecretDependencies {
  randomNameBytes?: (size: number) => Buffer;
  open?: (path: string, flags: number, mode: number) => number;
  write?: typeof writeSync;
  fsync?: typeof fsyncSync;
  beforeErase?: () => void;
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
  const syncFile = dependencies.fsync ?? fsyncSync;
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
  } catch (error) {
    if (descriptor !== undefined) eraseDescriptor(descriptor);
    throw fixtureSecretError();
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
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    assertOwnedRegularFile(opened);
    if (!sameIdentity(before, opened)
        || !sameIdentity(directoryBefore, lstatSync(tokenDirectory, { bigint: true }))) throw fixtureSecretError();
    dependencies.beforeErase?.();
    eraseDescriptor(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

export function cleanupAllFixtureMusicTokenSecrets(repositoryRoot: string): void {
  const { tokenDirectory } = fixtureDirectories(repositoryRoot);
  if (!existsSync(tokenDirectory)) return;
  assertNoLinkedAncestors(tokenDirectory);
  assertOwnedDirectory(tokenDirectory);
  for (const name of readdirSync(tokenDirectory)) {
    if (fixtureTokenName.test(name)) cleanupFixtureMusicTokenSecret(repositoryRoot, join(tokenDirectory, name));
  }
}

export async function withFixtureMusicTokenSecretCleanup<T>(
  repositoryRoot: string,
  exactTokenPath: string,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } finally {
    cleanupFixtureMusicTokenSecret(repositoryRoot, exactTokenPath);
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

function eraseDescriptor(descriptor: number): void {
  try {
    ftruncateSync(descriptor, 0);
    fsyncSync(descriptor);
  } catch {
    // The caller still fails closed. No pathname mutation is attempted.
  }
}

function fixtureSecretError(): Error {
  return new Error("Fixture signing key must be an exact owned regular artifact file");
}
