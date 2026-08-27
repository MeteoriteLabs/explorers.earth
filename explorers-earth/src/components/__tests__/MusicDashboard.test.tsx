import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import MusicDashboard from "../MusicDashboard";
import { musicWorkspaceClient } from "../../hooks/useTunesDashboard";
import { MusicClientError } from "../../lib/localTunesApiClient";
import { musicApi } from "../../features/music/musicApi";

vi.mock("react-player", async () => {
  const React = await import("react");
  return { default: React.forwardRef((props: { playing?: boolean }, ref) => {
    React.useImperativeHandle(ref, () => ({ currentTime: 0 }));
    return <div data-testid="dashboard-media" data-playing={String(props.playing)} />;
  }) };
});

const base = {
  playlists: [] as Array<any>,
  dashboard: { songs: [], currentlyPlaying: null, playedSongs: [], publication: { mode: "private" as const, publicSlug: "public-slug-123" } },
  entitlement: { state: "included" as const, coreRead: true, coreMutation: true, paidMutation: false, maxAgeSeconds: 600 },
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};
const scope = { userDocumentId: "explorer-user-a", accountDocumentId: "explorer-account-a" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function playbackResponse(revision: number, song: unknown) {
  return new Response(JSON.stringify({ version: "music-playback/v1", revision, song }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("Music workspace UI", () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  async function openSharingSettings() {
    const opener = screen.getByRole("button", { name: "Open playlist and sharing menu" });
    await userEvent.click(opener);
    const item = screen.getByRole("menuitem", { name: "Sharing settings" });
    await userEvent.click(item);
    return opener;
  }
  async function openLive() {
    await userEvent.click(screen.getByRole("tab", { name: "Live" }));
  }
  async function openPlaylist(name: string) {
    await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${name}`) }));
  }
  it("composes the approved owner player, search, queue, and history surface", async () => {
    const playlists = [{ id: 1, name: "Saved mix", description: null, isVisibleToGuests: false, songs: [] }];
    render(<MusicDashboard data={{ ...base, playlists, dashboard: { ...base.dashboard, queueRevision: 0 } }} scope={scope} complete />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Playlists", "Live"]);
    expect(screen.getByRole("tab", { name: "Playlists" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Your playlists" })).toBeInTheDocument();
    await openLive();
    expect(screen.getByLabelText("Music player region")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Find music" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Queue" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Guest controls" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Recently played" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add your first song" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Playlists" }));
    expect(screen.getByRole("button", { name: /^Saved mix/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New playlist" })).toBeInTheDocument();
    const menu = screen.getByRole("button", { name: "Open playlist and sharing menu" });
    expect(menu.closest("[data-music-page-actions]" )).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sharing settings" })).not.toBeInTheDocument();
    await userEvent.click(menu);
    expect(screen.getByRole("menuitem", { name: "Sharing settings" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Private playlist" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Public playlist" })).toBeInTheDocument();
  });

  it("loads and persists the five owner guest controls from the workspace", async () => {
    const guestControls = {
      allowSongRequests: true,
      allowGuestPlayOnDevice: false,
      allowPlaylistSharing: true,
      allowRecentlyPlayedVisibility: false,
    };
    const update = vi.spyOn(musicWorkspaceClient, "updateGuestControls").mockResolvedValue(guestControls);
    const refetch = vi.fn(async () => undefined);
    render(<MusicDashboard data={{ ...base, guestControls, refetch }} scope={scope} complete />);
    await openLive();
    expect(screen.getAllByRole("switch")).toHaveLength(5);
    await userEvent.click(screen.getByRole("switch", { name: "Allow song requests" }));

    expect(update).toHaveBeenCalledWith({ ...guestControls, allowSongRequests: false }, expect.stringMatching(/^guest-controls-/));
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
  });

  it("keeps an acknowledged guest-control change when only refetch fails", async () => {
    const guestControls = { allowSongRequests: true, allowGuestPlayOnDevice: false, allowPlaylistSharing: true, allowRecentlyPlayedVisibility: false, allowQueueVisibility: false };
    vi.spyOn(musicWorkspaceClient, "updateGuestControls").mockResolvedValue({ ...guestControls, allowSongRequests: false });
    const refetch = vi.fn().mockResolvedValue({ data: { guestControls }, error: new Error("refresh failed") });
    render(<MusicDashboard data={{ ...base, guestControls, refetch }} scope={scope} complete />);
    await openLive();
    const control = screen.getByRole("switch", { name: "Allow song requests" });

    await userEvent.click(control);

    expect(await screen.findByRole("alert")).toHaveTextContent("Guest control saved, but the latest settings could not be loaded");
    expect(control).toHaveAttribute("aria-checked", "false");
  });

  it("keeps acknowledged playlist visibility when only refetch fails", async () => {
    const playlist = { id: 1, name: "Road songs", description: null, isVisibleToGuests: false, songs: [] };
    vi.spyOn(musicWorkspaceClient, "setPlaylistVisibility").mockResolvedValue(undefined);
    const refetch = vi.fn().mockResolvedValue({ data: { playlists: [playlist] }, error: new Error("refresh failed") });
    render(<MusicDashboard data={{ ...base, playlists: [playlist], refetch }} scope={scope} complete />);
    const control = screen.getByRole("switch", { name: "Make Road songs public" });

    await userEvent.click(control);

    expect(await screen.findByRole("alert")).toHaveTextContent("Road songs visibility was saved, but the latest playlists could not be loaded");
    expect(control).toHaveAttribute("aria-checked", "true");
  });

  it("closes an acknowledged create dialog and offers playlist reconciliation when refetch fails", async () => {
    vi.spyOn(musicWorkspaceClient, "createPlaylist").mockResolvedValue({ id: 21, name: "Created mix", description: null, isVisibleToGuests: false, songs: [] });
    const refetch = vi.fn().mockResolvedValue({ data: { playlists: [] }, error: new Error("refresh failed") });
    render(<MusicDashboard data={{ ...base, refetch }} scope={scope} complete />);

    await userEvent.click(screen.getByRole("button", { name: "New playlist" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Playlist name" }), "Created mix");
    await userEvent.click(screen.getByRole("button", { name: "Create playlist" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Create playlist" })).not.toBeInTheDocument());
    expect(screen.getByRole("alert", { name: "Playlist reconciliation needed" })).toHaveTextContent("Playlist was created, but the latest playlists could not be loaded.");
    expect(screen.getByRole("button", { name: "Retry loading playlists" })).toBeInTheDocument();
  });

  it("closes an acknowledged rename dialog and offers playlist reconciliation when refetch fails", async () => {
    const playlist = { id: 1, name: "Road songs", description: null, isVisibleToGuests: false, songs: [] };
    vi.spyOn(musicWorkspaceClient, "renamePlaylist").mockResolvedValue(undefined);
    const refetch = vi.fn().mockResolvedValue({ data: { playlists: [playlist] }, error: new Error("refresh failed") });
    render(<MusicDashboard data={{ ...base, playlists: [playlist], refetch }} scope={scope} complete />);
    await openPlaylist("Road songs");

    await userEvent.click(screen.getByRole("button", { name: "Rename playlist" }));
    const name = screen.getByRole("textbox", { name: "Playlist name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Road songs renamed");
    await userEvent.click(screen.getByRole("button", { name: "Save playlist" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Rename playlist" })).not.toBeInTheDocument());
    expect(screen.getByRole("alert", { name: "Playlist reconciliation needed" })).toHaveTextContent("Playlist was renamed, but the latest playlists could not be loaded.");
  });

  it("reports acknowledged active-playlist visibility, order, and removal when each refetch fails", async () => {
    const playlist = {
      id: 1, name: "Road songs", description: null, isVisibleToGuests: false,
      songs: [
        { id: 11, playlistId: 1, youtubeId: "abcdefghijk", title: "First", artist: "A", thumbnailUrl: "https://img/1", position: 0, addedAt: "2026-08-25T10:00:00.000Z" },
        { id: 12, playlistId: 1, youtubeId: "lmnopqrstuv", title: "Second", artist: "B", thumbnailUrl: "https://img/2", position: 1, addedAt: "2026-08-25T10:01:00.000Z" },
      ],
    };
    vi.spyOn(musicWorkspaceClient, "setPlaylistVisibility").mockResolvedValue(undefined);
    vi.spyOn(musicWorkspaceClient, "reorderPlaylistSong").mockResolvedValue(undefined);
    vi.spyOn(musicWorkspaceClient, "removePlaylistSong").mockResolvedValue(undefined);
    const refetch = vi.fn().mockResolvedValue({ data: { playlists: [playlist] }, error: new Error("refresh failed") });
    render(<MusicDashboard data={{ ...base, playlists: [playlist], refetch }} scope={scope} complete />);
    await openPlaylist("Road songs");

    await userEvent.click(screen.getByRole("switch", { name: "Make Road songs public" }));
    expect(screen.getByRole("alert", { name: "Playlist reconciliation needed" })).toHaveTextContent("Playlist visibility was saved, but the latest playlists could not be loaded.");

    await userEvent.click(screen.getByRole("button", { name: "Move First down" }));
    expect(screen.getByRole("alert", { name: "Playlist reconciliation needed" })).toHaveTextContent("Playlist order was saved, but the latest playlist could not be loaded.");

    await userEvent.click(screen.getByRole("button", { name: "Remove First from Road songs" }));
    expect(screen.getByRole("alert", { name: "Playlist reconciliation needed" })).toHaveTextContent("First was removed from Road songs, but the latest playlist could not be loaded.");
  });

  it("locks and renders optimistic active-playlist visibility and reorder mutations", async () => {
    // Break caught: repeated clicks issue duplicate writes and a rerender resets pending active-playlist state.
    const playlist = {
      id: 1, name: "Road songs", description: null, isVisibleToGuests: false,
      songs: [
        { id: 11, playlistId: 1, youtubeId: "abcdefghijk", title: "First", artist: "A", thumbnailUrl: "https://img/1", position: 0, addedAt: "2026-08-25T10:00:00.000Z" },
        { id: 12, playlistId: 1, youtubeId: "lmnopqrstuv", title: "Second", artist: "B", thumbnailUrl: "https://img/2", position: 1, addedAt: "2026-08-25T10:01:00.000Z" },
      ],
    };
    const visibility = deferred<void>();
    const reorder = deferred<void>();
    const setVisibility = vi.spyOn(musicWorkspaceClient, "setPlaylistVisibility").mockReturnValue(visibility.promise);
    const reorderSong = vi.spyOn(musicWorkspaceClient, "reorderPlaylistSong").mockReturnValue(reorder.promise);
    const view = render(<MusicDashboard data={{ ...base, playlists: [playlist], refetch: vi.fn(async () => undefined) }} scope={scope} complete />);
    await openPlaylist("Road songs");

    const visibleButton = screen.getByRole("switch", { name: "Make Road songs public" });
    await userEvent.click(visibleButton);
    view.rerender(<MusicDashboard data={{ ...base, playlists: [[playlist][0]], refetch: vi.fn(async () => undefined) }} scope={scope} complete />);
    expect(screen.getByRole("switch", { name: "Make Road songs private" })).toBeDisabled();
    await userEvent.click(screen.getByRole("switch", { name: "Make Road songs private" }));
    expect(setVisibility).toHaveBeenCalledOnce();
    await act(async () => visibility.resolve());

    const move = screen.getByRole("button", { name: "Move First down" });
    await userEvent.click(move);
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("Second")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move First up" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Move First up" }));
    expect(reorderSong).toHaveBeenCalledOnce();
    await act(async () => reorder.resolve());
  });

  it("uses the shared active-playlist switch and reconciles rejection to canonical visibility received while pending", async () => {
    // Break caught: the active control is a bespoke pressed button and rollback restores a stale click-time prop.
    const playlist = {
      id: 1, name: "Road songs", description: null, isVisibleToGuests: false,
      songs: [{ id: 11, playlistId: 1, youtubeId: "abcdefghijk", title: "First", artist: "A", thumbnailUrl: "https://img/1", position: 0, addedAt: "2026-08-25T10:00:00.000Z" }],
    };
    const visibility = deferred<void>();
    vi.spyOn(musicWorkspaceClient, "setPlaylistVisibility").mockReturnValue(visibility.promise);
    const view = render(<MusicDashboard data={{ ...base, playlists: [playlist], refetch: vi.fn(async () => undefined) }} scope={scope} complete />);
    await openPlaylist("Road songs");
    const control = screen.getByRole("switch", { name: "Make Road songs public" });

    await userEvent.click(control);
    view.rerender(<MusicDashboard data={{ ...base, playlists: [{ ...playlist, isVisibleToGuests: true }], refetch: vi.fn(async () => undefined) }} scope={scope} complete />);
    await act(async () => visibility.reject(new Error("write rejected")));

    expect(control).toHaveAttribute("aria-checked", "true");
    expect(control).toBeEnabled();
  });

  it("closes an acknowledged delete dialog and offers playlist reconciliation when refetch fails", async () => {
    const playlist = { id: 1, name: "Road songs", description: null, isVisibleToGuests: false, songs: [] };
    vi.spyOn(musicWorkspaceClient, "deletePlaylist").mockResolvedValue(undefined);
    const refetch = vi.fn().mockResolvedValue({ data: { playlists: [playlist] }, error: new Error("refresh failed") });
    render(<MusicDashboard data={{ ...base, playlists: [playlist], refetch }} scope={scope} complete />);
    await openPlaylist("Road songs");

    await userEvent.click(screen.getByRole("button", { name: "Delete playlist Road songs" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm playlist deletion" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Delete Road songs" })).not.toBeInTheDocument());
    expect(screen.getByRole("alert", { name: "Playlist reconciliation needed" })).toHaveTextContent("Playlist was deleted, but the latest playlists could not be loaded.");
  });

  it("closes an acknowledged queue replacement dialog and reports stale playlist data", async () => {
    const playlist = { id: 1, name: "Road songs", description: null, isVisibleToGuests: false, songs: [{ id: 11, playlistId: 1, youtubeId: "abcdefghijk", title: "First", artist: "A", thumbnailUrl: "https://img/1", position: 0, addedAt: "2026-08-25T10:00:00.000Z" }] };
    vi.spyOn(musicApi, "request").mockResolvedValue(new Response(JSON.stringify({ version: "music-queue/v1", revision: 2, songs: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    const refetch = vi.fn().mockResolvedValue({ data: { playlists: [playlist] }, error: new Error("refresh failed") });
    render(<MusicDashboard data={{ ...base, playlists: [playlist], refetch, dashboard: { ...base.dashboard, queueRevision: 1 } }} scope={scope} complete />);
    await openPlaylist("Road songs");

    await userEvent.click(screen.getByRole("button", { name: "Queue actions for Road songs" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Replace queue" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm queue replacement" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Replace active queue" })).not.toBeInTheDocument());
    expect(screen.getByRole("alert", { name: "Playlist reconciliation needed" })).toHaveTextContent("Queue was replaced, but the latest Music workspace could not be loaded.");
  });

  it("keeps an acknowledged Search queue add when TanStack resolves a refresh error with cached data", async () => {
    const found = { id: 8, youtubeId: "lmnopqrstuv", title: "Search song", artist: "Search artist", thumbnailUrl: "https://img/8", position: 0, status: "queued" as const, playedAt: null };
    vi.spyOn(musicApi, "request").mockImplementation((request) => {
      if (request.path === "/api/youtube/search") {
        return Promise.resolve(new Response(JSON.stringify({
          items: [{ id: { videoId: found.youtubeId }, snippet: { title: found.title, channelTitle: found.artist, thumbnails: { default: { url: found.thumbnailUrl } } } }],
          nextPageToken: null,
        }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (request.path === "/api/playlist/songs") {
        return Promise.resolve(new Response(JSON.stringify(found), { status: 201, headers: { "content-type": "application/json" } }));
      }
      throw new Error(`Unexpected request ${request.path}`);
    });
    const refetch = vi.fn().mockResolvedValue({ data: { dashboard: base.dashboard }, error: new Error("refresh failed") });
    render(<MusicDashboard data={{ ...base, refetch }} scope={scope} complete />);
    await openLive();

    await userEvent.type(screen.getByRole("searchbox", { name: "Search music or paste a URL" }), "search song");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: "Select Search song" }));
    await userEvent.click(screen.getByRole("button", { name: "Add 1 selected to queue" }));

    expect(await screen.findByRole("alert", { name: "Queue update error" })).toHaveTextContent("Song was added, but the latest queue could not be loaded.");
    expect(screen.getByRole("checkbox", { name: "Select Search song" })).not.toBeChecked();
  });

  it("carries an acknowledged queue Play command into the canonical player render", async () => {
    const queued = { id: 7, youtubeId: "abcdefghijk", title: "First song", artist: "Artist", thumbnailUrl: "https://img/7", position: 0, status: "queued" as const, playedAt: null };
    const playing = { ...queued, status: "playing" as const };
    vi.spyOn(musicApi, "request").mockResolvedValue(playbackResponse(2, playing));
    const data = { ...base, refetch: vi.fn(async () => undefined), dashboard: { ...base.dashboard, queueRevision: 1, songs: [queued], currentlyPlaying: null } };
    const view = render(<MusicDashboard data={data} scope={scope} complete />);
    await openLive();

    await userEvent.click(screen.getByRole("button", { name: "Play First song" }));
    await waitFor(() => expect(data.refetch).toHaveBeenCalledOnce());
    view.rerender(<MusicDashboard data={{ ...data, dashboard: { ...data.dashboard, songs: [], currentlyPlaying: playing } }} scope={scope} complete />);

    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("retries the latest playback intent against the canonical revision after an unrelated queue change", async () => {
    const queued = { id: 7, youtubeId: "abcdefghijk", title: "Recover song", artist: "Artist", thumbnailUrl: "https://img/7", position: 0, status: "queued" as const, playedAt: null };
    const expectedRevisions: number[] = [];
    let writes = 0;
    vi.spyOn(musicApi, "request").mockImplementation((request) => {
      if (request.path === "/api/music/dashboard") return Promise.resolve(new Response(JSON.stringify({
        queueRevision: 2, songs: [queued], currentlyPlaying: null, playedSongs: [], publication: { mode: "private", publicSlug: "public-slug-123" },
      }), { status: 200, headers: { "content-type": "application/json" } }));
      if (request.path !== "/api/playlist/currently-playing") throw new Error(`Unexpected request ${request.path}`);
      expectedRevisions.push((request.body as { expectedRevision: number }).expectedRevision);
      writes += 1;
      if (writes === 1) return Promise.resolve(new Response(JSON.stringify({
        version: "music-error/v1", error: { code: "PLAYBACK_REVISION_CONFLICT", message: "stale", action: "none", retryable: false, requestId: "revision-conflict" },
      }), { status: 409, headers: { "content-type": "application/json", "x-request-id": "revision-conflict" } }));
      return Promise.resolve(playbackResponse(3, { ...queued, status: "playing" }));
    });
    const data = { ...base, refetch: vi.fn(async () => undefined), dashboard: { ...base.dashboard, queueRevision: 1, songs: [queued], currentlyPlaying: null } };
    render(<MusicDashboard data={data} scope={scope} complete />);
    await openLive();

    await userEvent.click(screen.getByRole("button", { name: "Play Recover song" }));
    await waitFor(() => expect(expectedRevisions).toEqual([1, 2]));
    await waitFor(() => expect(data.refetch).toHaveBeenCalledOnce());
  });

  it("does not let a delayed Queue Play supersede a newer Search Play", async () => {
    const queueSong = { id: 7, youtubeId: "abcdefghijk", title: "Queue song", artist: "Queue artist", thumbnailUrl: "https://img/7", position: 0, status: "queued" as const, playedAt: null };
    const searchSong = { id: 8, youtubeId: "lmnopqrstuv", title: "Search song", artist: "Search artist", thumbnailUrl: "https://img/8", position: 1, status: "queued" as const, playedAt: null };
    const queueWrite = deferred<Response>();
    const searchWrite = deferred<Response>();
    const requestedSongIds: number[] = [];
    vi.spyOn(musicApi, "request").mockImplementation((request) => {
      const body = request.body as { songId?: number } | undefined;
      if (request.path === "/api/youtube/search") return Promise.resolve(new Response(JSON.stringify({ items: [{ id: { videoId: searchSong.youtubeId }, snippet: { title: searchSong.title, channelTitle: searchSong.artist, thumbnails: { default: { url: searchSong.thumbnailUrl } } } }], nextPageToken: null }), { status: 200, headers: { "content-type": "application/json" } }));
      if (request.path === "/api/playlist/songs") return Promise.resolve(new Response(JSON.stringify(searchSong), { status: 200, headers: { "content-type": "application/json" } }));
      if (request.path === "/api/playlist/currently-playing") requestedSongIds.push(body?.songId ?? -1);
      if (request.path === "/api/playlist/currently-playing" && body?.songId === queueSong.id) return queueWrite.promise;
      if (request.path === "/api/playlist/currently-playing" && body?.songId === searchSong.id) return searchWrite.promise;
      throw new Error(`Unexpected request ${request.path}`);
    });
    const data = { ...base, refetch: vi.fn(async () => undefined), dashboard: { ...base.dashboard, queueRevision: 1, songs: [queueSong], currentlyPlaying: null } };
    const view = render(<MusicDashboard data={data} scope={scope} complete />);
    await openLive();

    await userEvent.click(screen.getByRole("button", { name: "Play Queue song" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search music or paste a URL" }), "newer");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("button", { name: "Play Search song now" }));
    expect(requestedSongIds).toEqual([queueSong.id]);
    queueWrite.resolve(playbackResponse(2, { ...queueSong, status: "playing" }));
    await waitFor(() => expect(requestedSongIds).toEqual([queueSong.id, searchSong.id]));
    expect(data.refetch).not.toHaveBeenCalled();
    searchWrite.resolve(playbackResponse(3, { ...searchSong, status: "playing" }));
    await waitFor(() => expect(data.refetch).toHaveBeenCalledTimes(1));

    view.rerender(<MusicDashboard data={{ ...data, dashboard: { ...data.dashboard, songs: [], currentlyPlaying: { ...searchSong, status: "playing" } } }} scope={scope} complete />);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("does not let a delayed Queue Play supersede a newer History Play", async () => {
    const queueSong = { id: 7, youtubeId: "abcdefghijk", title: "Queue song", artist: "Queue artist", thumbnailUrl: "https://img/7", position: 0, status: "queued" as const, playedAt: null };
    const historySong = { id: 9, youtubeId: "zyxwvutsrqp", title: "History song", artist: "History artist", thumbnailUrl: "https://img/9", position: 0, status: "played" as const, playedAt: "2026-08-27T00:00:00.000Z" };
    const queueWrite = deferred<Response>();
    const historyWrite = deferred<Response>();
    const requestedSongIds: number[] = [];
    vi.spyOn(musicApi, "request").mockImplementation((request) => {
      const body = request.body as { songId?: number } | undefined;
      if (request.path === "/api/playlist/currently-playing") requestedSongIds.push(body?.songId ?? -1);
      if (request.path === "/api/playlist/currently-playing" && body?.songId === queueSong.id) return queueWrite.promise;
      if (request.path === "/api/playlist/currently-playing" && body?.songId === historySong.id) return historyWrite.promise;
      throw new Error(`Unexpected request ${request.path}`);
    });
    const data = { ...base, refetch: vi.fn(async () => undefined), dashboard: { ...base.dashboard, queueRevision: 1, songs: [queueSong], currentlyPlaying: null, playedSongs: [historySong] } };
    const view = render(<MusicDashboard data={data} scope={scope} complete />);
    await openLive();

    await userEvent.click(screen.getByRole("button", { name: "Play Queue song" }));
    await userEvent.click(screen.getByRole("button", { name: "More actions for History song" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Play again" }));
    expect(requestedSongIds).toEqual([queueSong.id]);
    queueWrite.resolve(playbackResponse(2, { ...queueSong, status: "playing" }));
    await waitFor(() => expect(requestedSongIds).toEqual([queueSong.id, historySong.id]));
    expect(data.refetch).not.toHaveBeenCalled();
    historyWrite.resolve(playbackResponse(3, { ...historySong, status: "playing", playedAt: null }));
    await waitFor(() => expect(data.refetch).toHaveBeenCalledTimes(1));

    view.rerender(<MusicDashboard data={{ ...data, dashboard: { ...data.dashboard, songs: [], currentlyPlaying: { ...historySong, status: "playing", playedAt: null } } }} scope={scope} complete />);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("times out and aborts a hung Play so the newest request can become canonical", async () => {
    vi.useFakeTimers();
    const queueSong = { id: 7, youtubeId: "abcdefghijk", title: "Hung queue song", artist: "Queue artist", thumbnailUrl: "https://img/7", position: 0, status: "queued" as const, playedAt: null };
    const historySong = { id: 9, youtubeId: "zyxwvutsrqp", title: "Newest history song", artist: "History artist", thumbnailUrl: "https://img/9", position: 0, status: "played" as const, playedAt: "2026-08-27T00:00:00.000Z" };
    let hungSignal: AbortSignal | undefined;
    const requestedSongIds: Array<number | null> = [];
    const requestedRevisions: number[] = [];
    vi.spyOn(musicApi, "request").mockImplementation((request) => {
      const body = request.body as { songId?: number | null; expectedRevision?: number } | undefined;
      if (request.path !== "/api/playlist/currently-playing") throw new Error(`Unexpected request ${request.path}`);
      requestedSongIds.push(body?.songId ?? null);
      requestedRevisions.push(body?.expectedRevision ?? -1);
      if (body?.songId === queueSong.id) {
        hungSignal = request.signal;
        return new Promise<Response>(() => undefined);
      }
      return Promise.resolve(playbackResponse(2, { ...historySong, status: "playing", playedAt: null }));
    });
    const data = { ...base, refetch: vi.fn(async () => undefined), dashboard: { ...base.dashboard, queueRevision: 1, songs: [queueSong], currentlyPlaying: null, playedSongs: [historySong] } };
    render(<MusicDashboard data={data} scope={scope} complete />);
    fireEvent.click(screen.getByRole("tab", { name: "Live" }));

    fireEvent.click(screen.getByRole("button", { name: "Play Hung queue song" }));
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "More actions for Newest history song" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Play again" }));
    expect(requestedSongIds).toEqual([queueSong.id]);

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });

    expect(hungSignal?.aborted).toBe(true);
    expect(requestedSongIds).toEqual([queueSong.id, historySong.id]);
    expect(requestedRevisions).toEqual([1, 1]);
    expect(data.refetch).toHaveBeenCalledOnce();
  });

  it("aborts old-scope playback and lets the new authority start without waiting", async () => {
    const oldSong = { id: 7, youtubeId: "abcdefghijk", title: "Old account song", artist: "Old artist", thumbnailUrl: "https://img/7", position: 0, status: "queued" as const, playedAt: null };
    const newSong = { id: 8, youtubeId: "lmnopqrstuv", title: "New account song", artist: "New artist", thumbnailUrl: "https://img/8", position: 0, status: "queued" as const, playedAt: null };
    let oldSignal: AbortSignal | undefined;
    const oldWrite = deferred<Response>();
    const requestedSongIds: Array<number | null> = [];
    vi.spyOn(musicApi, "request").mockImplementation((request) => {
      const body = request.body as { songId?: number | null } | undefined;
      if (request.path !== "/api/playlist/currently-playing") throw new Error(`Unexpected request ${request.path}`);
      requestedSongIds.push(body?.songId ?? null);
      if (body?.songId === oldSong.id) { oldSignal = request.signal; return oldWrite.promise; }
      return Promise.resolve(playbackResponse(2, { ...newSong, status: "playing" }));
    });
    const oldData = { ...base, refetch: vi.fn(async () => undefined), dashboard: { ...base.dashboard, queueRevision: 1, songs: [oldSong], currentlyPlaying: null } };
    const newData = { ...base, refetch: vi.fn(async () => undefined), dashboard: { ...base.dashboard, queueRevision: 1, songs: [newSong], currentlyPlaying: null } };
    const view = render(<MusicDashboard data={oldData} scope={scope} complete />);
    await openLive();
    fireEvent.click(screen.getByRole("button", { name: "Play Old account song" }));
    await act(async () => { await Promise.resolve(); });

    view.rerender(<MusicDashboard data={newData} scope={{ userDocumentId: "explorer-user-b", accountDocumentId: "explorer-account-b" }} complete />);
    await waitFor(() => expect(oldSignal?.aborted).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Play New account song" }));
    await waitFor(() => expect(requestedSongIds).toEqual([oldSong.id, newSong.id]));
    expect(newData.refetch).toHaveBeenCalledOnce();

    oldWrite.resolve(playbackResponse(2, { ...oldSong, status: "playing" }));
    await Promise.resolve();
    expect(oldData.refetch).not.toHaveBeenCalled();
  });

  it("aborts in-flight playback on unmount and suppresses its late acknowledgement", async () => {
    const song = { id: 7, youtubeId: "abcdefghijk", title: "Unmounted song", artist: "Artist", thumbnailUrl: "https://img/7", position: 0, status: "queued" as const, playedAt: null };
    const write = deferred<Response>();
    let signal: AbortSignal | undefined;
    vi.spyOn(musicApi, "request").mockImplementation((request) => {
      signal = request.signal;
      return write.promise;
    });
    const data = { ...base, refetch: vi.fn(async () => undefined), dashboard: { ...base.dashboard, queueRevision: 1, songs: [song], currentlyPlaying: null } };
    const view = render(<MusicDashboard data={data} scope={scope} complete />);
    await openLive();
    fireEvent.click(screen.getByRole("button", { name: "Play Unmounted song" }));
    await act(async () => { await Promise.resolve(); });

    view.unmount();

    expect(signal?.aborted).toBe(true);
    write.resolve(new Response(JSON.stringify({ ...song, status: "playing" }), { status: 200, headers: { "content-type": "application/json" } }));
    await Promise.resolve();
    expect(data.refetch).not.toHaveBeenCalled();
  });

  it("exposes saved-playlist recovery and atomic queue replacement actions", async () => {
    const playlist = {
      id: 1, name: "Saved mix", description: null, isVisibleToGuests: false,
      songs: [{ id: 11, playlistId: 1, youtubeId: "abcdefghijk", title: "A", artist: "B", thumbnailUrl: "https://img", position: 0, addedAt: "2026-08-25T10:00:00.000Z" }],
    };
    const remove = vi.spyOn(musicWorkspaceClient, "removePlaylistSong").mockResolvedValue(undefined);
    const removePlaylist = vi.spyOn(musicWorkspaceClient, "deletePlaylist").mockResolvedValue(undefined);
    const request = vi.spyOn(musicApi, "request").mockResolvedValue(new Response(JSON.stringify({
      version: "music-queue/v1", revision: 8, songs: [],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const data = { ...base, playlists: [playlist], dashboard: { ...base.dashboard, queueRevision: 7 }, refetch: vi.fn(async () => undefined) };
    render(<MusicDashboard data={data} scope={scope} complete />);

    await openPlaylist("Saved mix");
    await userEvent.click(screen.getByRole("button", { name: "Queue actions for Saved mix" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Replace queue" }));
    expect(screen.getByRole("dialog", { name: "Replace active queue" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm queue replacement" }));
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST", path: "/api/music/queue/replace",
      body: { expectedRevision: 7, songs: [{ playlistId: 1, songId: 11 }] },
    }));
    await userEvent.click(screen.getByRole("button", { name: "Remove A from Saved mix" }));
    expect(remove).toHaveBeenCalledWith(1, 11, expect.stringMatching(/^playlist-song-remove-/));
    await userEvent.click(screen.getByRole("button", { name: "Delete playlist Saved mix" }));
    expect(screen.getByRole("dialog", { name: "Delete Saved mix" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm playlist deletion" }));
    expect(removePlaylist).toHaveBeenCalledWith(1, expect.stringMatching(/^playlist-delete-/));
  });

  it("reuses the queue replacement key and refreshes after an uncertain failure", async () => {
    const playlist = {
      id: 1, name: "Saved mix", description: null, isVisibleToGuests: false,
      songs: [{ id: 11, playlistId: 1, youtubeId: "abcdefghijk", title: "A", artist: "B", thumbnailUrl: "https://img", position: 0, addedAt: "2026-08-25T10:00:00.000Z" }],
    };
    const request = vi.spyOn(musicApi, "request")
      .mockRejectedValueOnce(new TypeError("response lost"))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        version: "music-queue/v1", revision: 8, songs: [],
      }), { status: 200, headers: { "content-type": "application/json" } }));
    const refetch = vi.fn(async () => undefined);
    render(<MusicDashboard data={{ ...base, playlists: [playlist], dashboard: { ...base.dashboard, queueRevision: 7 }, refetch }} scope={scope} complete />);

    await openPlaylist("Saved mix");
    await userEvent.click(screen.getByRole("button", { name: "Queue actions for Saved mix" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Replace queue" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm queue replacement" }));
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "Confirm queue replacement" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));

    expect(request.mock.calls[0][0].idempotencyKey).toBe(request.mock.calls[1][0].idempotencyKey);
  });

  it("retries an ambiguous playlist append with its original key and payload after reconciliation changes the revision", async () => {
    // Break caught: a refreshed revision turns a lost-response retry into a second append.
    const playlist = { id: 1, name: "Saved mix", description: null, isVisibleToGuests: false, songs: [{ id: 11, playlistId: 1, youtubeId: "abcdefghijk", title: "A", artist: "B", thumbnailUrl: "https://img", position: 0, addedAt: "2026-08-25T10:00:00.000Z" }] };
    const request = vi.spyOn(musicApi, "request")
      .mockRejectedValueOnce(new TypeError("response lost"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: "music-queue/v1", revision: 8, songs: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    const view = render(<MusicDashboard data={{ ...base, playlists: [playlist], dashboard: { ...base.dashboard, queueRevision: 7 }, refetch: vi.fn(async () => undefined) }} scope={scope} complete />);
    await openPlaylist("Saved mix");
    await userEvent.click(screen.getByRole("button", { name: "Queue actions for Saved mix" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Add to queue" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    view.rerender(<MusicDashboard data={{ ...base, playlists: [playlist], dashboard: { ...base.dashboard, queueRevision: 99 }, refetch: vi.fn(async () => undefined) }} scope={scope} complete />);
    await userEvent.click(screen.getByRole("button", { name: "Queue actions for Saved mix" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Add to queue" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));

    expect(request.mock.calls[0][0]).toMatchObject({ path: "/api/music/queue/append", body: { expectedRevision: 7, songs: [{ playlistId: 1, songId: 11 }] } });
    expect(request.mock.calls[1][0]).toMatchObject({ path: "/api/music/queue/append", body: { expectedRevision: 7, songs: [{ playlistId: 1, songId: 11 }] } });
    expect(request.mock.calls[1][0].idempotencyKey).toBe(request.mock.calls[0][0].idempotencyKey);
  });

  it("starts a fresh append after a definite queue revision conflict", async () => {
    const playlist = { id: 1, name: "Saved mix", description: null, isVisibleToGuests: false, songs: [{ id: 11, playlistId: 1, youtubeId: "abcdefghijk", title: "A", artist: "B", thumbnailUrl: "https://img", position: 0, addedAt: "2026-08-25T10:00:00.000Z" }] };
    const request = vi.spyOn(musicApi, "request")
      .mockRejectedValueOnce(new MusicClientError("REQUEST_INVALID", 409, "stale", undefined, "QUEUE_REVISION_CONFLICT"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: "music-queue/v1", revision: 10, songs: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    const view = render(<MusicDashboard data={{ ...base, playlists: [playlist], dashboard: { ...base.dashboard, queueRevision: 7 }, refetch: vi.fn(async () => undefined) }} scope={scope} complete />);
    await openPlaylist("Saved mix");
    await userEvent.click(screen.getByRole("button", { name: "Queue actions for Saved mix" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Add to queue" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    view.rerender(<MusicDashboard data={{ ...base, playlists: [playlist], dashboard: { ...base.dashboard, queueRevision: 9 }, refetch: vi.fn(async () => undefined) }} scope={scope} complete />);
    await userEvent.click(screen.getByRole("button", { name: "Queue actions for Saved mix" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Add to queue" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request.mock.calls[1][0].body).toMatchObject({ expectedRevision: 9 });
    expect(request.mock.calls[1][0].idempotencyKey).not.toBe(request.mock.calls[0][0].idempotencyKey);
  });

  it("retries the exact persisted shuffle order and uses a distinct operation key from replace", async () => {
    // Break caught: a shuffle regenerated ordering or accidentally replayed a prior replace operation.
    const songs = [
      { id: 11, playlistId: 1, youtubeId: "abcdefghijk", title: "A", artist: "B", thumbnailUrl: "https://img/1", position: 0, addedAt: "2026-08-25T10:00:00.000Z" },
      { id: 12, playlistId: 1, youtubeId: "lmnopqrstuv", title: "C", artist: "D", thumbnailUrl: "https://img/2", position: 1, addedAt: "2026-08-25T10:01:00.000Z" },
    ];
    const playlist = { id: 1, name: "Saved mix", description: null, isVisibleToGuests: false, songs };
    const request = vi.spyOn(musicApi, "request")
      .mockRejectedValueOnce(new TypeError("replace response lost"))
      .mockRejectedValueOnce(new TypeError("shuffle response lost"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: "music-queue/v1", revision: 8, songs: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    render(<MusicDashboard data={{ ...base, playlists: [playlist], dashboard: { ...base.dashboard, queueRevision: 7 }, refetch: vi.fn(async () => undefined) }} scope={scope} complete />);
    await openPlaylist("Saved mix");
    await userEvent.click(screen.getByRole("button", { name: "Queue actions for Saved mix" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Replace queue" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm queue replacement" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Queue actions for Saved mix" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Shuffle and play" }));
    await userEvent.click(screen.getByRole("button", { name: "Shuffle and play" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await userEvent.click(screen.getByRole("button", { name: "Shuffle and play" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3));

    expect(request.mock.calls[1][0].idempotencyKey).not.toBe(request.mock.calls[0][0].idempotencyKey);
    expect(request.mock.calls[2][0].idempotencyKey).toBe(request.mock.calls[1][0].idempotencyKey);
    expect(request.mock.calls[2][0].body).toEqual(request.mock.calls[1][0].body);
  });

  it("seeds playback with the acknowledged replacement revision and retries playback without replacing again", async () => {
    // Break caught: normal replace spent a stale-conflict retry, or retry playback replaced the queue twice.
    const playlist = { id: 1, name: "Saved mix", description: null, isVisibleToGuests: false, songs: [{ id: 11, playlistId: 1, youtubeId: "abcdefghijk", title: "A", artist: "B", thumbnailUrl: "https://img", position: 0, addedAt: "2026-08-25T10:00:00.000Z" }] };
    const queuedSong = { id: 101, youtubeId: "abcdefghijk", title: "A", artist: "B", thumbnailUrl: "https://img", position: 0, status: "queued", playedAt: null };
    const playingSong = { ...queuedSong, status: "playing" };
    const request = vi.spyOn(musicApi, "request").mockImplementation((input) => {
      if (input.path === "/api/music/queue/replace") return Promise.resolve(new Response(JSON.stringify({ version: "music-queue/v1", revision: 23, songs: [queuedSong] }), { status: 200, headers: { "content-type": "application/json" } }));
      if (input.path === "/api/playlist/currently-playing") {
        const playbackCalls = request.mock.calls.filter(([call]) => call.path === "/api/playlist/currently-playing").length;
        if (playbackCalls === 1) return Promise.reject(new TypeError("playback response lost"));
        return Promise.resolve(playbackResponse(24, playingSong));
      }
      throw new Error(`Unexpected request ${input.path}`);
    });
    render(<MusicDashboard data={{ ...base, playlists: [playlist], dashboard: { ...base.dashboard, queueRevision: 7 }, refetch: vi.fn(async () => undefined) }} scope={scope} complete />);
    await openPlaylist("Saved mix");
    await userEvent.click(screen.getByRole("button", { name: "Queue actions for Saved mix" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Replace queue" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm queue replacement" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry playback" })).toBeInTheDocument());
    const firstPlayback = request.mock.calls.find(([call]) => call.path === "/api/playlist/currently-playing")![0];
    expect((firstPlayback.body as { expectedRevision: number }).expectedRevision).toBe(23);

    await userEvent.click(screen.getByRole("button", { name: "Retry playback" }));
    await waitFor(() => expect(request.mock.calls.filter(([call]) => call.path === "/api/playlist/currently-playing")).toHaveLength(2));
    expect(request.mock.calls.filter(([call]) => call.path === "/api/music/queue/replace")).toHaveLength(1);
  });

  it("starts a new queue replacement operation after switching playlists", async () => {
    const song = (id: number, title: string) => ({ id, playlistId: id, youtubeId: "abcdefghijk", title, artist: "B", thumbnailUrl: "https://img", position: 0, addedAt: "2026-08-25T10:00:00.000Z" });
    const playlists = [
      { id: 1, name: "First mix", description: null, isVisibleToGuests: false, songs: [song(11, "A")] },
      { id: 2, name: "Second mix", description: null, isVisibleToGuests: false, songs: [song(22, "C")] },
    ];
    const request = vi.spyOn(musicApi, "request")
      .mockRejectedValueOnce(new TypeError("response lost"))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        version: "music-queue/v1", revision: 8, songs: [],
      }), { status: 200, headers: { "content-type": "application/json" } }));
    const refetch = vi.fn(async () => undefined);
    render(<MusicDashboard data={{ ...base, playlists, dashboard: { ...base.dashboard, queueRevision: 7 }, refetch }} scope={scope} complete />);

    await openPlaylist("First mix");
    await userEvent.click(screen.getByRole("button", { name: "Queue actions for First mix" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Replace queue" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm queue replacement" }));
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: /All playlists/ }));
    await openPlaylist("Second mix");
    await userEvent.click(screen.getByRole("button", { name: "Queue actions for Second mix" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Replace queue" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirm queue replacement" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));

    expect(request.mock.calls[1][0]).toMatchObject({ body: { expectedRevision: 7, songs: [{ playlistId: 2, songId: 22 }] } });
    expect(request.mock.calls[1][0].idempotencyKey).not.toBe(request.mock.calls[0][0].idempotencyKey);
  });
  it("renders the approved ready-empty hierarchy with one primary action", async () => {
    render(<MusicDashboard data={base} scope={scope} />);
    expect(screen.getByRole("heading", { name: "Create your first playlist" })).toBeInTheDocument();
    expect(screen.getByText("Build a playlist to collect and share the music you love.")).toBeInTheDocument();
    const action = screen.getByRole("button", { name: "New playlist" });
    expect(action.className).toContain("min-h-11");
    await userEvent.click(action);
    expect(screen.getByRole("dialog", { name: "Create playlist" })).toBeInTheDocument();
    expect(screen.getByLabelText("Playlist name")).toHaveFocus();
  });

  it("filters the collection and opens an accessible playlist detail", async () => {
    const playlists = [
      { id: 1, name: "One", description: null, isVisibleToGuests: false, songs: [{ id: 11, title: "A", artist: "B", thumbnailUrl: "x", position: 0 }] },
      { id: 2, name: "Two", description: null, isVisibleToGuests: false, songs: [] },
    ];
    render(<MusicDashboard data={{ ...base, playlists }} scope={scope} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search playlists" }), "One");
    expect(screen.getByRole("button", { name: /^One/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Two/ })).not.toBeInTheDocument();
    await openPlaylist("One");
    expect(screen.getByLabelText("Move A down")).toHaveClass("min-h-11", "min-w-11");
  });

  it("offers only Private, Unlisted, and Public with mode-specific copy under Music", async () => {
    render(<MusicDashboard data={base} scope={scope} />);
    await openSharingSettings();
    expect(screen.getByRole("dialog", { name: "Music sharing" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual(["private", "unlisted", "public"]);
    expect(screen.getByText("Only you can open this Music workspace.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Unlisted" }));
    expect(screen.getByText("Anyone with the private link can view shared playlists. The page won’t appear in search.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save sharing" })).toHaveClass("min-h-11");
  });

  it("closes dialogs with Escape and returns focus to the opener", async () => {
    render(<MusicDashboard data={base} scope={scope} />);
    const opener = await openSharingSettings();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("returns focus through Cancel and successful create while keeping failed/retry focus inside", async () => {
    const create = vi.spyOn(musicWorkspaceClient, "createPlaylist")
      .mockRejectedValueOnce(new Error("contained"))
      .mockResolvedValueOnce({ id: 9, name: "Roads", description: null, isVisibleToGuests: false, songs: [] });
    const data = { ...base, refetch: vi.fn(async () => undefined) };
    render(<MusicDashboard data={data} scope={scope} />);
    const opener = screen.getByRole("button", { name: "New playlist" });
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(opener).toHaveFocus();

    await userEvent.click(opener);
    await userEvent.type(screen.getByLabelText("Playlist name"), "Roads");
    const submit = screen.getByRole("dialog", { name: "Create playlist" }).querySelector<HTMLButtonElement>("button[type='submit']")!;
    await userEvent.click(submit);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("dialog", { name: "Create playlist" })).toBeInTheDocument();
    expect(submit).toHaveFocus();
    await userEvent.click(submit);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Create playlist" })).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it("retries only public visibility after playlist creation was acknowledged", async () => {
    // Break caught: retrying a failed second phase creates a duplicate playlist instead of sharing the acknowledged one.
    const created = { id: 91, name: "Public roads", description: null, isVisibleToGuests: false, songs: [] };
    const create = vi.spyOn(musicWorkspaceClient, "createPlaylist").mockResolvedValue(created);
    const visibility = vi.spyOn(musicWorkspaceClient, "setPlaylistVisibility")
      .mockRejectedValueOnce(new Error("visibility unavailable"))
      .mockResolvedValueOnce(undefined);
    render(<MusicDashboard data={{ ...base, refetch: vi.fn(async () => undefined) }} scope={scope} />);

    await userEvent.click(screen.getByRole("button", { name: "Open playlist and sharing menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Public playlist" }));
    await userEvent.type(screen.getByLabelText("Playlist name"), "Public roads");
    await userEvent.click(screen.getByRole("button", { name: "Create playlist" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Playlist was created, but sharing failed");
    expect(screen.getByRole("button", { name: "Retry sharing" })).toBeInTheDocument();
    expect(create).toHaveBeenCalledOnce();
    expect(visibility).toHaveBeenCalledWith(91, true, expect.stringMatching(/^playlist-visibility-/));

    await userEvent.click(screen.getByRole("button", { name: "Retry sharing" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Create playlist" })).not.toBeInTheDocument());
    expect(create).toHaveBeenCalledOnce();
    expect(visibility).toHaveBeenCalledTimes(2);
    expect(visibility.mock.calls[1][0]).toBe(91);
  });

  it("locks public creation across duplicate submit, Escape, and backdrop until both phases settle", async () => {
    // Break caught: closing or submitting during the create/visibility boundary loses the acknowledged ID and permits duplicates.
    const createCommand = deferred<{ id: number; name: string; description: null; isVisibleToGuests: boolean; songs: never[] }>();
    const visibilityCommand = deferred<void>();
    const create = vi.spyOn(musicWorkspaceClient, "createPlaylist").mockReturnValue(createCommand.promise);
    const visibility = vi.spyOn(musicWorkspaceClient, "setPlaylistVisibility").mockReturnValue(visibilityCommand.promise);
    render(<MusicDashboard data={{ ...base, refetch: vi.fn(async () => undefined) }} scope={scope} />);
    await userEvent.click(screen.getByRole("button", { name: "Open playlist and sharing menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Public playlist" }));
    await userEvent.type(screen.getByLabelText("Playlist name"), "Locked public");
    const dialog = screen.getByRole("dialog", { name: "Create playlist" });
    const form = dialog.querySelector("form")!;

    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    expect(create).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog", { name: "Create playlist" })).toBeInTheDocument();

    await act(async () => createCommand.resolve({ id: 92, name: "Locked public", description: null, isVisibleToGuests: false, songs: [] }));
    await waitFor(() => expect(visibility).toHaveBeenCalledOnce());
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.getByRole("dialog", { name: "Create playlist" })).toBeInTheDocument();
    expect(create).toHaveBeenCalledOnce();

    await act(async () => visibilityCommand.resolve());
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Create playlist" })).not.toBeInTheDocument());
    expect(create).toHaveBeenCalledOnce();
    expect(visibility).toHaveBeenCalledOnce();
  });

  it("reuses the create idempotency key after an ambiguous lost response", async () => {
    // Break caught: retry after a lost create response generates a fresh key and can persist a duplicate.
    const created = { id: 93, name: "Recovered create", description: null, isVisibleToGuests: false, songs: [] };
    const create = vi.spyOn(musicWorkspaceClient, "createPlaylist")
      .mockRejectedValueOnce(new Error("response lost after commit"))
      .mockResolvedValueOnce(created);
    render(<MusicDashboard data={{ ...base, refetch: vi.fn(async () => undefined) }} scope={scope} />);
    await userEvent.click(screen.getByRole("button", { name: "New playlist" }));
    await userEvent.type(screen.getByLabelText("Playlist name"), "Recovered create");

    await userEvent.click(screen.getByRole("button", { name: "Create playlist" }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    await userEvent.click(screen.getByRole("button", { name: "Create playlist" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Create playlist" })).not.toBeInTheDocument());

    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][2]).toBe(create.mock.calls[0][2]);
  });

  it("centralizes sharing Cancel, failure, retry-success, and focus restoration", async () => {
    const publish = vi.spyOn(musicWorkspaceClient, "setPublication")
      .mockRejectedValueOnce(new Error("contained"))
      .mockResolvedValueOnce({ version: "music-publication/v1", publication: { mode: "public", publicSlug: "public-slug-123" } });
    const data = { ...base, refetch: vi.fn(async () => undefined) };
    render(<MusicDashboard data={data} scope={scope} />);
    const opener = await openSharingSettings();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(opener).toHaveFocus();

    await openSharingSettings();
    await userEvent.click(screen.getByRole("radio", { name: "Public" }));
    const save = screen.getByRole("button", { name: "Save sharing" });
    await userEvent.click(save);
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("dialog", { name: "Music sharing" })).toBeInTheDocument();
    expect(save).toHaveFocus();
    await userEvent.click(save);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Music sharing" })).not.toBeInTheDocument());
    expect(publish.mock.calls[0][0]).toBe("public");
    expect(publish.mock.calls[0][1]).toMatch(/^tunes-share-v1-\d{13}-[0-9a-f-]{36}$/);
    expect(publish.mock.calls[1]).toEqual(publish.mock.calls[0]);
    expect(opener).toHaveFocus();
  });

  it.each(["Escape", "Cancel", "backdrop", "mode"] as const)("does not lose an in-flight sharing command through %s", async (closePath) => {
    const pending = deferred<{ version: "music-publication/v1"; publication: { mode: "public"; publicSlug: string } }>();
    vi.spyOn(musicWorkspaceClient, "setPublication").mockReturnValue(pending.promise);
    render(<MusicDashboard data={base} scope={scope} />);
    await openSharingSettings();
    await userEvent.click(screen.getByRole("radio", { name: "Public" }));
    await userEvent.click(screen.getByRole("button", { name: "Save sharing" }));
    const dialog = screen.getByRole("dialog", { name: "Music sharing" });

    if (closePath === "Escape") fireEvent.keyDown(dialog, { key: "Escape" });
    else if (closePath === "Cancel") await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    else if (closePath === "backdrop") fireEvent.mouseDown(dialog.parentElement!);
    else await userEvent.click(screen.getByRole("radio", { name: "Private" }));

    expect(screen.getByRole("dialog", { name: "Music sharing" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Public" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    pending.resolve({ version: "music-publication/v1", publication: { mode: "public", publicSlug: "public-slug-123" } });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Music sharing" })).not.toBeInTheDocument());
  });

  it("reuses an ambiguous command after dialog remount and mode toggles", async () => {
    let uuid = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `11111111-2222-4333-8444-${String(++uuid).padStart(12, "0")}` });
    const publish = vi.spyOn(musicWorkspaceClient, "setPublication")
      .mockRejectedValueOnce(new Error("malformed successful response"))
      .mockResolvedValueOnce({ version: "music-publication/v1", publication: { mode: "public", publicSlug: "public-slug-123" } });
    const first = render(<MusicDashboard data={base} scope={scope} />);
    await openSharingSettings();
    await userEvent.click(screen.getByRole("radio", { name: "Public" }));
    await userEvent.click(screen.getByRole("button", { name: "Save sharing" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("radio", { name: "Private" }));
    await userEvent.click(screen.getByRole("radio", { name: "Public" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    first.unmount();

    render(<MusicDashboard data={base} scope={scope} />);
    await openSharingSettings();
    await userEvent.click(screen.getByRole("radio", { name: "Public" }));
    await userEvent.click(screen.getByRole("button", { name: "Save sharing" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(2));
    expect(publish.mock.calls[1][1]).toBe(publish.mock.calls[0][1]);
  });

  it.each([
    new MusicClientError("REQUEST_INVALID", 400, "The publication command is invalid."),
    new MusicClientError(
      "AUTH_UNAVAILABLE",
      409,
      "The saved publication command has expired.",
      undefined,
      "PUBLICATION_REPLAY_EXPIRED",
      false,
    ),
  ])("retires a publication command rejected with terminal code $code/$upstreamCode", async (terminalError) => {
    let uuid = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `11111111-2222-4333-8444-${String(++uuid).padStart(12, "0")}` });
    const publish = vi.spyOn(musicWorkspaceClient, "setPublication")
      .mockRejectedValueOnce(terminalError)
      .mockResolvedValueOnce({ version: "music-publication/v1", publication: { mode: "public", publicSlug: "public-slug-123" } });

    render(<MusicDashboard data={base} scope={scope} />);
    await openSharingSettings();
    await userEvent.click(screen.getByRole("radio", { name: "Public" }));
    await userEvent.click(screen.getByRole("button", { name: "Save sharing" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "Save sharing" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(2));

    expect(publish.mock.calls[1][1]).not.toBe(publish.mock.calls[0][1]);
  });

  it("keeps recovery and sharing guidance at the approved body-size token", async () => {
    render(<MusicDashboard data={base} scope={scope} />);
    await openSharingSettings();
    await userEvent.click(screen.getByRole("radio", { name: "Unlisted" }));
    expect(screen.getByText("Save to create a new private link. Creating another link replaces the previous one.")).toHaveClass("text-base");
  });

  it("shows the canonical link and preview affordance for a public workspace", async () => {
    render(<MusicDashboard data={{ ...base, dashboard: { ...base.dashboard, publication: { mode: "public", publicSlug: "public-slug-123" } } }} scope={scope} />);
    await openSharingSettings();
    expect(screen.getByLabelText("Music share link")).toHaveValue(`${window.location.origin}/music/share/public-slug-123`);
    expect(screen.getByRole("link", { name: "Preview public Music page" })).toHaveAttribute("target", "_blank");
  });
});
