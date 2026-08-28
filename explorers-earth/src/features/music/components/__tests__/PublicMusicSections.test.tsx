import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { PublicMusicError, type PublicMusicResource, type PublicMusicSong } from "../../publicMusicClient";
import { PublicMusicSections } from "../PublicMusicSections";

const mediaRenders = vi.hoisted(() => [] as Array<{ src: string; playing: boolean }>);

vi.mock("react-player", async () => {
  const React = await import("react");
  return {
    default: React.forwardRef((props: Record<string, unknown>, ref) => {
      mediaRenders.push({ src: String(props.src), playing: Boolean(props.playing) });
      React.useImperativeHandle(ref, () => ({ play: async () => undefined, pause: () => undefined }));
      return <div data-testid="guest-media" data-playing={String(props.playing)} data-src={String(props.src)} />;
    }),
  };
});

const song = (
  id: string,
  title: string,
  status: PublicMusicSong["status"],
  position: number,
): PublicMusicSong => ({
  id: id.repeat(43),
  youtubeId: "abcdefghijk",
  title,
  artist: `${title} artist`,
  thumbnailUrl: `https://images.example/${id}.jpg`,
  position,
  status,
  playedAt: status === "played" ? "2026-08-28T10:00:00.000Z" : null,
});

const current = song("C", "Current signal", "playing", 0);
const queued = { ...song("Q", "Queue signal", "queued", 1), youtubeId: "lmnopqrstuv" };
const recent = song("H", "History signal", "played", 0);
const saved = song("S", "Playlist signal", "saved", 0);

function populatedResource(mask: number): PublicMusicResource {
  return {
    version: "music-public-resource/v1",
    revision: 7,
    user: { username: "listener", venueName: "Signal Room" },
    permissions: {
      allowSongRequests: Boolean(mask & 1),
      allowGuestPlayOnDevice: Boolean(mask & 2),
      allowPlaylistSharing: Boolean(mask & 4),
      allowRecentlyPlayedVisibility: Boolean(mask & 8),
      allowQueueVisibility: Boolean(mask & 16),
    },
    // Deliberately populate every protected field for every mask. The component
    // must remain fail-closed even if a compromised server returns denied data.
    currentlyPlaying: current,
    queue: { items: [queued], total: 3, truncated: true },
    recentlyPlayed: { items: [recent], total: 1, truncated: false },
    playlists: {
      items: [{
        id: "L".repeat(43),
        name: "Protected playlist signal",
        description: "Playlist description signal",
        songs: { items: [saved], total: 2, truncated: true },
      }],
      total: 2,
      truncated: true,
    },
  };
}

describe("PublicMusicSections permission oracle", () => {
  it("reconciles request revocation, unmounts stale controls, and restores contained focus", async () => {
    const onReconcile = vi.fn();
    const requestClient = { search: vi.fn().mockResolvedValue({ items: [{ id: { videoId: "abcdefghijk" }, snippet: { title: "Song", channelTitle: "Artist", thumbnails: { default: { url: "https://img.example/song.jpg" } } } }], nextPageToken: null }), videoFromUrl: vi.fn(), requestSong: vi.fn().mockRejectedValue(new PublicMusicError("PUBLIC_NOT_FOUND")) };
    render(<><h1 id="public-music-heading" tabIndex={-1}>Music</h1><button type="button">Outside</button><PublicMusicSections resource={populatedResource(1)} publicSlug="public-owner" onReconcile={onReconcile} requestClient={requestClient as never} /></>);
    await userEvent.type(screen.getByLabelText("Search for a song or paste a YouTube URL"), "song");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("button", { name: "Request Song by Artist" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Song requests are no longer available");
    expect(screen.queryByLabelText("Search for a song or paste a YouTube URL")).not.toBeInTheDocument();
    expect(onReconcile).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Music" })).toHaveFocus());
  });
  it.each(Array.from({ length: 32 }, (_, mask) => [mask]))(
    "renders only permitted data and interactivity for mask %i",
    (mask) => {
      const resource = populatedResource(mask);
      render(<PublicMusicSections resource={resource} />);

      const playback = resource.permissions.allowGuestPlayOnDevice;
      const playlists = resource.permissions.allowPlaylistSharing;
      const history = resource.permissions.allowRecentlyPlayedVisibility;
      const queue = resource.permissions.allowQueueVisibility;

      expect(screen.queryByTestId("public-music-player")).toBe(playback ? screen.getByTestId("public-music-player") : null);
      expect(screen.queryByRole("region", { name: "Up next" })).toBe(queue ? screen.getByRole("region", { name: "Up next" }) : null);
      expect(screen.queryByRole("region", { name: "Shared playlists" })).toBe(playlists ? screen.getByRole("region", { name: "Shared playlists" }) : null);
      expect(screen.queryByRole("region", { name: "Recently played" })).toBe(history ? screen.getByRole("region", { name: "Recently played" }) : null);

      expect(screen.queryByText("Queue signal")).toBe(queue ? screen.getByText("Queue signal") : null);
      expect(screen.queryByText("History signal")).toBe(history ? screen.getByText("History signal") : null);
      expect(screen.queryByText("Playlist signal")).toBe(playlists ? screen.getByText("Playlist signal") : null);
      expect(screen.queryByText("Current signal")).toBe(playback || queue ? screen.getByText("Current signal") : null);

      const expectedReadingOrder = [
        ...(playback ? ["Play on this device"] : []),
        ...(queue ? ["Up next"] : []),
        ...(playlists ? ["Shared playlists"] : []),
        ...(history ? ["Recently played"] : []),
      ];
      expect(screen.queryAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(expectedReadingOrder);

      expect(screen.queryByRole("button", { name: /^Play .* on this device$/ })).toBe(playback
        ? screen.getByRole("button", { name: /^Play .* on this device$/ })
        : null);
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    },
  );

  it("does not render a player shell when playback has no exposed source", () => {
    const resource = populatedResource(2);
    resource.currentlyPlaying = null;
    resource.queue = { items: [], total: 0, truncated: false };
    resource.playlists = { items: [], total: 0, truncated: false };
    render(<PublicMusicSections resource={resource} />);
    expect(screen.queryByTestId("public-music-player")).not.toBeInTheDocument();
    expect(screen.getByText("Nothing has been shared here yet")).toBeInTheDocument();
  });

  it("selects an exposed playlist song for local playback without autoplaying it", async () => {
    const user = userEvent.setup();
    render(<PublicMusicSections resource={populatedResource(2 | 4)} />);
    await user.click(screen.getByRole("button", { name: "Choose Playlist signal to play on this device" }));
    expect(screen.getByRole("button", { name: "Play Playlist signal on this device" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose Playlist signal to play on this device" })).toHaveAttribute("aria-current", "true");
  });

  it("remounts a newly selected source paused before ReactPlayer can observe its src", async () => {
    const user = userEvent.setup();
    mediaRenders.length = 0;
    render(<PublicMusicSections resource={populatedResource(2 | 4 | 16)} />);
    await user.click(screen.getByRole("button", { name: "Play Current signal on this device" }));
    expect(screen.getByTestId("guest-media")).toHaveAttribute("data-playing", "true");

    await user.click(screen.getByRole("button", { name: "Choose Queue signal to play on this device" }));
    expect(screen.getByTestId("guest-media")).toHaveAttribute("data-src", "https://www.youtube.com/watch?v=lmnopqrstuv");
    expect(screen.getByTestId("guest-media")).toHaveAttribute("data-playing", "false");
    expect(screen.getByRole("button", { name: "Play Queue signal on this device" })).toBeInTheDocument();
    expect(mediaRenders.filter(({ src }) => src.endsWith("lmnopqrstuv"))[0]).toEqual({
      src: "https://www.youtube.com/watch?v=lmnopqrstuv",
      playing: false,
    });
  });

  it("removes playback controls and the media surface on canonical permission revocation", async () => {
    const user = userEvent.setup();
    const initial = populatedResource(2 | 4);
    const { rerender } = render(<PublicMusicSections resource={initial} />);
    await user.click(screen.getByRole("button", { name: /Play Current signal/ }));

    rerender(<PublicMusicSections resource={{
      ...initial,
      revision: 8,
      permissions: { ...initial.permissions, allowGuestPlayOnDevice: false },
    }} />);
    expect(screen.queryByTestId("public-music-player")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /on this device/ })).not.toBeInTheDocument();
  });

  it("announces focused playback revocation and moves focus to the Music heading", async () => {
    const initial = populatedResource(2);
    const { rerender } = render(<><h1 id="public-music-heading" tabIndex={-1}>Music</h1><PublicMusicSections resource={initial} /></>);
    screen.getByRole("button", { name: /Play Current signal/ }).focus();

    rerender(<><h1 id="public-music-heading" tabIndex={-1}>Music</h1><PublicMusicSections resource={{
      ...initial,
      revision: 8,
      currentlyPlaying: null,
      permissions: { ...initial.permissions, allowGuestPlayOnDevice: false },
    }} /></>);

    expect(screen.getByRole("heading", { name: "Music" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Playback on this device is no longer available.");
    expect(screen.queryByTestId("guest-media")).not.toBeInTheDocument();
  });

  it("does not steal focus when playback is revoked while focus is elsewhere", () => {
    const initial = populatedResource(2 | 4);
    const { rerender } = render(<><h1 id="public-music-heading" tabIndex={-1}>Music</h1><button type="button">Outside</button><PublicMusicSections resource={initial} /></>);
    screen.getByRole("button", { name: "Outside" }).focus();

    rerender(<><h1 id="public-music-heading" tabIndex={-1}>Music</h1><button type="button">Outside</button><PublicMusicSections resource={{
      ...initial,
      revision: 8,
      permissions: { ...initial.permissions, allowGuestPlayOnDevice: false },
    }} /></>);

    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
    expect(screen.queryByText("Playback on this device is no longer available.")).not.toBeInTheDocument();
  });

  it("announces canonical request permission revocation and preserves outside focus", () => {
    const initial = populatedResource(1 | 4);
    const { rerender } = render(<><h1 id="public-music-heading" tabIndex={-1}>Music</h1><button type="button">Outside</button><PublicMusicSections resource={initial} publicSlug="public-owner" /></>);
    screen.getByRole("button", { name: "Outside" }).focus();
    rerender(<><h1 id="public-music-heading" tabIndex={-1}>Music</h1><button type="button">Outside</button><PublicMusicSections resource={{ ...initial, revision: 8, permissions: { ...initial.permissions, allowSongRequests: false } }} publicSlug="public-owner" /></>);
    expect(screen.queryByLabelText("Search for a song or paste a YouTube URL")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Song requests are no longer available.");
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
  });

  it("moves contained focus to the Music heading when canonical request permission is revoked", () => {
    const initial = populatedResource(1 | 4);
    const { rerender } = render(<><h1 id="public-music-heading" tabIndex={-1}>Music</h1><PublicMusicSections resource={initial} publicSlug="public-owner" /></>);
    screen.getByLabelText("Search for a song or paste a YouTube URL").focus();
    rerender(<><h1 id="public-music-heading" tabIndex={-1}>Music</h1><PublicMusicSections resource={{ ...initial, revision: 8, permissions: { ...initial.permissions, allowSongRequests: false } }} publicSlug="public-owner" /></>);
    expect(screen.getByRole("heading", { name: "Music" })).toHaveFocus();
  });

  it("reconciles a delayed lookup revocation without stealing focus that moved outside", async () => {
    let rejectSearch!: (error: unknown) => void;
    const onReconcile = vi.fn();
    const requestClient = { search: vi.fn(() => new Promise((_, reject) => { rejectSearch = reject; })), videoFromUrl: vi.fn(), requestSong: vi.fn() };
    render(<><h1 id="public-music-heading" tabIndex={-1}>Music</h1><button type="button">Outside</button><PublicMusicSections resource={populatedResource(1 | 4)} publicSlug="public-owner" onReconcile={onReconcile} requestClient={requestClient as never} /></>);
    await userEvent.type(screen.getByLabelText("Search for a song or paste a YouTube URL"), "song");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    screen.getByRole("button", { name: "Outside" }).focus();
    rejectSearch(new PublicMusicError("REQUEST_FORBIDDEN"));
    await waitFor(() => expect(onReconcile).toHaveBeenCalledTimes(1));
    expect(screen.queryByLabelText("Search for a song or paste a YouTube URL")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Song requests are no longer available.");
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
  });

  it("uses one page-level empty state instead of stacking enabled-empty messages", () => {
    const resource = populatedResource(31);
    resource.currentlyPlaying = null;
    resource.queue = { items: [], total: 0, truncated: false };
    resource.recentlyPlayed = { items: [], total: 0, truncated: false };
    resource.playlists = { items: [], total: 0, truncated: false };
    render(<PublicMusicSections resource={resource} />);
    expect(screen.getByText("Nothing has been shared here yet")).toBeInTheDocument();
    expect(screen.queryByText("Nothing queued yet")).not.toBeInTheDocument();
    expect(screen.queryByText("No shared playlists yet")).not.toBeInTheDocument();
    expect(screen.queryByText("Nothing played recently")).not.toBeInTheDocument();
  });

  it("shows warm empty and truthful truncation summaries alongside partial content", () => {
    const resource = populatedResource(4 | 8 | 16);
    resource.recentlyPlayed = { items: [], total: 0, truncated: false };
    render(<PublicMusicSections resource={resource} />);

    expect(within(screen.getByRole("region", { name: "Up next" })).getByText("Showing 1 of 3")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Shared playlists" })).getByText("Showing 1 of 2 playlists")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 2 songs")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Recently played" })).getByText("Nothing played recently")).toBeInTheDocument();
  });

  it("uses semantic headings and lists with decorative artwork", () => {
    const { container } = render(<PublicMusicSections resource={populatedResource(31)} />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(4);
    expect(screen.getAllByRole("list").length).toBeGreaterThanOrEqual(3);
    for (const image of container.querySelectorAll("img")) {
      expect(image).toHaveAttribute("alt", "");
    }
  });

  it("has no serious or critical automated accessibility violations", async () => {
    const { container } = render(<PublicMusicSections resource={populatedResource(31)} />);
    const result = await axe.run(container, {
      // JSDOM has no layout or computed color model; browser UAT owns contrast.
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
  });

  it.each([
    [20, ["Up next", "Shared playlists"]],
    [21, ["Up next", "Shared playlists"]],
    [28, ["Up next", "Shared playlists", "Recently played"]],
    [14, ["Play on this device", "Shared playlists", "Recently played"]],
    [26, ["Play on this device", "Up next", "Recently played"]],
    [8, ["Recently played"]],
    [31, ["Play on this device", "Up next", "Shared playlists", "Recently played"]],
  ] as const)("keeps desktop visual traversal aligned with DOM order for mask %i", (mask, expected) => {
    const { container } = render(<PublicMusicSections resource={populatedResource(mask)} />);
    const grid = container.firstElementChild;
    expect(grid).toHaveClass("xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]");

    const sections = Array.from(grid?.children ?? []);
    expect(sections.map((section) => section.querySelector("h2")?.textContent)).toEqual(expected);
    for (const section of sections) {
      expect(section.className).not.toMatch(/(?:^|:)col-start-/);
      expect(section.className).not.toMatch(/(?:^|:)row-start-/);
      expect(section.className).not.toMatch(/(?:^|:)order-/);
    }
  });
});
