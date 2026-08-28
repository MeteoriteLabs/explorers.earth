import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPublicMusicClient,
  derivePublicMusicViewPolicy,
  parsePublicMusicDescriptor,
  parsePublicMusicResource,
  PUBLIC_MUSIC_RESOURCE_MAX_BYTES,
  type PublicMusicResource,
} from "../publicMusicClient";

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

function streamedSuccess(chunks: string[], contentLength?: string) {
  const encoder = new TextEncoder();
  let index = 0;
  let cancelled = false;
  const response = new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) controller.close();
      else controller.enqueue(encoder.encode(chunks[index++]));
    },
    cancel() { cancelled = true; },
  }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      ...(contentLength === undefined ? {} : { "content-length": contentLength }),
    },
  });
  return { response, wasCancelled: () => cancelled };
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

  it.each([
    [0, false, false, false, false, false, false],
    [1, true, false, false, false, false, false],
    [2, false, true, false, false, false, true],
    [3, true, true, false, false, false, true],
    [4, false, false, true, false, false, false],
    [5, true, false, true, false, false, false],
    [6, false, true, true, false, false, true],
    [7, true, true, true, false, false, true],
    [8, false, false, false, true, false, false],
    [9, true, false, false, true, false, false],
    [10, false, true, false, true, false, true],
    [11, true, true, false, true, false, true],
    [12, false, false, true, true, false, false],
    [13, true, false, true, true, false, false],
    [14, false, true, true, true, false, true],
    [15, true, true, true, true, false, true],
    [16, false, false, false, false, true, true],
    [17, true, false, false, false, true, true],
    [18, false, true, false, false, true, true],
    [19, true, true, false, false, true, true],
    [20, false, false, true, false, true, true],
    [21, true, false, true, false, true, true],
    [22, false, true, true, false, true, true],
    [23, true, true, true, false, true, true],
    [24, false, false, false, true, true, true],
    [25, true, false, false, true, true, true],
    [26, false, true, false, true, true, true],
    [27, true, true, false, true, true, true],
    [28, false, false, true, true, true, true],
    [29, true, false, true, true, true, true],
    [30, false, true, true, true, true, true],
    [31, true, true, true, true, true, true],
  ] as const)("derives data visibility and interactivity independently for permission mask %i", (
    mask,
    requestEligible,
    playerEligible,
    playlistsVisible,
    historyVisible,
    queueVisible,
    currentVisible,
  ) => {
    // Break caught: one permission grants another field/control, especially queue visibility granting playback.
    const permissions = {
      allowSongRequests: (mask & 1) !== 0,
      allowGuestPlayOnDevice: (mask & 2) !== 0,
      allowPlaylistSharing: (mask & 4) !== 0,
      allowRecentlyPlayedVisibility: (mask & 8) !== 0,
      allowQueueVisibility: (mask & 16) !== 0,
    };
    expect(derivePublicMusicViewPolicy({ ...publicResource, permissions })).toEqual({
      requestEligible,
      playerEligible,
      playlistsVisible,
      historyVisible,
      queueVisible,
      currentVisible,
    });
  });

  it.each([
    ["current-only", {
      currentlyPlaying: publicResource.currentlyPlaying,
      queue: { items: [], total: 0, truncated: false },
      playlists: { items: [], total: 0, truncated: false },
    }],
    ["queue-only", {
      currentlyPlaying: null,
      queue: publicResource.queue,
      playlists: { items: [], total: 0, truncated: false },
    }],
    ["playlist-only", {
      currentlyPlaying: null,
      queue: { items: [], total: 0, truncated: false },
      playlists: publicResource.playlists,
    }],
  ] as const)("enables the player for an exposed %s playable source", (_label, content) => {
    expect(derivePublicMusicViewPolicy({
      ...publicResource,
      ...content,
      permissions: {
        ...publicResource.permissions,
        allowGuestPlayOnDevice: true,
        allowQueueVisibility: true,
        allowPlaylistSharing: true,
      },
    })).toMatchObject({ playerEligible: true });
  });

  it("requires at least one exposed playable source before enabling the player", () => {
    // Break caught: playback permission alone renders a player without exposed playable data.
    expect(derivePublicMusicViewPolicy({
      ...publicResource,
      currentlyPlaying: null,
      queue: { items: [], total: 0, truncated: false },
      playlists: { items: [], total: 0, truncated: false },
      permissions: { ...publicResource.permissions, allowGuestPlayOnDevice: true, allowQueueVisibility: true },
    })).toMatchObject({ requestEligible: true, playerEligible: false, currentVisible: false, queueVisible: true });
  });

  it("does not let protected malicious data contribute to visibility or player eligibility", () => {
    // Break caught: denied queue/playlist payloads manufacture playback eligibility downstream.
    expect(derivePublicMusicViewPolicy({
      ...publicResource,
      currentlyPlaying: null,
      permissions: {
        ...publicResource.permissions,
        allowGuestPlayOnDevice: true,
        allowQueueVisibility: false,
        allowPlaylistSharing: false,
        allowRecentlyPlayedVisibility: false,
      },
    } as PublicMusicResource)).toEqual({
      requestEligible: true,
      playerEligible: false,
      currentVisible: false,
      queueVisible: false,
      historyVisible: false,
      playlistsVisible: false,
    });
    expect(derivePublicMusicViewPolicy({
      ...publicResource,
      permissions: {
        ...publicResource.permissions,
        allowGuestPlayOnDevice: false,
        allowQueueVisibility: false,
        allowPlaylistSharing: false,
      },
    } as PublicMusicResource)).toMatchObject({
      playerEligible: false,
      currentVisible: false,
      queueVisible: false,
      playlistsVisible: false,
    });
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

  it("accepts empty playlist descriptions and canonical nullable thumbnails", () => {
    const legacySafeResource = {
      ...publicResource,
      currentlyPlaying: { ...publicResource.currentlyPlaying!, thumbnailUrl: null },
      queue: { ...publicResource.queue, items: [{ ...publicSong, thumbnailUrl: null }] },
      playlists: {
        ...publicResource.playlists,
        items: [{
          ...publicResource.playlists.items[0],
          description: "",
          songs: { ...publicResource.playlists.items[0].songs, items: [{ ...publicResource.playlists.items[0].songs.items[0], thumbnailUrl: null }] },
        }],
      },
    };
    expect(parsePublicMusicResource(legacySafeResource)).toEqual(legacySafeResource);
    expect(() => parsePublicMusicResource({
      ...publicResource,
      currentlyPlaying: { ...publicResource.currentlyPlaying!, thumbnailUrl: "legacy-thumbnail" },
    })).toThrow();
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

  it("rejects oversized Content-Length before reading the response stream", async () => {
    const streamed = streamedSuccess([JSON.stringify(publicResource)], String(PUBLIC_MUSIC_RESOURCE_MAX_BYTES + 1));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamed.response));

    await expect(createPublicMusicClient("https://music.example").load("public_slug-123"))
      .rejects.toMatchObject({ code: "PUBLIC_UNAVAILABLE" });
    expect(streamed.wasCancelled()).toBe(true);
  });

  it("cancels a chunked response as soon as a lying small Content-Length crosses the byte limit", async () => {
    const streamed = streamedSuccess(["x".repeat(PUBLIC_MUSIC_RESOURCE_MAX_BYTES), "y", "unread-tail"], "1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamed.response));

    await expect(createPublicMusicClient("https://music.example").load("public_slug-123"))
      .rejects.toMatchObject({ code: "PUBLIC_UNAVAILABLE" });
    expect(streamed.wasCancelled()).toBe(true);
  });

  it("counts multibyte UTF-8 bytes instead of JavaScript characters while streaming", async () => {
    const streamed = streamedSuccess(["😀".repeat(70_000), "😀".repeat(70_000), "unread-tail"]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamed.response));

    await expect(createPublicMusicClient("https://music.example").load("public_slug-123"))
      .rejects.toMatchObject({ code: "PUBLIC_UNAVAILABLE" });
    expect(streamed.wasCancelled()).toBe(true);
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
