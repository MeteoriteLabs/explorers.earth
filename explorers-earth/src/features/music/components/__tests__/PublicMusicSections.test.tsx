import { render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import type { PublicMusicResource, PublicMusicSong } from "../../publicMusicClient";
import { PublicMusicSections } from "../PublicMusicSections";

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
const queued = song("Q", "Queue signal", "queued", 1);
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

      // Task 8 exposes sources but does not ship Task 9 playback controls or
      // Task 10 request controls early.
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
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
});
