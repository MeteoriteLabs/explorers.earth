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

function armExpectedApolloUseQueryWarnings(
  controller: RouteContractFixtureController,
  count = 2,
) {
  const arm = (controller as RouteContractFixtureController & {
    expectApolloUseQueryOnErrorWarnings?: (warningCount: number) => void;
  }).expectApolloUseQueryOnErrorWarnings;
  expect(typeof arm, "fixture exposes an explicit bounded Apollo-warning permit").toBe("function");
  if (arm) arm(count);
}

function armMusicMountWarnings(
  controller: RouteContractFixtureController,
  routeId: string,
) {
  if (routeId === "music") armExpectedApolloUseQueryWarnings(controller);
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

      armMusicMountWarnings(controller, route.id);
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
      if (route.id === "music") {
        const musicAudit = controller.networkAudit as typeof controller.networkAudit & {
          expectedConsoleErrors?: string[];
          consoleWarnings?: string[];
          webSockets?: Array<{ url: string; protocols: string[]; closed: boolean }>;
          unexpectedWebSockets?: Array<{ code: string; url: string }>;
        };
        // React StrictMode mounts the effect twice in development; the first socket
        // must close and exactly one deterministic LocalTunes socket stays active.
        await expect.poll(() => musicAudit.webSockets?.length ?? 0).toBe(2);
        expect(musicAudit.webSockets?.every(({ url, protocols }) => {
          const parsed = new URL(url);
          return parsed.protocol === "ws:" &&
            parsed.hostname === "localtunes.earth" &&
            parsed.port === "" &&
            parsed.pathname === "/socket.io/" &&
            [...parsed.searchParams.keys()].sort().join(",") === "EIO,guestUrl,transport" &&
            parsed.searchParams.getAll("EIO").length === 1 &&
            parsed.searchParams.getAll("guestUrl").length === 1 &&
            parsed.searchParams.getAll("transport").length === 1 &&
            parsed.searchParams.get("EIO") === "4" &&
            parsed.searchParams.get("transport") === "websocket" &&
            parsed.searchParams.get("guestUrl") === "route-fixture-playlist" &&
            protocols.length === 0;
        })).toBe(true);
        expect(musicAudit.webSockets?.filter(({ closed }) => !closed)).toHaveLength(1);
        expect(musicAudit.unexpectedWebSockets ?? []).toEqual([]);
        expect(musicAudit.consoleErrors, "successful Music console").toEqual([]);
        expect(musicAudit.consoleWarnings, "successful Music warnings").toEqual([]);
        expect(musicAudit.failedRequests, "successful Music requests").toEqual([]);
      }

      const selectedLeafOperation = leafFailureOperation(route, controller.observedOperations);
      if (bootstrapOnlyRouteIds.has(route.id)) {
        expect(selectedLeafOperation, `${route.id} is explicitly bootstrap-only`).toBeUndefined();
      } else {
        expect(selectedLeafOperation, `${route.id} must expose a leaf operation`).toBeTruthy();
      }
      const failedOperation = selectedLeafOperation ?? "PublicProfileBootstrap";
      const bootstrapAttemptsBeforeFailure = controller.attempts.PublicProfileBootstrap ?? 0;
      const provesPlacesRefreshError = route.id === "places-index";
      controller.bootstrapDelayMs = bootstrapOnlyRouteIds.has(route.id) || provesPlacesRefreshError ? 800 : 0;
      controller.leafDelayMs = bootstrapOnlyRouteIds.has(route.id) ? 0 : 800;
      controller.failure = { operationName: failedOperation, status: 500 };
      const errorParams = { ...routeParams, username: `error-${route.id}` };
      const errorPath = publicRoutePath(route, errorParams);
      armMusicMountWarnings(controller, route.id);
      const errorNavigation = provesPlacesRefreshError
        ? undefined
        : page.goto(errorPath, { waitUntil: "domcontentloaded" });
      if (provesPlacesRefreshError) {
        await page.evaluate((nextPath) => {
          window.history.pushState({}, "", nextPath);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }, errorPath);
      }
      await expect(
        bootstrapOnlyRouteIds.has(route.id) || provesPlacesRefreshError
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
          : provesPlacesRefreshError
            ? "Couldn’t refresh this section"
            : "Couldn’t load this section",
      })).toBeVisible();
      if (provesPlacesRefreshError) {
        await expect(page.locator(`[data-public-route-leaf="${route.marker}"]`)).toContainText(
          ROUTE_UI_TEXT[route.id],
        );
      }
      expect(controller.failedOperations).toContain(failedOperation);
      if (route.id === "music") {
        const musicAudit = controller.networkAudit as typeof controller.networkAudit & {
          expectedConsoleErrors?: string[];
          unconsumedExpectedDiagnostics?: string[];
          unexpectedWebSockets?: Array<{ code: string; url: string }>;
        };
        const failedMusicAttempts = () => controller.failedOperations.filter(
          (operationName) => operationName === failedOperation,
        ).length;
        expect(failedMusicAttempts(), "initial request plus two bounded retries").toBe(3);
        await page.waitForTimeout(1_200);
        expect(failedMusicAttempts(), "persistent failure must stop network churn").toBe(3);
        expect(
          musicAudit.expectedConsoleErrors,
          "two exact Axios diagnostics and one exact browser resource diagnostic per failed attempt",
        ).toHaveLength(9);
        expect(
          musicAudit.unconsumedExpectedDiagnostics,
          "each armed playlist diagnostic is consumed once",
        ).toEqual([]);
        expect(musicAudit.consoleErrors, "persistent Music failure console").toEqual([]);
        expect(musicAudit.failedRequests, "persistent Music failure requests").toEqual([]);
        expect(musicAudit.unexpectedWebSockets ?? []).toEqual([]);
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
      await page.waitForLoadState("networkidle");
      armMusicMountWarnings(controller, route.id);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      controller.observedOperations.length = 0;
      controller.unknownOperations.length = 0;

      await page.goto(profilePath);
      await expect(page.locator('[data-public-route-leaf="public-profile-shell"]')).toBeVisible();
      await page.waitForLoadState("networkidle");
      armMusicMountWarnings(controller, route.id);
      await page.evaluate((nextPath) => {
        window.history.pushState({}, "", nextPath);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, path);
      await expect(page.locator(`[data-public-route-leaf="${route.marker}"]`)).toBeVisible();
      await expect(page.locator(".earth-loader-wrapper")).toHaveCount(0);
      await page.waitForLoadState("networkidle");

      armMusicMountWarnings(controller, route.id);
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
        await page.waitForLoadState("networkidle");
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
        await page.waitForLoadState("networkidle");
        controller.hiddenField = undefined;
        controller.bootstrapDelayMs = 0;
      }

      expect(controller.unknownOperations, `declared GraphQL operations for ${route.id}`).toEqual([]);
      expect(controller.networkAudit.unknownRequests, `known network surface for ${route.id}`).toEqual([]);
      expect(controller.networkAudit.consoleErrors, `clean console for ${route.id}`).toEqual([]);
      expect(
        (controller.networkAudit as typeof controller.networkAudit & { consoleWarnings?: string[] })
          .consoleWarnings,
        `clean warnings for ${route.id}`,
      ).toEqual([]);
      expect(controller.networkAudit.failedRequests, `clean failed requests for ${route.id}`).toEqual([]);
      expect(
        (controller.networkAudit as typeof controller.networkAudit & {
          unexpectedWebSockets?: Array<{ code: string; url: string }>;
        })
          .unexpectedWebSockets ?? [],
        `known WebSocket surface for ${route.id}`,
      ).toEqual([]);
      expect(
        (controller.networkAudit as typeof controller.networkAudit & { unconsumedExpectedDiagnostics?: string[] })
          .unconsumedExpectedDiagnostics,
        `all failure diagnostics consumed for ${route.id}`,
      ).toEqual([]);
      expect(
        (controller.networkAudit as typeof controller.networkAudit & {
          unconsumedExpectedWarningDiagnostics?: string[];
        }).unconsumedExpectedWarningDiagnostics,
        `all expected warnings consumed for ${route.id}`,
      ).toEqual([]);
      if (route.id === "music") {
        expect(controller.networkAudit.expectedConsoleWarnings).toHaveLength(10);
      }
      expect(
        (controller.networkAudit as typeof controller.networkAudit & {
          unconsumedExpectedResponseDiagnostics?: unknown[];
          unexpectedResponses?: unknown[];
        }).unconsumedExpectedResponseDiagnostics,
        `all expected HTTP responses consumed for ${route.id}`,
      ).toEqual([]);
      expect(
        (controller.networkAudit as typeof controller.networkAudit & {
          unexpectedResponses?: unknown[];
        }).unexpectedResponses,
        `no unarmed HTTP responses for ${route.id}`,
      ).toEqual([]);
      expect(controller.networkAudit.badResponses.filter(({ status }) => status === 500)).toHaveLength(
        route.id === "music" ? 3 : 1,
      );
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
    const oldResponseBarrier = (controller as typeof controller & {
      deferNextResponse: (
        operationName: string,
        responseLabel: string,
      ) => { started: boolean; released: boolean; returned: boolean; release: () => void };
    }).deferNextResponse("BookListBySlug", "Old books-list content");
    await page.evaluate(() => {
      const task6Window = window as typeof window & { __task6OldContentRendered?: boolean };
      task6Window.__task6OldContentRendered = false;
      new MutationObserver(() => {
        if (document.body.textContent?.includes("Old books-list content")) {
          task6Window.__task6OldContentRendered = true;
        }
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    const oldAttempts = controller.attempts.BookListBySlug ?? 0;
    await page.evaluate((nextPath) => {
      window.history.pushState({}, "", nextPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, oldPath);
    await expect.poll(() => controller.attempts.BookListBySlug ?? 0).toBeGreaterThan(oldAttempts);
    await expect.poll(() => oldResponseBarrier.started).toBe(true);
    expect(oldResponseBarrier.released).toBe(false);
    expect(oldResponseBarrier.returned, "old response is still held before current navigation").toBe(false);
    await expect(page.getByText("Old books-list content", { exact: true })).toHaveCount(0);

    controller.responseLabel = "Current books-list content";
    await page.evaluate((nextPath) => {
      window.history.pushState({}, "", nextPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, currentPath);
    await expect(page.getByText("Current books-list content", { exact: true })).toBeVisible();
    expect(await page.evaluate(() =>
      (window as typeof window & { __task6DocumentSentinel?: string }).__task6DocumentSentinel,
    )).toBe("same-document-stale-race");
    expect(oldResponseBarrier.returned, "current content wins before old response is released").toBe(false);
    oldResponseBarrier.release();
    expect(oldResponseBarrier.released).toBe(true);
    await expect.poll(() => oldResponseBarrier.returned).toBe(true);
    expect(controller.networkAudit.failedRequests).toEqual([]);
    await expect(page.getByText("Old books-list content", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Current books-list content", { exact: true })).toBeVisible();
    expect(await page.evaluate(() =>
      (window as typeof window & { __task6OldContentRendered?: boolean }).__task6OldContentRendered,
    )).toBe(false);
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
        const controller = await installPublicRouteContractFixture(page, {
          bootstrapDelayMs: 350,
          leafDelayMs: family === "profile" ? 350 : 0,
        });
        armMusicMountWarnings(controller, first.id);
        const navigation = page.goto(firstPath, { waitUntil: "domcontentloaded" });
        await expect(page.locator(".earth-loader-wrapper")).toBeVisible();
        await navigation;
        await expect(page.locator(`[data-public-route-leaf="${first.marker}"]`)).toBeVisible();
        armMusicMountWarnings(controller, first.id);
        const refresh = page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator(".earth-loader-wrapper")).toBeVisible();
        await refresh;
        await expect(page.locator(`[data-public-route-leaf="${first.marker}"]`)).toBeVisible();
        expect((controller.networkAudit as typeof controller.networkAudit & {
          unconsumedExpectedWarningDiagnostics?: string[];
        }).unconsumedExpectedWarningDiagnostics).toEqual([]);
        if (first.id === "music") {
          expect(controller.networkAudit.expectedConsoleWarnings).toHaveLength(4);
        }
        expect(controller.networkAudit.consoleWarnings).toEqual([]);
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
      const audit = controller.networkAudit as typeof controller.networkAudit & {
        expectedResponseDiagnostics?: Array<{
          operation: string;
          status: number;
          method: string;
          url: string;
        }>;
        unconsumedExpectedResponseDiagnostics?: unknown[];
        unexpectedResponses?: unknown[];
      };
      expect(audit.expectedResponseDiagnostics).toContainEqual(expect.objectContaining({
        operation: failureOperation,
        status,
        method: "POST",
        url: expect.stringMatching(/\/graphql$/),
      }));
      expect(audit.unconsumedExpectedResponseDiagnostics).toEqual([]);
      expect(audit.unexpectedResponses).toEqual([]);
    });
  }

  test("an unarmed concurrent same-tuple response cannot consume the armed request permit", async ({ page }) => {
    const controller = await installPublicRouteContractFixture(page, {
      failure: { operationName: "PublicProfileBootstrap", status: 429 },
    });
    controller.responseLabel = "armed-request";
    const armedResponse = controller.deferNextResponse(
      "PublicProfileBootstrap",
      "armed-request",
    );
    await page.route("**/graphql", async (route) => {
      if (route.request().headers()["x-task7-unarmed"] === "same-tuple") {
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({ errors: [{ message: "Unarmed concurrent fixture response" }] }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto(profilePath, { waitUntil: "domcontentloaded" });
    await expect.poll(() => armedResponse.started).toBe(true);
    expect(
      controller.networkAudit.unconsumedExpectedResponseDiagnostics,
      "the exact armed Request owns a pending response permit before its response is released",
    ).toHaveLength(1);

    const unarmedStatus = await page.evaluate(async () => fetch("/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-task7-unarmed": "same-tuple",
      },
      body: JSON.stringify({
        operationName: "PublicProfileBootstrap",
        query: "query PublicProfileBootstrap { __typename }",
      }),
    }).then((response) => response.status));
    expect(unarmedStatus).toBe(429);
    await expect.poll(() => controller.networkAudit.unexpectedResponses.length).toBe(1);
    expect(
      controller.networkAudit.unconsumedExpectedResponseDiagnostics,
      "the unarmed same-tuple Request cannot steal the armed Request permit",
    ).toHaveLength(1);
    expect(controller.networkAudit.expectedResponseDiagnostics).toEqual([]);

    armedResponse.release();
    await expect(page.getByRole("button", { name: /retry/i })).toBeVisible();
    await expect.poll(
      () => controller.networkAudit.unconsumedExpectedResponseDiagnostics,
    ).toEqual([]);
    expect(controller.networkAudit.expectedResponseDiagnostics).toHaveLength(1);
    expect(controller.networkAudit.unexpectedResponses).toHaveLength(1);
  });

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
      console.error("TASK6_ARBITRARY_CONSOLE_ERROR");
      console.warn("TASK6_ARBITRARY_CONSOLE_WARNING");
    });

    const audit = (controller as any).networkAudit;
    expect(audit.badResponses).toContainEqual(expect.objectContaining({ status: 418 }));
    expect(audit.unexpectedResponses).toContainEqual(expect.objectContaining({ status: 418 }));
    expect(audit.unknownRequests).toContainEqual(expect.objectContaining({
      url: "https://unexpected.fixture.invalid/private",
    }));
    expect(audit.consoleErrors).toContain("TASK6_ARBITRARY_CONSOLE_ERROR");
    expect(audit.consoleWarnings).toContain("TASK6_ARBITRARY_CONSOLE_WARNING");
  });

  test("Apollo warning permits are exact, one-use, query-safe, and reject duplicate or changed payloads", async ({ page }) => {
    const controller = await installPublicRouteContractFixture(page);
    await page.goto(publicRoutePath(profileRoute, routeParams));
    expect(() => controller.expectApolloUseQueryOnErrorWarnings(3)).toThrow(
      "Expected Apollo warning count must be between one and two",
    );
    armExpectedApolloUseQueryWarnings(controller, 1);

    const exactArgs = [
      "useQuery",
      "onError",
      "If your `onError` callback sets local state, switch to use derived state using `data`, `error` or `errors` returned from the hook instead. Use `useEffect` if you need to perform side-effects as a result of updates to `data`, `error` or `errors`.",
    ];
    const exactPayload = { version: "3.14.1", message: 103, args: exactArgs };
    const warning = (payload: Record<string, unknown>, search = "") =>
      `An error occurred! For more details, see the full error text at https://go.apollo.dev/c/err${search}#${encodeURIComponent(JSON.stringify(payload))}`;
    const exactWarning = warning(exactPayload);
    const changedVersion = warning({ ...exactPayload, version: "3.14.2" });
    const extraPayload = warning({ ...exactPayload, extra: "lookalike" });
    const secretQuery = warning(exactPayload, "?token=TASK6_SECRET_SENTINEL");
    const recordWarning = (controller as RouteContractFixtureController & {
      recordConsoleWarningForTest?: (message: string) => void;
    }).recordConsoleWarningForTest;
    expect(
      typeof recordWarning,
      "fixture exposes a sanitized non-console path for warning-audit adversaries",
    ).toBe("function");
    for (const message of [exactWarning, exactWarning, changedVersion, extraPayload, secretQuery]) {
      recordWarning?.(message);
    }

    const audit = controller.networkAudit as typeof controller.networkAudit & {
      unconsumedExpectedWarningDiagnostics?: string[];
    };
    expect(audit.expectedConsoleWarnings).toHaveLength(1);
    expect(audit.unconsumedExpectedWarningDiagnostics).toEqual([]);
    expect(audit.consoleWarnings).toEqual([
      "UNARMED_APOLLO_WARNING",
      "UNEXPECTED_APOLLO_WARNING",
      "UNEXPECTED_APOLLO_WARNING",
      "UNEXPECTED_APOLLO_WARNING",
    ]);
    expect(JSON.stringify(audit)).not.toContain("TASK6_SECRET_SENTINEL");
  });

  test("diagnostic helpers classify Apollo lookalikes and redact URL credentials, query, and hash", async () => {
    const fixtureModule = await import("./support/publicProfileFixture");
    const helpers = fixtureModule as typeof fixtureModule & {
      classifyApolloUseQueryOnErrorWarning?: (message: string) => "expected" | "unexpected" | "other";
      redactDiagnosticUrl?: (url: string) => string;
      redactDiagnosticText?: (message: string) => string;
    };
    expect(typeof helpers.classifyApolloUseQueryOnErrorWarning).toBe("function");
    expect(typeof helpers.redactDiagnosticUrl).toBe("function");
    expect(typeof helpers.redactDiagnosticText).toBe("function");

    const secret = "TASK7_PURE_HELPER_SECRET";
    const rawUrl = `https://fixture-user:${secret}@fixture.invalid/path?token=${secret}#${secret}`;
    expect(helpers.redactDiagnosticUrl!(rawUrl)).toBe("https://fixture.invalid/path");
    expect(helpers.redactDiagnosticText!(`request failed at ${rawUrl}`)).toBe(
      "request failed at https://fixture.invalid/path",
    );

    const payload = encodeURIComponent(JSON.stringify({
      version: "3.14.1",
      message: 103,
      args: [
        "useQuery",
        "onError",
        "If your `onError` callback sets local state, switch to use derived state using `data`, `error` or `errors` returned from the hook instead. Use `useEffect` if you need to perform side-effects as a result of updates to `data`, `error` or `errors`.",
      ],
    }));
    const secretBearingLookalike =
      `An error occurred! For more details, see the full error text at https://go.apollo.dev/c/err?token=${secret}#${payload}`;
    expect(helpers.classifyApolloUseQueryOnErrorWarning!(secretBearingLookalike)).toBe("unexpected");
  });

  test("rejected browser diagnostics never retain URL secrets and keep stable redacted codes", async ({ page }) => {
    const controller = await installPublicRouteContractFixture(page);
    await page.route("**/e2e-secret-response*", (route) => route.fulfill({
      status: 418,
      contentType: "application/json",
      body: "{}",
    }));
    await page.goto(profilePath);

    const secret = "TASK7_BROWSER_DIAGNOSTIC_SECRET";
    await page.evaluate(async (secretValue) => {
      await fetch(`/e2e-secret-response?token=${secretValue}#${secretValue}`);
      await fetch(`https://unexpected.fixture.invalid/private?token=${secretValue}#${secretValue}`)
        .catch(() => undefined);
      new WebSocket(`wss://unexpected.fixture.invalid/socket?token=${secretValue}`);
    }, secret);

    const audit = controller.networkAudit as unknown as {
      unexpectedResponses: Array<{ code: string; url: string; status: number }>;
      badResponses: Array<{ url: string; status: number }>;
      unknownRequests: Array<{ code: string; url: string }>;
      failedRequests: Array<{ code: string; url: string }>;
      unexpectedWebSockets: Array<{ code: string; url: string }>;
    };
    await expect.poll(() => audit.unexpectedResponses.length).toBe(1);
    await expect.poll(() => audit.unexpectedWebSockets.length).toBe(1);
    await expect.poll(() => audit.unknownRequests.length).toBe(1);
    expect(
      JSON.stringify(controller.networkAudit).includes(secret),
      "no in-memory diagnostic may retain the raw URL secret",
    ).toBe(false);
    expect(audit.unexpectedResponses).toContainEqual(expect.objectContaining({
      code: "UNEXPECTED_HTTP_RESPONSE",
      url: expect.stringMatching(/\/e2e-secret-response$/),
      status: 418,
    }));
    expect(audit.unknownRequests).toContainEqual(expect.objectContaining({
      code: "UNKNOWN_REQUEST",
      url: "https://unexpected.fixture.invalid/private",
    }));
    expect(audit.unexpectedWebSockets).toContainEqual({
      code: "UNEXPECTED_WEBSOCKET",
      url: "wss://unexpected.fixture.invalid/socket",
    });
  });

  test("every unarmed local HTTP failure is audited across API and asset status families", async ({ page }) => {
    const controller = await installPublicRouteContractFixture(page);
    await page.goto(publicRoutePath(profileRoute, routeParams));
    await page.route("**/e2e-local-api-401", (route) =>
      route.fulfill({ status: 401, contentType: "application/json", body: "{}" }));
    await page.route("**/e2e-local-api-429", (route) =>
      route.fulfill({ status: 429, contentType: "application/json", body: "{}" }));
    await page.route("**/e2e-local-asset-404.svg", (route) =>
      route.fulfill({ status: 404, contentType: "image/svg+xml", body: "<svg/>" }));

    await page.evaluate(async () => {
      await fetch("/e2e-local-api-401");
      await fetch("/e2e-local-api-429");
      await new Promise<void>((resolve) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => resolve();
        image.src = "/e2e-local-asset-404.svg";
      });
    });

    const audit = controller.networkAudit as typeof controller.networkAudit & {
      unexpectedResponses?: Array<{ url: string; status: number }>;
    };
    await expect.poll(() => audit.unexpectedResponses?.length ?? 0).toBe(3);
    expect(audit.unexpectedResponses).toEqual([
      expect.objectContaining({ url: expect.stringMatching(/\/e2e-local-api-401$/), status: 401 }),
      expect.objectContaining({ url: expect.stringMatching(/\/e2e-local-api-429$/), status: 429 }),
      expect.objectContaining({ url: expect.stringMatching(/\/e2e-local-asset-404\.svg$/), status: 404 }),
    ]);
  });

  test("LocalTunes WebSocket allowance rejects same-host lookalikes with query, port, scheme, or protocol drift", async ({ page }) => {
    const controller = await installPublicRouteContractFixture(page);
    await page.goto(publicRoutePath(profileRoute, routeParams));
    const base = "ws://localtunes.earth/socket.io/?EIO=4&transport=websocket&guestUrl=route-fixture-playlist";
    const lookalikes = [
      `${base}&token=TASK6_SECRET_SENTINEL`,
      "ws://localtunes.earth:444/socket.io/?EIO=4&transport=websocket&guestUrl=route-fixture-playlist",
      "wss://localtunes.earth/socket.io/?EIO=4&transport=websocket&guestUrl=route-fixture-playlist",
    ];
    await page.evaluate(({ urls, protocolUrl }) => {
      for (const url of urls) new WebSocket(url);
      new WebSocket(protocolUrl, "graphql-ws");
    }, { urls: lookalikes, protocolUrl: base });

    const audit = controller.networkAudit as typeof controller.networkAudit & {
      unexpectedWebSockets?: Array<{ code: string; url: string }>;
    };
    await expect.poll(() => audit.unexpectedWebSockets?.length ?? 0).toBe(4);
    expect(audit.unexpectedWebSockets).toEqual([
      { code: "UNEXPECTED_WEBSOCKET", url: "ws://localtunes.earth/socket.io/" },
      { code: "UNEXPECTED_WEBSOCKET", url: "ws://localtunes.earth:444/socket.io/" },
      { code: "UNEXPECTED_WEBSOCKET", url: "wss://localtunes.earth/socket.io/" },
      { code: "UNEXPECTED_WEBSOCKET", url: "ws://localtunes.earth/socket.io/" },
    ]);
  });

  test("network audit records only the exact Vite HMR socket and blocks a localhost lookalike", async ({ page }) => {
    const controller = await installPublicRouteContractFixture(page);
    await page.goto(publicRoutePath(profileRoute, routeParams));

    const audit = controller.networkAudit as typeof controller.networkAudit & {
      viteWebSockets?: Array<{ url: string; protocols: string[] }>;
      unexpectedWebSockets?: Array<{ code: string; url: string }>;
    };
    await expect.poll(() => audit.viteWebSockets?.length ?? 0).toBe(1);
    const appUrl = new URL(page.url());
    const viteUrl = new URL(audit.viteWebSockets![0].url);
    expect(viteUrl.hostname).toBe(appUrl.hostname);
    expect(viteUrl.port).toBe(appUrl.port);
    expect(viteUrl.pathname).toBe("/");
    expect([...viteUrl.searchParams.keys()]).toEqual(["token"]);
    expect(viteUrl.searchParams.get("token")).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(audit.viteWebSockets![0].protocols).toEqual(["vite-hmr"]);

    const unexpectedLocalUrl = await page.evaluate(() => {
      const target = new URL(window.location.href);
      target.protocol = target.protocol === "https:" ? "wss:" : "ws:";
      target.pathname = "/unexpected-local-socket";
      target.search = "";
      new WebSocket(target.href);
      return target.href;
    });
    await expect.poll(() => audit.unexpectedWebSockets ?? []).toContainEqual({
      code: "UNEXPECTED_WEBSOCKET",
      url: unexpectedLocalUrl,
    });
    expect(audit.consoleErrors).toEqual([]);
  });

  test("network audit blocks and reports an unexpected WebSocket", async ({ page }) => {
    const controller = await installPublicRouteContractFixture(page);
    await page.goto(publicRoutePath(profileRoute, routeParams));

    await page.evaluate(() => {
      new WebSocket("wss://unexpected.fixture.invalid/socket");
    });

    const audit = controller.networkAudit as typeof controller.networkAudit & {
      unexpectedWebSockets?: Array<{ code: string; url: string }>;
    };
    await expect.poll(() => audit.unexpectedWebSockets ?? []).toContainEqual({
      code: "UNEXPECTED_WEBSOCKET",
      url: "wss://unexpected.fixture.invalid/socket",
    });
    expect(audit.failedRequests).toEqual([]);
    expect(audit.consoleErrors).toEqual([]);
  });

  test("an additional unarmed playlist 500 cannot consume a prior expected diagnostic", async ({ page }) => {
    const controller = await installPublicRouteContractFixture(page);
    const musicRoute = publicRouteContract.find((route) => route.id === "music")!;
    armExpectedApolloUseQueryWarnings(controller);
    await page.goto(publicRoutePath(musicRoute, routeParams));
    await expect(page.locator(`[data-public-route-leaf="${musicRoute.marker}"]`)).toBeVisible();
    controller.failure = { operationName: "PublicMusicPlaylist", status: 500 };
    armExpectedApolloUseQueryWarnings(controller);
    await page.goto(publicRoutePath(musicRoute, {
      ...routeParams,
      username: "extra-playlist-diagnostic",
    }));
    await expect(page.getByRole("button", { name: /retry/i })).toBeVisible();
    await expect.poll(() => controller.failedOperations.filter(
      (operation) => operation === "PublicMusicPlaylist",
    ).length).toBe(3);
    const audit = controller.networkAudit as typeof controller.networkAudit & {
      unconsumedExpectedDiagnostics?: string[];
      unconsumedExpectedWarningDiagnostics?: string[];
    };
    await expect.poll(() => audit.unconsumedExpectedDiagnostics).toEqual([]);
    expect(audit.unconsumedExpectedWarningDiagnostics).toEqual([]);
    expect(audit.consoleWarnings).toEqual([]);
    expect(audit.consoleErrors).toEqual([]);
    expect(audit.expectedResponseDiagnostics).toHaveLength(3);
    expect(audit.unconsumedExpectedResponseDiagnostics).toEqual([]);
    expect(audit.unexpectedResponses).toEqual([]);

    controller.failure = undefined;
    await page.goto("/about");
    await page.waitForLoadState("networkidle");
    await page.route("http://localhost:5000/api/playlist/route-fixture-playlist", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );
    await page.evaluate(() => fetch(
      "http://localhost:5000/api/playlist/route-fixture-playlist",
    ).catch(() => undefined));

    await expect.poll(() => audit.consoleErrors).toContain(
      "UNARMED_FAILURE_DIAGNOSTIC:playlist:RESOURCE",
    );
    await expect.poll(() => audit.unexpectedResponses).toContainEqual(expect.objectContaining({
      operation: "PublicMusicPlaylist",
      status: 500,
    }));
  });

  test("an additional unarmed GraphQL 500 cannot consume a prior expected diagnostic", async ({ page }) => {
    const controller = await installPublicRouteContractFixture(page, {
      failure: { operationName: "PublicProfileBootstrap", status: 500 },
    });
    await page.goto(publicRoutePath(profileRoute, routeParams));
    await expect(page.getByRole("button", { name: /retry/i })).toBeVisible();
    const audit = controller.networkAudit as typeof controller.networkAudit & {
      unconsumedExpectedDiagnostics?: string[];
    };
    await expect.poll(() => audit.unconsumedExpectedDiagnostics).toEqual([]);
    expect(audit.consoleErrors).toEqual([]);
    expect(audit.expectedResponseDiagnostics).toHaveLength(1);
    expect(audit.unconsumedExpectedResponseDiagnostics).toEqual([]);
    expect(audit.unexpectedResponses).toEqual([]);

    await page.goto("/about");
    await page.waitForLoadState("networkidle");
    await page.route("**/graphql", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );
    await page.evaluate(() => fetch("/graphql", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operationName: "PublicProfileBootstrap",
        query: "query PublicProfileBootstrap { __typename }",
      }),
    }).catch(() => undefined));

    await expect.poll(() => audit.consoleErrors).toContain(
      "UNARMED_FAILURE_DIAGNOSTIC:graphql:RESOURCE",
    );
    await expect.poll(() => audit.unexpectedResponses).toContainEqual(expect.objectContaining({
      operation: "PublicProfileBootstrap",
      status: 500,
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
    expect(controller.networkAudit.unexpectedResponses).toHaveLength(3);
    expect(controller.networkAudit.unexpectedResponses.every(({ status }) => status === 400)).toBe(true);
  });
});
