import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToOwnerMusic } from "../ownerMusicLiveClient";

type Listener = (...args: any[]) => void;
function socketHarness() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    socket: {
      on: vi.fn((event: string, listener: Listener) => { const set = listeners.get(event) ?? new Set(); set.add(listener); listeners.set(event, set); }),
      off: vi.fn((event: string, listener: Listener) => listeners.get(event)?.delete(listener)),
      disconnect: vi.fn(),
    },
    emit(event: string, value?: unknown) { listeners.get(event)?.forEach((listener) => listener(value)); },
  };
}

afterEach(() => vi.useRealTimers());

describe("owner Music live invalidation", () => {
  it("authenticates with the ephemeral owner credential and performs reconnect catch-up", async () => {
    const harness = socketHarness();
    const socketFactory = vi.fn(() => harness.socket);
    const onInvalidate = vi.fn(async () => ({ revision: 8 }));
    subscribeToOwnerMusic({ token: "owner.token.value", initialRevision: 7, onInvalidate }, { socketFactory });
    expect(socketFactory).toHaveBeenCalledWith({ token: "owner.token.value" });
    harness.emit("connect");
    await vi.waitFor(() => expect(onInvalidate).toHaveBeenCalledTimes(1));
  });

  it("ignores malformed and stale envelopes, then coalesces a burst into canonical refetches", async () => {
    vi.useFakeTimers();
    const harness = socketHarness();
    let resolveFirst!: (value: { revision: number }) => void;
    const onInvalidate = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValue({ revision: 12 });
    subscribeToOwnerMusic({ token: "owner.token.value", initialRevision: 7, onInvalidate }, { socketFactory: () => harness.socket });
    harness.emit("music_owner_change", { version: "wrong", kind: "queue_changed", revision: 8 });
    harness.emit("music_owner_change", { version: "music-owner-change/v1", kind: "queue_changed", revision: 7 });
    harness.emit("music_owner_change", { version: "music-owner-change/v1", kind: "queue_changed", revision: 8 });
    await vi.runAllTimersAsync();
    expect(onInvalidate).toHaveBeenCalledTimes(1);
    harness.emit("music_owner_change", { version: "music-owner-change/v1", kind: "playlists_changed", revision: 12 });
    resolveFirst({ revision: 8 });
    await Promise.resolve(); await vi.runAllTimersAsync();
    expect(onInvalidate).toHaveBeenCalledTimes(2);
  });

  it("aborts in-flight work and removes listeners on unsubscribe", async () => {
    const harness = socketHarness();
    let signal: AbortSignal | undefined;
    const subscription = subscribeToOwnerMusic({
      token: "owner.token.value", initialRevision: 0,
      onInvalidate: vi.fn(async (nextSignal) => { signal = nextSignal; return new Promise(() => undefined); }),
    }, { socketFactory: () => harness.socket });
    harness.emit("connect");
    await vi.waitFor(() => expect(signal).toBeDefined());
    subscription.unsubscribe();
    expect(signal?.aborted).toBe(true);
    expect(harness.socket.disconnect).toHaveBeenCalledOnce();
  });
});
