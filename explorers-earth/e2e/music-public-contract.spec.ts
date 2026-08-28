import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  musicLiveAuthorityFromEnvironment,
  buildPairwisePermissionMatrix,
  musicLiveWriteSkipReason,
  runAuthorizedMusicMutation,
  withRestoredMusicFixture,
  type MusicMutationCallsite,
} from "./setup/music";

const fixtureOrigin = "http://localhost:55173";
const liveSkipReason = musicLiveWriteSkipReason();

function guardedMutation<T>(callsite: MusicMutationCallsite, mutation: () => Promise<T>): Promise<T> {
  return runAuthorizedMusicMutation(musicLiveAuthorityFromEnvironment(), callsite, mutation);
}

const publicResourceFixture = {
  version: "music-public-resource/v1",
  revision: 7,
  user: { username: "fixture-owner", venueName: "Fixture Venue" },
  permissions: {
    allowSongRequests: true,
    allowGuestPlayOnDevice: false,
    allowPlaylistSharing: true,
    allowRecentlyPlayedVisibility: true,
    allowQueueVisibility: true,
  },
  currentlyPlaying: { id: "P".repeat(43), youtubeId: "abcdefghijk", title: "Playing now", artist: "Fixture artist", thumbnailUrl: null, position: 0, status: "playing", playedAt: null },
  queue: { items: [{ id: "Q".repeat(43), youtubeId: "lmnopqrstuv", title: "Queued song", artist: "Fixture artist", thumbnailUrl: null, position: 1, status: "queued", playedAt: null }], total: 1, truncated: false },
  recentlyPlayed: { items: [], total: 0, truncated: false },
  playlists: { items: [], total: 0, truncated: false },
};

async function installFriendlyMusicFixture(page: Page, options: {
  profileMusic: boolean;
  descriptor: "available" | "missing" | "outage";
  preset?: string;
  wallpaperMode?: string;
  failedImage?: boolean;
}) {
  let descriptorRequests = 0;
  const account = {
    __typename: "Account", documentId: "fixture-account", Account_Name: "Fixture Explorer", Account_Type: "personal",
    Primary_Address: { address: "Fixture City" }, Bio: "Friendly Music fixture", Feed_Data: [], Public_Profile_Address: null,
    mobile_number: null, mobile_number_visibility: false, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    public_profile: "Yes", public_recommendations: "Yes", public_music: options.profileMusic ? "Yes" : "No",
    public_books: "Yes", public_guides: "No", public_movie: "No", public_games: "No", public_apps: "No", public_products: "No", public_people: "No",
    pinned_nav_tabs: ["public_music"], auto_pinning: false, recommendation_lists: [], profile_picture: null,
    bg_picture: options.failedImage ? { url: "/missing-fixture-image.png", alternativeText: "Missing fixture" } : null,
    social_media: { theme_settings: { preset: options.preset ?? "minimal-light", wallpaperMode: options.wallpaperMode ?? "solid-color", accentColor: "#2563eb", landingTab: "music", visibleTabs: { recommendations: true, gallery: false, business: false }, footerBranding: "disabled", recommendations: { layout: "grid", categoryOrder: [] } } },
  };
  await page.route("**/graphql", async (route) => {
    const body = route.request().postDataJSON() as { operationName?: string; query?: string };
    const operation = body.operationName ?? body.query?.match(/(?:query|mutation)\s+(\w+)/)?.[1] ?? "Unknown";
    const data = operation === "CheckUsername"
      ? { accounts: [{ documentId: account.documentId, Account_Name: account.Account_Name }] }
      : operation.startsWith("AccountByUsername")
        ? { usersPermissionsUsers: [{ documentId: "fixture-user", username: "fixture-owner", accounts: [account] }] }
        : operation === "PublicCategoryListCounts"
          ? { recommendationLists: [{ documentId: "visible" }], bookLists: [{ documentId: "visible" }], movieLists: [], gameLists: [], appLists: [], productLists: [], personLists: [], guides: [] }
          : { accounts: [account] };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data }) });
  });
  await page.route("**/api/music/public-profile/fixture-account", async (route) => {
    descriptorRequests += 1;
    if (options.descriptor === "outage") return route.fulfill({ status: 503, body: "unavailable" });
    if (options.descriptor === "missing") return route.fulfill({ status: 404, body: "not found" });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ version: "music-public-descriptor/v1", publication: { mode: "public", publicSlug: "public_slug-123", revision: 7 } }) });
  });
  await page.route("**/api/music/public-resource/v1/public_slug-123", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(publicResourceFixture) }));
  await page.route("**/socket.io/**", (route) => route.abort());
  return { descriptorRequests: () => descriptorRequests };
}

test.describe("PR-safe direct public Music routes", () => {
  test("pairwise permission matrix changes each concrete guest surface", async ({ page }) => {
    await page.route("**/socket.io/**", (route) => route.abort());
    for (const row of buildPairwisePermissionMatrix()) {
      const { key: _key, ...permissions } = row;
      await page.unroute("**/api/music/public-resource/v1/public_slug-123");
      await page.route("**/api/music/public-resource/v1/public_slug-123", (route) => route.fulfill({
        status: 200, contentType: "application/json", body: JSON.stringify({
          ...publicResourceFixture,
          permissions,
          currentlyPlaying: row.allowQueueVisibility || row.allowGuestPlayOnDevice ? publicResourceFixture.currentlyPlaying : null,
          queue: row.allowQueueVisibility ? publicResourceFixture.queue : { items: [], total: 0, truncated: false },
          recentlyPlayed: row.allowRecentlyPlayedVisibility ? {
            items: [{ ...publicResourceFixture.queue.items[0], id: "H".repeat(43), status: "played", playedAt: "2026-08-28T00:00:00.000Z" }], total: 1, truncated: false,
          } : { items: [], total: 0, truncated: false },
          playlists: row.allowPlaylistSharing ? {
            items: [{ id: "L".repeat(43), name: "Matrix playlist", description: null, songs: { items: [], total: 0, truncated: false } }], total: 1, truncated: false,
          } : { items: [], total: 0, truncated: false },
        }),
      }));
      await page.goto(`/music/share/public_slug-123?matrix=${row.key}`);
      const effects = [
        [row.allowSongRequests, page.getByRole("region", { name: "Request a song" })],
        [row.allowQueueVisibility, page.getByRole("region", { name: "Up next" })],
        [row.allowPlaylistSharing, page.getByRole("region", { name: "Shared playlists" })],
        [row.allowRecentlyPlayedVisibility, page.getByRole("region", { name: "Recently played" })],
      ] as const;
      for (const [enabled, locator] of effects) {
        if (enabled) await expect(locator, `row ${row.key}`).toBeVisible();
        else await expect(locator, `row ${row.key}`).toHaveCount(0);
      }
      const playControl = page.getByRole("button", { name: /play .*device/i });
      if (row.allowGuestPlayOnDevice) await expect(playControl.first(), `row ${row.key}`).toBeVisible();
      else await expect(playControl, `row ${row.key}`).toHaveCount(0);
    }
  });

  test("first-view fallback selects the first permitted content and then the explicit empty state", async ({ page }) => {
    let empty = false;
    await page.route("**/api/music/public-resource/v1/public_slug-123", (route) => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify(empty ? {
        ...publicResourceFixture,
        permissions: { allowSongRequests: false, allowGuestPlayOnDevice: false, allowPlaylistSharing: false, allowRecentlyPlayedVisibility: false, allowQueueVisibility: false },
        currentlyPlaying: null, queue: { items: [], total: 0, truncated: false }, recentlyPlayed: { items: [], total: 0, truncated: false }, playlists: { items: [], total: 0, truncated: false },
      } : {
        ...publicResourceFixture,
        permissions: { allowSongRequests: false, allowGuestPlayOnDevice: false, allowPlaylistSharing: false, allowRecentlyPlayedVisibility: true, allowQueueVisibility: false },
        currentlyPlaying: null, queue: { items: [], total: 0, truncated: false },
        recentlyPlayed: { items: [{ ...publicResourceFixture.queue.items[0], id: "H".repeat(43), status: "played", playedAt: "2026-08-28T00:00:00.000Z" }], total: 1, truncated: false },
        playlists: { items: [], total: 0, truncated: false },
      }),
    }));
    await page.route("**/socket.io/**", (route) => route.abort());
    await page.goto("/music/share/public_slug-123");
    await expect(page.getByRole("region", { name: "Recently played" })).toBeVisible();
    empty = true;
    await page.reload();
    await expect(page.getByText("Nothing has been shared here yet")).toBeVisible();
  });

  test("public and unlisted shares preserve canonical and capability privacy", async ({ page }) => {
    const capabilities: Array<string | undefined> = [];
    await page.route("**/api/music/public-resource/v1/public_slug-123", async (route) => {
      capabilities.push(route.request().headers()["x-music-guest-capability"]);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(publicResourceFixture) });
    });
    await page.route("**/socket.io/**", (route) => route.abort());

    await page.goto("/music/share/public_slug-123");
    await expect(page.getByRole("heading", { name: "Music", level: 1 })).toBeVisible();
    await expect(page.getByText("Queued song")).toBeVisible();
    await expect(page.locator('link[rel="canonical"][data-rh="true"]')).toHaveAttribute("href", /\/music\/share\/public_slug-123$/);

    const capability = "A".repeat(43);
    await page.goto(`/music/share/public_slug-123#access=${capability}`);
    await expect(page).toHaveURL(/\/music\/share\/public_slug-123$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    expect(capabilities).toContain(capability);
    expect(await page.content()).not.toContain(capability);
  });

  test("public and unlisted caches stay isolated and invalid capabilities recover generically", async ({ page }) => {
    const valid = "V".repeat(43);
    await page.route("**/api/music/public-resource/v1/**", (route) => {
      const capability = route.request().headers()["x-music-guest-capability"];
      if (capability && capability !== valid) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ version: "music-error/v1", error: { code: "PUBLIC_NOT_FOUND", message: "Unavailable", action: "none", retryable: false, requestId: "fixture" } }) });
      const title = capability === valid ? "Unlisted-only queue song" : "Public-only queue song";
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        ...publicResourceFixture,
        queue: { items: [{ ...publicResourceFixture.queue.items[0], title }], total: 1, truncated: false },
      }) });
    });
    await page.route("**/socket.io/**", (route) => route.abort());
    await page.goto("/music/share/public_slug-456");
    await expect(page.getByText("Public-only queue song")).toBeVisible();
    await page.goto(`/music/share/public_slug-123#access=${"X".repeat(43)}`);
    await expect(page.getByText(/unavailable|not found/i).first()).toBeVisible();
    await expect(page.getByText("Public-only queue song")).toHaveCount(0);
    await page.goto(`/music/share/public_slug-123#access=${valid}`);
    await expect(page.getByText("Unlisted-only queue song")).toBeVisible();
    await page.goto("/music/share/public_slug-456");
    await expect(page.getByText("Public-only queue song")).toBeVisible();
    await expect(page.getByText("Unlisted-only queue song")).toHaveCount(0);
  });

  test("invalid, private, and unavailable resources converge on generic recovery", async ({ page }) => {
    await page.route("**/api/music/public-resource/v1/**", (route) => route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ version: "music-error/v1", error: { code: "PUBLIC_NOT_FOUND", message: "Unavailable", action: "retry", retryable: false, requestId: "fixture" } }),
    }));
    await page.goto("/music/share/private_slug-123");
    await expect(page.getByText(/unavailable|not found/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /retry/i })).toBeVisible();
  });

  for (const viewport of [
    { width: 320, height: 700 },
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    test(`accessible public structure reflows at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.route("**/api/music/public-resource/v1/public_slug-123", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(publicResourceFixture) }));
      await page.route("**/socket.io/**", (route) => route.abort());
      await page.goto("/music/share/public_slug-123");
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1, name: "Music" })).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      const input = page.getByRole("textbox", { name: /search for a song/i });
      expect(parseFloat(await input.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
      for (const control of await page.locator("main button, main input, main a").all()) {
        if (!(await control.isVisible())) continue;
        const box = await control.boundingBox();
        expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(44);
      }
      const last = page.locator("main button, main input, main a").last();
      await last.scrollIntoViewIfNeeded();
      const lastBox = await last.boundingBox();
      expect((lastBox?.y ?? 0) + (lastBox?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
      const audit = await new AxeBuilder({ page }).include("main").analyze();
      expect(audit.violations).toEqual([]);
      if (viewport.width === 320) {
        await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      }
    });
  }
});

test.describe("PR-safe friendly public Music routes", () => {
  test("friendly route resolves one stable Account descriptor and shares canonical content", async ({ page }) => {
    const fixture = await installFriendlyMusicFixture(page, { profileMusic: true, descriptor: "available" });
    await page.goto("/fixture-owner/music");
    await expect(page.getByRole("heading", { name: "Music", level: 1 })).toBeVisible();
    await expect(page.getByText("Queued song")).toBeVisible();
    await expect(page.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/fixture-owner");
    await expect(page.locator('link[rel="canonical"][data-rh="true"]')).toHaveAttribute("href", /\/music\/share\/public_slug-123$/);
    expect(fixture.descriptorRequests()).toBe(1);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Music", level: 1 })).toBeVisible();
  });

  test("friendly Music navigation preserves history, current-page semantics, heading order, and announcements", async ({ page }) => {
    await installFriendlyMusicFixture(page, { profileMusic: true, descriptor: "available" });
    await page.goto("/fixture-owner/music");
    await expect(page.getByRole("heading", { name: "Music", level: 1 })).toBeVisible();
    await expect(page.locator('a[aria-current="page"]')).toContainText(/music/i);
    const levels = await page.locator("main h1, main h2, main h3, main h4, main h5, main h6").evaluateAll((nodes) => nodes.map((node) => Number(node.tagName.slice(1))));
    expect(levels[0]).toBe(1);
    expect(levels.every((level, index) => index === 0 || level <= levels[index - 1]! + 1)).toBe(true);
    await expect(page.locator('[role="status"], [aria-live="polite"], [aria-live="assertive"]').first()).toBeAttached();
    await page.getByRole("link", { name: "Profile" }).click();
    await expect(page).toHaveURL(/\/fixture-owner$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/fixture-owner\/music$/);
    await expect(page.getByRole("heading", { name: "Music", level: 1 })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/fixture-owner$/);
  });

  test("wrong username and descriptor outage use non-enumerating recovery", async ({ page }) => {
    await page.route("**/graphql", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { accounts: [], usersPermissionsUsers: [] } }) }));
    await page.goto("/definitely-wrong-music-owner/music");
    await expect(page.getByText(/unavailable|not found|not shared/i).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/account document|private|suspended|tombstone/i);
  });

  for (const row of [
    { profileMusic: true, descriptor: "missing" as const },
    { profileMusic: true, descriptor: "outage" as const },
    { profileMusic: false, descriptor: "available" as const },
  ]) {
    test(`explicit friendly recovery: preference=${row.profileMusic} descriptor=${row.descriptor}`, async ({ page }) => {
      await installFriendlyMusicFixture(page, row);
      await page.goto("/fixture-owner/music");
      await expect(page.getByText(/unavailable|not shared|not found/i).first()).toBeVisible();
      await expect(page.getByRole("link", { name: /return to profile/i }).or(page.getByRole("button", { name: /retry/i })).first()).toBeVisible();
    });
  }

  for (const visual of [
    { name: "dark-banner-full-content", width: 390, height: 844, preset: "dark", wallpaperMode: "banner-top" },
    { name: "minimal-light-solid", width: 390, height: 844, preset: "minimal-light", wallpaperMode: "solid-color" },
    { name: "failed-image-fallback", width: 390, height: 844, preset: "dark", wallpaperMode: "banner-top", failedImage: true },
    { name: "mobile-reconnecting", width: 375, height: 667, preset: "dark", wallpaperMode: "ambient-gradient" },
    { name: "320-long-nav-stress", width: 320, height: 700, preset: "minimal-light", wallpaperMode: "solid-color" },
    { name: "desktop-full-content", width: 1440, height: 900, preset: "dark", wallpaperMode: "full-wallpaper-image" },
  ]) {
    test(`visual baseline ${visual.name}`, async ({ page }) => {
      await page.setViewportSize({ width: visual.width, height: visual.height });
      await installFriendlyMusicFixture(page, { profileMusic: true, descriptor: "available", ...visual });
      await page.goto("/fixture-owner/music");
      await expect(page.getByText("Queued song")).toBeVisible();
      await expect(page.locator("main")).toHaveScreenshot(`${visual.name}.png`, {
        animations: "disabled",
        maxDiffPixelRatio: 0.03,
        mask: [page.locator("img"), page.locator("iframe")],
      });
    });
  }
});

type GuestControls = {
  allowSongRequests: boolean;
  allowGuestPlayOnDevice: boolean;
  allowPlaylistSharing: boolean;
  allowRecentlyPlayedVisibility: boolean;
  allowQueueVisibility: boolean;
};

type OwnerState = {
  credential?: string;
  initialControls?: GuestControls;
  initialPublicationMode?: "private" | "unlisted" | "public";
  playlistId?: number;
  queueRevision?: number;
};

const ownerStates = new WeakMap<Page, OwnerState>();

function ownerState(page: Page): OwnerState {
  const state = ownerStates.get(page);
  if (!state) throw new Error("fixture owner state was not initialized");
  return state;
}

function mutationHeaders(credential: string, key = `music-contract-${randomUUID()}`): Record<string, string> {
  return { Authorization: credential, Origin: fixtureOrigin, "Idempotency-Key": key };
}

function publicationHeaders(credential: string): Record<string, string> {
  return mutationHeaders(credential, `tunes-share-v1-${Date.now()}-${randomUUID()}`);
}

async function authenticateOwner(page: Page): Promise<string> {
  await page.goto("/google-auth/callback?access_token=fixture-read-only-token");
  await expect(page.getByText("Login successful! Redirecting...")).toBeVisible();
  await page.goto("/recommendations/music");
  await expect(page.getByRole("tab", { name: "Playlists", exact: true })).toHaveAttribute("aria-selected", "true");
  const credential = ownerState(page).credential;
  expect(credential, "the fixture must mint an owner Music credential after Explorer login").toMatch(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  return credential!;
}

async function publicResource(page: Page, publicSlug: string, capability?: string) {
  return page.request.get(`${fixtureOrigin}/api/playlist/${publicSlug}`, {
    headers: capability ? { "X-Music-Guest-Capability": capability } : undefined,
  });
}

test.beforeEach(async ({ page }) => {
  ownerStates.set(page, {});
  page.on("request", (request) => {
    const url = new URL(request.url());
    const authorization = request.headers().authorization;
    if (url.origin === fixtureOrigin
      && authorization?.startsWith("Bearer ")
      && authorization !== "Bearer fixture-read-only-token"
      && ["/api/music/dashboard", "/api/playlists", "/api/music/guest-controls"].includes(url.pathname)) {
      ownerState(page).credential = authorization;
    }
  });
});

test.afterEach(async ({ page }, testInfo) => {
  const state = ownerStates.get(page);
  try {
    if (!state?.credential) return;
    const credential = state.credential;
    if (state.queueRevision !== undefined) {
      const cleared = await guardedMutation("queue-replace", () => page.request.post(`${fixtureOrigin}/api/music/queue/replace`, {
        headers: mutationHeaders(credential), data: { expectedRevision: state.queueRevision, songs: [] },
      }));
      expect(cleared.status(), "fixture queue cleanup").toBe(200);
    }
    if (state.playlistId) {
      const deleted = await guardedMutation("playlist-delete", () => page.request.delete(`${fixtureOrigin}/api/playlists/${state.playlistId}`, {
        headers: mutationHeaders(credential),
      }));
      expect(deleted.status(), "fixture contract playlist cleanup").toBe(204);
    }
    if (state.initialControls) {
      const restored = await guardedMutation("guest-controls", () => page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, {
        headers: mutationHeaders(credential), data: state.initialControls,
      }));
      expect(restored.status(), "fixture guest-control cleanup").toBe(200);
    }
    if (state.initialPublicationMode) {
      const restoredPublication = await guardedMutation("owner-publication", () => page.request.post(`${fixtureOrigin}/api/music/publication`, {
        headers: publicationHeaders(credential), data: { mode: state.initialPublicationMode },
      }));
      expect(restoredPublication.status(), "fixture publication exact-state cleanup").toBe(200);
    }
  } finally {
    ownerStates.delete(page);
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach("public-contract-fixture", { body: await page.screenshot(), contentType: "image/png" });
    }
  }
});

for (const control of [
  "allowSongRequests",
  "allowGuestPlayOnDevice",
  "allowPlaylistSharing",
  "allowRecentlyPlayedVisibility",
  "allowQueueVisibility",
] as const) {
  test(`live owner/guest toggle ${control} restores the exact permission snapshot`, async ({ page, browser }) => {
    test.skip(
      Boolean(liveSkipReason),
      liveSkipReason ?? "authorized disposable Music live-write fixture",
    );
    const credential = await authenticateOwner(page);
    const initialResponse = await page.request.get(`${fixtureOrigin}/api/music/guest-controls`, { headers: { Authorization: credential } });
    expect(initialResponse.status()).toBe(200);
    const initial = await initialResponse.json() as GuestControls;
    const toggled = { ...initial, [control]: !initial[control] };
    const guest = await browser.newContext();
    try {
      await withRestoredMusicFixture({
        snapshot: async () => (await page.request.get(`${fixtureOrigin}/api/music/guest-controls`, { headers: { Authorization: credential } })).json(),
        cleanupNamespace: async () => undefined,
        restore: async (snapshot) => {
          const restored = await guardedMutation("guest-controls", () => page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, { headers: mutationHeaders(credential), data: snapshot }));
          expect(restored.status()).toBe(200);
        },
      }, async () => {
        const changed = await guardedMutation("guest-controls", () => page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, { headers: mutationHeaders(credential), data: toggled }));
        expect(changed.status()).toBe(200);
        const observed = await page.request.get(`${fixtureOrigin}/api/music/guest-controls`, { headers: { Authorization: credential } });
        expect(await observed.json()).toMatchObject({ [control]: toggled[control] });
        const guestPage = await guest.newPage();
        await guestPage.goto(`${fixtureOrigin}/music/share/qualification-public`);
        const guestEffect = control === "allowSongRequests"
          ? guestPage.getByRole("textbox", { name: /search for a song/i })
          : control === "allowGuestPlayOnDevice"
            ? guestPage.getByRole("button", { name: /play .*device/i })
            : control === "allowPlaylistSharing"
              ? guestPage.getByRole("heading", { name: /playlists/i })
              : control === "allowRecentlyPlayedVisibility"
                ? guestPage.getByRole("heading", { name: /recently played/i })
                : guestPage.getByRole("heading", { name: /queue/i });
        if (toggled[control]) await expect(guestEffect.first(), `${control} exposes its guest control`).toBeVisible();
        else await expect(guestEffect, `${control} hides its guest control`).toHaveCount(0);
      });
    } finally {
      await guest.close();
      const after = await page.request.get(`${fixtureOrigin}/api/music/guest-controls`, { headers: { Authorization: credential } });
      expect(await after.json()).toEqual(initial);
    }
  });
}

test("live guest reconnect refetches canonical state after transport interruption", async ({ page, context }) => {
  test.skip(
    Boolean(liveSkipReason),
    liveSkipReason ?? "authorized disposable Music fixture socket",
  );
  await page.goto("/music/share/qualification-public");
  await expect(page.getByRole("heading", { name: "Music", level: 1 })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText(/reconnecting/i)).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText(/reconnecting/i)).toBeHidden();
  await expect(page.getByRole("heading", { name: "Music", level: 1 })).toBeVisible();
});

test("live guest request accepts once, replays, conflicts, rate-limits, and owner revokes it", async ({ page }) => {
  test.skip(Boolean(liveSkipReason), liveSkipReason ?? "authorized guest request fixture");
  const credential = await authenticateOwner(page);
  let originalSongIds = new Set<number>();
  await withRestoredMusicFixture({
    snapshot: async () => {
      const [dashboard, controls] = await Promise.all([
        page.request.get(`${fixtureOrigin}/api/music/dashboard`, { headers: { Authorization: credential } }),
        page.request.get(`${fixtureOrigin}/api/music/guest-controls`, { headers: { Authorization: credential } }),
      ]);
      const dashboardBody = await dashboard.json() as { songs: Array<{ id: number }>; publication: unknown };
      originalSongIds = new Set(dashboardBody.songs.map(({ id }) => id));
      return { publication: dashboardBody.publication, permissions: await controls.json(), queue: dashboardBody.songs, playlists: [], requests: [] };
    },
    cleanupNamespace: async () => {
      const dashboard = await page.request.get(`${fixtureOrigin}/api/music/dashboard`, { headers: { Authorization: credential } });
      for (const song of (await dashboard.json() as { songs: Array<{ id: number }> }).songs.filter(({ id }) => !originalSongIds.has(id))) {
        const removed = await guardedMutation("request-revoke", () => page.request.delete(`${fixtureOrigin}/api/playlist/songs/${song.id}`, { headers: mutationHeaders(credential) }));
        expect(removed.status()).toBe(204);
      }
    },
    restore: async (snapshot) => {
      const before = snapshot as { publication: { mode: "private" | "unlisted" | "public" }; permissions: GuestControls };
      const controls = await guardedMutation("guest-controls", () => page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, { headers: mutationHeaders(credential), data: before.permissions }));
      expect(controls.status()).toBe(200);
      const publicationRestore = await guardedMutation("owner-publication", () => page.request.post(`${fixtureOrigin}/api/music/publication`, { headers: publicationHeaders(credential), data: { mode: before.publication.mode } }));
      expect(publicationRestore.status()).toBe(200);
    },
  }, async () => {
  const publication = await guardedMutation("owner-publication", () => page.request.post(`${fixtureOrigin}/api/music/publication`, {
    headers: publicationHeaders(credential), data: { mode: "public" },
  }));
  const publicSlug = (await publication.json() as { publication: { publicSlug: string } }).publication.publicSlug;
  const requestKey = `guest-request-${randomUUID()}`;
  const song = { youtubeId: "abcdefghijk", title: "Requested fixture song", artist: "Fixture artist", thumbnailUrl: `${fixtureOrigin}/images/tuneslogo.png` };
  const accepted = await guardedMutation("song-request", () => page.request.post(`${fixtureOrigin}/api/playlist/${publicSlug}/requests`, {
    headers: { Origin: fixtureOrigin, "Idempotency-Key": requestKey }, data: song,
  }));
  expect(accepted.status()).toBe(201);
  const replay = await guardedMutation("song-request", () => page.request.post(`${fixtureOrigin}/api/playlist/${publicSlug}/requests`, {
    headers: { Origin: fixtureOrigin, "Idempotency-Key": requestKey }, data: song,
  }));
  expect(replay.status()).toBe(201);
  const conflict = await guardedMutation("song-request", () => page.request.post(`${fixtureOrigin}/api/playlist/${publicSlug}/requests`, {
    headers: { Origin: fixtureOrigin, "Idempotency-Key": requestKey }, data: { ...song, title: "Different payload" },
  }));
  expect(conflict.status()).toBe(409);
  let rateLimited = false;
  for (let index = 0; index < 70 && !rateLimited; index += 1) {
    const response = await guardedMutation("song-request", () => page.request.post(`${fixtureOrigin}/api/playlist/${publicSlug}/requests`, {
      headers: { Origin: fixtureOrigin, "Idempotency-Key": `rate-${index}-${randomUUID()}` }, data: song,
    }));
    rateLimited = response.status() === 429;
  }
  expect(rateLimited).toBe(true);
  const dashboard = await page.request.get(`${fixtureOrigin}/api/music/dashboard`, { headers: { Authorization: credential } });
  const requested = (await dashboard.json() as { songs: Array<{ id: number; title: string }> }).songs.find(({ title }) => title === song.title);
  expect(requested).toBeDefined();
  const revoked = await guardedMutation("request-revoke", () => page.request.delete(`${fixtureOrigin}/api/playlist/songs/${requested!.id}`, { headers: mutationHeaders(credential) }));
  expect(revoked.status()).toBe(204);
  });
});

test("live guest playback remains isolated while queue and player revisions refetch", async ({ page, browser }) => {
  test.skip(Boolean(liveSkipReason), liveSkipReason ?? "authorized guest playback fixture");
  const ownerCredential = await authenticateOwner(page);
  const guestA = await browser.newContext();
  const guestB = await browser.newContext();
  try {
    await withRestoredMusicFixture({
      snapshot: async () => {
        const dashboard = await page.request.get(`${fixtureOrigin}/api/music/dashboard`, { headers: { Authorization: ownerCredential } });
        const body = await dashboard.json() as Record<string, unknown>;
        return { publication: body.publication, permissions: body.guestControls, queue: body.songs, playlists: [], requests: [], currentlyPlaying: body.currentlyPlaying };
      },
      cleanupNamespace: async () => undefined,
      restore: async (snapshot) => {
        const before = snapshot as { currentlyPlaying: { id: number } | null };
        const dashboard = await page.request.get(`${fixtureOrigin}/api/music/dashboard`, { headers: { Authorization: ownerCredential } });
        const current = await dashboard.json() as { queueRevision: number; playbackRevision?: number };
        const restored = await guardedMutation("player-update", () => page.request.post(`${fixtureOrigin}/api/playlist/currently-playing`, {
          headers: mutationHeaders(ownerCredential), data: { songId: before.currentlyPlaying?.id ?? null, expectedRevision: current.queueRevision, expectedPlaybackRevision: current.playbackRevision ?? 0 },
        }));
        expect([200, 204]).toContain(restored.status());
      },
    }, async () => {
    const a = await guestA.newPage();
    const b = await guestB.newPage();
    await Promise.all([a.goto(`${fixtureOrigin}/music/share/qualification-public`), b.goto(`${fixtureOrigin}/music/share/qualification-public`)]);
    const before = await page.request.get(`${fixtureOrigin}/api/music/dashboard`, { headers: { Authorization: ownerCredential } });
    const beforeRevision = (await before.json() as { queueRevision: number }).queueRevision;
    await runAuthorizedMusicMutation(musicLiveAuthorityFromEnvironment(), "guest-playback", async () => {
      await a.getByRole("button", { name: /play .*device/i }).first().click();
    });
    await expect.poll(async () => {
      const current = await page.request.get(`${fixtureOrigin}/api/music/dashboard`, { headers: { Authorization: ownerCredential } });
      return (await current.json() as { queueRevision: number }).queueRevision;
    }).toBeGreaterThanOrEqual(beforeRevision);
    await expect(b.locator("body")).not.toContainText(/credential|authorization|bearer/i);
    });
  } finally {
    await guestA.close();
    await guestB.close();
  }
});

test("owner publication, playlist visibility, and playlist-sharing settings persist and control fixture public access", async ({ page }) => {
  test.skip(
    Boolean(liveSkipReason),
    liveSkipReason ?? "authorized disposable integrated Music fixture",
  );
  const credential = await authenticateOwner(page);
  const initialDashboardResponse = await page.request.get(`${fixtureOrigin}/api/music/dashboard`, { headers: { Authorization: credential } });
  expect(initialDashboardResponse.status()).toBe(200);
  const initialDashboard = await initialDashboardResponse.json() as { publication: { mode: "private" | "unlisted" | "public" } };
  ownerState(page).initialPublicationMode = initialDashboard.publication.mode;
  const initialControlsResponse = await page.request.get(`${fixtureOrigin}/api/music/guest-controls`, {
    headers: { Authorization: credential },
  });
  expect(initialControlsResponse.status()).toBe(200);
  ownerState(page).initialControls = await initialControlsResponse.json() as GuestControls;

  await withRestoredMusicFixture({
    snapshot: async () => {
      const [dashboardResponse, controlsResponse, playlistsResponse] = await Promise.all([
        page.request.get(`${fixtureOrigin}/api/music/dashboard`, { headers: { Authorization: credential } }),
        page.request.get(`${fixtureOrigin}/api/music/guest-controls`, { headers: { Authorization: credential } }),
        page.request.get(`${fixtureOrigin}/api/playlists`, { headers: { Authorization: credential } }),
      ]);
      const dashboardSnapshot = await dashboardResponse.json() as { publication: unknown; songs?: unknown[] };
      return {
        publication: dashboardSnapshot.publication,
        permissions: await controlsResponse.json(),
        queue: dashboardSnapshot.songs ?? [],
        playlists: await playlistsResponse.json(),
        requests: [],
        profilePreference: "unchanged-by-this-journey",
      };
    },
    cleanupNamespace: async () => {
      const state = ownerState(page);
      if (state.playlistId) {
        const deleted = await guardedMutation("playlist-delete", () => page.request.delete(`${fixtureOrigin}/api/playlists/${state.playlistId}`, { headers: mutationHeaders(credential) }));
        expect(deleted.status()).toBe(204);
        state.playlistId = undefined;
      }
    },
    restore: async (snapshot) => {
      const before = snapshot as { publication: { mode: "private" | "unlisted" | "public" }; permissions: GuestControls; queue: unknown[] };
      if (before.queue.length !== 0) throw new Error("Dedicated Music E2E account must start with an empty queue for exact restoration");
      const currentDashboardResponse = await page.request.get(`${fixtureOrigin}/api/music/dashboard`, { headers: { Authorization: credential } });
      const currentRevision = (await currentDashboardResponse.json() as { queueRevision: number }).queueRevision;
      const queue = await guardedMutation("queue-replace", () => page.request.post(`${fixtureOrigin}/api/music/queue/replace`, { headers: mutationHeaders(credential), data: { expectedRevision: currentRevision, songs: [] } }));
      expect(queue.status()).toBe(200);
      const controls = await guardedMutation("guest-controls", () => page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, { headers: mutationHeaders(credential), data: before.permissions }));
      expect(controls.status()).toBe(200);
      const publication = await guardedMutation("owner-publication", () => page.request.post(`${fixtureOrigin}/api/music/publication`, { headers: publicationHeaders(credential), data: { mode: before.publication.mode } }));
      expect(publication.status()).toBe(200);
      const state = ownerState(page);
      state.queueRevision = undefined;
      state.initialControls = undefined;
      state.initialPublicationMode = undefined;
    },
  }, async () => {

  const name = `Fixture public contract ${randomUUID().slice(0, 8)}`;
  const created = await guardedMutation("playlist-create", () => page.request.post(`${fixtureOrigin}/api/playlists`, {
    headers: mutationHeaders(credential), data: { name, description: "Real fixture exposure matrix" },
  }));
  expect(created.status()).toBe(201);
  const playlist = await created.json() as { id: number };
  ownerState(page).playlistId = playlist.id;

  const addedSong = await guardedMutation("playlist-song-add", () => page.request.post(`${fixtureOrigin}/api/playlists/${playlist.id}/songs`, {
    headers: mutationHeaders(credential),
    data: { youtubeId: "abcdefghijk", title: "Fixture public song", artist: "Fixture artist", thumbnailUrl: `${fixtureOrigin}/images/tuneslogo.png` },
  }));
  expect(addedSong.status()).toBe(201);
  const savedSong = await addedSong.json() as { id: number };

  const dashboard = await page.request.get(`${fixtureOrigin}/api/music/dashboard`, {
    headers: { Authorization: credential },
  });
  expect(dashboard.status()).toBe(200);
  const dashboardRevision = (await dashboard.json() as { queueRevision: number }).queueRevision;
  const queued = await guardedMutation("queue-replace", () => page.request.post(`${fixtureOrigin}/api/music/queue/replace`, {
    headers: mutationHeaders(credential),
    data: { expectedRevision: dashboardRevision, songs: [{ playlistId: playlist.id, songId: savedSong.id }] },
  }));
  expect(queued.status(), "queue an owner saved song for the public visibility contract").toBe(200);
  ownerState(page).queueRevision = (await queued.json() as { revision: number }).revision;

  const visible = await guardedMutation("playlist-visibility", () => page.request.patch(`${fixtureOrigin}/api/playlists/${playlist.id}/visibility`, {
    headers: mutationHeaders(credential), data: { isVisibleToGuests: true },
  }));
  expect(visible.status()).toBe(204);
  const sharingEnabled: GuestControls = { ...ownerState(page).initialControls!, allowPlaylistSharing: true };
  const enabled = await guardedMutation("guest-controls", () => page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, {
    headers: mutationHeaders(credential), data: sharingEnabled,
  }));
  expect(enabled.status()).toBe(200);

  const madePublic = await guardedMutation("owner-publication", () => page.request.post(`${fixtureOrigin}/api/music/publication`, {
    headers: publicationHeaders(credential), data: { mode: "public" },
  }));
  expect(madePublic.status()).toBe(200);
  const publicCommand = await madePublic.json() as { publication: { mode: string; publicSlug: string } };
  expect(publicCommand.publication.mode).toBe("public");

  const publicVisible = await publicResource(page, publicCommand.publication.publicSlug);
  expect(publicVisible.status(), "public workspace exposes a visible playlist when sharing is enabled").toBe(200);
  const publicVisibleBody = await publicVisible.json() as { playlists: Array<{ id: number; songs: Array<{ title: string }> }>; user: { allowPlaylistSharing: boolean } };
  expect(publicVisibleBody.user.allowPlaylistSharing).toBe(true);
  expect(publicVisibleBody.playlists).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: playlist.id, songs: [expect.objectContaining({ title: "Fixture public song" })] }),
  ]));
  expect(publicVisibleBody).toMatchObject({ songs: [], currentlyPlaying: null, allowQueueVisibility: false, user: { allowQueueVisibility: false } });

  const queueEnabled: GuestControls = { ...sharingEnabled, allowQueueVisibility: true };
  const enabledQueue = await guardedMutation("guest-controls", () => page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, {
    headers: mutationHeaders(credential), data: queueEnabled,
  }));
  expect(enabledQueue.status()).toBe(200);
  const publicQueueEnabled = await publicResource(page, publicCommand.publication.publicSlug);
  expect(publicQueueEnabled.status()).toBe(200);
  expect(await publicQueueEnabled.json()).toMatchObject({
    songs: [expect.objectContaining({ id: expect.any(Number), title: "Fixture public song" })],
    allowQueueVisibility: true,
    user: { allowQueueVisibility: true },
  });

  await page.goto("/recommendations/music");
  await expect(page.getByRole("switch", { name: `Make ${name} private` })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("tab", { name: "Live", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Show shared playlists" })).toHaveAttribute("aria-checked", "true");

  const hidden = await guardedMutation("playlist-visibility", () => page.request.patch(`${fixtureOrigin}/api/playlists/${playlist.id}/visibility`, {
    headers: mutationHeaders(credential), data: { isVisibleToGuests: false },
  }));
  expect(hidden.status()).toBe(204);
  const publicHiddenPlaylist = await publicResource(page, publicCommand.publication.publicSlug);
  expect(publicHiddenPlaylist.status()).toBe(200);
  expect((await publicHiddenPlaylist.json() as { playlists: Array<{ id: number }> }).playlists).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: playlist.id })]));

  const visibleAgain = await guardedMutation("playlist-visibility", () => page.request.patch(`${fixtureOrigin}/api/playlists/${playlist.id}/visibility`, {
    headers: mutationHeaders(credential), data: { isVisibleToGuests: true },
  }));
  expect(visibleAgain.status()).toBe(204);
  const sharingDisabled: GuestControls = { ...queueEnabled, allowPlaylistSharing: false };
  const disabled = await guardedMutation("guest-controls", () => page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, {
    headers: mutationHeaders(credential), data: sharingDisabled,
  }));
  expect(disabled.status()).toBe(200);
  const publicSharingDisabled = await publicResource(page, publicCommand.publication.publicSlug);
  expect(publicSharingDisabled.status()).toBe(200);
  expect((await publicSharingDisabled.json() as { playlists: unknown[] }).playlists).toEqual([]);

  const sharingRestored = await guardedMutation("guest-controls", () => page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, {
    headers: mutationHeaders(credential), data: queueEnabled,
  }));
  expect(sharingRestored.status()).toBe(200);
  await page.goto("/recommendations/music");
  await expect(page.getByRole("switch", { name: `Make ${name} private` })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("tab", { name: "Live", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Show shared playlists" })).toHaveAttribute("aria-checked", "true");

  const madeUnlisted = await guardedMutation("owner-publication", () => page.request.post(`${fixtureOrigin}/api/music/publication`, {
    headers: publicationHeaders(credential), data: { mode: "unlisted" },
  }));
  expect(madeUnlisted.status()).toBe(200);
  const unlistedCommand = await madeUnlisted.json() as { publication: { mode: string; publicSlug: string }; capability: string };
  expect(unlistedCommand.publication).toMatchObject({ mode: "unlisted", publicSlug: publicCommand.publication.publicSlug });
  expect(unlistedCommand.capability).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect((await publicResource(page, unlistedCommand.publication.publicSlug)).status(), "unlisted access without its fragment capability").toBe(404);
  const unlistedResource = await publicResource(page, unlistedCommand.publication.publicSlug, unlistedCommand.capability);
  expect(unlistedResource.status(), "unlisted access with its fragment capability").toBe(200);
  expect(unlistedResource.headers()["x-robots-tag"]).toBe("noindex, nofollow");

  await page.goto(`/music/share/${unlistedCommand.publication.publicSlug}#access=${unlistedCommand.capability}`);
  await expect(page.getByRole("heading", { name })).toBeVisible();

  const madePrivate = await guardedMutation("owner-publication", () => page.request.post(`${fixtureOrigin}/api/music/publication`, {
    headers: publicationHeaders(credential), data: { mode: "private" },
  }));
  expect(madePrivate.status()).toBe(200);
  expect((await publicResource(page, publicCommand.publication.publicSlug, unlistedCommand.capability)).status(), "private workspaces never expose public resources").toBe(404);
  });
});
