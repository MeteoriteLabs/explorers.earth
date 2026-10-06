import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthSyncManager from "../AuthSyncManager";
import useAuthStore from "../../store/store";

const calls = vi.hoisted(() => ({ refresh: vi.fn(async () => undefined), clearStore: vi.fn(async () => undefined),
  logout: vi.fn(), reset: vi.fn(), clearCommands: vi.fn(), clearWorkspace: vi.fn(async () => undefined),
  cancelQueries: vi.fn(async () => undefined), removeQueries: vi.fn(),
  reconcile: vi.fn(async () => undefined) }));
vi.mock("@apollo/client", () => ({ useApolloClient: () => ({ clearStore: calls.clearStore }) }));
vi.mock("../../lib/authClient", () => ({ authClient: { refresh: calls.refresh } }));
vi.mock("../../features/music/musicApi", () => ({ musicApi: { logout: calls.logout },
  musicIdentityCoordinator: { reset: calls.reset, reconcile: calls.reconcile } }));
vi.mock("../../features/music/musicPublicationCommandRegistry", () => ({ clearMusicPublicationCommands: calls.clearCommands }));
vi.mock("../../hooks/useTunesDashboard", () => ({ clearAllMusicWorkspaceQueries: calls.clearWorkspace }));
vi.mock("../../lib/queryClient", () => ({ queryClient: { cancelQueries: calls.cancelQueries, removeQueries: calls.removeQueries } }));

const verify = (accountId: string) => {
  const generation = useAuthStore.getState().beginVerification();
  useAuthStore.getState().acceptVerified(generation, { id: accountId, userId: `user-${accountId}`, username: accountId,
    email: `${accountId}@example.invalid`, onboardingStatus: "complete", revision: 1 });
};

describe("AuthSyncManager canonical session boundary", () => {
  beforeEach(() => { vi.clearAllMocks(); useAuthStore.getState().logout(); });
  it("starts cookie verification on mount", () => {
    render(<AuthSyncManager />);
    expect(calls.refresh).toHaveBeenCalledTimes(1);
  });
  it("provisions no Music owner from a verified session, because the Music surface owns that", async () => {
    // This component did provision, and provisioning app-wide made a Music owner out of
    // every signed-in visitor. account_music_identity is the deletion boundary
    // accountLifecycleMaintenance enforces, so each of those accounts could no longer
    // finish a deletion request. A Music owner is someone who opened Music, so
    // pages/Music.tsx provisions from its own canonical scope.
    //
    // The positive assertion moved with the behaviour and is stronger there, against the
    // real client rather than this mock: music-accessibility.spec.ts requires exactly one
    // ensure on opening Music, and music-fullstack.spec.ts requires it at the canonical
    // path carrying no bearer.
    verify("account-a");
    render(<AuthSyncManager />);
    await waitFor(() => expect(calls.clearStore).not.toHaveBeenCalled());
    expect(calls.reconcile).not.toHaveBeenCalled();
  });
  it("provisions no Music owner without a verified session either", () => {
    render(<AuthSyncManager />);
    expect(calls.reconcile).not.toHaveBeenCalled();
  });
  it("clears account caches when the session ends", async () => {
    verify("account-a");
    render(<AuthSyncManager />);
    act(() => useAuthStore.getState().logout());
    await waitFor(() => expect(calls.clearStore).toHaveBeenCalledTimes(1));
    expect(calls.logout).toHaveBeenCalledTimes(1);
    expect(calls.reset).toHaveBeenCalledTimes(1);
    expect(calls.clearCommands).toHaveBeenCalledTimes(1);
    expect(calls.cancelQueries).toHaveBeenCalledTimes(1);
    expect(calls.removeQueries).toHaveBeenCalledWith({ queryKey: ["explorers-account"] });
  });
  it("fences A→B→A by generation even when the account id repeats", async () => {
    verify("account-a");
    render(<AuthSyncManager />);
    const first = useAuthStore.getState().generation;
    act(() => { verify("account-b"); verify("account-a"); });
    expect(useAuthStore.getState().generation).toBe(first + 2);
    await waitFor(() => expect(calls.clearStore).toHaveBeenCalled());
  });
});
