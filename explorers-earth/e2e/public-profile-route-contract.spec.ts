import { expect, test } from "@playwright/test";

import {
  publicRouteContract,
  publicRoutePath,
  type PublicRouteOperation,
} from "../src/routes/publicRouteContract";
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

const operationCapabilities: Readonly<Record<string, PublicRouteOperation | "analytics">> = {
  PublicProfileBootstrap: "account-bootstrap",
  PublicCategoryListCounts: "account-bootstrap",
  PublicProfileContent: "account-bootstrap",
  PublicAccountBasic: "account-bootstrap",
  UsersPermissionsUser: "account-bootstrap",
  PublicPlacesLists: "places",
  GetPlacesLists: "places",
  PublicPlaceListBySlug: "places",
  PublicRecommendedPlacesConnection: "places",
  Account: "places",
  GetPublicGuides: "guides",
  GetGuidesLists: "guides",
  GetPublicGuideBySlug: "guides",
  PublicMovieData: "movies",
  GetMoviesLists: "movies",
  MovieListBySlug: "movies",
  MoviesByGenre: "movies",
  PublicBookData: "books",
  GetBooksLists: "books",
  BookListBySlug: "books",
  BooksBySubject: "books",
  PublicGameData: "games",
  GetGamesLists: "games",
  GameListBySlug: "games",
  GamesByGenre: "games",
  PublicAppData: "apps",
  GetAppsLists: "apps",
  AppListBySlug: "apps",
  PublicProductData: "products",
  GetProductsLists: "products",
  ProductListBySlug: "products",
  PublicPeopleData: "people",
  GetPeopleLists: "people",
  PersonListBySlug: "people",
  PeopleBySector: "people",
  CreatePublicPageAnalytic: "analytics",
};

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
      .map((operation) => operationCapabilities[operation])
      .filter((capability): capability is PublicRouteOperation => capability !== undefined && capability !== "analytics"),
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
      const browserErrors: string[] = [];
      const failedRequests: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
      });
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}`));

      await page.goto(path);
      await expect(page.locator(`[data-public-route-marker="${route.marker}"]`)).toBeVisible();
      await expect(page).toHaveURL(path);
      assertDeclaredOperations(route, controller);

      controller.observedOperations.length = 0;
      controller.unknownOperations.length = 0;

      await page.goto(`/${routeParams.username}`);
      await expect(page.locator('[data-public-route-marker="public-profile-shell"]')).toBeVisible();
      await page.evaluate((nextPath) => {
        window.history.pushState({}, "", nextPath);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, path);
      await expect(page.locator(`[data-public-route-marker="${route.marker}"]`)).toBeVisible();
      await expect(page.locator(".earth-loader-wrapper")).toHaveCount(0);

      await page.reload();
      await expect(page.locator(`[data-public-route-marker="${route.marker}"]`)).toBeVisible();
      await expect(page).toHaveURL(path);

      expect(browserErrors, `browser errors for ${route.id}`).toEqual([]);
      expect(failedRequests, `request failures for ${route.id}`).toEqual([]);
    });
  }


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
    const target = `/${routeParams.username}/books?utm_source=hidden#proof`;
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
    const target = `/${routeParams.username}/books/example?utm_source=missing#proof`;
    await page.goto(target, { waitUntil: "domcontentloaded" });

    await expect(page.locator('[data-testid="public-route-skeleton-detail"]')).toBeVisible();
    await expect(page).toHaveURL(`/${routeParams.username}?utm_source=missing#proof`);
    await expect(page.locator('[data-public-route-marker="public-profile-shell"]')).toBeVisible();
  });

  for (const status of [401, 403, 429, 500] as const) {
    test(`HTTP ${status} remains on the requested route and Retry recovers`, async ({ page }) => {
      const controller = await installPublicRouteContractFixture(page, { httpStatus: status });
      const target = `/${routeParams.username}/books?status=${status}#retry`;
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
    const target = "/unknown-route-fixture/books?utm_source=unknown#proof";
    await page.goto(target);

    await expect(page).toHaveURL(target);
    await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();
  });
});
