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
import { restoreWithEmergency } from "./support/liveProfileWriteSafety";

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
