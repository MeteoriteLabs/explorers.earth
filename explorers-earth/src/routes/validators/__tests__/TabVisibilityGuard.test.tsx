import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import {
  PublicProfileBootstrapContext,
  type PublicProfileBootstrapAccount,
} from "../../../layouts/PublicProfileBootstrapContext";

import TabVisibilityGuard from "../TabVisibilityGuard";

function LocationCapture() {
  const location = useLocation();
  return <div>{`${location.pathname}${location.search}${location.hash}`}</div>;
}

const renderGuard = (account: PublicProfileBootstrapAccount) =>
  render(
    <PublicProfileBootstrapContext.Provider
      value={{
        bootstrapKey: "alice",
        status: "ready",
        account,
        refreshing: false,
        retrying: false,
        retry: async () => undefined,
      }}
    >
      <MemoryRouter initialEntries={["/alice/apps?utm_source=qa#apps"]}>
        <Routes>
          <Route
            path="/:username/apps"
            element={
              <TabVisibilityGuard tabField="public_apps">
                <div>Apps content</div>
              </TabVisibilityGuard>
            }
          />
          <Route
            path="/:username"
            element={
              <>
                <div>Profile fallback</div>
                <LocationCapture />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </PublicProfileBootstrapContext.Provider>,
  );

describe("TabVisibilityGuard", () => {
  it("retains visible content during cache-and-network revalidation", () => {
    renderGuard({
      documentId: "account-1",
      public_apps: "Yes",
      public_profile: "Yes",
    });

    expect(screen.getByText("Apps content")).toBeInTheDocument();
  });

  it("replace-redirects a hidden category to the canonical profile root", () => {
    renderGuard({
      documentId: "account-1",
      public_apps: "No",
      public_profile: "Yes",
    });

    expect(screen.getByText("Profile fallback")).toBeInTheDocument();
    expect(screen.getByText("/alice?utm_source=qa#apps")).toBeInTheDocument();
  });
});
