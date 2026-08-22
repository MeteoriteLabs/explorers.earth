import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  createMemoryRouter,
  createRoutesFromElements,
  Outlet,
  Route,
  RouterProvider,
  useLocation,
  useParams,
} from "react-router-dom";
import { describe, expect, it } from "vitest";

import {
  PublicProfileFallbackRedirect,
  type PublicProfileFallbackLocationState,
} from "../PublicProfileFallbackRedirect";
import {
  PublicRouteReadinessContext,
  usePublicLeafRequestGeneration,
} from "../../layouts/PublicRouteReadinessContext";

const fallbackRoutes = createRoutesFromElements(
  <Route path=":username">
    <Route path="*" element={<PublicProfileFallbackRedirect />} />
  </Route>,
);

function RouterReadinessProvider() {
  const location = useLocation();
  const { username } = useParams<{ username: string }>();
  const generation = `${username ?? ""}:${location.key}`;
  return (
    <PublicRouteReadinessContext.Provider value={{
      generation,
      readiness: { generation, status: "ready" },
      markLoading: () => {}, markReady: () => {}, markRefreshing: () => {},
      markEmpty: () => {}, markNotFound: () => {}, markError: () => {},
    }}>
      <Outlet />
    </PublicRouteReadinessContext.Provider>
  );
}

function CurrentMissingLeaf() {
  const { listSlug } = useParams<{ listSlug: string }>();
  const generation = usePublicLeafRequestGeneration(`account-1:${listSlug}`);
  return <PublicProfileFallbackRedirect expectedGeneration={generation} />;
}

function readinessRoutes(leaf: ReactNode) {
  return createRoutesFromElements(
    <Route path=":username" element={<RouterReadinessProvider />}>
      <Route path="apps/:listSlug" element={leaf} />
      <Route index element={<div>Profile fallback</div>} />
    </Route>,
  );
}

describe("PublicProfileFallbackRedirect", () => {
  it("replace-navigates with a focus-handoff marker while preserving query and hash", async () => {
    const router = createMemoryRouter(fallbackRoutes, {
      initialEntries: ["/alice/unavailable?utm_source=qa#profile"],
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/alice");
    });

    expect(router.state.location.search).toBe("?utm_source=qa");
    expect(router.state.location.hash).toBe("#profile");
    expect(router.state.historyAction).toBe("REPLACE");
    expect(router.state.location.state).toEqual<PublicProfileFallbackLocationState>({
      publicProfileFallback: true,
    });
  });

  it("cannot redirect when the settled leaf belongs to an older route generation", async () => {
    const router = createMemoryRouter(createRoutesFromElements(
      <Route path=":username">
        <Route path="unavailable" element={
          <PublicRouteReadinessContext.Provider value={{
            generation: "new-leaf",
            readiness: { generation: "new-leaf", status: "ready" },
            markLoading: () => {}, markReady: () => {}, markRefreshing: () => {},
            markEmpty: () => {}, markNotFound: () => {}, markError: () => {},
          }}>
            <PublicProfileFallbackRedirect expectedGeneration="old-leaf" />
            <div>Current leaf remains</div>
          </PublicRouteReadinessContext.Provider>
        } />
      </Route>,
    ), { initialEntries: ["/alice/unavailable"] });

    render(<RouterProvider router={router} />);

    expect(await screen.findByText("Current leaf remains")).toBeVisible();
    expect(router.state.location.pathname).toBe("/alice/unavailable");
  });

  it("redirects a settled missing leaf when its captured location-key generation is current", async () => {
    const router = createMemoryRouter(readinessRoutes(<CurrentMissingLeaf />), {
      initialEntries: ["/alice/apps/missing?utm_source=qa#apps"],
    });
    render(<RouterProvider router={router} />);

    await screen.findByText("Profile fallback");
    expect(router.state.location.pathname).toBe("/alice");
    expect(router.state.location.search).toBe("?utm_source=qa");
    expect(router.state.location.hash).toBe("#apps");
    expect(router.state.historyAction).toBe("REPLACE");
  });
});
