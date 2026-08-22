import { render, screen, waitFor } from "@testing-library/react";
import type { DocumentNode, OperationDefinitionNode } from "graphql";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PublicRouteReadinessContext } from "../../layouts/PublicRouteReadinessContext";

const { queryStates, queryCalls, lifecycle } = vi.hoisted(() => ({
  queryStates: new Map<string, {
    data?: Record<string, any>;
    loading: boolean;
    error?: Error;
  }>(),
  queryCalls: [] as string[],
  lifecycle: {
    markLoading: vi.fn(),
    markReady: vi.fn(),
    markRefreshing: vi.fn(),
    markEmpty: vi.fn(),
    markNotFound: vi.fn(),
    markError: vi.fn(),
  },
}));

function operationName(query: DocumentNode): string {
  const operation = query.definitions.find(
    (definition): definition is OperationDefinitionNode => definition.kind === "OperationDefinition",
  );
  return operation?.name?.value ?? "anonymous";
}

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useQuery: (query: DocumentNode) => {
      const operation = operationName(query);
      queryCalls.push(operation);
      return {
        data: queryStates.get(operation)?.data,
        loading: queryStates.get(operation)?.loading ?? false,
        error: queryStates.get(operation)?.error,
        refetch: vi.fn().mockResolvedValue(undefined),
      };
    },
  };
});

vi.mock("../../layouts/PublicProfileBootstrapContext", () => ({
  usePublicProfileBootstrapAccount: () => ({
    documentId: "account-1",
    Account_Name: "Alice",
    bg_picture: null,
    profile_picture: null,
  }),
}));

vi.mock("../../services/analyticsService", () => ({
  useTrackAnalytics: () => ({ trackClick: vi.fn(), trackEvent: vi.fn() }),
  createAnalyticsOptions: new Proxy({}, { get: () => vi.fn(() => ({})) }),
}));
vi.mock("../../components/SEO", () => ({ default: () => null }));
vi.mock("../../hooks/useQRActions", () => ({
  useQRActions: () => ({ handleCopyLink: vi.fn() }),
}));
vi.mock("@vis.gl/react-google-maps", () => ({
  AdvancedMarker: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Map: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Pin: () => null,
  useMap: () => null,
}));

import PublicAppList from "../../features/AppsAndTools/components/public/PublicAppList";
import PublicApps from "../../features/AppsAndTools/components/public/PublicApps";
import PublicBookList from "../../features/Books/components/public/PublicBookList";
import PublicBooks from "../../features/Books/components/public/PublicBooks";
import PublicGames from "../../features/Games/components/public/PublicGames";
import PublicGamesGenre from "../../features/Games/components/public/PublicGamesGenre";
import PublicGamesList from "../../features/Games/components/public/PublicGamesList";
import PublicMovies from "../../features/Movies/components/public/PublicMovies";
import PublicMovieGenre from "../../features/Movies/components/public/PublicMovieGenre";
import PublicMovieList from "../../features/Movies/components/public/PublicMovieList";
import PublicPeople from "../../features/People/components/public/PublicPeople";
import PublicPersonSector from "../../features/People/components/public/PublicPersonSector";
import PublicPersonList from "../../features/People/components/public/PublicPersonList";
import PublicProductList from "../../features/Products/components/public/PublicProductList";
import PublicProducts from "../../features/Products/components/public/PublicProducts";
import PublicBookSubject from "../../features/Books/components/public/PublicBookSubject";
import PublicGuideDetailPage from "../../features/PublicHome/components/PublicGuideDetailPage";
import PublicGuides from "../../features/PublicHome/components/PublicGuides";
import PublicHome from "../../features/PublicHome/components/PublicHome";

const guideSummary = {
  documentId: "guide-1",
  Title: "Fixture Guide",
  Description: "A cached guide",
  Guide_Type: "Itinerary",
  Visibility: true,
  slug: "fixture-guide",
  Guide_Media: [],
  Place_Details: null,
  Guide_Tags: [],
  is_pinned: false,
};

const guideDetail = {
  ...guideSummary,
  Number_Of_Days: 1,
  Tips_Notes: "",
  Guide_Section_Details: null,
  guide_sections: [],
};

function renderLeaf(element: ReactElement, path: string, routePath: string) {
  return render(
    <PublicRouteReadinessContext.Provider
      value={{
        generation: "alice:leaf",
        readiness: { generation: "alice:leaf", status: "initial-loading" },
        ...lifecycle,
      }}
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="/:username" element={<div>Profile fallback destination</div>} />
        </Routes>
      </MemoryRouter>
    </PublicRouteReadinessContext.Provider>,
  );
}

function renderTaxonomy(element: ReactElement, path: string, routePath: string) {
  return render(
    <PublicRouteReadinessContext.Provider
      value={{
        generation: "alice:leaf",
        readiness: { generation: "alice:leaf", status: "initial-loading" },
        ...lifecycle,
      }}
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="/:username" element={<div>Profile fallback destination</div>} />
        </Routes>
      </MemoryRouter>
    </PublicRouteReadinessContext.Provider>,
  );
}

const taxonomyCases = [
  {
    label: "movie genre",
    element: <PublicMovieGenre />,
    path: "/alice/movies/genre/comedy",
    routePath: "/:username/movies/genre/:genreSlug",
    contentOperation: "PublicMovieData",
    contentData: { movieLists: [] },
    taxonomyOperation: "MovieCategories",
    taxonomyData: { movieCategories: [{ documentId: "genre-1", genre_name: "Comedy" }] },
    missingTaxonomyData: { movieCategories: [] },
    heading: "Comedy",
    emptyText: "No movies found in this genre.",
  },
  {
    label: "game genre",
    element: <PublicGamesGenre />,
    path: "/alice/games/genre/comedy",
    routePath: "/:username/games/genre/:genreSlug",
    contentOperation: "PublicGameData",
    contentData: { gameLists: [] },
    taxonomyOperation: "GameCategories",
    taxonomyData: { gameCategories: [{ documentId: "genre-1", genre_name: "Comedy" }] },
    missingTaxonomyData: { gameCategories: [] },
    heading: "Comedy",
    emptyText: "No games found in this genre.",
  },
  {
    label: "book subject",
    element: <PublicBookSubject />,
    path: "/alice/books/subject/science",
    routePath: "/:username/books/subject/:subjectSlug",
    contentOperation: "BooksBySubject",
    contentData: { recommendedBooks: [] },
    taxonomyOperation: "BookCategories",
    taxonomyData: { bookCategories: [{ documentId: "subject-1", subject_name: "Science" }] },
    missingTaxonomyData: { bookCategories: [] },
    heading: "Science",
    emptyText: "No books found for this subject.",
  },
  {
    label: "people sector",
    element: <PublicPersonSector />,
    path: "/alice/people/sector/creators",
    routePath: "/:username/people/sector/:sectorSlug",
    contentOperation: "PublicPeopleData",
    contentData: { personLists: [] },
    taxonomyOperation: "PersonCategories",
    taxonomyData: { peopleCategories: [{ documentId: "sector-1", Category_name: "Creators" }] },
    missingTaxonomyData: { peopleCategories: [] },
    heading: "Creators",
    emptyText: "No people recommended in this sector.",
  },
] as const;

type LeafLifecycleFixture = {
  label: string;
  element: ReactElement;
  path: string;
  routePath: string;
  operation: string;
  data: Record<string, any>;
  staleText: string;
  supportingStates?: Record<string, Record<string, any>>;
};

const leafLifecycleCases: LeafLifecycleFixture[] = [
  {
    label: "Places index",
    element: <PublicHome />,
    path: "/alice/places",
    routePath: "/:username/places",
    operation: "PublicPlacesLists",
    data: { recommendationLists: [] },
    staleText: "No Places Yet",
  },
  {
    label: "Places detail",
    element: <PublicHome />,
    path: "/alice/places/paris",
    routePath: "/:username/places/:placeSlug",
    operation: "PublicPlacesLists",
    data: {
      recommendationLists: [{
        documentId: "place-list-1",
        List_Name: "Paris",
        Visibility: true,
        is_pinned: false,
        recommended_places: [],
        person_lists: [],
        product_lists: [],
      }],
    },
    staleText: "Paris",
  },
  {
    label: "Guides index",
    element: <PublicGuides />,
    path: "/alice/guides",
    routePath: "/:username/guides",
    operation: "GetPublicGuides",
    data: { guides: [guideSummary] },
    staleText: "Fixture Guide",
  },
  {
    label: "Guide detail",
    element: <PublicGuideDetailPage />,
    path: "/alice/guides/fixture-guide",
    routePath: "/:username/guides/:guideSlug",
    operation: "GetPublicGuideById",
    data: { guide: guideDetail },
    staleText: "Fixture Guide",
    supportingStates: { GetPublicGuides: { guides: [guideSummary] } },
  },
  {
    label: "Apps index",
    element: <PublicApps />,
    path: "/alice/apps",
    routePath: "/:username/apps",
    operation: "PublicAppData",
    data: { appLists: [] },
    staleText: "No apps shared yet",
  },
  {
    label: "App list",
    element: <PublicAppList />,
    path: "/alice/apps/cached-list",
    routePath: "/:username/apps/:listSlug",
    operation: "AppListBySlug",
    data: { appLists: [{ documentId: "apps-1", List_Name: "Cached Apps", slug: "cached-list", recommended_apps: [] }] },
    staleText: "Cached Apps",
  },
  {
    label: "Books index",
    element: <PublicBooks />,
    path: "/alice/books",
    routePath: "/:username/books",
    operation: "PublicBookData",
    data: { bookLists: [] },
    staleText: "No books yet",
  },
  {
    label: "Book list",
    element: <PublicBookList />,
    path: "/alice/books/cached-list",
    routePath: "/:username/books/:listSlug",
    operation: "BookListBySlug",
    data: { bookLists: [{ documentId: "books-1", List_Name: "Cached Books", slug: "cached-list", recommended_books: [] }] },
    staleText: "Cached Books",
  },
  {
    label: "Book subject",
    element: <PublicBookSubject />,
    path: "/alice/books/subject/science",
    routePath: "/:username/books/subject/:subjectSlug",
    operation: "BooksBySubject",
    data: { recommendedBooks: [] },
    staleText: "No books found for this subject.",
    supportingStates: { BookCategories: { bookCategories: [{ documentId: "subject-1", subject_name: "Science" }] } },
  },
  {
    label: "Games index",
    element: <PublicGames />,
    path: "/alice/games",
    routePath: "/:username/games",
    operation: "PublicGameData",
    data: { gameLists: [] },
    staleText: "No games shared yet",
  },
  {
    label: "Game list",
    element: <PublicGamesList />,
    path: "/alice/games/cached-list",
    routePath: "/:username/games/:listSlug",
    operation: "GameListBySlug",
    data: { gameLists: [{ documentId: "games-1", List_Name: "Cached Games", slug: "cached-list", recommended_games: [] }] },
    staleText: "Cached Games",
  },
  {
    label: "Game genre",
    element: <PublicGamesGenre />,
    path: "/alice/games/genre/comedy",
    routePath: "/:username/games/genre/:genreSlug",
    operation: "PublicGameData",
    data: { gameLists: [] },
    staleText: "No games found in this genre.",
    supportingStates: { GameCategories: { gameCategories: [{ documentId: "genre-1", genre_name: "Comedy" }] } },
  },
  {
    label: "Movies index",
    element: <PublicMovies />,
    path: "/alice/movies",
    routePath: "/:username/movies",
    operation: "PublicMovieData",
    data: { movieLists: [] },
    staleText: "No movies shared yet",
  },
  {
    label: "Movie list",
    element: <PublicMovieList />,
    path: "/alice/movies/cached-list",
    routePath: "/:username/movies/:listSlug",
    operation: "MovieListBySlug",
    data: { movieLists: [{ documentId: "movies-1", List_Name: "Cached Movies", slug: "cached-list", recommended_movies: [] }] },
    staleText: "Cached Movies",
  },
  {
    label: "Movie genre",
    element: <PublicMovieGenre />,
    path: "/alice/movies/genre/comedy",
    routePath: "/:username/movies/genre/:genreSlug",
    operation: "PublicMovieData",
    data: { movieLists: [] },
    staleText: "No movies found in this genre.",
    supportingStates: { MovieCategories: { movieCategories: [{ documentId: "genre-1", genre_name: "Comedy" }] } },
  },
  {
    label: "People index",
    element: <PublicPeople />,
    path: "/alice/people",
    routePath: "/:username/people",
    operation: "PublicPeopleData",
    data: { personLists: [] },
    staleText: "No people shared yet",
  },
  {
    label: "People list",
    element: <PublicPersonList />,
    path: "/alice/people/cached-list",
    routePath: "/:username/people/:listSlug",
    operation: "PersonListBySlug",
    data: { personLists: [{ documentId: "people-1", List_Name: "Cached People", slug: "cached-list", recommended_people: [] }] },
    staleText: "Cached People",
  },
  {
    label: "People sector",
    element: <PublicPersonSector />,
    path: "/alice/people/sector/creators",
    routePath: "/:username/people/sector/:sectorSlug",
    operation: "PublicPeopleData",
    data: { personLists: [] },
    staleText: "No people recommended in this sector.",
    supportingStates: { PersonCategories: { peopleCategories: [{ documentId: "sector-1", Category_name: "Creators" }] } },
  },
  {
    label: "Products index",
    element: <PublicProducts />,
    path: "/alice/products",
    routePath: "/:username/products",
    operation: "PublicProductData",
    data: { productLists: [] },
    staleText: "No products shared yet",
  },
  {
    label: "Product list",
    element: <PublicProductList />,
    path: "/alice/products/cached-list",
    routePath: "/:username/products/:listSlug",
    operation: "ProductListBySlug",
    data: { productLists: [{ documentId: "products-1", List_Name: "Cached Products", slug: "cached-list", recommended_products: [] }] },
    staleText: "Cached Products",
  },
];

function setLeafLifecycleState(
  fixture: LeafLifecycleFixture,
  state: "initial-error" | "refresh" | "refresh-error",
) {
  Object.entries(fixture.supportingStates ?? {}).forEach(([operation, data]) => {
    queryStates.set(operation, { data, loading: false });
  });

  if (state === "initial-error") {
    queryStates.set(fixture.operation, { loading: false, error: new Error(`${fixture.label} initial failure`) });
    return;
  }

  queryStates.set(fixture.operation, {
    data: fixture.data,
    loading: state === "refresh",
    error: state === "refresh-error" ? new Error(`${fixture.label} refresh failure`) : undefined,
  });
}

function expectCachedLeafSurface(fixture: LeafLifecycleFixture, container: HTMLElement) {
  expect(screen.getAllByText(fixture.staleText).length).toBeGreaterThan(0);
  expect(screen.queryByText("Profile fallback destination")).toBeNull();
  expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByText(/^(?:loading(?:…|\.\.\.)?|failed to load.*|something went wrong.*|error loading.*)$/i)).toBeNull();
  expect(container.querySelector(".animate-spin, [role='progressbar'], [data-testid*='skeleton']")).toBeNull();
}

describe("production public leaf lifecycle rendering", () => {
  beforeEach(() => {
    queryStates.clear();
    queryCalls.length = 0;
    vi.clearAllMocks();
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
  });

  it.each(leafLifecycleCases)("delegates an initial $label error to the shared route Retry surface", async (fixture) => {
    setLeafLifecycleState(fixture, "initial-error");

    const { container } = renderLeaf(fixture.element, fixture.path, fixture.routePath);

    await waitFor(() => expect(lifecycle.markError).toHaveBeenCalledWith(
      "alice:leaf",
      "route",
      expect.any(Function),
      false,
    ));
    expect(container).toBeEmptyDOMElement();
  });

  it.each(leafLifecycleCases)("retains cached $label content during refresh", async (fixture) => {
    setLeafLifecycleState(fixture, "refresh");

    const { container } = renderLeaf(fixture.element, fixture.path, fixture.routePath);

    await waitFor(() => expect(lifecycle.markRefreshing).toHaveBeenCalledWith("alice:leaf"));
    expectCachedLeafSurface(fixture, container);
  });

  it.each(leafLifecycleCases)("retains cached $label content during refresh failure", async (fixture) => {
    setLeafLifecycleState(fixture, "refresh-error");

    const { container } = renderLeaf(fixture.element, fixture.path, fixture.routePath);

    await waitFor(() => expect(lifecycle.markError).toHaveBeenCalledWith(
      "alice:leaf",
      "route",
      expect.any(Function),
      true,
    ));
    expectCachedLeafSurface(fixture, container);
  });

  it.each(taxonomyCases)("keeps a valid published $label with zero items on its empty page", async (fixture) => {
    queryStates.set(fixture.contentOperation, { data: fixture.contentData, loading: false });
    queryStates.set(fixture.taxonomyOperation, { data: fixture.taxonomyData, loading: false });

    renderTaxonomy(fixture.element, fixture.path, fixture.routePath);

    expect(await screen.findByRole("heading", { name: fixture.heading })).toBeInTheDocument();
    expect(screen.getByText(fixture.emptyText)).toBeInTheDocument();
    expect(screen.queryByText("Profile fallback destination")).toBeNull();
    expect(queryCalls).toContain(fixture.taxonomyOperation);
  });

  it.each(taxonomyCases)("redirects only when the published $label entity is missing", async (fixture) => {
    queryStates.set(fixture.contentOperation, { data: fixture.contentData, loading: false });
    queryStates.set(fixture.taxonomyOperation, { data: fixture.missingTaxonomyData, loading: false });

    renderTaxonomy(fixture.element, fixture.path, fixture.routePath);

    expect(await screen.findByText("Profile fallback destination")).toBeInTheDocument();
  });

  it.each(taxonomyCases)("delegates an initial $label query error without treating it as missing", async (fixture) => {
    queryStates.set(fixture.contentOperation, { loading: false, error: new Error("taxonomy content failed") });
    queryStates.set(fixture.taxonomyOperation, { data: fixture.taxonomyData, loading: false });

    const { container } = renderTaxonomy(fixture.element, fixture.path, fixture.routePath);

    await waitFor(() => expect(lifecycle.markError).toHaveBeenCalledWith(
      "alice:leaf",
      "route",
      expect.any(Function),
      false,
    ));
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Profile fallback destination")).toBeNull();
  });

  it("classifies an initial Guides query as loading and delegates all loading UI to the route shell", async () => {
    queryStates.set("GetPublicGuides", { loading: true });

    const { container } = renderLeaf(<PublicGuides />, "/alice/guides", "/:username/guides");

    await waitFor(() => expect(lifecycle.markLoading).toHaveBeenCalledWith("alice:leaf"));
    expect(lifecycle.markRefreshing).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["Apps", "PublicAppData", <PublicApps />, "/alice/apps", "/:username/apps"],
    ["Books", "PublicBookData", <PublicBooks />, "/alice/books", "/:username/books"],
    ["Games", "PublicGameData", <PublicGames />, "/alice/games", "/:username/games"],
    ["Movies", "PublicMovieData", <PublicMovies />, "/alice/movies", "/:username/movies"],
    ["People", "PublicPeopleData", <PublicPeople />, "/alice/people", "/:username/people"],
    ["Products", "PublicProductData", <PublicProducts />, "/alice/products", "/:username/products"],
    ["Book list", "BookListBySlug", <PublicBookList />, "/alice/books/list", "/:username/books/:listSlug"],
    ["Game list", "GameListBySlug", <PublicGamesList />, "/alice/games/list", "/:username/games/:listSlug"],
    ["Movie list", "MovieListBySlug", <PublicMovieList />, "/alice/movies/list", "/:username/movies/:listSlug"],
    ["People list", "PersonListBySlug", <PublicPersonList />, "/alice/people/list", "/:username/people/:listSlug"],
    ["Product list", "ProductListBySlug", <PublicProductList />, "/alice/products/list", "/:username/products/:listSlug"],
  ])("delegates %s initial loading UI to the route shell", async (_label, operation, element, path, routePath) => {
    queryStates.set(operation, { loading: true });

    const { container } = renderLeaf(element, path, routePath);

    await waitFor(() => expect(lifecycle.markLoading).toHaveBeenCalledWith("alice:leaf"));
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps cached Guides content mounted without a local skeleton during refresh", async () => {
    queryStates.set("GetPublicGuides", {
      data: { guides: [guideSummary] },
      loading: true,
    });

    renderLeaf(<PublicGuides />, "/alice/guides", "/:username/guides");

    expect(await screen.findByText("Fixture Guide")).toBeInTheDocument();
    expect(lifecycle.markRefreshing).toHaveBeenCalledWith("alice:leaf");
    expect(document.querySelector(".skeleton-shimmer")).toBeNull();
  });

  it("keeps cached Guides content mounted and removes its local error on refresh failure", async () => {
    queryStates.set("GetPublicGuides", {
      data: { guides: [guideSummary] },
      loading: false,
      error: new Error("refresh failed"),
    });

    renderLeaf(<PublicGuides />, "/alice/guides", "/:username/guides");

    expect(await screen.findByText("Fixture Guide")).toBeInTheDocument();
    expect(screen.queryByText("Error Loading Guides")).toBeNull();
    expect(lifecycle.markError).toHaveBeenCalledWith(
      "alice:leaf",
      "route",
      expect.any(Function),
      true,
    );
  });

  it.each([
    ["refresh", { loading: true, error: undefined }],
    ["refresh failure", { loading: false, error: new Error("refresh failed") }],
  ])("keeps cached Guide detail mounted during %s", async (_label, state) => {
    queryStates.set("GetPublicGuides", {
      data: { guides: [guideSummary] },
      loading: state.loading,
      error: state.error,
    });
    queryStates.set("GetPublicGuideById", {
      data: { guide: guideDetail },
      loading: false,
    });

    renderLeaf(
      <PublicGuideDetailPage />,
      "/alice/guides/fixture-guide",
      "/:username/guides/:guideSlug",
    );

    expect(await screen.findByRole("heading", { name: "Fixture Guide" })).toBeInTheDocument();
    expect(screen.queryByText("Failed to load guide")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each([
    ["refresh", { loading: true, error: undefined }],
    ["refresh failure", { loading: false, error: new Error("refresh failed") }],
  ])("keeps a cached App list mounted during %s", async (_label, state) => {
    queryStates.set("AppListBySlug", {
      data: {
        appLists: [{
          documentId: "list-1",
          List_Name: "Useful Apps",
          slug: "useful-apps",
          recommended_apps: [{ documentId: "app-1", title: "Cached App" }],
        }],
      },
      loading: state.loading,
      error: state.error,
    });

    renderLeaf(
      <PublicAppList />,
      "/alice/apps/useful-apps",
      "/:username/apps/:listSlug",
    );

    expect(await screen.findByRole("heading", { name: "Useful Apps" })).toBeInTheDocument();
    expect(screen.getByText("Cached App")).toBeInTheDocument();
    expect(screen.queryByText("Failed to load list.")).toBeNull();
    expect(document.querySelector(".skeleton-shimmer")).toBeNull();
  });
});
