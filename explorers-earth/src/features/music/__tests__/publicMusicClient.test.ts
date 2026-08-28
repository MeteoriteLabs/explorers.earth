import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublicMusicClient, parsePublicMusicDescriptor, parsePublicMusicResource } from "../publicMusicClient";

const publicSong = {
  id: "S".repeat(43), youtubeId: "abcdefghijk", title: "Song", artist: "Artist",
  thumbnailUrl: "https://img.example/song.jpg", position: 0, status: "queued" as const, playedAt: null,
};

const publicResource = {
  version: "music-public-resource/v1" as const,
  revision: 7,
  user: { username: "display-name", venueName: "Venue" },
  permissions: {
    allowSongRequests: true, allowGuestPlayOnDevice: false, allowPlaylistSharing: true,
    allowRecentlyPlayedVisibility: true, allowQueueVisibility: true,
  },
  currentlyPlaying: { ...publicSong, id: "P".repeat(43), status: "playing" as const },
  queue: { items: [publicSong], total: 1, truncated: false },
  recentlyPlayed: {
    items: [{ ...publicSong, id: "H".repeat(43), status: "played" as const, playedAt: "2026-08-28T12:00:00.000Z" }],
    total: 1, truncated: false,
  },
  playlists: {
    items: [{
      id: "L".repeat(43), name: "Public playlist", description: null,
      songs: {
        items: [{ ...publicSong, id: "V".repeat(43), status: "saved" as const }],
        total: 1, truncated: false,
      },
    }],
    total: 1, truncated: false,
  },
};

function success(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

describe("public Music client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("strictly parses the stable public descriptor without accepting authority aliases", () => {
    const descriptor = {
      version: "music-public-descriptor/v1",
      publication: { mode: "public", publicSlug: "public_slug-123", revision: 7 },
    };
    expect(parsePublicMusicDescriptor(descriptor)).toEqual(descriptor);
    expect(() => parsePublicMusicDescriptor({ ...descriptor, publication: { ...descriptor.publication, publicSlug: "short" } })).toThrow();
    expect(() => parsePublicMusicDescriptor({ ...descriptor, publication: { ...descriptor.publication, revision: -1 } })).toThrow();
    expect(() => parsePublicMusicDescriptor({ ...descriptor, publication: { ...descriptor.publication, userId: 9 } })).toThrow();
  });

  it("reads the additive versioned resource without owner authority or browser persistence", async () => {
    const fetcher = vi.fn().mockResolvedValue(success(publicResource));
    vi.stubGlobal("fetch", fetcher);
    const localGet = vi.spyOn(localStorage, "getItem");
    const sessionGet = vi.spyOn(sessionStorage, "getItem");

    await expect(createPublicMusicClient("https://music.example").load("public_slug-123")).resolves.toEqual(publicResource);

    expect(fetcher).toHaveBeenCalledWith("https://music.example/api/music/public-resource/v1/public_slug-123", {
      headers: { Accept: "application/json" },
    });
    expect(localGet).not.toHaveBeenCalled();
    expect(sessionGet).not.toHaveBeenCalled();
  });

  it("keeps an unlisted capability out of the URL and sends no owner credential", async () => {
    const fetcher = vi.fn().mockResolvedValue(success(publicResource));
    vi.stubGlobal("fetch", fetcher);
    await createPublicMusicClient("https://music.example/").load("public_slug-123", "a".repeat(43));
    expect(fetcher).toHaveBeenCalledWith("https://music.example/api/music/public-resource/v1/public_slug-123", {
      headers: { Accept: "application/json", "X-Music-Guest-Capability": "a".repeat(43) },
    });
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain("Authorization");
  });

  it.each([403, 404])("normalizes HTTP %s to the same public 404", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));
    await expect(createPublicMusicClient("https://music.example").load("public_slug-123"))
      .rejects.toMatchObject({ code: "PUBLIC_NOT_FOUND" });
  });

  it("rejects malformed slugs before the network and ignores malformed capabilities", async () => {
    const fetcher = vi.fn().mockResolvedValue(success(publicResource));
    vi.stubGlobal("fetch", fetcher);
    const client = createPublicMusicClient("https://music.example");
    await expect(client.load("short")).rejects.toMatchObject({ code: "PUBLIC_NOT_FOUND" });
    await client.load("public_slug-123", "not-a-capability");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("https://music.example/api/music/public-resource/v1/public_slug-123", {
      headers: { Accept: "application/json" },
    });
  });

  it("rejects unknown keys and any legacy optional-permission success shape", () => {
    for (const malformed of [
      { ...publicResource, internal: true },
      { ...publicResource, permissions: undefined },
      { songs: [], playlists: [], allowQueueVisibility: true },
      { ...publicResource, permissions: { ...publicResource.permissions, allowQueueVisibility: undefined } },
      { ...publicResource, permissions: { ...publicResource.permissions, userId: 17 } },
      { ...publicResource, user: { ...publicResource.user, documentId: "account-secret" } },
      { ...publicResource, queue: { ...publicResource.queue, items: [{ ...publicSong, credential: "secret" }] } },
    ]) expect(() => parsePublicMusicResource(malformed)).toThrow();
  });

  it("rejects oversized collections, invalid public song IDs/status, and inconsistent envelopes", () => {
    const queue101 = Array.from({ length: 101 }, (_, index) => ({
      ...publicSong, id: index.toString(36).padStart(43, "A"), position: index,
    }));
    for (const malformed of [
      { ...publicResource, queue: { items: queue101, total: 101, truncated: false } },
      { ...publicResource, recentlyPlayed: { items: Array(51).fill(publicResource.recentlyPlayed.items[0]), total: 51, truncated: false } },
      { ...publicResource, playlists: { items: Array(21).fill(publicResource.playlists.items[0]), total: 21, truncated: false } },
      { ...publicResource, queue: { items: [{ ...publicSong, id: 9 }], total: 1, truncated: false } },
      { ...publicResource, queue: { items: [{ ...publicSong, id: "short" }], total: 1, truncated: false } },
      { ...publicResource, queue: { items: [{ ...publicSong, status: "played" }], total: 1, truncated: false } },
      { ...publicResource, currentlyPlaying: { ...publicResource.currentlyPlaying!, playedAt: "2026-08-28T12:00:00.000Z" } },
      { ...publicResource, queue: { items: [{ ...publicSong, playedAt: "2026-08-28T12:00:00.000Z" }], total: 1, truncated: false } },
      { ...publicResource, playlists: { ...publicResource.playlists, items: [{ ...publicResource.playlists.items[0], songs: { items: [{ ...publicResource.playlists.items[0].songs.items[0], playedAt: "2026-08-28T12:00:00.000Z" }], total: 1, truncated: false } }] } },
      { ...publicResource, queue: { items: [publicSong], total: 0, truncated: false } },
      { ...publicResource, queue: { items: [publicSong], total: 2, truncated: false } },
    ]) expect(() => parsePublicMusicResource(malformed)).toThrow();
  });

  it("rejects protected data when its permission is false", () => {
    expect(() => parsePublicMusicResource({
      ...publicResource,
      permissions: { ...publicResource.permissions, allowQueueVisibility: false, allowGuestPlayOnDevice: false },
    })).toThrow();
    expect(() => parsePublicMusicResource({
      ...publicResource, permissions: { ...publicResource.permissions, allowPlaylistSharing: false },
    })).toThrow();
    expect(() => parsePublicMusicResource({
      ...publicResource, permissions: { ...publicResource.permissions, allowRecentlyPlayedVisibility: false },
    })).toThrow();
  });

  it("contains malformed, non-JSON, and oversized successful responses as public unavailability", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(success({ ...publicResource, revision: Number.MAX_SAFE_INTEGER + 1 }))
      .mockResolvedValueOnce(new Response("not-json", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...publicResource, padding: "x".repeat(512 * 1024) }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const client = createPublicMusicClient("https://music.example");
    await expect(client.load("public_slug-123")).rejects.toMatchObject({ code: "PUBLIC_UNAVAILABLE" });
    await expect(client.load("public_slug-123")).rejects.toMatchObject({ code: "PUBLIC_UNAVAILABLE" });
    await expect(client.load("public_slug-123")).rejects.toMatchObject({ code: "PUBLIC_UNAVAILABLE" });
  });

  it("contains rate limits with parsed or default retry durations", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "retry-after": "17" } }))
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "retry-after": "later" } }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }));
    vi.stubGlobal("fetch", fetcher);
    const client = createPublicMusicClient("https://music.example");
    await expect(client.load("public_slug-123")).rejects.toMatchObject({ code: "RATE_LIMITED", retryAfterSeconds: 17 });
    await expect(client.load("public_slug-123")).rejects.toMatchObject({ code: "RATE_LIMITED", retryAfterSeconds: 60 });
    await expect(client.load("public_slug-123")).rejects.toMatchObject({ code: "RATE_LIMITED", retryAfterSeconds: 60 });
  });

  it("contains other upstream failures and rejects insecure non-local service URLs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(createPublicMusicClient("http://localhost:5174/").load("public_slug-123"))
      .rejects.toMatchObject({ code: "PUBLIC_UNAVAILABLE" });
    expect(() => createPublicMusicClient("http://music.example")).toThrow("must use HTTPS");
  });

  it("keys an acquisition to its caller lifecycle and forwards the AbortSignal to fetch", async () => {
    const fetcher = vi.fn().mockResolvedValue(success(publicResource));
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    await createPublicMusicClient("https://music.example").load("public_slug-123", "a".repeat(43), controller.signal);
    expect(fetcher).toHaveBeenCalledWith("https://music.example/api/music/public-resource/v1/public_slug-123", {
      headers: { Accept: "application/json", "X-Music-Guest-Capability": "a".repeat(43) }, signal: controller.signal,
    });
  });
});
