import { z } from "zod";

export const PUBLIC_MUSIC_RESOURCE_MAX_BYTES = 512 * 1_024;

const publicSlugSchema = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);
const revisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const publicIdSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const youtubeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
const dateTimeSchema = z.string().datetime({ offset: true });

const publicMusicDescriptorSchema = z.object({
  version: z.literal("music-public-descriptor/v1"),
  publication: z.object({
    mode: z.literal("public"),
    publicSlug: publicSlugSchema,
    revision: revisionSchema,
  }).strict(),
}).strict();

const publicMusicSongSchema = z.object({
  id: publicIdSchema,
  youtubeId: youtubeIdSchema,
  title: z.string().min(1).max(1_024),
  artist: z.string().min(1).max(1_024),
  thumbnailUrl: z.string().url().max(2_048).refine((value) => value.startsWith("https://") || value.startsWith("http://")).nullable(),
  position: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  status: z.enum(["queued", "playing", "played", "saved"]),
  playedAt: dateTimeSchema.nullable(),
}).strict();

const publicMusicSongEnvelope = (maxItems: number) => z.object({
  items: z.array(publicMusicSongSchema).max(maxItems),
  total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  truncated: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.total < value.items.length || value.truncated !== (value.total > value.items.length)) {
    context.addIssue({ code: "custom", message: "The public Music collection envelope is inconsistent." });
  }
});

const publicMusicPlaylistSchema = z.object({
  id: publicIdSchema,
  name: z.string().min(1).max(120),
  description: z.string().max(2_000).nullable(),
  songs: publicMusicSongEnvelope(50),
}).strict();

const publicMusicPlaylistEnvelopeSchema = z.object({
  items: z.array(publicMusicPlaylistSchema).max(20),
  total: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  truncated: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.total < value.items.length || value.truncated !== (value.total > value.items.length)) {
    context.addIssue({ code: "custom", message: "The public Music playlist envelope is inconsistent." });
  }
});

const publicMusicResourceSchema = z.object({
  version: z.literal("music-public-resource/v1"),
  revision: revisionSchema,
  user: z.object({
    username: z.string().min(1).max(255),
    venueName: z.string().max(255).nullable(),
  }).strict(),
  permissions: z.object({
    allowSongRequests: z.boolean(),
    allowGuestPlayOnDevice: z.boolean(),
    allowPlaylistSharing: z.boolean(),
    allowRecentlyPlayedVisibility: z.boolean(),
    allowQueueVisibility: z.boolean(),
  }).strict(),
  currentlyPlaying: publicMusicSongSchema.nullable(),
  queue: publicMusicSongEnvelope(100),
  recentlyPlayed: publicMusicSongEnvelope(50),
  playlists: publicMusicPlaylistEnvelopeSchema,
}).strict().superRefine((value, context) => {
  const empty = (envelope: { items: unknown[]; total: number; truncated: boolean }) =>
    envelope.items.length === 0 && envelope.total === 0 && envelope.truncated === false;
  if (!value.permissions.allowGuestPlayOnDevice && !value.permissions.allowQueueVisibility && value.currentlyPlaying !== null) {
    context.addIssue({ code: "custom", path: ["currentlyPlaying"], message: "Playback state is protected." });
  }
  if (!value.permissions.allowQueueVisibility && !empty(value.queue)) {
    context.addIssue({ code: "custom", path: ["queue"], message: "The queue is protected." });
  }
  if (!value.permissions.allowRecentlyPlayedVisibility && !empty(value.recentlyPlayed)) {
    context.addIssue({ code: "custom", path: ["recentlyPlayed"], message: "History is protected." });
  }
  if (!value.permissions.allowPlaylistSharing && !empty(value.playlists)) {
    context.addIssue({ code: "custom", path: ["playlists"], message: "Playlists are protected." });
  }
  if (value.currentlyPlaying && (value.currentlyPlaying.status !== "playing" || value.currentlyPlaying.playedAt !== null)) {
    context.addIssue({ code: "custom", path: ["currentlyPlaying"], message: "The current song state is invalid." });
  }
  if (value.queue.items.some(({ status, playedAt }) => status !== "queued" || playedAt !== null)) {
    context.addIssue({ code: "custom", path: ["queue"], message: "The queue song status is invalid." });
  }
  if (value.recentlyPlayed.items.some(({ status, playedAt }) => status !== "played" || playedAt === null)) {
    context.addIssue({ code: "custom", path: ["recentlyPlayed"], message: "The history song status is invalid." });
  }
  if (value.playlists.items.some((playlist) => playlist.songs.items.some(({ status, playedAt }) => status !== "saved" || playedAt !== null))) {
    context.addIssue({ code: "custom", path: ["playlists"], message: "The saved song status is invalid." });
  }
});

export type PublicMusicDescriptor = z.infer<typeof publicMusicDescriptorSchema>;
export type PublicMusicSong = z.infer<typeof publicMusicSongSchema>;
export type PublicMusicPlaylist = z.infer<typeof publicMusicPlaylistSchema>;
export type PublicMusicResource = z.infer<typeof publicMusicResourceSchema>;

export { derivePublicMusicViewPolicy } from "./publicMusicViewPolicy";
export type { PublicMusicViewPolicy } from "./publicMusicViewPolicy";

export function parsePublicMusicDescriptor(value: unknown): PublicMusicDescriptor {
  return publicMusicDescriptorSchema.parse(value);
}

export function parsePublicMusicResource(value: unknown): PublicMusicResource {
  return publicMusicResourceSchema.parse(value);
}

export class PublicMusicError extends Error {
  constructor(
    public readonly code: "PUBLIC_NOT_FOUND" | "RATE_LIMITED" | "PUBLIC_UNAVAILABLE" | "REQUEST_INVALID" | "QUEUE_FULL" | "REQUEST_FORBIDDEN",
    public readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = "PublicMusicError";
  }
}

const publicRequestVideoSchema = z.object({
  id: z.object({ videoId: youtubeIdSchema }).strict(),
  snippet: z.object({
    title: z.string().min(1).max(1_024),
    channelTitle: z.string().min(1).max(1_024),
    thumbnails: z.object({ default: z.object({ url: z.string().url().max(2_048) }).strict() }).strict(),
  }).strict(),
}).strict();
const publicRequestSearchSchema = z.object({ items: z.array(publicRequestVideoSchema).max(20), nextPageToken: z.string().max(256).nullable() }).strict();
const canonicalRequestSongSchema = z.object({
  youtubeId: youtubeIdSchema,
  title: z.string().min(1).max(1_024),
  artist: z.string().min(1).max(1_024),
  thumbnailUrl: z.string().url().max(2_048),
}).strict();
export type PublicMusicRequestVideo = z.infer<typeof publicRequestVideoSchema>;
export type PublicMusicRequestSong = z.infer<typeof canonicalRequestSongSchema>;

async function publicRequestJson(response: Response): Promise<unknown> {
  if (response.status === 403 || response.status === 404) throw new PublicMusicError("REQUEST_FORBIDDEN");
  if (response.status === 409) throw new PublicMusicError("REQUEST_INVALID");
  if (response.status === 413) throw new PublicMusicError("QUEUE_FULL");
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new PublicMusicError("RATE_LIMITED", Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter : 60);
  }
  if (response.status === 400) throw new PublicMusicError("REQUEST_INVALID");
  if (!response.ok) throw new PublicMusicError("PUBLIC_UNAVAILABLE");
  try { return await response.json(); } catch { throw new PublicMusicError("PUBLIC_UNAVAILABLE"); }
}

function normalizedBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("The Music service URL must use HTTPS.");
  }
  return url.toString().replace(/\/$/, "");
}

async function readBoundedPublicMusicBody(response: Response): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && /^\d+$/.test(contentLength)
      && Number(contentLength) > PUBLIC_MUSIC_RESOURCE_MAX_BYTES) {
    await response.body?.cancel();
    throw new Error("oversized response");
  }
  if (!response.body) throw new Error("missing response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let byteLength = 0;
  let body = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > PUBLIC_MUSIC_RESOURCE_MAX_BYTES) {
        await reader.cancel();
        throw new Error("oversized response");
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return body;
  } catch (error) {
    try { await reader.cancel(); } catch { /* the transport is already closed */ }
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export function createPublicMusicClient(baseUrl: string) {
  const base = normalizedBaseUrl(baseUrl);
  const requestHeaders = (capability?: string, idempotencyKey?: string) => ({
    Accept: "application/json", "Content-Type": "application/json",
    ...(capability && /^[A-Za-z0-9_-]{43}$/.test(capability) ? { "X-Music-Guest-Capability": capability } : {}),
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
  });
  return {
    async discover(accountDocumentId: string, signal?: AbortSignal): Promise<PublicMusicDescriptor> {
      if (!/^[A-Za-z0-9_-]{1,255}$/.test(accountDocumentId)) throw new PublicMusicError("PUBLIC_NOT_FOUND");
      const response = await fetch(`${base}/api/music/public-profile/${encodeURIComponent(accountDocumentId)}`, {
        headers: { Accept: "application/json" },
        ...(signal ? { signal } : {}),
      });
      if (response.status === 403 || response.status === 404) throw new PublicMusicError("PUBLIC_NOT_FOUND");
      if (response.status === 429) throw new PublicMusicError("RATE_LIMITED", 60);
      if (!response.ok) throw new PublicMusicError("PUBLIC_UNAVAILABLE");
      try {
        return parsePublicMusicDescriptor(await response.json());
      } catch {
        throw new PublicMusicError("PUBLIC_UNAVAILABLE");
      }
    },
    async load(publicSlug: string, capability?: string, signal?: AbortSignal): Promise<PublicMusicResource> {
      if (!publicSlugSchema.safeParse(publicSlug).success) throw new PublicMusicError("PUBLIC_NOT_FOUND");
      const headers: Record<string, string> = { Accept: "application/json" };
      if (capability && /^[A-Za-z0-9_-]{43}$/.test(capability)) headers["X-Music-Guest-Capability"] = capability;
      const response = await fetch(`${base}/api/music/public-resource/v1/${encodeURIComponent(publicSlug)}`, {
        headers,
        ...(signal ? { signal } : {}),
      });
      if (response.status === 403 || response.status === 404) throw new PublicMusicError("PUBLIC_NOT_FOUND");
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get("retry-after");
        const retryAfter = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
        throw new PublicMusicError("RATE_LIMITED", Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter : 60);
      }
      if (!response.ok) throw new PublicMusicError("PUBLIC_UNAVAILABLE");
      try {
        const body = await readBoundedPublicMusicBody(response);
        return parsePublicMusicResource(JSON.parse(body));
      } catch {
        throw new PublicMusicError("PUBLIC_UNAVAILABLE");
      }
    },
    async search(publicSlug: string, query: string, capability?: string, signal?: AbortSignal) {
      if (!publicSlugSchema.safeParse(publicSlug).success) throw new PublicMusicError("PUBLIC_NOT_FOUND");
      const normalized = query.trim();
      if (normalized.length < 1 || query.length > 200) throw new PublicMusicError("REQUEST_INVALID");
      const response = await fetch(`${base}/api/playlist/${encodeURIComponent(publicSlug)}/youtube/search`, {
        method: "POST", headers: requestHeaders(capability), body: JSON.stringify({ query: normalized }), ...(signal ? { signal } : {}),
      });
      const parsed = publicRequestSearchSchema.safeParse(await publicRequestJson(response));
      if (!parsed.success) throw new PublicMusicError("PUBLIC_UNAVAILABLE");
      return parsed.data;
    },
    async videoFromUrl(publicSlug: string, url: string, capability?: string, signal?: AbortSignal) {
      if (!publicSlugSchema.safeParse(publicSlug).success) throw new PublicMusicError("PUBLIC_NOT_FOUND");
      const parsedUrl = z.string().url().max(2_048).safeParse(url);
      if (!parsedUrl.success || !/^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(parsedUrl.data)) throw new PublicMusicError("REQUEST_INVALID");
      const response = await fetch(`${base}/api/playlist/${encodeURIComponent(publicSlug)}/youtube/video-from-url`, {
        method: "POST", headers: requestHeaders(capability), body: JSON.stringify({ url: parsedUrl.data }), ...(signal ? { signal } : {}),
      });
      const parsed = publicRequestVideoSchema.safeParse(await publicRequestJson(response));
      if (!parsed.success) throw new PublicMusicError("PUBLIC_UNAVAILABLE");
      return parsed.data;
    },
    async requestSong(publicSlug: string, song: PublicMusicRequestSong, capability: string | undefined, idempotencyKey: string) {
      if (!publicSlugSchema.safeParse(publicSlug).success || !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) throw new PublicMusicError("REQUEST_INVALID");
      const canonical = canonicalRequestSongSchema.safeParse(song);
      if (!canonical.success) throw new PublicMusicError("REQUEST_INVALID");
      const response = await fetch(`${base}/api/playlist/${encodeURIComponent(publicSlug)}/requests`, {
        method: "POST", headers: requestHeaders(capability, idempotencyKey), body: JSON.stringify(canonical.data),
      });
      const parsed = z.object({ accepted: z.literal(true) }).strict().safeParse(await publicRequestJson(response));
      if (!parsed.success) throw new PublicMusicError("PUBLIC_UNAVAILABLE");
      return parsed.data;
    },
  };
}

const musicBaseUrl = import.meta.env.VITE_LOCAL_TUNES_API_URL || "https://localtunes.earth";
export const publicMusicClient = createPublicMusicClient(musicBaseUrl);
