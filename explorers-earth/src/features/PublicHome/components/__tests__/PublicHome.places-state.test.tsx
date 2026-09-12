import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicLayout from "../../../../layouts/PublicLayout";
import { PublicColdEntryBoundary, usePublicColdEntry } from "../../../../layouts/PublicColdEntryBoundary";
import PublicHome from "../PublicHome";

const state = vi.hoisted(() => ({
  shell: {
    data: undefined as Record<string, unknown> | undefined,
    loading: false,
    error: null as Error | null,
    refetch: vi.fn().mockResolvedValue(undefined),
  },
  places: {
    data: undefined as Record<string, unknown> | undefined,
    loading: false,
    error: null as Error | null,
    refetch: vi.fn().mockResolvedValue(undefined),
  },
  mapsApiLoaded: false,
}));

vi.mock("../../api/usePublicProfileShell", () => ({
  usePublicProfileShell: () => state.shell,
}));

vi.mock("../../api/usePublicRecommendationCategory", () => ({
  usePublicRecommendationCategory: () => state.places,
}));

vi.mock("../../../music/PublicMusicAvailabilityProvider", () => ({
  usePublicMusicAvailability: () => ({ state: "not-public", account: state.shell.data }),
  usePublicAccountIdentity: () => ({ usernameKey: "alice", status: "ready", account: state.shell.data }),
}));

vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: ({ children }: { children?: React.ReactNode }) => children,
  AdvancedMarker: ({ children }: { children?: React.ReactNode }) => children,
  Map: ({ children }: { children?: React.ReactNode }) => <div data-testid="live-map-preview">{children}</div>,
  Pin: () => null,
  useApiIsLoaded: () => state.mapsApiLoaded,
  useMap: () => null,
}));

vi.mock("../../../../services/analyticsService", () => ({
  createAnalyticsOptions: { profile: vi.fn(() => ({})) },
  useTrackAnalytics: () => ({ trackClick: vi.fn(), trackEvent: vi.fn() }),
}));
vi.mock("../../../../hooks/useQRActions", () => ({
  useQRActions: () => ({ handleCopyLink: vi.fn() }),
}));
vi.mock("../../../../components/SEO", () => ({ default: () => null }));
vi.mock("../../../../components/ui/QRModal", () => ({ default: () => null }));
vi.mock("../../../../components/ShareModal", () => ({ default: () => null }));
vi.mock("../../../../components/CircularPlacesModal", () => ({ default: () => null }));
vi.mock("../PlaceDetails/PlaceOverview", () => ({ default: () => null }));
vi.mock("../../../Products/components/public/ProductDetailModal", () => ({ default: () => null }));
vi.mock("../../../People/components/public/PersonDetailModal", () => ({ default: () => null }));
vi.mock("../PublicPlaceCard", () => ({
  default: ({ title }: { title: string }) => <article data-testid="place-card">{title}</article>,
}));

const account = {
  documentId: "account-1",
  username: "alice",
  Account_Name: "Alice",
  Primary_Address: { address: "Earth" },
  public_recommendations: "Yes",
  social_media: { theme_settings: { footerBranding: "enabled" } },
};

const place = (documentId: string, title: string) => ({
  documentId,
  Media: [],
  Place_Details: { Title: title, Place_Name: title, Photos: [], Geometry: { lat: 17.385, lng: 78.4867 } },
});

const list = (documentId: string, name: string, places: ReturnType<typeof place>[], is_pinned = false, pin_order: number | null = null) => ({
  documentId,
  List_Name: name,
  slug: name.toLowerCase(),
  Visibility: true,
  is_pinned,
  pin_order,
  recommended_places: places,
});

function ValidatedPublicLayout() {
  const cold = usePublicColdEntry();
  useEffect(() => cold.reportValidation("valid"), [cold.reportValidation]);
  return <PublicLayout />;
}

function renderPlaces() {
  return render(
    <MemoryRouter initialEntries={["/alice/places"]}>
      <Routes>
        <Route path="/:username" element={<PublicColdEntryBoundary><ValidatedPublicLayout /></PublicColdEntryBoundary>}>
          <Route path="places" element={<PublicHome />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("PublicHome Places category states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    class TestIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
    state.shell = { data: account, loading: false, error: null, refetch: vi.fn().mockResolvedValue(undefined) };
    state.places = { data: undefined, loading: false, error: null, refetch: vi.fn().mockResolvedValue(undefined) };
    state.mapsApiLoaded = false;
  });

  it("shows a Places skeleton rather than the final empty copy while a resolved shell waits for Places", async () => {
    state.places = { ...state.places, loading: true };

    renderPlaces();

    await waitFor(() => expect(screen.getByLabelText("Loading places")).toBeVisible());
    expect(screen.queryByText("No Places Yet")).not.toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Public navigation" })).toBeVisible();
    expect(screen.getByRole("contentinfo")).toBeVisible();
  });

  it("renders two published lists containing four Places after a successful category response", async () => {
    state.places = {
      ...state.places,
      data: {
        recommendationLists: [
          list("tokyo", "Tokyo", [place("tokyo-1", "Senso-ji"), place("tokyo-2", "Shibuya Crossing")]),
          list("hyderabad", "Hyderabad", [place("hyderabad-1", "Charminar"), place("hyderabad-2", "Golconda Fort")]),
        ],
      },
    };

    renderPlaces();

    expect(await screen.findByRole("heading", { name: "Tokyo" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Hyderabad" })).toBeVisible();
    expect(screen.getAllByTestId("place-card")).toHaveLength(4);
  });

  it("renders the live map preview when the Maps provider is ready", async () => {
    state.mapsApiLoaded = true;
    state.places = {
      ...state.places,
      data: { recommendationLists: [list("tokyo", "Tokyo", [place("tokyo-1", "Tokyo Tower")])] },
    };

    renderPlaces();

    expect((await screen.findAllByTestId("live-map-preview")).length).toBeGreaterThan(0);
  });

  it("puts pinned published location lists after the map in the hero carousel by pin order", async () => {
    state.places = {
      ...state.places,
      data: {
        recommendationLists: [
          list("tokyo", "Tokyo", [place("tokyo-1", "Tokyo Tower")], true, 2),
          list("hyderabad", "Hyderabad", [place("hyderabad-1", "Charminar")], true, 1),
        ],
      },
    };

    renderPlaces();

    const hyderabadSlide = await screen.findByRole("button", { name: "Show Hyderabad" });
    fireEvent.click(hyderabadSlide);
    expect(screen.getAllByRole("heading", { name: "Hyderabad" })).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "Show Tokyo" })).toBeVisible();
  });

  it("shows the final empty state only after a successful normalized empty category response", async () => {
    state.places = { ...state.places, data: { recommendationLists: [] } };

    renderPlaces();

    expect(await screen.findByText("No Places Yet")).toBeVisible();
    expect(screen.queryByLabelText("Loading places")).not.toBeInTheDocument();
  });

  it("keeps a warm empty category cache in the loading state while it revalidates", async () => {
    state.places = { ...state.places, data: { recommendationLists: [] }, loading: true };

    renderPlaces();

    await waitFor(() => expect(screen.getByLabelText("Loading places")).toBeVisible());
    expect(screen.queryByText("No Places Yet")).not.toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Public navigation" })).toBeVisible();
    expect(screen.getByRole("contentinfo")).toBeVisible();
  });

  it("shows an error recovery state and retries a rejected Places category response", async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    state.places = { data: undefined, loading: false, error: new Error("gateway unavailable"), refetch: retry };

    renderPlaces();

    expect(await screen.findByRole("heading", { name: "Places unavailable" })).toBeVisible();
    expect(screen.queryByText("No Places Yet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("banner")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Public navigation" })).toBeVisible();
    expect(screen.getByRole("contentinfo")).toBeVisible();
  });

  it("replaces a warm empty category cache with retryable error recovery after rejection", async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    state.places = { data: { recommendationLists: [] }, loading: false, error: new Error("gateway unavailable"), refetch: retry };

    renderPlaces();

    expect(await screen.findByRole("heading", { name: "Places unavailable" })).toBeVisible();
    expect(screen.queryByText("No Places Yet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("banner")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "Public navigation" })).toBeVisible();
    expect(screen.getByRole("contentinfo")).toBeVisible();
  });
});
