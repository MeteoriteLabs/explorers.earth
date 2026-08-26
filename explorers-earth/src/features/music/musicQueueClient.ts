import {
  requestMusicEmpty,
  requestMusicJson,
  type MusicDashboardResponse,
  type MusicRequest,
  type MusicSong,
} from "./musicWorkspaceClient";

export type MusicSongInput = Pick<MusicSong, "youtubeId" | "title" | "artist" | "thumbnailUrl">;
export type MusicQueueSelection = { playlistId: number; songId: number };
export interface MusicQueueResponse {
  version: "music-queue/v1";
  revision: number;
  songs: MusicSong[];
}

export function createMusicQueueClient(request: MusicRequest) {
  return {
    loadDashboard: () => requestMusicJson<MusicDashboardResponse>(request, { method: "GET", path: "/api/music/dashboard" }),
    addSong: (song: MusicSongInput, idempotencyKey: string) => requestMusicJson<MusicSong>(request, {
      method: "POST", path: "/api/playlist/songs", body: song, idempotencyKey,
    }),
    setPlaying: (songId: number | null, idempotencyKey: string) => songId === null
      ? requestMusicEmpty(request, { method: "POST", path: "/api/playlist/currently-playing", body: { songId }, idempotencyKey })
      : requestMusicJson<MusicSong>(request, { method: "POST", path: "/api/playlist/currently-playing", body: { songId }, idempotencyKey }),
    removeSong: (songId: number, idempotencyKey: string) => requestMusicEmpty(request, {
      method: "DELETE", path: `/api/playlist/songs/${songId}`, idempotencyKey,
    }),
    removeSongs: (songIds: number[], idempotencyKey: string) => requestMusicEmpty(request, {
      method: "DELETE", path: "/api/playlist/songs/bulk", body: { songIds }, idempotencyKey,
    }),
    moveSong: (songId: number, position: number, idempotencyKey: string) => requestMusicJson<MusicSong>(request, {
      method: "PATCH", path: `/api/playlist/songs/${songId}/position`, body: { position }, idempotencyKey,
    }),
    clearHistory: (idempotencyKey: string) => requestMusicEmpty(request, {
      method: "DELETE", path: "/api/playlist/history", idempotencyKey,
    }),
    replaceQueue: (expectedRevision: number, songs: MusicQueueSelection[], idempotencyKey: string) => requestMusicJson<MusicQueueResponse>(request, {
      method: "POST", path: "/api/music/queue/replace", body: { expectedRevision, songs }, idempotencyKey,
    }),
  };
}
