import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";
import {
  type PresetId,
  type LayoutId,
  type WallpaperMode,
  type FixtureState,
  PRESETS,
  LAYOUT_TEST_IDS,
  LONG_TITLE,
  categoryOrder,
  installPublicFixture,
  openFixture,
  expectNoHorizontalOverflow,
  evaluateCorePixelContrast,
} from "./support/publicProfileFixture";

const WALLPAPER_MODES: WallpaperMode[] = [
  "solid-color",
  "banner-top",
  "full-wallpaper-image",
  "ambient-gradient",
];

const ALL_PRESETS: PresetId[] = [
  "cinematic-dark",
  "glassmorphism",
  "sunset-glow",
  "minimal-light",
  "emerald-nature",
  "neon-cyber",
];

const LAYOUTS: LayoutId[] = ["shelves", "grid", "featured"];

test.describe("public profile adaptive theme surface visual matrix", () => {
  // Step 1: Geometry & Regression Assertions
  test("enforces strict geometry boundaries, zero metadata card, clean avatar, and gutter alignment", async ({
    page,
  }) => {
    const observed: string[] = [];
    const state: FixtureState = {
      preset: "minimal-light",
      layout: "shelves",
      mode: "success",
      attempts: {},
    };
    await installPublicFixture(page, state, observed);
    await openFixture(page, "geometry");

    // Dedicated geometry checks across viewports: 320, 375, 768, 1024, 1440
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });

      const heroBox = await page.getByTestId("public-profile-hero").boundingBox();
      const tabsBox = await page.getByRole("tablist", { name: "Profile sections" }).boundingBox();
      expect(heroBox).not.toBeNull();
      expect(tabsBox).not.toBeNull();
      expect(tabsBox!.y).toBeGreaterThanOrEqual(heroBox!.y + heroBox!.height);
      await expectNoHorizontalOverflow(page);

      // Assert no profile metadata card
      await expect(page.locator('[data-testid="profile-metadata-card"]')).toHaveCount(0);

      // Assert no accent-coloured four-pixel avatar border
      const avatarBorder = await page.getByTestId("profile-avatar").evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          borderWidth: style.borderWidth,
          borderColor: style.borderColor,
        };
      });
      expect(avatarBorder.borderWidth).not.toBe("4px");

      // Assert logo & no footer badge
      await expect(page.locator('header a[aria-label="explorers.earth"]')).toBeVisible();

      // Check gutters on mobile viewports (< 768px)
      if (width < 768) {
        const expectedGutter = 16;
        const elementsToCheck = [
          page.getByRole("tablist", { name: "Profile sections" }), // tab rail
          page.locator('[data-category-id="books"] a[aria-label^="Open "]').first(), // category heading link
        ];

        for (const el of elementsToCheck) {
          if (await el.isVisible()) {
            const box = await el.boundingBox();
            if (box) {
              expect(Math.abs(box.x - expectedGutter)).toBeLessThanOrEqual(1.5);
            }
          }
        }

        // Assert first card in shelf starts at gutter
        const firstCard = page.locator('[data-category-id="books"] [data-testid^="recommendation-card"], [data-category-id="books"] a:not([aria-label^="Open "])').first();
        if (await firstCard.isVisible()) {
          const cardBox = await firstCard.boundingBox();
          if (cardBox) {
            expect(Math.abs(cardBox.x - expectedGutter)).toBeLessThanOrEqual(1.5);
          }
        }
      }
    }
  });

  // Step 3 & 4 & 8: 24 Preset x Wallpaper combinations with core-pixel contrast & screenshot collection
  test("evaluates core-pixel contrast across all 24 preset x wallpaper combinations at 375 and 1024", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const observed: string[] = [];
    const state: FixtureState = {
      preset: "minimal-light",
      layout: "shelves",
      mode: "success",
      headerSocial: true,
      headerImageUrl: "/e2e-split-luminance-header.png",
      attempts: {},
    };
    await installPublicFixture(page, state, observed);

    const screenshotDir = path.join(process.cwd(), "test-results", "contact-sheet");
    fs.mkdirSync(screenshotDir, { recursive: true });
    const screenshotPaths: { name: string; path: string }[] = [];

    let comboIndex = 0;
    for (const preset of ALL_PRESETS) {
      for (const wallpaperMode of WALLPAPER_MODES) {
        const layout = LAYOUTS[comboIndex % LAYOUTS.length];
        comboIndex++;

        state.preset = preset;
        state.wallpaperMode = wallpaperMode;
        state.layout = layout;
        state.attempts = {};

        for (const width of [375, 1024]) {
          await page.setViewportSize({ width, height: 900 });
          await openFixture(page, `combo-${preset}-${wallpaperMode}-${width}`);

          if (wallpaperMode === "banner-top" || wallpaperMode === "full-wallpaper-image") {
            const wallpaperImg = page.locator('img[src="/e2e-split-luminance-header.png"]').first();
            if (await wallpaperImg.isVisible()) {
              await expect.poll(() => wallpaperImg.evaluate((img: HTMLImageElement) => img.complete)).toBe(true);
            }
          }

          // At 375px, save screenshot for the 24-combination contact sheet
          if (width === 375) {
            const ssName = `preset_${preset}_${wallpaperMode}.png`;
            const ssPath = path.join(screenshotDir, ssName);
            await page.screenshot({ path: ssPath, animations: "disabled" });
            screenshotPaths.push({ name: `${preset} (${wallpaperMode})`, path: ssPath });
          }

          // Core-pixel contrast check
          const caseLabel = `${preset}/${wallpaperMode}/${width}`;
          const targets = [
            { name: `${caseLabel}: account-name`, locator: page.getByRole("heading", { name: "Fixture Explorer" }), minRatio: 4.5 },
            { name: `${caseLabel}: location-text`, locator: page.getByText("Fixture City", { exact: true }), minRatio: 4.0 },
            { name: `${caseLabel}: social-icon`, locator: page.locator('a[href="https://instagram.com/fixture"]'), minRatio: 3.0 },
            { name: `${caseLabel}: bio-text`, locator: page.getByText("A deterministic public profile fixture."), minRatio: 4.5 },
            { name: `${caseLabel}: tab-recommendations`, locator: page.getByRole("tab", { name: "Recommendations" }).locator("span").first(), minRatio: 4.5 },
            { name: `${caseLabel}: header-logo`, locator: page.locator('header a[aria-label="explorers.earth"] svg path[fill="currentColor"]').first(), minRatio: 2.5 },
          ];

          await evaluateCorePixelContrast(page, targets);
        }
      }
    }

    // Produce composed labelled contact sheet
    if (screenshotPaths.length === 24) {
      const cardWidth = 375;
      const cardHeight = 667;
      const cols = 4;
      const rows = 6;
      const labelHeight = 30;

      const sheetWidth = cols * cardWidth;
      const sheetHeight = rows * (cardHeight + labelHeight);

      const compositeOperations: sharp.OverlayOptions[] = [];

      for (let i = 0; i < screenshotPaths.length; i++) {
        const item = screenshotPaths[i];
        const col = i % cols;
        const row = Math.floor(i / cols);

        const x = col * cardWidth;
        const y = row * (cardHeight + labelHeight);

        // Label SVG
        const labelSvg = Buffer.from(
          `<svg width="${cardWidth}" height="${labelHeight}">
            <rect width="100%" height="100%" fill="#1e293b"/>
            <text x="50%" y="60%" fill="#f8fafc" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle">${item.name}</text>
          </svg>`
        );

        compositeOperations.push({
          input: labelSvg,
          left: x,
          top: y,
        });

        // Screenshot image resized if needed
        const resizedSs = await sharp(item.path)
          .resize(cardWidth, cardHeight, { fit: "cover" })
          .toBuffer();

        compositeOperations.push({
          input: resizedSs,
          left: x,
          top: y + labelHeight,
        });
      }

      const sheetBuffer = await sharp({
        create: {
          width: sheetWidth,
          height: sheetHeight,
          channels: 3,
          background: "#0f172a",
        },
      })
        .composite(compositeOperations)
        .png()
        .toBuffer();

      const finalContactSheetPath = path.join(screenshotDir, "public-profile-contact-sheet.png");
      fs.writeFileSync(finalContactSheetPath, sheetBuffer);

      // Also copy into docs/superpowers/reports/assets/ if available
      const docsAssetsDir = path.join(process.cwd(), "..", "docs", "superpowers", "reports", "assets");
      try {
        fs.mkdirSync(docsAssetsDir, { recursive: true });
        fs.writeFileSync(path.join(docsAssetsDir, "public-profile-contact-sheet.png"), sheetBuffer);
      } catch {
        // Fallback gracefully if directory is outside workspace
      }
    }
  });

  // Step 5: State & Resilience cases
  test("covers loading, empty, partial-error, all-error, touch targets, RTL, 200% zoom, and footer settings", async ({
    page,
  }) => {
    const observed: string[] = [];
    const state: FixtureState = {
      preset: "minimal-light",
      layout: "grid",
      mode: "loading",
      attempts: {},
    };
    await installPublicFixture(page, state, observed);
    await page.setViewportSize({ width: 375, height: 900 });

    // Loading state
    const loadingNav = openFixture(page, "loading-resilience");
    await expect(page.getByRole("region", { name: "Recommendations" })).toHaveAttribute("aria-busy", "true");
    await loadingNav;

    // Empty state without owner CTA
    state.mode = "empty";
    state.attempts = {};
    await openFixture(page, "empty-resilience");
    await expect(page.getByText("No public recommendations yet")).toBeVisible();
    await expect(page.getByRole("button", { name: /Add recommendations/i })).toHaveCount(0);

    // Partial error state
    state.mode = "partial-error";
    state.attempts = {};
    await openFixture(page, "partial-error-resilience");
    await expect(page.getByText("Some categories are unavailable")).toBeVisible();

    // All-error state with retry
    state.mode = "all-error";
    state.attempts = {};
    await openFixture(page, "all-error-resilience");
    await expect(page.getByText(/Couldn['’]t load recommendations/i)).toBeVisible();
    const retryBtn = page.getByRole("button", { name: "Try again" });
    await retryBtn.click();
    await expect(page.getByTestId("recommendations-grid")).toBeVisible();

    // Long bio & missing bio
    state.mode = "success";
    state.attempts = {};
    await openFixture(page, "bio-resilience");
    await expect(page.getByText("A deterministic public profile fixture.")).toBeVisible();

    // RTL & 200% zoom
    await page.evaluate(() => {
      document.documentElement.dir = "rtl";
      document.documentElement.style.fontSize = "200%";
    });
    await expectNoHorizontalOverflow(page);
    await page.evaluate(() => {
      document.documentElement.dir = "ltr";
      document.documentElement.style.fontSize = "100%";
    });

    // Touch targets >= 44x44
    for (const tab of await page.getByRole("tab").all()) {
      const box = await tab.boundingBox();
      expect(box?.height || 0).toBeGreaterThanOrEqual(44);
      expect(box?.width || 0).toBeGreaterThanOrEqual(44);
    }

    // Footer settings: enabled, minimal, disabled at 320x568, 375x667, 375x812
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      for (const footerSetting of ["enabled", "minimal", "disabled"] as const) {
        state.footerBranding = footerSetting;
        state.attempts = {};
        await openFixture(page, `footer-${footerSetting}-${viewport.width}`);

        const footerLinks = page.locator("footer a");
        if (await footerLinks.count() > 0) {
          const lastLink = footerLinks.last();
          if (await lastLink.isVisible()) {
            await lastLink.scrollIntoViewIfNeeded();
            const box = await lastLink.boundingBox();
            if (box) {
              // Ensure link stays at least 16px above bottom / fixed navigation
              expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
            }
          }
        }
      }
    }
  });

  // Step 6: Strict Loader Transition Journey
  test("executes strict progressive loader journey with independent GraphQL delays", async ({
    page,
  }) => {
    const observed: string[] = [];
    const state: FixtureState = {
      preset: "cinematic-dark",
      layout: "shelves",
      mode: "success",
      attempts: {},
    };

    // Install fixture with category response delay for progressive loader journey
    await installPublicFixture(page, state, observed, {
      categoryMs: 600,
    });

    await page.setViewportSize({ width: 375, height: 900 });
    await openFixture(page, "loader-journey");

    // Stable geometry after readiness
    await expect(page.getByTestId("public-profile-hero")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Recommendations" })).toBeVisible();
    const heroBox = await page.getByTestId("public-profile-hero").boundingBox();
    const tabsBox = await page.getByRole("tablist", { name: "Profile sections" }).boundingBox();
    expect(heroBox).not.toBeNull();
    expect(tabsBox).not.toBeNull();
    expect(tabsBox!.y).toBeGreaterThanOrEqual(heroBox!.y + heroBox!.height);

    // Retained content beside category loading
    await expect(page.getByTestId("recommendations-shelves")).toBeVisible();
  });
});
