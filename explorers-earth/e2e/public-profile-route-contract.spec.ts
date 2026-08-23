import { expect, test, type Page } from "@playwright/test";

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

const bootstrapOnlyRouteIds = new Set(["community"]);
const shellOperationNames = new Set([
  "PublicProfileBootstrap",
  "PublicCategoryListCounts",
  "CreatePublicPageAnalytic",
]);

function leafFailureOperation(
  route: (typeof publicRouteContract)[number],
  observedOperations: readonly string[],
): string | undefined {
  if (bootstrapOnlyRouteIds.has(route.id)) return undefined;
  const accountLeafOperation = route.id === "profile"
    ? "PublicProfileContent"
    : route.id === "music"
      ? "PublicMusicPlaylist"
      : undefined;
  if (accountLeafOperation) {
    return observedOperations.find((operation) => operation === accountLeafOperation);
  }
  const leafCapability = route.requiredOperations.find(
    (operation) => operation !== "account-bootstrap",
  ) ?? "account-bootstrap";

  return observedOperations.find(
    (operation) =>
      !shellOperationNames.has(operation) &&
      PUBLIC_RUNTIME_OPERATION_CAPABILITIES.get(operation) === leafCapability,
  );
}

async function preserveGraphqlRaceResponses(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith("/graphql") && init?.signal) {
        const { signal: _ignoredForStaleRace, ...uncancelledInit } = init;
        return nativeFetch(input, uncancelledInit);
      }
      return nativeFetch(input, init);
    };
  });
}

const ROUTE_UI_TEXT: Record<(typeof publicRouteContract)[number]["id"], RegExp> = {
  profile: /Route Fixture/,
  music: /No song playing/,
  "places-index": /No locations available/,
  "places-detail": /Fixture list/,
  "places-map": /No categories available/,
  "places-detail-map": /No categories available/,
  "places-map-detail": /List View/,
  "guides-index": /No guides available yet/,
  "guides-detail": /Fixture guide/,
  community: /^Community$/,
  "movies-index": /No movies shared yet/,
  "movies-genre": /No movies found in this genre/,
  "movies-list": /Fixture list/,
  "books-index": /No books yet/,
  "books-subject": /No books found for this subject/,
  "books-list": /No books in this list yet/,
  "games-index": /No games shared yet/,
  "games-genre": /No games found in this genre/,
  "games-list": /Fixture list/,
  "apps-index": /No apps shared yet/,
  "apps-list": /Fixture list/,
  "products-index": /No products shared yet/,
  "products-list": /Fixture list/,
  "people-index": /No people shared yet/,
  "people-sector": /No people recommended in this sector/,
  "people-list": /Fixture list/,
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
    const routeCaseName = route.id === "music"
      ? "music: PUBLIC_MUSIC_UNBOUNDED_RETRY regression is bounded and Retry recovers"
      : `${route.id}: real leaf direct/internal/refresh/content/error and settled redirect semantics`;
    test(routeCaseName, async ({ page }) => {
      const controller = await installPublicRouteContractFixture(page, {
        // Keep the fixture pending across multiple browser locator polls. This proves the
        // real request-driven Earth state without adding a minimum duration to the app.
        bootstrapDelayMs: 800,
        leafDelayMs: 800,
      });
      const path = publicRoutePath(route, routeParams);

      const directNavigation = page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".earth-loader-wrapper")).toBeVisible();
      await directNavigation;
      if (route.family === "profile" || route.family === "music" || route.requiredOperations.length > 1) {
        await expect(page.getByTestId(`public-route-skeleton-${route.skeleton}`)).toBeVisible();
      }
      const assembledRoute = page.locator(`[data-public-route-leaf="${route.marker}"]`);
      await expect(assembledRoute).toBeVisible();
      await expect(assembledRoute).toContainText(ROUTE_UI_TEXT[route.id]);
      expect(await assembledRoute.locator(":scope > *").count(), `${route.id} empty/content leaf`).toBeGreaterThan(0);
      await expect(page.getByTestId(`public-route-skeleton-${route.skeleton}`)).toHaveCount(0);
      await expect(page.getByRole("button", { name: /retry/i })).toHaveCount(0);
      await expect(page).toHaveURL(path);
      assertDeclaredOperations(route, controller);
      await page.waitForLoadState("networkidle");

      const selectedLeafOperation = leafFailureOperation(route, controller.observedOperations);
      if (bootstrapOnlyRouteIds.has(route.id)) {
        expect(selectedLeafOperation, `${route.id} is explicitly bootstrap-only`).toBeUndefined();
      } else {
        expect(selectedLeafOperation, `${route.id} must expose a leaf operation`).toBeTruthy();
      }
      const failedOperation = selectedLeafOperation ?? "PublicProfileBootstrap";
      const bootstrapAttemptsBeforeFailure = controller.attempts.PublicProfileBootstrap ?? 0;
      controller.bootstrapDelayMs = bootstrapOnlyRouteIds.has(route.id) ? 800 : 0;
      controller.leafDelayMs = bootstrapOnlyRouteIds.has(route.id) ? 0 : 800;
      controller.failure = { operationName: failedOperation, status: 500 };
      const errorParams = { ...routeParams, username: `error-${route.id}` };
      const errorPath = publicRoutePath(route, errorParams);
      const errorNavigation = page.goto(errorPath, { waitUntil: "domcontentloaded" });
      await expect(
        bootstrapOnlyRouteIds.has(route.id)
          ? page.locator(".earth-loader-wrapper")
          : page.getByTestId(`public-route-skeleton-${route.skeleton}`),
      ).toBeVisible();
      await errorNavigation;
      await expect(page).toHaveURL(errorPath);
      const retry = page.getByRole("button", { name: /retry/i });
      await expect(retry).toBeVisible();
      await expect(page.getByRole("heading", {
        name: bootstrapOnlyRouteIds.has(route.id)
          ? "Couldn’t verify this profile"
          : "Couldn’t load this section",
      })).toBeVisible();
      expect(controller.failedOperations).toContain(failedOperation);
      if (route.id === "music") {
        const failedMusicAttempts = () => controller.failedOperations.filter(
          (operationName) => operationName === failedOperation,
        ).length;
        expect(failedMusicAttempts(), "initial request plus two bounded retries").toBe(3);
        await page.waitForTimeout(1_200);
        expect(failedMusicAttempts(), "persistent failure must stop network churn").toBe(3);
      }
      expect(controller.attempts.PublicProfileBootstrap ?? 0).toBeGreaterThan(
        bootstrapAttemptsBeforeFailure,
      );
      if (!bootstrapOnlyRouteIds.has(route.id)) {
        expect(failedOperation).not.toBe("PublicProfileBootstrap");
      }
      controller.failure = undefined;
      controller.bootstrapDelayMs = 0;
      controller.leafDelayMs = 0;
      await retry.click();
      await expect(page.locator(`[data-public-route-leaf="${route.marker}"]`)).toContainText(ROUTE_UI_TEXT[route.id]);
      await expect(page).toHaveURL(errorPath);
      await page.goto(path);

      controller.observedOperations.length = 0;
      controller.unknownOperations.length = 0;

      await page.goto(profilePath);
      await expect(page.locator('[data-public-route-leaf="public-profile-shell"]')).toBeVisible();
      await page.evaluate((nextPath) => {
        window.history.pushState({}, "", nextPath);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, path);
      await expect(page.locator(`[data-public-route-leaf="${route.marker}"]`)).toBeVisible();
      await expect(page.locator(".earth-loader-wrapper")).toHaveCount(0);
      await page.waitForLoadState("networkidle");

      await page.reload();
      await expect(page.locator(`[data-public-route-leaf="${route.marker}"]`)).toBeVisible();
      await expect(page).toHaveURL(path);
      await page.waitForLoadState("networkidle");

      if (route.resourceKind === "child") {
        controller.outcome = "missing-child";
        controller.leafDelayMs = 150;
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId(`public-route-skeleton-${route.skeleton}`)).toBeVisible();
        await expect(page).toHaveURL(profilePath);
        controller.outcome = "empty";
        controller.leafDelayMs = 0;
      }

      if (route.visibility === "guarded" && route.id !== "profile") {
        controller.hiddenField = route.visibilityField;
        controller.bootstrapDelayMs = 150;
        const hiddenParams = { ...routeParams, username: `hidden-${route.id}` };
        const hiddenPath = publicRoutePath(route, hiddenParams);
        const hiddenProfilePath = publicRoutePath(profileRoute, hiddenParams);
        const hiddenNavigation = page.goto(hiddenPath, { waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(hiddenPath);
        await hiddenNavigation;
        await expect(page).toHaveURL(hiddenProfilePath);
        controller.hiddenField = undefined;
        controller.bootstrapDelayMs = 0;
      }

      expect(controller.unknownOperations, `declared GraphQL operations for ${route.id}`).toEqual([]);
      expect(controller.networkAudit.unknownRequests, `known network surface for ${route.id}`).toEqual([]);
      expect(controller.networkAudit.badResponses).toContainEqual(expect.objectContaining({ status: 500 }));
    });
  }

  test("books-list stale response is distinguishable and the newest route generation wins", async ({ page }) => {
    const controller = await installPublicRouteContractFixture(page);
    await preserveGraphqlRaceResponses(page);
    const booksList = publicRouteContract.find((route) => route.id === "books-list")!;
    const oldPath = publicRoutePath(booksList, { ...routeParams, listSlug: "old-list" });
    const currentPath = publicRoutePath(booksList, { ...routeParams, listSlug: "current-list" });
    await page.goto(profilePath, { waitUntil: "domcontentloaded" });
    await expect(page.locator('[data-public-route-leaf="public-profile-shell"]')).toBeVisible();
    await page.evaluate(() => {
      (window as typeof window & { __task6DocumentSentinel?: string }).__task6DocumentSentinel =
        "same-document-stale-race";
    });

    controller.responseLabel = "Old books-list content";
    controller.leafDelayMs = 1_000;
    const oldResponse = page.waitForResponse(async (response) => {
      if (!response.url().endsWith("/graphql")) return false;
      return (await response.text()).includes("Old books-list content");
    });
    const oldAttempts = controller.attempts.BookListBySlug ?? 0;
    await page.evaluate((nextPath) => {
      window.history.pushState({}, "", nextPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, oldPath);
    await expect.poll(() => controller.attempts.BookListBySlug ?? 0).toBeGreaterThan(oldAttempts);
    await expect(page.getByText("Old books-list content", { exact: true })).toHaveCount(0);

    controller.responseLabel = "Current books-list content";
    controller.leafDelayMs = 0;
    await page.evaluate((nextPath) => {
      window.history.pushState({}, "", nextPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, currentPath);
    await expect(page.getByText("Current books-list content", { exact: true })).toBeVisible();
    expect(await page.evaluate(() =>
      (window as typeof window & { __task6DocumentSentinel?: string }).__task6DocumentSentinel,
    )).toBe("same-document-stale-race");
    await oldResponse;
    expect(controller.networkAudit.failedRequests).toEqual([]);
    await expect(page.getByText("Old books-list content", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Current books-list content", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(currentPath);
  });

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
        await expect(page.locator(`[data-public-route-leaf="${first.marker}"]`)).toBeVisible();
        const refresh = page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator(".earth-loader-wrapper")).toBeVisible();
        await refresh;
        await expect(page.locator(`[data-public-route-leaf="${first.marker}"]`)).toBeVisible();
        return;
      }

      if (scenario === "failure") {
        const controller = await installPublicRouteContractFixture(page);
        await page.goto(firstPath);
        const failureOperation = leafFailureOperation(first, controller.observedOperations);
        if (!failureOperation) throw new Error(`${first.id} needs an observed leaf operation`);
        controller.failure = { operationName: failureOperation, status: 500 };
        const failedPath = publicRoutePath(first, {
          ...routeParams,
          username: `${family}-failure-fixture`,
        });
        await page.goto(failedPath);
        await expect(page).toHaveURL(failedPath);
        const retry = page.getByRole("button", { name: /retry/i });
        await expect(retry).toBeVisible();
        expect(controller.failedOperations).toContain(failureOperation);
        controller.failure = undefined;
        await retry.click();
        await expect(page.locator(`[data-public-route-leaf="${first.marker}"]`)).toBeVisible();
        await expect(page).toHaveURL(failedPath);
        return;
      }

      const staleRoute = familyRoutes.find((candidate) => candidate.id.endsWith("-list"))
        ?? familyRoutes.find((candidate) => candidate.resourceKind === "child" && candidate.shell === "detail");
      if (!staleRoute) throw new Error(`${family} stale representative needs a detail/list route`);
      const controller = await installPublicRouteContractFixture(page);
      await preserveGraphqlRaceResponses(page);
      await page.goto(profilePath);
      const oldLabel = `Old ${family} content`;
      const currentLabel = `Current ${family} content`;
      const oldPath = publicRoutePath(staleRoute, {
        ...routeParams,
        placeSlug: "old-place",
        listSlug: "old-list",
      });
      const currentPath = publicRoutePath(staleRoute, {
        ...routeParams,
        placeSlug: "current-place",
        listSlug: "current-list",
      });
      controller.responseLabel = oldLabel;
      controller.leafDelayMs = 900;
      const oldResponse = page.waitForResponse(async (response) =>
        response.url().endsWith("/graphql") && (await response.text()).includes(oldLabel),
      );
      const operationCount = controller.observedOperations.length;
      await page.evaluate((nextPath) => {
        window.history.pushState({}, "", nextPath);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, oldPath);
      await expect.poll(() => controller.observedOperations.length).toBeGreaterThan(operationCount);
      await expect(page.getByText(oldLabel, { exact: true })).toHaveCount(0);
      controller.responseLabel = currentLabel;
      controller.leafDelayMs = 0;
      await page.evaluate((nextPath) => {
        window.history.pushState({}, "", nextPath);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, currentPath);
      await expect(page.getByText(currentLabel, { exact: true })).toBeVisible();
      await oldResponse;
      await expect(page.getByText(oldLabel, { exact: true })).toHaveCount(0);
      await expect(page.getByText(currentLabel, { exact: true })).toBeVisible();
      await expect(page.locator(`[data-public-route-leaf="${staleRoute.marker}"]`)).toBeVisible();
      await expect(page).toHaveURL(currentPath);
    });
  }

  test("profile background refresh keeps cached content and never restores Earth", async ({ page }) => {
    const controller = await installPublicRouteContractFixture(page);
    const otherProfilePath = publicRoutePath(profileRoute, {
      ...routeParams,
      username: "route-fixture-other",
    });
    await page.goto(profilePath);
    await expect(page.locator(`[data-public-route-leaf="${profileRoute.marker}"]`)).toBeVisible();
    await page.evaluate((nextPath) => {
      window.history.pushState({}, "", nextPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, otherProfilePath);
    await expect(page.locator(`[data-public-route-leaf="${profileRoute.marker}"]`)).toBeVisible();

    controller.bootstrapDelayMs = 700;
    await page.evaluate((nextPath) => {
      window.history.pushState({}, "", nextPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, profilePath);
    await expect(page.locator(`[data-public-route-leaf="${profileRoute.marker}"]`)).toBeVisible();
    await expect(page.getByTestId("public-route-refresh-progress")).toBeVisible();
    await expect(page.locator(".earth-loader-wrapper")).toHaveCount(0);
    await expect(page.getByTestId("public-route-refresh-progress")).toHaveCount(0);
    await expect(page.locator(`[data-public-route-leaf="${profileRoute.marker}"]`)).toBeVisible();
  });


  test("invalid path preserves query/hash and replace-navigates to the valid profile", async ({ page }) => {
    await installPublicRouteContractFixture(page);
    await page.goto(`/${routeParams.username}/not-a-public-route?utm_source=contract#proof`);

    await expect(page).toHaveURL(`/${routeParams.username}?utm_source=contract#proof`);
    await expect(page.locator('[data-public-route-leaf="public-profile-shell"]')).toBeVisible();
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
    await expect(page.locator('[data-public-route-leaf="public-profile-shell"]')).toBeVisible();
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
    await expect(page.locator('[data-public-route-leaf="public-profile-shell"]')).toBeVisible();
  });

  for (const status of [401, 403, 429, 500] as const) {
    test(`HTTP ${status} remains on the requested route and Retry recovers`, async ({ page }) => {
      const controller = await installPublicRouteContractFixture(page);
      const booksRoute = publicRouteContract.find((route) => route.id === "books-index")!;
      await page.goto(publicRoutePath(booksRoute, routeParams));
      const failureOperation = leafFailureOperation(booksRoute, controller.observedOperations);
      if (!failureOperation) throw new Error("books-index needs an observed leaf operation");
      controller.failure = { operationName: failureOperation, status };
      const target = `${publicRoutePath(booksRoute, routeParams)}?status=${status}#retry`;
      const failedTarget = target.replace(routeParams.username, `status-${status}-fixture`);
      await page.goto(failedTarget);

      await expect(page).toHaveURL(failedTarget);
      const retry = page.getByRole("button", { name: /retry/i });
      await expect(retry).toBeVisible();
      expect(controller.failedOperations).toContain(failureOperation);
      controller.failure = undefined;
      await retry.click();

      await expect(page).toHaveURL(failedTarget);
      await expect(page.locator('[data-public-route-leaf="public-books-page"]')).toBeVisible();
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

  test("anonymous, malformed, and undeclared GraphQL operations fail closed", async ({ page }) => {
    const controller = await installPublicRouteContractFixture(page);
    await page.goto(publicRoutePath(profileRoute, routeParams));

    const statuses = await page.evaluate(async () => Promise.all([
      fetch("/graphql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "{ __typename }" }),
      }).then((response) => response.status),
      fetch("/graphql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{malformed",
      }).then((response) => response.status),
      fetch("/graphql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operationName: "PrivateAccountDump", query: "query PrivateAccountDump { __typename }" }),
      }).then((response) => response.status),
    ]));

    expect(statuses).toEqual([400, 400, 400]);
    expect(controller.unknownOperations).toHaveLength(3);
    expect(controller.observedOperations).not.toContain("Unknown");
  });
});
