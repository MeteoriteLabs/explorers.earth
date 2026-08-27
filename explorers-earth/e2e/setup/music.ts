import type { Page } from "@playwright/test";

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
      path: new URL(route.request().url()).pathname,
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
      path: new URL(route.request().url()).pathname,
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
      guestControls: { allowSongRequests: false, allowGuestPlayOnDevice: false, allowPlaylistSharing: false, allowRecentlyPlayedVisibility: false },
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
      path: new URL(route.request().url()).pathname,
      authorization: route.request().headers().authorization,
      xUsername: route.request().headers()["x-username"],
      body,
      idempotencyKey: route.request().headers()["idempotency-key"],
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.route("**/api/playlists/*", async (route) => {
    const path = new URL(route.request().url()).pathname;
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
