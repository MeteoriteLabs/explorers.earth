import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePublicMusicProductAnalytics } from "../publicMusicAnalytics";

describe("usePublicMusicProductAnalytics", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.setItem("explorers-cookie-consent", JSON.stringify({ necessary: true, analytics: true }));
    window.history.replaceState({}, "", "/alice/music?utm_source=newsletter&utm_medium=email");
  });

  it("deduplicates one opaque occurrence but records a later identical action", async () => {
    const track = vi.fn(async () => undefined);
    const { result } = renderHook(() => usePublicMusicProductAnalytics({
      publicSlug: "public-owner", route: "friendly", client: { track },
    }), { wrapper: StrictMode });
    await act(async () => { await Promise.all([
      result.current({ name: "navigation_opened", route: "friendly" }, "occurrence-00000001"),
      result.current({ name: "navigation_opened", route: "friendly" }, "occurrence-00000001"),
    ]); });
    expect(track).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current({ name: "navigation_opened", route: "friendly" }, "occurrence-00000002"); });
    expect(track).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenCalledWith(expect.objectContaining({
      publicSlug: "public-owner",
      event: { name: "navigation_opened", route: "friendly" },
      attribution: { utm_source: "newsletter", utm_medium: "email" },
      eventId: expect.any(String),
    }));
    expect(JSON.stringify(track.mock.calls[0][0])).not.toContain("account");
  });

  it("retries a failed delivery with the same event ID", async () => {
    const track = vi.fn().mockRejectedValueOnce(new Error("connection lost after commit")).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => usePublicMusicProductAnalytics({
      publicSlug: "public-owner", route: "direct", client: { track },
    }));
    await act(async () => { await result.current({ name: "playlist_opened" }, "occurrence-00000003"); });
    await act(async () => { await result.current({ name: "playlist_opened" }, "occurrence-00000003"); });
    expect(track).toHaveBeenCalledTimes(2);
    expect(track.mock.calls[1][0].eventId).toBe(track.mock.calls[0][0].eventId);
  });

  it("never persists route authority, capability, event properties, or committed receipts", async () => {
    const track = vi.fn(async () => undefined);
    const { result } = renderHook(() => usePublicMusicProductAnalytics({
      publicSlug: "secret-public-owner", capability: "C".repeat(43), route: "direct", client: { track },
    }));
    await act(async () => { await result.current({ name: "request_submitted", outcome: "forbidden" }, "occurrence-00000004"); });
    const storage = Object.keys(sessionStorage).filter((key) => key.startsWith("explorers.music.analytics"))
      .map((key) => [key, sessionStorage.getItem(key)]);
    expect(JSON.stringify(storage)).not.toMatch(/secret-public-owner|CCCCCCCC|request_submitted|forbidden|account|https?:|\?/i);
    expect(storage).toHaveLength(0);
  });

  it("does nothing without consent", async () => {
    localStorage.setItem("explorers-cookie-consent", JSON.stringify({ necessary: true, analytics: false }));
    const track = vi.fn();
    const { result } = renderHook(() => usePublicMusicProductAnalytics({
      publicSlug: "unlisted-owner", capability: "C".repeat(43), route: "direct", client: { track },
    }));
    await act(async () => { await result.current({ name: "navigation_opened", route: "direct" }); });
    expect(track).not.toHaveBeenCalled();
  });
});
