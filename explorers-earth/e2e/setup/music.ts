import type { Page } from "@playwright/test";
import { createHash } from "node:crypto";

export const MUSIC_PUBLIC_FIXTURE_VERSION = "music-public-e2e-fixture/v1" as const;

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
  baseUrl: string;
  accountUsername: string;
  confirmation: string | undefined;
}): { authorized: true; namespace: string } {
  if (input.lane === "pr-safe") throw new Error("PR-safe lane cannot acquire live-write authority");
  if (input.lane !== "live") throw new Error("Live writes require the live lane");
  if (input.confirmation !== "I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE") {
    throw new Error("Live writes require the exact disposable-fixture confirmation");
  }
  const url = new URL(input.baseUrl);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("Live writes require a disposable loopback target");
  }
  const match = input.accountUsername.match(/^(e2e-public-music-[a-z0-9-]+)-owner$/);
  if (!match) throw new Error("Live writes require a namespaced disposable account");
  return { authorized: true, namespace: match[1] };
}

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

const VOLATILE_SNAPSHOT_KEYS = new Set(["capturedAt", "requestId", "updatedAt", "createdAt"]);

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
  snapshot: () => Promise<unknown>;
  cleanupNamespace: () => Promise<void>;
  restore: (snapshot: unknown) => Promise<void>;
}, journey: () => Promise<T>): Promise<{
  value: T;
  cleanup: "restored";
  beforeHash: string;
  afterHash: string;
}> {
  const before = await adapters.snapshot();
  const beforeHash = normalizedSnapshotHash(before);
  let value!: T;
  let journeyFailure: unknown;
  try {
    value = await journey();
  } catch (error) {
    journeyFailure = error;
  } finally {
    await adapters.cleanupNamespace();
    await adapters.restore(before);
  }
  const afterHash = normalizedSnapshotHash(await adapters.snapshot());
  if (afterHash !== beforeHash) {
    throw new Error(`Public Music fixture restoration mismatch: before=${beforeHash} after=${afterHash}`);
  }
  if (journeyFailure) throw journeyFailure;
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
