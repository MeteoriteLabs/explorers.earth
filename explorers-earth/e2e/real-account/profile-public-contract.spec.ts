import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { publicRouteContract, publicRoutePath } from "../../src/routes/publicRouteContract";
import { installConsoleNetworkAudit } from "../support/consoleNetworkAudit";
import {
  pickAllowlistedProfileState,
  removeVerifiedProfileBackup,
  runProtectedProfileMutation,
  writeProtectedProfileBackup,
} from "../support/liveProfileWriteSafety";

const username = () => process.env.E2E_PROFILE_USERNAME!;
const runId = () => process.env.PUBLIC_API_RUN_ID!;
const storageState = () => process.env.E2E_PROFILE_STORAGE_STATE!;
const routeParams = () => ({
  username: username(),
  placeSlug: process.env.E2E_PROFILE_PLACE_SLUG ?? "unavailable",
  place: process.env.E2E_PROFILE_PLACE_SLUG ?? "unavailable",
  guideSlug: process.env.E2E_PROFILE_GUIDE_SLUG ?? "unavailable",
  genreSlug: process.env.E2E_PROFILE_GENRE_SLUG ?? "unavailable",
  subjectSlug: process.env.E2E_PROFILE_SUBJECT_SLUG ?? "unavailable",
  sectorSlug: process.env.E2E_PROFILE_SECTOR_SLUG ?? "unavailable",
  listSlug: process.env.E2E_PROFILE_LIST_SLUG ?? "unavailable",
});

async function verifyPublicRoute(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `HTTP success for ${path}`).toBeLessThan(400);
  await expect(page.locator(".earth-loader-wrapper")).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByRole("button", { name: /retry/i })).toHaveCount(0);
  await expect(page.locator("main, [data-public-route-leaf]").first()).toBeVisible();
}

async function publicAccountState(page: Page) {
  const responsePromise = page.waitForResponse((response) => {
    const request = response.request();
    return request.method() === "POST" && /\/graphql(?:\?|$)/.test(response.url()) &&
      request.postData()?.includes("PublicProfileBootstrap") === true;
  });
  await page.goto(`/${encodeURIComponent(username())}`);
  const payload = await (await responsePromise).json() as { data?: { accounts?: Array<Record<string, unknown>> } };
  const account = payload.data?.accounts?.[0];
  if (!account) throw new Error("PUBLIC_ACCOUNT_STATE_UNAVAILABLE");
  return pickAllowlistedProfileState(account);
}

async function authenticatedContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ storageState: storageState() });
}

test("@read-only clean guest opens every enabled public route at mobile and desktop", async ({ page }) => {
  const audit = installConsoleNetworkAudit(page);
  try {
    for (const viewport of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      await verifyPublicRoute(page, `/${encodeURIComponent(username())}`);
      const visiblePaths = new Set(await page.locator(`a[href^="/${username()}/"]`).evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).pathname)));
      for (const route of publicRouteContract) {
        const path = publicRoutePath(route, routeParams());
        if (route.id === "profile" || (!path.includes("unavailable") && visiblePaths.has(path))) {
          await verifyPublicRoute(page, path);
        }
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.goBack({ waitUntil: "domcontentloaded" }).catch(() => null);
      await page.goForward({ waitUntil: "domcontentloaded" }).catch(() => null);
    }
    audit.assertClean();
  } finally {
    audit.stop();
  }
});

test("@read-only invalid public paths preserve a usable canonical profile", async ({ page }) => {
  await page.goto(`/${encodeURIComponent(username())}/definitely-unsupported?qa=1#profile`);
  await expect(page).toHaveURL(new RegExp(`/${username()}\\?qa=1#profile$`));
  await expect(page.locator('[data-public-route-leaf="public-profile-shell"]')).toBeVisible();
});

const HIGH_RISK_GROUPS = [
  "absent-hero",
  "broken-hero",
  "full-wallpaper-dark",
  "banner-light",
  "ambient-gradient",
  "long-rich-bio",
  "reordered-categories",
  "gallery-social-visibility",
] as const;

test("@mutation serialized dashboard-to-public groups always restore their allowlisted baseline", async ({ browser }) => {
  test.slow();
  const context = await authenticatedContext(browser);
  const dashboard = await context.newPage();
  const publicPage = await browser.newPage();
  try {
    for (const group of HIGH_RISK_GROUPS) {
      let artifact = "";
      await runProtectedProfileMutation({
        captureExactState: () => publicAccountState(publicPage),
        captureMutationTemplate: async () => ({ group }),
        backup: async (state) => { artifact = await writeProtectedProfileBackup({ runId: runId(), group, state }); },
        mutate: async () => {
          await dashboard.goto("/profile");
          const target = dashboard.locator(`[data-protected-profile-case="${group}"]`);
          if (await target.count() !== 1) throw new Error(`PROTECTED_UI_CONTRACT_MISSING:${group}`);
          await target.click();
          await dashboard.getByRole("button", { name: /save|publish/i }).click();
          await dashboard.waitForResponse((response) => response.request().postData()?.includes("UpdateAccount") === true && response.ok());
        },
        verifyMutation: async () => { await verifyPublicRoute(publicPage, `/${encodeURIComponent(username())}`); },
        normalRestore: async () => {
          const restore = dashboard.getByTestId("protected-profile-restore-baseline");
          if (await restore.count() !== 1) throw new Error("RESTORE_CONTROL_UNAVAILABLE");
          await restore.click();
          await dashboard.waitForResponse((response) => response.request().postData()?.includes("UpdateAccount") === true && response.ok());
        },
        emergencyRestore: async () => {
          throw new Error("RESTORE_FAILED");
        },
        verifyRestored: async (expected) => {
          expect(await publicAccountState(publicPage)).toEqual(expected);
          await removeVerifiedProfileBackup(artifact);
        },
      });
    }
  } finally {
    await context.close();
    await publicPage.close();
  }
});

test("@mutation guest, owner, and non-owner analytics remain run-scoped and cleanup-gated", async ({ browser }) => {
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext({ storageState: storageState() }),
    process.env.E2E_PROFILE_NON_OWNER_STORAGE_STATE
      ? browser.newContext({ storageState: process.env.E2E_PROFILE_NON_OWNER_STORAGE_STATE })
      : Promise.reject(new Error("ENV_MISSING: E2E_PROFILE_NON_OWNER_STORAGE_STATE")),
  ]);
  try {
    for (const context of contexts) {
      const page = await context.newPage();
      await verifyPublicRoute(page, `/${encodeURIComponent(username())}`);
    }
    if (!/^qa[-_]/i.test(runId())) throw new Error("ANALYTICS_CANARY_REQUIRED");
    // The API preflight owns write, sink verification, and finally-cleanup. A browser
    // journey may only succeed after that independently scoped lifecycle is READY.
    expect(process.env.PUBLIC_API_ANALYTICS_QA_SINK).toMatch(/^qa[-_]/i);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
