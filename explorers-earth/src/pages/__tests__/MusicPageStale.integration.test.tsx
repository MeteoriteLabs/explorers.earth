import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MusicPageContent } from "../Music";

vi.mock("../../components/SEO", () => ({ default: () => null }));
vi.mock("react-player", async () => {
  const React = await import("react");
  return {
    default: React.forwardRef((props: { playing?: boolean }, ref) => {
      React.useImperativeHandle(ref, () => ({ currentTime: 0 }));
      return <div data-testid="stale-music-media" data-playing={String(props.playing)} />;
    }),
  };
});

describe("Music page cached dashboard integration", () => {
  it("keeps the last good dashboard mounted read-only when a refetch resolves with an error", () => {
    const playlist = {
      id: 17,
      name: "Cached road mix",
      description: "Last successfully loaded playlist",
      isVisibleToGuests: false,
      songs: [],
    };
    const data = {
      playlists: [playlist],
      dashboard: {
        queueRevision: 4,
        songs: [],
        currentlyPlaying: null,
        playedSongs: [],
        publication: { mode: "private" as const, publicSlug: "cached-road-mix" },
      },
      entitlement: { state: "included" as const, coreRead: true, coreMutation: true, paidMutation: false, maxAgeSeconds: 600 },
      guestControls: null,
      playlist: null,
      guestUrl: "cached-road-mix",
      localUser: null,
      identityStatus: "ready" as const,
      requestId: "refresh-request-17",
      isLoading: false,
      error: "Music is temporarily unavailable.",
      refetch: vi.fn().mockResolvedValue({ data: undefined, error: new Error("refresh failed") }),
      retryIdentity: vi.fn(),
    };

    render(<MusicPageContent
      authenticated
      onboarding="complete"
      data={data}
      scope={{ userDocumentId: "user-17", accountDocumentId: "account-17" }}
      ownerWorkspace
      onAction={vi.fn()}
    />);

    expect(screen.getByRole("status")).toHaveTextContent("May be out of date");
    expect(screen.getByRole("tab", { name: "Playlists" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Cached road mix/ })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Make Cached road mix public" })).toBeDisabled();
    expect(screen.queryByText("Music is temporarily unavailable.")).not.toBeInTheDocument();
  });
});
