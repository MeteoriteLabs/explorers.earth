import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const fixtureOrigin = "http://localhost:55173";

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
    pinned_nav_tabs: ["recommendations", "books", "music"], auto_pinning: false, recommendation_lists: [], profile_picture: null,
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
      const cleared = await page.request.post(`${fixtureOrigin}/api/music/queue/replace`, {
        headers: mutationHeaders(credential), data: { expectedRevision: state.queueRevision, songs: [] },
      });
      expect(cleared.status(), "fixture queue cleanup").toBe(200);
    }
    if (state.playlistId) {
      const deleted = await page.request.delete(`${fixtureOrigin}/api/playlists/${state.playlistId}`, {
        headers: mutationHeaders(credential),
      });
      expect(deleted.status(), "fixture contract playlist cleanup").toBe(204);
    }
    if (state.initialControls) {
      const restored = await page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, {
        headers: mutationHeaders(credential), data: state.initialControls,
      });
      expect(restored.status(), "fixture guest-control cleanup").toBe(200);
    }
    const privatePublication = await page.request.post(`${fixtureOrigin}/api/music/publication`, {
      headers: publicationHeaders(credential), data: { mode: "private" },
    });
    expect(privatePublication.status(), "fixture publication cleanup").toBe(200);
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
      process.env.PLAYWRIGHT_EXTERNAL_BASE_URL !== fixtureOrigin || process.env.MUSIC_E2E_LIVE_WRITE !== "true",
      "requires authorized disposable Music live-write fixture and exact snapshot restoration",
    );
    const credential = await authenticateOwner(page);
    const initialResponse = await page.request.get(`${fixtureOrigin}/api/music/guest-controls`, { headers: { Authorization: credential } });
    expect(initialResponse.status()).toBe(200);
    const initial = await initialResponse.json() as GuestControls;
    ownerState(page).initialControls = initial;
    const toggled = { ...initial, [control]: !initial[control] };
    const guest = await browser.newContext();
    try {
      const changed = await page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, { headers: mutationHeaders(credential), data: toggled });
      expect(changed.status()).toBe(200);
      const observed = await page.request.get(`${fixtureOrigin}/api/music/guest-controls`, { headers: { Authorization: credential } });
      expect(await observed.json()).toMatchObject({ [control]: toggled[control] });
      const guestPage = await guest.newPage();
      await guestPage.goto(`${fixtureOrigin}/music/share/qualification-public`);
      await expect(guestPage.locator("body")).toBeVisible();
    } finally {
      await guest.close();
      const restored = await page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, { headers: mutationHeaders(credential), data: initial });
      expect(restored.status()).toBe(200);
      const after = await page.request.get(`${fixtureOrigin}/api/music/guest-controls`, { headers: { Authorization: credential } });
      expect(await after.json()).toEqual(initial);
      ownerState(page).initialControls = undefined;
    }
  });
}

test("live guest reconnect refetches canonical state after transport interruption", async ({ page, context }) => {
  test.skip(
    process.env.PLAYWRIGHT_EXTERNAL_BASE_URL !== fixtureOrigin || process.env.MUSIC_E2E_LIVE_WRITE !== "true",
    "requires authorized disposable Music fixture socket, interruption, and canonical refetch",
  );
  await page.goto("/music/share/qualification-public");
  await expect(page.getByRole("heading", { name: "Music", level: 1 })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText(/reconnecting/i)).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText(/reconnecting/i)).toBeHidden();
  await expect(page.getByRole("heading", { name: "Music", level: 1 })).toBeVisible();
});

test("owner publication, playlist visibility, and playlist-sharing settings persist and control fixture public access", async ({ page }) => {
  test.skip(
    process.env.PLAYWRIGHT_EXTERNAL_BASE_URL !== fixtureOrigin,
    "requires the disposable integrated Music fixture; PR-safe execution has no live-write authority",
  );
  const credential = await authenticateOwner(page);
  const initialControlsResponse = await page.request.get(`${fixtureOrigin}/api/music/guest-controls`, {
    headers: { Authorization: credential },
  });
  expect(initialControlsResponse.status()).toBe(200);
  ownerState(page).initialControls = await initialControlsResponse.json() as GuestControls;

  const name = `Fixture public contract ${randomUUID().slice(0, 8)}`;
  const created = await page.request.post(`${fixtureOrigin}/api/playlists`, {
    headers: mutationHeaders(credential), data: { name, description: "Real fixture exposure matrix" },
  });
  expect(created.status()).toBe(201);
  const playlist = await created.json() as { id: number };
  ownerState(page).playlistId = playlist.id;

  const addedSong = await page.request.post(`${fixtureOrigin}/api/playlists/${playlist.id}/songs`, {
    headers: mutationHeaders(credential),
    data: { youtubeId: "abcdefghijk", title: "Fixture public song", artist: "Fixture artist", thumbnailUrl: `${fixtureOrigin}/images/tuneslogo.png` },
  });
  expect(addedSong.status()).toBe(201);
  const savedSong = await addedSong.json() as { id: number };

  const dashboard = await page.request.get(`${fixtureOrigin}/api/music/dashboard`, {
    headers: { Authorization: credential },
  });
  expect(dashboard.status()).toBe(200);
  const queued = await page.request.post(`${fixtureOrigin}/api/music/queue/replace`, {
    headers: mutationHeaders(credential),
    data: { expectedRevision: (await dashboard.json() as { queueRevision: number }).queueRevision, songs: [{ playlistId: playlist.id, songId: savedSong.id }] },
  });
  expect(queued.status(), "queue an owner saved song for the public visibility contract").toBe(200);
  ownerState(page).queueRevision = (await queued.json() as { revision: number }).revision;

  const visible = await page.request.patch(`${fixtureOrigin}/api/playlists/${playlist.id}/visibility`, {
    headers: mutationHeaders(credential), data: { isVisibleToGuests: true },
  });
  expect(visible.status()).toBe(204);
  const sharingEnabled: GuestControls = { ...ownerState(page).initialControls!, allowPlaylistSharing: true };
  const enabled = await page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, {
    headers: mutationHeaders(credential), data: sharingEnabled,
  });
  expect(enabled.status()).toBe(200);

  const madePublic = await page.request.post(`${fixtureOrigin}/api/music/publication`, {
    headers: publicationHeaders(credential), data: { mode: "public" },
  });
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
  const enabledQueue = await page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, {
    headers: mutationHeaders(credential), data: queueEnabled,
  });
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

  const hidden = await page.request.patch(`${fixtureOrigin}/api/playlists/${playlist.id}/visibility`, {
    headers: mutationHeaders(credential), data: { isVisibleToGuests: false },
  });
  expect(hidden.status()).toBe(204);
  const publicHiddenPlaylist = await publicResource(page, publicCommand.publication.publicSlug);
  expect(publicHiddenPlaylist.status()).toBe(200);
  expect((await publicHiddenPlaylist.json() as { playlists: Array<{ id: number }> }).playlists).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: playlist.id })]));

  const visibleAgain = await page.request.patch(`${fixtureOrigin}/api/playlists/${playlist.id}/visibility`, {
    headers: mutationHeaders(credential), data: { isVisibleToGuests: true },
  });
  expect(visibleAgain.status()).toBe(204);
  const sharingDisabled: GuestControls = { ...queueEnabled, allowPlaylistSharing: false };
  const disabled = await page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, {
    headers: mutationHeaders(credential), data: sharingDisabled,
  });
  expect(disabled.status()).toBe(200);
  const publicSharingDisabled = await publicResource(page, publicCommand.publication.publicSlug);
  expect(publicSharingDisabled.status()).toBe(200);
  expect((await publicSharingDisabled.json() as { playlists: unknown[] }).playlists).toEqual([]);

  const sharingRestored = await page.request.patch(`${fixtureOrigin}/api/music/guest-controls`, {
    headers: mutationHeaders(credential), data: queueEnabled,
  });
  expect(sharingRestored.status()).toBe(200);
  await page.goto("/recommendations/music");
  await expect(page.getByRole("switch", { name: `Make ${name} private` })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("tab", { name: "Live", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Show shared playlists" })).toHaveAttribute("aria-checked", "true");

  const madeUnlisted = await page.request.post(`${fixtureOrigin}/api/music/publication`, {
    headers: publicationHeaders(credential), data: { mode: "unlisted" },
  });
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

  const madePrivate = await page.request.post(`${fixtureOrigin}/api/music/publication`, {
    headers: publicationHeaders(credential), data: { mode: "private" },
  });
  expect(madePrivate.status()).toBe(200);
  expect((await publicResource(page, publicCommand.publication.publicSlug, unlistedCommand.capability)).status(), "private workspaces never expose public resources").toBe(404);
});
