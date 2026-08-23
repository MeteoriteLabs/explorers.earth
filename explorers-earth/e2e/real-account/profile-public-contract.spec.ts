import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { publicRouteContract, publicRoutePath } from "../../src/routes/publicRouteContract";
import { PUBLIC_RUNTIME_OPERATION_CAPABILITIES } from "../../scripts/public-api-capabilities.mjs";
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
interface RouteFixtures {
  params: Record<string, string>;
  enabledRouteIds: string[];
  hiddenPath: string;
  deletedPath: string;
  unknownUsername: string;
}

const routeFixtures = (): RouteFixtures => {
  try {
    const value = JSON.parse(process.env.E2E_PROFILE_ROUTE_FIXTURES ?? "") as RouteFixtures;
    if (!value.params || !Array.isArray(value.enabledRouteIds)) throw new Error("shape");
    return value;
  } catch {
    throw new Error("ROUTE_FIXTURE_INVALID");
  }
};
const routeParams = () => ({ username: username(), ...routeFixtures().params });

async function verifyPublicRoute(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `HTTP success for ${path}`).toBeLessThan(400);
  await expect(page.locator(".earth-loader-wrapper")).toHaveCount(0, { timeout: 60_000 });
  await expect(page.getByRole("button", { name: /retry/i })).toHaveCount(0);
  await expect(page.locator("main, [data-public-route-leaf]").first()).toBeVisible();
}

async function publicAccountState(page: Page) {
  const responseFor = (operation: string) => page.waitForResponse((response) => {
    const request = response.request();
    return request.method() === "POST" && /\/graphql(?:\?|$)/.test(response.url()) &&
      request.postData()?.includes(operation) === true;
  });
  const bootstrapPromise = responseFor("PublicProfileBootstrap");
  const contentPromise = responseFor("PublicProfileContent");
  await page.goto(`/${encodeURIComponent(username())}`);
  const payloads = await Promise.all([bootstrapPromise, contentPromise].map(async (pending) =>
    (await (await pending).json()) as { data?: { account?: Record<string, unknown>; accounts?: Array<Record<string, unknown>> } }));
  const accounts = payloads.map((payload) => payload.data?.accounts?.[0] ?? payload.data?.account).filter(Boolean) as Array<Record<string, unknown>>;
  if (accounts.length !== 2) throw new Error("PUBLIC_ACCOUNT_STATE_UNAVAILABLE");
  return pickAllowlistedProfileState(Object.assign({}, ...accounts));
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
      const fixtures = routeFixtures();
      for (const route of publicRouteContract) {
        const path = publicRoutePath(route, routeParams());
        if (!fixtures.enabledRouteIds.includes(route.id)) continue;
        const before = audit.entries.length;
        await verifyPublicRoute(page, path);
        const capabilities = new Set(audit.entries.slice(before).map((entry) =>
          PUBLIC_RUNTIME_OPERATION_CAPABILITIES.get(entry.operation)).filter(Boolean));
        for (const required of route.requiredOperations) {
          expect(capabilities, `${route.id} required operation ${required}`).toContain(required);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
      if (viewport.width === 375) {
        const firstControl = page.getByRole("button").first();
        const box = await firstControl.boundingBox();
        if (!box) throw new Error("TOUCH_TARGET_MISSING");
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      }
      expect((await page.screenshot()).byteLength).toBeGreaterThan(1_000);
      const current = page.url();
      await page.reload({ waitUntil: "domcontentloaded" });
      expect(page.url()).toBe(current);
      await page.goto(`/${encodeURIComponent(username())}`);
      await page.goto(current);
      const back = await page.goBack({ waitUntil: "domcontentloaded" });
      expect(back?.ok()).toBe(true);
      await expect(page).toHaveURL(new RegExp(`/${username()}$`));
      const forward = await page.goForward({ waitUntil: "domcontentloaded" });
      expect(forward?.ok()).toBe(true);
      await expect(page).toHaveURL(current);
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

test("@read-only hidden, deleted, and unknown resources have distinct terminal behavior", async ({ page }) => {
  const fixtures = routeFixtures();
  for (const path of [fixtures.hiddenPath, fixtures.deletedPath]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/${username()}(?:[?#]|$)`));
    await expect(page.locator('[data-public-route-leaf="public-profile-shell"]')).toBeVisible();
  }
  await page.goto(`/${encodeURIComponent(fixtures.unknownUsername)}`);
  await expect(page.getByText(/not found/i)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/${fixtures.unknownUsername}$`));
});

for (const status of [401, 403, 429, 500]) {
  test(`@read-only HTTP ${status} remains on the requested route and Retry recovers`, async ({ page }) => {
    const route = publicRouteContract.find((candidate) =>
      candidate.id !== "profile" && routeFixtures().enabledRouteIds.includes(candidate.id));
    if (!route) throw new Error("ROUTE_FIXTURE_INVALID:no-enabled-leaf");
    const path = publicRoutePath(route, routeParams());
    await page.route("**/graphql", (request) => request.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ errors: [{ extensions: { code: `HTTP_${status}` } }] }),
    }));
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(path);
    const retry = page.getByRole("button", { name: /retry/i });
    await expect(retry).toBeVisible();
    await page.unroute("**/graphql");
    await retry.click();
    await expect(page.locator(`[data-public-route-leaf="${route.marker}"]`)).toBeVisible();
    await expect(page).toHaveURL(path);
  });
}

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

interface EditorSnapshot {
  preset: string;
  accent: string;
  wallpaper: string;
  firstView: string;
  footer: string;
  layout: string;
  visibleTabs: boolean[];
  bioHtml: string;
  categoryOrder: string[];
  instagramActive: boolean;
  instagramLink: string;
  galleryCount: number;
}

async function openEditorWorkspace(page: Page, tab: "Profile" | "Gallery" | "Appearance") {
  if (new URL(page.url()).pathname !== "/profile") {
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
  }
  await page.getByRole("tab", { name: tab, exact: true }).click();
}

async function captureEditorSnapshot(page: Page): Promise<EditorSnapshot> {
  await openEditorWorkspace(page, "Appearance");
  const preset = await page.locator("[data-theme-preset][aria-pressed=true]").getAttribute("data-theme-preset");
  if (!preset) throw new Error("RESTORE_PLAN_INCOMPLETE:preset");
  const appearance = page.getByTestId("appearance-workspace");
  const categoryOrder = await appearance.locator("[data-category-id]").evaluateAll((nodes) =>
    [...new Set(nodes.map((node) => node.getAttribute("data-category-id")).filter((id): id is string => Boolean(id)))],
  );
  const wallpaper = await page.locator("#theme-wallpaper-mode").inputValue();
  const firstView = await page.locator("#theme-first-view").inputValue();
  const footer = await page.locator("#theme-footer-branding").inputValue();
  const accent = await page.locator('section[aria-labelledby="accent-color-title"] button[aria-pressed=true]').getAttribute("aria-label");
  const layout = await page.locator('input[name="recommendations-layout"]:checked').inputValue();
  const visibleTabs = await page.locator('fieldset:has(legend:text("Public sections")) input[type="checkbox"]').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLInputElement).checked));
  if (!accent || visibleTabs.length !== 3) throw new Error("RESTORE_PLAN_INCOMPLETE:appearance-fields");
  await openEditorWorkspace(page, "Profile");
  const bio = page.locator('[data-field="bio"] [contenteditable=true]');
  await expect(bio).toBeVisible();
  const instagramInput = page.locator('input[name="instagramLink"]');
  const instagramActive = await instagramInput.count() === 1;
  const instagramLink = instagramActive ? await instagramInput.inputValue() : "";
  await openEditorWorkspace(page, "Gallery");
  const galleryCount = await page.getByRole("button", { name: /^Remove / }).count();
  return {
    preset,
    accent,
    wallpaper,
    firstView,
    footer,
    layout,
    visibleTabs,
    bioHtml: await bio.innerHTML(),
    categoryOrder,
    instagramActive,
    instagramLink,
    galleryCount,
  };
}

async function assertRestoreControlsReady(page: Page, snapshot: EditorSnapshot) {
  await openEditorWorkspace(page, "Appearance");
  await expect(page.locator(`[data-theme-preset="${snapshot.preset}"]`)).toBeEnabled();
  await expect(page.getByRole("button", { name: snapshot.accent, exact: true })).toBeEnabled();
  await expect(page.locator(`input[name="recommendations-layout"][value="${snapshot.layout}"]`)).toBeEnabled();
  for (const [selector, value] of [
    ["#theme-wallpaper-mode", snapshot.wallpaper],
    ["#theme-first-view", snapshot.firstView],
    ["#theme-footer-branding", snapshot.footer],
  ] as const) {
    const control = page.locator(selector);
    await expect(control).toBeEnabled();
    expect(await control.locator(`option[value="${value}"]`).count()).toBe(1);
  }
  for (const id of snapshot.categoryOrder) {
    await expect(page.locator(`[data-category-id="${id}"] .appearance-drag-handle`).first()).toBeEnabled();
  }
  await openEditorWorkspace(page, "Profile");
  await expect(page.locator('[data-field="bio"] [contenteditable=true]')).toBeEditable();
  await expect(page.getByRole("button", { name: "Instagram", exact: true })).toBeEnabled();
  await openEditorWorkspace(page, "Gallery");
  expect(await page.getByRole("button", { name: /^Remove / }).count()).toBe(snapshot.galleryCount);
}

async function saveProfile(page: Page) {
  const mutation = page.waitForResponse((response) =>
    response.request().postData()?.includes("UpdateAccount") === true,
  );
  await page.getByRole("button", { name: /save and publish/i }).click();
  const response = await mutation;
  if (!response.ok()) throw new Error(`PROFILE_SAVE_HTTP_${response.status()}`);
  const payload = await response.json() as { errors?: unknown[]; data?: { updateAccount?: unknown } };
  if (payload.errors?.length || !payload.data?.updateAccount) throw new Error("PROFILE_SAVE_NOT_CONFIRMED");
}

async function restoreEditorSnapshot(page: Page, snapshot: EditorSnapshot) {
  await openEditorWorkspace(page, "Appearance");
  await page.locator(`[data-theme-preset="${snapshot.preset}"]`).click();
  await page.getByRole("button", { name: snapshot.accent, exact: true }).click();
  await page.locator("#theme-wallpaper-mode").selectOption(snapshot.wallpaper);
  await page.locator("#theme-first-view").selectOption(snapshot.firstView);
  await page.locator("#theme-footer-branding").selectOption(snapshot.footer);
  await page.locator(`input[name="recommendations-layout"][value="${snapshot.layout}"]`).check();
  const visibleControls = page.locator('fieldset:has(legend:text("Public sections")) input[type="checkbox"]');
  for (let index = 0; index < snapshot.visibleTabs.length; index += 1) {
    if (await visibleControls.nth(index).isChecked() !== snapshot.visibleTabs[index]) await visibleControls.nth(index).click();
  }
  const current = await page.locator(".appearance-category-list [data-category-id]").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("data-category-id")).filter((id): id is string => Boolean(id)),
  );
  for (let target = 0; target < snapshot.categoryOrder.length; target += 1) {
    const id = snapshot.categoryOrder[target];
    let index = current.indexOf(id);
    if (index < 0) throw new Error(`RESTORE_PLAN_INCOMPLETE:category:${id}`);
    const handle = page.locator(`[data-category-id="${id}"] .appearance-drag-handle`).first();
    while (index > target) {
      await handle.press("Enter");
      await handle.press("ArrowUp");
      await handle.press("Enter");
      current.splice(index, 1);
      current.splice(index - 1, 0, id);
      index -= 1;
    }
  }
  await openEditorWorkspace(page, "Profile");
  const bio = page.locator('[data-field="bio"] [contenteditable=true]');
  await bio.evaluate((element, html) => {
    element.innerHTML = html;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  }, snapshot.bioHtml);
  const instagramInput = page.locator('input[name="instagramLink"]');
  const currentInstagramActive = await instagramInput.count() === 1;
  if (currentInstagramActive !== snapshot.instagramActive) {
    await page.getByRole("button", { name: "Instagram", exact: true }).click();
  }
  if (snapshot.instagramActive) await page.locator('input[name="instagramLink"]').fill(snapshot.instagramLink);
  await openEditorWorkspace(page, "Gallery");
  let galleryCount = await page.getByRole("button", { name: /^Remove / }).count();
  if (galleryCount < snapshot.galleryCount) throw new Error("RESTORE_PLAN_INCOMPLETE:gallery-item-removed");
  while (galleryCount > snapshot.galleryCount) {
    await page.getByRole("button", { name: /^Remove / }).last().click();
    galleryCount -= 1;
  }
  await saveProfile(page);
}

async function applyHighRiskGroup(page: Page, group: (typeof HIGH_RISK_GROUPS)[number]) {
  if (group === "long-rich-bio") {
    await openEditorWorkspace(page, "Profile");
    await page.locator('[data-field="bio"] [contenteditable=true]').evaluate((editor) => {
      editor.innerHTML = "<p>A long QA biography with <strong>bold travel notes</strong>, accessible links, and enough content to verify responsive public rendering across mobile and desktop.</p>";
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    });
  } else if (group === "reordered-categories") {
    await openEditorWorkspace(page, "Appearance");
    const handle = page.locator(".appearance-category-list .appearance-drag-handle").last();
    await handle.press("Enter");
    await handle.press("Home");
    await handle.press("Enter");
  } else if (group === "gallery-social-visibility") {
    const galleryFile = process.env.E2E_PROFILE_GALLERY_FILE;
    if (!galleryFile) throw new Error("ENV_MISSING: E2E_PROFILE_GALLERY_FILE");
    await openEditorWorkspace(page, "Gallery");
    await page.locator('input[type="file"]').first().setInputFiles(galleryFile);
    await openEditorWorkspace(page, "Profile");
    await page.getByRole("button", { name: "Instagram", exact: true }).click();
    await page.locator('input[name="instagramLink"]').fill("https://instagram.com/explorers.qa");
  } else {
    await openEditorWorkspace(page, "Appearance");
    if (group === "absent-hero") await page.locator("#theme-wallpaper-mode").selectOption("solid-color");
    if (group === "broken-hero") await page.locator("#theme-wallpaper-mode").selectOption("banner-top");
    if (group === "full-wallpaper-dark") {
      await page.locator('[data-theme-preset="cinematic-dark"]').click();
      await page.getByRole("button", { name: "Royal Purple", exact: true }).click();
      await page.locator("#theme-wallpaper-mode").selectOption("full-wallpaper-image");
      await page.locator("#theme-first-view").selectOption("music");
      await page.locator("#theme-footer-branding").selectOption("minimal");
      await page.locator('input[name="recommendations-layout"][value="featured"]').check();
    }
    if (group === "banner-light") {
      await page.locator('[data-theme-preset="minimal-light"]').click();
      await page.locator("#theme-wallpaper-mode").selectOption("banner-top");
      await page.locator('input[name="recommendations-layout"][value="grid"]').check();
      const business = page.getByRole("checkbox", { name: "Business Details", exact: true });
      if (await business.isChecked()) await business.click();
    }
    if (group === "ambient-gradient") await page.locator("#theme-wallpaper-mode").selectOption("ambient-gradient");
  }
  await saveProfile(page);
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function verifyPersistedGroup(dashboard: Page, publicPage: Page, group: (typeof HIGH_RISK_GROUPS)[number]) {
  const wallpaperByGroup: Partial<Record<(typeof HIGH_RISK_GROUPS)[number], string>> = {
    "absent-hero": "solid-color", "broken-hero": "banner-top",
    "full-wallpaper-dark": "full-wallpaper-image", "banner-light": "banner-top",
    "ambient-gradient": "ambient-gradient",
  };
  const expectedWallpaper = wallpaperByGroup[group];
  if (expectedWallpaper) {
    await openEditorWorkspace(dashboard, "Appearance");
    await expect(dashboard.locator("#theme-wallpaper-mode")).toHaveValue(expectedWallpaper);
    if (group === "full-wallpaper-dark") await expect(dashboard.locator('[data-theme-preset="cinematic-dark"]')).toHaveAttribute("aria-pressed", "true");
    if (group === "banner-light") await expect(dashboard.locator('[data-theme-preset="minimal-light"]')).toHaveAttribute("aria-pressed", "true");
    if (group === "full-wallpaper-dark") {
      await expect(dashboard.locator("#theme-first-view")).toHaveValue("music");
      await expect(dashboard.locator("#theme-footer-branding")).toHaveValue("minimal");
      await expect(dashboard.locator('input[name="recommendations-layout"][value="featured"]')).toBeChecked();
      await expect(publicPage.getByTestId("recommendations-featured")).toBeVisible();
    }
    if (group === "banner-light") {
      await expect(dashboard.locator('input[name="recommendations-layout"][value="grid"]')).toBeChecked();
      await expect(dashboard.getByRole("checkbox", { name: "Business Details", exact: true })).not.toBeChecked();
    }
    await expect(publicPage.getByTestId("public-profile-hero")).toHaveAttribute("data-wallpaper-mode", expectedWallpaper);
    if (group === "absent-hero") await expect(publicPage.getByTestId("wallpaper-image")).toHaveCount(0);
    if (group === "broken-hero") {
      const heroImage = publicPage.getByTestId("wallpaper-image");
      const source = await heroImage.getAttribute("src");
      if (!source) throw new Error("BROKEN_HERO_FIXTURE_MISSING");
      await publicPage.route(source, (request) => request.abort("failed"));
      await publicPage.reload({ waitUntil: "domcontentloaded" });
      await expect(publicPage.getByTestId("public-profile-hero")).toBeVisible();
      await expect(publicPage.getByTestId("wallpaper-image")).not.toHaveAttribute("src", source);
      await publicPage.unroute(source);
    }
  } else if (group === "long-rich-bio") {
    await openEditorWorkspace(dashboard, "Profile");
    await expect(dashboard.locator('[data-field="bio"]')).toContainText("A long QA biography");
    await expect(dashboard.locator('[data-field="bio"] strong')).toHaveText("bold travel notes");
    await expect(publicPage.getByText(/A long QA biography/)).toBeVisible();
    await expect(publicPage.locator("strong").filter({ hasText: "bold travel notes" })).toBeVisible();
  } else if (group === "reordered-categories") {
    await openEditorWorkspace(dashboard, "Appearance");
    const dashboardOrder = await dashboard.locator(".appearance-category-list [data-category-id]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-category-id")));
    const publicOrder = await publicPage.locator("[data-category-id]").evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute("data-category-id")))]);
    expect(publicOrder.slice(0, dashboardOrder.length)).toEqual(dashboardOrder);
  } else {
    await openEditorWorkspace(dashboard, "Gallery");
    expect(await dashboard.getByRole("button", { name: /^Remove / }).count()).toBeGreaterThan(0);
    await openEditorWorkspace(dashboard, "Profile");
    await expect(dashboard.locator('input[name="instagramLink"]')).toHaveValue("https://instagram.com/explorers.qa");
    await expect(publicPage.locator('a[href="https://instagram.com/explorers.qa"]')).toBeVisible();
  }
}

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
        captureMutationTemplate: () => captureEditorSnapshot(dashboard),
        verifyRestoreReady: (_state, snapshot) => assertRestoreControlsReady(dashboard, snapshot),
        backup: async (state) => { artifact = await writeProtectedProfileBackup({ runId: runId(), group, state }); },
        mutate: () => applyHighRiskGroup(dashboard, group),
        verifyMutation: async () => {
          await verifyPublicRoute(publicPage, `/${encodeURIComponent(username())}`);
          await expect(publicPage.getByTestId("public-profile-hero")).toBeVisible();
          await verifyPersistedGroup(dashboard, publicPage, group);
          const categoryRoute = publicRouteContract.find((route) =>
            route.id !== "profile" && routeFixtures().enabledRouteIds.includes(route.id));
          if (!categoryRoute) throw new Error("ROUTE_FIXTURE_INVALID:no-category-route");
          await verifyPublicRoute(publicPage, publicRoutePath(categoryRoute, routeParams()));
          await expect(publicPage.locator(`[data-public-route-leaf="${categoryRoute.marker}"]`)).toBeVisible();
        },
        normalRestore: (_state, snapshot) => restoreEditorSnapshot(dashboard, snapshot),
        emergencyRestore: (_state, snapshot) => restoreEditorSnapshot(dashboard, snapshot),
        verifyRestored: async (expected) => {
          expect(await publicAccountState(publicPage)).toEqual(expected);
          await expect(publicPage.locator('[data-public-route-leaf="public-profile-shell"]')).toBeVisible();
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
  const observed: Array<{ role: string; types: string[]; elements: string[]; runIdMatched: boolean }> = [];
  const cleanupRun = async () => {
    const endpoint = process.env.VITE_API_URL!;
    const token = process.env.VITE_ANALYTICS_WRITE_ACCESS_TOKEN!;
    const send = async (operationName: string, query: string) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ operationName, query, variables: { runId: runId(), qaSink: process.env.PUBLIC_API_ANALYTICS_QA_SINK } }),
      });
      const payload = await response.json() as { data?: Record<string, unknown>; errors?: unknown[] };
      if (!response.ok || payload.errors?.length) throw new Error("ANALYTICS_CLEANUP_FAILED");
      return payload.data;
    };
    const cleaned = await send("CleanupQaBrowserRun", process.env.PUBLIC_API_ANALYTICS_RUN_CLEANUP_MUTATION!);
    if (!cleaned?.cleanup) throw new Error("ANALYTICS_CLEANUP_FAILED");
    const verified = await send("VerifyQaBrowserRunCleanup", process.env.PUBLIC_API_ANALYTICS_RUN_CLEANUP_VERIFY_QUERY!);
    if (!Array.isArray(verified?.remaining) || verified.remaining.length !== 0) throw new Error("ANALYTICS_CLEANUP_FAILED");
  };
  try {
    for (const [index, context] of contexts.entries()) {
      const page = await context.newPage();
      const events: Array<{ types: string[]; elements: string[]; runIdMatched: boolean }> = [];
      page.on("request", (request) => {
        if (!request.postData()?.includes("CreatePublicPageAnalytic")) return;
        try {
          const body = JSON.parse(request.postData()!) as { variables?: { data?: { Stats?: Array<{ type?: string; element?: string; metadata?: { qaRunId?: string } }> } } };
          const stats = body.variables?.data?.Stats ?? [];
          events.push({
            types: stats.map((event) => event.type ?? "unknown"),
            elements: stats.map((event) => event.element ?? "").filter(Boolean),
            runIdMatched: stats.every((event) => event.metadata?.qaRunId === runId()),
          });
        } catch { throw new Error("ANALYTICS_PAYLOAD_INVALID"); }
      });
      await verifyPublicRoute(page, `/${encodeURIComponent(username())}`);
      await page.getByRole("button", { name: "Share", exact: true }).first().click();
      const category = page.locator("[data-category-id]").first();
      if (await category.count() !== 1) throw new Error("ANALYTICS_CARD_FIXTURE_MISSING");
      await category.click();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForLoadState("networkidle");
      if (index === 1) expect(events).toEqual([]);
      else await expect.poll(() => events.length).toBeGreaterThan(0);
      observed.push({
        role: ["guest", "owner", "non-owner"][index],
        types: events.flatMap((event) => event.types),
        elements: events.flatMap((event) => event.elements),
        runIdMatched: events.every((event) => event.runIdMatched),
      });
      const pathname = new URL(page.url()).pathname;
      expect(await page.evaluate((expectedPath) =>
        JSON.stringify((window as typeof window & { dataLayer?: unknown[] }).dataLayer ?? []).includes(expectedPath), pathname)).toBe(true);
    }
    if (!/^qa[-_]/i.test(runId())) throw new Error("ANALYTICS_CANARY_REQUIRED");
    expect(process.env.PUBLIC_API_ANALYTICS_QA_SINK).toMatch(/^qa[-_]/i);
    expect(observed.find((entry) => entry.role === "owner")?.types).toEqual([]);
    for (const role of ["guest", "non-owner"]) {
      const entry = observed.find((candidate) => candidate.role === role)!;
      expect(entry.types).toContain("view");
      expect(entry.types).toContain("click");
      expect(entry.elements).toContain("share-button");
      expect(entry.elements.some((element) => /card|category/i.test(element))).toBe(true);
      expect(entry.runIdMatched).toBe(true);
    }
  } finally {
    await cleanupRun();
    await Promise.all(contexts.map((context) => context.close()));
  }
});
