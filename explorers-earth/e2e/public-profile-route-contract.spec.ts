import { expect, test } from "@playwright/test";

import { PUBLIC_RUNTIME_OPERATION_CAPABILITIES } from "../scripts/public-api-capabilities.mjs";
import { publicRouteContract, publicRoutePath, type PublicRouteOperation } from "../src/routes/publicRouteContract";
import {
  installPublicRouteContractFixture,
  type RouteContractFixtureController,
} from "./support/publicProfileFixture";

const routeParams = {
  username: "route-fixture",
  placeSlug: "example",
  place: "example",
  guideSlug: "example",
  genreSlug: "example",
  subjectSlug: "example",
  sectorSlug: "example",
  listSlug: "example",
} as const;

const profileRoute = publicRouteContract.find((route) => route.id === "profile");
if (!profileRoute) throw new Error("profile route missing from contract");
const profilePath = publicRoutePath(profileRoute, routeParams);

function assertDeclaredOperations(
  route: (typeof publicRouteContract)[number],
  controller: RouteContractFixtureController,
) {
  const declared = new Set<PublicRouteOperation>([
    ...route.requiredOperations,
    ...route.conditionalOperations,
  ]);
  const observed = new Set(
    controller.observedOperations
      .map((operation) => PUBLIC_RUNTIME_OPERATION_CAPABILITIES.get(operation))
      .filter((capability): capability is PublicRouteOperation => capability !== undefined),
  );

  expect(controller.unknownOperations, `unknown operations for ${route.id}`).toEqual([]);
  for (const capability of observed) {
    expect(declared, `${route.id} must declare observed ${capability}`).toContain(capability);
  }
  for (const capability of route.requiredOperations) {
    expect(observed, `${route.id} must observe required ${capability}`).toContain(capability);
  }
}

test.describe("application-owned public route contract", () => {
  for (const route of publicRouteContract) {
    test(`${route.id}: direct entry, internal navigation, refresh, marker and operations`, async ({ page }) => {
      const controller = await installPublicRouteContractFixture(page);
      const path = publicRoutePath(route, routeParams);

      await page.goto(path);
      const assembledRoute = page.locator(`[data-public-route-marker="${route.marker}"]`);
      await expect(assembledRoute).toBeVisible();
      await expect(assembledRoute).toHaveAttribute("data-public-route-id", route.id);
      expect(await assembledRoute.locator(":scope > *").count(), `${route.id} empty/content leaf`).toBeGreaterThan(0);
      await expect(page.getByTestId(`public-route-skeleton-${route.skeleton}`)).toHaveCount(0);
      await expect(page.getByRole("button", { name: /retry/i })).toHaveCount(0);
      await expect(page).toHaveURL(path);
      assertDeclaredOperations(route, controller);
      await page.waitForLoadState("networkidle");

      controller.observedOperations.length = 0;
      controller.unknownOperations.length = 0;

      await page.goto(profilePath);
      await expect(page.locator('[data-public-route-marker="public-profile-shell"]')).toBeVisible();
      await page.evaluate((nextPath) => {
        window.history.pushState({}, "", nextPath);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, path);
      await expect(page.locator(`[data-public-route-marker="${route.marker}"]`)).toBeVisible();
      await expect(page.locator(".earth-loader-wrapper")).toHaveCount(0);
      await page.waitForLoadState("networkidle");

      await page.reload();
      await expect(page.locator(`[data-public-route-marker="${route.marker}"]`)).toBeVisible();
      await expect(page).toHaveURL(path);
      await page.waitForLoadState("networkidle");

      expect(controller.networkAudit, `clean network and console for ${route.id}`).toEqual({
        consoleErrors: [],
        failedRequests: [],
        badResponses: [],
        unknownRequests: [],
      });
    });
  }

  const familyScenarios = [
    { family: "profile", scenario: "timing" },
    { family: "music", scenario: "timing" },
    { family: "places", scenario: "stale" },
    { family: "guides", scenario: "failure" },
    { family: "community", scenario: "timing" },
    { family: "movies", scenario: "stale" },
    { family: "books", scenario: "failure" },
    { family: "games", scenario: "stale" },
    { family: "apps", scenario: "failure" },
    { family: "products", scenario: "stale" },
    { family: "people", scenario: "failure" },
  ] as const;

  for (const { family, scenario } of familyScenarios) {
    test(`${family} family: ${scenario} readiness representative`, async ({ page }) => {
      const familyRoutes = publicRouteContract.filter((route) => route.family === family);
      const first = familyRoutes[0];
      const firstPath = publicRoutePath(first, routeParams);

      if (scenario === "timing") {
        await installPublicRouteContractFixture(page, {
          bootstrapDelayMs: 350,
          leafDelayMs: family === "profile" ? 350 : 0,
        });
        const navigation = page.goto(firstPath, { waitUntil: "domcontentloaded" });
        await expect(page.locator(".earth-loader-wrapper")).toBeVisible();
        await navigation;
        await expect(page.locator(`[data-public-route-id="${first.id}"]`)).toBeVisible();
        const refresh = page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator(".earth-loader-wrapper")).toBeVisible();
        await refresh;
        await expect(page.locator(`[data-public-route-id="${first.id}"]`)).toBeVisible();
        return;
      }

      if (scenario === "failure") {
        const controller = await installPublicRouteContractFixture(page, { httpStatus: 500 });
        await page.goto(firstPath);
        await expect(page).toHaveURL(firstPath);
        const retry = page.getByRole("button", { name: /retry/i });
        await expect(retry).toBeVisible();
        controller.httpStatus = undefined;
        await retry.click();
        await expect(page.locator(`[data-public-route-id="${first.id}"]`)).toBeVisible();
        await expect(page).toHaveURL(firstPath);
        return;
      }

      const second = familyRoutes[1];
      if (!second) throw new Error(`${family} stale representative needs two routes`);
      const controller = await installPublicRouteContractFixture(page, { leafDelayMs: 300 });
      await page.goto(profilePath);
      controller.observedOperations.length = 0;
      await page.evaluate((nextPath) => {
        window.history.pushState({}, "", nextPath);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, firstPath);
      await expect.poll(() => controller.observedOperations.length).toBeGreaterThan(0);
      controller.leafDelayMs = 900;
      const secondPath = publicRoutePath(second, routeParams);
      await page.evaluate((nextPath) => {
        window.history.pushState({}, "", nextPath);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, secondPath);
      await page.waitForTimeout(400);
      await expect(page.getByTestId(`public-route-skeleton-${second.skeleton}`)).toBeVisible();
      await expect(page).toHaveURL(secondPath);
      await expect(page.locator(`[data-public-route-id="${second.id}"]`)).toBeVisible();
      await expect(page).toHaveURL(secondPath);
    });
  }

  test("profile background refresh keeps cached content and never restores Earth", async ({ page }) => {
    const controller = await installPublicRouteContractFixture(page);
    const otherProfilePath = publicRoutePath(profileRoute, {
      ...routeParams,
      username: "route-fixture-other",
    });
    await page.goto(profilePath);
    await expect(page.locator(`[data-public-route-id="${profileRoute.id}"]`)).toBeVisible();
    await page.evaluate((nextPath) => {
      window.history.pushState({}, "", nextPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, otherProfilePath);
    await expect(page.locator(`[data-public-route-id="${profileRoute.id}"]`)).toBeVisible();

    controller.bootstrapDelayMs = 700;
    await page.evaluate((nextPath) => {
      window.history.pushState({}, "", nextPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, profilePath);
    await expect(page.locator(`[data-public-route-id="${profileRoute.id}"]`)).toBeVisible();
    await expect(page.getByTestId("public-route-refresh-progress")).toBeVisible();
    await expect(page.locator(".earth-loader-wrapper")).toHaveCount(0);
    await expect(page.getByTestId("public-route-refresh-progress")).toHaveCount(0);
    await expect(page.locator(`[data-public-route-id="${profileRoute.id}"]`)).toBeVisible();
  });


  test("invalid path preserves query/hash and replace-navigates to the valid profile", async ({ page }) => {
    await installPublicRouteContractFixture(page);
    await page.goto(`/${routeParams.username}/not-a-public-route?utm_source=contract#proof`);

    await expect(page).toHaveURL(`/${routeParams.username}?utm_source=contract#proof`);
    await expect(page.locator('[data-public-route-marker="public-profile-shell"]')).toBeVisible();
  });

  test("hidden category redirects only after the successful bootstrap settles", async ({ page }) => {
    await installPublicRouteContractFixture(page, {
      hiddenField: "public_books",
      bootstrapDelayMs: 1_000,
    });
    const booksRoute = publicRouteContract.find((route) => route.id === "books-index")!;
    const target = `${publicRoutePath(booksRoute, routeParams)}?utm_source=hidden#proof`;
    const navigation = page.goto(target, { waitUntil: "domcontentloaded" });

    await expect(page.locator(".earth-loader-wrapper")).toBeVisible();
    await navigation;
    await expect(page).toHaveURL(`/${routeParams.username}?utm_source=hidden#proof`);
    await expect(page.locator('[data-public-route-marker="public-profile-shell"]')).toBeVisible();
  });

  test("missing child redirects only after successful child data settles", async ({ page }) => {
    await installPublicRouteContractFixture(page, {
      outcome: "missing-child",
      leafDelayMs: 250,
    });
    const booksListRoute = publicRouteContract.find((route) => route.id === "books-list")!;
    const target = `${publicRoutePath(booksListRoute, routeParams)}?utm_source=missing#proof`;
    await page.goto(target, { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-testid="public-route-skeleton-detail"]')).toBeVisible();
    await expect(page).toHaveURL(`/${routeParams.username}?utm_source=missing#proof`);
    await expect(page.locator('[data-public-route-marker="public-profile-shell"]')).toBeVisible();
  });

  for (const status of [401, 403, 429, 500] as const) {
    test(`HTTP ${status} remains on the requested route and Retry recovers`, async ({ page }) => {
      const controller = await installPublicRouteContractFixture(page, { httpStatus: status });
      const booksRoute = publicRouteContract.find((route) => route.id === "books-index")!;
      const target = `${publicRoutePath(booksRoute, routeParams)}?status=${status}#retry`;
      await page.goto(target);

      await expect(page).toHaveURL(target);
      const retry = page.getByRole("button", { name: /retry/i });
      await expect(retry).toBeVisible();
      controller.httpStatus = undefined;
      await retry.click();

      await expect(page).toHaveURL(target);
      await expect(page.locator('[data-public-route-marker="public-books-page"]')).toBeVisible();
    });
  }

  test("unknown username renders Not Found without canonical fallback", async ({ page }) => {
    await installPublicRouteContractFixture(page, { outcome: "unknown-user" });
    const booksRoute = publicRouteContract.find((route) => route.id === "books-index")!;
    const target = `${publicRoutePath(booksRoute, { ...routeParams, username: "unknown-route-fixture" })}?utm_source=unknown#proof`;
    await page.goto(target);

    await expect(page).toHaveURL(target);
    await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();
  });

  test("network audit reports HTTP failures and blocks unknown external traffic", async ({ page }) => {
    const controller = await installPublicRouteContractFixture(page);
    await page.route("**/e2e-418", (route) => route.fulfill({ status: 418, body: "fixture" }));
    await page.goto(publicRoutePath(profileRoute, routeParams));

    await page.evaluate(async () => {
      await fetch("/e2e-418").catch(() => undefined);
      await fetch("https://unexpected.fixture.invalid/private").catch(() => undefined);
    });

    const audit = (controller as any).networkAudit;
    expect(audit.badResponses).toContainEqual(expect.objectContaining({ status: 418 }));
    expect(audit.unknownRequests).toContainEqual(expect.objectContaining({
      url: "https://unexpected.fixture.invalid/private",
    }));
  });
});
