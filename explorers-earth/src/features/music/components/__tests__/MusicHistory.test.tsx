import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MusicHistory } from "../MusicHistory";
import type { MusicSong } from "../../musicWorkspaceClient";

const song: MusicSong = { id: 3, youtubeId: "zyxwvutsrqp", title: "Previous song", artist: "Artist", thumbnailUrl: "https://img/3", position: 0, status: "played", playedAt: "2026-08-25T10:00:00.000Z" };

describe("MusicHistory", () => {
  it("announces loading without exposing stale actions", () => {
    render(<MusicHistory songs={[song]} loading queueClient={{ clearHistory: vi.fn() }} onChanged={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading listening history");
    expect(screen.queryByRole("button", { name: "Clear history" })).not.toBeInTheDocument();
  });

  it("renders an accessible empty state", () => {
    render(<MusicHistory songs={[]} queueClient={{ clearHistory: vi.fn() }} onChanged={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Songs you finish will appear here.");
  });

  it("renders history and clears it through the canonical client", async () => {
    const user = userEvent.setup(); const clearHistory = vi.fn().mockResolvedValue(undefined); const onChanged = vi.fn().mockResolvedValue(undefined);
    render(<MusicHistory songs={[song]} queueClient={{ clearHistory }} onChanged={onChanged} />);
    expect(screen.getByRole("list", { name: "Recently played songs" })).toHaveTextContent("Previous song");
    const button = screen.getByRole("button", { name: "Clear history" });
    expect(button).toHaveStyle({ minWidth: "44px", minHeight: "44px" });
    await user.click(button);
    expect(clearHistory).toHaveBeenCalledWith(expect.stringMatching(/^music-history-clear-/));
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it("contains a failed clear and supports retry without an unhandled promise", async () => {
    const user = userEvent.setup(); const clearHistory = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    render(<MusicHistory songs={[song]} queueClient={{ clearHistory }} onChanged={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Clear history" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not clear history. Try again.");
    await user.click(screen.getByRole("button", { name: "Clear history" }));
    await waitFor(() => expect(clearHistory).toHaveBeenCalledTimes(2));
  });

  it("keeps a confirmed clear distinct from a failed refresh", async () => {
    const user = userEvent.setup(); const clearHistory = vi.fn().mockResolvedValue(undefined);
    render(<MusicHistory songs={[song]} queueClient={{ clearHistory }} onChanged={vi.fn().mockRejectedValue(new Error("refresh"))} />);
    await user.click(screen.getByRole("button", { name: "Clear history" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("History cleared, but the latest history could not be loaded.");
    expect(clearHistory).toHaveBeenCalledOnce();
  });
});
