import fs from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

import { publicRouteContract, publicRoutePath, type PublicRouteContractEntry } from "../../src/routes/publicRouteContract";
import { PUBLIC_COLLECTION_OPERATIONS, PUBLIC_RUNTIME_OPERATION_CAPABILITIES } from "../../scripts/public-api-capabilities.mjs";
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

async function verifyPublicRoute(page: Page, path: string, route: PublicRouteContractEntry = publicRouteContract[0]) {
  const observed = new Set<string>();
  const observe = (request: import("@playwright/test").Request) => {
    try {
      const operationName = (request.postDataJSON() as { operationName?: string }).operationName;
      const capability = operationName ? PUBLIC_RUNTIME_OPERATION_CAPABILITIES.get(operationName) : undefined;
      if (capability) observed.add(capability);
    } catch { /* non-GraphQL body */ }
  };
  page.on("request", observe);
  try {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `HTTP success for ${path}`).toBeLessThan(400);
    await expect(page.locator(".earth-loader-wrapper")).toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByRole("button", { name: /retry/i })).toHaveCount(0);
    await expect(page).toHaveURL(new URL(path, page.url()).href);
    const leaf = page.locator(`[data-public-route-leaf="${route.marker}"]`);
    await expect(leaf, `${route.id} must own its declared leaf`).toBeVisible();
    const hasContent = await leaf.locator("a, button, img, video, [data-category-id], [data-testid]").count() > 0 || (await leaf.innerText()).trim().length > 0;
    const hasSuccessfulEmptyState = await leaf.locator('[data-empty-state], .empty-state, :text-matches("no .+ yet|nothing .+ yet|no results", "i")').count() > 0;
    expect(hasContent || hasSuccessfulEmptyState, `${route.id} must render content or a successful empty state`).toBe(true);
    for (const required of route.requiredOperations) expect(observed, `${route.id} required operation ${required}`).toContain(required);
  } finally { page.off("request", observe); }
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
      await verifyPublicRoute(page, `/${encodeURIComponent(username())}`, publicRouteContract[0]);
      const fixtures = routeFixtures();
      for (const route of publicRouteContract) {
        const path = publicRoutePath(route, routeParams());
        if (!fixtures.enabledRouteIds.includes(route.id)) continue;
        const before = audit.entries.length;
        await verifyPublicRoute(page, path, route);
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
    const leafCapability = route.requiredOperations.find((operation) => operation !== "account-bootstrap");
    const operationNames = PUBLIC_COLLECTION_OPERATIONS.find((operation) => operation.id === leafCapability)?.runtimeOperationNames ?? [];
    if (!leafCapability || operationNames.length === 0) throw new Error("ROUTE_FIXTURE_INVALID:no-targetable-leaf");
    let failed = false;
    await page.route("**/graphql", async (request) => {
      const body = request.request().postDataJSON() as { operationName?: string };
      if (!failed && body.operationName && operationNames.includes(body.operationName)) {
        failed = true;
        await request.fulfill({ status, contentType: "application/json", body: JSON.stringify({ errors: [{ extensions: { code: `HTTP_${status}` } }] }) });
      } else await request.continue();
    });
    await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(failed, `HTTP ${status} must target ${leafCapability}, not bootstrap`).toBe(true);
    await expect(page).toHaveURL(new URL(path, page.url()).href);
    const leaf = page.locator(`[data-public-route-leaf="${route.marker}"]`);
    const retry = leaf.getByRole("button", { name: /retry/i });
    await expect(retry).toBeVisible();
    await page.unroute("**/graphql");
    await retry.click();
    await verifyPublicRoute(page, path, route);
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

async function assertPublicSnapshot(page: Page, snapshot: EditorSnapshot) {
  const shell = page.getByTestId("public-profile-route-shell");
  await expect(shell).toHaveAttribute("data-theme-preset", snapshot.preset);
  await expect(shell).toHaveAttribute("data-wallpaper-mode", snapshot.wallpaper);
  await expect(shell).toHaveAttribute("data-footer-branding", snapshot.footer);
  await expect(shell).toHaveAttribute("data-first-view", snapshot.firstView);
  const visibleNames = ["recommendations", "gallery", "business"].filter((_name, index) => snapshot.visibleTabs[index]).join(",");
  await expect(shell).toHaveAttribute("data-visible-tabs", visibleNames);
  const bioText = snapshot.bioHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (bioText) await expect(page.locator('[data-public-route-leaf="public-profile-shell"]')).toContainText(bioText);
  const publicCategories = await page.locator("[data-category-id]").evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute("data-category-id")).filter((id): id is string => Boolean(id)))]);
  expect(publicCategories).toEqual(snapshot.categoryOrder.filter((id) => publicCategories.includes(id)));
  if (snapshot.instagramActive && snapshot.instagramLink) await expect(page.locator(`a[href="${snapshot.instagramLink}"]`)).toBeVisible();
}

async function selectDifferent(control: Locator, baseline: string, preferred: string) {
  const values = await control.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value).filter(Boolean));
  const next = preferred !== baseline && values.includes(preferred) ? preferred : values.find((value) => value !== baseline);
  if (!next) throw new Error("MUTATION_NOT_SUBSTANTIVE:no-alternate-select-value");
  await control.selectOption(next);
}

async function clickDifferent(page: Page, selector: string, attribute: string, baseline: string, preferred: string) {
  const controls = page.locator(selector);
  const values = await controls.evaluateAll((nodes, name) => nodes.map((node) => node.getAttribute(name)).filter((value): value is string => Boolean(value)), attribute);
  const next = preferred !== baseline && values.includes(preferred) ? preferred : values.find((value) => value !== baseline);
  if (!next) throw new Error("MUTATION_NOT_SUBSTANTIVE:no-alternate-control-value");
  await page.locator(`${selector}[${attribute}="${next}"]`).click();
}

async function applyHighRiskGroup(page: Page, group: (typeof HIGH_RISK_GROUPS)[number], baseline: EditorSnapshot) {
  if (group === "long-rich-bio") {
    await openEditorWorkspace(page, "Profile");
    await page.locator('[data-field="bio"] [contenteditable=true]').evaluate((editor) => {
      const suffix = editor.innerHTML.includes("QA biography variant A") ? "B" : "A";
      editor.innerHTML = `<p>A long QA biography variant ${suffix} with <strong>bold travel notes</strong>, accessible links, and enough content to verify responsive public rendering across mobile and desktop.</p>`;
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
    await openEditorWorkspace(page, "Appearance");
    const galleryVisible = page.locator('fieldset:has(legend:text("Public sections")) input[type="checkbox"]').nth(1);
    if (!await galleryVisible.isChecked()) await galleryVisible.click();
    await openEditorWorkspace(page, "Gallery");
    await page.locator('input[type="file"]').first().setInputFiles({ name: `qa-gallery-${runId()}.png`, mimeType: "image/png", buffer: fs.readFileSync(path.resolve(galleryFile)) });
    await openEditorWorkspace(page, "Profile");
    if (await page.locator('input[name="instagramLink"]').count() === 0) await page.getByRole("button", { name: "Instagram", exact: true }).click();
    const nextInstagram = baseline.instagramLink === "https://instagram.com/explorers.qa" ? "https://instagram.com/explorers.qa.alt" : "https://instagram.com/explorers.qa";
    await page.locator('input[name="instagramLink"]').fill(nextInstagram);
  } else {
    await openEditorWorkspace(page, "Appearance");
    if (group === "absent-hero") {
      await page.locator("#theme-wallpaper-mode").selectOption("solid-color");
      if (baseline.wallpaper === "solid-color") await selectDifferent(page.locator("#theme-footer-branding"), baseline.footer, "minimal");
    }
    if (group === "broken-hero") {
      const imageMode = baseline.wallpaper === "banner-top" ? "full-wallpaper-image" : "banner-top";
      await page.locator("#theme-wallpaper-mode").selectOption(imageMode);
    }
    if (group === "full-wallpaper-dark") {
      await clickDifferent(page, "[data-theme-preset]", "data-theme-preset", baseline.preset, "cinematic-dark");
      const accentButtons = page.locator('section[aria-labelledby="accent-color-title"] button');
      const accents = await accentButtons.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label")).filter((value): value is string => Boolean(value)));
      const accent = baseline.accent !== "Royal Purple" && accents.includes("Royal Purple") ? "Royal Purple" : accents.find((value) => value !== baseline.accent);
      if (!accent) throw new Error("MUTATION_NOT_SUBSTANTIVE:no-alternate-accent");
      await page.getByRole("button", { name: accent, exact: true }).click();
      await selectDifferent(page.locator("#theme-wallpaper-mode"), baseline.wallpaper, "full-wallpaper-image");
      await selectDifferent(page.locator("#theme-first-view"), baseline.firstView, "music");
      await selectDifferent(page.locator("#theme-footer-branding"), baseline.footer, "minimal");
      await clickDifferent(page, 'input[name="recommendations-layout"]', "value", baseline.layout, "featured");
    }
    if (group === "banner-light") {
      await clickDifferent(page, "[data-theme-preset]", "data-theme-preset", baseline.preset, "minimal-light");
      await selectDifferent(page.locator("#theme-wallpaper-mode"), baseline.wallpaper, "banner-top");
      await clickDifferent(page, 'input[name="recommendations-layout"]', "value", baseline.layout, "grid");
      const business = page.getByRole("checkbox", { name: "Business Details", exact: true });
      await business.click();
    }
    if (group === "ambient-gradient") {
      await page.locator("#theme-wallpaper-mode").selectOption("ambient-gradient");
      if (baseline.wallpaper === "ambient-gradient") await selectDifferent(page.locator("#theme-first-view"), baseline.firstView, "recommendations");
    }
  }
  await saveProfile(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  const mutated = await captureEditorSnapshot(page);
  expect(mutated, `${group} must produce a substantive persisted change`).not.toEqual(baseline);
  return mutated;
}

async function verifyPersistedGroup(dashboard: Page, publicPage: Page, group: (typeof HIGH_RISK_GROUPS)[number], expected: EditorSnapshot, baseline: EditorSnapshot) {
  if (["absent-hero", "broken-hero", "full-wallpaper-dark", "banner-light", "ambient-gradient"].includes(group)) {
    await openEditorWorkspace(dashboard, "Appearance");
    await expect(dashboard.locator("#theme-wallpaper-mode")).toHaveValue(expected.wallpaper);
    expect(expected).not.toEqual(baseline);
    if (group === "full-wallpaper-dark") {
      expect(expected.preset).not.toBe(baseline.preset); expect(expected.accent).not.toBe(baseline.accent);
      expect(expected.firstView).not.toBe(baseline.firstView); expect(expected.footer).not.toBe(baseline.footer); expect(expected.layout).not.toBe(baseline.layout);
    }
    if (group === "banner-light") expect(expected.layout).not.toBe(baseline.layout);
    await expect(publicPage.getByTestId("public-profile-hero")).toHaveAttribute("data-wallpaper-mode", expected.wallpaper);
    if (expected.wallpaper === "solid-color") await expect(publicPage.getByTestId("wallpaper-image")).toHaveCount(0);
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
    expect(await dashboard.getByRole("button", { name: /^Remove / }).count()).toBe(baseline.galleryCount + 1);
    expect(expected.galleryCount).toBe(baseline.galleryCount + 1);
    await openEditorWorkspace(dashboard, "Profile");
    await expect(dashboard.locator('input[name="instagramLink"]')).toHaveValue(expected.instagramLink);
    await expect(publicPage.locator(`a[href="${expected.instagramLink}"]`)).toBeVisible();
    await publicPage.getByRole("tab", { name: "Gallery", exact: true }).click();
    await expect(publicPage.getByAltText(`qa-gallery-${runId()}.png`)).toBeVisible();
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
      let baselineSnapshot: EditorSnapshot | undefined;
      let mutatedSnapshot: EditorSnapshot | undefined;
      await runProtectedProfileMutation({
        captureExactState: () => publicAccountState(publicPage),
        captureMutationTemplate: async () => (baselineSnapshot = await captureEditorSnapshot(dashboard)),
        verifyRestoreReady: (_state, snapshot) => assertRestoreControlsReady(dashboard, snapshot),
        backup: async (state) => { artifact = await writeProtectedProfileBackup({ runId: runId(), group, state }); },
        mutate: async () => {
          if (!baselineSnapshot) throw new Error("RESTORE_PLAN_INCOMPLETE:baseline");
          mutatedSnapshot = await applyHighRiskGroup(dashboard, group, baselineSnapshot);
        },
        verifyMutation: async () => {
          if (!baselineSnapshot || !mutatedSnapshot) throw new Error("MUTATION_NOT_SUBSTANTIVE:snapshot-missing");
          await verifyPublicRoute(publicPage, `/${encodeURIComponent(username())}`, publicRouteContract[0]);
          await expect(publicPage.getByTestId("public-profile-hero")).toBeVisible();
          await assertPublicSnapshot(publicPage, mutatedSnapshot);
          await verifyPersistedGroup(dashboard, publicPage, group, mutatedSnapshot, baselineSnapshot);
          const categoryRoute = publicRouteContract.find((route) =>
            route.id !== "profile" && routeFixtures().enabledRouteIds.includes(route.id));
          if (!categoryRoute) throw new Error("ROUTE_FIXTURE_INVALID:no-category-route");
          await verifyPublicRoute(publicPage, publicRoutePath(categoryRoute, routeParams()), categoryRoute);
          await expect(publicPage.locator(`[data-public-route-leaf="${categoryRoute.marker}"]`)).toBeVisible();
        },
        normalRestore: (_state, snapshot) => restoreEditorSnapshot(dashboard, snapshot),
        emergencyRestore: (_state, snapshot) => restoreEditorSnapshot(dashboard, snapshot),
        verifyRestored: async (expected) => {
          expect(await publicAccountState(publicPage)).toEqual(expected);
          await verifyPublicRoute(publicPage, `/${encodeURIComponent(username())}`, publicRouteContract[0]);
          if (!baselineSnapshot) throw new Error("RESTORE_PLAN_INCOMPLETE:baseline");
          const restored = await captureEditorSnapshot(dashboard);
          expect(restored).toEqual(baselineSnapshot);
          await assertPublicSnapshot(publicPage, baselineSnapshot);
          if (baselineSnapshot.visibleTabs[1]) {
            await publicPage.getByRole("tab", { name: "Gallery", exact: true }).click();
            expect(await publicPage.locator('#public-profile-gallery-panel img, #public-profile-gallery-panel video').count()).toBe(baselineSnapshot.galleryCount);
          } else await expect(publicPage.getByRole("tab", { name: "Gallery", exact: true })).toHaveCount(0);
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
  type ObservedEvent = { role: string; routeId: string; type: string; element: string; qaRunId: string };
  const observed: ObservedEvent[] = [];
  const sendSink = async (operationName: string, query: string) => {
    const endpoint = process.env.VITE_API_URL!;
    const token = process.env.VITE_ANALYTICS_WRITE_ACCESS_TOKEN!;
    const response = await fetch(endpoint, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ operationName, query, variables: { runId: runId(), qaSink: process.env.PUBLIC_API_ANALYTICS_QA_SINK } }),
    });
    const payload = await response.json() as { data?: Record<string, unknown>; errors?: unknown[] };
    if (!response.ok || payload.errors?.length || !payload.data) throw new Error("ANALYTICS_CLEANUP_FAILED");
    return payload.data;
  };
  const cleanupRun = async () => {
    const cleaned = await sendSink("CleanupQaBrowserRun", process.env.PUBLIC_API_ANALYTICS_RUN_CLEANUP_MUTATION!);
    if (!cleaned?.cleanup) throw new Error("ANALYTICS_CLEANUP_FAILED");
    const verified = await sendSink("VerifyQaBrowserRunCleanup", process.env.PUBLIC_API_ANALYTICS_RUN_CLEANUP_VERIFY_QUERY!);
    if (!Array.isArray(verified?.remaining) || verified.remaining.length !== 0) throw new Error("ANALYTICS_CLEANUP_FAILED");
  };
  try {
    for (const [index, context] of contexts.entries()) {
      const page = await context.newPage();
      const role = ["guest", "owner", "non-owner"][index];
      const responseChecks: Array<Promise<ObservedEvent[]>> = [];
      let routeId = "profile";
      page.on("response", (response) => {
        const request = response.request();
        if (!request.postData()?.includes("CreatePublicPageAnalytic")) return;
        const eventRoute = routeId;
        responseChecks.push((async () => {
          const body = request.postDataJSON() as { variables?: { data?: { Stats?: Array<{ type?: string; element?: string; metadata?: { qaRunId?: string } }> } } };
          const payload = await response.json() as { data?: { createPublicPageAnalytic?: { documentId?: string } }; errors?: unknown[] };
          expect(response.ok()).toBe(true); expect(payload.errors ?? []).toEqual([]);
          expect(payload.data?.createPublicPageAnalytic?.documentId).toBeTruthy();
          const stats = body.variables?.data?.Stats ?? [];
          expect(stats.length).toBeGreaterThan(0);
          return stats.map((event) => ({ role, routeId: eventRoute, type: event.type ?? "", element: event.element ?? "", qaRunId: event.metadata?.qaRunId ?? "" }));
        })());
      });
      const routes = [publicRouteContract[0], ...publicRouteContract.filter((route) => route.id !== "profile" && routeFixtures().enabledRouteIds.includes(route.id))];
      for (const route of routes) {
        routeId = route.id;
        const path = publicRoutePath(route, routeParams());
        await verifyPublicRoute(page, path, route);
        const pathname = new URL(page.url()).pathname;
        expect(await page.evaluate((expectedPath) => JSON.stringify((window as typeof window & { dataLayer?: unknown[] }).dataLayer ?? []).includes(expectedPath), pathname)).toBe(true);
        const share = page.getByRole("button", { name: "Share", exact: true }).first();
        if (route.analytics !== "ga-pathname-only") {
          await expect(share, `${route.id} share control`).toBeVisible();
          await share.click();
          await page.keyboard.press("Escape");
          const leaf = page.locator(`[data-public-route-leaf="${route.marker}"]`);
          const card = leaf.locator('[data-category-id], [data-analytics-element*="card"], a[href]').first();
          if (await card.count() === 0) throw new Error(`ANALYTICS_CARD_FIXTURE_MISSING:${route.id}`);
          await card.click();
        }
        await page.waitForLoadState("networkidle");
      }
      const roleEvents = (await Promise.all(responseChecks)).flat();
      const delivery = await sendSink(`VerifyQaBrowserRunDelivery${role}`, process.env.PUBLIC_API_ANALYTICS_RUN_CLEANUP_VERIFY_QUERY!);
      if (!Array.isArray(delivery.remaining)) throw new Error("ANALYTICS_DELIVERY_INVALID");
      if (role === "owner") {
        expect(roleEvents).toEqual([]);
        expect(delivery.remaining, "owner traffic must remain absent from the QA sink").toEqual([]);
      }
      else {
        expect(roleEvents.length).toBeGreaterThan(0);
        for (const event of roleEvents) { expect(event.qaRunId).toBe(runId()); expect(event.type).toMatch(/^(view|click)$/); expect(event.element).not.toBe(""); }
        observed.push(...roleEvents);
        if (delivery.remaining.length === 0) throw new Error(`ANALYTICS_DELIVERY_EMPTY:${role}`);
        const sink = JSON.stringify(delivery.remaining);
        for (const event of roleEvents) { expect(sink).toContain(event.qaRunId); expect(sink).toContain(event.type); expect(sink).toContain(event.element); }
        if (role === "guest") await cleanupRun();
      }
    }
    if (!/^qa[-_]/i.test(runId())) throw new Error("ANALYTICS_CANARY_REQUIRED");
    expect(process.env.PUBLIC_API_ANALYTICS_QA_SINK).toMatch(/^qa[-_]/i);
    for (const role of ["guest", "non-owner"]) {
      const roleEvents = observed.filter((event) => event.role === role);
      const customRoutes = ["profile", ...publicRouteContract.filter((route) => route.analytics !== "ga-pathname-only" && routeFixtures().enabledRouteIds.includes(route.id)).map((route) => route.id)];
      for (const routeId of customRoutes) {
        const events = roleEvents.filter((event) => event.routeId === routeId);
        expect(events.some((event) => event.type === "view"), `${role}/${routeId} view`).toBe(true);
        expect(events.some((event) => event.element === "share-button"), `${role}/${routeId} share`).toBe(true);
        expect(events.some((event) => /card|category|item/i.test(event.element)), `${role}/${routeId} card`).toBe(true);
      }
    }
  } finally {
    await cleanupRun();
    await Promise.all(contexts.map((context) => context.close()));
  }
});
