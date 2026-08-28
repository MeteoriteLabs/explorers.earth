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

  it("commits a normalized interaction once across duplicate calls and StrictMode effects", async () => {
    const track = vi.fn(async () => undefined);
    const { result } = renderHook(() => usePublicMusicProductAnalytics({
      publicSlug: "public-owner", route: "friendly", client: { track },
    }), { wrapper: StrictMode });
    await act(async () => { await Promise.all([
      result.current({ name: "navigation_opened", route: "friendly" }),
      result.current({ name: "navigation_opened", route: "friendly" }),
    ]); });
    expect(track).toHaveBeenCalledTimes(1);
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
    await act(async () => { await result.current({ name: "playlist_opened" }); });
    await act(async () => { await result.current({ name: "playlist_opened" }); });
    expect(track).toHaveBeenCalledTimes(2);
    expect(track.mock.calls[1][0].eventId).toBe(track.mock.calls[0][0].eventId);
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
