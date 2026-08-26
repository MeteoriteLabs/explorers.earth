import { MusicClientError } from "../../lib/localTunesApiClient";
import { requestMusicJson, type MusicRequest } from "./musicWorkspaceClient";
import { z } from "zod";

export interface YouTubeVideo {
  id: { videoId: string };
  snippet: { title: string; channelTitle: string; thumbnails: { default: { url: string } } };
}
export interface YouTubeSearchResponse {
  items: YouTubeVideo[];
  nextPageToken: string | null;
}

const invalid = () => new MusicClientError("SERVICE_UNAVAILABLE", 502, "Music returned an invalid response.");
const videoSchema = z.object({
  id: z.object({ videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/) }).strict(),
  snippet: z.object({
    title: z.string().min(1).max(1_024), channelTitle: z.string().min(1).max(1_024),
    thumbnails: z.object({ default: z.object({ url: z.string().min(1).max(2_048) }).strict() }).strict(),
  }).strict(),
}).strict();
function parseVideo(value: unknown): YouTubeVideo {
  const result = videoSchema.safeParse(value);
  if (!result.success) throw invalid();
  return result.data;
}
function parseSearch(value: unknown): YouTubeSearchResponse {
  const result = z.object({ items: z.array(z.unknown()).max(20), nextPageToken: z.string().max(256).nullable() }).strict().safeParse(value);
  if (!result.success) throw invalid();
  return { items: result.data.items.map(parseVideo), nextPageToken: result.data.nextPageToken };
}

export function createMusicSearchClient(request: MusicRequest) {
  return {
    searchYouTube: (query: string, pageToken?: string) => requestMusicJson<YouTubeSearchResponse>(request, {
      method: "POST", path: "/api/youtube/search", body: { query, ...(pageToken === undefined ? {} : { pageToken }) },
    }, parseSearch),
    videoFromUrl: (url: string) => requestMusicJson<YouTubeVideo>(request, {
      method: "POST", path: "/api/youtube/video-from-url", body: { url },
    }, parseVideo),
  };
}
