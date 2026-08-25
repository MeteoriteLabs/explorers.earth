import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@apollo/client";
import useAuthStore from "../../store/store";
import AuthSyncManager from "../AuthSyncManager";

const setAuthority = vi.hoisted(() => vi.fn());
const reconcile = vi.hoisted(() => vi.fn(async () => undefined));
const reset = vi.hoisted(() => vi.fn());
const publish = vi.hoisted(() => vi.fn());
const clearWorkspaceScope = vi.hoisted(() => vi.fn(async () => undefined));
const clearAllWorkspaceQueries = vi.hoisted(() => vi.fn(async () => undefined));
const clearPublicationCommands = vi.hoisted(() => vi.fn());
const queryClientStub = vi.hoisted(() => ({ id: "query-client" }));
const sessionListeners = vi.hoisted(() => new Set<() => void>());
const sessionSnapshot = vi.hoisted(() => ({ value: 0 }));

vi.mock("@apollo/client", () => ({ useQuery: vi.fn(), gql: () => ({}) }));
vi.mock("../../store/store", () => ({ default: vi.fn() }));
vi.mock("../../features/music/musicApi", () => ({
  musicApi: { setAuthority },
  musicIdentityCoordinator: { reconcile, reset },
}));
vi.mock("../../hooks/useTunesDashboard", () => ({
  clearMusicWorkspaceScope: clearWorkspaceScope,
  clearAllMusicWorkspaceQueries: clearAllWorkspaceQueries,
}));
vi.mock("../../lib/queryClient", () => ({ queryClient: queryClientStub }));
vi.mock("../../features/music/musicPublicationCommandRegistry", () => ({
  clearMusicPublicationCommands: clearPublicationCommands,
}));
vi.mock("../../features/music/musicSessionBoundary", () => ({ musicSessionBoundary: {
  publish,
  getAccountGenerationSnapshot: () => sessionSnapshot.value,
  subscribeAccountGeneration: (listener: () => void) => {
    sessionListeners.add(listener);
    return () => sessionListeners.delete(listener);
  },
} }));

const complete = (documentId: string) => ({ documentId, Account_Name: "Ready", Account_Type: "Personal", mobile_number: "+10000000001" });

describe("AuthSyncManager immutable authority selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionSnapshot.value = 0;
    sessionListeners.clear();
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: true,
      user: { documentId: "user-document" },
    });
  });

  it("advances the client authority and broadcasts account generation before reconciling a changed selected Account", async () => {
    const query = useQuery as unknown as ReturnType<typeof vi.fn>;
    query.mockReturnValue({ data: { usersPermissionsUser: {
      documentId: "user-document", provider: "local", confirmed: true, blocked: false,
      accounts: [complete("account-a")],
    } } });
    const view = render(<AuthSyncManager />);
    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
    expect(setAuthority).toHaveBeenLastCalledWith("user-document:account-a");
    expect(publish).not.toHaveBeenCalled();

    query.mockReturnValue({ data: { usersPermissionsUser: {
      documentId: "user-document", provider: "local", confirmed: true, blocked: false,
      accounts: [complete("account-b")],
    } } });
    view.rerender(<AuthSyncManager />);
    await waitFor(() => expect(setAuthority).toHaveBeenLastCalledWith("user-document:account-b"));
    expect(publish).toHaveBeenCalledWith("account-generation");
    expect(setAuthority.mock.invocationCallOrder.at(-1)).toBeLessThan(reconcile.mock.invocationCallOrder.at(-1)!);
  });

  it("does not reconcile or select index zero when two completed Accounts are authoritative", async () => {
    (useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: { usersPermissionsUser: {
      documentId: "user-document", provider: "local", confirmed: true, blocked: false,
      accounts: [complete("account-a"), complete("account-b")],
    } } });
    render(<AuthSyncManager />);
    await Promise.resolve();
    expect(setAuthority).not.toHaveBeenCalled();
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("clears an active Music scope and advances authority when the authoritative user becomes blocked", async () => {
    const query = useQuery as unknown as ReturnType<typeof vi.fn>;
    query.mockReturnValue({ data: { usersPermissionsUser: {
      documentId: "user-document", provider: "local", confirmed: true, blocked: false,
      accounts: [complete("account-a")],
    } } });
    const view = render(<AuthSyncManager />);
    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));

    query.mockReturnValue({ data: { usersPermissionsUser: {
      documentId: "user-document", provider: "local", confirmed: true, blocked: true,
      accounts: [complete("account-a")],
    } } });
    view.rerender(<AuthSyncManager />);

    await waitFor(() => expect(setAuthority).toHaveBeenLastCalledWith(undefined));
    const activeScope = { userDocumentId: "user-document", accountDocumentId: "account-a" };
    expect(clearPublicationCommands).toHaveBeenCalledWith(activeScope);
    expect(clearWorkspaceScope).toHaveBeenCalledWith(queryClientStub, activeScope);
    expect(reset).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledWith("account-generation");
    expect(setAuthority.mock.invocationCallOrder.at(-1)).toBeLessThan(publish.mock.invocationCallOrder.at(-1)!);
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it("immediately refetches and reconciles the current immutable scope after a remote account generation without rebroadcasting", async () => {
    const query = useQuery as unknown as ReturnType<typeof vi.fn>;
    const accountA = { usersPermissionsUser: {
      documentId: "user-document", provider: "local", confirmed: true, blocked: false,
      accounts: [complete("account-a")],
    } };
    const accountB = { usersPermissionsUser: {
      documentId: "user-document", provider: "local", confirmed: true, blocked: false,
      accounts: [complete("account-b")],
    } };
    const refetch = vi.fn(async () => ({ data: accountB }));
    query.mockReturnValue({ data: accountA, refetch });
    render(<AuthSyncManager />);
    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));

    sessionSnapshot.value = 1;
    for (const listener of sessionListeners) listener();

    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(2));
    expect(setAuthority).toHaveBeenLastCalledWith("user-document:account-b");
    expect(reconcile).toHaveBeenLastCalledWith(expect.objectContaining({
      userDocumentId: "user-document",
      account: { documentId: "account-b" },
    }));
    expect(publish).not.toHaveBeenCalled();
  });

  it("forces exactly one fresh ensure when a remote generation retains the same Account", async () => {
    const query = useQuery as unknown as ReturnType<typeof vi.fn>;
    const data = { usersPermissionsUser: {
      documentId: "user-document", provider: "local", confirmed: true, blocked: false,
      accounts: [complete("account-a")],
    } };
    const refetch = vi.fn(async () => ({ data }));
    query.mockReturnValue({ data, refetch });
    render(<AuthSyncManager />);
    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));

    sessionSnapshot.value = 1;
    for (const listener of sessionListeners) listener();

    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(2));
    expect(reset).toHaveBeenCalledTimes(2);
    expect(publish).not.toHaveBeenCalled();
  });
});
