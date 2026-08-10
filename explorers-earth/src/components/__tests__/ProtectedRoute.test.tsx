import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useQuery } from "@apollo/client";
import useAuthStore from "../../store/store";
import ProtectedRoute from "../ProtectedRoute";

// Mock Apollo's useQuery so we can drive {data, loading, error} directly.
vi.mock("@apollo/client", () => ({
  useQuery: vi.fn(),
  gql: (strings: TemplateStringsArray, ...values: any[]) =>
    String.raw({ raw: strings }, ...values),
}));
vi.mock("../../store/store", () => ({ default: vi.fn() }));
// EarthLoader pulls in heavy animation deps; stub it to a simple marker.
vi.mock("../EarthLoader", () => ({ EarthLoader: () => <div>LOADING</div> }));

const mockStore = (v: unknown) =>
  (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(v);
const mockQuery = (v: unknown) =>
  (useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue(v);

const AUTHED = { isAuthenticated: true, user: { documentId: "d1" } };
const account = (fields: Record<string, unknown>) => ({
  usersPermissionsUser: { accounts: [fields] },
});
const COMPLETE = account({
  Account_Name: "Bhavya",
  Account_Type: "Personal",
  mobile_number: "+919876543210",
});

const renderAt = (path = "/home") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/home" element={<div>PROTECTED HOME</div>} />
        </Route>
        <Route path="/onboarding" element={<div>ONBOARDING PAGE</div>} />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );

describe("ProtectedRoute onboarding gate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects to /login when not authenticated", () => {
    mockStore({ isAuthenticated: false, user: null });
    mockQuery({ data: null, loading: false, error: null });
    renderAt();
    expect(screen.getByText("LOGIN PAGE")).toBeInTheDocument();
  });

  it("shows the loader while the check is loading (never assumes onboarding)", () => {
    mockStore(AUTHED);
    mockQuery({ data: null, loading: true, error: null });
    renderAt();
    expect(screen.getByText("LOADING")).toBeInTheDocument();
    expect(screen.queryByText("ONBOARDING PAGE")).toBeNull();
  });

  it("renders the protected page for a complete account", () => {
    mockStore(AUTHED);
    mockQuery({ data: COMPLETE, loading: false, error: null });
    renderAt();
    expect(screen.getByText("PROTECTED HOME")).toBeInTheDocument();
  });

  it("redirects to /onboarding when mobile_number is empty (incomplete account)", () => {
    mockStore(AUTHED);
    mockQuery({
      data: account({ Account_Name: "Bhavya", Account_Type: "Personal", mobile_number: "" }),
      loading: false,
      error: null,
    });
    renderAt();
    expect(screen.getByText("ONBOARDING PAGE")).toBeInTheDocument();
  });

  it("redirects to /onboarding for a brand-new user (no account yet)", () => {
    mockStore(AUTHED);
    mockQuery({
      data: { usersPermissionsUser: { accounts: [] } },
      loading: false,
      error: null,
    });
    renderAt();
    expect(screen.getByText("ONBOARDING PAGE")).toBeInTheDocument();
  });

  it("does NOT bounce to /onboarding on a transient error with no data (the regression)", () => {
    mockStore(AUTHED);
    mockQuery({ data: null, loading: false, error: new Error("network blip") });
    renderAt();
    expect(screen.queryByText("ONBOARDING PAGE")).toBeNull();
    expect(screen.getByText("LOADING")).toBeInTheDocument();
  });

  it("keeps the user on the protected page when an error arrives alongside complete cached data", () => {
    mockStore(AUTHED);
    mockQuery({ data: COMPLETE, loading: false, error: new Error("partial") });
    renderAt();
    expect(screen.getByText("PROTECTED HOME")).toBeInTheDocument();
  });
});
