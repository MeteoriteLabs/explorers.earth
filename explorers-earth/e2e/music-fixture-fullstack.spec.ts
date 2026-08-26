import { expect, test } from "@playwright/test";

const fixtureUser = {
  id: "fixture-user-document-id",
  documentId: "fixture-user-document-id",
  username: "fixture-explorer",
  email: "fixture-explorer@example.invalid",
  blocked: false,
};
const fixtureVideos = [
  { id: { videoId: "abcdefghijk" }, snippet: { title: "UAT First song", channelTitle: "Fixture artist", thumbnails: { default: { url: "https://img.example/first.jpg" } } } },
  { id: { videoId: "lmnopqrstuv" }, snippet: { title: "UAT Second song", channelTitle: "Fixture artist", thumbnails: { default: { url: "https://img.example/second.jpg" } } } },
];

test.beforeEach(async ({ context }) => {
  await context.route("**/api/users/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(fixtureUser),
  }));
  await context.route("**/graphql", async (route) => {
    const query = route.request().postDataJSON()?.query ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: query.includes("usersPermissionsUser") ? {
          usersPermissionsUser: {
            __typename: "UsersPermissionsUser",
            ...fixtureUser,
            provider: "google",
            confirmed: true,
            accounts: [{
              __typename: "Account",
              documentId: "fixture-account-document-id",
              Account_Name: "Fixture Explorer",
              Account_Type: "Personal",
              mobile_number: "+10000000000",
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
            }],
          },
        } : {},
      }),
    });
  });
  await context.route("https://music-fixture.invalid/**", async (route) => {
    const upstream = new URL(route.request().url());
    if (upstream.pathname === "/api/youtube/search") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: fixtureVideos, nextPageToken: null }) });
      return;
    }
    const response = await route.fetch({ url: `http://127.0.0.1:55000${upstream.pathname}${upstream.search}` });
    await route.fulfill({ response });
  });
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    await testInfo.attach("sanitized-fixture-page", { body: await page.screenshot(), contentType: "image/png" });
  }
});

test("actual Google callback reaches real Tunes, fixture Strapi, and PostgreSQL owner authority", async ({ page }) => {
  const requests: Array<{ path: string; authorization?: string; xUsername?: string }> = [];
  const browserErrors: string[] = [];
  const failedMusicResponses: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // The sandboxed YouTube iframe emits this opaque player-state diagnostic
    // when playback is driven headlessly; it is not an application exception.
    if (/^\{target: [A-Za-z], data: \d+\}$/.test(message.text())) return;
    browserErrors.push(message.text());
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.hostname === "music-fixture.invalid" && response.status() >= 400) failedMusicResponses.push(`${response.status()} ${url.pathname}`);
  });
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/music/") || path === "/api/playlists") {
      requests.push({
        path,
        authorization: request.headers().authorization,
        xUsername: request.headers()["x-username"],
      });
    }
  });

  await page.goto("/google-auth/callback?access_token=fixture-read-only-token");
  await expect(page.getByText("Login successful! Redirecting...")).toBeVisible();
  await expect.poll(() => requests.filter(({ path }) => path === "/api/music/identity/ensure").length).toBe(1);
  await page.goto("/recommendations/music");
  await expect(page.getByRole("heading", { name: "Music", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Music workspace" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Music player", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Find music" })).toBeVisible();
  const ownerCredential = requests.find(({ path }) => path === "/api/music/dashboard")?.authorization;
  expect(ownerCredential).toMatch(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  const resetPlayer = await page.request.post("http://127.0.0.1:55000/api/playlist/currently-playing", {
    headers: { Authorization: ownerCredential!, Origin: "http://127.0.0.1:55173", "Idempotency-Key": `uat-reset-${Date.now()}` },
    data: { songId: null },
  });
  expect(resetPlayer.status()).toBe(204);
  await page.reload();
  const queueRegion = page.getByRole("region", { name: "Queue" });
  await expect(queueRegion).toBeVisible();
  const existingQueuedSongs = queueRegion.getByRole("checkbox", { name: /^Select / });
  const existingCount = await existingQueuedSongs.count();
  for (let index = 0; index < existingCount; index += 1) await existingQueuedSongs.nth(index).check();
  if (existingCount > 0) {
    await queueRegion.getByRole("button", { name: `Remove ${existingCount} selected` }).click();
    await expect(queueRegion.getByRole("checkbox", { name: /^Select / })).toHaveCount(0);
  }

  await page.getByRole("searchbox", { name: "Search music" }).fill("fixture journey");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("checkbox", { name: "Select UAT First song" }).check();
  await page.getByRole("checkbox", { name: "Select UAT Second song" }).check();
  await page.getByRole("button", { name: "Add 2 selected to queue" }).click();
  await expect(page.getByRole("button", { name: "Play UAT First song", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Play UAT First song", exact: true }).click();
  await expect(page.getByRole("region", { name: "Music player", exact: true })).toContainText("UAT First song");
  const transitionResponsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/playlist/currently-playing" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Next song" }).click();
  const transitionResponse = await transitionResponsePromise;
  expect(await transitionResponse.json()).toMatchObject({ title: "UAT Second song", status: "playing" });
  await expect(page.getByRole("region", { name: "Music player", exact: true })).toContainText("UAT Second song");
  await page.getByRole("tab", { name: "Recently played" }).click();
  await expect(page.getByRole("tabpanel", { name: "Recently played" })).toContainText("UAT First song");

  const ensure = requests.find(({ path }) => path === "/api/music/identity/ensure");
  expect(ensure).toMatchObject({ authorization: "Bearer fixture-read-only-token", xUsername: undefined });
  const owner = requests.find(({ path }) => path === "/api/playlists");
  expect(owner?.authorization).toMatch(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  expect(owner?.authorization).not.toContain("fixture-read-only-token");
  expect(owner?.xUsername).toBeUndefined();

  await page.reload();
  await expect(page.getByRole("region", { name: "Music workspace" })).toBeVisible();
  expect(requests.filter(({ path }) => path === "/api/music/identity/ensure").length).toBeGreaterThanOrEqual(2);
  const browserStorage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(browserStorage).not.toMatch(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
  expect(failedMusicResponses).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test("full owner workspace remains usable at a mobile viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/google-auth/callback?access_token=fixture-read-only-token");
  await expect(page.getByText("Login successful! Redirecting...")).toBeVisible();
  await page.goto("/recommendations/music");

  await expect(page.getByRole("region", { name: "Music workspace" })).toBeVisible();
  const mobileNavigation = page.getByRole("navigation", { name: "Music workspace" });
  await mobileNavigation.getByRole("button", { name: "Player" }).click();
  await expect(page.getByRole("region", { name: "Music player", exact: true })).toBeVisible();
  await mobileNavigation.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("searchbox", { name: "Search music" })).toBeVisible();
  await mobileNavigation.getByRole("button", { name: "Queue" }).click();
  await expect(page.getByRole("region", { name: "Queue" })).toBeVisible();
  await mobileNavigation.getByRole("button", { name: "More" }).click();
  await expect(page.getByRole("tabpanel", { name: "Recently played" })).toBeVisible();
  await testInfo.attach("mobile-owner-workspace", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
});
