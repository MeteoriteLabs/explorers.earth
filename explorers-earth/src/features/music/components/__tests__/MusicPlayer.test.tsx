import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MusicPlayer } from "../MusicPlayer";
import type { MusicSong } from "../../musicWorkspaceClient";

type PlayerProps = Record<string, unknown>;
let playerProps: PlayerProps;
const seekTo = vi.fn();

vi.mock("react-player", async () => {
  const React = await import("react");
  return { default: React.forwardRef((_props: PlayerProps, ref) => {
    playerProps = _props;
    React.useImperativeHandle(ref, () => ({ set currentTime(value: number) { seekTo(value); } }));
    return <div data-testid="media" data-playing={String(_props.playing)} data-volume={String(_props.volume)} data-muted={String(_props.muted)} />;
  }) };
});

const current: MusicSong = { id: 1, youtubeId: "abcdefghijk", title: "First song", artist: "Artist one", thumbnailUrl: "https://img/1", position: 0, status: "playing", playedAt: null };
const next: MusicSong = { id: 2, youtubeId: "lmnopqrstuv", title: "Next song", artist: "Artist two", thumbnailUrl: "https://img/2", position: 1, status: "queued", playedAt: null };
const previous: MusicSong = { id: 3, youtubeId: "zyxwvutsrqp", title: "Previous song", artist: "Artist three", thumbnailUrl: "https://img/3", position: 0, status: "played", playedAt: "2026-08-25T10:00:00.000Z" };

function setup(overrides: Partial<React.ComponentProps<typeof MusicPlayer>> = {}) {
  const props: React.ComponentProps<typeof MusicPlayer> = {
    currentSong: current,
    queuedSongs: [next],
    playedSongs: [previous],
    queueClient: { setPlaying: vi.fn().mockResolvedValue(undefined) },
    onChanged: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { ...render(<MusicPlayer {...props} />), props };
}

describe("MusicPlayer", () => {
  beforeEach(() => { playerProps = {}; seekTo.mockReset(); });

  it("plays, pauses, changes volume, mutes, and exposes accessible values", async () => {
    const user = userEvent.setup(); setup();
    const toggle = screen.getByRole("button", { name: "Play" });
    expect(toggle).toHaveStyle({ minWidth: "44px", minHeight: "44px" });
    await user.click(toggle);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    expect(screen.getByTestId("media")).toHaveAttribute("data-playing", "true");
    fireEvent.change(screen.getByRole("slider", { name: "Volume" }), { target: { value: "35" } });
    expect(screen.getByRole("slider", { name: "Volume" })).toHaveAttribute("aria-valuetext", "35 percent");
    expect(screen.getByTestId("media")).toHaveAttribute("data-volume", "0.35");
    await user.click(screen.getByRole("button", { name: "Mute" }));
    expect(screen.getByRole("button", { name: "Unmute" })).toBeInTheDocument();
  });

  it("seeks through the ReactPlayer v3 media ref and reports elapsed time", () => {
    setup();
    act(() => (playerProps.onDurationChange as (event: { currentTarget: { duration: number } }) => void)({ currentTarget: { duration: 200 } }));
    act(() => (playerProps.onTimeUpdate as (event: { currentTarget: { currentTime: number } }) => void)({ currentTarget: { currentTime: 50 } }));
    const slider = screen.getByRole("slider", { name: "Playback position" });
    expect(slider).toHaveAttribute("aria-valuetext", "0:50 of 3:20");
    fireEvent.change(slider, { target: { value: "100" } });
    expect(slider).toHaveValue("100");
    expect(seekTo).toHaveBeenCalledWith(100);
  });

  it("persists next and previous-from-history transitions before refreshing", async () => {
    const user = userEvent.setup(); const { props } = setup();
    await user.click(screen.getByRole("button", { name: "Next song" }));
    expect(props.queueClient.setPlaying).toHaveBeenCalledWith(2, expect.stringMatching(/^music-player-next-/));
    await user.click(screen.getByRole("button", { name: "Previous song" }));
    expect(props.queueClient.setPlaying).toHaveBeenCalledWith(3, expect.stringMatching(/^music-player-previous-/));
    expect(props.onChanged).toHaveBeenCalledTimes(2);
  });

  it("moves to the next song when media ends and broadcasts only after confirmation", async () => {
    const broadcastPlayerState = vi.fn(); const { props } = setup({ broadcastPlayerState });
    act(() => (playerProps.onEnded as () => void)());
    await waitFor(() => expect(props.queueClient.setPlaying).toHaveBeenCalledWith(2, expect.any(String)));
    expect(broadcastPlayerState).toHaveBeenCalledWith({ songId: 2, playing: true });
  });

  it("completes the current song when the queue ends", async () => {
    const broadcastPlayerState = vi.fn(); const { props } = setup({ queuedSongs: [], broadcastPlayerState });
    act(() => (playerProps.onEnded as () => void)());
    await waitFor(() => expect(props.queueClient.setPlaying).toHaveBeenCalledWith(null, expect.stringMatching(/^music-player-ended-/)));
    expect(broadcastPlayerState).toHaveBeenCalledWith({ songId: 1, playing: false });
    expect(props.onChanged).toHaveBeenCalledOnce();
  });

  it("contains autoplay rejection and offers an explicit retry", async () => {
    const user = userEvent.setup(); setup();
    act(() => (playerProps.onError as (error: Error) => void)(new DOMException("blocked", "NotAllowedError")));
    expect(await screen.findByRole("status")).toHaveTextContent("Press play to start this song.");
    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByTestId("media")).toHaveAttribute("data-playing", "true");
  });

  it("makes exactly two bounded recovery attempts, then skips an unavailable song once", async () => {
    vi.useFakeTimers(); const { props } = setup();
    act(() => (playerProps.onError as (error: Error) => void)(new Error("media unavailable")));
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(screen.getByTestId("media")).toHaveAttribute("data-playing", "true");
    act(() => (playerProps.onError as (error: Error) => void)(new Error("media unavailable")));
    await act(async () => { await vi.runAllTimersAsync(); });
    act(() => (playerProps.onError as (error: Error) => void)(new Error("media unavailable")));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(props.queueClient.setPlaying).toHaveBeenCalledTimes(1);
    act(() => (playerProps.onError as (error: Error) => void)(new Error("media unavailable")));
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(props.queueClient.setPlaying).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("First song is unavailable. Skipping once.");
    vi.useRealTimers();
  });

  it("resets media state and recovery budget when the current song changes", () => {
    const { rerender, props } = setup();
    act(() => (playerProps.onDurationChange as (event: { currentTarget: { duration: number } }) => void)({ currentTarget: { duration: 200 } }));
    act(() => (playerProps.onTimeUpdate as (event: { currentTarget: { currentTime: number } }) => void)({ currentTarget: { currentTime: 50 } }));
    rerender(<MusicPlayer {...props} currentSong={next} queuedSongs={[]} />);
    expect(screen.getByRole("slider", { name: "Playback position" })).toHaveValue("0");
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("contains rejected queue and refresh promises", async () => {
    const user = userEvent.setup();
    setup({ queueClient: { setPlaying: vi.fn().mockRejectedValue(new Error("offline")) }, onChanged: vi.fn().mockRejectedValue(new Error("refresh")) });
    await user.click(screen.getByRole("button", { name: "Next song" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not change songs. Try again.");
  });

  it("does not report a confirmed transition as failed when only refresh rejects", async () => {
    const user = userEvent.setup(); const broadcastPlayerState = vi.fn();
    const { props } = setup({ onChanged: vi.fn().mockRejectedValue(new Error("refresh")), broadcastPlayerState });
    await user.click(screen.getByRole("button", { name: "Next song" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Song changed, but the latest queue could not be loaded.");
    expect(props.queueClient.setPlaying).toHaveBeenCalledOnce();
    expect(broadcastPlayerState).toHaveBeenCalledWith({ songId: 2, playing: true });
  });

  it("renders a stable empty state", () => {
    setup({ currentSong: null, queuedSongs: [], playedSongs: [] });
    expect(screen.getByRole("status")).toHaveTextContent("Choose a song to start listening.");
  });
});
