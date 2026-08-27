import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MusicWorkspaceShell } from "../MusicWorkspaceShell";

const panels = {
  player: <section aria-label="player-content">Player content</section>,
  search: <section aria-label="search-content"><label>Scoped search<input type="search" /></label></section>,
  queue: <section aria-label="queue-content">Queue content</section>,
  history: <section aria-label="history-content">History content</section>,
  guestControls: <section aria-label="guest-controls-content">Guest controls content</section>,
  playlists: <section aria-label="playlists-content">Playlists content</section>,
};

describe("MusicWorkspaceShell", () => {
  it("places search before the player and exposes four keyboard-navigable workspace tabs", () => {
    render(<MusicWorkspaceShell {...panels} />);
    expect(screen.getByLabelText("Music player region")).toContainElement(screen.getByLabelText("player-content"));
    const workspace = screen.getByRole("region", { name: "Music workspace" });
    const searchRegion = screen.getByLabelText("Music search region");
    const playerRegion = screen.getByLabelText("Music player region");
    expect(workspace.compareDocumentPosition(searchRegion) & Node.DOCUMENT_POSITION_CONTAINED_BY).toBeTruthy();
    expect(searchRegion.compareDocumentPosition(playerRegion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const queue = screen.getByRole("tab", { name: "Queue" });
    expect(queue).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(queue, { key: "ArrowRight" });
    const guestControls = screen.getByRole("tab", { name: "Guest controls" });
    expect(guestControls).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toContainElement(screen.getByLabelText("guest-controls-content"));
    fireEvent.keyDown(guestControls, { key: "ArrowRight" });
    const history = screen.getByRole("tab", { name: "Recent" });
    expect(history).toHaveFocus();
    fireEvent.keyDown(history, { key: "ArrowRight" });
    const playlists = screen.getByRole("tab", { name: "Playlists" });
    expect(playlists).toHaveFocus();
    fireEvent.keyDown(playlists, { key: "ArrowRight" });
    expect(queue).toHaveFocus();
    fireEvent.keyDown(queue, { key: "ArrowLeft" });
    expect(playlists).toHaveFocus();
    fireEvent.keyDown(playlists, { key: "Home" });
    expect(queue).toHaveFocus();
    fireEvent.keyDown(queue, { key: "End" });
    expect(playlists).toHaveFocus();
  });

  it("keeps the shell during loading, marks stale content read-only, and offers an empty queue CTA", () => {
    const { rerender } = render(<MusicWorkspaceShell {...panels} loading />);
    expect(screen.getByRole("region", { name: "Music workspace" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Refreshing Music");
    rerender(<MusicWorkspaceShell {...panels} stale empty onAddFirstSong={() => undefined} />);
    expect(screen.getByRole("region", { name: "Music workspace" })).toHaveAttribute("aria-readonly", "true");
    expect(screen.getByRole("button", { name: "Add your first song" })).toHaveClass("min-h-11", "min-w-11");
  });

  it("uses a horizontally scrollable touch-safe tab row without a second fixed mobile navigation", () => {
    render(<MusicWorkspaceShell {...panels} />);
    const tabs = screen.getByRole("tablist", { name: "Music content" });
    expect(tabs).toHaveClass("overflow-x-auto");
    for (const name of ["Queue", "Guest controls", "Recent", "Playlists"]) {
      expect(screen.getByRole("tab", { name })).toHaveClass("min-h-11", "min-w-11");
    }
    expect(screen.queryByRole("navigation", { name: "Music workspace" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Music workspace" }).className).toContain("overflow-x-hidden");
  });

  it("focuses the always-visible unified search input from the empty CTA", () => {
    render(<MusicWorkspaceShell {...panels} empty />);
    fireEvent.click(screen.getByRole("button", { name: "Add your first song" }));
    expect(screen.getByLabelText("Scoped search")).toHaveFocus();
    expect(screen.getByLabelText("search-content").parentElement).not.toHaveClass("hidden");
  });
});
