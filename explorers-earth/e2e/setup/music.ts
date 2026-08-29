import { test as base, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildLiveJourneyResult, buildLiveJourneyTerminal } from "../../scripts/music-public-live-preflight.mjs";

export const MUSIC_PUBLIC_FIXTURE_VERSION = "music-public-e2e-fixture/v1" as const;
export const MUSIC_LIVE_WRITE_CONFIRMATION = "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE" as const;
export const MUSIC_MUTATION_CALLSITES = [
  "owner-publication",
  "playlist-create",
  "playlist-delete",
  "playlist-song-add",
  "playlist-song-delete",
  "playlist-visibility",
  "queue-replace",
  "guest-controls",
  "song-request",
  "request-accept",
  "request-revoke",
  "guest-playback",
  "player-update",
] as const;
export type MusicMutationCallsite = typeof MUSIC_MUTATION_CALLSITES[number];

export function musicOwnerCredentialFromAuthState(environment: Record<string, string | undefined> = process.env): string {
  const authPath = environment.MUSIC_E2E_AUTH_STATE_PATH;
  if (!authPath) throw new Error("MUSIC_E2E_AUTH_STATE_PATH is required after callback bootstrap");
  const decoded = JSON.parse(readFileSync(authPath, "utf8")) as { ownerCredential?: unknown };
  if (typeof decoded.ownerCredential !== "string" || !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(decoded.ownerCredential)) {
    throw new Error("callback bootstrap auth state does not contain a valid opaque owner authority");
  }
  return decoded.ownerCredential;
}

export const MUSIC_PUBLIC_STATES = [
  "public",
  "unlisted",
  "private",
  "suspended",
  "tombstoned",
  "all-content",
  "empty",
  "queue-only",
  "playlists-only",
  "history-only",
  "request-allowed",
  "request-rate-limited",
] as const;

export type MusicTestLane = "pr-safe" | "fixture" | "live" | "visual";

export interface MusicPermissionRow {
  key: string;
  allowSongRequests: boolean;
  allowGuestPlayOnDevice: boolean;
  allowPlaylistSharing: boolean;
  allowRecentlyPlayedVisibility: boolean;
  allowQueueVisibility: boolean;
}

export function resolveMusicTestLane(environment: Record<string, string | undefined>): MusicTestLane {
  if (environment.PLAYWRIGHT_PR_SAFE === "true") return "pr-safe";
  if (environment.MUSIC_E2E_LIVE_WRITE === "true") return "live";
  if (environment.MUSIC_E2E_VISUAL === "true") return "visual";
  return "fixture";
}

export function fixtureNamespace(runId: string): string {
  const safeRunId = runId.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!safeRunId) throw new Error("Fixture run ID must contain an ASCII letter or digit");
  return `e2e-public-music-${safeRunId}`;
}

export function assertLiveWriteAuthority(input: {
  lane: MusicTestLane;
  liveWriteEnabled: boolean;
  baseUrl: string;
  serviceOrigins: string[];
  accountDocumentId: string;
  accountUsername: string;
  fixtureVersion: string;
  confirmation: string | undefined;
}): { authorized: true; namespace: string; callsites: readonly MusicMutationCallsite[] } {
  if (input.lane === "pr-safe") throw new Error("PR-safe lane cannot acquire live-write authority");
  if (input.lane !== "live") throw new Error("Live writes require the live lane");
  if (!input.liveWriteEnabled) throw new Error("Live writes require MUSIC_E2E_LIVE_WRITE=true");
  if (input.confirmation !== MUSIC_LIVE_WRITE_CONFIRMATION) {
    throw new Error("Live writes require the exact disposable-fixture confirmation");
  }
  if (input.fixtureVersion !== MUSIC_PUBLIC_FIXTURE_VERSION) {
    throw new Error(`Live writes require fixture version ${MUSIC_PUBLIC_FIXTURE_VERSION}`);
  }
  const allOrigins = [input.baseUrl, ...input.serviceOrigins];
  for (const rawOrigin of allOrigins) {
    const url = new URL(rawOrigin);
    if (!["http:", "tcp:"].includes(url.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
      throw new Error(`Live writes require every service origin to be disposable loopback: ${url.origin}`);
    }
  }
  const match = input.accountUsername.match(/^(e2e-public-music-[a-z0-9-]+)-owner$/);
  if (!match) throw new Error("Live writes require a namespaced disposable account");
  if (input.accountDocumentId !== `${match[1]}-account`) {
    throw new Error("Live writes require a namespaced disposable account document ID");
  }
  return { authorized: true, namespace: match[1], callsites: MUSIC_MUTATION_CALLSITES };
}

let liveMutationBlockedReason: string | null = null;

function exactDurableGuard(value: unknown): "clear" | "blocked" | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join("\0") !== ["reason", "stage", "state", "version"].join("\0")
      || record.version !== "music-e2e-mutation-guard/v1") return undefined;
  if (record.state === "clear" && record.reason === "none" && record.stage === "preflight") return "clear";
  if (record.state === "blocked"
      && ["restore-failed", "restore-mismatch", "cleanup-failed", "profile-restore-failed", "guard-invalid"].includes(String(record.reason))
      && ["restore", "verification", "cleanup", "profile-restore", "preflight"].includes(String(record.stage))) return "blocked";
  return undefined;
}

async function durableMusicMutationState(environment: Record<string, string | undefined> = process.env): Promise<"clear" | "blocked"> {
  if (environment.MUSIC_E2E_LIVE_WRITE !== "true") return "clear";
  const serviceUrl = environment.MUSIC_E2E_STATE_SERVICE_URL;
  const token = environment.MUSIC_E2E_STATE_TOKEN;
  if (!serviceUrl || !token || !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(serviceUrl)) return "blocked";
  try {
    const response = await fetch(`${serviceUrl}/health`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return "blocked";
    const payload = await response.json() as Record<string, unknown>;
    if (payload.status !== "ready" || payload.service !== "music-e2e-state") return "blocked";
    return exactDurableGuard(payload.mutationGuard) ?? "blocked";
  } catch { return "blocked"; }
}

async function blockDurableMusicMutations(reason: string, stage: string): Promise<void> {
  if (process.env.MUSIC_E2E_LIVE_WRITE !== "true") return;
  const serviceUrl = process.env.MUSIC_E2E_STATE_SERVICE_URL;
  const token = process.env.MUSIC_E2E_STATE_TOKEN;
  if (!serviceUrl || !token) return;
  try {
    await fetch(`${serviceUrl}/block`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ reason, stage }), signal: AbortSignal.timeout(5_000),
    });
  } catch { /* a local fixed latch still fails this worker closed */ }
}

export function resetMusicRestoreBlockForContractTest(): void {
  liveMutationBlockedReason = null;
}

export async function runAuthorizedMusicMutation<T>(
  authorityInput: Parameters<typeof assertLiveWriteAuthority>[0],
  callsite: MusicMutationCallsite,
  mutation: () => Promise<T>,
): Promise<T> {
  if (liveMutationBlockedReason) {
    throw new Error(`Live Music mutations are blocked after a restoration failure: ${liveMutationBlockedReason}`);
  }
  const authority = assertLiveWriteAuthority(authorityInput);
  if (!authority.callsites.includes(callsite)) throw new Error(`Unknown Music mutation callsite: ${callsite}`);
  if (await durableMusicMutationState() !== "clear") throw new Error("MUSIC_MUTATION_BLOCKED");
  return mutation();
}

export function musicLiveAuthorityFromEnvironment(
  environment: Record<string, string | undefined> = process.env,
): Parameters<typeof assertLiveWriteAuthority>[0] {
  const serviceOrigins = (environment.MUSIC_E2E_SERVICE_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return {
    lane: resolveMusicTestLane(environment),
    liveWriteEnabled: environment.MUSIC_E2E_LIVE_WRITE === "true",
    baseUrl: environment.PLAYWRIGHT_EXTERNAL_BASE_URL ?? "",
    serviceOrigins,
    accountDocumentId: environment.MUSIC_E2E_ACCOUNT_DOCUMENT_ID ?? "",
    accountUsername: environment.MUSIC_E2E_ACCOUNT_USERNAME ?? "",
    fixtureVersion: environment.MUSIC_E2E_FIXTURE_VERSION ?? "",
    confirmation: environment.MUSIC_E2E_LIVE_WRITE_CONFIRMATION,
  };
}

export function musicLiveWriteSkipReason(environment: Record<string, string | undefined> = process.env): string | null {
  try {
    assertLiveWriteAuthority(musicLiveAuthorityFromEnvironment(environment));
    musicLiveStrapiTokenFromEnvironment(environment);
    return null;
  } catch (error) {
    return `live mutation skipped: ${error instanceof Error ? error.message : "authority unavailable"}`;
  }
}

export function musicLiveStrapiTokenFromEnvironment(
  environment: Record<string, string | undefined> = process.env,
): string {
  // Validate the complete disposable live tuple before reading callback
  // authority. PR-safe collection therefore never needs or fabricates it.
  assertLiveWriteAuthority(musicLiveAuthorityFromEnvironment(environment));
  const token = environment.MUSIC_E2E_STRAPI_TOKEN;
  if (typeof token !== "string" || token.length < 16 || /\s/.test(token)) {
    throw new Error("MUSIC_E2E_STRAPI_TOKEN is required after complete disposable live authority");
  }
  return token;
}

export const musicLiveTest = base.extend<{
  musicLiveAuthority: ReturnType<typeof assertLiveWriteAuthority>;
}>({
  musicLiveAuthority: [async ({ browserName }, use, testInfo) => {
    void browserName;
    const reason = musicLiveWriteSkipReason();
    testInfo.skip(Boolean(reason), reason ?? "Complete disposable live-write authority is required.");
    const authority = assertLiveWriteAuthority(musicLiveAuthorityFromEnvironment());
    await use(authority);
  }, { auto: true }],
});

export function buildPermissionMatrix(): MusicPermissionRow[] {
  return Array.from({ length: 32 }, (_, mask) => {
    const bits = mask.toString(2).padStart(5, "0");
    return {
      key: bits,
      allowSongRequests: bits[0] === "1",
      allowGuestPlayOnDevice: bits[1] === "1",
      allowPlaylistSharing: bits[2] === "1",
      allowRecentlyPlayedVisibility: bits[3] === "1",
      allowQueueVisibility: bits[4] === "1",
    };
  });
}

export function buildPairwisePermissionMatrix(): MusicPermissionRow[] {
  const keys = ["allowSongRequests", "allowGuestPlayOnDevice", "allowPlaylistSharing", "allowRecentlyPlayedVisibility", "allowQueueVisibility"] as const;
  const uncovered = new Set<string>();
  for (let left = 0; left < keys.length; left += 1) for (let right = left + 1; right < keys.length; right += 1) {
    for (const a of [false, true]) for (const b of [false, true]) uncovered.add(`${left}:${a}-${right}:${b}`);
  }
  const selected: MusicPermissionRow[] = [];
  for (const row of buildPermissionMatrix()) {
    const covers: string[] = [];
    for (let left = 0; left < keys.length; left += 1) for (let right = left + 1; right < keys.length; right += 1) {
      covers.push(`${left}:${row[keys[left]!]}-${right}:${row[keys[right]!]}`);
    }
    if (covers.some((pair) => uncovered.has(pair))) {
      selected.push(row);
      covers.forEach((pair) => uncovered.delete(pair));
    }
    if (uncovered.size === 0) break;
  }
  if (uncovered.size > 0) throw new Error(`Pairwise Music permission matrix is incomplete: ${[...uncovered].join(",")}`);
  return selected;
}

const VOLATILE_SNAPSHOT_KEYS = new Set(["capturedAt", "requestId", "snapshotId", "updatedAt", "createdAt", "revision", "queueRevision", "playbackRevision", "preferenceRevision"]);

function canonicalSnapshotValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalSnapshotValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !VOLATILE_SNAPSHOT_KEYS.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalSnapshotValue(nested)]),
  );
}

export function normalizedSnapshotHash(snapshot: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalSnapshotValue(snapshot))).digest("hex");
}

export const MUSIC_LIVE_ACCOUNT_SNAPSHOT_VERSION = "music-live-account-snapshot/v1" as const;

export interface CanonicalMusicAccountSnapshot {
  version: typeof MUSIC_LIVE_ACCOUNT_SNAPSHOT_VERSION;
  snapshotId: string;
  publication: { coveredByDatabaseDump: true };
  guestControls: { coveredByDatabaseDump: true };
  queue: { coveredByDatabaseDump: true };
  playlists: { coveredByDatabaseDump: true };
  requests: { coveredByDatabaseDump: true };
  profile: { accountDocumentId: string; publicMusic: boolean; preferenceRevision: number; preferenceHash: string };
  database: { namespace: string; dumpHash: string };
}

function requiredRecord(source: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = source[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`canonical Music snapshot requires ${key}`);
  return value as Record<string, unknown>;
}

export function assertCanonicalMusicAccountSnapshot(value: unknown): asserts value is CanonicalMusicAccountSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("canonical Music snapshot is missing");
  const source = value as Record<string, unknown>;
  if (source.version !== MUSIC_LIVE_ACCOUNT_SNAPSHOT_VERSION) throw new Error("canonical Music snapshot version is invalid");
  if (typeof source.snapshotId !== "string" || !source.snapshotId) throw new Error("canonical Music snapshot requires a restore identifier");
  const publication = requiredRecord(source, "publication");
  if (publication.coveredByDatabaseDump !== true) {
    throw new Error("canonical Music snapshot requires complete publication lifecycle state");
  }
  if (requiredRecord(source, "guestControls").coveredByDatabaseDump !== true) throw new Error("canonical Music snapshot requires guest controls in the full database dump");
  const queue = requiredRecord(source, "queue");
  if (queue.coveredByDatabaseDump !== true) {
    throw new Error("canonical Music snapshot requires queue, player, and history state");
  }
  if (requiredRecord(source, "playlists").coveredByDatabaseDump !== true) throw new Error("canonical Music snapshot requires playlists in the full database dump");
  const requests = requiredRecord(source, "requests");
  if (requests.coveredByDatabaseDump !== true) {
    throw new Error("canonical Music snapshot requires requests, idempotency receipts, and rate state in the full database dump");
  }
  const profile = requiredRecord(source, "profile");
  if (typeof profile.accountDocumentId !== "string" || typeof profile.publicMusic !== "boolean"
      || !Number.isSafeInteger(profile.preferenceRevision) || !/^[a-f0-9]{64}$/.test(String(profile.preferenceHash))) {
    throw new Error("canonical Music snapshot requires Strapi public_music profile preference state");
  }
  const database = requiredRecord(source, "database");
  if (typeof database.namespace !== "string" || !/^e2e-public-music-[a-z0-9-]+$/.test(database.namespace)
      || !/^[a-f0-9]{64}$/.test(String(database.dumpHash))) {
    throw new Error("canonical Music snapshot requires the complete disposable database namespace");
  }
}

export function createCanonicalMusicFixtureAdapter(dependencies: {
  readFullSnapshot: () => Promise<unknown>;
  resetNamespace: (snapshot: CanonicalMusicAccountSnapshot) => Promise<void>;
}) {
  return {
    snapshot: async (): Promise<CanonicalMusicAccountSnapshot> => {
      const snapshot = await dependencies.readFullSnapshot();
      assertCanonicalMusicAccountSnapshot(snapshot);
      return snapshot;
    },
    cleanupNamespace: async (): Promise<void> => undefined,
    restore: async (snapshot: unknown): Promise<void> => {
      assertCanonicalMusicAccountSnapshot(snapshot);
      await dependencies.resetNamespace(snapshot);
    },
  };
}

export function canonicalMusicFixtureAdapterFromEnvironment() {
  const serviceUrl = process.env.MUSIC_E2E_STATE_SERVICE_URL;
  const token = process.env.MUSIC_E2E_STATE_TOKEN;
  if (!serviceUrl || !token || !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(serviceUrl)) {
    throw new Error("canonical Music state service authority is unavailable");
  }
  const call = async (path: "/snapshot" | "/restore", body?: unknown) => {
    const response = await fetch(`${serviceUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`canonical Music state service failed ${path}: ${response.status}`);
    return response.json();
  };
  return createCanonicalMusicFixtureAdapter({
    readFullSnapshot: () => call("/snapshot"),
    resetNamespace: async (snapshot) => { await call("/restore", snapshot); },
  });
}

function sanitizedUrl(raw: string): string {
  const url = new URL(raw);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/capability|token|credential|authorization/i.test(key)) url.searchParams.delete(key);
  }
  return url.toString().replace(/\/$/, "");
}

export function buildSanitizedFixtureEvidence(input: {
  runId: string;
  lane: MusicTestLane;
  accountDocumentId: string;
  username: string;
  explorerUrl: string;
  shareUrl: string;
  result: "passed" | "failed" | "skipped";
  cleanup: "restored" | "failed" | "not-required";
  evidencePath: string;
}) {
  return {
    version: MUSIC_PUBLIC_FIXTURE_VERSION,
    runId: input.runId.replace(/[^a-zA-Z0-9_-]/g, "-"),
    lane: input.lane,
    accountDocumentId: input.accountDocumentId,
    username: input.username,
    explorerUrl: sanitizedUrl(input.explorerUrl),
    shareUrl: sanitizedUrl(input.shareUrl),
    result: input.result,
    cleanup: input.cleanup,
    evidencePath: input.evidencePath.replace(/\\/g, "/"),
  } as const;
}

export async function withRestoredMusicFixture<T>(adapters: {
  journeyId?: string;
  snapshot: () => Promise<unknown>;
  cleanupNamespace: () => Promise<void>;
  restore: (snapshot: unknown) => Promise<void>;
  writeRecoveryArtifact?: (artifact: { reason: string; beforeHash: string; afterHash?: string }) => Promise<void>;
  writeJourneyResult?: (record: unknown) => Promise<void>;
}, journey: () => Promise<T>): Promise<{
  value: T;
  cleanup: "restored";
  beforeHash: string;
  afterHash: string;
}> {
  const live = process.env.MUSIC_E2E_LIVE_WRITE === "true";
  if (live) {
    const { journeyId, writeJourneyResult } = adapters;
    adapters = { ...canonicalMusicFixtureAdapterFromEnvironment(), journeyId, writeJourneyResult };
  }
  const before = await adapters.snapshot();
  const beforeHash = normalizedSnapshotHash(before);
  const writeRecoveryArtifact = async (artifact: { reason: string; beforeHash: string; afterHash?: string }) => {
    if (adapters.writeRecoveryArtifact) return adapters.writeRecoveryArtifact(artifact);
    if (live) {
      const stage = artifact.reason === "restore-mismatch" ? "verification"
        : (artifact.reason === "cleanup-failed" ? "cleanup" : "restore");
      await blockDurableMusicMutations(artifact.reason, stage);
      return;
    }
    const recoveryPath = process.env.MUSIC_E2E_RECOVERY_ARTIFACT_PATH
      ?? `.artifacts/music-public/recovery-${process.pid}.json`;
    mkdirSync(dirname(recoveryPath), { recursive: true });
    writeFileSync(recoveryPath, `${JSON.stringify({ version: MUSIC_PUBLIC_FIXTURE_VERSION, ...artifact }, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  };
  let value!: T;
  let journeyFailure: unknown;
  let restorationFailure: unknown;
  let terminalWritten = false;
  const writeTerminal = async (record: unknown) => {
    if (terminalWritten) throw new Error("Live journey terminal already written");
    terminalWritten = true;
    const restoreEvidencePath = process.env.MUSIC_E2E_RESTORE_EVIDENCE_PATH;
    if (adapters.writeJourneyResult) await adapters.writeJourneyResult(record);
    else if (restoreEvidencePath) {
      mkdirSync(dirname(restoreEvidencePath), { recursive: true });
      appendFileSync(restoreEvidencePath, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
    } else if (live && adapters.journeyId) {
      throw new Error("MUSIC_E2E_RESTORE_EVIDENCE_PATH is required for manifested live journeys");
    }
  };
  try {
    value = await journey();
  } catch (error) {
    journeyFailure = error;
  } finally {
    let cleanupFailure: unknown;
    try {
      await adapters.cleanupNamespace();
    } catch (error) {
      cleanupFailure = error;
    }
    try {
      await adapters.restore(before);
    } catch (restoreError) {
      liveMutationBlockedReason = "restore-failed";
      await writeRecoveryArtifact({ reason: "restore-failed", beforeHash });
      restorationFailure = restoreError;
    }
    if (!restorationFailure && cleanupFailure) {
      liveMutationBlockedReason = "cleanup-failed";
      await writeRecoveryArtifact({ reason: "cleanup-failed", beforeHash });
      restorationFailure = cleanupFailure;
    }
  }
  if (restorationFailure) {
    if (adapters.journeyId) await writeTerminal(buildLiveJourneyTerminal({
      id: adapters.journeyId,
      status: "failed",
      reason: liveMutationBlockedReason === "cleanup-failed" ? "cleanup-failed" : "restore-failed",
      stage: liveMutationBlockedReason === "cleanup-failed" ? "cleanup" : "restore",
      cleanup: "failed",
      beforeHash,
    }));
    throw restorationFailure;
  }
  let afterHash: string;
  try {
    afterHash = normalizedSnapshotHash(await adapters.snapshot());
  } catch (verificationError) {
    liveMutationBlockedReason = "restore-failed";
    await writeRecoveryArtifact({ reason: "restore-failed", beforeHash });
    if (adapters.journeyId) await writeTerminal(buildLiveJourneyTerminal({
      id: adapters.journeyId, status: "failed", reason: "restore-failed", stage: "restore",
      cleanup: "failed", beforeHash,
    }));
    throw verificationError;
  }
  if (afterHash !== beforeHash) {
    liveMutationBlockedReason = "restore-mismatch";
    await writeRecoveryArtifact({ reason: "restore-mismatch", beforeHash, afterHash });
    if (adapters.journeyId) await writeTerminal(buildLiveJourneyTerminal({
      id: adapters.journeyId, status: "failed", reason: "restore-mismatch", stage: "verification",
      cleanup: "failed", beforeHash, afterHash,
    }));
    throw new Error(`Public Music fixture restoration mismatch: before=${beforeHash} after=${afterHash}`);
  }
  if (journeyFailure) {
    if (adapters.journeyId) await writeTerminal(buildLiveJourneyTerminal({
      id: adapters.journeyId, status: "failed", reason: "body-failed", stage: "body",
      cleanup: "restored", beforeHash, afterHash,
    }));
    throw journeyFailure;
  }
  if (adapters.journeyId) {
    const record = buildLiveJourneyResult({ id: adapters.journeyId, beforeHash, afterHash });
    await writeTerminal(record);
  }
  return { value, cleanup: "restored", beforeHash, afterHash };
}

export const completeMusicAccount = {
  __typename: "Account",
  documentId: "account-document-qualification",
  Account_Name: "Qualification Fixture",
  Account_Type: "Personal",
  mobile_number: "+15555550123",
  profile_picture: null,
  public_recommendations: "No",
  public_music: "No",
  public_guides: "No",
  public_movie: "No",
  public_books: "No",
  public_games: "No",
  public_apps: "No",
  public_products: "No",
  public_people: "No",
  pinned_nav_tabs: [],
  auto_pinning: true,
};

export interface MusicQualificationMockOptions {
  provider?: "local" | "google";
  confirmed?: boolean;
  accounts?: Array<Record<string, unknown>>;
  ensureStatus?: number;
  ensureCode?: string;
  ensureFailures?: number;
  playlists?: Array<Record<string, unknown>>;
  ownerExpiredFailures?: number;
  holdEnsure?: boolean;
  ownerWorkspace?: boolean;
}

export async function installMusicQualificationMocks(page: Page, options: MusicQualificationMockOptions = {}) {
  const canonicalMusicPath = (rawUrl: string) => new URL(rawUrl).pathname.replace(/^\/__localtunes(?=\/api\/)/, "");
  let ensureCalls = 0;
  let strapiCalls = 0;
  let playlists = (options.playlists ?? []).map((playlist) => ({ ...playlist }));
  let publicationMode: "private" | "unlisted" | "public" = "private";
  const publicationCommands: Array<{ body: { mode: string }; idempotencyKey: string | null }> = [];
  const requests: Array<{
    method: string;
    path: string;
    authorization: string | undefined;
    xUsername: string | undefined;
    body?: unknown;
    idempotencyKey?: string;
  }> = [];
  const credential = "fixture-browser-initial-music-credential";
  const renewedCredential = "fixture-browser-renewed-music-credential";
  let markEnsureStarted!: () => void;
  const ensureStarted = new Promise<void>((resolveStarted) => { markEnsureStarted = resolveStarted; });
  let releaseHeldEnsure!: () => void;
  const heldEnsure = new Promise<void>((resolveHeld) => { releaseHeldEnsure = resolveHeld; });

  await page.route("**/graphql", async (route) => {
    strapiCalls += 1;
    const payload = route.request().postDataJSON();
    const query = payload?.query ?? "";
    if (query.includes("usersPermissionsUser")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { usersPermissionsUser: {
          __typename: "UsersPermissionsUser",
          documentId: "mock-user-123",
          username: "testuser",
          email: "test@explorers.earth",
          razorpay_customer_id: null,
          provider: options.provider ?? "local",
          confirmed: options.confirmed ?? true,
          blocked: false,
          accounts: options.accounts ?? [completeMusicAccount],
        } } }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {} }) });
  });

  await page.route("**/api/music/identity/ensure", async (route) => {
    ensureCalls += 1;
    markEnsureStarted();
    requests.push({
      method: route.request().method(),
      path: canonicalMusicPath(route.request().url()),
      authorization: route.request().headers().authorization,
      xUsername: route.request().headers()["x-username"],
    });
    if (options.holdEnsure) await heldEnsure;
    if (ensureCalls <= (options.ensureFailures ?? 0) || (options.ensureStatus ?? 200) !== 200) {
      await route.fulfill({
        status: options.ensureStatus ?? 503,
        contentType: "application/json",
        headers: { "retry-after": "1" },
        body: JSON.stringify({
          version: "music-error/v1",
          error: {
            code: options.ensureCode ?? "UPSTREAM_UNAVAILABLE",
            message: "Contained fixture failure.",
            action: "retry",
            retryable: (options.ensureStatus ?? 503) >= 500,
            requestId: "qualification-request",
          },
        }),
      });
      return;
    }
    try {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          credential: {
            token: (options.ownerExpiredFailures ?? 0) > 0 && ensureCalls > 1
              ? renewedCredential
              : credential,
            expiresAt: Date.now() + 600_000,
          },
        }),
      });
    } catch {
      if (!page.isClosed()) throw new Error("identity ensure fulfillment failed before browser exit");
    }
  });

  await page.route("**/api/playlists", async (route) => {
    requests.push({
      method: route.request().method(),
      path: canonicalMusicPath(route.request().url()),
      authorization: route.request().headers().authorization,
      xUsername: route.request().headers()["x-username"],
    });
    if (route.request().method() === "GET") {
      if (
        (options.ownerExpiredFailures ?? 0) > 0
        && route.request().headers().authorization !== `Bearer ${renewedCredential}`
      ) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ version: "music-error/v1", error: { code: "TOKEN_EXPIRED", retryable: false } }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(playlists) });
      return;
    }
    const created = { id: 99, name: "Qualification playlist", description: null, isVisibleToGuests: false, songs: [] };
    playlists = [...playlists, created];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(created) });
  });
  await page.route("**/api/music/dashboard", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      queueRevision: 0,
      songs: [],
      currentlyPlaying: null,
      playedSongs: [],
      publication: { mode: publicationMode, publicSlug: "qualification-public" },
      guestControls: { allowSongRequests: false, allowGuestPlayOnDevice: false, allowPlaylistSharing: false, allowRecentlyPlayedVisibility: false, allowQueueVisibility: false },
    }),
  }));
  await page.route("**/api/music/entitlement", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ state: "included", coreRead: true, coreMutation: true, paidMutation: false, maxAgeSeconds: 600 }),
  }));
  await page.route("**/api/music/features", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ownerWorkspace: options.ownerWorkspace ?? false,
      guestWorkspace: false,
      playlistImports: false,
      exposureId: "qualification-exposure",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    }),
  }));
  await page.route("**/api/music/publication", async (route) => {
    const body = route.request().postDataJSON() as { mode: string };
    publicationCommands.push({
      body,
      idempotencyKey: route.request().headers()["idempotency-key"] ?? null,
    });
    if (["private", "unlisted", "public"].includes(body.mode)) {
      publicationMode = body.mode as typeof publicationMode;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: "music-publication/v1",
        publication: { mode: body.mode, publicSlug: "qualification-public" },
        ...(body.mode === "unlisted" ? { capability: "A".repeat(43) } : {}),
      }),
    });
  });
  await page.route("**/api/music/guest-controls", async (route) => {
    const body = route.request().postDataJSON();
    requests.push({
      method: route.request().method(),
      path: canonicalMusicPath(route.request().url()),
      authorization: route.request().headers().authorization,
      xUsername: route.request().headers()["x-username"],
      body,
      idempotencyKey: route.request().headers()["idempotency-key"],
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.route("**/api/playlists/*", async (route) => {
    const path = canonicalMusicPath(route.request().url());
    const body = route.request().postDataJSON();
    requests.push({
      method: route.request().method(),
      path,
      authorization: route.request().headers().authorization,
      xUsername: route.request().headers()["x-username"],
      body,
      idempotencyKey: route.request().headers()["idempotency-key"],
    });
    const match = path.match(/^\/api\/playlists\/(\d+)$/);
    if (route.request().method() === "PATCH" && match) {
      const id = Number(match[1]);
      const existing = playlists.find((playlist) => playlist.id === id);
      const renamed = { ...existing, ...(body as Record<string, unknown>), id };
      playlists = playlists.map((playlist) => playlist.id === id ? renamed : playlist);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(renamed) });
      return;
    }
    await route.fulfill({ status: 204 });
  });

  return {
    ensureCalls: () => ensureCalls,
    strapiCalls: () => strapiCalls,
    requests,
    credential,
    renewedCredential,
    publicationCommands,
    publicationMode: () => publicationMode,
    ensureStarted: () => ensureStarted,
    releaseEnsure: () => releaseHeldEnsure(),
  };
}
