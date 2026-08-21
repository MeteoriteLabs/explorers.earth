import { expect, test, type Page, type Route } from "@playwright/test";
import sharp from "sharp";
import { setupMockAuthentication } from "./setup/auth";

type PresetId =
  | "cinematic-dark"
  | "glassmorphism"
  | "sunset-glow"
  | "minimal-light"
  | "emerald-nature"
  | "neon-cyber";
type LayoutId = "shelves" | "grid" | "featured";
type ScenarioMode =
  | "success"
  | "loading"
  | "empty"
  | "partial-error"
  | "stale-error"
  | "all-error"
  | "missing-image"
  | "broken-image"
  | "disabled";

interface FixtureState {
  preset: PresetId;
  layout: LayoutId;
  mode: ScenarioMode;
  wallpaperMode?:
    | "solid-color"
    | "banner-top"
    | "full-wallpaper-image"
    | "ambient-gradient";
  headerSocial?: boolean;
  landingTab?: string;
  business?: unknown;
  headerImageUrl?: string;
  attempts: Record<string, number>;
}

const PRESETS: Record<
  PresetId,
  { page: string; card: string; primary: string; secondary: string; accent: string }
> = {
  "cinematic-dark": {
    page: "#090D16",
    card: "#111827",
    primary: "#FFFFFF",
    secondary: "#9CA3AF",
    accent: "#10B981",
  },
  glassmorphism: {
    page: "#0F172A",
    card: "rgba(255, 255, 255, 0.07)",
    primary: "#FFFFFF",
    secondary: "#94A3B8",
    accent: "#38BDF8",
  },
  "sunset-glow": {
    page: "#1A0B2E",
    card: "#2D124D",
    primary: "#FFFFFF",
    secondary: "#E9D5FF",
    accent: "#EC4899",
  },
  "minimal-light": {
    page: "#F8FAFC",
    card: "#FFFFFF",
    primary: "#0F172A",
    secondary: "#64748B",
    accent: "#0F172A",
  },
  "emerald-nature": {
    page: "#064E3B",
    card: "#047857",
    primary: "#FFFFFF",
    secondary: "#A7F3D0",
    accent: "#059669",
  },
  "neon-cyber": {
    page: "#030712",
    card: "#111827",
    primary: "#FFFFFF",
    secondary: "#FCA5A5",
    accent: "#F43F5E",
  },
};

const LAYOUT_TEST_IDS: Record<LayoutId, string> = {
  shelves: "recommendations-shelves",
  grid: "recommendations-grid",
  featured: "recommendations-featured",
};

const ONE_PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const BRIGHT_HEADER_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWP4/+sSVsQwtCQA4xOywXehYf4AAAAASUVORK5CYII=";
const LONG_TITLE =
  "A deliberately long sixty-four-character recommendation title for zoom";

const categoryOrder = [
  "books",
  "places",
  "guides",
  "music",
  "movies",
  "games",
  "apps",
  "products",
  "people",
];

const operationName = (route: Route) => {
  const payload = route.request().postDataJSON() as
    | { operationName?: string; query?: string }
    | undefined;
  return (
    payload?.operationName ||
    payload?.query?.match(/(?:query|mutation)\s+(\w+)/)?.[1] ||
    "Unknown"
  );
};

const accountFixture = (state: FixtureState) => {
  const disabled = state.mode === "disabled";
  return {
    documentId: "fixture-account",
    Account_Name: "Fixture Explorer",
    Account_Type: "personal",
    Primary_Address: { address: "Fixture City" },
    Bio: "A deterministic public profile fixture.",
    Feed_Data: [],
    Public_Profile_Address: state.business ?? null,
    bg_picture: { url: state.headerImageUrl || "/images/bg-image.jpg" },
    profile_picture: { url: "/images/Profile.jpg" },
    mobile_number_visibility: false,
    public_profile: "Yes",
    public_recommendations: "Yes",
    public_books: disabled ? "No" : "Yes",
    public_guides: disabled ? "No" : "Yes",
    public_music: "No",
    public_movie: "No",
    public_games: "No",
    public_apps: "No",
    public_products: "No",
    public_people: "No",
    localtunes_public: null,
    pinned_nav_tabs: [],
    auto_pinning: false,
    social_media: {
      ...(state.headerSocial
        ? {
            instagram: {
              link: "https://instagram.com/fixture",
              visibility: true,
            },
          }
        : {}),
      theme_settings: {
        preset: state.preset,
        wallpaperMode: state.wallpaperMode || "solid-color",
        accentColor: PRESETS[state.preset].accent,
        landingTab: state.landingTab || "all-recommendations",
        visibleTabs: {
          recommendations: false,
          gallery: false,
          business: false,
        },
        footerBranding: "disabled",
        recommendations: {
          layout: state.layout,
          categoryOrder,
        },
      },
    },
  };
};

const placesFixture = (mode: ScenarioMode) => ({
  recommendationLists: [
    {
      documentId: "places-list",
      List_Name: LONG_TITLE,
      slug: "long-fixture-title",
      Visibility: true,
      List_Name_Details: null,
      recommendationCount: Array.from({ length: 500 }, (_, index) => ({
        documentId: `place-${index}`,
      })),
      recommended_places: [
        {
          documentId: "place-preview",
          media_details: {
            thumbnail: {
              url:
                mode === "broken-image"
                  ? "http://localhost:5173/broken-cover.jpg"
                  : "http://localhost:5173/e2e-cover.png",
            },
          },
          Media: [],
          Place_Details: {},
        },
      ],
    },
  ],
});

const booksFixture = (mode: ScenarioMode) => ({
  bookLists: [
    {
      documentId: "books-list",
      List_Name: "One thoughtful book list with thirty percent more copy",
      slug: "fixture-books",
      visibility: true,
      cover_image:
        mode === "missing-image"
          ? null
          : { url: "http://localhost:5173/e2e-cover.png" },
      recommendationCount: [{ documentId: "book-1" }],
      recommended_books: [],
    },
  ],
});

const publicBookDetailFixture = {
  bookLists: [
    {
      documentId: "books-list",
      List_Name: "Public sanitizer fixture",
      list_description: "Unauthenticated recommendation detail fixture",
      slug: "fixture-books",
      visibility: true,
      cover_image: null,
      display_order: 0,
      top_reads_heading: null,
      recommended_books: [
        {
          documentId: "book-xss-fixture",
          volume_id: "volume-xss-fixture",
          title: "Fixture unsafe book",
          subtitle: null,
          authors: ["Fixture author"],
          year: "2026",
          cover_url: null,
          cover_url_large: null,
          subjects: [],
          google_rating: null,
          user_rating: null,
          description: null,
          user_recommendation_note: [
            {
              type: "paragraph",
              children: [
                {
                  type: "text",
                  text: [
                    "<h2>Public note heading</h2>",
                    '<p><span style="color: rgb(230, 0, 0)">Palette text</span> <strong>Quill bold E2E</strong></p>',
                    '<ol><li data-list="ordered"><span class="ql-ui"></span>Ordered E2E</li><li data-list="bullet"><span class="ql-ui"></span>Bullet E2E</li></ol>',
                    '<a href="https://trusted.example/note">Trusted E2E link</a>',
                    '<img src="/broken-xss.png" onerror="window.__publicNoteXss=\'image\'">',
                    '<svg onload="window.__publicNoteXss=\'svg\'"></svg>',
                    '<script>window.__publicNoteXss="script"</script>',
                    '<a href="javascript:window.__publicNoteXss=\'link\'">Unsafe E2E link</a>',
                  ].join(""),
                },
              ],
            },
          ],
          buy_links: [],
          is_pinned: false,
          pin_order: null,
          media_details: null,
          Media: [],
        },
      ],
      account: {
        documentId: "fixture-account",
        username: "presentation-fixture",
      },
    },
  ],
};

const guidesFixture = {
  guides: [
    {
      documentId: "guide-1",
      Title: "Fixture Guide",
      slug: "fixture-guide",
      Visibility: true,
      Guide_Media: [],
    },
  ],
};

const emptyPayload: Record<string, unknown> = {
  GetPlacesLists: { recommendationLists: [] },
  GetBooksLists: { bookLists: [] },
  GetGuidesLists: { guides: [] },
};

async function installPublicFixture(
  page: Page,
  state: FixtureState,
  observedOperations: string[],
) {
  await page.route("**/e2e-cover.png", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(ONE_PIXEL_PNG, "base64"),
    });
  });
  await page.route("**/e2e-bright-header.png", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(BRIGHT_HEADER_PNG, "base64"),
    });
  });
  await page.route("**/broken-cover.jpg", (route) =>
    route.fulfill({ status: 404, body: "broken fixture" }),
  );
  await page.route("**/graphql", async (route) => {
    const operation = operationName(route);
    observedOperations.push(operation);
    state.attempts[operation] = (state.attempts[operation] || 0) + 1;

    const account = accountFixture(state);
    if (operation === "CheckUsername") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            accounts: [
              { documentId: account.documentId, Account_Name: account.Account_Name },
            ],
          },
        }),
      });
    }
    if (operation === "PublicAccountBasic" || operation === "PublicProfileData") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { accounts: [account] } }),
      });
    }
    if (operation === "BookListBySlug") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: publicBookDetailFixture }),
      });
    }

    const isCategoryOperation = [
      "GetPlacesLists",
      "GetBooksLists",
      "GetGuidesLists",
    ].includes(operation);
    if (!isCategoryOperation) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: {} }),
      });
    }

    if (state.mode === "loading") {
      await new Promise((resolve) => setTimeout(resolve, 700));
    }

    const successData: Record<string, unknown> = {
      GetPlacesLists: placesFixture(state.mode),
      GetBooksLists: booksFixture(state.mode),
      GetGuidesLists: guidesFixture,
    };
    if (state.mode === "empty") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: emptyPayload[operation] }),
      });
    }
    if (state.mode === "partial-error" && operation === "GetBooksLists") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: emptyPayload[operation],
          errors: [{ message: "Fixture Books failure" }],
        }),
      });
    }
    if (state.mode === "stale-error" && operation === "GetPlacesLists") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: successData[operation],
          errors: [{ message: "Fixture cached Places failure" }],
        }),
      });
    }
    if (state.mode === "all-error" && state.attempts[operation] === 1) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: emptyPayload[operation],
          errors: [{ message: `Fixture ${operation} failure` }],
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: successData[operation] }),
    });
  });
}

async function openFixture(page: Page, caseId: string) {
  await page.goto(`/presentation-fixture?case=${encodeURIComponent(caseId)}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("tab", { name: "Recommendations" }),
  ).toHaveAttribute("aria-selected", "true");
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
}

const toLinearLight = (channel: number) => {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const luminance = ([red, green, blue]: [number, number, number]) =>
  0.2126 * toLinearLight(red) +
  0.7152 * toLinearLight(green) +
  0.0722 * toLinearLight(blue);

const contrastRatio = (
  first: [number, number, number],
  second: [number, number, number],
) => {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
};

async function renderedPixelContrast(locator: ReturnType<Page["locator"]>) {
  const screenshot = await locator.screenshot({ animations: "disabled" });
  const { data, info } = await sharp(screenshot)
    .flatten({ background: "#ffffff" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buckets = new Map<
    string,
    { count: number; red: number; green: number; blue: number }
  >();
  for (let index = 0; index < data.length; index += info.channels) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const key = `${Math.round(red / 8)}:${Math.round(green / 8)}:${Math.round(blue / 8)}`;
    const bucket = buckets.get(key) || { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    buckets.set(key, bucket);
  }

  const backgroundBucket = [...buckets.values()].sort(
    (first, second) => second.count - first.count,
  )[0];
  const background: [number, number, number] = [
    Math.round(backgroundBucket.red / backgroundBucket.count),
    Math.round(backgroundBucket.green / backgroundBucket.count),
    Math.round(backgroundBucket.blue / backgroundBucket.count),
  ];
  const ratios: number[] = [];
  for (let index = 0; index < data.length; index += info.channels) {
    ratios.push(
      contrastRatio(
        [data[index], data[index + 1], data[index + 2]],
        background,
      ),
    );
  }
  ratios.sort((first, second) => second - first);

  // Require multiple rendered core pixels to carry this contrast so one stray
  // edge pixel cannot make a low-contrast glyph pass. WCAG contrast is defined
  // from the solid glyph color; anti-aliased edge pixels are intentionally not
  // used as the representative foreground.
  return ratios[Math.min(ratios.length - 1, 3)];
}

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
      const categories = page
        .getByTestId("recommendations-grid")
        .locator(":scope > [data-category-id]");
      const first = await categories.nth(0).boundingBox();
      const second = await categories.nth(1).boundingBox();
      if (width < 640) {
        expect(Math.abs((first?.y || 0) - (second?.y || 0))).toBeGreaterThan(10);
      } else {
        expect(Math.abs((first?.y || 0) - (second?.y || 0))).toBeLessThan(2);
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
