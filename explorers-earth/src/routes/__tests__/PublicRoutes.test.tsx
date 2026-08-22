import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, useContext, useEffect } from "react";
import { createMemoryRouter, createRoutesFromElements, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PublicRouteReadinessContext } from "../../layouts/PublicRouteReadinessContext";

// 1. Hoisted state MUST be defined before vi.mock calls that reference it
const { profileMock, readyLeaf, dummyFeature, queryState, defaultEmptyQueryResult, defaultRefetch } = vi.hoisted(() => {
  const refetch = vi.fn();
  const emptyResult = { data: undefined as any, loading: false, error: undefined as any, refetch };
  const state = {
    username: emptyResult,
    profile: emptyResult,
  };

  const ProfileMockComponent = () => {
    const readinessCtx = useContext(PublicRouteReadinessContext);
    const generation = readinessCtx?.generation || "";
    const markLoading = readinessCtx?.markLoading;
    const markError = readinessCtx?.markError;
    const markNotFound = readinessCtx?.markNotFound;
    const markReady = readinessCtx?.markReady;
    const profileState = state.profile;

    useEffect(() => {
      if (profileState.loading) {
        markLoading?.(generation);
      } else if (profileState.error) {
        markError?.(generation, "profile", profileState.refetch);
      } else if (profileState.data) {
        if (!profileState.data.accounts?.[0]) {
          markNotFound?.(generation);
        } else {
          markReady?.(generation);
        }
      }
    }, [profileState, generation, markLoading, markError, markNotFound, markReady]);

    return <div data-testid="public-profile-stub">Public Profile Content</div>;
  };

  const ReadyLeafMock = () => {
    const readinessCtx = useContext(PublicRouteReadinessContext);
    const generation = readinessCtx?.generation || "";
    const markReady = readinessCtx?.markReady;

    useEffect(() => {
      markReady?.(generation);
    }, [generation, markReady]);

    return <div>Public route content</div>;
  };

  const dummy = { default: ReadyLeafMock, PublicMovies: ReadyLeafMock, PublicMovieList: ReadyLeafMock, PublicMovieGenre: ReadyLeafMock, PublicBooks: ReadyLeafMock, PublicBookList: ReadyLeafMock, PublicBookSubject: ReadyLeafMock, PublicGames: ReadyLeafMock, PublicGamesList: ReadyLeafMock, PublicGamesGenre: ReadyLeafMock, PublicApps: ReadyLeafMock, PublicAppList: ReadyLeafMock, PublicProducts: ReadyLeafMock, PublicProductList: ReadyLeafMock, PublicPeople: ReadyLeafMock, PublicPersonList: ReadyLeafMock, PublicPersonSector: ReadyLeafMock };

  return {
    profileMock: ProfileMockComponent,
    readyLeaf: ReadyLeafMock,
    dummyFeature: dummy,
    defaultRefetch: refetch,
    defaultEmptyQueryResult: emptyResult,
    queryState: state,
  };
});

// 2. Dynamic Proxy mock for framer-motion that supports all HTML tags (h1, h2, p, div, button, etc.)
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, prop) => {
        return ({ children, className, style, onClick, ...props }: any) => {
          const Tag = (typeof prop === "string" && ["h1", "h2", "h3", "h4", "p", "span", "button", "a", "div", "section", "main"].includes(prop) ? prop : "div") as any;
          return (
            <Tag className={className} style={style} onClick={onClick}>
              {children}
            </Tag>
          );
        };
      },
    }
  ),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock("../validators/TabVisibilityGuard", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("./validators/TabVisibilityGuard", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

vi.mock("../features/PublicHome/components/PublicProfile", () => ({ default: profileMock }));
vi.mock("../../features/PublicHome/components/PublicProfile", () => ({ default: profileMock }));

vi.mock("../pages/public/PublicHomePage", () => ({ default: readyLeaf }));
vi.mock("../../pages/public/PublicHomePage", () => ({ default: readyLeaf }));
vi.mock("../pages/public/PublicMusic", () => ({ default: readyLeaf }));
vi.mock("../../pages/public/PublicMusic", () => ({ default: readyLeaf }));
vi.mock("../features/PublicHome/components/PublicGuides", () => ({ default: readyLeaf }));
vi.mock("../../features/PublicHome/components/PublicGuides", () => ({ default: readyLeaf }));
vi.mock("../features/PublicHome/components/MapView", () => ({ default: readyLeaf }));
vi.mock("../../features/PublicHome/components/MapView", () => ({ default: readyLeaf }));
vi.mock("../features/PublicHome/components/PlaceMapView", () => ({ default: readyLeaf }));
vi.mock("../../features/PublicHome/components/PlaceMapView", () => ({ default: readyLeaf }));
vi.mock("../features/PublicHome/components/Community", () => ({ default: readyLeaf }));
vi.mock("../../features/PublicHome/components/Community", () => ({ default: readyLeaf }));
vi.mock("../features/PublicHome/components/PublicGuideDetailPage", () => ({ default: readyLeaf }));
vi.mock("../../features/PublicHome/components/PublicGuideDetailPage", () => ({ default: readyLeaf }));

vi.mock("../features/Movies", () => dummyFeature);
vi.mock("../../features/Movies", () => dummyFeature);
vi.mock("../features/Books", () => dummyFeature);
vi.mock("../../features/Books", () => dummyFeature);
vi.mock("../features/Games", () => dummyFeature);
vi.mock("../../features/Games", () => dummyFeature);
vi.mock("../features/AppsAndTools", () => dummyFeature);
vi.mock("../../features/AppsAndTools", () => dummyFeature);
vi.mock("../features/Products", () => dummyFeature);
vi.mock("../../features/Products", () => dummyFeature);
vi.mock("../features/People", () => dummyFeature);
vi.mock("../../features/People", () => dummyFeature);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string | Record<string, any>) =>
      typeof defaultValue === "string" ? defaultValue : key,
  }),
}));

vi.mock("../../components/EarthLoader", () => ({
  EarthLoader: () => <div role="status" aria-label="Loading public profile" />,
}));

// Complete mock for @apollo/client
vi.mock("@apollo/client", () => ({
  gql: (strings: any) => {
    const str = Array.isArray(strings) ? strings.join("") : String(strings);
    const match = str.match(/query\s+([A-Za-z0-9_]+)/i);
    const name = match ? match[1] : "MockQuery";
    return {
      definitions: [{ kind: "OperationDefinition", name: { value: name } }],
    };
  },
  useQuery: (document: any, options: any = {}) => {
    const operation = document?.definitions?.find(
      (def: any) => def.kind === "OperationDefinition"
    )?.name?.value;

    if (options?.skip) {
      return defaultEmptyQueryResult;
    }

    if (operation === "CheckUsername") {
      return queryState.username;
    }

    if (operation === "PublicProfileData" || operation === "GetPublicAccountBasic") {
      return queryState.profile;
    }

    return defaultEmptyQueryResult;
  },
}));

// 3. Imports under test
import PublicRoutes from "../PublicRoutes";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const validUsernameData = { accounts: [{ documentId: "acc-1", Account_Name: "Alice" }] };
const validProfileData = {
  accounts: [
    {
      documentId: "acc-1",
      Account_Name: "Alice",
      Bio: "Bio",
      Primary_Address: { address: "Earth" },
      Feed_Data: [],
      social_media: {},
    },
  ],
};

const stateLoadingUsername = { data: undefined, loading: true, error: undefined, refetch: defaultRefetch };
const stateSuccessUsername = { data: validUsernameData, loading: false, error: undefined, refetch: defaultRefetch };
const stateLoadingProfile = { data: undefined, loading: true, error: undefined, refetch: defaultRefetch };
const stateSuccessProfile = { data: validProfileData, loading: false, error: undefined, refetch: defaultRefetch };

function PublicRouteRunner({ initialEntries = ["/alice"] }: { initialEntries?: string[] }) {
  const [queryClient] = useState(() => createTestQueryClient());
  const [router] = useState(() =>
    createMemoryRouter(createRoutesFromElements(PublicRoutes), { initialEntries })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

describe("PublicRoutes orchestration and readiness", () => {
  beforeEach(() => {
    queryState.username = stateLoadingUsername;
    queryState.profile = stateLoadingProfile;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows Earth during username bootstrap without also showing the route skeleton", async () => {
    queryState.username = stateLoadingUsername;
    queryState.profile = stateLoadingProfile;

    render(<PublicRouteRunner initialEntries={["/alice"]} />);

    expect(screen.getByRole("status", { name: "Loading public profile" })).toBeInTheDocument();
    expect(screen.queryByTestId("public-profile-shell")).toBeNull();
  });

  it("replaces Earth with one route skeleton after username bootstrap succeeds", async () => {
    queryState.username = stateSuccessUsername;
    queryState.profile = stateLoadingProfile;

    render(<PublicRouteRunner initialEntries={["/alice"]} />);

    await waitFor(() => {
      expect(screen.queryByRole("status", { name: "Loading public profile" })).toBeNull();
      expect(screen.getAllByTestId("public-profile-shell")).toHaveLength(1);
    });
  });

  it("removes public-route shell once profile query completes successfully", async () => {
    queryState.username = stateSuccessUsername;
    queryState.profile = stateSuccessProfile;

    render(<PublicRouteRunner initialEntries={["/alice"]} />);

    await waitFor(() => {
      expect(screen.queryByTestId("public-profile-shell")).toBeNull();
    });
  });

  it("renders 404 Not Found when username check returns no account", async () => {
    queryState.username = { data: { accounts: [] }, loading: false, error: undefined, refetch: defaultRefetch };
    queryState.profile = defaultEmptyQueryResult;

    render(<PublicRouteRunner initialEntries={["/nonexistent"]} />);

    await waitFor(() => {
      expect(screen.getByText("Page Not Found")).toBeInTheDocument();
    });
  });

  it("renders localized error feedback on username query failure and handles retry success", async () => {
    const mockRefetch = vi.fn();
    queryState.username = { data: undefined, loading: false, error: new Error("Network Error"), refetch: mockRefetch };
    queryState.profile = stateLoadingProfile;

    render(<PublicRouteRunner initialEntries={["/alice"]} />);

    await waitFor(() => {
      expect(screen.getByText("Couldn’t verify this profile")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: "Retry" });
    await act(async () => {
      fireEvent.click(retryBtn);
    });

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("renders localized error feedback on profile query failure and handles single-flight retry", async () => {
    let resolveRefetch: (() => void) | undefined;
    const mockRefetch = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveRefetch = resolve;
      }),
    );
    queryState.username = stateSuccessUsername;
    queryState.profile = { data: undefined, loading: false, error: new Error("GraphQL Error"), refetch: mockRefetch };

    render(<PublicRouteRunner initialEntries={["/alice"]} />);

    await waitFor(() => {
      expect(screen.getByText("Couldn’t load this profile")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryBtn);
    fireEvent.click(retryBtn); // double click should be ignored

    expect(mockRefetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRefetch?.();
    });
  });

  it("renders direct public-route leaves seamlessly", async () => {
    queryState.username = stateSuccessUsername;
    queryState.profile = defaultEmptyQueryResult;

    render(<PublicRouteRunner initialEntries={["/alice/places/map"]} />);

    await waitFor(() => {
      expect(screen.queryByTestId("public-profile-shell")).toBeNull();
    });
  });

  it("renders Not Found for an unsupported public child route", async () => {
    queryState.username = stateSuccessUsername;

    render(<PublicRouteRunner initialEntries={["/alice/spaces"]} />);

    await waitFor(() => {
      expect(screen.getByText("Page Not Found")).toBeInTheDocument();
    });
  });

  it("resets to Earth bootstrap when switching to an unresolved username", async () => {
    queryState.username = stateSuccessUsername;
    queryState.profile = stateLoadingProfile;

    const { unmount } = render(<PublicRouteRunner initialEntries={["/alice"]} />);

    // Shell present while profile is loading
    expect(screen.getAllByTestId("public-profile-shell")).toHaveLength(1);

    unmount();

    // Switch route to /bob before alice profile completes
    queryState.username = stateLoadingUsername;
    queryState.profile = stateLoadingProfile;
    render(<PublicRouteRunner initialEntries={["/bob"]} />);

    expect(screen.getByRole("status", { name: "Loading public profile" })).toBeInTheDocument();
  });
});
