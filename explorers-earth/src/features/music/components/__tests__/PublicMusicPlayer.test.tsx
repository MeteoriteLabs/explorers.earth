import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicMusicSong } from "../../publicMusicClient";
import { PublicMusicPlayer } from "../PublicMusicPlayer";

type PlayerProps = Record<string, unknown>;
let mediaProps: PlayerProps = {};
const mediaCleanup = vi.fn();

vi.mock("react-player", async () => {
  const React = await import("react");
  function MockPlayer(props: PlayerProps) {
    mediaProps = props;
    React.useEffect(() => mediaCleanup, []);
    return <div data-testid="guest-media" data-playing={String(props.playing)} data-src={String(props.src)} />;
  }
  return {
    default: MockPlayer,
  };
});

const song: PublicMusicSong = {
  id: "S".repeat(43),
  youtubeId: "abcdefghijk",
  title: "Public signal",
  artist: "Guest artist",
  thumbnailUrl: "https://images.example/signal.jpg",
  position: 0,
  status: "saved",
  playedAt: null,
};

describe("PublicMusicPlayer", () => {
  beforeEach(() => { mediaProps = {}; mediaCleanup.mockReset(); });
  afterEach(() => vi.restoreAllMocks());

  it("requires an explicit guest gesture and exposes keyboard-labelled play and pause controls", async () => {
    const user = userEvent.setup();
    render(<PublicMusicPlayer song={song} />);

    expect(screen.getByTestId("guest-media")).toHaveAttribute("data-playing", "false");
    const play = screen.getByRole("button", { name: "Play Public signal on this device" });
    play.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("guest-media")).toHaveAttribute("data-playing", "true");
    expect(screen.getByRole("button", { name: "Pause Public signal" })).toHaveAttribute("aria-pressed", "true");

    await user.keyboard(" ");
    expect(screen.getByTestId("guest-media")).toHaveAttribute("data-playing", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Public signal is paused");
  });

  it("uses only the public YouTube identity and never begins playing when the song changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PublicMusicPlayer song={song} />);
    await user.click(screen.getByRole("button", { name: /Play Public signal/ }));

    const selected = { ...song, id: "T".repeat(43), youtubeId: "lmnopqrstuv", title: "Selected song" };
    rerender(<PublicMusicPlayer song={selected} />);
    expect(screen.getByTestId("guest-media")).toHaveAttribute("data-src", "https://www.youtube.com/watch?v=lmnopqrstuv");
    expect(screen.getByTestId("guest-media")).toHaveAttribute("data-playing", "false");
    expect(screen.getByRole("button", { name: "Play Selected song on this device" })).toBeInTheDocument();
  });

  it("recovers from autoplay denial without hiding the explicit play control", async () => {
    const user = userEvent.setup();
    render(<PublicMusicPlayer song={song} />);
    await user.click(screen.getByRole("button", { name: /Play Public signal/ }));
    act(() => (mediaProps.onError as (cause: unknown) => void)(new DOMException("blocked", "NotAllowedError")));
    expect(screen.getByTestId("guest-media")).toHaveAttribute("data-playing", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Press play to start this song on your device.");
    expect(screen.getByRole("button", { name: /Play Public signal/ })).toBeInTheDocument();
  });

  it.each([
    [100, "This video is no longer available. Choose another track."],
    [101, "This video cannot be played here. Choose another track."],
    [new TypeError("network failed"), "Playback could not connect. Check your connection and try again."],
    [new Error("embed failed"), "Playback is unavailable right now. Choose another track or try again."],
  ])("stops playback and announces a contained media failure for %s", async (cause, message) => {
    const user = userEvent.setup();
    render(<PublicMusicPlayer song={song} />);
    await user.click(screen.getByRole("button", { name: /Play Public signal/ }));
    act(() => (mediaProps.onError as (cause: unknown) => void)(cause));
    expect(screen.getByTestId("guest-media")).toHaveAttribute("data-playing", "false");
    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });

  it("stops and destroys local media when playback permission is revoked", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<PublicMusicPlayer song={song} allowed />);
    await user.click(screen.getByRole("button", { name: /Play Public signal/ }));
    rerender(<PublicMusicPlayer song={song} allowed={false} />);
    expect(screen.queryByTestId("guest-media")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Public signal/ })).not.toBeInTheDocument();
    expect(mediaCleanup).toHaveBeenCalledOnce();
  });

  it("destroys local media on unmount", () => {
    const { unmount } = render(<PublicMusicPlayer song={song} />);
    unmount();
    expect(mediaCleanup).toHaveBeenCalledOnce();
  });

  it("has no serious or critical automated accessibility violations", async () => {
    const { container } = render(<PublicMusicPlayer song={song} />);
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
  });

  it("has a source boundary against owner queue and playback authority", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/music/components/PublicMusicPlayer.tsx"), "utf8");
    expect(source).not.toMatch(/musicQueueClient|musicApi|musicWorkspaceClient|musicPlaybackCommand/);
  });
});
