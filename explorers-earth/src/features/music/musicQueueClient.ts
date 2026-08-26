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

function parseQueueResponse(value: unknown): MusicQueueResponse {
  const result = z.object({ version: z.literal("music-queue/v1"), revision: z.number().int().nonnegative(), songs: z.array(z.unknown()).max(500) }).strict().safeParse(value);
  if (!result.success) throw new MusicClientError("SERVICE_UNAVAILABLE", 502, "Music returned an invalid response.");
  return { ...result.data, songs: result.data.songs.map(parseMusicSong) };
}

export function createMusicQueueClient(request: MusicRequest) {
  return {
    loadDashboard: () => requestMusicJson<MusicDashboardResponse>(request, { method: "GET", path: "/api/music/dashboard" }, parseMusicDashboard),
    addSong: (song: MusicSongInput, idempotencyKey: string) => requestMusicJson<MusicSong>(request, {
      method: "POST", path: "/api/playlist/songs", body: song, idempotencyKey,
    }, parseMusicSong),
    setPlaying: (songId: number | null, idempotencyKey: string) => songId === null
      ? requestMusicEmpty(request, { method: "POST", path: "/api/playlist/currently-playing", body: { songId }, idempotencyKey })
      : requestMusicJson<MusicSong>(request, { method: "POST", path: "/api/playlist/currently-playing", body: { songId }, idempotencyKey }, parseMusicSong),
    removeSong: (songId: number, idempotencyKey: string) => requestMusicEmpty(request, {
      method: "DELETE", path: `/api/playlist/songs/${songId}`, idempotencyKey,
    }),
    removeSongs: (songIds: number[], idempotencyKey: string) => requestMusicEmpty(request, {
      method: "DELETE", path: "/api/playlist/songs/bulk", body: { songIds }, idempotencyKey,
    }),
    moveSong: (songId: number, position: number, idempotencyKey: string) => requestMusicJson<MusicSong>(request, {
      method: "PATCH", path: `/api/playlist/songs/${songId}/position`, body: { position }, idempotencyKey,
    }, parseMusicSong),
    clearHistory: (idempotencyKey: string) => requestMusicEmpty(request, {
      method: "DELETE", path: "/api/playlist/history", idempotencyKey,
    }),
    replaceQueue: (expectedRevision: number, songs: MusicQueueSelection[], idempotencyKey: string) => requestMusicJson<MusicQueueResponse>(request, {
      method: "POST", path: "/api/music/queue/replace", body: { expectedRevision, songs }, idempotencyKey,
    }, parseQueueResponse),
  };
}
