import { io } from "socket.io-client";

const EVENT_KINDS = new Set([
  "publication_changed", "guest_controls_changed", "playback_changed", "queue_changed", "playlists_changed",
]);
const FAILURE_BACKOFF_MS = [30_000, 60_000, 120_000, 240_000, 300_000] as const;

type SocketLike = {
  on(event: string, listener: (...args: any[]) => void): unknown;
  off(event: string, listener: (...args: any[]) => void): unknown;
  disconnect(): unknown;
};

export interface PublicMusicSubscription { unsubscribe(): void }

export function subscribeToPublicMusic(
  options: {
    publicSlug: string;
    capability?: string;
    onInvalidate(signal: AbortSignal): Promise<{ revision: number } | void>;
    signal?: AbortSignal;
  },
  dependencies: {
    socketFactory?: (auth: Record<string, string>) => SocketLike;
    random?: () => number;
  } = {},
): PublicMusicSubscription {
  const random = dependencies.random ?? Math.random;
  const socketFactory = dependencies.socketFactory ?? ((auth) => io(
    import.meta.env.VITE_LOCAL_TUNES_API_URL || "https://localtunes.earth",
    {
      path: "/ws", transports: ["websocket", "polling"], auth,
      reconnection: true, reconnectionDelay: 1_000, reconnectionDelayMax: 30_000, randomizationFactor: 0.2,
    },
  ));
  const socket = socketFactory({ publicSlug: options.publicSlug, ...(options.capability ? { guestCapability: options.capability } : {}) });
  let stopped = false;
  let socketAvailable = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;
  let requestController: AbortController | undefined;
  let lastAppliedRevision = -1;
  let pendingRevision = -1;
  let failureIndex = 0;

  const active = () => !stopped && document.visibilityState !== "hidden" && navigator.onLine !== false;
  const clearTimer = () => { if (timer) clearTimeout(timer); timer = undefined; };
  const jitter = (base: number) => Math.round(base * (0.8 + 0.4 * Math.min(1, Math.max(0, random()))));
  const schedulePoll = (baseMs: number) => {
    clearTimer();
    if (!active() || socketAvailable) return;
    timer = setTimeout(() => { timer = undefined; void refresh("poll"); }, jitter(baseMs));
  };
  const refresh = (reason: "event" | "reconnect" | "resume" | "poll"): Promise<void> => {
    if (!active()) return Promise.resolve();
    if (inFlight) return inFlight;
    requestController = new AbortController();
    const requestedRevision = pendingRevision;
    inFlight = options.onInvalidate(requestController.signal).then((result) => {
      if (stopped || requestController?.signal.aborted) return;
      const revision = result?.revision;
      if (Number.isSafeInteger(revision) && Number(revision) >= 0) lastAppliedRevision = Math.max(lastAppliedRevision, Number(revision));
      failureIndex = 0;
      if (!socketAvailable) schedulePoll(30_000);
    }).catch(() => {
      if (!stopped && !requestController?.signal.aborted && !socketAvailable) {
        const delay = FAILURE_BACKOFF_MS[Math.min(failureIndex, FAILURE_BACKOFF_MS.length - 1)];
        failureIndex = Math.min(failureIndex + 1, FAILURE_BACKOFF_MS.length - 1);
        schedulePoll(delay);
      }
    }).finally(() => {
      inFlight = undefined;
      requestController = undefined;
      if (active() && pendingRevision > Math.max(lastAppliedRevision, requestedRevision)) {
        timer = setTimeout(() => { timer = undefined; void refresh("event"); }, 0);
      }
    });
    void reason;
    return inFlight;
  };
  const onChange = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const event = value as Record<string, unknown>;
    if (Object.keys(event).sort().join(",") !== "kind,revision,version"
        || event.version !== "music-public-change/v1" || typeof event.kind !== "string" || !EVENT_KINDS.has(event.kind)
        || !Number.isSafeInteger(event.revision) || Number(event.revision) <= lastAppliedRevision) return;
    pendingRevision = Math.max(pendingRevision, Number(event.revision));
    if (!inFlight && !timer && active()) timer = setTimeout(() => { timer = undefined; void refresh("event"); }, 0);
  };
  const onConnect = () => { socketAvailable = true; clearTimer(); void refresh("reconnect"); };
  const onDisconnect = () => { socketAvailable = false; schedulePoll(30_000); };
  const onVisibility = () => {
    clearTimer();
    if (document.visibilityState !== "hidden" && navigator.onLine !== false) void refresh("resume");
  };
  const onOnline = () => { clearTimer(); void refresh("resume"); };
  const onOffline = () => { clearTimer(); requestController?.abort(); };
  const unsubscribe = () => {
    if (stopped) return;
    stopped = true; clearTimer(); requestController?.abort();
    socket.off("music_public_change", onChange); socket.off("connect", onConnect); socket.off("disconnect", onDisconnect); socket.off("connect_error", onDisconnect);
    document.removeEventListener("visibilitychange", onVisibility); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline);
    socket.disconnect();
  };
  socket.on("music_public_change", onChange); socket.on("connect", onConnect); socket.on("disconnect", onDisconnect); socket.on("connect_error", onDisconnect);
  document.addEventListener("visibilitychange", onVisibility); window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline);
  options.signal?.addEventListener("abort", unsubscribe, { once: true });
  if (options.signal?.aborted) unsubscribe();
  return { unsubscribe };
}
