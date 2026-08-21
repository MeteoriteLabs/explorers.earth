import { expect, test } from "@playwright/test";

const fixtureUser = {
  id: "fixture-user-document-id",
  documentId: "fixture-user-document-id",
  username: "fixture-explorer",
  email: "fixture-explorer@example.invalid",
  blocked: false,
};

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
  await expect(page.getByRole("heading", { name: "Create your first playlist" })).toBeVisible();

  const ensure = requests.find(({ path }) => path === "/api/music/identity/ensure");
  expect(ensure).toMatchObject({ authorization: "Bearer fixture-read-only-token", xUsername: undefined });
  const owner = requests.find(({ path }) => path === "/api/playlists");
  expect(owner?.authorization).toMatch(/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  expect(owner?.authorization).not.toContain("fixture-read-only-token");
  expect(owner?.xUsername).toBeUndefined();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Create your first playlist" })).toBeVisible();
  expect(requests.filter(({ path }) => path === "/api/music/identity/ensure").length).toBeGreaterThanOrEqual(2);
  const browserStorage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(browserStorage).not.toMatch(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
});
