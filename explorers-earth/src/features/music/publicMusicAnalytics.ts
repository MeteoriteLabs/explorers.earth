export type PublicMusicProductEvent =
  | { name: "navigation_opened"; route: "friendly" | "direct" }
  | { name: "section_opened"; section: "player" | "request" | "queue" | "playlists" | "history" }
  | { name: "playlist_opened" }
  | { name: "song_selected"; source: "current" | "queue" | "playlist" }
  | { name: "playback_started"; source: "current" | "queue" | "playlist" }
  | { name: "request_submitted"; outcome: "accepted" | "invalid" | "rate_limited" | "queue_full" | "forbidden" | "unavailable" }
  | { name: "unavailable"; reason: "not_public" | "rate_limited" | "service_unavailable" };

import { z } from "zod";
import { useCallback } from "react";
import type { UTMParameters } from "../../utils/urlHelpers";
import { getSessionAttributionUtmParams } from "../../utils/urlHelpers";
import { createAnalyticsEventId, hasAnalyticsConsent } from "../../services/explorersAnalyticsClient";

const eventSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal("navigation_opened"), route: z.enum(["friendly", "direct"]) }).strict(),
  z.object({ name: z.literal("section_opened"), section: z.enum(["player", "request", "queue", "playlists", "history"]) }).strict(),
  z.object({ name: z.literal("playlist_opened") }).strict(),
  z.object({ name: z.literal("song_selected"), source: z.enum(["current", "queue", "playlist"]) }).strict(),
  z.object({ name: z.literal("playback_started"), source: z.enum(["current", "queue", "playlist"]) }).strict(),
  z.object({ name: z.literal("request_submitted"), outcome: z.enum(["accepted", "invalid", "rate_limited", "queue_full", "forbidden", "unavailable"]) }).strict(),
  z.object({ name: z.literal("unavailable"), reason: z.enum(["not_public", "rate_limited", "service_unavailable"]) }).strict(),
]);

const publicSlugPattern = /^[A-Za-z0-9_-]{8,128}$/;
const capabilityPattern = /^[A-Za-z0-9_-]{43}$/;

export interface PublicMusicAnalyticsTrackInput {
  publicSlug: string;
  capability?: string;
  eventId: string;
  event: PublicMusicProductEvent;
  attribution?: UTMParameters;
}

export function createPublicMusicAnalyticsClient(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  { sleep = (delayMs: number) => new Promise<void>((resolve) => window.setTimeout(resolve, delayMs)) }: {
    sleep?: (delayMs: number) => Promise<void>;
  } = {},
) {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" && base.hostname !== "localhost") {
    throw new Error("The Music service URL must use HTTPS.");
  }
  const normalizedBase = base.toString().replace(/\/$/, "");
  return {
    async track(input: PublicMusicAnalyticsTrackInput): Promise<void> {
      const parsed = eventSchema.safeParse(input.event);
      if (!parsed.success) throw new Error("Invalid public Music analytics event");
      if (!publicSlugPattern.test(input.publicSlug) || !/^.{8,128}$/.test(input.eventId)) {
        throw new Error("Invalid public Music analytics authority");
      }
      if (input.capability !== undefined && !capabilityPattern.test(input.capability)) {
        throw new Error("Invalid public Music analytics authority");
      }
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (input.capability) headers["X-Music-Guest-Capability"] = input.capability;
      const url = `${normalizedBase}/api/explorers/analytics/music/${encodeURIComponent(input.publicSlug)}/events`;
      const body = JSON.stringify({
        consent: true,
        eventId: input.eventId,
        event: parsed.data,
        ...(input.attribution && Object.keys(input.attribution).length > 0
          ? { utmParams: input.attribution }
          : {}),
      });
      let pendingPoll = 0;
      let transientRetries = 0;
      while (true) {
        let response: Response;
        try {
          response = await fetchImpl(url, {
            method: "POST",
            headers,
            referrerPolicy: "no-referrer",
            signal: AbortSignal.timeout(10_000),
            body,
          });
        } catch (error) {
          if (transientRetries >= 1) throw error;
          transientRetries += 1;
          await sleep(250);
          continue;
        }
        if (response.ok && response.status !== 202) return;
        if (response.status !== 202 || pendingPoll === 7) {
          throw new Error(`Public Music analytics request failed with ${response.status}`);
        }
        await sleep(Math.min(250 * 2 ** pendingPoll, 2_000));
        pendingPoll += 1;
      }
    },
  };
}

type AnalyticsClient = ReturnType<typeof createPublicMusicAnalyticsClient>;
type DeliveryRecord = { eventId: string; state: "pending" | "retry" | "committed" };
const memoryDeliveries = new Map<string, DeliveryRecord>();
const DEFAULT_LOCAL_TUNES_URL = import.meta.env.VITE_LOCAL_TUNES_API_URL || "https://localtunes.earth";
const defaultClient = createPublicMusicAnalyticsClient(DEFAULT_LOCAL_TUNES_URL);

function readDelivery(key: string): DeliveryRecord | undefined {
  const memory = memoryDeliveries.get(key);
  if (memory) return memory;
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) ?? "null") as DeliveryRecord | null;
    if (parsed && typeof parsed.eventId === "string" && ["pending", "retry", "committed"].includes(parsed.state)) {
      memoryDeliveries.set(key, parsed);
      return parsed;
    }
  } catch { /* storage can be unavailable */ }
  return undefined;
}

function writeDelivery(key: string, record: DeliveryRecord): void {
  memoryDeliveries.set(key, record);
  try { sessionStorage.setItem(key, JSON.stringify(record)); } catch { /* memory still deduplicates */ }
}

export function usePublicMusicProductAnalytics({
  publicSlug,
  capability,
  route,
  client = defaultClient,
}: {
  publicSlug?: string;
  capability?: string;
  route: "friendly" | "direct";
  client?: Pick<AnalyticsClient, "track">;
}) {
  return useCallback(async (event: PublicMusicProductEvent): Promise<void> => {
    if (!publicSlug || !hasAnalyticsConsent()) return;
    const key = `explorers.music.analytics.v1:${publicSlug}:${JSON.stringify(event)}`;
    const existing = readDelivery(key);
    if (existing?.state === "pending" || existing?.state === "committed") return;
    const eventId = existing?.eventId ?? createAnalyticsEventId();
    writeDelivery(key, { eventId, state: "pending" });
    try {
      await client.track({
        publicSlug,
        capability,
        eventId,
        event,
        attribution: getSessionAttributionUtmParams(),
      });
      writeDelivery(key, { eventId, state: "committed" });
    } catch {
      writeDelivery(key, { eventId, state: "retry" });
    }
  }, [capability, client, publicSlug, route]);
}
