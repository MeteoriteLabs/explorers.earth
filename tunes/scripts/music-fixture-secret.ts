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
const fixtureRotationJournalName = /^rotation-[a-f0-9]{32}\.json$/;

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
  beforeReferenceCommit?: (state: FixtureEnvironmentCommitState) => void;
}

export interface FixtureEnvironmentReadDependencies {
  afterReferenceRead?: () => void;
  afterGenerationOpen?: () => void;
}

export interface FixtureAuthoritySnapshot {
  kind: "environment" | "credential";
  relativePath: string;
  directoryDev: string;
  directoryIno: string;
  fileDev: string;
  fileIno: string;
  size: number;
  sha256: string;
}

export interface FixtureEnvironmentCommitState {
  targetReference: string;
  candidate: FixtureAuthoritySnapshot;
  previous?: FixtureAuthoritySnapshot;
}

export interface FixtureAuthorityPaths {
  tokenPath: string;
  migratorPasswordPath: string;
  runtimePasswordPath: string;
}

export interface FixtureAuthorityRotationDependencies {
  prepareSecret?: (repositoryRoot: string, index: number) => string;
  persistence?: FixtureEnvironmentPersistenceDependencies;
  syncJournalDirectory?: (path: string) => void;
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
  // A pending bundle transaction owns retirement ordering. Resolve it before
  // any aggregate cleanup so an attacker swap cannot fall through to the
  // older name-only fixture tombstone path.
  recoverFixtureAuthorityRotations(root);
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

export function rotateFixtureMusicAuthority(
  repositoryRoot: string,
  buildEnvironment: (paths: FixtureAuthorityPaths) => string,
  dependencies: FixtureAuthorityRotationDependencies = {},
): string {
  const root = resolve(repositoryRoot);
  recoverFixtureAuthorityRotations(root);
  const priorEnvironment = readFixtureEnvironmentForRotation(root);
  const priorCredentials = priorEnvironment?.contents
    ? fixtureCredentialPaths({ contents: priorEnvironment.contents }).map((path) => captureFixtureAuthority(root, path, "credential"))
    : [];
  const candidateCredentials: FixtureAuthoritySnapshot[] = [];
  const candidatePaths: string[] = [];
  let journalName: string | undefined;
  try {
    for (let index = 0; index < 3; index += 1) {
      const path = dependencies.prepareSecret?.(root, index) ?? prepareFixtureMusicTokenSecret(root);
      candidatePaths.push(path);
      candidateCredentials.push(captureFixtureAuthority(root, path, "credential"));
    }
    const paths: FixtureAuthorityPaths = {
      tokenPath: candidatePaths[0]!,
      migratorPasswordPath: candidatePaths[1]!,
      runtimePasswordPath: candidatePaths[2]!,
    };
    const contents = buildEnvironment(paths);
    const callerBeforeCommit = dependencies.persistence?.beforeReferenceCommit;
    const persistence: FixtureEnvironmentPersistenceDependencies = {
      ...dependencies.persistence,
      beforeReferenceCommit: (state) => {
        callerBeforeCommit?.(state);
        journalName = writeFixtureRotationJournal(root, {
          schemaVersion: "music-fixture-rotation/v1",
          targetReference: state.targetReference,
          priorPointerSha256: priorEnvironment?.pointerSha256 ?? createHash("sha256").update(Buffer.alloc(0)).digest("hex"),
          prior: [...priorCredentials, ...(state.previous ? [state.previous] : [])],
          candidate: [...candidateCredentials, state.candidate],
        }, dependencies.syncJournalDirectory);
      },
    };
    const result = persistFixtureMusicEnvironment(root, contents, persistence);
    if (!journalName) throw fixtureEnvironmentError("rotation-journal");
    recoverFixtureAuthorityRotations(root);
    return result;
  } catch (error) {
    if (journalName) {
      try { recoverFixtureAuthorityRotations(root); }
      catch (cleanupError) { throw cleanupError; }
    } else {
      let cleanupFailure: unknown;
      for (const candidate of candidateCredentials) {
        try { cleanupFixtureAuthority(root, candidate); }
        catch (candidateError) { cleanupFailure ??= candidateError; }
      }
      if (cleanupFailure) throw cleanupFailure;
    }
    throw error;
  }
}

export function recoverFixtureAuthorityRotations(repositoryRoot: string): void {
  const root = resolve(repositoryRoot);
  const journalDirectory = join(root, ".artifacts", "music-rotation-journals");
  if (!existsSync(journalDirectory)) return;
  assertNoLinkedAncestors(journalDirectory);
  assertOwnedDirectory(journalDirectory);
  for (const name of readdirSync(journalDirectory).sort()) {
    if (!fixtureRotationJournalName.test(name)) continue;
    const path = join(journalDirectory, name);
    const opened = openAndReadOwnedFileAllowEmpty(path, 32_768, false);
    if (opened.bytes.length === 0) {
      closeDescriptor(opened.descriptor, {}, name);
      continue;
    }
    try {
      const journal = parseFixtureRotationJournal(opened.bytes.toString("utf8"));
      const pointer = readCurrentPointerBytes(root);
      const committed = pointer.toString("ascii") === journal.targetReference;
      const precommit = createHash("sha256").update(pointer).digest("hex") === journal.priorPointerSha256;
      if (!committed && !precommit) throw new FixtureSecretCleanupError(name);
      for (const authority of committed ? journal.prior : journal.candidate) cleanupFixtureAuthority(root, authority);
      zeroOpenedRotationJournal(path, opened.descriptor, opened.stat, opened.bytes, name);
    } catch (error) {
      try { closeSync(opened.descriptor); } catch { /* the typed cleanup failure below is authoritative */ }
      throw error instanceof FixtureSecretCleanupError ? error : new FixtureSecretCleanupError(name);
    }
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
    dependencies.beforeReferenceCommit?.({
      targetReference: reference,
      candidate: captureFixtureAuthority(root, generationPath, "environment"),
      previous: previous.generation ? environmentAuthoritySnapshot(root, previous.generation) : undefined,
    });
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
      if (!referenceMatches(referencePath, reference, generationPath, generationOpened, { generationName, digest, size: bytes.length })) {
        throw fixtureEnvironmentError(referenceTemporaryName);
      }
      referenceCommitted = true;
    } catch (renameError) {
      if (!referenceMatches(referencePath, reference, generationPath, generationOpened, { generationName, digest, size: bytes.length })) throw renameError;
      referenceCommitted = true;
    }
    dependencies.afterReferenceCommit?.();
    if (!descriptorStillContains(authorityDescriptor, generationOpened, bytes)
        || !referenceMatches(referencePath, reference, generationPath, generationOpened, { generationName, digest, size: bytes.length })) {
      throw fixtureEnvironmentError(generationName);
    }
    closeDescriptor(authorityDescriptor, dependencies, generationName);
    authorityDescriptor = undefined;
    if (previous.generation) cleanupFixtureEnvironmentGeneration(
      root,
      previous.generation.reference.generationName,
      previous.generation.stat,
      previous.generation.reference,
      previous.generation.directoryStat,
    );
    if (previous.legacyDescriptor !== undefined) {
      eraseAndCloseDescriptor(previous.legacyDescriptor, {}, basename(referencePath));
      previous.legacyDescriptor = undefined;
    }
    return referencePath;
  } catch (error) {
    let cleanupFailure: unknown;
    if (referenceCommitted) {
      // The pointer is the single authority switch. Once committed, the new
      // referenced generation must never enter an erasure path, even when
      // reconciliation, descriptor close, or prior-authority cleanup fails.
      for (const descriptor of [referenceDescriptor, authorityDescriptor, generationDescriptor]) {
        if (descriptor === undefined) continue;
        try { closeSync(descriptor); } catch { cleanupFailure ??= new FixtureSecretCleanupError(generationName); }
      }
      if (previous.legacyDescriptor !== undefined) {
        try { closeSync(previous.legacyDescriptor); } catch { cleanupFailure ??= new FixtureSecretCleanupError(basename(referencePath)); }
        previous.legacyDescriptor = undefined;
      }
      throw cleanupFailure instanceof FixtureSecretCleanupError
        ? cleanupFailure
        : new FixtureSecretCleanupError(generationName);
    }
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

interface FixtureEnvironmentGenerationAuthority {
  reference: FixtureEnvironmentReference;
  stat: BigIntStats;
  directoryStat: BigIntStats;
}

interface FixtureRotationJournal {
  schemaVersion: "music-fixture-rotation/v1";
  targetReference: string;
  priorPointerSha256: string;
  prior: FixtureAuthoritySnapshot[];
  candidate: FixtureAuthoritySnapshot[];
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
  return openAndReadOwnedFileWithEmptyPolicy(path, maximumSize, secret, false);
}

function openAndReadOwnedFileAllowEmpty(path: string, maximumSize: number, secret: boolean): { descriptor: number; stat: BigIntStats; bytes: Buffer } {
  return openAndReadOwnedFileWithEmptyPolicy(path, maximumSize, secret, true);
}

function openAndReadOwnedFileWithEmptyPolicy(path: string, maximumSize: number, secret: boolean, allowEmpty: boolean): { descriptor: number; stat: BigIntStats; bytes: Buffer } {
  assertNoLinkedAncestors(path);
  const before = lstatSync(path, { bigint: true });
  assertOwnedRegularFile(before);
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  const descriptor = openSync(path, constants.O_RDONLY | noFollow);
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    assertOwnedRegularFile(opened);
    if (!sameIdentity(before, opened) || (!allowEmpty && opened.size < BigInt(1)) || opened.size > BigInt(maximumSize)
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

function readFixtureEnvironmentForRotation(root: string): { contents?: string; pointerSha256: string } | undefined {
  const pointerPath = join(root, ".env.music.test");
  if (!existsSync(pointerPath)) return undefined;
  try {
    const contents = readFixtureMusicEnvironment(root);
    const pointer = readCurrentPointerBytes(root);
    parseFixtureEnvironmentReference(pointer.toString("ascii"));
    if (readFixtureMusicEnvironment(root) !== contents) throw fixtureEnvironmentError("rotation-authority");
    return { contents, pointerSha256: createHash("sha256").update(pointer).digest("hex") };
  } catch (strictError) {
    const legacy = openAndReadOwnedFile(pointerPath, 65_536, true);
    try {
      const bytes = legacy.bytes;
      if (bytes.toString("ascii").startsWith(`${fixtureEnvironmentReferenceHeader}\n`)) {
        const parsed = parseFixtureEnvironmentReference(bytes.toString("ascii"));
        const generationPath = join(root, FIXTURE_MUSIC_ENVIRONMENT_DIRECTORY_RELATIVE_PATH, parsed.generationName);
        if (existsSync(generationPath)) {
          const stat = lstatSync(generationPath, { bigint: true });
          assertOwnedRegularFile(stat);
          if (stat.size === BigInt(0)) {
            return { pointerSha256: createHash("sha256").update(bytes).digest("hex") };
          }
        }
        throw strictError;
      }
      return { contents: bytes.toString("utf8"), pointerSha256: createHash("sha256").update(bytes).digest("hex") };
    } finally {
      closeDescriptor(legacy.descriptor, {}, basename(pointerPath));
    }
  }
}

function fixtureCredentialPaths(environment: { contents: string }): string[] {
  const values = new Map(environment.contents.split(/\r?\n/).filter(Boolean).map((line) => {
    const separator = line.indexOf("=");
    if (separator < 1) throw fixtureEnvironmentError("rotation-environment");
    return [line.slice(0, separator), line.slice(separator + 1)] as const;
  }));
  return ["MUSIC_TOKEN_SECRET_FILE_HOST", "MUSIC_DB_MIGRATOR_SECRET_FILE_HOST", "MUSIC_DB_RUNTIME_SECRET_FILE_HOST"]
    .map((key) => values.get(key))
    .filter((value): value is string => Boolean(value));
}

function captureFixtureAuthority(root: string, pathValue: string, kind: FixtureAuthoritySnapshot["kind"]): FixtureAuthoritySnapshot {
  const path = resolve(root, pathValue);
  assertFixtureAuthorityPath(root, path, kind);
  const directory = dirname(path);
  const directoryStat = lstatSync(directory, { bigint: true });
  assertOwnedDirectory(directory);
  const opened = openAndReadOwnedFile(path, 65_536, true);
  try {
    if (!sameIdentity(directoryStat, lstatSync(directory, { bigint: true }))) throw fixtureSecretError();
    return {
      kind,
      relativePath: relative(root, path).replace(/\\/g, "/"),
      directoryDev: directoryStat.dev.toString(),
      directoryIno: directoryStat.ino.toString(),
      fileDev: opened.stat.dev.toString(),
      fileIno: opened.stat.ino.toString(),
      size: opened.bytes.length,
      sha256: createHash("sha256").update(opened.bytes).digest("hex"),
    };
  } finally {
    closeDescriptor(opened.descriptor, {}, basename(path));
  }
}

function environmentAuthoritySnapshot(root: string, authority: FixtureEnvironmentGenerationAuthority): FixtureAuthoritySnapshot {
  return {
    kind: "environment",
    relativePath: relative(root, join(root, FIXTURE_MUSIC_ENVIRONMENT_DIRECTORY_RELATIVE_PATH, authority.reference.generationName)).replace(/\\/g, "/"),
    directoryDev: authority.directoryStat.dev.toString(),
    directoryIno: authority.directoryStat.ino.toString(),
    fileDev: authority.stat.dev.toString(),
    fileIno: authority.stat.ino.toString(),
    size: authority.reference.size,
    sha256: authority.reference.digest,
  };
}

function cleanupFixtureAuthority(root: string, snapshot: FixtureAuthoritySnapshot): void {
  validateFixtureAuthoritySnapshot(snapshot);
  const path = resolve(root, snapshot.relativePath);
  assertFixtureAuthorityPath(root, path, snapshot.kind);
  const targetId = basename(path);
  const directory = dirname(path);
  const expectedDirectory = { dev: BigInt(snapshot.directoryDev), ino: BigInt(snapshot.directoryIno) };
  const currentDirectory = lstatSync(directory, { bigint: true });
  if (currentDirectory.dev !== expectedDirectory.dev || currentDirectory.ino !== expectedDirectory.ino) {
    throw new FixtureSecretCleanupError(targetId);
  }
  if (!existsSync(path)) throw new FixtureSecretCleanupError(targetId);
  const before = lstatSync(path, { bigint: true });
  assertOwnedRegularFile(before);
  if (before.dev !== BigInt(snapshot.fileDev) || before.ino !== BigInt(snapshot.fileIno)) {
    throw new FixtureSecretCleanupError(targetId);
  }
  if (before.size === BigInt(0)) return;
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  const descriptor = openSync(path, constants.O_RDWR | noFollow, 0o600);
  let failed = false;
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    const bytes = readFileSync(descriptor);
    if (opened.dev !== BigInt(snapshot.fileDev) || opened.ino !== BigInt(snapshot.fileIno)
        || bytes.length !== snapshot.size
        || createHash("sha256").update(bytes).digest("hex") !== snapshot.sha256
        || !sameIdentity(opened, lstatSync(path, { bigint: true }))
        || currentDirectory.dev !== lstatSync(directory, { bigint: true }).dev
        || currentDirectory.ino !== lstatSync(directory, { bigint: true }).ino) throw fixtureSecretError();
    eraseDescriptor(descriptor, {});
  } catch { failed = true; }
  try { closeSync(descriptor); } catch { failed = true; }
  if (failed) throw new FixtureSecretCleanupError(targetId);
}

function assertFixtureAuthorityPath(root: string, path: string, kind: FixtureAuthoritySnapshot["kind"]): void {
  const absolute = resolve(path);
  if (kind === "credential") {
    assertExactTokenPath(root, absolute);
    return;
  }
  const directory = resolve(root, FIXTURE_MUSIC_ENVIRONMENT_DIRECTORY_RELATIVE_PATH);
  if (dirname(absolute) !== directory || !fixtureEnvironmentGenerationName.test(basename(absolute))) throw fixtureSecretError();
}

function validateFixtureAuthoritySnapshot(value: FixtureAuthoritySnapshot): void {
  if (!value || !["environment", "credential"].includes(value.kind)
      || typeof value.relativePath !== "string" || value.relativePath.includes("..") || value.relativePath.includes(":")
      || !/^\d+$/.test(value.directoryDev) || !/^\d+$/.test(value.directoryIno)
      || !/^\d+$/.test(value.fileDev) || !/^\d+$/.test(value.fileIno)
      || !Number.isSafeInteger(value.size) || value.size < 1 || value.size > 65_536
      || !/^[a-f0-9]{64}$/.test(value.sha256)) throw fixtureEnvironmentError("rotation-journal");
}

function writeFixtureRotationJournal(
  root: string,
  journal: FixtureRotationJournal,
  syncJournalDirectory: (path: string) => void = syncDirectory,
): string {
  const artifactDirectory = join(root, ".artifacts");
  const directory = join(artifactDirectory, "music-rotation-journals");
  ensureOwnedDirectory(artifactDirectory);
  ensureOwnedDirectory(directory);
  assertNoLinkedAncestors(directory);
  const random = secureRandomBytes(16).toString("hex");
  const name = `rotation-${random}.json`;
  const path = join(directory, name);
  const bytes = Buffer.from(JSON.stringify(journal), "utf8");
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  const descriptor = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600);
  let failed = false;
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    assertOwnedRegularFile(opened);
    fchmodSync(descriptor, 0o600);
    if (writeSync(descriptor, bytes, 0, bytes.length, 0) !== bytes.length) throw fixtureEnvironmentError(name);
    fsyncSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    if (!sameIdentity(opened, after) || after.size !== BigInt(bytes.length)) throw fixtureEnvironmentError(name);
  } catch { failed = true; }
  try { closeSync(descriptor); } catch { failed = true; }
  if (failed) throw fixtureEnvironmentError(name);
  try { syncJournalDirectory(directory); }
  catch { throw fixtureEnvironmentError(name); }
  return name;
}

function parseFixtureRotationJournal(contents: string): FixtureRotationJournal {
  const value = JSON.parse(contents) as FixtureRotationJournal;
  if (value?.schemaVersion !== "music-fixture-rotation/v1"
      || typeof value.targetReference !== "string"
      || encodeFixtureEnvironmentReference(parseFixtureEnvironmentReference(value.targetReference)) !== value.targetReference
      || !/^[a-f0-9]{64}$/.test(value.priorPointerSha256)
      || !Array.isArray(value.prior) || !Array.isArray(value.candidate)
      || value.prior.length > 4 || value.candidate.length !== 4) throw fixtureEnvironmentError("rotation-journal");
  for (const snapshot of [...value.prior, ...value.candidate]) validateFixtureAuthoritySnapshot(snapshot);
  return value;
}

function readCurrentPointerBytes(root: string): Buffer {
  const path = join(root, ".env.music.test");
  if (!existsSync(path)) return Buffer.alloc(0);
  const opened = openAndReadOwnedFile(path, 65_536, false);
  try { return Buffer.from(opened.bytes); }
  finally { closeDescriptor(opened.descriptor, {}, basename(path)); }
}

function zeroOpenedRotationJournal(path: string, readDescriptor: number, expected: BigIntStats, expectedBytes: Buffer, targetId: string): void {
  closeDescriptor(readDescriptor, {}, targetId);
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  const descriptor = openSync(path, constants.O_RDWR | noFollow, 0o600);
  let failed = false;
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    const bytes = readFileSync(descriptor);
    if (!sameIdentity(opened, expected) || !bytes.equals(expectedBytes) || !sameIdentity(opened, lstatSync(path, { bigint: true }))) {
      throw fixtureSecretError();
    }
    eraseDescriptor(descriptor, {});
  } catch { failed = true; }
  try { closeSync(descriptor); } catch { failed = true; }
  if (failed) throw new FixtureSecretCleanupError(targetId);
}

function readPreviousFixtureEnvironmentAuthority(root: string, referencePath: string): {
  generation?: FixtureEnvironmentGenerationAuthority;
  legacyDescriptor?: number;
} {
  if (!existsSync(referencePath)) return {};
  const opened = openAndReadOwnedFile(referencePath, 65_536, false);
  const contents = opened.bytes.toString("utf8");
  if (!contents.startsWith(`${fixtureEnvironmentReferenceHeader}\n`)) return { legacyDescriptor: opened.descriptor };
  try {
    const parsed = parseFixtureEnvironmentReference(contents);
    closeDescriptor(opened.descriptor, {}, basename(referencePath));
    const generationDirectory = join(root, FIXTURE_MUSIC_ENVIRONMENT_DIRECTORY_RELATIVE_PATH);
    const directoryStat = lstatSync(generationDirectory, { bigint: true });
    assertOwnedDirectory(generationDirectory);
    const generationPath = join(generationDirectory, parsed.generationName);
    const generation = openAndReadOwnedFile(generationPath, 65_536, true);
    try {
      if (generation.bytes.length !== parsed.size || createHash("sha256").update(generation.bytes).digest("hex") !== parsed.digest) {
        throw fixtureEnvironmentError(parsed.generationName);
      }
      if (!sameIdentity(directoryStat, lstatSync(generationDirectory, { bigint: true }))) {
        throw fixtureEnvironmentError(parsed.generationName);
      }
      return { generation: { reference: parsed, stat: generation.stat, directoryStat } };
    } finally {
      closeDescriptor(generation.descriptor, {}, parsed.generationName);
    }
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
  expectedGeneration: FixtureEnvironmentReference,
): boolean {
  try {
    const reference = openAndReadOwnedFile(referencePath, 512, false);
    try {
      if (reference.bytes.toString("ascii") !== expectedReference) return false;
    } finally {
      closeDescriptor(reference.descriptor, {}, basename(referencePath));
    }
    assertFixtureEnvironmentGeneration(lstatSync(generationPath, { bigint: true }), generation, expectedGeneration.size, basename(generationPath));
    const observed = openAndReadOwnedFile(generationPath, 65_536, true);
    try {
      if (!sameIdentity(observed.stat, generation)
          || observed.bytes.length !== expectedGeneration.size
          || createHash("sha256").update(observed.bytes).digest("hex") !== expectedGeneration.digest) return false;
    } finally {
      closeDescriptor(observed.descriptor, {}, basename(generationPath));
    }
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
  expectedDirectory?: BigIntStats,
): void {
  const root = resolve(repositoryRoot);
  if (!fixtureEnvironmentGenerationName.test(generationName)) throw new FixtureSecretCleanupError("generation-unknown");
  const generationDirectory = join(root, FIXTURE_MUSIC_ENVIRONMENT_DIRECTORY_RELATIVE_PATH);
  const path = join(generationDirectory, generationName);
  if (!existsSync(path)) {
    if (expected || expectedReference || expectedDirectory) throw new FixtureSecretCleanupError(generationName);
    return;
  }
  assertNoLinkedAncestors(path);
  const directoryBefore = lstatSync(generationDirectory, { bigint: true });
  if (expectedDirectory && !sameIdentity(directoryBefore, expectedDirectory)) throw new FixtureSecretCleanupError(generationName);
  const before = lstatSync(path, { bigint: true });
  assertOwnedRegularFile(before);
  if (expected && !sameIdentity(before, expected)) throw new FixtureSecretCleanupError(generationName);
  if (before.size === BigInt(0)) return;
  const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
  const descriptor = openSync(path, constants.O_RDWR | noFollow, 0o600);
  let failed = false;
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    if (!sameIdentity(before, opened)
        || (expected && !sameIdentity(expected, opened))
        || !sameIdentity(directoryBefore, lstatSync(generationDirectory, { bigint: true }))) throw fixtureSecretError();
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
