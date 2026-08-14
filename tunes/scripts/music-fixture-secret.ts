import { createHash, randomBytes as secureRandomBytes } from "node:crypto";
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
  readFileSync,
  readSync,
  realpathSync,
  readdirSync,
  renameSync,
  writeSync,
  type BigIntStats,
} from "node:fs";
import { basename, dirname, join, parse, relative, resolve } from "node:path";

export const FIXTURE_MUSIC_TOKEN_SECRET_DIRECTORY_RELATIVE_PATH = join(".artifacts", "music-token-secrets");
export const FIXTURE_MUSIC_ENVIRONMENT_DIRECTORY_RELATIVE_PATH = join(".artifacts", "music-environment-generations");
const fixtureTokenName = /^current-[a-f0-9]{32}$/;
const fixtureEnvironmentTemporaryName = /^\.env\.music\.test\.[a-f0-9]{32}\.tmp$/;
const fixtureEnvironmentGenerationName = /^generation-[a-f0-9]{32}$/;
const fixtureEnvironmentReferenceTemporaryName = /^\.env\.music\.test\.reference-[a-f0-9]{32}\.tmp$/;
const fixtureEnvironmentReferenceHeader = "music-fixture-env/v1";

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
  afterReferenceCommit?: () => void;
}

export interface FixtureEnvironmentReadDependencies {
  afterReferenceRead?: () => void;
  afterGenerationOpen?: () => void;
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
  const generationDirectory = join(root, FIXTURE_MUSIC_ENVIRONMENT_DIRECTORY_RELATIVE_PATH);
  let currentEnvironment: FixtureEnvironmentReference | undefined;
  const referencePath = join(root, ".env.music.test");
  if (existsSync(referencePath)) {
    try {
      const reference = openAndReadOwnedFile(referencePath, 512, false);
      try { currentEnvironment = parseFixtureEnvironmentReference(reference.bytes.toString("ascii")); }
      finally { closeDescriptor(reference.descriptor, {}, basename(referencePath)); }
    } catch {
      // A legacy/invalid pointer is never authority for erasing a referenced
      // non-empty generation. Bootstrap may replace a verified owned legacy
      // file; resume/down remain fail-closed.
    }
  }
  if (existsSync(generationDirectory)) {
    assertNoLinkedAncestors(generationDirectory);
    assertOwnedDirectory(generationDirectory);
    for (const name of readdirSync(generationDirectory)) {
      if (!fixtureEnvironmentGenerationName.test(name)) continue;
      try {
        cleanupFixtureEnvironmentGeneration(
          root,
          name,
          undefined,
          currentEnvironment?.generationName === name ? currentEnvironment : undefined,
        );
      }
      catch (error) {
        failure ??= error instanceof FixtureSecretCleanupError ? error : new FixtureSecretCleanupError(name);
      }
    }
  }
  assertNoLinkedAncestors(root);
  assertOwnedDirectory(root);
  for (const name of readdirSync(root)) {
    if (!fixtureEnvironmentTemporaryName.test(name) && !fixtureEnvironmentReferenceTemporaryName.test(name)) continue;
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
  const recognized = fixtureEnvironmentTemporaryName.test(targetId) || fixtureEnvironmentReferenceTemporaryName.test(targetId);
  if (dirname(absolute) !== root || !recognized) {
    throw new FixtureSecretCleanupError(recognized ? targetId : "unknown");
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
  const referencePath = join(root, ".env.music.test");
  const generationDirectory = join(root, FIXTURE_MUSIC_ENVIRONMENT_DIRECTORY_RELATIVE_PATH);
  assertNoLinkedAncestors(referencePath);
  assertOwnedDirectory(root);
  ensureOwnedDirectory(join(root, ".artifacts"));
  ensureOwnedDirectory(generationDirectory);
  assertNoLinkedAncestors(generationDirectory);
  const rootBefore = lstatSync(root, { bigint: true });
  const generationDirectoryBefore = lstatSync(generationDirectory, { bigint: true });
  const previous = readPreviousFixtureEnvironmentAuthority(root, referencePath);
  const random = (dependencies.randomNameBytes ?? secureRandomBytes)(16);
  if (!Buffer.isBuffer(random) || random.length !== 16) throw fixtureEnvironmentError("unknown");
  const generationName = `generation-${random.toString("hex")}`;
  if (!fixtureEnvironmentGenerationName.test(generationName)) throw fixtureEnvironmentError("unknown");
  const generationPath = join(generationDirectory, generationName);
  const referenceTemporaryName = `.env.music.test.reference-${random.toString("hex")}.tmp`;
  const referenceTemporaryPath = join(root, referenceTemporaryName);
  const bytes = Buffer.from(contents, "utf8");
  if (!bytes.length || bytes.length > 65_536) throw fixtureEnvironmentError(generationName);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const reference = encodeFixtureEnvironmentReference({ generationName, digest, size: bytes.length });
  const referenceBytes = Buffer.from(reference, "ascii");
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow;
  let generationDescriptor: number | undefined;
  let authorityDescriptor: number | undefined;
  let referenceDescriptor: number | undefined;
  let generationOpened: BigIntStats | undefined;
  let referenceCommitted = false;
  try {
    generationDescriptor = (dependencies.open ?? openSync)(generationPath, flags, 0o600);
    generationOpened = fstatSync(generationDescriptor, { bigint: true });
    assertOwnedRegularFile(generationOpened);
    if (!sameIdentity(generationDirectoryBefore, lstatSync(generationDirectory, { bigint: true }))) {
      throw fixtureEnvironmentError(generationName);
    }
    fchmodSync(generationDescriptor, 0o600);
    if ((dependencies.write ?? writeSync)(generationDescriptor, bytes, 0, bytes.length, 0) !== bytes.length) {
      throw fixtureEnvironmentError(generationName);
    }
    (dependencies.sync ?? fsyncSync)(generationDescriptor);
    const afterWrite = fstatSync(generationDescriptor, { bigint: true });
    assertOwnedRegularFile(afterWrite);
    if (!sameIdentity(generationOpened, afterWrite) || afterWrite.size !== BigInt(bytes.length)) {
      throw fixtureEnvironmentError(generationName);
    }
    closeDescriptor(generationDescriptor, dependencies, generationName);
    generationDescriptor = undefined;

    const closedGeneration = lstatSync(generationPath, { bigint: true });
    assertFixtureEnvironmentGeneration(closedGeneration, generationOpened, bytes.length, generationName);
    authorityDescriptor = (dependencies.open ?? openSync)(generationPath, constants.O_RDWR | noFollow, 0o600);
    const authority = fstatSync(authorityDescriptor, { bigint: true });
    assertFixtureEnvironmentGeneration(authority, generationOpened, bytes.length, generationName);
    if (createHash("sha256").update(readFileSync(authorityDescriptor)).digest("hex") !== digest) {
      throw fixtureEnvironmentError(generationName);
    }
    (dependencies.syncDirectory ?? syncDirectory)(generationDirectory);
    const afterGenerationSync = lstatSync(generationPath, { bigint: true });
    assertFixtureEnvironmentGeneration(afterGenerationSync, generationOpened, bytes.length, generationName);

    referenceDescriptor = (dependencies.open ?? openSync)(referenceTemporaryPath, flags, 0o600);
    const referenceOpened = fstatSync(referenceDescriptor, { bigint: true });
    assertOwnedRegularFile(referenceOpened);
    fchmodSync(referenceDescriptor, 0o600);
    if ((dependencies.write ?? writeSync)(referenceDescriptor, referenceBytes, 0, referenceBytes.length, 0) !== referenceBytes.length) {
      throw fixtureEnvironmentError(referenceTemporaryName);
    }
    (dependencies.sync ?? fsyncSync)(referenceDescriptor);
    const referenceAfterWrite = fstatSync(referenceDescriptor, { bigint: true });
    if (!sameIdentity(referenceOpened, referenceAfterWrite) || referenceAfterWrite.size !== BigInt(referenceBytes.length)) {
      throw fixtureEnvironmentError(referenceTemporaryName);
    }
    closeDescriptor(referenceDescriptor, dependencies, referenceTemporaryName);
    referenceDescriptor = undefined;
    const closedReference = lstatSync(referenceTemporaryPath, { bigint: true });
    if (!sameIdentity(referenceOpened, closedReference) || closedReference.size !== BigInt(referenceBytes.length)) {
      throw fixtureEnvironmentError(referenceTemporaryName);
    }
    dependencies.beforePublish?.();
    if (!sameIdentity(rootBefore, lstatSync(root, { bigint: true }))) throw fixtureEnvironmentError(referenceTemporaryName);
    (dependencies.syncDirectory ?? syncDirectory)(root);
    assertFixtureEnvironmentGeneration(lstatSync(generationPath, { bigint: true }), generationOpened, bytes.length, generationName);
    // Windows will not atomically replace an open legacy fixed env file. A
    // legacy descriptor is closed only at this final boundary; a failed
    // pointer rename therefore still leaves its pathname and bytes intact.
    if (previous.legacyDescriptor !== undefined) {
      closeDescriptor(previous.legacyDescriptor, {}, basename(referencePath));
      previous.legacyDescriptor = undefined;
    }
    try {
      (dependencies.rename ?? renameSync)(referenceTemporaryPath, referencePath);
      referenceCommitted = true;
    } catch (renameError) {
      if (!referenceMatches(referencePath, reference, generationPath, generationOpened, bytes.length)) throw renameError;
      referenceCommitted = true;
    }
    dependencies.afterReferenceCommit?.();
    if (!referenceMatches(referencePath, reference, generationPath, generationOpened, bytes.length)) {
      throw fixtureEnvironmentError(generationName);
    }
    closeDescriptor(authorityDescriptor, {}, generationName);
    authorityDescriptor = undefined;
    if (previous.generation) cleanupFixtureEnvironmentGeneration(root, previous.generation);
    if (previous.legacyDescriptor !== undefined) {
      eraseAndCloseDescriptor(previous.legacyDescriptor, {}, basename(referencePath));
      previous.legacyDescriptor = undefined;
    }
    return referencePath;
  } catch (error) {
    let cleanupFailure: unknown;
    for (const descriptor of [referenceDescriptor, authorityDescriptor, generationDescriptor]) {
      if (descriptor === undefined) continue;
      try { eraseAndCloseDescriptor(descriptor, dependencies, generationName); }
      catch (cleanupError) { cleanupFailure ??= cleanupError; }
    }
    if (generationOpened && authorityDescriptor === undefined && generationDescriptor === undefined) {
      try { cleanupFixtureEnvironmentGeneration(root, generationName, generationOpened); }
      catch (cleanupError) { cleanupFailure ??= cleanupError; }
    }
    if (previous.legacyDescriptor !== undefined) {
      try { closeDescriptor(previous.legacyDescriptor, {}, basename(referencePath)); }
      catch (cleanupError) { cleanupFailure ??= cleanupError; }
    }
    if (cleanupFailure) throw cleanupFailure;
    if (error instanceof FixtureSecretCleanupError) throw error;
    throw fixtureEnvironmentError(referenceCommitted ? generationName : referenceTemporaryName);
  }
}

export function readFixtureMusicEnvironment(
  repositoryRoot: string,
  dependencies: FixtureEnvironmentReadDependencies = {},
): string {
  const root = resolve(repositoryRoot);
  const referencePath = join(root, ".env.music.test");
  const reference = openAndReadOwnedFile(referencePath, 512, false);
  try {
    const parsed = parseFixtureEnvironmentReference(reference.bytes.toString("ascii"));
    dependencies.afterReferenceRead?.();
    const generationDirectory = join(root, FIXTURE_MUSIC_ENVIRONMENT_DIRECTORY_RELATIVE_PATH);
    assertNoLinkedAncestors(generationDirectory);
    assertOwnedDirectory(generationDirectory);
    const generationPath = join(generationDirectory, parsed.generationName);
    const generation = openAndReadOwnedFile(generationPath, 65_536, true);
    try {
      dependencies.afterGenerationOpen?.();
      if (generation.bytes.length !== parsed.size
          || createHash("sha256").update(generation.bytes).digest("hex") !== parsed.digest
          || !descriptorStillContains(reference.descriptor, reference.stat, reference.bytes)
          || !descriptorStillContains(generation.descriptor, generation.stat, generation.bytes)
          || !sameIdentity(reference.stat, lstatSync(referencePath, { bigint: true }))
          || !sameIdentity(generation.stat, lstatSync(generationPath, { bigint: true }))) {
        throw fixtureEnvironmentError(parsed.generationName);
      }
      return generation.bytes.toString("utf8");
    } finally {
      closeDescriptor(generation.descriptor, {}, parsed.generationName);
    }
  } finally {
    closeDescriptor(reference.descriptor, {}, basename(referencePath));
  }
}

interface FixtureEnvironmentReference {
  generationName: string;
  digest: string;
  size: number;
}

function encodeFixtureEnvironmentReference(reference: FixtureEnvironmentReference): string {
  return `${fixtureEnvironmentReferenceHeader}\ngeneration=${reference.generationName}\nsha256=${reference.digest}\nsize=${reference.size}\n`;
}

function parseFixtureEnvironmentReference(contents: string): FixtureEnvironmentReference {
  const match = contents.match(/^music-fixture-env\/v1\ngeneration=(generation-[a-f0-9]{32})\nsha256=([a-f0-9]{64})\nsize=([1-9][0-9]{0,4})\n$/);
  if (!match) throw fixtureEnvironmentError("reference");
  const size = Number.parseInt(match[3]!, 10);
  if (!Number.isSafeInteger(size) || size > 65_536) throw fixtureEnvironmentError("reference");
  return { generationName: match[1]!, digest: match[2]!, size };
}

function openAndReadOwnedFile(path: string, maximumSize: number, secret: boolean): { descriptor: number; stat: BigIntStats; bytes: Buffer } {
  assertNoLinkedAncestors(path);
  const before = lstatSync(path, { bigint: true });
  assertOwnedRegularFile(before);
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  const descriptor = openSync(path, constants.O_RDONLY | noFollow);
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    assertOwnedRegularFile(opened);
    if (!sameIdentity(before, opened) || opened.size < BigInt(1) || opened.size > BigInt(maximumSize)
        || (secret && process.platform !== "win32" && (opened.mode & BigInt(0o077)) !== BigInt(0))) {
      throw fixtureEnvironmentError(basename(path));
    }
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (!sameIdentity(opened, after) || after.size !== BigInt(bytes.length)
        || !sameIdentity(opened, lstatSync(path, { bigint: true }))) {
      throw fixtureEnvironmentError(basename(path));
    }
    return { descriptor, stat: opened, bytes };
  } catch (error) {
    closeSync(descriptor);
    throw error;
  }
}

function descriptorStillContains(descriptor: number, expectedStat: BigIntStats, expectedBytes: Buffer): boolean {
  const current = fstatSync(descriptor, { bigint: true });
  if (!sameIdentity(expectedStat, current) || current.size !== BigInt(expectedBytes.length)) return false;
  const observed = Buffer.alloc(expectedBytes.length);
  let offset = 0;
  while (offset < observed.length) {
    const count = readSync(descriptor, observed, offset, observed.length - offset, offset);
    if (count < 1) return false;
    offset += count;
  }
  const afterRead = fstatSync(descriptor, { bigint: true });
  return observed.equals(expectedBytes)
    && sameIdentity(current, afterRead)
    && afterRead.size === BigInt(expectedBytes.length);
}

function readPreviousFixtureEnvironmentAuthority(root: string, referencePath: string): {
  generation?: string;
  legacyDescriptor?: number;
} {
  if (!existsSync(referencePath)) return {};
  const opened = openAndReadOwnedFile(referencePath, 65_536, false);
  const contents = opened.bytes.toString("utf8");
  if (!contents.startsWith(`${fixtureEnvironmentReferenceHeader}\n`)) return { legacyDescriptor: opened.descriptor };
  try {
    const parsed = parseFixtureEnvironmentReference(contents);
    closeDescriptor(opened.descriptor, {}, basename(referencePath));
    const generationPath = join(root, FIXTURE_MUSIC_ENVIRONMENT_DIRECTORY_RELATIVE_PATH, parsed.generationName);
    const generation = openAndReadOwnedFile(generationPath, 65_536, true);
    try {
      if (generation.bytes.length !== parsed.size || createHash("sha256").update(generation.bytes).digest("hex") !== parsed.digest) {
        throw fixtureEnvironmentError(parsed.generationName);
      }
    } finally {
      closeDescriptor(generation.descriptor, {}, parsed.generationName);
    }
    return { generation: parsed.generationName };
  } catch (error) {
    try { closeDescriptor(opened.descriptor, {}, basename(referencePath)); } catch { /* already closed */ }
    // A nonsecret pointer whose generation is missing, zeroed by down/reset,
    // or attacker-swapped is not authority. Bootstrap may replace the pointer
    // but never mutates the unverified referenced path.
    return {};
  }
}

function assertFixtureEnvironmentGeneration(stat: BigIntStats, expected: BigIntStats, size: number, targetId: string): void {
  assertOwnedRegularFile(stat);
  if (!sameIdentity(stat, expected) || stat.size !== BigInt(size)
      || (process.platform !== "win32" && (stat.mode & BigInt(0o077)) !== BigInt(0))) {
    throw fixtureEnvironmentError(targetId);
  }
}

function referenceMatches(
  referencePath: string,
  expectedReference: string,
  generationPath: string,
  generation: BigIntStats,
  generationSize: number,
): boolean {
  try {
    const reference = openAndReadOwnedFile(referencePath, 512, false);
    try {
      if (reference.bytes.toString("ascii") !== expectedReference) return false;
    } finally {
      closeDescriptor(reference.descriptor, {}, basename(referencePath));
    }
    assertFixtureEnvironmentGeneration(lstatSync(generationPath, { bigint: true }), generation, generationSize, basename(generationPath));
    return true;
  } catch {
    return false;
  }
}

function cleanupFixtureEnvironmentGeneration(
  repositoryRoot: string,
  generationName: string,
  expected?: BigIntStats,
  expectedReference?: FixtureEnvironmentReference,
): void {
  const root = resolve(repositoryRoot);
  if (!fixtureEnvironmentGenerationName.test(generationName)) throw new FixtureSecretCleanupError("generation-unknown");
  const generationDirectory = join(root, FIXTURE_MUSIC_ENVIRONMENT_DIRECTORY_RELATIVE_PATH);
  const path = join(generationDirectory, generationName);
  if (!existsSync(path)) return;
  assertNoLinkedAncestors(path);
  const before = lstatSync(path, { bigint: true });
  assertOwnedRegularFile(before);
  if (expected && !sameIdentity(before, expected)) return;
  if (before.size === BigInt(0)) return;
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  const descriptor = openSync(path, constants.O_RDWR | noFollow, 0o600);
  let failed = false;
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    if (!sameIdentity(before, opened) || (expected && !sameIdentity(expected, opened))) throw fixtureSecretError();
    if (expectedReference) {
      const bytes = readFileSync(descriptor);
      const afterRead = fstatSync(descriptor, { bigint: true });
      if (bytes.length !== expectedReference.size
          || createHash("sha256").update(bytes).digest("hex") !== expectedReference.digest
          || !sameIdentity(opened, afterRead)
          || afterRead.size !== BigInt(bytes.length)
          || !sameIdentity(opened, lstatSync(path, { bigint: true }))) {
        throw fixtureSecretError();
      }
    }
    eraseDescriptor(descriptor, {});
  } catch { failed = true; }
  try { closeSync(descriptor); } catch { failed = true; }
  if (failed) throw new FixtureSecretCleanupError(generationName);
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
