import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { username: "route-user", placeSlug: "missing-region", place: "missing-list" },
  queryResult: {
    data: undefined as unknown,
    loading: false,
    error: undefined as unknown,
    refetch: vi.fn(),
  },
}));

vi.mock("@apollo/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@apollo/client")>()),
  useQuery: () => harness.queryResult,
}));

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => harness.navigate,
  useParams: () => harness.params,
}));

vi.mock("@vis.gl/react-google-maps", () => ({
  AdvancedMarker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Map: ({ children }: { children?: React.ReactNode }) => <div data-testid="map">{children}</div>,
  Pin: () => null,
  useMap: () => null,
}));

vi.mock("../../../../layouts/usePublicRouteLifecycle", () => ({
  usePublicRouteLifecycle: vi.fn(),
}));
vi.mock("../../../../components/SEO", () => ({ default: () => null }));
vi.mock("../../../../components/ui/Button", () => ({
  default: ({ btnText }: { btnText?: string }) => <button>{btnText}</button>,
}));
vi.mock("../../../../components/ui/Card", () => ({ default: () => <div /> }));
vi.mock("../../../../assets/icons/WhiteMap", () => ({ default: () => null }));
vi.mock("../../../../assets/icons/UpArrow", () => ({ default: () => null }));
vi.mock("../../../../assets/icons/Down", () => ({ default: () => null }));

import MapView from "../MapView";
import PlaceMapView from "../PlaceMapView";

describe("public place map settled-missing redirects", () => {
  beforeEach(() => {
    harness.navigate.mockReset();
    harness.queryResult.loading = false;
    harness.queryResult.error = undefined;
    harness.queryResult.refetch = vi.fn();
  });

  it("redirects an unknown region map only after a successful settled response", async () => {
    harness.queryResult.data = {
      accounts: [{ Account_Name: "Route User", recommendation_lists: [{ List_Name: "Known Region", recommended_places: [] }] }],
    };

    render(<MapView />);

    await waitFor(() => expect(harness.navigate).toHaveBeenCalledWith("/route-user", { replace: true }));
  });

  it("redirects an unknown list map without indexing an empty coordinate array", async () => {
    harness.queryResult.data = { accounts: [{ recommendation_lists: [] }] };

    expect(() => render(<PlaceMapView />)).not.toThrow();
    await waitFor(() => expect(harness.navigate).toHaveBeenCalledWith("/route-user", { replace: true }));
  });
});
