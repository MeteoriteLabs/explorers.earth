import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState, type ReactNode } from "react";
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

function DeferredOldLeaf() {
  const { listSlug } = useParams<{ listSlug: string }>();
  const generation = usePublicLeafRequestGeneration(`account-1:${listSlug}`);
  const firstGeneration = useRef(generation);
  const [settleOld, setSettleOld] = useState(false);
  return (
    <>
      <output aria-label="current route generation">{generation}</output>
      <button type="button" onClick={() => setSettleOld(true)}>Settle old lookup</button>
      {settleOld && <PublicProfileFallbackRedirect expectedGeneration={firstGeneration.current} />}
      <div>Current leaf remains</div>
    </>
  );
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

  it("suppresses an old lookup after same-resource navigation creates a new location key", async () => {
    const router = createMemoryRouter(readinessRoutes(<DeferredOldLeaf />), {
      initialEntries: ["/alice/apps/same"],
    });
    render(<RouterProvider router={router} />);
    const firstLocationKey = router.state.location.key;
    const firstGeneration = screen.getByLabelText("current route generation").textContent;

    await act(async () => {
      await router.navigate("/alice/apps/same");
    });
    expect(router.state.location.key).not.toBe(firstLocationKey);
    await waitFor(() => expect(screen.getByLabelText("current route generation")).not.toHaveTextContent(firstGeneration ?? ""));

    fireEvent.click(screen.getByRole("button", { name: "Settle old lookup" }));
    expect(screen.getByText("Current leaf remains")).toBeVisible();
    expect(router.state.location.pathname).toBe("/alice/apps/same");
    expect(screen.queryByText("Profile fallback")).toBeNull();
  });
});
