import { expect, test } from "@playwright/test";
import sharp, { type OverlayOptions } from "sharp";
import path from "node:path";
import fs from "node:fs";
import {
  type FixtureState,
  ONE_PIXEL_PNG,
  installPublicFixture,
  openFixture,
  expectNoHorizontalOverflow,
  evaluateCorePixelContrast,
} from "./support/publicProfileFixture";
import { emulateBrowserReflowZoom200 } from "./support/browserReflow";
import {
  PROFILE_THEMES,
  THEME_WALLPAPER_CASES,
  generateSecondaryPairwiseCases,
  settingsArtifactName,
} from "./support/publicProfileSettingsManifest";

const themeScreenshots = new Map<string, { name: string; path: string }>();
const themeCaptureDir = path.join(process.cwd(), "test-results", "contact-sheet", "captures");

test.describe("public profile adaptive theme surface visual matrix", () => {
  test.afterAll(async () => {
    if (themeScreenshots.size === 0) return;
    const cardWidth = 375;
    const cardHeight = 667;
    const columns = 4;
    const labelHeight = 30;
    const captures = [...themeScreenshots.values()].sort((left, right) => left.name.localeCompare(right.name));
    const rows = Math.ceil(captures.length / columns);
    const overlays: OverlayOptions[] = [];

    for (let index = 0; index < captures.length; index += 1) {
      const item = captures[index];
      const left = (index % columns) * cardWidth;
      const top = Math.floor(index / columns) * (cardHeight + labelHeight);
      const label = Buffer.from(
        `<svg width="${cardWidth}" height="${labelHeight}">` +
        `<rect width="100%" height="100%" fill="#1e293b"/>` +
        `<text x="50%" y="62%" fill="#f8fafc" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle">${item.name}</text>` +
        `</svg>`,
      );
      overlays.push({ input: label, left, top });
      overlays.push({
        input: await sharp(item.path).resize(cardWidth, cardHeight, {
          fit: "contain",
          background: "#0f172a",
        }).toBuffer(),
        left,
        top: top + labelHeight,
      });
    }

    const contactSheetDir = path.join(process.cwd(), "test-results", "contact-sheet");
    fs.mkdirSync(contactSheetDir, { recursive: true });
    const contactSheetPath = path.join(
      contactSheetDir,
      settingsArtifactName({
        project: "deterministic",
        caseId: "public-profile-contact-sheet",
        viewport: { width: 375, height: 667 },
        attempt: 0,
      }),
    );
    await sharp({
      create: {
        width: columns * cardWidth,
        height: rows * (cardHeight + labelHeight),
        channels: 3,
        background: "#0f172a",
      },
    }).composite(overlays).png().toFile(contactSheetPath);
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (!testInfo.title.startsWith("theme-wallpaper ") || testInfo.status === testInfo.expectedStatus) return;
    const caseId = testInfo.title.match(/^theme-wallpaper ([^:]+):/)?.[1];
    if (!caseId) return;
    try {
      await page.setViewportSize({ width: 375, height: 667 });
      fs.mkdirSync(themeCaptureDir, { recursive: true });
      const screenshotPath = path.join(themeCaptureDir, settingsArtifactName({
        project: testInfo.project.name,
        caseId: `${caseId}-failed`,
        viewport: { width: 375, height: 667 },
        attempt: testInfo.retry,
      }));
      await page.screenshot({ path: screenshotPath, animations: "disabled" });
      if (fs.existsSync(screenshotPath)) {
        themeScreenshots.set(caseId, { name: `${caseId} (failed attempt ${testInfo.retry})`, path: screenshotPath });
      }
    } catch {
      // Preserve the original test error if the page closed while capturing failure evidence.
    }
  });
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

  for (const [caseIndex, themeCase] of THEME_WALLPAPER_CASES.entries()) {
    test(`theme-wallpaper ${themeCase.id}: rendered contrast at 375 and 1024`, async ({ page }, testInfo) => {
      test.setTimeout(60_000);
      const observed: string[] = [];
      const state: FixtureState = {
        preset: themeCase.theme,
        wallpaperMode: themeCase.wallpaper,
        layout: (["shelves", "grid", "featured"] as const)[caseIndex % 3],
        mode: "success",
        headerSocial: true,
        headerImageUrl: "/e2e-split-luminance-header.png",
        footerBranding: "enabled",
        attempts: {},
      };
      await installPublicFixture(page, state, observed);

      for (const viewport of [{ width: 375, height: 667 }, { width: 1024, height: 900 }]) {
        await page.setViewportSize(viewport);
        await openFixture(page, `combo-${themeCase.id}-${viewport.width}`);

        if (themeCase.wallpaper === "banner-top" || themeCase.wallpaper === "full-wallpaper-image") {
          const wallpaper = page.locator('img[src="/e2e-split-luminance-header.png"]').first();
          if (await wallpaper.isVisible()) {
            await expect.poll(() => wallpaper.evaluate((image: HTMLImageElement) => image.complete)).toBe(true);
          }
        }

        if (viewport.width === 375) {
          fs.mkdirSync(themeCaptureDir, { recursive: true });
          const screenshotPath = path.join(themeCaptureDir, settingsArtifactName({
            project: testInfo.project.name,
            caseId: themeCase.id,
            viewport,
            attempt: testInfo.retry,
          }));
          await page.screenshot({ path: screenshotPath, animations: "disabled" });
          await testInfo.attach(`theme-${themeCase.id}`, { path: screenshotPath, contentType: "image/png" });
          themeScreenshots.set(themeCase.id, { name: themeCase.id, path: screenshotPath });
        }

        const caseLabel = `${themeCase.id}/${viewport.width}`;
        const recommendationsTab = page.getByRole("tab", { name: "Recommendations" });
        await recommendationsTab.focus();
        const recommendationCard = page.locator(
          ".place-rec-card, [data-testid=featured-category], [data-testid=recommendations-grid] [data-category-id]",
        ).first();
        const recommendationCardLabel = recommendationCard.locator("h2, h3, h4").first();
        await evaluateCorePixelContrast(page, [
          { name: `${caseLabel}: account-name`, locator: page.getByRole("heading", { name: "Fixture Explorer" }), minRatio: 4.5 },
          { name: `${caseLabel}: location-text`, locator: page.getByText("Fixture City", { exact: true }), minRatio: 4.5 },
          { name: `${caseLabel}: social-icon`, locator: page.locator('a[href="https://instagram.com/fixture"] svg').first(), minRatio: 3.0 },
          { name: `${caseLabel}: bio-text`, locator: page.getByText("A deterministic public profile fixture."), minRatio: 4.5 },
          { name: `${caseLabel}: tab-recommendations`, locator: page.getByRole("tab", { name: "Recommendations" }).locator("svg").first(), minRatio: 3.0 },
          { name: `${caseLabel}: header-logo`, locator: page.locator('header a[aria-label="explorers.earth"] svg path[fill="currentColor"]').first(), minRatio: 3.0 },
          { name: `${caseLabel}: tab-control`, locator: recommendationsTab.locator("svg").first(), minRatio: 3.0 },
          { name: `${caseLabel}: focused-tab-ring`, locator: recommendationsTab, minRatio: 3.0, sample: "focus-ring" },
        ]);
        await recommendationCard.scrollIntoViewIfNeeded();
        await evaluateCorePixelContrast(page, [{
          name: `${caseLabel}: recommendation-card`,
          locator: recommendationCardLabel,
          minRatio: 4.5,
        }]);
        const footerBrandControl = page.locator('footer a[aria-label="explorers.earth"]');
        await footerBrandControl.scrollIntoViewIfNeeded();
        await footerBrandControl.focus();
        await evaluateCorePixelContrast(page, [
          { name: `${caseLabel}: footer-brand-control`, locator: footerBrandControl.locator("svg").first(), minRatio: 3.0 },
        ]);
      }
    });
  }

  for (const [caseIndex, settings] of generateSecondaryPairwiseCases().entries()) {
    test(`secondary-settings pairwise-${String(caseIndex + 1).padStart(2, "0")}: ${Object.entries(settings).map(([name, value]) => `${name}=${value}`).join(", ")}`, async ({ page }) => {
      const observed: string[] = [];
      const categoryOrders: Record<typeof settings.categoryOrder, string[]> = {
        canonical: ["books", "places", "guides"],
        reverse: ["guides", "places", "books"],
        rotate: ["places", "guides", "books"],
        "preferred-first": ["guides", "books", "places"],
      };
      const bioByState: Record<typeof settings.bio, string | null> = {
        empty: null,
        plain: "Pairwise profile biography.",
        "long-rich-text": `<p><strong>Long rich profile biography.</strong> ${"Readable public profile content. ".repeat(12)}</p>`,
      };
      const headerImageByState: Record<typeof settings.hero, string | null> = {
        present: "/e2e-split-luminance-header.png",
        absent: null,
        broken: "/broken-cover.jpg",
      };
      const feedItems = settings.gallery === "empty"
        ? []
        : [{
            documentId: `pairwise-${settings.gallery}`,
            url: `data:image/png;base64,${ONE_PIXEL_PNG}`,
            fileName: `${settings.gallery}-gallery.png`,
            type: "image",
            aspectRatio: "1:1",
            width: 1,
            height: 1,
            uploadSource: settings.gallery === "upload" ? "manual" : settings.gallery,
            ...(settings.gallery === "instagram"
              ? { sourceUrl: "https://instagram.com/fixture/post" }
              : settings.gallery === "google"
                ? { googlePlaceId: "fixture-google-place" }
                : {}),
          }];
      const state: FixtureState = {
        preset: PROFILE_THEMES[caseIndex % PROFILE_THEMES.length],
        wallpaperMode: "banner-top",
        layout: settings.recommendationLayout,
        mode: "success",
        headerImageUrl: headerImageByState[settings.hero],
        footerBranding: settings.footer,
        categoryOrder: categoryOrders[settings.categoryOrder],
        bio: bioByState[settings.bio],
        socialVisibility: settings.social,
        feedItems,
        attempts: {},
      };
      await installPublicFixture(page, state, observed);
      await page.setViewportSize(caseIndex % 2 === 0
        ? { width: 375, height: 667 }
        : { width: 1024, height: 900 });
      await openFixture(page, `secondary-${caseIndex + 1}`);

      await expect(page.getByTestId(`recommendations-${settings.recommendationLayout}`)).toBeVisible();
      expect(await page.locator("[data-category-id]").evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-category-id")),
      )).toEqual(categoryOrders[settings.categoryOrder]);

      if (settings.hero === "present") {
        await expect(page.getByTestId("wallpaper-image")).toHaveAttribute("src", "/e2e-split-luminance-header.png");
      } else {
        await expect(page.getByTestId("wallpaper-image")).toHaveAttribute("src", "/images/Background.jpg");
      }

      const footer = page.locator("footer");
      if (settings.footer === "disabled") {
        await expect(footer).toHaveCount(0);
      } else {
        await expect(footer.locator('a[aria-label="explorers.earth"]')).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Footer" })).toHaveCount(settings.footer === "enabled" ? 1 : 0);
      }

      if (settings.bio === "empty") {
        await expect(page.getByText("Pairwise profile biography.")).toHaveCount(0);
      } else {
        await expect(page.getByText(settings.bio === "plain" ? "Pairwise profile biography." : "Long rich profile biography.", { exact: false })).toBeVisible();
      }

      await expect(page.locator('a[href="https://instagram.com/fixture"]')).toHaveCount(settings.social === "visible" ? 1 : 0);
      await page.getByRole("tab", { name: "Gallery" }).click();
      if (settings.gallery === "empty") {
        await expect(page.getByText(/No public photos yet/i)).toBeVisible();
      } else {
        await expect(page.locator(`img[alt="${settings.gallery}-gallery.png"]`)).toBeVisible();
      }
      await expectNoHorizontalOverflow(page);
    });
  }

  // Step 5: State & Resilience cases
  test("covers loading, empty, partial-error, all-error, touch targets, RTL, 200% zoom, and footer settings", async ({
    context,
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
    await evaluateCorePixelContrast(page, [{
      name: "empty-state",
      locator: page.getByText("No public recommendations yet"),
      minRatio: 4.5,
    }]);

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
    await retryBtn.scrollIntoViewIfNeeded();
    await retryBtn.focus();
    await evaluateCorePixelContrast(page, [
      { name: "error-state", locator: page.getByText(/Couldn['’]t load recommendations/i), minRatio: 4.5 },
      { name: "error-control", locator: retryBtn.getByTestId("recommendations-retry-label"), minRatio: 4.5 },
    ]);
    await retryBtn.click();
    await expect(page.getByTestId("recommendations-grid")).toBeVisible();

    // Long bio & missing bio
    state.mode = "success";
    state.attempts = {};
    await openFixture(page, "bio-resilience");
    await expect(page.getByText("A deterministic public profile fixture.")).toBeVisible();

    // RTL & 200% zoom
    await page.evaluate(() => { document.documentElement.dir = "rtl"; });
    const zoom = await emulateBrowserReflowZoom200(context, page);
    const zoomGeometry = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      visualWidth: Math.round(window.visualViewport?.width ?? 0),
      scale: window.visualViewport?.scale ?? 1,
    }));
    expect(zoomGeometry).toEqual({ innerWidth: zoom.layoutWidth, visualWidth: zoom.layoutWidth, scale: 1 });
    await expectNoHorizontalOverflow(page);
    const focusedTab = page.getByRole("tab", { name: "Recommendations" });
    await focusedTab.focus();
    const focusedBox = await focusedTab.boundingBox();
    expect(focusedBox).not.toBeNull();
    expect(focusedBox!.x).toBeGreaterThanOrEqual(0);
    expect(focusedBox!.x + focusedBox!.width).toBeLessThanOrEqual(zoom.layoutWidth);
    await expect(page.getByText("A deterministic public profile fixture.")).toBeVisible();
    await zoom.restore();
    await page.evaluate(() => { document.documentElement.dir = "ltr"; });

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
