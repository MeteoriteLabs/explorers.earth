import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToPublicMusic } from "../publicMusicLiveClient";

class FakeSocket extends EventEmitter {
  disconnected = false;
  disconnect() { this.disconnected = true; this.removeAllListeners(); }
}

describe("public Music live client", () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("coalesces bursts, rejects stale revisions, and permits only one canonical refetch", async () => {
    // Break caught: socket payload becomes content authority or a burst starts concurrent HTTP reads.
    vi.useFakeTimers();
    const socket = new FakeSocket();
    let resolve!: (value: { revision: number }) => void;
    const onInvalidate = vi.fn(() => new Promise<{ revision: number }>((done) => { resolve = done; }));
    const subscription = subscribeToPublicMusic({ publicSlug: "public-one", onInvalidate }, { socketFactory: () => socket as never, random: () => 0.5 });
    socket.emit("music_public_change", { version: "music-public-change/v1", kind: "queue_changed", revision: 5 });
    socket.emit("music_public_change", { version: "music-public-change/v1", kind: "playback_changed", revision: 6 });
    socket.emit("music_public_change", { version: "music-public-change/v1", kind: "queue_changed", revision: 4 });
    await vi.runOnlyPendingTimersAsync();
    expect(onInvalidate).toHaveBeenCalledTimes(1);
    socket.emit("music_public_change", { version: "music-public-change/v1", kind: "queue_changed", revision: 7 });
    await vi.runOnlyPendingTimersAsync();
    expect(onInvalidate).toHaveBeenCalledTimes(1);
    resolve({ revision: 7 });
    await Promise.resolve(); await vi.runOnlyPendingTimersAsync();
    expect(onInvalidate).toHaveBeenCalledTimes(1);
    socket.emit("music_public_change", { version: "music-public-change/v1", kind: "queue_changed", revision: 6 });
    await vi.runOnlyPendingTimersAsync();
    expect(onInvalidate).toHaveBeenCalledTimes(1);
    subscription.unsubscribe();
  });

  it("refetches on reconnect, visibility, and online, polls at 30 seconds, then backs off 30/60/120/240/300 seconds", async () => {
    // Break caught: socket outage leaves a foreground page stale or retry failures create an unbounded storm.
    vi.useFakeTimers();
    const socket = new FakeSocket();
    const onInvalidate = vi.fn<() => Promise<{ revision: number }>>()
      .mockResolvedValueOnce({ revision: 1 })
      .mockResolvedValueOnce({ revision: 2 })
      .mockResolvedValueOnce({ revision: 3 })
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue({ revision: 4 });
    const subscription = subscribeToPublicMusic({ publicSlug: "public-one", onInvalidate }, { socketFactory: () => socket as never, random: () => 0.5 });
    socket.emit("connect"); await vi.advanceTimersByTimeAsync(0);
    document.dispatchEvent(new Event("visibilitychange")); await vi.advanceTimersByTimeAsync(0);
    window.dispatchEvent(new Event("online")); await vi.advanceTimersByTimeAsync(0);
    socket.emit("disconnect");
    expect(onInvalidate).toHaveBeenCalledTimes(3);
    for (const seconds of [30, 30, 60, 120, 240, 300]) {
      await vi.advanceTimersByTimeAsync(seconds * 1_000);
    }
    expect(onInvalidate).toHaveBeenCalledTimes(9);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(onInvalidate).toHaveBeenCalledTimes(10);
    subscription.unsubscribe();
  });

  it("stops immediately while hidden, offline, aborted, or unmounted", async () => {
    // Break caught: background/unmounted pages keep sockets, timers, or obsolete requests alive.
    vi.useFakeTimers();
    const socket = new FakeSocket();
    const controller = new AbortController();
    const onInvalidate = vi.fn(async () => ({ revision: 1 }));
    const subscription = subscribeToPublicMusic({ publicSlug: "public-one", onInvalidate, signal: controller.signal }, { socketFactory: () => socket as never, random: () => 0.5 });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    socket.emit("disconnect");
    await vi.advanceTimersByTimeAsync(600_000);
    expect(onInvalidate).not.toHaveBeenCalled();
    controller.abort();
    expect(socket.disconnected).toBe(true);
    subscription.unsubscribe();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });
});
