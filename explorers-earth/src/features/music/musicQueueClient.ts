import {
  requestMusicEmpty,
  requestMusicJson,
  parseMusicDashboard,
  parseMusicSong,
  type MusicDashboardResponse,
  type MusicRequest,
  type MusicSong,
} from "./musicWorkspaceClient";
import { MusicClientError } from "../../lib/localTunesApiClient";
import { z } from "zod";

export type MusicSongInput = Pick<MusicSong, "youtubeId" | "title" | "artist" | "thumbnailUrl">;
export type MusicQueueSelection = { playlistId: number; songId: number };
export interface MusicQueueResponse {
  version: "music-queue/v1";
  revision: number;
  songs: MusicSong[];
}

const songInputSchema = z.object({ youtubeId: z.string().regex(/^[A-Za-z0-9_-]{11}$/), title: z.string().min(1).max(1_024), artist: z.string().min(1).max(1_024), thumbnailUrl: z.string().min(1).max(2_048) }).strict();
const positiveId = z.number().int().positive();
const position = z.number().int().nonnegative();
const selections = z.array(z.object({ playlistId: positiveId, songId: positiveId }).strict()).max(500);
function input<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new MusicClientError("REQUEST_INVALID", 400, "The Music request is invalid.");
  return result.data;
}

function parseQueueResponse(value: unknown): MusicQueueResponse {
  const result = z.object({ version: z.literal("music-queue/v1"), revision: z.number().int().nonnegative(), songs: z.array(z.unknown()).max(500) }).strict().safeParse(value);
  if (!result.success) throw new MusicClientError("SERVICE_UNAVAILABLE", 502, "Music returned an invalid response.");
  return { ...result.data, songs: result.data.songs.map(parseMusicSong) };
}

export function createMusicQueueClient(request: MusicRequest) {
  return {
    loadDashboard: () => requestMusicJson<MusicDashboardResponse>(request, { method: "GET", path: "/api/music/dashboard" }, parseMusicDashboard),
    addSong: async (song: MusicSongInput, idempotencyKey: string) => {
      const safe = input(songInputSchema, song);
      return requestMusicJson<MusicSong>(request, {
        method: "POST", path: "/api/playlist/songs", body: { youtubeId: safe.youtubeId, title: safe.title, artist: safe.artist, thumbnailUrl: safe.thumbnailUrl }, idempotencyKey,
      }, parseMusicSong);
    },
    setPlaying: (songId: number | null, idempotencyKey: string) => (songId === null ? null : input(positiveId, songId)) === null
      ? requestMusicEmpty(request, { method: "POST", path: "/api/playlist/currently-playing", body: { songId }, idempotencyKey })
      : requestMusicJson<MusicSong>(request, { method: "POST", path: "/api/playlist/currently-playing", body: { songId }, idempotencyKey }, parseMusicSong),
    removeSong: (songId: number, idempotencyKey: string) => requestMusicEmpty(request, {
      method: "DELETE", path: `/api/playlist/songs/${input(positiveId, songId)}`, idempotencyKey,
    }),
    removeSongs: (songIds: number[], idempotencyKey: string) => requestMusicEmpty(request, {
      method: "DELETE", path: "/api/playlist/songs/bulk", body: { songIds: input(z.array(positiveId).min(1).max(500), songIds) }, idempotencyKey,
    }),
    moveSong: (songId: number, position: number, idempotencyKey: string) => requestMusicJson<MusicSong>(request, {
      method: "PATCH", path: `/api/playlist/songs/${input(positiveId, songId)}/position`, body: { position: input(z.number().int().nonnegative(), position) }, idempotencyKey,
    }, parseMusicSong),
    clearHistory: (idempotencyKey: string) => requestMusicEmpty(request, {
      method: "DELETE", path: "/api/playlist/history", idempotencyKey,
    }),
    replaceQueue: async (expectedRevision: number, songs: MusicQueueSelection[], idempotencyKey: string) => {
      const safeSongs = input(selections, songs);
      return requestMusicJson<MusicQueueResponse>(request, {
        method: "POST", path: "/api/music/queue/replace", body: { expectedRevision: input(position, expectedRevision), songs: safeSongs.map(({ playlistId, songId }) => ({ playlistId, songId })) }, idempotencyKey,
      }, parseQueueResponse);
    },
  };
}
