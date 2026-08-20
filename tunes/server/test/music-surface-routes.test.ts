import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { setupCanonicalMusicRoutes } from "../routes/musicSurfaceRoutes";

function appFor(overrides: Record<string, unknown> = {}, routeOverrides: Record<string, unknown> = {}) {
  const calls: unknown[][] = [];
  const repository = {
    listPlaylists: vi.fn(async (owner: number) => { calls.push(["list", owner]); return []; }),
    getPlaylist: vi.fn(async (owner: number, id: number) => { calls.push(["get", owner, id]); return id === 9 ? { id: 9, user_id: owner, name: "mine" } : undefined; }),
    createPlaylist: vi.fn(async (owner: number, input: unknown) => { calls.push(["create", owner, input]); return { id: 10, user_id: owner, ...(input as object) }; }),
    updatePlaylist: vi.fn(async (owner: number, id: number, input: unknown) => { calls.push(["update", owner, id, input]); return id === 9 ? { id, user_id: owner, ...(input as object) } : undefined; }),
    deletePlaylist: vi.fn(async (owner: number, id: number) => { calls.push(["delete", owner, id]); return id === 9; }),
    addPlaylistSong: vi.fn(async (owner: number, playlist: number, input: unknown) => { calls.push(["playlist-song-add", owner, playlist, input]); return playlist === 9 ? { id: 12 } : undefined; }),
    removePlaylistSong: vi.fn(async (owner: number, playlist: number, song: number) => { calls.push(["playlist-song-remove", owner, playlist, song]); return playlist === 9; }),
    reorderPlaylistSong: vi.fn(async (owner: number, playlist: number, song: number, position: number) => { calls.push(["playlist-song-reorder", owner, playlist, song, position]); return playlist === 9; }),
    setPlaylistVisibility: vi.fn(async (owner: number, playlist: number, visible: boolean) => { calls.push(["playlist-visibility", owner, playlist, visible]); return playlist === 9; }),
    listQueue: vi.fn(async (owner: number) => { calls.push(["queue", owner]); return []; }),
    ownerDashboard: vi.fn(async (owner: number) => { calls.push(["dashboard", owner]); return { songs: [], playedSongs: [], publication: { mode: "private", publicSlug: "private-slug" } }; }),
    addSong: vi.fn(async (owner: number, input: unknown) => { calls.push(["add-song", owner, input]); return { id: 1 }; }),
    setPlaying: vi.fn(async (owner: number, id: number | null) => { calls.push(["playing", owner, id]); return id === null ? null : { id }; }),
    updateSongPosition: vi.fn(async (owner: number, id: number, position: number) => { calls.push(["position", owner, id, position]); return { id, position }; }),
    removeSong: vi.fn(async (owner: number, id: number) => { calls.push(["remove-song", owner, id]); return true; }),
    removeSongs: vi.fn(async (owner: number, ids: number[]) => { calls.push(["remove-songs", owner, ids]); return ids.length; }),
    clearHistory: vi.fn(async (owner: number) => { calls.push(["history", owner]); return 0; }),
    rotateGuestCapability: vi.fn(async () => ({})),
    revokeGuestCapability: vi.fn(async () => undefined),
    setDiscoverable: vi.fn(async () => undefined),
    resolveEntitlement: vi.fn(async () => ({ state: "entitled", sourceUpdatedAt: new Date("2026-08-14T09:55:00.000Z") })),
    resolveGuestResource: vi.fn(async () => undefined),
    resolveGuestSocketAuthority: vi.fn(async (capability: string) => capability === "G".repeat(43)
      ? { musicUserId: 77, active: true, allowSongRequests: true } : undefined),
    resolveGuestRequestAuthority: vi.fn(async (slug: string, capability: string) => slug === "owner-a" && capability === "G".repeat(43)
      ? { musicUserId: 77, active: true, allowSongRequests: true } : undefined),
    ...overrides,
  };
  const app = express();
  app.use(express.json({ limit: "8kb" }));
  setupCanonicalMusicRoutes(app, {
    repository: repository as never,
    resolvePrincipal: async (token) => {
      if (token !== "aaa.bbb.ccc") throw new Error("invalid");
      return { musicUserId: 11, subject: "subject", accountDocumentId: "account", sessionVersion: 3 };
    },
    now: () => new Date("2026-08-14T10:00:00.000Z"),
    requestIdFactory: () => "route-request-id",
    allowedOrigins: ["https://explorers.example"],
    youtube: {
      search: vi.fn(async () => ({ items: [{ id: { videoId: "yt" }, snippet: { title: "safe" } }], nextPageToken: null })),
      videoFromUrl: vi.fn(async () => ({ id: { videoId: "yt" }, snippet: { title: "safe" } })),
    },
    ...routeOverrides,
  });
  return { app, repository, calls };
}

describe("canonical Music REST surfaces", () => {
  it("reads the private owner dashboard only through the C5 principal", async () => {
    const { app, calls } = appFor();
    expect((await request(app).get("/api/music/dashboard")).status).toBe(401);
    const response = await request(app).get("/api/music/dashboard").set("Authorization", "Bearer aaa.bbb.ccc");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ songs: [], currentlyPlaying: null, playedSongs: [], publication: { mode: "private", publicSlug: "private-slug" } });
    expect(calls).toContainEqual(["dashboard", 11]);
  });

  it("accepts only the C5 credential and derives playlist owner from req.musicPrincipal", async () => {
    // Break caught: native sessions or browser owner targets substitute for the local Music principal.
    const { app, calls } = appFor();
    const unauthenticated = await request(app).get("/api/playlists").set("Cookie", "cosmic.sid=native");
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers["x-request-id"]).toBe("route-request-id");

    const owner = await request(app).get("/api/playlists").set("Authorization", "Bearer aaa.bbb.ccc");
    expect(owner.status).toBe(200);
    expect(calls).toContainEqual(["list", 11]);

    const targeted = await request(app).get("/api/playlists?userId=22").set("Authorization", "Bearer aaa.bbb.ccc");
    expect(targeted.status).toBe(400);
    expect(calls).not.toContainEqual(["list", 22]);
  });

  it("returns one typed request-bound failure for an other-user resource", async () => {
    // Break caught: absent owner predicate leaks resource existence or returns an ad-hoc error body.
    const { app } = appFor();
    const response = await request(app).patch("/api/playlists/99")
      .set("Authorization", "Bearer aaa.bbb.ccc")
      .set("Origin", "https://explorers.example")
      .send({ name: "attempt", description: null });
    expect(response.status).toBe(404);
    expect(response.headers["x-request-id"]).toBe("route-request-id");
    expect(response.body).toEqual({
      version: "music-error/v1",
      error: {
        code: "PUBLIC_NOT_FOUND",
        message: "The Music resource was not found.",
        action: "none",
        retryable: false,
        requestId: "route-request-id",
      },
    });
  });

  it("derives every queue mutation owner from the C5 principal", async () => {
    // Break caught: queue body/query song IDs select a different Music owner.
    const { app, calls } = appFor();
    const headers = { Authorization: "Bearer aaa.bbb.ccc", Origin: "https://explorers.example" };
    expect((await request(app).get("/api/playlist/songs").set("Authorization", headers.Authorization)).status).toBe(200);
    expect((await request(app).post("/api/playlist/songs").set(headers).send({ youtubeId: "yt", title: "t", artist: "a", thumbnailUrl: "https://img" })).status).toBe(201);
    expect((await request(app).patch("/api/playlist/songs/7/position").set(headers).send({ position: 2 })).status).toBe(200);
    expect((await request(app).delete("/api/playlist/songs/7").set(headers)).status).toBe(204);
    expect((await request(app).delete("/api/playlist/songs/bulk").set(headers).send({ songIds: [7, 8] })).status).toBe(204);
    expect((await request(app).delete("/api/playlist/history").set(headers)).status).toBe(204);
    expect(calls.filter((entry) => ["queue", "add-song", "position", "remove-song", "remove-songs", "history"].includes(String(entry[0])))
      .every((entry) => entry[1] === 11)).toBe(true);
  });

  it("clears completed playback through the owner-predicated C5 mutation", async () => {
    // Break caught: the browser used an unauthenticated raw fetch and the server rejected null after the UI advanced.
    const { app, calls } = appFor();
    const response = await request(app).post("/api/playlist/currently-playing")
      .set("Authorization", "Bearer aaa.bbb.ccc")
      .set("Origin", "https://explorers.example")
      .send({ songId: null });
    expect(response.status).toBe(204);
    expect(calls).toContainEqual(["playing", 11, null]);
  });

  it("keeps only the typed read-only YouTube product operations behind C5", async () => {
    // Break caught: core search lands on a retirement while an unrestricted sibling proxy remains reachable.
    const { app } = appFor();
    const headers = { Authorization: "Bearer aaa.bbb.ccc", Origin: "https://explorers.example" };
    const search = await request(app).post("/api/youtube/search").set(headers).send({ query: "music", pageToken: "next" });
    expect(search.status).toBe(200);
    expect(search.body.items[0].id.videoId).toBe("yt");
    const video = await request(app).post("/api/youtube/video-from-url").set(headers).send({ url: "https://youtu.be/abcdefghijk" });
    expect(video.status).toBe(200);
    expect(video.body.id.videoId).toBe("yt");
    expect((await request(app).post("/api/youtube/search").send({ query: "music" })).status).toBe(401);
  });

  it("derives saved-playlist song, reorder, and visibility ownership from C5", async () => {
    // Break caught: a browser playlist ID selects another owner's saved playlist.
    const { app, calls } = appFor();
    const headers = { Authorization: "Bearer aaa.bbb.ccc", Origin: "https://explorers.example" };
    expect((await request(app).post("/api/playlists/9/songs").set(headers).send({ youtubeId: "yt", title: "t", artist: "a", thumbnailUrl: "https://img" })).status).toBe(201);
    expect((await request(app).delete("/api/playlists/9/songs/12").set(headers)).status).toBe(204);
    expect((await request(app).patch("/api/playlists/9/reorder").set(headers).send({ songId: 12, position: 2 })).status).toBe(204);
    expect((await request(app).patch("/api/playlists/9/visibility").set(headers).send({ isVisibleToGuests: true })).status).toBe(204);
    expect(calls.filter((entry) => String(entry[0]).startsWith("playlist-")).every((entry) => entry[1] === 11)).toBe(true);
  });

  it("denies paid mutation when the server entitlement timestamp is stale", async () => {
    // Break caught: a local read or caller assertion refreshes premium mutation authority.
    const { app } = appFor({
      resolveEntitlement: vi.fn(async () => ({ state: "entitled", sourceUpdatedAt: new Date("2026-08-14T09:49:59.999Z") })),
    });
    const response = await request(app).post("/api/music/paid/import")
      .set("Authorization", "Bearer aaa.bbb.ccc")
      .set("Origin", "https://explorers.example")
      .send({ source: "youtube" });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ENTITLEMENT_REQUIRED");
  });

  it("exposes server-derived entitlement state without accepting a browser target", async () => {
    // Break caught: the client reads caller-target subscription endpoints instead of local Music authority.
    const { app } = appFor();
    const response = await request(app).get("/api/music/entitlement").set("Authorization", "Bearer aaa.bbb.ccc");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ state: "entitled", paidMutation: true, maxAgeSeconds: 600 });
    expect((await request(app).get("/api/music/entitlement?username=other").set("Authorization", "Bearer aaa.bbb.ccc")).status).toBe(400);
  });

  it("makes unknown, private, suspended, pending, and revoked guest resources indistinguishable", async () => {
    // Break caught: public errors reveal lifecycle or publication state.
    for (const value of [undefined, "private", "suspended", "pending_deletion", "revoked"] as const) {
      const { app } = appFor({ resolveGuestResource: vi.fn(async () => value && ({ state: value })) });
      const response = await request(app).get("/api/playlist/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("PUBLIC_NOT_FOUND");
      expect(response.body.error.message).toBe("The Music resource was not found.");
    }
  });

  it("rotates a hash-only guest capability and requires explicit publish or unpublish", async () => {
    // Break caught: plaintext capability is persisted, or discovery is enabled as a side effect of rotation.
    const { app, repository } = appFor();
    const headers = { Authorization: "Bearer aaa.bbb.ccc", Origin: "https://explorers.example" };
    const rotated = await request(app).post("/api/music/guest-capability/rotate").set(headers);
    expect(rotated.status).toBe(200);
    expect(rotated.body.capability).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const persisted = repository.rotateGuestCapability.mock.calls[0][1];
    expect(persisted).toMatch(/^[a-f0-9]{64}$/);
    expect(persisted).not.toBe(rotated.body.capability);
    expect(repository.setDiscoverable).not.toHaveBeenCalled();

    expect((await request(app).post("/api/music/publication/publish").set(headers)).status).toBe(204);
    expect((await request(app).post("/api/music/publication/unpublish").set(headers)).status).toBe(204);
    expect(repository.setDiscoverable.mock.calls).toEqual([[11, true], [11, false]]);
  });

  it("marks unlisted capability reads noindex and returns a distinct public-only 429", async () => {
    // Break caught: unlisted pages enter indexing or public throttling is disguised as resource existence.
    const unlisted = appFor({
      resolveGuestResource: vi.fn(async () => ({ state: "unlisted", noindex: true, playlist: { id: 1 } })),
    });
    const found = await request(unlisted.app).get(`/api/playlist/${"A".repeat(43)}`);
    expect(found.status).toBe(200);
    expect(found.headers["x-robots-tag"]).toBe("noindex, nofollow");

    const limitedLookup = vi.fn(async () => ({ state: "public", playlist: { id: 2 } }));
    const limited = appFor({ resolveGuestResource: limitedLookup }, { publicRateLimited: () => true });
    const rejected = await request(limited.app).get("/api/playlist/discoverable-slug");
    expect(rejected.status).toBe(429);
    expect(rejected.body.error.code).toBe("RATE_LIMITED");
    expect(rejected.headers["retry-after"]).toBe("60");
    expect(limitedLookup).not.toHaveBeenCalled();
  });

  it("accepts unlisted capability only from the dedicated header, never the URL", async () => {
    // Break caught: the capability appears in access logs, telemetry, history, or indexing through a route parameter.
    const capability = "C".repeat(43);
    const lookup = vi.fn(async (_slug: string, suppliedCapability?: string) => suppliedCapability === capability
      ? { state: "unlisted", noindex: true, playlist: { id: 3 } }
      : undefined);
    const { app } = appFor({ resolveGuestResource: lookup as any });
    const headerRead = await request(app).get("/api/playlist/public-slug")
      .set("X-Music-Guest-Capability", capability);
    expect(headerRead.status).toBe(200);
    expect(headerRead.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(lookup).toHaveBeenLastCalledWith("public-slug", capability);

    const urlRead = await request(app).get(`/api/playlist/${capability}`);
    expect(urlRead.status).toBe(404);
    expect(lookup).toHaveBeenLastCalledWith(capability, undefined);
  });

  it("binds a guest request capability to its slug before deriving the queue owner", async () => {
    // Break caught: owner A's capability submitted from owner B's page silently mutates A's queue.
    const { app, calls } = appFor();
    const crossOwner = await request(app).post("/api/playlist/owner-b/requests")
      .set("Origin", "https://explorers.example")
      .set("X-Music-Guest-Capability", "G".repeat(43))
      .send({ youtubeId: "yt", title: "t", artist: "a", thumbnailUrl: "https://img" });
    expect(crossOwner.status).toBe(403);
    expect(crossOwner.body.error.code).toBe("GUEST_CAPABILITY_INVALID");
    expect(calls).not.toContainEqual(expect.arrayContaining(["add-song"]));

    const response = await request(app).post("/api/playlist/owner-a/requests")
      .set("Origin", "https://explorers.example")
      .set("X-Music-Guest-Capability", "G".repeat(43))
      .send({ youtubeId: "yt", title: "t", artist: "a", thumbnailUrl: "https://img" });
    expect(response.status).toBe(201);
    expect(calls).toContainEqual(["add-song", 77, { youtubeId: "yt", title: "t", artist: "a", thumbnailUrl: "https://img" }]);

    const invalid = await request(app).post("/api/playlist/owner-a/requests")
      .set("Origin", "https://explorers.example")
      .set("X-Music-Guest-Capability", "public-slug")
      .send({ youtubeId: "yt", title: "t", artist: "a", thumbnailUrl: "https://img" });
    expect(invalid.status).toBe(403);
    expect(invalid.body.error.code).toBe("GUEST_CAPABILITY_INVALID");
  });

  it("binds guest search and URL lookup to the same per-slug capability without C5 authority", async () => {
    // Break caught: the public request UI called owner-only /api/youtube routes and minted a C5 credential.
    const { app, repository } = appFor();
    const headers = { Origin: "https://explorers.example", "X-Music-Guest-Capability": "G".repeat(43) };
    const search = await request(app).post("/api/playlist/owner-a/youtube/search").set(headers).send({ query: "music" });
    expect(search.status).toBe(200);
    expect(search.body.items[0].id.videoId).toBe("yt");
    const video = await request(app).post("/api/playlist/owner-a/youtube/video-from-url").set(headers)
      .send({ url: "https://youtu.be/abcdefghijk" });
    expect(video.status).toBe(200);
    expect(repository.resolveGuestRequestAuthority).toHaveBeenCalledTimes(2);
    expect(repository.resolveGuestRequestAuthority).toHaveBeenCalledWith("owner-a", "G".repeat(43));
    expect((await request(app).post("/api/playlist/owner-b/youtube/search").set(headers).send({ query: "music" })).status).toBe(403);
    expect((await request(app).post("/api/playlist/owner-a/youtube/search").set("Origin", "https://explorers.example").send({ query: "music" })).status).toBe(403);
    expect((await request(app).post("/api/playlist/owner-a/youtube/search").set("X-Music-Guest-Capability", "G".repeat(43)).send({ query: "music" })).status).toBe(403);
  });

  it("returns a safe internal error instead of misclassifying a repository failure as an invalid token", async () => {
    // Break caught: an unexpected repository error was converted into TOKEN_INVALID and its detail could escape.
    const sentinel = "postgres-secret-detail-must-not-leak";
    const { app } = appFor({ addSong: vi.fn(async () => { throw new Error(sentinel); }) });
    const response = await request(app).post("/api/playlist/songs")
      .set("Authorization", "Bearer aaa.bbb.ccc")
      .set("Origin", "https://explorers.example")
      .set("X-Request-Id", "safe-route-request")
      .send({ youtubeId: "yt", title: "t", artist: "a", thumbnailUrl: "https://img" });

    expect(response.status).toBe(500);
    expect(response.headers["x-request-id"]).toBe("safe-route-request");
    expect(response.body).toEqual({
      version: "music-error/v1",
      error: {
        code: "INTERNAL_ERROR",
        message: "Music is temporarily unavailable.",
        action: "retry",
        retryable: true,
        requestId: "safe-route-request",
      },
    });
    expect(JSON.stringify(response.body)).not.toContain(sentinel);
  });
});
