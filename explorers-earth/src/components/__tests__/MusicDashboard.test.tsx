import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MusicDashboard from "../MusicDashboard";

const base = {
  playlists: [] as Array<any>,
  dashboard: { songs: [], currentlyPlaying: null, playedSongs: [], publication: { mode: "private" as const, publicSlug: "public-slug-123" } },
  entitlement: { state: "included" as const, coreRead: true, coreMutation: true, paidMutation: false, maxAgeSeconds: 600 },
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};

describe("Music workspace UI", () => {
  it("renders the approved ready-empty hierarchy with one primary action", async () => {
    render(<MusicDashboard data={base} />);
    expect(screen.getByRole("heading", { name: "Create your first playlist" })).toBeInTheDocument();
    expect(screen.getByText("Build a playlist to collect and share the music you love.")).toBeInTheDocument();
    const action = screen.getByRole("button", { name: "Create playlist" });
    expect(action.className).toContain("min-h-11");
    await userEvent.click(action);
    expect(screen.getByRole("dialog", { name: "Create playlist" })).toBeInTheDocument();
    expect(screen.getByLabelText("Playlist name")).toHaveFocus();
  });

  it("uses semantic tabs with arrow-key navigation and announces keyboard reorder", async () => {
    const playlists = [
      { id: 1, name: "One", description: null, isVisibleToGuests: false, songs: [{ id: 11, title: "A", artist: "B", thumbnailUrl: "x", position: 0 }] },
      { id: 2, name: "Two", description: null, isVisibleToGuests: false, songs: [] },
    ];
    render(<MusicDashboard data={{ ...base, playlists }} />);
    const first = screen.getByRole("tab", { name: /One/ });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Two/ })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("tab", { name: /Two/ }), { key: "ArrowLeft" });
    expect(first).toHaveFocus();
    expect(screen.getByLabelText("Move A down")).toHaveClass("min-h-11", "min-w-11");
  });

  it("offers only Private, Unlisted, and Public with mode-specific copy under Music", async () => {
    render(<MusicDashboard data={base} />);
    await userEvent.click(screen.getByRole("button", { name: "Sharing settings" }));
    expect(screen.getByRole("dialog", { name: "Music sharing" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual(["private", "unlisted", "public"]);
    expect(screen.getByText("Only you can open this Music workspace.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Unlisted" }));
    expect(screen.getByText("Anyone with the private link can view shared playlists. The page won’t appear in search.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save sharing" })).toHaveClass("min-h-11");
  });

  it("closes dialogs with Escape and returns focus to the opener", async () => {
    render(<MusicDashboard data={base} />);
    const opener = screen.getByRole("button", { name: "Sharing settings" });
    await userEvent.click(opener);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("shows the canonical link and preview affordance for a public workspace", async () => {
    render(<MusicDashboard data={{ ...base, dashboard: { ...base.dashboard, publication: { mode: "public", publicSlug: "public-slug-123" } } }} />);
    await userEvent.click(screen.getByRole("button", { name: "Sharing settings" }));
    expect(screen.getByLabelText("Music share link")).toHaveValue(`${window.location.origin}/music/share/public-slug-123`);
    expect(screen.getByRole("link", { name: "Preview public Music page" })).toHaveAttribute("target", "_blank");
  });
});
