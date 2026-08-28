import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import { PublicMusicRequest } from "../PublicMusicRequest";
import { PublicMusicError } from "../../publicMusicClient";

const video = { id: { videoId: "abcdefghijk" }, snippet: { title: "Song", channelTitle: "Artist", thumbnails: { default: { url: "https://img.example/song.jpg" } } } };

describe("PublicMusicRequest", () => {
  it("searches, presents an accessible result, and suppresses duplicate submissions", async () => {
    let resolve!: () => void;
    const requestSong = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
    const client = { search: vi.fn().mockResolvedValue({ items: [video], nextPageToken: null }), videoFromUrl: vi.fn(), requestSong };
    render(<PublicMusicRequest publicSlug="public_slug-123" allowed client={client as never} />);
    await userEvent.type(screen.getByLabelText("Search for a song or paste a YouTube URL"), "song");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByRole("button", { name: "Request Song by Artist" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Request Song by Artist" }));
    await userEvent.click(screen.getByRole("button", { name: "Requesting Song by Artist" }));
    expect(requestSong).toHaveBeenCalledTimes(1);
    resolve();
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Song requested");
    await waitFor(() => expect(status).toHaveFocus());
  });

  it("aborts obsolete search and closes results when permission is revoked", async () => {
    const signals: AbortSignal[] = [];
    const client = { search: vi.fn((_slug, _query, _cap, signal) => { signals.push(signal); return new Promise(() => undefined); }), videoFromUrl: vi.fn(), requestSong: vi.fn() };
    const { rerender } = render(<PublicMusicRequest publicSlug="public_slug-123" allowed client={client as never} />);
    await userEvent.type(screen.getByLabelText("Search for a song or paste a YouTube URL"), "first");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    rerender(<PublicMusicRequest publicSlug="public_slug-123" allowed={false} client={client as never} />);
    await waitFor(() => expect(signals[0].aborted).toBe(true));
    expect(screen.queryByLabelText("Search for a song or paste a YouTube URL")).not.toBeInTheDocument();
  });

  it("aborts an in-flight search when the query changes and never renders its stale result", async () => {
    let resolve!: (value: { items: typeof video[]; nextPageToken: null }) => void;
    let signal!: AbortSignal;
    const client = { search: vi.fn((_slug, _query, _cap, currentSignal) => { signal = currentSignal; return new Promise((done) => { resolve = done; }); }), videoFromUrl: vi.fn(), requestSong: vi.fn() };
    render(<PublicMusicRequest publicSlug="public_slug-123" allowed client={client as never} />);
    const input = screen.getByLabelText("Search for a song or paste a YouTube URL");
    await userEvent.type(input, "old");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.type(input, " new");
    expect(signal.aborted).toBe(true);
    resolve({ items: [video], nextPageToken: null });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Request Song by Artist" })).not.toBeInTheDocument());
  });

  it("reports only normalized outcomes without query, capability, slug, or media URL", async () => {
    const onOutcome = vi.fn();
    const client = { search: vi.fn().mockResolvedValue({ items: [], nextPageToken: null }), videoFromUrl: vi.fn(), requestSong: vi.fn() };
    render(<PublicMusicRequest publicSlug="secret-public-slug" capability={"C".repeat(43)} allowed client={client as never} onOutcome={onOutcome} />);
    await userEvent.type(screen.getByLabelText("Search for a song or paste a YouTube URL"), "private query");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText("No songs found.");
    expect(onOutcome).toHaveBeenCalledWith({ action: "search", outcome: "empty" });
    expect(JSON.stringify(onOutcome.mock.calls)).not.toMatch(/private query|secret-public-slug|CCCCCCCC|youtube|http/i);
  });

  it("has no automated accessibility violations in its instructional state", async () => {
    const client = { search: vi.fn(), videoFromUrl: vi.fn(), requestSong: vi.fn() };
    const { container } = render(<PublicMusicRequest publicSlug="public_slug-123" allowed client={client as never} />);
    expect((await axe.run(container)).violations).toEqual([]);
  });

  it("counts down a rate limit without enabling another search early", async () => {
    vi.useFakeTimers();
    try {
      const client = { search: vi.fn().mockRejectedValue(new PublicMusicError("RATE_LIMITED", 2)), videoFromUrl: vi.fn(), requestSong: vi.fn() };
      render(<PublicMusicRequest publicSlug="public_slug-123" allowed client={client as never} />);
      fireEvent.change(screen.getByLabelText("Search for a song or paste a YouTube URL"), { target: { value: "song" } });
      fireEvent.click(screen.getByRole("button", { name: "Search" }));
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByRole("button", { name: "Retry in 2s" })).toBeDisabled();
      act(() => vi.advanceTimersByTime(1_000));
      expect(screen.getByRole("button", { name: "Retry in 1s" })).toBeDisabled();
      act(() => vi.advanceTimersByTime(1_000));
      expect(screen.getByRole("button", { name: "Search" })).toBeEnabled();
    } finally { vi.useRealTimers(); }
  });

  it("counts down a request rate limit without enabling another request early", async () => {
    vi.useFakeTimers();
    try {
      const client = {
        search: vi.fn().mockResolvedValue({ items: [video], nextPageToken: null }),
        videoFromUrl: vi.fn(),
        requestSong: vi.fn().mockRejectedValue(new PublicMusicError("RATE_LIMITED", 2)),
      };
      render(<PublicMusicRequest publicSlug="public_slug-123" allowed client={client as never} />);
      fireEvent.change(screen.getByLabelText("Search for a song or paste a YouTube URL"), { target: { value: "song" } });
      fireEvent.click(screen.getByRole("button", { name: "Search" }));
      await act(async () => { await Promise.resolve(); });
      fireEvent.click(screen.getByRole("button", { name: "Request Song by Artist" }));
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByRole("button", { name: "Retry in 2 seconds: Song by Artist" })).toBeDisabled();
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
      expect(screen.getByRole("button", { name: "Request Song by Artist" })).toBeEnabled();
    } finally { vi.useRealTimers(); }
  });

  it("clears stale results and signals canonical reconciliation when submission is forbidden", async () => {
    const onCanonicalRevoked = vi.fn();
    const client = { search: vi.fn().mockResolvedValue({ items: [video], nextPageToken: null }), videoFromUrl: vi.fn(), requestSong: vi.fn().mockRejectedValue(new PublicMusicError("REQUEST_FORBIDDEN")) };
    render(<PublicMusicRequest publicSlug="public_slug-123" allowed client={client as never} onCanonicalRevoked={onCanonicalRevoked} />);
    await userEvent.type(screen.getByLabelText("Search for a song or paste a YouTube URL"), "song");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await userEvent.click(await screen.findByRole("button", { name: "Request Song by Artist" }));
    await screen.findByText("Song requests are no longer available.");
    expect(screen.queryByRole("list", { name: "Song search results" })).not.toBeInTheDocument();
    expect(onCanonicalRevoked).toHaveBeenCalledTimes(1);
  });
});
