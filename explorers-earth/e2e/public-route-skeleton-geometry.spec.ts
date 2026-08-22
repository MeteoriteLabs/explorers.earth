import { expect, test, type Page, type Route } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function deferred(): Deferred {
  let resolve = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function operationName(route: Route): string {
  const query = (route.request().postDataJSON() as { query?: string } | null)?.query ?? "";
  return query.match(/(?:query|mutation)\s+([A-Za-z0-9_]+)/)?.[1] ?? "anonymous";
}

async function installSkeletonFixture(page: Page, leafGate: () => Deferred) {
  await page.route("**/graphql", async (route) => {
    const operation = operationName(route);

    if (operation === "PublicProfileBootstrap") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            accounts: [{
              __typename: "Account",
              documentId: "account-fixture",
              Account_Name: "Skeleton Fixture",
              Account_Type: "Personal",
              Primary_Address: { address: "Earth" },
              bg_picture: null,
              profile_picture: null,
              social_media: {
                theme_settings: {
                  preset: "cinematic-dark",
                  wallpaperMode: "solid-color",
                },
              },
              localtunes_public: false,
              public_profile: "Yes",
              public_recommendations: "Yes",
              public_music: "Yes",
              public_movie: "Yes",
              public_books: "Yes",
              public_guides: "Yes",
              public_games: "Yes",
              public_apps: "Yes",
              public_products: "Yes",
              public_people: "Yes",
              pinned_nav_tabs: [],
              auto_pinning: false,
            }],
          },
        }),
      });
      return;
    }

    if (operation === "PublicCategoryListCounts") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            recommendationLists: [],
            bookLists: [],
            movieLists: [],
            gameLists: [],
            appLists: [],
            productLists: [],
            personLists: [],
            guides: [],
          },
        }),
      });
      return;
    }

    const gate = leafGate();
    await gate.promise;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    }).catch(() => undefined);
  });
}

const viewports = [
  { width: 320, height: 720 },
  { width: 375, height: 812 },
  { width: 375, height: 667 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

const routeCases = [
  { id: "profile", path: "/skeleton-fixture", kind: "profile-root", maxWidth: 1024 },
  { id: "apps-index", path: "/skeleton-fixture/apps", kind: "collection", maxWidth: 1152 },
  { id: "apps-list", path: "/skeleton-fixture/apps/example", kind: "detail", maxWidth: 1024 },
  { id: "places-map", path: "/skeleton-fixture/places/map", kind: "map", maxWidth: Number.POSITIVE_INFINITY },
] as const;

test.describe("public route skeleton real-browser geometry", () => {
  test("matches approved bounds without horizontal overflow at every required viewport", async ({ page }) => {
    test.setTimeout(120_000);
    page.on("pageerror", (error) => {
      process.stderr.write(`public-route-skeleton page error: ${error.message}\n`);
    });
    let currentGate = deferred();
    await installSkeletonFixture(page, () => currentGate);

    const screenshotDir = path.join(process.cwd(), "test-results", "public-route-skeleton-geometry");
    fs.mkdirSync(screenshotDir, { recursive: true });

    for (const routeCase of routeCases) {
      currentGate = deferred();
      await page.goto(routeCase.path, { waitUntil: "domcontentloaded" });

      const skeleton = page.getByTestId(`public-route-skeleton-${routeCase.kind}`);
      await expect(skeleton).toBeVisible();

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await expect(skeleton).toBeVisible();

        const geometry = await skeleton.evaluate((root) => {
          const inner = root.lastElementChild as HTMLElement;
          const rootRect = root.getBoundingClientRect();
          const innerRect = inner.getBoundingClientRect();
          return {
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            documentScrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: document.body.scrollWidth,
            root: { x: rootRect.x, width: rootRect.width, right: rootRect.right, height: rootRect.height },
            inner: { x: innerRect.x, width: innerRect.width, right: innerRect.right, height: innerRect.height },
          };
        });

        const expectedInnerWidth = Math.min(viewport.width, routeCase.maxWidth);
        const expectedInnerX = (viewport.width - expectedInnerWidth) / 2;

        expect(geometry.viewportWidth).toBe(viewport.width);
        expect(geometry.viewportHeight).toBe(viewport.height);
        expect(geometry.documentScrollWidth).toBeLessThanOrEqual(viewport.width);
        expect(geometry.bodyScrollWidth).toBeLessThanOrEqual(viewport.width);
        expect(Math.abs(geometry.root.x)).toBeLessThanOrEqual(1.5);
        expect(Math.abs(geometry.root.width - viewport.width)).toBeLessThanOrEqual(1.5);
        expect(geometry.root.right).toBeLessThanOrEqual(viewport.width + 1.5);
        expect(geometry.root.height).toBeGreaterThanOrEqual(viewport.height);
        expect(Math.abs(geometry.inner.x - expectedInnerX)).toBeLessThanOrEqual(1.5);
        expect(Math.abs(geometry.inner.width - expectedInnerWidth)).toBeLessThanOrEqual(1.5);
        expect(geometry.inner.right).toBeLessThanOrEqual(viewport.width + 1.5);

        if (routeCase.kind === "map") {
          expect(Math.abs(geometry.inner.height - viewport.height)).toBeLessThanOrEqual(1.5);
        }

        await page.screenshot({
          path: path.join(screenshotDir, `${routeCase.id}-${viewport.width}x${viewport.height}.png`),
          animations: "disabled",
        });
      }

      currentGate.resolve();
    }
  });
});
