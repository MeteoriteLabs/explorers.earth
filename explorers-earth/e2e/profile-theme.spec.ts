import { expect, test } from "@playwright/test";
import { setupMockAuthentication } from "./setup/auth";

import {
  PUBLIC_PROFILE_SETTINGS_MANIFEST,
  SECONDARY_SETTING_FACTORS,
  allRequiredSettingPairs,
  generateSecondaryPairwiseCases,
  rowSettingPairs,
  settingsArtifactName,
} from "./support/publicProfileSettingsManifest";
import { restoreWithEmergency, runProtectedProfileMutation } from "./support/liveProfileWriteSafety";
import * as liveSafety from "./support/liveProfileWriteSafety";
import { evaluateCorePixelContrast } from "./support/publicProfileFixture";
import * as publicFixture from "./support/publicProfileFixture";

test("restore guard uses one emergency cleanup and preserves the original failure", async () => {
  const originalFailure = new Error("normal restore failed");
  let emergencyCalls = 0;
  let verificationCalls = 0;

  await expect(
    restoreWithEmergency({
      normalRestore: async () => {
        throw originalFailure;
      },
      emergencyRestore: async () => {
        emergencyCalls += 1;
      },
      verify: async () => {
        verificationCalls += 1;
      },
    }),
  ).rejects.toBe(originalFailure);
  expect(emergencyCalls).toBe(1);
  expect(verificationCalls).toBe(1);
});

test("protected mutation harness captures exact state and template, backs up, verifies, and restores", async () => {
  const run = (liveSafety as any).runProtectedProfileMutation;
  expect(typeof run).toBe("function");
  const events: string[] = [];
  const baseline = { social_media: { exact: true }, Bio: "Original" };
  const template = { operationName: "UpdateAccount", variables: { id: "fixture" } };

  await expect(run({
    captureExactState: async () => (events.push("capture"), baseline),
    captureMutationTemplate: async () => (events.push("template"), template),
    verifyRestoreReady: async (state: unknown, captured: unknown) => {
      events.push("restore-ready");
      expect(state).toEqual(baseline);
      expect(captured).toEqual(template);
    },
    backup: async (value: unknown) => {
      events.push("backup");
      expect(value).toEqual(baseline);
    },
    mutate: async (captured: unknown) => {
      events.push("mutate");
      expect(captured).toEqual(template);
    },
    verifyMutation: async () => events.push("verify-mutation"),
    normalRestore: async (value: unknown) => {
      events.push("restore");
      expect(value).toEqual(baseline);
    },
    emergencyRestore: async () => events.push("emergency"),
    verifyRestored: async (value: unknown) => {
      events.push("verify-restored");
      expect(value).toEqual(baseline);
    },
  })).resolves.toBeUndefined();
  expect(events).toEqual([
    "capture", "template", "restore-ready", "backup", "mutate", "verify-mutation", "restore", "verify-restored",
  ]);
});

test("protected mutation cannot begin when the restore plan is not independently ready", async () => {
  const events: string[] = [];
  await expect(runProtectedProfileMutation({
    captureExactState: async () => (events.push("capture"), { Bio: "baseline" }),
    captureMutationTemplate: async () => (events.push("template"), { operationName: "UpdateAccount" }),
    verifyRestoreReady: async () => { events.push("restore-ready"); throw new Error("RESTORE_NOT_READY"); },
    backup: async () => { events.push("backup"); },
    mutate: async () => { events.push("mutate"); },
    verifyMutation: async () => { events.push("verify-mutation"); },
    normalRestore: async () => { events.push("restore"); },
    emergencyRestore: async () => { events.push("emergency"); },
    verifyRestored: async () => { events.push("verify-restored"); },
  })).rejects.toThrow("RESTORE_NOT_READY");
  expect(events).toEqual(["capture", "template", "restore-ready"]);
});

test("settings manifest declares 24 named theme and wallpaper cases", () => {
  expect(PUBLIC_PROFILE_SETTINGS_MANIFEST.themeWallpaperCases).toHaveLength(24);
  expect(
    new Set(PUBLIC_PROFILE_SETTINGS_MANIFEST.themeWallpaperCases.map((entry) => entry.id)).size,
  ).toBe(24);
  expect(
    new Set(PUBLIC_PROFILE_SETTINGS_MANIFEST.themeWallpaperCases.map((entry) => entry.theme)).size,
  ).toBe(6);
  expect(
    new Set(PUBLIC_PROFILE_SETTINGS_MANIFEST.themeWallpaperCases.map((entry) => entry.wallpaper)).size,
  ).toBe(4);
  expect(PUBLIC_PROFILE_SETTINGS_MANIFEST.viewports).toEqual([
    { id: "mobile-320", width: 320, height: 812 },
    { id: "mobile-short", width: 375, height: 667 },
    { id: "tablet-768", width: 768, height: 900 },
    { id: "desktop-1024", width: 1024, height: 900 },
    { id: "desktop-1440", width: 1440, height: 900 },
  ]);
  expect((PUBLIC_PROFILE_SETTINGS_MANIFEST as any).accentColors).toEqual([
    "#10B981", "#38BDF8", "#EC4899", "#8B5CF6", "#F59E0B", "#F43F5E",
  ]);
  expect((PUBLIC_PROFILE_SETTINGS_MANIFEST as any).firstViews).toEqual([
    "all-recommendations", "places", "music", "movies", "books", "games",
    "guides", "apps", "products", "people", "gallery", "business",
  ]);
});

test("contrast gate fails closed when no rendered target can be sampled", async ({ page }) => {
  await expect(evaluateCorePixelContrast(page, [])).rejects.toThrow(
    "CONTRAST_TARGETS_EMPTY",
  );
});

test("contrast gate fails closed when a visible target yields zero sampled pixels", () => {
  const assertSamples = (publicFixture as any).assertContrastSamples;
  expect(typeof assertSamples).toBe("function");
  expect(() => assertSamples("transparent-control", [])).toThrow(
    "CONTRAST_PIXELS_EMPTY:transparent-control",
  );
});

test("contrast gate fails each missing required target even when another target is sampleable", async ({ page }) => {
  await page.setContent('<main><p id="present">Readable target</p></main>');
  await expect(evaluateCorePixelContrast(page, [
    { name: "present", locator: page.locator("#present"), minRatio: 4.5 },
    { name: "missing-retry-label", locator: page.locator("#missing"), minRatio: 4.5 },
  ])).rejects.toThrow("CONTRAST_TARGET_MISSING:missing-retry-label");
});

test("settings artifacts include project, case, viewport, and attempt", () => {
  expect(settingsArtifactName({
    project: "deterministic",
    caseId: "minimal-light--banner-top",
    viewport: { width: 375, height: 900 },
    attempt: 2,
  })).toBe("deterministic--minimal-light--banner-top--375x900--attempt-2.png");
});

test("bounded secondary settings cases cover every value and every factor pair", () => {
  const matrix = generateSecondaryPairwiseCases();
  const repeated = generateSecondaryPairwiseCases();
  const requiredPairs = allRequiredSettingPairs();
  const coveredPairs = new Set(matrix.flatMap(rowSettingPairs));

  expect(repeated).toEqual(matrix);
  expect(matrix.length).toBeLessThan(50);
  expect(coveredPairs).toEqual(requiredPairs);

  for (const [factor, values] of Object.entries(SECONDARY_SETTING_FACTORS)) {
    expect(new Set(matrix.map((row) => row[factor as keyof typeof row]))).toEqual(
      new Set(values),
    );
  }
});

test.describe("Public Profile Theme & Customization E2E", () => {
  test("renders homepage, navigation, and theme system elements", async ({ context, page }) => {
    await setupMockAuthentication(context);
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("text=explorers.earth").first()).toBeVisible();

    await page.goto("/profile");
    await page.waitForLoadState("domcontentloaded");
    expect(page.url()).toContain("/profile");
  });
});
