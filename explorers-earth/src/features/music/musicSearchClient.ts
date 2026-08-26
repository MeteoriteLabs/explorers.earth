import { requestMusicJson, type MusicRequest } from "./musicWorkspaceClient";

export interface YouTubeSearchResponse {
  items: unknown[];
  nextPageToken: string | null;
}
export type MusicImportInput = {
  source: "youtube" | "spotify";
  url: string;
  destination: { kind: "queue" } | { kind: "playlist"; playlistId: number };
};
export interface MusicImportResult { addedCount: number; skippedCount: number; truncated: boolean }

export function createMusicSearchClient(request: MusicRequest) {
  return {
    searchYouTube: (query: string, pageToken?: string) => requestMusicJson<YouTubeSearchResponse>(request, {
      method: "POST", path: "/api/youtube/search", body: { query, ...(pageToken === undefined ? {} : { pageToken }) },
    }),
    videoFromUrl: (url: string) => requestMusicJson<unknown>(request, {
      method: "POST", path: "/api/youtube/video-from-url", body: { url },
    }),
    importPlaylist: (input: MusicImportInput, idempotencyKey: string) => requestMusicJson<MusicImportResult>(request, {
      method: "POST", path: "/api/music/imports", body: input, idempotencyKey,
    }),
  };
}
