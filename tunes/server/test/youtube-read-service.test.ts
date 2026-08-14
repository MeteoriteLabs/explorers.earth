import { describe, expect, it, vi } from "vitest";
import { createYouTubeReadService } from "../services/youtubeReadService";

describe("typed YouTube read service", () => {
  it("returns only the product search fields and never exposes service authority", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      nextPageToken: "next",
      items: [{ id: { videoId: "abcdefghijk", channelId: "drop" }, snippet: {
        title: "title", channelTitle: "artist", description: "drop",
        thumbnails: { default: { url: "https://img", width: 120, height: 90 } },
      } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const service = createYouTubeReadService("server-secret", fetchImpl as typeof fetch);
    await expect(service.search({ query: "music", pageToken: "next" })).resolves.toEqual({
      nextPageToken: "next",
      items: [{ id: { videoId: "abcdefghijk" }, snippet: {
        title: "title", channelTitle: "artist", thumbnails: { default: { url: "https://img" } },
      } }],
    });
    expect(String(fetchImpl.mock.calls[0][0])).toContain("key=server-secret");
  });

  it("extracts an exact video ID and maps the typed video response", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      items: [{ id: "abcdefghijk", snippet: {
        title: "title", channelTitle: "artist", thumbnails: { default: { url: "https://img" } },
      } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const service = createYouTubeReadService("server-secret", fetchImpl as typeof fetch);
    await expect(service.videoFromUrl("https://youtu.be/abcdefghijk")).resolves.toMatchObject({ id: { videoId: "abcdefghijk" } });
    await expect(service.videoFromUrl("https://example.com/abcdefghijk")).resolves.toBeUndefined();
  });
});
