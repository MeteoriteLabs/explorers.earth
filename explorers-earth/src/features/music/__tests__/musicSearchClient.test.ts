import { describe, expect, it, vi } from "vitest";
import { createMusicSearchClient } from "../musicSearchClient";

describe("credential-aware Music search client", () => {
  it("uses canonical YouTube search, URL, and import requests", async () => {
    const request = vi.fn(async (input: { path: string }) => input.path === "/api/music/imports"
      ? new Response(JSON.stringify({ addedCount: 2, skippedCount: 1, truncated: false }), { status: 201 })
      : new Response(JSON.stringify(input.path.endsWith("search") ? { items: [], nextPageToken: "next" } : { id: { videoId: "abcdefghijk" }, snippet: { title: "Song", channelTitle: "Artist", thumbnails: { high: { url: "https://img" } } } })));
    const client = createMusicSearchClient(request);
    await client.searchYouTube(" road music ", "page-2");
    await client.videoFromUrl("https://youtu.be/abcdefghijk");
    await client.importPlaylist({ source: "youtube", url: "https://youtube.com/playlist?list=x", destination: { kind: "queue" } }, "import-list-1");

    expect(request.mock.calls.map(([input]) => input)).toEqual([
      { method: "POST", path: "/api/youtube/search", body: { query: " road music ", pageToken: "page-2" } },
      { method: "POST", path: "/api/youtube/video-from-url", body: { url: "https://youtu.be/abcdefghijk" } },
      { method: "POST", path: "/api/music/imports", body: { source: "youtube", url: "https://youtube.com/playlist?list=x", destination: { kind: "queue" } }, idempotencyKey: "import-list-1" },
    ]);
    expect(JSON.stringify(request.mock.calls)).not.toMatch(/username|email|ownerId|accountId|documentId|musicUserId/i);
  });

  it("contains unsuccessful search responses", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "RATE_LIMITED", retryable: true } }), { status: 429, headers: { "retry-after": "7", "x-request-id": "search-request" } }));
    await expect(createMusicSearchClient(request).searchYouTube("music")).rejects.toMatchObject({ status: 429, upstreamCode: "RATE_LIMITED", retryable: true, retryAfterSeconds: 7, requestId: "search-request" });
  });
});
