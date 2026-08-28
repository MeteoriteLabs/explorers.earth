import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicMusic, { PublicMusicContent } from "../public/PublicMusic";
import type { PublicMusicResource } from "../../features/music/publicMusicClient";

const loadPublicMusic = vi.hoisted(() => vi.fn());
const subscribeToPublicMusic = vi.hoisted(() => vi.fn(() => ({ unsubscribe: vi.fn() })));

vi.mock("../../features/music/publicMusicClient", () => ({
  publicMusicClient: { load: loadPublicMusic },
  PublicMusicError: class PublicMusicError extends Error {
    constructor(public readonly code: string, public readonly retryAfterSeconds?: number) { super(code); }
  },
}));

vi.mock("../../components/SEO", () => ({ default: () => null }));
vi.mock("react-player", () => ({
  default: (props: Record<string, unknown>) => <div data-testid="guest-media" data-playing={String(props.playing)} />,
}));
vi.mock("../../features/music/publicMusicLiveClient", () => ({ subscribeToPublicMusic }));

const playing = { id: "P".repeat(43), youtubeId: "abcdefghijk", title: "Now", artist: "Artist", thumbnailUrl: "https://images.example/now.jpg", position: 0, status: "playing" as const, playedAt: null };
const queued = { ...playing, id: "Q".repeat(43), title: "Next", status: "queued" as const, position: 1 };
const saved = { ...playing, id: "S".repeat(43), title: "North", artist: "Sky", status: "saved" as const };
const played = { ...playing, id: "H".repeat(43), title: "Past", status: "played" as const, playedAt: "2026-08-28T10:00:00.000Z" };

function resource(overrides: Partial<PublicMusicResource> = {}): PublicMusicResource {
  return {
    version: "music-public-resource/v1" as const,
    revision: 1,
    user: { username: "display", venueName: null },
    permissions: {
      allowSongRequests: false,
      allowGuestPlayOnDevice: false,
      allowPlaylistSharing: false,
      allowRecentlyPlayedVisibility: false,
      allowQueueVisibility: false,
    },
    currentlyPlaying: null,
    queue: { items: [], total: 0, truncated: false },
    recentlyPlayed: { items: [], total: 0, truncated: false },
    playlists: { items: [], total: 0, truncated: false },
    ...overrides,
  };
}

describe("public Music page", () => {
  afterEach(() => {
    loadPublicMusic.mockReset();
    subscribeToPublicMusic.mockClear();
    vi.useRealTimers();
    window.history.replaceState({}, "", "/");
    window.sessionStorage.clear();
  });

  it("uses the unified public 404 for private, missing, and invalid links", () => {
    render(<MemoryRouter><PublicMusicContent state="not-found" /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Music page unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Explorers" })).toHaveAttribute("href", "/");
  });

  it("uses the approved page-level empty copy when nothing is shared", () => {
    render(<MemoryRouter><PublicMusicContent state="ready" resource={resource()} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Music" })).toBeInTheDocument();
    expect(screen.getByText("Nothing has been shared here yet")).toBeInTheDocument();
  });

  it("renders public playlist content without edit controls", () => {
    render(<MemoryRouter><PublicMusicContent state="ready" resource={resource({
      permissions: { ...resource().permissions, allowPlaylistSharing: true },
      playlists: { items: [{ id: "L".repeat(43), name: "Roads", description: null, songs: { items: [saved], total: 1, truncated: false } }], total: 1, truncated: false },
    })} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Roads" })).toBeInTheDocument();
    expect(screen.getByText("North")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("applies the permission policy even if protected collection data is supplied", () => {
    render(<MemoryRouter><PublicMusicContent state="ready" resource={resource({
      currentlyPlaying: playing,
      recentlyPlayed: { items: [played], total: 1, truncated: false },
      playlists: { items: [{ id: "L".repeat(43), name: "Protected", description: null, songs: { items: [saved], total: 1, truncated: false } }], total: 1, truncated: false },
    }) as PublicMusicResource} /></MemoryRouter>);

    expect(screen.queryByText("Now")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Play Now" })).not.toBeInTheDocument();
    expect(screen.queryByText("Past")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Protected" })).not.toBeInTheDocument();
  });

  it("renders queue-visible current state without upgrading it to playback interactivity", () => {
    const view = render(<MemoryRouter><PublicMusicContent state="ready" resource={resource({
      permissions: { ...resource().permissions, allowQueueVisibility: true },
      currentlyPlaying: playing,
      queue: { items: [queued], total: 1, truncated: false },
    })} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Up next" })).toBeInTheDocument();
    expect(screen.getByText("Now")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Up next" })).toHaveTextContent("Next");
    expect(screen.getByRole("list", { name: "Up next" })).not.toHaveTextContent("Now");
    expect(screen.queryByRole("link", { name: "Play Now" })).not.toBeInTheDocument();

    view.rerender(<MemoryRouter><PublicMusicContent state="ready" resource={resource()} /></MemoryRouter>);
    expect(screen.queryByRole("heading", { name: "Playing now & up next" })).not.toBeInTheDocument();
  });

  it("renders local playback controls only for a playback-eligible source", () => {
    render(<MemoryRouter><PublicMusicContent state="ready" resource={resource({
      permissions: { ...resource().permissions, allowGuestPlayOnDevice: true },
      currentlyPlaying: playing,
    })} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Play on this device" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Music" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("Now")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Up next" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play Now on this device" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("enables Retry only after the server delay and runs the supplied recovery", () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    render(<MemoryRouter><PublicMusicContent state="rate-limited" retryAfterSeconds={2} onRetry={onRetry} /></MemoryRouter>);
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toBeDisabled();
    act(() => vi.advanceTimersByTime(1_999));
    expect(retry).toBeDisabled();
    act(() => vi.advanceTimersByTime(1));
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("reacquires the fragment for each slug, aborts the old read, and scrubs it on navigation", async () => {
    const first = new Promise(() => undefined);
    loadPublicMusic.mockReturnValueOnce(first).mockResolvedValueOnce(resource());
    window.history.replaceState({}, "", `/music/share/public-slug-a#access=${"A".repeat(43)}`);

    function Switcher() {
      const navigate = useNavigate();
      return <button type="button" onClick={() => navigate("/music/share/public-slug-b")}>Next Music page</button>;
    }
    render(
      <MemoryRouter initialEntries={["/music/share/public-slug-a"]}>
        <Switcher />
        <Routes><Route path="/music/share/:publicSlug" element={<PublicMusic />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(loadPublicMusic).toHaveBeenCalledTimes(1));
    const firstSignal = loadPublicMusic.mock.calls[0][2] as AbortSignal;
    expect(loadPublicMusic.mock.calls[0].slice(0, 2)).toEqual(["public-slug-a", "A".repeat(43)]);
    expect(window.location.hash).toBe("");

    window.history.replaceState({}, "", `/music/share/public-slug-b#access=${"B".repeat(43)}`);
    fireEvent.click(screen.getByRole("button", { name: "Next Music page" }));
    await waitFor(() => expect(loadPublicMusic).toHaveBeenCalledTimes(2));
    expect(firstSignal?.aborted).toBe(true);
    expect(loadPublicMusic.mock.calls[1].slice(0, 2)).toEqual(["public-slug-b", "B".repeat(43)]);
    expect(loadPublicMusic.mock.calls[1][2]).toBeInstanceOf(AbortSignal);
    expect(window.location.hash).toBe("");
  });

  it("retains a scrubbed unlisted capability for a same-tab remount", async () => {
    loadPublicMusic.mockResolvedValue(resource());
    window.history.replaceState({}, "", `/music/share/public-slug#access=${"C".repeat(43)}`);
    const first = render(
      <MemoryRouter initialEntries={["/music/share/public-slug"]}>
        <Routes><Route path="/music/share/:publicSlug" element={<PublicMusic />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(loadPublicMusic).toHaveBeenCalledWith("public-slug", "C".repeat(43), expect.any(AbortSignal)));
    first.unmount();
    loadPublicMusic.mockClear();
    render(
      <MemoryRouter initialEntries={["/music/share/public-slug"]}>
        <Routes><Route path="/music/share/:publicSlug" element={<PublicMusic />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(loadPublicMusic).toHaveBeenCalledWith("public-slug", "C".repeat(43), expect.any(AbortSignal)));
  });

  it("applies canonical live refetches and removes revoked content and capability", async () => {
    // Break caught: a socket envelope mutates rendered content directly or revocation leaves
    // stale protected content/capability in the mounted page.
    loadPublicMusic.mockResolvedValueOnce(resource({ revision: 1 })).mockResolvedValueOnce(resource({ revision: 4 }));
    window.history.replaceState({}, "", `/music/share/public-slug#access=${"D".repeat(43)}`);
    render(<MemoryRouter initialEntries={["/music/share/public-slug"]}><Routes><Route path="/music/share/:publicSlug" element={<PublicMusic />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(subscribeToPublicMusic).toHaveBeenCalledOnce());
    const options = subscribeToPublicMusic.mock.calls[0][0];
    await expect(options.onInvalidate(new AbortController().signal)).resolves.toEqual({ revision: 4 });
    expect(loadPublicMusic).toHaveBeenCalledTimes(2);
  });
});
