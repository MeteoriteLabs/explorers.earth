import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MusicWorkspaceShell } from "../MusicWorkspaceShell";

const panels = {
  player: <section aria-label="player-content">Player content</section>,
  search: <section aria-label="search-content"><label>Scoped search<input type="search" /></label></section>,
  queue: <section aria-label="queue-content">Queue content</section>,
  history: <section aria-label="history-content">History content</section>,
};

describe("MusicWorkspaceShell", () => {
  it("anchors the player and exposes keyboard-navigable Queue and Recently played tabs", () => {
    render(<MusicWorkspaceShell {...panels} />);
    expect(screen.getByLabelText("Music player region")).toContainElement(screen.getByLabelText("player-content"));
    const queue = screen.getByRole("tab", { name: "Queue" });
    expect(queue).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(queue, { key: "ArrowRight" });
    const history = screen.getByRole("tab", { name: "Recently played" });
    expect(history).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toContainElement(screen.getByLabelText("history-content"));
    fireEvent.keyDown(history, { key: "ArrowRight" });
    expect(queue).toHaveFocus();
    fireEvent.keyDown(queue, { key: "ArrowLeft" });
    expect(history).toHaveFocus();
    fireEvent.keyDown(history, { key: "Home" });
    expect(queue).toHaveFocus();
    fireEvent.keyDown(queue, { key: "End" });
    expect(history).toHaveFocus();
  });

  it("keeps the shell during loading, marks stale content read-only, and offers an empty queue CTA", () => {
    const { rerender } = render(<MusicWorkspaceShell {...panels} loading />);
    expect(screen.getByRole("region", { name: "Music workspace" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Refreshing Music");
    rerender(<MusicWorkspaceShell {...panels} stale empty onAddFirstSong={() => undefined} />);
    expect(screen.getByRole("region", { name: "Music workspace" })).toHaveAttribute("aria-readonly", "true");
    expect(screen.getByRole("button", { name: "Add your first song" })).toHaveClass("min-h-11", "min-w-11");
  });

  it("provides mobile Player, Queue, Search, and More navigation without horizontal page overflow", () => {
    render(<MusicWorkspaceShell {...panels} />);
    const nav = screen.getByRole("navigation", { name: "Music workspace" });
    expect(nav).toHaveTextContent("Player"); expect(nav).toHaveTextContent("Queue"); expect(nav).toHaveTextContent("Search"); expect(nav).toHaveTextContent("More");
    const more = screen.getByRole("button", { name: "More" });
    expect(more).toHaveAttribute("aria-controls", "music-history-panel");
    fireEvent.click(more);
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "music-history-tab");
    expect(screen.getByRole("tabpanel")).toContainElement(screen.getByLabelText("history-content"));
    expect(screen.getByRole("region", { name: "Music workspace" }).className).toContain("overflow-x-hidden");
  });

  it("opens the scoped mobile Search panel and focuses its visible input from the empty CTA", () => {
    render(<MusicWorkspaceShell {...panels} empty />);
    fireEvent.click(screen.getByRole("button", { name: "Add your first song" }));
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("Scoped search")).toHaveFocus();
    expect(screen.getByLabelText("search-content").parentElement).toHaveClass("block");
  });
});
