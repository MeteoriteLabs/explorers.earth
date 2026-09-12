import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../store/store";
import ProtectedRoute from "../ProtectedRoute";

const query = vi.hoisted(() => ({ refetch: vi.fn() }));
vi.mock("@apollo/client", async (original) => ({
  ...await original<typeof import("@apollo/client")>(),
  useQuery: () => ({ data: { usersPermissionsUser: { accounts: [] } }, loading: false, error: undefined, refetch: query.refetch }),
}));
vi.mock("../EarthLoader", () => ({ EarthLoader: () => <div>Loading lifecycle</div> }));
vi.mock("../../hooks/useLogout", () => ({ useLogout: () => useAuthStore.getState().logout }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const pending = () => new Response(JSON.stringify({ version: "music-lifecycle/v1", operation: {
  operationId: "operation-a", status: "pending_deletion", phase: "prepared", state: "completed",
  boundaryCrossed: false, retryable: false, deadLetter: false,
  upstreamUserDocumentId: "user-a", upstreamAccountDocumentId: "account-a",
} }), { status: 200 });
const missing = () => new Response(JSON.stringify({ error: { code: "LIFECYCLE_NOT_FOUND" } }), { status: 404 });
function signIn(identity: string) {
  useAuthStore.getState().login({ id: identity, documentId: identity, username: identity, email: `${identity}@example.test`, blocked: false, token: `fixture-bearer-${identity}` });
}
function mount() {
  const renderedFor: string[] = [];
  function SettingsContent() {
    const { user } = useAuthStore();
    renderedFor.push(user?.documentId ?? "logged-out");
    return <div>Settings recovery</div>;
  }
  render(<MemoryRouter initialEntries={["/settings"]}><Routes>
    <Route element={<ProtectedRoute />}><Route path="/settings" element={<SettingsContent />} /></Route>
    <Route path="/onboarding" element={<div>Onboarding</div>} />
    <Route path="/login" element={<div>Login</div>} />
  </Routes></MemoryRouter>);
  return renderedFor;
}

describe("ProtectedRoute lifecycle identity", () => {
  beforeEach(() => { vi.clearAllMocks(); signIn("user-a"); });
  afterEach(() => vi.unstubAllGlobals());

  it("never renders A's recovery permission for cached B before effects run", async () => {
    const next = deferred<Response>();
    const fetcher = vi.fn().mockResolvedValueOnce(pending()).mockReturnValueOnce(next.promise);
    vi.stubGlobal("fetch", fetcher);
    const renderedFor = mount();
    await screen.findByText("Settings recovery");
    act(() => signIn("user-b"));
    expect(renderedFor).not.toContain("user-b");
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    await act(async () => next.resolve(missing()));
    expect(await screen.findByText("Onboarding")).toBeInTheDocument();
  });

  it.each(["success", "error"])("ignores stale A status %s after B becomes current", async (outcome) => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise));
    const renderedFor = mount();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    act(() => signIn("user-b"));
    await act(async () => first.resolve(outcome === "success" ? pending() : new Response("{}", { status: 503 })));
    expect(renderedFor).not.toContain("user-b");
    expect(screen.queryByText("Try again")).not.toBeInTheDocument();
    await act(async () => second.resolve(missing()));
    expect(await screen.findByText("Onboarding")).toBeInTheDocument();
  });

  it("retries lifecycle status even when onboarding refetch leaves data and loading unchanged", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("{}", { status: 503 })).mockResolvedValueOnce(pending()));
    mount();
    fireEvent.click(await screen.findByText("Try again"));
    expect(await screen.findByText("Settings recovery")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("ignores in-flight status after logout", async () => {
    const response = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(response.promise));
    const renderedFor = mount();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    act(() => useAuthStore.getState().logout());
    await act(async () => response.resolve(pending()));
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(renderedFor).toEqual([]);
  });
});
