import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuthStore from "../../../store/store";
import { toast } from "sonner";
import Settings from "../Settings";
import { StrictMode } from "react";

const api = vi.hoisted(() => ({ query: vi.fn(), mutate: vi.fn() }));

// Lifecycle isolation only; category behavior is exercised with the real
// Apollo/provider boundary in Settings.profile-account-placement and surfaces.
vi.mock('../../navigation/CategoryNavigationProvider', () => ({ useCategoryNavigation: () => ({
  snapshot: undefined, authority: undefined, busy: false, error: undefined,
  refresh: async () => {}, request: vi.fn(), setAutoPinning: vi.fn(),
}) }));
// Music is inert in this lifecycle-only fixture; its provider/writer integration
// is covered separately without replacing any lifecycle timing or identity inputs.
vi.mock('../../music/MusicPublishProvider', () => ({ useMusicPublish: () => ({
  state: { kind: 'unknown' }, canChange: false, canRecover: false,
  request: vi.fn(), resume: vi.fn(), refresh: vi.fn(),
}) }));

vi.mock("@apollo/client", async (original) => ({
  ...await original<typeof import("@apollo/client")>(),
  useApolloClient: () => ({ query: api.query }),
  useMutation: () => [api.mutate],
  useQuery: () => ({ data: { usersPermissionsUser: { provider: "google", accounts: [] } }, loading: false, refetch: vi.fn() }),
}));
// These unrelated panels require their own network/provider trees.
vi.mock("../components/ProfileAccountSettings", () => ({ default: () => null }));
vi.mock("../components/BillingTab", () => ({ default: () => null }));
vi.mock("../components/LanguageSelector", () => ({ default: () => null, LANGUAGES: [{ code: "en", name: "English" }] }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function lifecycle(identity = "user-a", terminal = false, cancelled = false, boundary = false) {
  return new Response(JSON.stringify({ version: "music-lifecycle/v1", operation: {
    operationId: `operation-${identity}`, status: terminal ? "tombstoned" : cancelled ? "suspended" : "pending_deletion",
    phase: terminal ? "finalized" : "prepared", state: cancelled ? "cancelled" : boundary ? "requested" : "completed",
    boundaryCrossed: terminal || boundary, retryable: boundary, deadLetter: false,
    upstreamUserDocumentId: identity, upstreamAccountDocumentId: `account-${identity}`,
  } }), { status: 200 });
}
const resumed = () => new Response(JSON.stringify({ version: "music-lifecycle/v1", identity: { status: "active" } }), { status: 200 });
function signIn(identity: string) {
  useAuthStore.getState().login({ id: identity, documentId: identity, username: identity, email: `${identity}@example.test`, blocked: false, token: `fixture-bearer-${identity}` });
}
const actions = (fetcher: ReturnType<typeof vi.fn>) => fetcher.mock.calls.filter(([, init]) => init.method === "POST");
const canonicalLifecyclePath = (url: string) => new URL(url, window.location.origin).pathname.replace(/^\/__localtunes(?=\/)/, "");

describe("Settings lifecycle identity", () => {
  beforeEach(() => { vi.clearAllMocks(); api.query.mockReset(); api.mutate.mockReset(); signIn("user-a"); });
  afterEach(() => vi.unstubAllGlobals());

  it.each(["switch", "logout"])("hides old lifecycle UI immediately on %s", async (change) => {
    const next = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(lifecycle()).mockReturnValue(next.promise));
    render(<Settings />);
    await screen.findByRole("button", { name: "Cancel deletion" });
    act(() => change === "switch" ? signIn("user-b") : useAuthStore.getState().logout());
    expect(screen.queryByRole("button", { name: "Cancel deletion" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Account deletion is prepared/)).not.toBeInTheDocument();
  });

  it("blocks a retained cancellation handler before the identity-switch render", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(lifecycle()).mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetcher);
    render(<Settings />);
    const cancel = await screen.findByRole("button", { name: "Cancel deletion" });
    act(() => { signIn("user-b"); fireEvent.click(cancel); });
    expect(actions(fetcher)).toHaveLength(0);
  });

  it.each(["switch", "logout"])("does not resume or publish late cancellation success after %s", async (change) => {
    const cancel = deferred<Response>();
    const fetcher = vi.fn().mockImplementation((url: string, init: RequestInit) => {
      if (url.endsWith("/cancel")) return cancel.promise;
      if (url.endsWith("/resume")) return Promise.resolve(resumed());
      return Promise.resolve(lifecycle(String(init.headers && (init.headers as Record<string, string>).Authorization).includes("user-b") ? "user-b" : "user-a"));
    });
    vi.stubGlobal("fetch", fetcher);
    render(<Settings />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel deletion" }));
    act(() => change === "switch" ? signIn("user-b") : useAuthStore.getState().logout());
    await act(async () => cancel.resolve(lifecycle("user-a", false, true)));
    expect(actions(fetcher).map(([url]) => canonicalLifecyclePath(url))).toEqual(["/api/music/identity/lifecycle/cancel"]);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    if (change === "switch") expect(await screen.findByRole("button", { name: "Cancel deletion" })).toBeInTheDocument();
  });

  it("does not show a stale action error for the next identity", async () => {
    const cancel = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => url.endsWith("/cancel") ? cancel.promise : Promise.resolve(lifecycle())));
    render(<Settings />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel deletion" }));
    act(() => signIn("user-b"));
    await act(async () => cancel.resolve(new Response("{}", { status: 503 })));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it.each(["success", "error"])("ignores older focus status %s after a newer terminal response", async (outcome) => {
    const old = deferred<Response>();
    const current = deferred<Response>();
    const fetcher = vi.fn().mockResolvedValueOnce(lifecycle()).mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    vi.stubGlobal("fetch", fetcher);
    render(<Settings />);
    await screen.findByRole("button", { name: "Cancel deletion" });
    fireEvent.focus(window);
    fireEvent.focus(window);
    await act(async () => current.resolve(lifecycle("user-a", true)));
    await screen.findByText(/Account deletion is complete/);
    await act(async () => old.resolve(outcome === "success" ? lifecycle() : new Response(JSON.stringify({ error: { code: "LIFECYCLE_NOT_FOUND" } }), { status: 404 })));
    expect(screen.getByText(/Account deletion is complete/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel deletion" })).not.toBeInTheDocument();
  });

  it.each(["profile", "token"])("keeps partial cancellation across same-user %s refresh and retries only resume", async (refresh) => {
    let resumeCalls = 0;
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/cancel")) return Promise.resolve(lifecycle("user-a", false, true));
      if (url.endsWith("/resume")) return Promise.resolve(++resumeCalls === 1 ? new Response("{}", { status: 503 }) : resumed());
      return Promise.resolve(lifecycle());
    });
    vi.stubGlobal("fetch", fetcher);
    render(<Settings />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel deletion" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    act(() => refresh === "profile"
      ? useAuthStore.getState().updateUsername("renamed")
      : useAuthStore.setState({ token: "refreshed-fixture-bearer-user-a" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(actions(fetcher).map(([url]) => canonicalLifecyclePath(url))).toEqual([
      "/api/music/identity/lifecycle/cancel", "/api/music/identity/lifecycle/resume", "/api/music/identity/lifecycle/resume",
    ]);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/status"))).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Cancel deletion" })).not.toBeInTheDocument();
  });

  it("revokes an old in-flight action across batched A to B to A changes", async () => {
    const cancel = deferred<Response>();
    const fetcher = vi.fn().mockImplementation((url: string) => url.endsWith("/cancel") ? cancel.promise : Promise.resolve(lifecycle()));
    vi.stubGlobal("fetch", fetcher);
    render(<Settings />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel deletion" }));
    act(() => { signIn("user-b"); signIn("user-a"); });
    await act(async () => cancel.resolve(lifecycle("user-a", false, true)));
    expect(actions(fetcher).map(([url]) => canonicalLifecyclePath(url))).toEqual(["/api/music/identity/lifecycle/cancel"]);
    expect(toast.success).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel deletion" }));
    await waitFor(() => expect(actions(fetcher).filter(([url]) => url.endsWith("/cancel"))).toHaveLength(2));
  });

  it("admits only one cancellation for double activation", async () => {
    const pending = deferred<Response>();
    const fetcher = vi.fn().mockResolvedValueOnce(lifecycle()).mockReturnValue(pending.promise);
    vi.stubGlobal("fetch", fetcher);
    render(<Settings />);
    const button = await screen.findByRole("button", { name: "Cancel deletion" });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(actions(fetcher)).toHaveLength(1);
  });

  it.each(["success", "error"])("ignores old Settings status %s while the next identity is unresolved", async (outcome) => {
    const status = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(status.promise).mockImplementation(() => new Promise(() => {})));
    render(<Settings />);
    act(() => signIn("user-b"));
    await act(async () => status.resolve(outcome === "success" ? lifecycle() : new Response("{}", { status: 503 })));
    expect(screen.queryByRole("button", { name: "Cancel deletion" })).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it.each(["switch", "logout"])("blocks Explorer mutations when a deletion boundary completes after %s", async (change) => {
    const boundary = deferred<Response>();
    const fetcher = vi.fn().mockImplementation((url: string) => url.endsWith("/boundary") ? boundary.promise : Promise.resolve(lifecycle("user-a", false, false, true)));
    vi.stubGlobal("fetch", fetcher);
    render(<Settings />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry account deletion" }));
    await waitFor(() => expect(actions(fetcher)).toHaveLength(2));
    act(() => change === "switch" ? signIn("user-b") : useAuthStore.getState().logout());
    await act(async () => boundary.resolve(lifecycle("user-a", false, false, true)));
    expect(api.query).not.toHaveBeenCalled();
    expect(api.mutate).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("does not clear B's auth when A's user-deletion mutation completes late", async () => {
    const deletion = deferred<unknown>();
    api.query.mockResolvedValue({ data: { usersPermissionsUser: { accounts: [] } } });
    api.mutate.mockReturnValue(deletion.promise);
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(lifecycle("user-a", false, false, true))));
    render(<Settings />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry account deletion" }));
    await waitFor(() => expect(api.mutate).toHaveBeenCalledTimes(1));
    act(() => signIn("user-b"));
    await act(async () => deletion.resolve({ data: { deleteUsersPermissionsUser: { data: { documentId: "user-a" } } } }));
    expect(useAuthStore.getState().user?.documentId).toBe("user-b");
    expect(localStorage.getItem("auth-storage")).toContain("user-b");
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("keeps B's action locked when A's stale finally runs", async () => {
    const old = deferred<Response>();
    const current = deferred<Response>();
    let cancellations = 0;
    const fetcher = vi.fn().mockImplementation((url: string) => url.endsWith("/cancel")
      ? ++cancellations === 1 ? old.promise : current.promise
      : Promise.resolve(lifecycle()));
    vi.stubGlobal("fetch", fetcher);
    render(<Settings />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel deletion" }));
    act(() => signIn("user-b"));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel deletion" }));
    await act(async () => old.resolve(new Response("{}", { status: 503 })));
    fireEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    expect(actions(fetcher)).toHaveLength(2);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("retains current authority through StrictMode effect replay", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(url.endsWith("/resume") ? resumed() : lifecycle())));
    render(<StrictMode><Settings /></StrictMode>);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel deletion" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: "Cancel deletion" })).not.toBeInTheDocument();
  });
});
