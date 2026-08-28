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
    const subscription = subscribeToPublicMusic({ publicSlug: "public-one", initialRevision: 0, onInvalidate }, { socketFactory: () => socket as never, random: () => 0.5 });
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
    const subscription = subscribeToPublicMusic({ publicSlug: "public-one", initialRevision: 0, onInvalidate }, { socketFactory: () => socket as never, random: () => 0.5 });
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
    const subscription = subscribeToPublicMusic({ publicSlug: "public-one", initialRevision: 0, onInvalidate, signal: controller.signal }, { socketFactory: () => socket as never, random: () => 0.5 });
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

  it("seeds the rendered revision, rejects lagged snapshots, and catches up without concurrent reads", async () => {
    // Break caught: reconnect replaces rendered r12 with r11, or event r14 applies lagged r13.
    vi.useFakeTimers();
    const socket = new FakeSocket();
    const staleApply = vi.fn(); const caughtUpApply = vi.fn();
    const onInvalidate = vi.fn()
      .mockResolvedValueOnce({ revision: 11, apply: staleApply })
      .mockResolvedValueOnce({ revision: 14, apply: caughtUpApply });
    const subscription = subscribeToPublicMusic({ publicSlug: "public-one", initialRevision: 12, onInvalidate }, { socketFactory: () => socket as never, random: () => 0.5 });
    socket.emit("music_public_change", { version: "music-public-change/v1", kind: "queue_changed", revision: 10 });
    await vi.runOnlyPendingTimersAsync();
    expect(onInvalidate).not.toHaveBeenCalled();
    socket.emit("music_public_change", { version: "music-public-change/v1", kind: "queue_changed", revision: 14 });
    socket.emit("music_public_change", { version: "music-public-change/v1", kind: "playback_changed", revision: 13 });
    await vi.advanceTimersByTimeAsync(0);
    expect(onInvalidate).toHaveBeenCalledTimes(1);
    expect(staleApply).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onInvalidate).toHaveBeenCalledTimes(2);
    expect(caughtUpApply).toHaveBeenCalledOnce();
    subscription.unsubscribe();
  });

  it("aborts a request on hide and ignores both its success and error before a fresh visible read", async () => {
    // Break caught: a hidden generation mutates React state after its AbortSignal fires.
    vi.useFakeTimers();
    const socket = new FakeSocket(); const hiddenApply = vi.fn(); const visibleApply = vi.fn();
    let settleHidden!: (value: { revision: number; apply: () => void }) => void;
    const onError = vi.fn();
    const onInvalidate = vi.fn()
      .mockImplementationOnce((signal: AbortSignal) => new Promise((resolve) => {
        signal.addEventListener("abort", () => undefined); settleHidden = resolve as typeof settleHidden;
      }))
      .mockResolvedValueOnce({ revision: 13, apply: visibleApply });
    const subscription = subscribeToPublicMusic({ publicSlug: "public-one", initialRevision: 12, onInvalidate, onError }, { socketFactory: () => socket as never, random: () => 0.5 });
    socket.emit("connect"); await vi.advanceTimersByTimeAsync(0);
    const hiddenSignal = onInvalidate.mock.calls[0][0] as AbortSignal;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(hiddenSignal.aborted).toBe(true);
    settleHidden({ revision: 13, apply: hiddenApply }); await vi.advanceTimersByTimeAsync(0);
    expect(hiddenApply).not.toHaveBeenCalled(); expect(onError).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    document.dispatchEvent(new Event("visibilitychange")); await vi.advanceTimersByTimeAsync(0);
    expect(visibleApply).toHaveBeenCalledOnce();
    subscription.unsubscribe();
  });

  it("retries an active-socket transient failure with bounded backoff and Retry-After", async () => {
    // Break caught: a failed socket-triggered refresh never retries because fallback polling is disabled while connected.
    vi.useFakeTimers();
    const socket = new FakeSocket();
    const rateLimit = Object.assign(new Error("rate limited"), { retryAfterSeconds: 90 });
    const apply = vi.fn();
    const onInvalidate = vi.fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockRejectedValueOnce(rateLimit)
      .mockResolvedValueOnce({ revision: 3, apply });
    const subscription = subscribeToPublicMusic({ publicSlug: "public-one", initialRevision: 1, onInvalidate }, { socketFactory: () => socket as never, random: () => 0.5 });
    socket.emit("connect"); await vi.advanceTimersByTimeAsync(0);
    expect(onInvalidate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(29_999); expect(onInvalidate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); expect(onInvalidate).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(89_999); expect(onInvalidate).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); expect(onInvalidate).toHaveBeenCalledTimes(3);
    expect(apply).toHaveBeenCalledOnce();
    subscription.unsubscribe();
  });
});
