import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryResult } = vi.hoisted(() => ({
  queryResult: {
    data: undefined as Record<string, unknown> | undefined,
    loading: false,
    error: undefined as Error | undefined,
  },
}));

vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useQuery: () => queryResult,
  };
});

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, { get: () => "div" }),
}));

import TabVisibilityGuard from "../TabVisibilityGuard";

const renderGuard = () =>
  render(
    <MemoryRouter initialEntries={["/alice/apps"]}>
      <Routes>
        <Route
          path="/:username/apps"
          element={
            <TabVisibilityGuard tabField="public_apps">
              <div>Apps content</div>
            </TabVisibilityGuard>
          }
        />
        <Route path="/:username" element={<div>Profile fallback</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("TabVisibilityGuard", () => {
  beforeEach(() => {
    queryResult.data = undefined;
    queryResult.loading = false;
    queryResult.error = undefined;
  });

  it("retains visible content during cache-and-network revalidation", () => {
    queryResult.data = {
      accounts: [{ public_apps: "Yes", public_profile: "Yes" }],
    };
    queryResult.loading = true;

    renderGuard();

    expect(screen.getByText("Apps content")).toBeInTheDocument();
  });

  it("redirects a hidden category to the available profile", () => {
    queryResult.data = {
      accounts: [{ public_apps: "No", public_profile: "Yes" }],
    };

    renderGuard();

    expect(screen.getByText("Profile fallback")).toBeInTheDocument();
  });
});
