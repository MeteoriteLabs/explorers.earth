import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../features/music/musicApi", () => ({
  musicApi: { request: vi.fn() },
  musicIdentityCoordinator: {
    getSnapshot: () => "ready",
    subscribe: () => () => undefined,
    retry: vi.fn(async () => undefined),
    reportFailure: vi.fn(),
  },
}));

import { musicWorkspaceClient, useTunesDashboard } from "../useTunesDashboard";
import * as dashboardModule from "../useTunesDashboard";

const scopeA = { userDocumentId: "user-document-a", accountDocumentId: "account-document-a" };
const scopeB = { userDocumentId: "user-document-b", accountDocumentId: "account-document-b" };

function workspace(name: string) {
  return {
    playlists: [{ id: 1, name, description: null, isVisibleToGuests: false, songs: [] }],
    dashboard: { songs: [], currentlyPlaying: null, playedSongs: [], publication: { mode: "private" as const, publicSlug: "public-slug" } },
    entitlement: { state: "included" as const, coreRead: true, coreMutation: true, paidMutation: false, maxAgeSeconds: 600 },
  };
}

function Probe({ scope }: { scope: typeof scopeA }) {
  const result = useTunesDashboard(scope);
  return <div>{result.playlists[0]?.name ?? "empty"}</div>;
}

function ErrorProbe({ scope }: { scope: typeof scopeA }) {
  const result = useTunesDashboard(scope);
  return <div>{result.error ?? "pending"}</div>;
}

describe("private Music query identity isolation", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("never renders identity A data while the same QueryClient switches through logout to identity B", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    vi.spyOn(musicWorkspaceClient, "load")
      .mockResolvedValueOnce(workspace("Authority A"))
      .mockResolvedValueOnce(workspace("Authority B"));
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const view = render(<Probe scope={scopeA} />, { wrapper });
    expect(await screen.findByText("Authority A")).toBeInTheDocument();

    await dashboardModule.clearMusicWorkspaceScope(queryClient, scopeA);
    view.rerender(<Probe scope={scopeB} />);
    expect(screen.queryByText("Authority A")).not.toBeInTheDocument();
    expect(screen.getByText("empty")).toBeInTheDocument();
    expect(await screen.findByText("Authority B")).toBeInTheDocument();
    expect(musicWorkspaceClient.load).toHaveBeenCalledTimes(2);
  });

  it("cancels and removes only the exact prior immutable identity query family", async () => {
    const queryClient = new QueryClient();
    const aKey = dashboardModule.musicWorkspaceQueryKey(scopeA);
    const bKey = dashboardModule.musicWorkspaceQueryKey(scopeB);
    queryClient.setQueryData(aKey, workspace("Authority A"));
    queryClient.setQueryData(bKey, workspace("Authority B"));

    await dashboardModule.clearMusicWorkspaceScope(queryClient, scopeA);

    await waitFor(() => expect(queryClient.getQueryData(aKey)).toBeUndefined());
    expect(queryClient.getQueryData(bKey)).toEqual(workspace("Authority B"));
  });

  it("does not put terminal lifecycle authority errors through the generic query retry loop", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
    vi.spyOn(musicWorkspaceClient, "load").mockRejectedValue(Object.assign(new Error("contained"), {
      status: 403,
      upstreamCode: "IDENTITY_SUSPENDED",
      retryable: false,
    }));
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    render(<ErrorProbe scope={scopeA} />, { wrapper });
    expect(await screen.findByText("Music is temporarily unavailable.")).toBeInTheDocument();
    expect(musicWorkspaceClient.load).toHaveBeenCalledTimes(1);
  });
});
