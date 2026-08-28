const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const MAX_DURATION_MS = 300_000;

export type MusicPublicHttpOperation = "descriptor" | "resource" | "request";
export type MusicPublicHttpOutcome = "success" | "invalid" | "not_found" | "forbidden" | "rate_limited" | "conflict" | "too_large" | "unavailable";
export type MusicPublicInvalidationKind = "publication_changed" | "guest_controls_changed" | "playback_changed" | "queue_changed" | "playlists_changed";

export type MusicPublicOperationalEvent =
  | { version: "music-public-ops/v1"; event: "http"; operation: MusicPublicHttpOperation; outcome: MusicPublicHttpOutcome; status: number; latencyMs: number; requestId?: string }
  | { version: "music-public-ops/v1"; event: "listener"; outcome: "connected" | "reconnect_scheduled" | "malformed_notification" | "notification_fanout" | "fanout_failed" | "fatal"; retryDelayMs?: number; lagMs?: number; kind?: MusicPublicInvalidationKind }
  | { version: "music-public-ops/v1"; event: "socket"; outcome: "admitted" | "rejected" | "disconnected" | "invalidation_sent" | "revocation_enforced"; role?: "owner" | "guest" | "public"; reason?: "invalid" | "origin" | "revoked" | "transport"; kind?: MusicPublicInvalidationKind };

export interface MusicPublicObservability {
  startHttp(operation: MusicPublicHttpOperation, requestId: string | undefined, startedAt?: number): (outcome: MusicPublicHttpOutcome, status: number) => void;
  listener(outcome: Extract<MusicPublicOperationalEvent, { event: "listener" }>["outcome"], fields?: { retryDelayMs?: number; lagMs?: number; kind?: MusicPublicInvalidationKind }): void;
  socket(outcome: Extract<MusicPublicOperationalEvent, { event: "socket" }>["outcome"], fields?: { role?: "owner" | "guest" | "public"; reason?: "invalid" | "origin" | "revoked" | "transport"; kind?: MusicPublicInvalidationKind }): void;
}

const boundedDuration = (value: number) => Math.max(0, Math.min(MAX_DURATION_MS, Number.isFinite(value) ? Math.round(value) : MAX_DURATION_MS));

export function createMusicPublicObservability(options: {
  sink?: (event: MusicPublicOperationalEvent) => void;
  now?: () => number;
} = {}): MusicPublicObservability {
  const sink = options.sink ?? ((event) => console.info(JSON.stringify(event)));
  const now = options.now ?? Date.now;
  return {
    startHttp(operation, requestId, startedAt = now()) {
      const safeRequestId = requestId && SAFE_REQUEST_ID.test(requestId) ? requestId : undefined;
      return (outcome, status) => sink({
        version: "music-public-ops/v1", event: "http", operation, outcome,
        status: Math.max(100, Math.min(599, Math.round(status))), latencyMs: boundedDuration(now() - startedAt),
        ...(safeRequestId ? { requestId: safeRequestId } : {}),
      });
    },
    listener(outcome, fields = {}) {
      sink({ version: "music-public-ops/v1", event: "listener", outcome,
        ...(fields.retryDelayMs === undefined ? {} : { retryDelayMs: Math.min(30_000, boundedDuration(fields.retryDelayMs)) }),
        ...(fields.lagMs === undefined ? {} : { lagMs: boundedDuration(fields.lagMs) }),
        ...(fields.kind ? { kind: fields.kind } : {}),
      });
    },
    socket(outcome, fields = {}) { sink({
      version: "music-public-ops/v1", event: "socket", outcome,
      ...(fields.role ? { role: fields.role } : {}),
      ...(fields.reason ? { reason: fields.reason } : {}),
      ...(fields.kind ? { kind: fields.kind } : {}),
    }); },
  };
}
