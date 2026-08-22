import { expect, type Locator, type Page, type Route } from "@playwright/test";
import sharp from "sharp";
import {
  ACCOUNT_BOOTSTRAP,
  PUBLIC_COLLECTION_OPERATIONS,
  PUBLIC_RUNTIME_OPERATION_CAPABILITIES,
} from "../../scripts/public-api-capabilities.mjs";

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
  headerImageUrl?: string | null;
  footerBranding?: "enabled" | "minimal" | "disabled";
  categoryOrder?: string[];
  bio?: string | null;
  feedItems?: unknown[];
  socialVisibility?: "none" | "visible" | "hidden";
  enabledCategories?: string[];
  localTunesUrl?: string | null;
  attempts: Record<string, number>;
}

export type RouteContractFixtureOutcome =
  | "content"
  | "empty"
  | "missing-child"
  | "unknown-user";

export interface RouteContractFixtureController {
  outcome: RouteContractFixtureOutcome;
  hiddenField?: string;
  httpStatus?: 401 | 403 | 429 | 500;
  bootstrapDelayMs: number;
  leafDelayMs: number;
  responseLabel?: string;
  observedOperations: string[];
  unknownOperations: string[];
  attempts: Record<string, number>;
  networkAudit: {
    consoleErrors: string[];
    failedRequests: Array<{ method: string; url: string; failure: string }>;
    badResponses: Array<{ method: string; url: string; status: number }>;
    unknownRequests: Array<{ method: string; url: string; resourceType: string }>;
  };
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

const PUBLIC_RUNTIME_OPERATIONS = [
  ...ACCOUNT_BOOTSTRAP.runtimeOperationNames,
  ...PUBLIC_COLLECTION_OPERATIONS.flatMap((capability) => capability.runtimeOperationNames),
];

export const PUBLIC_ANALYTICS_OPERATION_NAMES = new Set([
  "CreatePublicPageAnalytic",
]);

export const DASHBOARD_FIXTURE_OPERATION_NAMES = new Set([
  "CheckUsername",
  "PublicProfileData",
  "GetMusicLists",
  "CheckOnboardingStatus",
  "user",
]);

export const ALLOWLISTED_OPERATIONS = new Set([
  ...PUBLIC_RUNTIME_OPERATIONS,
  ...PUBLIC_ANALYTICS_OPERATION_NAMES,
  ...DASHBOARD_FIXTURE_OPERATION_NAMES,
]);

export const operationName = (route: Route): string | null => {
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

  return null;
};

export const accountFixture = (state: FixtureState) => {
  const disabled = state.mode === "disabled";
  const headerImageUrl = state.headerImageUrl === undefined
    ? "/images/bg-image.jpg"
    : state.headerImageUrl;
  const socialVisibility = state.socialVisibility ?? (state.headerSocial ? "visible" : "none");
  const categoryIsEnabled = (category: string, defaultValue: boolean) =>
    state.enabledCategories
      ? state.enabledCategories.includes(category)
      : defaultValue;
  return {
    __typename: "Account",
    documentId: "fixture-account",
    Account_Name: "Fixture Explorer",
    Account_Type: "personal",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    Primary_Address: { address: "Fixture City" },
    Bio: state.bio === undefined ? "A deterministic public profile fixture." : state.bio,
    Feed_Data: state.feedItems ?? [],
    Public_Profile_Address: state.business ?? null,
    bg_picture: headerImageUrl ? { url: headerImageUrl } : null,
    profile_picture: { url: "/images/Profile.jpg" },
    mobile_number_visibility: false,
    public_profile: "Yes",
    public_recommendations: categoryIsEnabled("places", true) ? "Yes" : "No",
    public_books: categoryIsEnabled("books", !disabled) ? "Yes" : "No",
    public_guides: categoryIsEnabled("guides", !disabled) ? "Yes" : "No",
    public_music: categoryIsEnabled("music", false) ? "Yes" : "No",
    public_movie: categoryIsEnabled("movies", false) ? "Yes" : "No",
    public_games: categoryIsEnabled("games", false) ? "Yes" : "No",
    public_apps: categoryIsEnabled("apps", false) ? "Yes" : "No",
    public_products: categoryIsEnabled("products", false) ? "Yes" : "No",
    public_people: categoryIsEnabled("people", false) ? "Yes" : "No",
    localtunes_public: state.localTunesUrl ?? null,
    pinned_nav_tabs: [],
    auto_pinning: false,
    social_media: {
      ...(socialVisibility !== "none"
        ? {
            instagram: {
              link: "https://instagram.com/fixture",
              visibility: socialVisibility === "visible",
            },
          }
        : {}),
      theme_settings: {
        preset: state.preset,
        wallpaperMode: state.wallpaperMode || "solid-color",
        accentColor: PRESETS[state.preset].accent,
        landingTab: state.landingTab || "all-recommendations",
        visibleTabs: {
          recommendations: true,
          gallery: true,
          business: true,
        },
        footerBranding: state.footerBranding || "disabled",
        recommendations: {
          layout: state.layout,
          categoryOrder: state.categoryOrder ?? categoryOrder,
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
          media_details: null,
        },
      ],
      account: {
        __typename: "Account",
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

  await page.route("**/api/playlist/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        playlists: state.enabledCategories?.includes("music")
          ? [{
              id: "fixture-playlist",
              name: "Fixture playlist",
              isVisibleToGuests: true,
              songs: [],
            }]
          : [],
      }),
    });
  });

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
    if (!operation || !ALLOWLISTED_OPERATIONS.has(operation)) {
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ errors: [{ message: "Forbidden anonymous, malformed, or undeclared GraphQL operation" }] }),
      });
    }

    // Snapshot scenario state at request start so delayed responses never read later mutable fixture state
    const snapshotState: FixtureState = JSON.parse(JSON.stringify(state));

    observedOperations.push(operation);
    state.attempts[operation] = (state.attempts[operation] || 0) + 1;

    const account = accountFixture(snapshotState);

    if (operation === "PublicProfileBootstrap") {
      if (delays?.usernameMs) {
        await new Promise((r) => setTimeout(r, delays.usernameMs));
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { accounts: [account] } }),
      });
    }

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

    if (operation === "PublicProfileContent") {
      if (delays?.profileMs) {
        await new Promise((r) => setTimeout(r, delays.profileMs));
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            account: {
              Bio: account.Bio,
              createdAt: account.createdAt,
              Public_Profile_Address: account.Public_Profile_Address,
              Feed_Data: account.Feed_Data,
              mobile_number_visibility: account.mobile_number_visibility,
            },
          },
        }),
      });
    }

    if (operation === "CreatePublicPageAnalytic") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { createPublicPageAnalytic: null } }),
      });
    }

    if (operation === "PublicCategoryListCounts") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            recommendationLists: [],
            bookLists: [],
            movieLists: [],
            gameLists: [],
            appLists: [],
            productLists: [],
            personLists: [],
            guides: [],
          },
        }),
      });
    }

    if (operation === "PublicBookData") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            bookLists: [{
              documentId: "saved-books-list",
              List_Name: "Saved books",
              list_description: "Saved public category parity",
              slug: "saved-books",
              cover_image: null,
              top_reads_heading: null,
              recommended_books: [],
            }],
          },
        }),
      });
    }

    if (operation === "BookListBySlug") {
      const fixtureList = publicBookDetailFixture.bookLists[0];
      const { recommended_books: fixtureBooks, ...publicList } = fixtureList;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            bookLists: [publicList],
            recommendedBooks_connection: {
              nodes: fixtureBooks,
              pageInfo: {
                page: 1,
                pageSize: 200,
                pageCount: 1,
                total: fixtureBooks.length,
              },
            },
          },
        }),
      });
    }

    const isCategoryOperation = [
      "GetPlacesLists",
      "GetBooksLists",
      "GetGuidesLists",
      "GetMusicLists",
      "GetMoviesLists",
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

    const listFixture = {
      documentId: "fixture-list",
      List_Name: "Fixture list",
      slug: "fixture-list",
      Visibility: true,
      visibility: true,
      cover_image: null,
      recommendationCount: [{ documentId: "fixture-item" }],
    };
    const successData: Record<string, unknown> = {
      GetPlacesLists: placesFixture(snapshotState.mode),
      GetBooksLists: booksFixture(snapshotState.mode),
      GetGuidesLists: guidesFixture,
      GetMusicLists: { musicLists: [] },
      GetMoviesLists: { movieLists: [{ ...listFixture, recommended_movies: [] }] },
      GetGamesLists: { gameLists: [{ ...listFixture, recommended_games: [] }] },
      GetAppsLists: { appLists: [{ ...listFixture, recommended_apps: [] }] },
      GetProductsLists: { productLists: [{ ...listFixture, recommended_products: [] }] },
      GetPeopleLists: { personLists: [{ ...listFixture, recommended_people: [] }] },
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

    if (snapshotState.mode === "all-error" && (state.attempts[operation] || 0) <= 1) {
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

const routeContractOperations = new Set(PUBLIC_RUNTIME_OPERATION_CAPABILITIES.keys());

const emptyConnection = {
  nodes: [],
  pageInfo: { page: 1, pageSize: 200, pageCount: 1, total: 0 },
};

const routeList = {
  __typename: "PublicFixtureList",
  documentId: "example",
  List_Name: "Fixture list",
  list_description: "Deterministic empty list",
  slug: "example",
  Visibility: true,
  is_pinned: false,
  pin_order: null,
  display_order: 0,
  List_Name_Details: null,
  cover_image: null,
  top_picks_heading: null,
  top_reads_heading: null,
  top_apps_heading: null,
  top_products_heading: null,
  top_people_heading: null,
  account: { documentId: "fixture-account", username: "route-fixture" },
};

function routeContractResponse(
  operation: string,
  outcome: RouteContractFixtureOutcome,
  responseLabel?: string,
): Record<string, unknown> {
  const childExists = outcome !== "missing-child";
  const list = childExists ? [{ ...routeList, List_Name: responseLabel ?? routeList.List_Name }] : [];
  const taxonomy = childExists ? [{ documentId: "example", genre_name: "Example", subject_name: "Example", Category_name: "Example" }] : [];

  const responses: Record<string, Record<string, unknown>> = {
    PublicCategoryListCounts: {
      recommendationLists: [], bookLists: [], movieLists: [], gameLists: [],
      appLists: [], productLists: [], personLists: [], guides: [],
    },
    PublicProfileContent: {
      account: {
        Bio: "Deterministic route fixture",
        createdAt: "2026-01-01T00:00:00.000Z",
        Public_Profile_Address: null,
        Feed_Data: [],
        mobile_number_visibility: false,
      },
    },
    PublicAccountBasic: { accounts: [] },
    UsersPermissionsUser: { usersPermissionsUsers: [] },
    GetPlacesLists: { recommendationLists: [] },
    GetBooksLists: { bookLists: [] },
    GetGuidesLists: { guides: [] },
    GetMoviesLists: { movieLists: [] },
    GetGamesLists: { gameLists: [] },
    GetAppsLists: { appLists: [] },
    GetProductsLists: { productLists: [] },
    GetPeopleLists: { personLists: [] },
    PublicPlacesLists: { recommendationLists: [] },
    PublicPlaceListBySlug: {
      recommendationLists: list,
      recommendedPeople_connection: emptyConnection,
      recommendedProducts_connection: emptyConnection,
    },
    PublicRecommendedPlacesConnection: { recommendedPlaces_connection: emptyConnection },
    GetPublicGuides: { guides: [] },
    GetPublicGuideBySlug: {
      guides: childExists ? [{
        ...routeList,
        Title: "Fixture guide",
        Description: "Empty guide",
        Guide_Type: null,
        Estimated_Budget: null,
        Number_Of_Days: null,
        Guide_Media: [],
        Place_Details: null,
        Tips_Notes: null,
        Guide_Section_Details: null,
        Guide_Tags: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }] : [],
      guideSections_connection: emptyConnection,
    },
    PublicMovieData: { movieLists: [], recommendedMovies: [] },
    MovieListBySlug: { movieLists: list, recommendedMovies_connection: emptyConnection },
    MoviesByGenre: { movieCategories: taxonomy, recommendedMovies_connection: emptyConnection },
    PublicBookData: { bookLists: [], recommendedBooks: [] },
    BookListBySlug: { bookLists: list, recommendedBooks_connection: emptyConnection },
    BooksBySubject: { bookCategories: taxonomy, recommendedBooks_connection: emptyConnection },
    PublicGameData: { gameLists: [], recommendedGames: [] },
    GameListBySlug: { gameLists: list, recommendedGames_connection: emptyConnection },
    GamesByGenre: { gameCategories: taxonomy, recommendedGames_connection: emptyConnection },
    PublicAppData: { appLists: [], recommendedApps: [] },
    AppListBySlug: { appLists: list, recommendedApps_connection: emptyConnection },
    PublicProductData: { productLists: [], recommendedProducts: [] },
    ProductListBySlug: { productLists: list, recommendedProducts_connection: emptyConnection },
    PublicPeopleData: { personLists: [] },
    PersonListBySlug: { personLists: list, recommendedPeople_connection: emptyConnection },
    PeopleBySector: { peopleCategories: taxonomy, recommendedPeople_connection: emptyConnection },
    Account: {
      accounts: [{
        documentId: "fixture-account",
        Account_Name: "Route Fixture",
        recommendation_lists: childExists ? [{
          documentId: "example",
          List_Name: "Example",
          recommended_places: [],
        }] : [],
        recommended_places: [],
      }],
      account: { documentId: "fixture-account", mobile_number_visibility: false, mobile_number: null },
    },
    CreatePublicPageAnalytic: { createPublicPageAnalytic: null },
  };

  return responses[operation] ?? {};
}

export async function installPublicRouteContractFixture(
  page: Page,
  initial: Partial<Pick<RouteContractFixtureController, "outcome" | "hiddenField" | "httpStatus" | "bootstrapDelayMs" | "leafDelayMs">> = {},
): Promise<RouteContractFixtureController> {
  const controller: RouteContractFixtureController = {
    outcome: initial.outcome ?? "empty",
    hiddenField: initial.hiddenField,
    httpStatus: initial.httpStatus,
    bootstrapDelayMs: initial.bootstrapDelayMs ?? 0,
    leafDelayMs: initial.leafDelayMs ?? 0,
    observedOperations: [],
    unknownOperations: [],
    attempts: {},
    networkAudit: {
      consoleErrors: [],
      failedRequests: [],
      badResponses: [],
      unknownRequests: [],
    },
  };

  page.on("console", (message) => {
    if (message.type() === "error") controller.networkAudit.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => controller.networkAudit.consoleErrors.push(error.message));
  page.on("requestfailed", (request) => {
    controller.networkAudit.failedRequests.push({
      method: request.method(),
      url: request.url(),
      failure: request.failure()?.errorText ?? "unknown",
    });
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      controller.networkAudit.badResponses.push({
        method: response.request().method(),
        url: response.url(),
        status: response.status(),
      });
    }
  });

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!/^https?:$/.test(url.protocol)) return route.fallback();
    const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    const unknownLocalDataRequest =
      local &&
      ["fetch", "xhr"].includes(request.resourceType()) &&
      url.pathname !== "/graphql" &&
      !url.pathname.startsWith("/api/subscriptions/");
    if (!local || unknownLocalDataRequest) {
      controller.networkAudit.unknownRequests.push({
        method: request.method(),
        url: request.url(),
        resourceType: request.resourceType(),
      });
      await route.abort("blockedbyclient");
      return;
    }
    await route.fallback();
  });

  for (const url of [
    "https://www.google-analytics.com/**",
    "https://*.clarity.ms/**",
    "https://maps.googleapis.com/**",
    "https://fonts.googleapis.com/**",
    "https://fonts.gstatic.com/**",
    "https://www.googletagmanager.com/**",
    "https://zupimages.net/**",
  ]) {
    await page.route(url, (route) => route.fulfill({ status: 204, body: "" }));
  }
  await page.route("**/api/subscriptions/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data: [], count: 0 }),
  }));
  await page.route("**/graphql", async (route) => {
    const operation = operationName(route);
    if (!operation || (!routeContractOperations.has(operation) && !PUBLIC_ANALYTICS_OPERATION_NAMES.has(operation))) {
      controller.unknownOperations.push(operation ?? "anonymous-or-malformed");
      return route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ errors: [{ message: "Forbidden anonymous, malformed, or undeclared GraphQL operation" }] }),
      });
    }
    controller.observedOperations.push(operation);
    controller.attempts[operation] = (controller.attempts[operation] ?? 0) + 1;

    if (controller.httpStatus && operation !== "CreatePublicPageAnalytic") {
      return route.fulfill({
        status: controller.httpStatus,
        contentType: "application/json",
        body: JSON.stringify({ errors: [{ message: `Fixture HTTP ${controller.httpStatus}` }] }),
      });
    }

    if (operation === "PublicProfileBootstrap") {
      if (controller.bootstrapDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, controller.bootstrapDelayMs));
      }
      if (controller.outcome === "unknown-user") {
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { accounts: [] } }) });
      }
      const visibility = (field: string) => controller.hiddenField === field ? "No" : "Yes";
      const account = {
        __typename: "Account",
        documentId: "fixture-account",
        Account_Name: "Route Fixture",
        Account_Type: "personal",
        Primary_Address: { address: "Fixture City" },
        bg_picture: null,
        profile_picture: null,
        social_media: { theme_settings: { preset: "cinematic-dark", wallpaperMode: "solid-color" } },
        localtunes_public: null,
        public_profile: visibility("public_profile"),
        public_recommendations: visibility("public_recommendations"),
        public_music: visibility("public_music"),
        public_movie: visibility("public_movie"),
        public_books: visibility("public_books"),
        public_guides: visibility("public_guides"),
        public_games: visibility("public_games"),
        public_apps: visibility("public_apps"),
        public_products: visibility("public_products"),
        public_people: visibility("public_people"),
        pinned_nav_tabs: [],
        auto_pinning: false,
      };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { accounts: [account] } }) });
    }

    const responseLabel = controller.responseLabel;
    if (controller.leafDelayMs > 0 && operation !== "CreatePublicPageAnalytic") {
      await new Promise((resolve) => setTimeout(resolve, controller.leafDelayMs));
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: routeContractResponse(operation, controller.outcome, responseLabel) }),
    });
  });

  return controller;
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
  targets: Array<{
    name: string;
    locator: Locator;
    minRatio: number;
    sample?: "element" | "focus-ring";
  }>
) {
  const targetBoxes: Array<{
    name: string;
    minRatio: number;
    sample: "element" | "focus-ring";
    box: { x: number; y: number; width: number; height: number };
  }> = [];
  for (const t of targets) {
    if (!(await t.locator.isVisible())) {
      throw new Error(`CONTRAST_TARGET_MISSING:${t.name}`);
    }
    const box = await t.locator.boundingBox();
    if (!box || box.width <= 0 || box.height <= 0) {
      throw new Error(`CONTRAST_TARGET_MISSING:${t.name}`);
    }
    targetBoxes.push({
      name: t.name,
      minRatio: t.minRatio,
      sample: t.sample ?? "element",
      box,
    });
  }
  if (targetBoxes.length === 0) throw new Error("CONTRAST_TARGETS_EMPTY");

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
      await t.locator.evaluate((el, sample) => {
        el.setAttribute("data-contrast-had-style", el.hasAttribute("style") ? "true" : "false");
        el.setAttribute("data-contrast-original-style", el.getAttribute("style") ?? "");
        el.setAttribute("data-contrast-target", "true");
        el.setAttribute("data-contrast-sample", sample ?? "element");
        if (sample === "focus-ring" && el instanceof HTMLElement) {
          el.blur();
          el.style.setProperty("opacity", "0", "important");
          el.style.setProperty("outline", "none", "important");
          el.style.setProperty("box-shadow", "none", "important");
        }
      }, t.sample);
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
        [data-contrast-target][data-contrast-target],
        [data-contrast-target][data-contrast-target] * {
          visibility: visible !important;
          color: rgb(0,0,0) !important;
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
  for (const t of targets.filter((target) => target.sample === "focus-ring")) {
    await t.locator.evaluate((el: HTMLElement) => {
      el.style.setProperty("opacity", "1", "important");
      el.style.setProperty("outline", "3px solid rgb(0,0,0)", "important");
      el.style.setProperty("outline-offset", "3px", "important");
      el.style.setProperty("box-shadow", "none", "important");
    });
  }
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
        [data-contrast-target][data-contrast-target],
        [data-contrast-target][data-contrast-target] * {
          visibility: visible !important;
          color: rgb(255,255,255) !important;
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
  for (const t of targets.filter((target) => target.sample === "focus-ring")) {
    await t.locator.evaluate((el: HTMLElement) => {
      el.style.setProperty("opacity", "1", "important");
      el.style.setProperty("outline", "3px solid rgb(255,255,255)", "important");
      el.style.setProperty("outline-offset", "3px", "important");
      el.style.setProperty("box-shadow", "none", "important");
    });
  }
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50))));
  const whiteScreenshot = await page.screenshot({ animations: "disabled" });

  // Clean up injected styles
  await page.evaluate(() => {
    const style = document.getElementById("contrast-eval-style");
    if (style) style.remove();
    document.querySelectorAll("[data-contrast-target]").forEach((el) => {
      const originalStyle = el.getAttribute("data-contrast-original-style") ?? "";
      if (el.getAttribute("data-contrast-had-style") === "true") {
        el.setAttribute("style", originalStyle);
      } else {
        el.removeAttribute("style");
      }
      el.removeAttribute("data-contrast-target");
      el.removeAttribute("data-contrast-sample");
      el.removeAttribute("data-contrast-had-style");
      el.removeAttribute("data-contrast-original-style");
    });
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
    const ringPadding = t.sample === "focus-ring" ? 8 : 0;
    const startX = Math.max(0, Math.floor((t.box.x - ringPadding) * dprX));
    const startY = Math.max(0, Math.floor((t.box.y - ringPadding) * dprY));
    const endX = Math.min(width, Math.ceil((t.box.x + t.box.width + ringPadding) * dprX));
    const endY = Math.min(height, Math.ceil((t.box.y + t.box.height + ringPadding) * dprY));
    const elementStartX = Math.floor(t.box.x * dprX);
    const elementStartY = Math.floor(t.box.y * dprY);
    const elementEndX = Math.ceil((t.box.x + t.box.width) * dprX);
    const elementEndY = Math.ceil((t.box.y + t.box.height) * dprY);
    const focusGapX = Math.ceil(2 * dprX);
    const focusGapY = Math.ceil(2 * dprY);

    const samples: Array<{ alpha: number; ratio: number; renderedDelta: number }> = [];

    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        if (
          t.sample === "focus-ring" &&
          px >= elementStartX - focusGapX &&
          px < elementEndX + focusGapX &&
          py >= elementStartY - focusGapY &&
          py < elementEndY + focusGapY
        ) {
          continue;
        }
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

        // Small anti-aliased glyphs often contain no >=90% opaque pixel. The
        // forced black/white passes still let us recover their foreground at a
        // lower alpha, while the fail-closed assertion rejects a truly empty
        // sampling region.
        if (alphaR >= 0.25 && alphaG >= 0.25 && alphaB >= 0.25) {
          const alpha = (alphaR + alphaG + alphaB) / 3;
          const bgR = bgImg.data[idx];
          const bgG = bgImg.data[idx + 1];
          const bgB = bgImg.data[idx + 2];

          const normR = normalImg.data[idx];
          const normG = normalImg.data[idx + 1];
          const normB = normalImg.data[idx + 2];

          // A forced mask can cover transparent SVG interiors or a control's
          // unpainted ring geometry. Only measure pixels the normal capture
          // actually paints differently from its target-hidden background.
          const renderedDelta = Math.max(
            Math.abs(normR - bgR),
            Math.abs(normG - bgG),
            Math.abs(normB - bgB),
          );
          if (renderedDelta === 0) continue;

          // Compare the pixels the browser actually rendered, including
          // inherited opacity and image-backed surfaces, against the same
          // location with the target hidden. The black/white captures provide
          // the foreground mask; reconstructing a theoretical unblended color
          // would overstate the contrast users actually see.
          const fgLum = calculateLuminance(normR, normG, normB);
          const bgLum = calculateLuminance(bgR, bgG, bgB);

          const ratio = getContrastRatio(fgLum, bgLum);
          samples.push({ alpha, ratio, renderedDelta });
        }
      }
    }

    const alphaThreshold = [0.9, 0.75, 0.5, 0.25].find(
      (threshold) => samples.filter((sample) => sample.alpha >= threshold).length >= 4,
    ) ?? 0.25;
    const strongestRenderedDelta = Math.max(
      0,
      ...samples.map((sample) => sample.renderedDelta),
    );
    const ratios = samples
      .filter((sample) =>
        sample.alpha >= alphaThreshold &&
        (t.sample !== "focus-ring" || sample.renderedDelta >= strongestRenderedDelta * 0.75),
      )
      .map((sample) => sample.ratio);
    assertContrastSamples(t.name, ratios);
    ratios.sort((a, b) => a - b);
    const p5Index = Math.floor(ratios.length * 0.05);
    const coreRatio = ratios[p5Index];
    expect(
      coreRatio,
      `Core pixel contrast for "${t.name}" (5th percentile ratio = ${coreRatio.toFixed(2)})`
    ).toBeGreaterThanOrEqual(t.minRatio);
  }
}

export function assertContrastSamples(name: string, ratios: readonly number[]) {
  if (ratios.length === 0) throw new Error(`CONTRAST_PIXELS_EMPTY:${name}`);
}
