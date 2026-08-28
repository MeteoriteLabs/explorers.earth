export type PublicMusicBrowserOperationalEvent =
  | { version: "music-public-browser-ops/v1"; event: "parser_rejected"; parser: "descriptor" | "resource" | "request"; reason: "json" | "schema" | "size" | "encoding" }
  | { version: "music-public-browser-ops/v1"; event: "socket_reconnect"; outcome: "connected" | "disconnected" | "failed" }
  | { version: "music-public-browser-ops/v1"; event: "invalidation"; outcome: "accepted" | "stale" | "malformed" }
  | { version: "music-public-browser-ops/v1"; event: "fallback_poll"; outcome: "activated" | "success" | "failure"; delayMs?: number }
  | { version: "music-public-browser-ops/v1"; event: "revocation"; outcome: "enforced" };

type EventFields = {
  parser_rejected: { parser: "descriptor" | "resource" | "request"; reason: "json" | "schema" | "size" | "encoding" };
  socket_reconnect: { outcome: "connected" | "disconnected" | "failed" };
  invalidation: { outcome: "accepted" | "stale" | "malformed" };
  fallback_poll: { outcome: "activated" | "success" | "failure"; delayMs?: number };
  revocation: { outcome: "enforced" };
};

export function createPublicMusicObservability(sink: (event: PublicMusicBrowserOperationalEvent) => void = (event) => {
  console.info(JSON.stringify(event));
}) {
  return {
    record<E extends keyof EventFields>(event: E, fields: EventFields[E]) {
      let entry: PublicMusicBrowserOperationalEvent;
      if (event === "parser_rejected") {
        const safe = fields as EventFields["parser_rejected"];
        entry = { version: "music-public-browser-ops/v1", event, parser: safe.parser, reason: safe.reason };
      } else if (event === "fallback_poll") {
        const safe = fields as EventFields["fallback_poll"];
        entry = { version: "music-public-browser-ops/v1", event, outcome: safe.outcome,
          ...(safe.delayMs === undefined ? {} : { delayMs: Math.max(0, Math.min(300_000, Math.round(safe.delayMs))) }) };
      } else {
        const safe = fields as { outcome: "connected" | "disconnected" | "failed" | "accepted" | "stale" | "malformed" | "enforced" };
        entry = { version: "music-public-browser-ops/v1", event, outcome: safe.outcome } as PublicMusicBrowserOperationalEvent;
      }
      sink(entry);
    },
  };
}

export type PublicMusicObservability = ReturnType<typeof createPublicMusicObservability>;
export const publicMusicObservability = createPublicMusicObservability();
