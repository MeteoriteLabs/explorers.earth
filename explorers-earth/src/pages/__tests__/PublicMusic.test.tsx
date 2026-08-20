import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import PublicMusic, { PublicMusicContent } from "../public/PublicMusic";

const loadPublicMusic = vi.hoisted(() => vi.fn());

vi.mock("../../features/music/publicMusicClient", () => ({
  publicMusicClient: { load: loadPublicMusic },
  PublicMusicError: class PublicMusicError extends Error {
    constructor(public readonly code: string, public readonly retryAfterSeconds?: number) { super(code); }
  },
}));

vi.mock("../../components/SEO", () => ({ default: () => null }));

describe("public Music page", () => {
  afterEach(() => {
    loadPublicMusic.mockReset();
    vi.useRealTimers();
    window.history.replaceState({}, "", "/");
  });

  it("uses the unified public 404 for private, missing, and invalid links", () => {
    render(<MemoryRouter><PublicMusicContent state="not-found" /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Music page unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to Explorers" })).toHaveAttribute("href", "/");
  });

  it("uses the approved zero-public-playlist copy", () => {
    render(<MemoryRouter><PublicMusicContent state="ready" resource={{ songs: [], playlists: [] }} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Music" })).toBeInTheDocument();
    expect(screen.getByText("No public playlists yet.")).toBeInTheDocument();
  });

  it("renders public playlist content without edit controls", () => {
    render(<MemoryRouter><PublicMusicContent state="ready" resource={{ songs: [], playlists: [{ id: 7, name: "Roads", description: null, isVisibleToGuests: true, songs: [{ id: 8, title: "North", artist: "Sky", thumbnailUrl: "https://images.example/north.jpg", position: 0 }] }] }} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Roads" })).toBeInTheDocument();
    expect(screen.getByText("North")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("enables Retry only after the server delay and runs the supplied recovery", () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    render(<MemoryRouter><PublicMusicContent state="rate-limited" retryAfterSeconds={2} onRetry={onRetry} /></MemoryRouter>);
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toBeDisabled();
    act(() => vi.advanceTimersByTime(1_999));
    expect(retry).toBeDisabled();
    act(() => vi.advanceTimersByTime(1));
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("reacquires the fragment for each slug, aborts the old read, and scrubs it on navigation", async () => {
    const first = new Promise(() => undefined);
    loadPublicMusic.mockReturnValueOnce(first).mockResolvedValueOnce({ songs: [], playlists: [] });
    window.history.replaceState({}, "", `/music/share/public-slug-a#access=${"A".repeat(43)}`);

    function Switcher() {
      const navigate = useNavigate();
      return <button type="button" onClick={() => navigate("/music/share/public-slug-b")}>Next Music page</button>;
    }
    render(
      <MemoryRouter initialEntries={["/music/share/public-slug-a"]}>
        <Switcher />
        <Routes><Route path="/music/share/:publicSlug" element={<PublicMusic />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(loadPublicMusic).toHaveBeenCalledTimes(1));
    const firstSignal = loadPublicMusic.mock.calls[0][2] as AbortSignal;
    expect(loadPublicMusic.mock.calls[0].slice(0, 2)).toEqual(["public-slug-a", "A".repeat(43)]);
    expect(window.location.hash).toBe("");

    window.history.replaceState({}, "", `/music/share/public-slug-b#access=${"B".repeat(43)}`);
    fireEvent.click(screen.getByRole("button", { name: "Next Music page" }));
    await waitFor(() => expect(loadPublicMusic).toHaveBeenCalledTimes(2));
    expect(firstSignal?.aborted).toBe(true);
    expect(loadPublicMusic.mock.calls[1].slice(0, 2)).toEqual(["public-slug-b", "B".repeat(43)]);
    expect(loadPublicMusic.mock.calls[1][2]).toBeInstanceOf(AbortSignal);
    expect(window.location.hash).toBe("");
  });
});
