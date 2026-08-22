import { expect, test, type Page } from "@playwright/test";
import { setupMockAuthentication } from "./setup/auth";
import {
  type PresetId,
  type LayoutId,
  type FixtureState,
  PRESETS,
  LAYOUT_TEST_IDS,
  LONG_TITLE,
  categoryOrder,
  operationName,
  installPublicFixture,
  openFixture,
  expectNoHorizontalOverflow,
  renderedPixelContrast,
} from "./support/publicProfileFixture";

test.describe("public recommendation presentation visual matrix", () => {
  test("sanitizes a structured recommendation note in an unauthenticated public modal", async ({
    page,
  }) => {
    const state: FixtureState = {
      preset: "cinematic-dark",
      layout: "shelves",
      mode: "success",
      attempts: {},
    };
    await page.addInitScript(() => {
      (window as Window & { __publicNoteXss?: string }).__publicNoteXss = "clean";
    });
    await installPublicFixture(page, state, []);

    await page.goto("/presentation-fixture/books/fixture-books", {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("button", { name: /Fixture unsafe book/ }).click();

    const note = page.getByText("Creator's Note").locator("..");
    await expect(note.getByRole("heading", { name: "Public note heading" })).toBeVisible();
    await expect(note.locator("strong")).toHaveText("Quill bold E2E");
    await expect(note.locator('ol li[data-list="ordered"]')).toHaveText("Ordered E2E");
    await expect(note.locator('ul li[data-list="bullet"]')).toHaveText("Bullet E2E");
    await expect(note.getByRole("link", { name: "Trusted E2E link" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    await expect(note.getByText("Unsafe E2E link")).not.toHaveAttribute("href");
    await expect(note.locator("script, [onerror], [onload]")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => (window as Window & { __publicNoteXss?: string }).__publicNoteXss,
      ),
    ).toBe("clean");
  });

  test("keeps public location and social icons legible on solid light and dark image headers", async ({
    page,
  }) => {
    const state: FixtureState = {
      preset: "minimal-light",
      layout: "shelves",
      mode: "success",
      wallpaperMode: "solid-color",
      headerSocial: true,
      attempts: {},
    };
    await installPublicFixture(page, state, []);

    const readHeaderColors = async () => {
      const location = page.getByText("Fixture City", { exact: true });
      const socialLink = page.locator('a[href="https://instagram.com/fixture"]');
      await expect(location).toBeVisible();
      await expect(socialLink).toBeVisible();
      return {
        location: await location.locator("..").evaluate((node) =>
          getComputedStyle(node).color,
        ),
        locationIcon: await location.locator("..").locator("svg").evaluate((node) =>
          getComputedStyle(node).fill,
        ),
        social: await socialLink.locator("..").evaluate((node) =>
          getComputedStyle(node).color,
        ),
        socialIcon: await socialLink.locator("path").evaluate((node) =>
          getComputedStyle(node).fill,
        ),
      };
    };

    await openFixture(page, "minimal-light-solid-header-icons");
    expect(await readHeaderColors()).toEqual({
      location: "rgb(100, 116, 139)",
      locationIcon: "rgb(100, 116, 139)",
      social: "rgb(15, 23, 42)",
      socialIcon: "rgb(15, 23, 42)",
    });

    state.preset = "cinematic-dark";
    state.wallpaperMode = "full-wallpaper-image";
    state.attempts = {};
    await openFixture(page, "cinematic-dark-image-header-icons");
    expect(await readHeaderColors()).toEqual({
      location: "rgb(255, 255, 255)",
      locationIcon: "rgb(255, 255, 255)",
      social: "rgb(255, 255, 255)",
      socialIcon: "rgb(255, 255, 255)",
    });
  });

  test("meets rendered-pixel contrast thresholds in every wallpaper branch", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const state: FixtureState = {
      preset: "minimal-light",
      layout: "shelves",
      mode: "success",
      wallpaperMode: "solid-color",
      headerImageUrl: "/e2e-bright-header.png",
      headerSocial: true,
      attempts: {},
    };
    await installPublicFixture(page, state, []);

    const wallpaperModes: NonNullable<FixtureState["wallpaperMode"]>[] = [
      "solid-color",
      "ambient-gradient",
      "banner-top",
      "full-wallpaper-image",
    ];

    for (const width of [375, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      for (const wallpaperMode of wallpaperModes) {
        state.wallpaperMode = wallpaperMode;
        state.attempts = {};
        await openFixture(page, `pixel-contrast-${wallpaperMode}-${width}`);

        if (wallpaperMode === "banner-top" || wallpaperMode === "full-wallpaper-image") {
          const wallpaper = page.locator('img[src="/e2e-bright-header.png"]').first();
          await expect(wallpaper).toBeVisible();
          await expect
            .poll(() => wallpaper.evaluate((image: HTMLImageElement) => image.complete))
            .toBe(true);
        }

        const identityContrast = await renderedPixelContrast(
          page.getByRole("heading", { name: "Fixture Explorer" }),
        );
        const locationContrast = await renderedPixelContrast(
          page.getByText("Fixture City", { exact: true }).locator(".."),
        );
        const socialContrast = await renderedPixelContrast(
          page.locator('a[href="https://instagram.com/fixture"]'),
        );
        const caseLabel = `${wallpaperMode} at ${width}px`;

        expect.soft(identityContrast, `${caseLabel} identity text`).toBeGreaterThanOrEqual(4.5);
        expect.soft(locationContrast, `${caseLabel} location metadata`).toBeGreaterThanOrEqual(4.5);
        expect.soft(socialContrast, `${caseLabel} meaningful social icon`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test("renders all 6 presets by 3 layouts at mobile and desktop", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const state: FixtureState = {
      preset: "cinematic-dark",
      layout: "shelves",
      mode: "success",
      attempts: {},
    };
    await installPublicFixture(page, state, []);

    for (const width of [375, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      for (const preset of Object.keys(PRESETS) as PresetId[]) {
        for (const layout of Object.keys(LAYOUT_TEST_IDS) as LayoutId[]) {
          state.preset = preset;
          state.layout = layout;
          state.mode = "success";
          state.attempts = {};
          await openFixture(page, `${preset}-${layout}-${width}`);

          const root = page.getByTestId(LAYOUT_TEST_IDS[layout]);
          await expect(root).toBeVisible();
          await expect(root.locator("[data-category-id]").first()).toHaveAttribute(
            "data-category-id",
            "books",
          );
          const tokens = await page.locator(".preview-scroll").evaluate((node) => {
            const styles = getComputedStyle(node);
            return {
              page: styles.getPropertyValue("--bg-page").trim().toUpperCase(),
              card: styles.getPropertyValue("--bg-card").trim().toUpperCase(),
              primary: styles.getPropertyValue("--text-primary").trim().toUpperCase(),
              accent: styles.getPropertyValue("--accent-color").trim().toUpperCase(),
            };
          });
          expect(tokens).toEqual({
            page: PRESETS[preset].page.toUpperCase(),
            card: PRESETS[preset].card.toUpperCase(),
            primary: PRESETS[preset].primary.toUpperCase(),
            accent: PRESETS[preset].accent.toUpperCase(),
          });
          const pageSurfaces = await Promise.all([
            page
              .getByText("A deterministic public profile fixture.", { exact: true })
              .locator("..")
              .evaluate((node) => {
                const style = getComputedStyle(node);
                return {
                  background: style.backgroundColor,
                  borderWidth: style.borderWidth,
                  borderRadius: style.borderRadius,
                  boxShadow: style.boxShadow,
                };
              }),
            page
              .getByRole("tablist", { name: "Profile sections" })
              .locator("..")
              .evaluate((node) => {
                const style = getComputedStyle(node);
                return {
                  background: style.backgroundColor,
                  borderWidth: style.borderWidth,
                  borderRadius: style.borderRadius,
                  boxShadow: style.boxShadow,
                };
              }),
          ]);
          for (const surface of pageSurfaces) {
            expect(surface).toEqual({
              background: "rgba(0, 0, 0, 0)",
              borderWidth: "0px",
              borderRadius: "0px",
              boxShadow: "none",
            });
          }
          await expectNoHorizontalOverflow(page);

          if (layout === "shelves") {
            const recommendations = page.getByRole("tab", {
              name: "Recommendations",
            });
            const gallery = page.getByRole("tab", { name: "Gallery" });
            await recommendations.focus();
            await recommendations.press("ArrowRight");
            await expect(gallery).toBeFocused();
            const contrast = await gallery.evaluate((node) => {
              const rgba = (value: string) => {
                const values = value.match(/[\d.]+/g)!.map(Number);
                return [values[0], values[1], values[2], values[3] ?? 1];
              };
              const composite = (foreground: number[], background: number[]) => [
                foreground[0] * foreground[3] + background[0] * (1 - foreground[3]),
                foreground[1] * foreground[3] + background[1] * (1 - foreground[3]),
                foreground[2] * foreground[3] + background[2] * (1 - foreground[3]),
                1,
              ];
              const linearChannels = (channels: number[]) =>
                channels.slice(0, 3).map((channel) => {
                    const normalized = channel / 255;
                    return normalized <= 0.04045
                      ? normalized / 12.92
                      : ((normalized + 0.055) / 1.055) ** 2.4;
                  });
              const luminance = ([red, green, blue]: number[]) =>
                0.2126 * red + 0.7152 * green + 0.0722 * blue;
              const ratio = (foreground: number[], background: number[]) => {
                const foregroundLuminance = luminance(linearChannels(foreground));
                const backgroundLuminance = luminance(linearChannels(background));
                return (
                  (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
                  (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
                );
              };
              const pageRoot = document.querySelector(".preview-scroll")!;
              const tabSurface = node.closest('[role="tablist"]')?.parentElement;
              const pageBackground = rgba(getComputedStyle(pageRoot).backgroundColor);
              const surfaceBackground = composite(
                rgba(getComputedStyle(tabSurface || pageRoot).backgroundColor),
                pageBackground,
              );
              return {
                text: ratio(
                  rgba(getComputedStyle(pageRoot).color),
                  pageBackground,
                ),
                focus: ratio(
                  rgba(getComputedStyle(node).outlineColor),
                  surfaceBackground,
                ),
                outlineColor: getComputedStyle(node).outlineColor,
                surfaceBackground: getComputedStyle(tabSurface || pageRoot).backgroundColor,
              };
            });
            expect(contrast.text).toBeGreaterThanOrEqual(4.5);
            expect(
              contrast.focus,
              `${preset}: ${contrast.outlineColor} on ${contrast.surfaceBackground}`,
            ).toBeGreaterThanOrEqual(3);
          }

          for (const tab of await page.getByRole("tab").all()) {
            const box = await tab.boundingBox();
            expect(box?.height || 0).toBeGreaterThanOrEqual(44);
            expect(box?.width || 0).toBeGreaterThanOrEqual(44);
          }
        }
      }
    }
  });

  test("distinguishes loading, empty, partial, cached-error, and retry states", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const state: FixtureState = {
      preset: "minimal-light",
      layout: "grid",
      mode: "loading",
      attempts: {},
    };
    await installPublicFixture(page, state, []);
    await page.setViewportSize({ width: 375, height: 900 });

    const loadingNavigation = openFixture(page, "loading");
    await expect(page.getByRole("region", { name: "Recommendations" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(page.getByLabel("Loading Books")).toBeVisible();
    await loadingNavigation;
    await expect(page.getByTestId("recommendations-grid")).toBeVisible();

    state.mode = "empty";
    state.attempts = {};
    await openFixture(page, "empty");
    await expect(page.getByText("No public recommendations yet")).toBeVisible();

    state.mode = "partial-error";
    state.attempts = {};
    await openFixture(page, "partial-error");
    await expect(page.getByText("Some categories are unavailable")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Places" })).toBeVisible();

    state.mode = "stale-error";
    state.layout = "shelves";
    state.attempts = {};
    await openFixture(page, "stale-error");
    await expect(page.getByText("Some categories are unavailable")).toBeVisible();
    await expect(page.getByRole("link", { name: LONG_TITLE })).toBeVisible();

    state.preset = "cinematic-dark";
    state.layout = "grid";
    state.mode = "all-error";
    state.attempts = {};
    await openFixture(page, "all-error");
    await expect(page.getByText("Couldn’t load recommendations")).toBeVisible();
    const retry = page.getByRole("button", { name: "Try again" });
    await retry.evaluate((button) => {
      button.click();
      button.click();
    });
    await expect(page.getByTestId("recommendations-grid")).toBeVisible();
    expect(state.attempts.GetPlacesLists).toBe(2);
    expect(state.attempts.GetBooksLists).toBe(2);
    expect(state.attempts.GetGuidesLists).toBe(2);
  });

  test("covers responsive, focus, contrast, media resilience, RTL, and privacy boundaries", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const observed: string[] = [];
    const state: FixtureState = {
      preset: "minimal-light",
      layout: "grid",
      mode: "missing-image",
      attempts: {},
      business: "{ malformed-json",
    };
    await installPublicFixture(page, state, observed);

    for (const width of [320, 639, 640, 767, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      state.layout = "grid";
      state.mode = "missing-image";
      state.attempts = {};
      await openFixture(page, `grid-${width}`);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
      const categories = page
        .getByTestId("recommendations-grid")
        .locator(":scope > [data-category-id]");
      if ((await categories.count()) >= 2) {
        const first = await categories.nth(0).boundingBox();
        const second = await categories.nth(1).boundingBox();
        if (width <= 640) {
          expect(Math.abs((first?.y || 0) - (second?.y || 0))).toBeGreaterThan(10);
        } else if (width >= 768) {
          expect(Math.abs((first?.y || 0) - (second?.y || 0))).toBeLessThan(2);
        }
      }
      await expectNoHorizontalOverflow(page);
    }

    await page.setViewportSize({ width: 375, height: 900 });
    state.layout = "featured";
    state.mode = "broken-image";
    state.attempts = {};
    await openFixture(page, "featured-resilience");
    await expect(page.getByTestId("featured-category")).toBeVisible();
    await expect(page.getByText("500+ Places").first()).toBeVisible();
    await expect(page.getByText("1 Book").first()).toBeVisible();
    await expect
      .poll(() =>
        page
          .getByTestId("recommendations-featured")
          .locator('img[src*="broken-cover"]')
          .count(),
      )
      .toBe(0);

    await page.evaluate(() => {
      document.documentElement.dir = "rtl";
      document.documentElement.style.fontSize = "200%";
    });
    await expect(page.getByTestId("featured-category")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.evaluate(() => {
      document.documentElement.dir = "ltr";
      document.documentElement.style.fontSize = "100%";
    });
    state.layout = "shelves";
    state.mode = "success";
    state.attempts = {};
    await openFixture(page, "long-title-shelf");
    await expect(page.getByRole("link", { name: LONG_TITLE })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.emulateMedia({ reducedMotion: "reduce" });
    const recommendationsTab = page.getByRole("tab", { name: "Recommendations" });
    const galleryTab = page.getByRole("tab", { name: "Gallery" });
    await recommendationsTab.focus();
    await recommendationsTab.press("ArrowRight");
    await expect(galleryTab).toBeFocused();
    const focusStyles = await galleryTab.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
        transitionMs: style.transitionDuration.endsWith("ms")
          ? Number.parseFloat(style.transitionDuration)
          : Number.parseFloat(style.transitionDuration) * 1000,
      };
    });
    expect(focusStyles.outlineStyle).not.toBe("none");
    expect(focusStyles.outlineWidth).toBeGreaterThanOrEqual(3);
    expect(focusStyles.transitionMs).toBeLessThanOrEqual(0.01);

    const primaryContrast = await page.locator(".preview-scroll").evaluate((node) => {
      const parse = (value: string) =>
        value
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map(Number)
          .map((channel) => {
            const normalized = channel / 255;
            return normalized <= 0.04045
              ? normalized / 12.92
              : ((normalized + 0.055) / 1.055) ** 2.4;
          });
      const luminance = ([red, green, blue]: number[]) =>
        0.2126 * red + 0.7152 * green + 0.0722 * blue;
      const style = getComputedStyle(node);
      const foreground = luminance(parse(style.color));
      const background = luminance(parse(style.backgroundColor));
      return (
        (Math.max(foreground, background) + 0.05) /
        (Math.min(foreground, background) + 0.05)
      );
    });
    expect(primaryContrast).toBeGreaterThanOrEqual(4.5);

    state.mode = "disabled";
    state.layout = "shelves";
    state.attempts = {};
    observed.length = 0;
    await openFixture(page, "disabled-query-proof");
    await expect(page.getByTestId("recommendations-shelves")).toBeVisible();
    expect(observed).toContain("GetPlacesLists");
    expect(observed).not.toContain("GetBooksLists");
    expect(observed).not.toContain("GetGuidesLists");
    await expect(
      page.getByRole("tab", { name: "Business Details" }),
    ).toHaveCount(0);
  });

  test("renders the dashboard presentation controls in light and dark modes without writing", async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);
    await setupMockAuthentication(context);
    await context.addInitScript(() => {
      if (!localStorage.getItem("dashboard-theme")) {
        localStorage.setItem("dashboard-theme", "dark");
      }
    });
    const mutations: string[] = [];
    const dashboardAccount = {
      documentId: "fixture-account",
      Account_Name: "Fixture Explorer",
      Account_Type: "personal",
      Bio: "Fixture bio",
      Addresss: {},
      Primary_Address: { address: "Fixture City" },
      Public_Profile_Address: null,
      Feed_Data: [],
      social_media: {
        theme_settings: {
          preset: "cinematic-dark",
          wallpaperMode: "solid-color",
          accentColor: "#10B981",
          landingTab: "all-recommendations",
          recommendations: { layout: "shelves", categoryOrder },
        },
      },
      mobile_number: "+10000000000",
      mobile_number_visibility: false,
      profile_picture: null,
      bg_picture: null,
    };
    await page.route("**/graphql", async (route) => {
      const operation = operationName(route);
      const payload = route.request().postDataJSON() as
        | { query?: string }
        | undefined;
      if (/\bmutation\b/.test(payload?.query || "")) mutations.push(operation);
      if (operation === "CheckOnboardingStatus") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              usersPermissionsUser: {
                accounts: [
                  {
                    Account_Name: dashboardAccount.Account_Name,
                    Account_Type: dashboardAccount.Account_Type,
                    mobile_number: dashboardAccount.mobile_number,
                  },
                ],
              },
            },
          }),
        });
      }
      if (operation === "UsersPermissionsUser") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              usersPermissionsUser: {
                username: "testuser",
                email: "test@explorers.earth",
                mobile_number: dashboardAccount.mobile_number,
                mobile_number_visibility: false,
                accounts: [dashboardAccount],
              },
            },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: {} }),
      });
    });

    for (const mode of ["dark", "light"] as const) {
      if (mode === "dark") {
        await page.goto("/profile", { waitUntil: "domcontentloaded" });
      } else {
        await page.evaluate(() => localStorage.setItem("dashboard-theme", "light"));
        await page.reload({ waitUntil: "domcontentloaded" });
      }
      await expect(page).toHaveURL(/\/profile$/);
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.documentElement.classList.contains("dashboard-theme-dark"),
          ),
        )
        .toBe(mode === "dark");

      const appearanceTab = page.getByRole("tab", {
        name: "Appearance",
        exact: true,
      });
      await expect(appearanceTab).toBeVisible();
      if ((await appearanceTab.getAttribute("aria-selected")) !== "true") {
        await appearanceTab.click();
      }
      await expect(page.getByTestId("appearance-workspace")).toBeVisible();
      await expect(page.getByRole("radio", { name: "Classic Shelves" })).toBeVisible();
      await expect(page.getByRole("radio", { name: "Category Mosaic" })).toBeVisible();
      await expect(page.getByRole("radio", { name: "Featured First" })).toBeVisible();
      await expect(page.getByLabel("First view").locator("option")).toHaveCount(12);
      await expect(
        page.getByTestId("recommendations-order-category"),
      ).toHaveCount(9);
      const moveDown = page.getByRole("button", { name: "Move Places down" });
      const box = await moveDown.boundingBox();
      expect(box?.height || 0).toBeGreaterThanOrEqual(44);
      expect(box?.width || 0).toBeGreaterThanOrEqual(44);
    }
    expect(mutations).toEqual([]);
  });
});
