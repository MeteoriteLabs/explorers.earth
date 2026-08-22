import { render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from "react-router-dom";
import { describe, expect, it } from "vitest";

import {
  PublicProfileFallbackRedirect,
  type PublicProfileFallbackLocationState,
} from "../PublicProfileFallbackRedirect";
import { PublicRouteReadinessContext } from "../../layouts/PublicRouteReadinessContext";

const fallbackRoutes = createRoutesFromElements(
  <Route path=":username">
    <Route path="*" element={<PublicProfileFallbackRedirect />} />
  </Route>,
);

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
});
