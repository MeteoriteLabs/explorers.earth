import { render, screen, waitFor } from "@testing-library/react";
import type { DocumentNode, OperationDefinitionNode } from "graphql";
import type { ReactElement } from "react";
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
