import { render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import {
  PublicProfileBootstrapContext,
  type PublicProfileBootstrapValue,
} from "../../../layouts/PublicProfileBootstrapContext";
import { UsernameValidator } from "../UsernameValidator";

function renderValidator(value: PublicProfileBootstrapValue) {
  return render(
    <PublicProfileBootstrapContext.Provider value={value}>
      <MemoryRouter initialEntries={["/alice/apps"]}>
        <Routes>
          <Route path="/:username" element={<Outlet />}>
            <Route element={<UsernameValidator />}>
              <Route path="apps" element={<div>Apps route</div>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </PublicProfileBootstrapContext.Provider>,
  );
}

describe("UsernameValidator", () => {
  it("renders the matched route after shared bootstrap verifies the account", () => {
    renderValidator({
      bootstrapKey: "alice",
      status: "ready",
      account: { documentId: "account-1", Account_Name: "Alice" },
      refreshing: false,
      retrying: false,
      retry: async () => undefined,
    });

    expect(screen.getByText("Apps route")).toBeInTheDocument();
  });

  it.each([
    { bootstrapKey: "alice", status: "loading" } as const,
    { bootstrapKey: "alice", status: "not-found" } as const,
    {
      bootstrapKey: "alice",
      status: "error",
      error: new Error("offline"),
      retrying: false,
      retry: async () => undefined,
    } as const,
  ])("does not render a child while bootstrap is $status", (value) => {
    renderValidator(value);

    expect(screen.queryByText("Apps route")).not.toBeInTheDocument();
  });
});
