import { expect, type Locator, type Page, type Route } from "@playwright/test";
import sharp from "sharp";

export type PresetId =
  | "cinematic-dark"
  | "glassmorphism"
  | "sunset-glow"
  | "minimal-light"
  | "emerald-nature"
  | "neon-cyber";

export type LayoutId = "shelves" | "grid" | "featured";

export type ScenarioMode =
  | "success"
  | "loading"
  | "empty"
  | "partial-error"
  | "stale-error"
  | "all-error"
  | "missing-image"
  | "broken-image"
  | "disabled";

export type WallpaperMode =
  | "solid-color"
  | "banner-top"
  | "full-wallpaper-image"
  | "ambient-gradient";

export interface FixtureState {
  preset: PresetId;
  layout: LayoutId;
  mode: ScenarioMode;
  wallpaperMode?: WallpaperMode;
  headerSocial?: boolean;
  landingTab?: string;
  business?: unknown;
  headerImageUrl?: string;
  footerBranding?: "enabled" | "minimal" | "disabled";
  attempts: Record<string, number>;
}

export const PRESETS: Record<
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

export const LAYOUT_TEST_IDS: Record<LayoutId, string> = {
  shelves: "recommendations-shelves",
  grid: "recommendations-grid",
  featured: "recommendations-featured",
};

export const ONE_PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
export const BRIGHT_HEADER_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWP4/+sSVsQwtCQA4xOywXehYf4AAAAASUVORK5CYII=";
export const LONG_TITLE =
  "A deliberately long sixty-four-character recommendation title for zoom";

export const categoryOrder = [
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

export const ALLOWLISTED_OPERATIONS = new Set([
  "CheckUsername",
  "PublicAccountBasic",
  "PublicProfileData",
  "BookListBySlug",
  "GetPlacesLists",
  "GetBooksLists",
  "GetGuidesLists",
  "GetMusicLists",
  "GetMovieLists",
  "GetGamesLists",
  "GetAppsLists",
  "GetProductsLists",
  "GetPeopleLists",
  "CheckOnboardingStatus",
  "UsersPermissionsUser",
  "Account",
  "user",
  "PublicCategoryListCounts",
  "Unknown",
]);

export const operationName = (route: Route) => {
  const request = route.request();
  try {
    const url = new URL(request.url());
    const queryParamOp = url.searchParams.get("operationName");
    if (queryParamOp) return queryParamOp;

    const payload = request.postDataJSON() as
      | { operationName?: string; query?: string }
      | undefined;
    if (payload?.operationName) return payload.operationName;
    if (payload?.query) {
      const match = payload.query.match(/(?:query|mutation)\s+(\w+)/);
      if (match?.[1]) return match[1];
    }

    const urlQueryMatch = url.searchParams.get("query")?.match(/(?:query|mutation)\s+(\w+)/);
    if (urlQueryMatch?.[1]) return urlQueryMatch[1];
  } catch {
    // Environment fallback
  }

  return "Unknown";
};

export const accountFixture = (state: FixtureState) => {
  const disabled = state.mode === "disabled";
  return {
    __typename: "Account",
    documentId: "fixture-account",
    Account_Name: "Fixture Explorer",
    Account_Type: "personal",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
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
        footerBranding: state.footerBranding || "disabled",
        recommendations: {
          layout: state.layout,
          categoryOrder,
        },
      },
    },
  };
};

export const placesFixture = (mode: ScenarioMode) => ({
  recommendationLists: [
    {
      documentId: "places-list",
      List_Name: LONG_TITLE,
      slug: "long-fixture-title",
      Visibility: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      List_Name_Details: null,
      recommendationCount: Array.from({ length: 500 }, (_, index) => ({
        documentId: `place-${index}`,
      })),
      recommended_places: [
        {
          documentId: "place-preview",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
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

export const booksFixture = (mode: ScenarioMode) => ({
  bookLists: [
    {
      documentId: "books-list",
      List_Name: "One thoughtful book list with thirty percent more copy",
      slug: "fixture-books",
      visibility: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      cover_image:
        mode === "missing-image"
          ? null
          : { url: "http://localhost:5173/e2e-cover.png" },
      recommendationCount: [{ documentId: "book-1" }],
      recommended_books: [],
    },
  ],
});

export const publicBookDetailFixture = {
  bookLists: [
    {
      __typename: "BookList",
      documentId: "books-list",
      List_Name: "Public sanitizer fixture",
      list_description: "Unauthenticated recommendation detail fixture",
      slug: "fixture-books",
      visibility: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      cover_image: null,
      display_order: 0,
      top_reads_heading: null,
      account: {
        __typename: "Account",
        documentId: "fixture-account",
        username: "presentation-fixture",
      },
      recommended_books: [
        {
          __typename: "RecommendedBook",
          documentId: "book-xss-fixture",
          volume_id: "volume-xss-fixture",
          title: "Fixture unsafe book",
          subtitle: null,
          authors: ["Fixture author"],
          year: "2026",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          cover_url: null,
          cover_url_large: null,
          subjects: [],
          google_rating: null,
          user_rating: null,
          description: null,
          is_pinned: false,
          pin_order: null,
          buy_links: [],
          Media: [],
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
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    },
  ],
};

export const guidesFixture = {
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

export const emptyPayload: Record<string, unknown> = {
  GetPlacesLists: { recommendationLists: [] },
  GetBooksLists: { bookLists: [] },
  GetGuidesLists: { guides: [] },
};

// Generate adversarial media image buffers
let brightImageBuf: Buffer | null = null;
let darkImageBuf: Buffer | null = null;
let highFreqImageBuf: Buffer | null = null;
let splitLuminanceImageBuf: Buffer | null = null;

async function getAdversarialImageBuffers() {
  if (!brightImageBuf) {
    brightImageBuf = await sharp({
      create: { width: 800, height: 400, channels: 3, background: { r: 255, g: 255, b: 255 } },
    })
      .png()
      .toBuffer();

    darkImageBuf = await sharp({
      create: { width: 800, height: 400, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();

    // High frequency 800x400 checkerboard pattern (1x1 pixels alternating)
    const rawHighFreq = Buffer.alloc(800 * 400 * 3);
    for (let y = 0; y < 400; y++) {
      for (let x = 0; x < 800; x++) {
        const idx = (y * 800 + x) * 3;
        const val = (x + y) % 2 === 0 ? 255 : 0;
        rawHighFreq[idx] = val;
        rawHighFreq[idx + 1] = val;
        rawHighFreq[idx + 2] = val;
      }
    }
    highFreqImageBuf = await sharp(rawHighFreq, {
      raw: { width: 800, height: 400, channels: 3 },
    })
      .png()
      .toBuffer();

    // Split luminance 800x400 (top half 200px white, bottom half 200px black)
    const rawSplit = Buffer.alloc(800 * 400 * 3);
    for (let y = 0; y < 400; y++) {
      for (let x = 0; x < 800; x++) {
        const idx = (y * 800 + x) * 3;
        const val = y < 200 ? 255 : 0;
        rawSplit[idx] = val;
        rawSplit[idx + 1] = val;
        rawSplit[idx + 2] = val;
      }
    }
    splitLuminanceImageBuf = await sharp(rawSplit, {
      raw: { width: 800, height: 400, channels: 3 },
    })
      .png()
      .toBuffer();
  }

  return {
    bright: brightImageBuf!,
    dark: darkImageBuf!,
    highFreq: highFreqImageBuf!,
    splitLuminance: splitLuminanceImageBuf!,
  };
}

export async function installPublicFixture(
  page: Page,
  state: FixtureState,
  observedOperations: string[],
  delays?: { usernameMs?: number; profileMs?: number; categoryMs?: number }
) {
  const images = await getAdversarialImageBuffers();

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
      body: images.bright,
    });
  });
  await page.route("**/e2e-dark-header.png", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: images.dark,
    });
  });
  await page.route("**/e2e-high-frequency-header.png", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: images.highFreq,
    });
  });
  await page.route("**/e2e-split-luminance-header.png", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: images.splitLuminance,
    });
  });
  await page.route("**/broken-cover.jpg", (route) =>
    route.fulfill({ status: 404, body: "broken fixture" }),
  );

  await page.route("**/graphql", async (route) => {
    const operation = operationName(route);

    // Enforce strict operation allowlist
    if (!ALLOWLISTED_OPERATIONS.has(operation)) {
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ errors: [{ message: `Forbidden unknown GraphQL operation: ${operation}` }] }),
      });
    }

    // Snapshot scenario state at request start so delayed responses never read later mutable fixture state
    const snapshotState: FixtureState = JSON.parse(JSON.stringify(state));

    observedOperations.push(operation);
    state.attempts[operation] = (state.attempts[operation] || 0) + 1;

    const account = accountFixture(snapshotState);

    if (operation === "CheckUsername") {
      if (delays?.usernameMs) {
        await new Promise((r) => setTimeout(r, delays.usernameMs));
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            accounts: [
              { __typename: "Account", documentId: account.documentId, Account_Name: account.Account_Name },
            ],
          },
        }),
      });
    }

    if (operation === "PublicAccountBasic" || operation === "PublicProfileData") {
      if (delays?.profileMs) {
        await new Promise((r) => setTimeout(r, delays.profileMs));
      }
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
      "GetMusicLists",
      "GetMovieLists",
      "GetGamesLists",
      "GetAppsLists",
      "GetProductsLists",
      "GetPeopleLists",
    ].includes(operation);

    if (!isCategoryOperation) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: emptyPayload[operation] || {} }),
      });
    }

    if (delays?.categoryMs) {
      await new Promise((r) => setTimeout(r, delays.categoryMs));
    }

    if (snapshotState.mode === "loading") {
      await new Promise((resolve) => setTimeout(resolve, 700));
    }

    const successData: Record<string, unknown> = {
      GetPlacesLists: placesFixture(snapshotState.mode),
      GetBooksLists: booksFixture(snapshotState.mode),
      GetGuidesLists: guidesFixture,
      GetMusicLists: { musicLists: [] },
      GetMovieLists: { movieLists: [] },
      GetGamesLists: { gameLists: [] },
      GetAppsLists: { appLists: [] },
      GetProductsLists: { productLists: [] },
      GetPeopleLists: { peopleLists: [] },
    };

    if (snapshotState.mode === "empty") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: emptyPayload[operation] || {} }),
      });
    }

    if (snapshotState.mode === "partial-error" && operation === "GetBooksLists") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: emptyPayload[operation] || {},
          errors: [{ message: "Fixture Books failure" }],
        }),
      });
    }

    if (snapshotState.mode === "stale-error" && operation === "GetPlacesLists") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: successData[operation],
          errors: [{ message: "Fixture cached Places failure" }],
        }),
      });
    }

    if (snapshotState.mode === "all-error" && (state.attempts[operation] || 0) <= 2) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: emptyPayload[operation] || {},
          errors: [{ message: `Fixture ${operation} failure` }],
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: successData[operation] || {} }),
    });
  });
}

export async function openFixture(page: Page, caseId: string) {
  const targetUrl = `/presentation-fixture?case=${encodeURIComponent(caseId)}`;
  await page.goto(targetUrl);
  await page.evaluate(() => new Promise((r) => setTimeout(r, 50)));
}

export async function expectNoHorizontalOverflow(page: Page) {
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

export async function renderedPixelContrast(locator: Locator) {
  const screenshot = await locator.screenshot({ animations: "disabled" });
  const { data, info } = await sharp(screenshot)
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

  return ratios[Math.min(ratios.length - 1, 3)];
}

export const getContrastTargets = (page: Page) => [
  { name: "account-name", locator: page.getByRole("heading", { level: 1 }), minRatio: 4.5 },
  { name: "location-text", locator: page.getByText("Fixture City", { exact: true }), minRatio: 4.5 },
  { name: "social-icon", locator: page.locator('a[href="https://instagram.com/fixture"]'), minRatio: 3.0 },
  { name: "bio-text", locator: page.getByText("A deterministic public profile fixture."), minRatio: 4.5 },
  { name: "tab-recommendations", locator: page.getByRole("tab", { name: "Recommendations" }).locator("span").first(), minRatio: 4.5 },
];

export async function evaluateCorePixelContrast(
  page: Page,
  targets: Array<{ name: string; locator: Locator; minRatio: number }>
) {
  const targetBoxes: Array<{ name: string; minRatio: number; box: { x: number; y: number; width: number; height: number } }> = [];
  for (const t of targets) {
    if (await t.locator.isVisible()) {
      const box = await t.locator.boundingBox();
      if (box && box.width > 0 && box.height > 0) {
        targetBoxes.push({ name: t.name, minRatio: t.minRatio, box });
      }
    }
  }
  if (targetBoxes.length === 0) return;

  // Pass 1: Normal Viewport Screenshot
  const normalScreenshot = await page.screenshot({ animations: "disabled" });

  // Pass 2: Background-Only Viewport Screenshot
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.id = "contrast-eval-style";
    style.textContent = `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
        transition-duration: 0s !important;
        animation-duration: 0s !important;
      }
      [data-contrast-target] {
        visibility: hidden !important;
      }
    `;
    document.head.appendChild(style);
  });
  for (const t of targets) {
    if (await t.locator.isVisible()) {
      await t.locator.evaluate((el) => el.setAttribute("data-contrast-target", "true"));
    }
  }
  const bgScreenshot = await page.screenshot({ animations: "disabled" });

  // Pass 3: Foreground Forced Black
  await page.evaluate(() => {
    const style = document.getElementById("contrast-eval-style");
    if (style) {
      style.textContent = `
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
          transition-duration: 0s !important;
          animation-duration: 0s !important;
        }
        [data-contrast-target], [data-contrast-target] * {
          visibility: visible !important;
          color: rgb(0,0,0) !important;
          fill: rgb(0,0,0) !important;
          stroke: rgb(0,0,0) !important;
          border-color: rgb(0,0,0) !important;
          outline-color: rgb(0,0,0) !important;
          background: transparent !important;
          box-shadow: none !important;
          text-shadow: none !important;
          opacity: 1 !important;
          transition: none !important;
          animation: none !important;
          transition-duration: 0s !important;
          animation-duration: 0s !important;
        }
      `;
    }
  });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50))));
  const blackScreenshot = await page.screenshot({ animations: "disabled" });

  // Pass 4: Foreground Forced White
  await page.evaluate(() => {
    const style = document.getElementById("contrast-eval-style");
    if (style) {
      style.textContent = `
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
          transition-duration: 0s !important;
          animation-duration: 0s !important;
        }
        [data-contrast-target], [data-contrast-target] * {
          visibility: visible !important;
          color: rgb(255,255,255) !important;
          fill: rgb(255,255,255) !important;
          stroke: rgb(255,255,255) !important;
          border-color: rgb(255,255,255) !important;
          outline-color: rgb(255,255,255) !important;
          background: transparent !important;
          box-shadow: none !important;
          text-shadow: none !important;
          opacity: 1 !important;
          transition: none !important;
          animation: none !important;
          transition-duration: 0s !important;
          animation-duration: 0s !important;
        }
      `;
    }
  });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50))));
  const whiteScreenshot = await page.screenshot({ animations: "disabled" });

  // Clean up injected styles
  await page.evaluate(() => {
    const style = document.getElementById("contrast-eval-style");
    if (style) style.remove();
    document.querySelectorAll("[data-contrast-target]").forEach((el) => el.removeAttribute("data-contrast-target"));
  });

  const normalImg = await sharp(normalScreenshot).raw().toBuffer({ resolveWithObject: true });
  const bgImg = await sharp(bgScreenshot).raw().toBuffer({ resolveWithObject: true });
  const blackImg = await sharp(blackScreenshot).raw().toBuffer({ resolveWithObject: true });
  const whiteImg = await sharp(whiteScreenshot).raw().toBuffer({ resolveWithObject: true });

  const width = normalImg.info.width;
  const height = normalImg.info.height;

  const dprX = width / (await page.evaluate(() => window.innerWidth));
  const dprY = height / (await page.evaluate(() => window.innerHeight));

  const calculateLuminance = (r: number, g: number, b: number) => {
    const sR = r / 255;
    const sG = g / 255;
    const sB = b / 255;
    const R = sR <= 0.04045 ? sR / 12.92 : ((sR + 0.055) / 1.055) ** 2.4;
    const G = sG <= 0.04045 ? sG / 12.92 : ((sG + 0.055) / 1.055) ** 2.4;
    const B = sB <= 0.04045 ? sB / 12.92 : ((sB + 0.055) / 1.055) ** 2.4;
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };

  const getContrastRatio = (lum1: number, lum2: number) => {
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
  };

  for (const t of targetBoxes) {
    const startX = Math.max(0, Math.floor(t.box.x * dprX));
    const startY = Math.max(0, Math.floor(t.box.y * dprY));
    const endX = Math.min(width, Math.ceil((t.box.x + t.box.width) * dprX));
    const endY = Math.min(height, Math.ceil((t.box.y + t.box.height) * dprY));

    const ratios: number[] = [];

    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        const idx = (py * width + px) * normalImg.info.channels;

        const wR = whiteImg.data[idx];
        const wG = whiteImg.data[idx + 1];
        const wB = whiteImg.data[idx + 2];

        const bkR = blackImg.data[idx];
        const bkG = blackImg.data[idx + 1];
        const bkB = blackImg.data[idx + 2];

        const alphaR = (wR - bkR) / 255;
        const alphaG = (wG - bkG) / 255;
        const alphaB = (wB - bkB) / 255;

        if (alphaR >= 0.90 && alphaG >= 0.90 && alphaB >= 0.90) {
          const alpha = (alphaR + alphaG + alphaB) / 3;
          const bgR = bgImg.data[idx];
          const bgG = bgImg.data[idx + 1];
          const bgB = bgImg.data[idx + 2];

          const normR = normalImg.data[idx];
          const normG = normalImg.data[idx + 1];
          const normB = normalImg.data[idx + 2];

          const fgR = Math.max(0, Math.min(255, (normR - (1 - alpha) * bgR) / alpha));
          const fgG = Math.max(0, Math.min(255, (normG - (1 - alpha) * bgG) / alpha));
          const fgB = Math.max(0, Math.min(255, (normB - (1 - alpha) * bgB) / alpha));

          const fgLum = calculateLuminance(fgR, fgG, fgB);
          const bgLum = calculateLuminance(bgR, bgG, bgB);

          const ratio = getContrastRatio(fgLum, bgLum);
          ratios.push(ratio);
        }
      }
    }

    if (ratios.length > 0) {
      ratios.sort((a, b) => a - b);
      const p5Index = Math.floor(ratios.length * 0.05);
      const coreRatio = ratios[p5Index];
      expect(
        coreRatio,
        `Core pixel contrast for "${t.name}" (5th percentile ratio = ${coreRatio.toFixed(2)})`
      ).toBeGreaterThanOrEqual(t.minRatio);
    }
  }
}
