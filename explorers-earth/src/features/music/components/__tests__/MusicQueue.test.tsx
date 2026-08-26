import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MusicQueue } from "../MusicQueue";
import type { MusicSong } from "../../musicWorkspaceClient";

const songs: MusicSong[] = [
  { id: 1, youtubeId: "abcdefghijk", title: "First song", artist: "One", thumbnailUrl: "https://img/1", position: 0, status: "queued", playedAt: null },
  { id: 2, youtubeId: "lmnopqrstuv", title: "Second song", artist: "Two", thumbnailUrl: "https://img/2", position: 1, status: "queued", playedAt: null },
];
function props() {
  return {
    songs,
    client: {
      setPlaying: vi.fn().mockResolvedValue(songs[0]),
      removeSong: vi.fn().mockResolvedValue(undefined),
      removeSongs: vi.fn().mockResolvedValue(undefined),
      moveSong: vi.fn().mockResolvedValue(songs[0]),
    },
    onChanged: vi.fn().mockResolvedValue(undefined),
  };
}

describe("MusicQueue", () => {
  it("plays and removes a song with accessible touch targets", async () => {
    const value = props();
    render(<MusicQueue {...value} />);
    const play = screen.getByRole("button", { name: "Play First song" });
    expect(play).toHaveClass("min-h-11", "min-w-11");
    await userEvent.click(play);
    await waitFor(() => expect(value.client.setPlaying).toHaveBeenCalledWith(1, expect.stringMatching(/^music-play-/)));
    await userEvent.click(screen.getByRole("button", { name: "Remove First song" }));
    await waitFor(() => expect(value.client.removeSong).toHaveBeenCalledWith(1, expect.stringMatching(/^music-remove-/)));
    expect(value.onChanged).toHaveBeenCalledTimes(2);
  });

  it("bulk removes selected songs", async () => {
    const value = props();
    render(<MusicQueue {...value} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Select First song" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Second song" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove 2 selected" }));
    await waitFor(() => expect(value.client.removeSongs).toHaveBeenCalledWith([1, 2], expect.stringMatching(/^music-remove-many-/)));
  });

  it("moves by keyboard-accessible controls and rolls back on failure", async () => {
    const value = props();
    value.client.moveSong.mockRejectedValueOnce(new Error("conflict"));
    render(<MusicQueue {...value} />);
    const second = screen.getByRole("button", { name: "Move Second song up" });
    second.focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("First song"), expect.stringContaining("Second song")]));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Queue update failed"));
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("First song");
    expect(value.onChanged).toHaveBeenCalledTimes(1);
  });

  it("refetches after an ambiguous removal failure", async () => {
    const value = props();
    value.client.removeSong.mockRejectedValueOnce(new Error("offline"));
    render(<MusicQueue {...value} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove First song" }));
    await waitFor(() => expect(value.onChanged).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alert")).toHaveTextContent("Queue update failed");
  });

  it("does not offer reorder controls for playing or played songs", () => {
    const value = props();
    const immutable = [
      { ...songs[0], status: "playing" as const },
      { ...songs[1], status: "played" as const },
    ];
    render(<MusicQueue {...value} songs={immutable} />);
    expect(screen.queryByRole("button", { name: /Move .* (up|down)/ })).not.toBeInTheDocument();
  });

  it("keeps canonical rerendered props after a failed optimistic move", async () => {
    const value = props();
    let rejectMove!: (reason: unknown) => void;
    value.client.moveSong.mockReturnValue(new Promise((_, reject) => { rejectMove = reject; }));
    const canonical = [{ ...songs[1], position: 0 }, { ...songs[0], position: 1 }];
    const view = render(<MusicQueue {...value} />);
    await userEvent.click(screen.getByRole("button", { name: "Move Second song up" }));
    view.rerender(<MusicQueue {...value} songs={canonical} />);
    rejectMove(new Error("conflict"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Second song");
    expect(value.onChanged).toHaveBeenCalledTimes(1);
  });
});
