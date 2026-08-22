import { render } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const analyticsHarness = vi.hoisted(() => ({
  useTrackAnalytics: vi.fn(() => ({ trackClick: vi.fn(), trackEvent: vi.fn() })),
}));

vi.mock("../../services/analyticsService", () => ({
  useTrackAnalytics: analyticsHarness.useTrackAnalytics,
  createAnalyticsOptions: new Proxy({}, { get: () => vi.fn(() => ({})) }),
}));
vi.mock("@apollo/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@apollo/client")>()),
  useQuery: () => ({ data: undefined, loading: true, error: undefined, refetch: vi.fn() }),
}));
vi.mock("../../layouts/usePublicRouteLifecycle", () => ({ usePublicRouteLifecycle: vi.fn() }));
vi.mock("@vis.gl/react-google-maps", () => ({
  AdvancedMarker: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Map: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Pin: () => null,
  useMap: () => null,
}));
vi.mock("../../components/SEO", () => ({ default: () => null }));
vi.mock("../../components/EarthLoader", () => ({ EarthLoader: () => <div>Loading map</div> }));

import Community from "../../features/PublicHome/components/Community";
import MapView from "../../features/PublicHome/components/MapView";
import PlaceMapView from "../../features/PublicHome/components/PlaceMapView";
import usePageTracking from "../../hooks/usePageTracking";

function TrackedRoute({ Component }: { Component: ComponentType }) {
  usePageTracking();
  return <Component />;
}

const gaOnlyRoutes = [
  { id: "places-map", pathname: "/alice/places/map", pattern: "/:username/places/map", Component: MapView },
  { id: "places-detail-map", pathname: "/alice/places/paris/map", pattern: "/:username/places/:placeSlug/map", Component: MapView },
  { id: "places-map-detail", pathname: "/alice/places/paris/placesmap", pattern: "/:username/places/:place/placesmap", Component: PlaceMapView },
  { id: "community", pathname: "/alice/community", pattern: "/:username/community", Component: Community },
] as const;

describe("GA-only public route analytics behavior", () => {
  beforeEach(() => {
    analyticsHarness.useTrackAnalytics.mockClear();
    window.gtag = vi.fn();
  });

  it.each(gaOnlyRoutes)("tracks $id through GA without mounting custom analytics", ({ pathname, pattern, Component }) => {
    render(
      <MemoryRouter initialEntries={[pathname]}>
        <Routes>
          <Route path={pattern} element={<TrackedRoute Component={Component} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith("config", "G-C3QBWP3ZSK", { page_path: pathname });
    expect(analyticsHarness.useTrackAnalytics).not.toHaveBeenCalled();
  });
});
