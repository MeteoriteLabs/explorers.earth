import { MusicIdentityError } from "../../shared/musicError";

interface SearchInput { query: string; pageToken?: string; }

export function createYouTubeReadService(apiKey: string | undefined, fetchImpl: typeof fetch = fetch) {
  const key = apiKey?.trim();
  const request = async (path: "search" | "videos", parameters: Record<string, string>) => {
    if (!key) throw new MusicIdentityError("UPSTREAM_UNAVAILABLE", 503, "YouTube search is temporarily unavailable.", "retry", true, 30);
    const query = new URLSearchParams({ part: "snippet", key, ...parameters });
    let response: Response;
    try {
      response = await fetchImpl(`https://www.googleapis.com/youtube/v3/${path}?${query}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      throw new MusicIdentityError("UPSTREAM_UNAVAILABLE", 503, "YouTube search is temporarily unavailable.", "retry", true, 30);
    }
    if (!response.ok) throw new MusicIdentityError("UPSTREAM_UNAVAILABLE", 502, "YouTube search is temporarily unavailable.", "retry", true);
    const value = await response.json().catch(() => undefined);
    if (!value || !Array.isArray(value.items)) throw new MusicIdentityError("UPSTREAM_MALFORMED", 502, "YouTube returned an invalid response.", "retry", true);
    return value;
  };

  return {
    async search(input: SearchInput) {
      const value = await request("search", {
        maxResults: "20",
        q: input.query,
        type: "video",
        ...(input.pageToken ? { pageToken: input.pageToken } : {}),
      });
      return {
        nextPageToken: typeof value.nextPageToken === "string" ? value.nextPageToken : null,
        items: value.items.map(mapSearchItem).filter(Boolean),
      };
    },
    async videoFromUrl(url: string) {
      const videoId = youtubeVideoId(url);
      if (!videoId) return undefined;
      const value = await request("videos", { id: videoId });
      const item = value.items[0];
      return item ? mapVideoItem(item) : undefined;
    },
  };
}

function safeSnippet(value: any) {
  if (!value || typeof value.title !== "string" || typeof value.channelTitle !== "string"
      || typeof value.thumbnails?.default?.url !== "string") return undefined;
  return {
    title: value.title.slice(0, 1_024),
    channelTitle: value.channelTitle.slice(0, 1_024),
    thumbnails: { default: { url: value.thumbnails.default.url.slice(0, 2_048) } },
  };
}

function mapSearchItem(value: any) {
  const videoId = value?.id?.videoId;
  const snippet = safeSnippet(value?.snippet);
  return typeof videoId === "string" && /^[A-Za-z0-9_-]{11}$/.test(videoId) && snippet
    ? { id: { videoId }, snippet }
    : undefined;
}

function mapVideoItem(value: any) {
  const videoId = value?.id;
  const snippet = safeSnippet(value?.snippet);
  return typeof videoId === "string" && /^[A-Za-z0-9_-]{11}$/.test(videoId) && snippet
    ? { id: { videoId }, snippet }
    : undefined;
}

function youtubeVideoId(value: string): string | undefined {
  let url: URL;
  try { url = new URL(value); } catch { return undefined; }
  const host = url.hostname.toLowerCase();
  const candidate = host === "youtu.be" ? url.pathname.slice(1)
    : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host) ? url.searchParams.get("v") ?? ""
      : "";
  return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : undefined;
}
