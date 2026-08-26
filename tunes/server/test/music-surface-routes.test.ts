import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createMusicPublicationIdempotencyKey } from "../../shared/musicPublicationContract";
import { setupCanonicalMusicRoutes } from "../routes/musicSurfaceRoutes";

const routeNow = Date.parse("2026-08-14T10:00:00.000Z");
const publicationKey = createMusicPublicationIdempotencyKey(routeNow, "11111111-2222-4333-8444-555555555555");

function appFor(overrides: Record<string, unknown> = {}, routeOverrides: Record<string, unknown> = {}) {
  const calls: unknown[][] = [];
  const publicationOperations = new Map<string, { mode: "private" | "unlisted" | "public"; response: unknown }>();
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
    replaceQueue: vi.fn(async (owner: number, key: string, revision: number, songs: unknown[]) => {
      calls.push(["replace-queue", owner, key, revision, songs]);
      if (key === "conflict-key") return { status: "conflict" as const };
      if (revision !== 4) return { status: "stale" as const, revision: 4 };
      return { status: "completed" as const, replayed: key === "replay-key", response: { version: "music-queue/v1", revision: 5, songs: [
        { id: 1, user_id: owner, youtube_id: "yt", title: "Song", artist: "Artist", thumbnail_url: "https://img", position: 0, status: "queued", played_at: null },
      ] } };
    }),
    ownerDashboard: vi.fn(async (owner: number) => { calls.push(["dashboard", owner]); return { queueRevision: 4, songs: [], playedSongs: [], publication: { mode: "private", publicSlug: "private-slug" } }; }),
    addSong: vi.fn(async (owner: number, input: unknown) => { calls.push(["add-song", owner, input]); return { id: 1 }; }),
    setPlaying: vi.fn(async (owner: number, id: number | null) => { calls.push(["playing", owner, id]); return id === null ? null : { id }; }),
    updateSongPosition: vi.fn(async (owner: number, id: number, position: number) => { calls.push(["position", owner, id, position]); return { id, position }; }),
    removeSong: vi.fn(async (owner: number, id: number) => { calls.push(["remove-song", owner, id]); return true; }),
    removeSongs: vi.fn(async (owner: number, ids: number[]) => { calls.push(["remove-songs", owner, ids]); return ids.length; }),
    clearHistory: vi.fn(async (owner: number) => { calls.push(["history", owner]); return 0; }),
    rotateGuestCapability: vi.fn(async () => ({})),
    revokeGuestCapability: vi.fn(async () => undefined),
    setDiscoverable: vi.fn(async () => undefined),
    setPublicationMode: vi.fn(async (_owner: number, mode: "private" | "unlisted" | "public") => ({ mode, publicSlug: "private-slug" })),
    executePublicationCommand: vi.fn(async (owner: number, key: string, mode: "private" | "unlisted" | "public") => {
      const cacheKey = `${owner}:${key}`;
      const existing = publicationOperations.get(cacheKey);
      if (existing && existing.mode !== mode) return { status: "conflict" as const };
      if (existing) return { status: "completed" as const, replayed: true, response: existing.response };
      const response = {
        version: "music-publication/v1" as const,
        publication: { mode, publicSlug: "private-slug" },
        ...(mode === "unlisted" ? { capability: "C".repeat(43) } : {}),
      };
      publicationOperations.set(cacheKey, { mode, response });
      return { status: "completed" as const, replayed: false, response };
    }),
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
    now: () => new Date(routeNow),
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
    expect(response.body).toEqual({ queueRevision: 4, songs: [], currentlyPlaying: null, playedSongs: [], publication: { mode: "private", publicSlug: "private-slug" } });
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

  it("atomically replaces the principal queue and rejects stale, reused, targeted, unauthenticated, and cross-origin requests", async () => {
    // Break caught: replacement trusts owner input or loses typed concurrency/idempotency failures.
    const { app, calls } = appFor();
    const body = { expectedRevision: 4, songs: [{ playlistId: 9, songId: 31 }] };
    const headers = { Authorization: "Bearer aaa.bbb.ccc", Origin: "https://explorers.example", "Idempotency-Key": "replace-key" };
    const success = await request(app).post("/api/music/queue/replace").set(headers).send(body);
    expect(success.status).toBe(200);
    expect(success.body).toEqual({ version: "music-queue/v1", revision: 5, songs: [{ id: 1, userId: 11, youtubeId: "yt", title: "Song", artist: "Artist", thumbnailUrl: "https://img", position: 0, status: "queued", playedAt: null }] });
    expect(calls).toContainEqual(["replace-queue", 11, "replace-key", 4, [{ playlistId: 9, songId: 31 }]]);
    expect((await request(app).post("/api/music/queue/replace").set({ ...headers, "Idempotency-Key": "replay-key" }).send(body)).status).toBe(200);
    expect((await request(app).post("/api/music/queue/replace").set(headers).send({ ...body, expectedRevision: 3 })).body.error.code).toBe("QUEUE_REVISION_CONFLICT");
    expect((await request(app).post("/api/music/queue/replace").set({ ...headers, "Idempotency-Key": "conflict-key" }).send(body)).body.error.code).toBe("IDEMPOTENCY_CONFLICT");
    expect((await request(app).post("/api/music/queue/replace").set(headers).send({ ...body, ownerId: 99 })).status).toBe(400);
    expect((await request(app).post("/api/music/queue/replace").set(headers).send({ ...body, username: "other" })).status).toBe(400);
    expect((await request(app).post("/api/music/queue/replace").set("Origin", "https://explorers.example").set("Idempotency-Key", "x").send(body)).status).toBe(401);
    expect((await request(app).post("/api/music/queue/replace").set("Authorization", headers.Authorization).set("Origin", "https://evil.example").set("Idempotency-Key", "x").send(body)).status).toBe(403);
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

  it.each([
    ["unknown", false],
    ["included", false],
    ["eligible", false],
    ["entitled", true],
    ["revoked", false],
  ] as const)("exposes canonical %s entitlement without accepting a browser target", async (state, paidMutation) => {
    // Break caught: a retained database state is rewritten, gains premium authority, or changes universal core access in transit.
    const { app } = appFor({
      resolveEntitlement: vi.fn(async () => ({ state, sourceUpdatedAt: new Date("2026-08-14T09:55:00.000Z") })),
    });
    const response = await request(app).get("/api/music/entitlement").set("Authorization", "Bearer aaa.bbb.ccc");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      state,
      sourceUpdatedAt: "2026-08-14T09:55:00.000Z",
      paidMutation,
      coreRead: true,
      coreMutation: true,
      maxAgeSeconds: 600,
    });
    expect((await request(app).get("/api/music/entitlement?username=other").set("Authorization", "Bearer aaa.bbb.ccc")).status).toBe(400);
  });

  it("fails closed when the repository returns an unsupported entitlement value", async () => {
    // Break caught: a corrupt/future state escapes a response that the exact client contract cannot interpret.
    const { app } = appFor({
      resolveEntitlement: vi.fn(async () => ({ state: "paused", sourceUpdatedAt: new Date("2026-08-14T09:55:00.000Z") })),
    });
    const response = await request(app).get("/api/music/entitlement").set("Authorization", "Bearer aaa.bbb.ccc");
    expect(response.status).toBe(500);
    expect(response.body.error).toMatchObject({ code: "INTERNAL_ERROR", retryable: true });
    expect(JSON.stringify(response.body)).not.toContain("paused");
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

  it("returns 200 and an exact empty playlist array for a valid public owner with no visible playlists", async () => {
    const { app } = appFor({
      resolveGuestResource: vi.fn(async () => ({
        state: "public",
        playlist: {
          songs: [], currentlyPlaying: null, playedSongs: [],
          user: {
            id: 11, username: "display", guestUrl: "public-empty", venueName: null, theme: null,
            allowSongRequests: false, allowGuestPlayOnDevice: false, allowPlaylistSharing: true, allowRecentlyPlayedVisibility: false,
          },
          allowGuestPlayOnDevice: false, allowRecentlyPlayedVisibility: false, playlists: [],
        },
      })),
    });
    const response = await request(app).get("/api/playlist/public-empty");
    expect(response.status).toBe(200);
    expect(response.body.playlists).toEqual([]);
  });

  it("changes publication with one owner-derived idempotent command and never persists capability material", async () => {
    // Break caught: separate rotate/publish writes can leave a partially public mode or rotate twice on a replay.
    const { app, repository } = appFor();
    const headers = { Authorization: "Bearer aaa.bbb.ccc", Origin: "https://explorers.example" };
    const first = await request(app).post("/api/music/publication").set(headers)
      .set("Idempotency-Key", publicationKey).send({ mode: "unlisted" });
    const replay = await request(app).post("/api/music/publication").set(headers)
      .set("Idempotency-Key", publicationKey).send({ mode: "unlisted" });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ version: "music-publication/v1", publication: { mode: "unlisted", publicSlug: "private-slug" } });
    expect(first.body.capability).toBe("C".repeat(43));
    expect(replay.body).toEqual(first.body);
    expect(repository.executePublicationCommand).toHaveBeenCalledTimes(2);
    expect(repository.executePublicationCommand).toHaveBeenNthCalledWith(1, 11, publicationKey, "unlisted");
    expect(repository.executePublicationCommand).toHaveBeenNthCalledWith(2, 11, publicationKey, "unlisted");
    expect(repository.setPublicationMode).not.toHaveBeenCalled();
    expect(repository.rotateGuestCapability).not.toHaveBeenCalled();
    expect(repository.revokeGuestCapability).not.toHaveBeenCalled();
    expect(repository.setDiscoverable).not.toHaveBeenCalled();

    const conflict = await request(app).post("/api/music/publication").set(headers)
      .set("Idempotency-Key", publicationKey).send({ mode: "public" });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("keeps publication idempotency isolated by owner principal", async () => {
    const resolvePrincipal = vi.fn(async (token: string) => ({
      musicUserId: token === "ddd.eee.fff" ? 22 : 11,
      subject: token,
      accountDocumentId: token === "ddd.eee.fff" ? "account-b" : "account-a",
      sessionVersion: 3,
    }));
    const { app, repository } = appFor({}, { resolvePrincipal });
    const write = (token: string) => request(app).post("/api/music/publication")
      .set({ Authorization: `Bearer ${token}`, Origin: "https://explorers.example", "Idempotency-Key": publicationKey })
      .send({ mode: "private" });
    expect((await write("aaa.bbb.ccc")).status).toBe(200);
    expect((await write("ddd.eee.fff")).status).toBe(200);
    expect(repository.executePublicationCommand.mock.calls.map((call: unknown[]) => call[0])).toEqual([11, 22]);
  });

  it("maps an expired durable replay to one typed no-mutation response", async () => {
    const executePublicationCommand = vi.fn(async () => ({ status: "expired" as const }));
    const { app, repository } = appFor({ executePublicationCommand });
    const response = await request(app).post("/api/music/publication")
      .set({ Authorization: "Bearer aaa.bbb.ccc", Origin: "https://explorers.example", "Idempotency-Key": publicationKey })
      .send({ mode: "unlisted" });
    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({ code: "PUBLICATION_REPLAY_EXPIRED", retryable: false });
    expect(executePublicationCommand).toHaveBeenCalledWith(11, publicationKey, "unlisted");
    expect(repository.setPublicationMode).not.toHaveBeenCalled();
  });

  it("maps the per-owner publication operation quota to a retryable 429", async () => {
    const executePublicationCommand = vi.fn(async () => ({
      status: "rate_limited" as const,
      retryAfterSeconds: 37,
    }));
    const { app } = appFor({ executePublicationCommand });
    const response = await request(app).post("/api/music/publication")
      .set({ Authorization: "Bearer aaa.bbb.ccc", Origin: "https://explorers.example", "Idempotency-Key": publicationKey })
      .send({ mode: "public" });
    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("37");
    expect(response.body.error).toMatchObject({ code: "RATE_LIMITED", retryable: true });
    expect(executePublicationCommand).toHaveBeenCalledWith(11, publicationKey, "public");
  });

  it("admits the one-day issuance-cutoff overlap only for repository replay authority", async () => {
    const overlapKey = createMusicPublicationIdempotencyKey(
      routeNow - 30 * 24 * 60 * 60 * 1_000 - 60 * 60 * 1_000,
      "11111111-2222-4333-8444-555555555556",
    );
    const accepted = appFor();
    const response = await request(accepted.app).post("/api/music/publication")
      .set({ Authorization: "Bearer aaa.bbb.ccc", Origin: "https://explorers.example", "Idempotency-Key": overlapKey })
      .send({ mode: "private" });
    expect(response.status).toBe(200);
    expect(accepted.repository.executePublicationCommand).toHaveBeenCalledWith(11, overlapKey, "private");

    const beyondReplayKey = createMusicPublicationIdempotencyKey(
      routeNow - 31 * 24 * 60 * 60 * 1_000 - 1,
      "11111111-2222-4333-8444-555555555557",
    );
    const rejected = appFor();
    expect((await request(rejected.app).post("/api/music/publication")
      .set({ Authorization: "Bearer aaa.bbb.ccc", Origin: "https://explorers.example", "Idempotency-Key": beyondReplayKey })
      .send({ mode: "private" })).status).toBe(400);
    expect(rejected.repository.executePublicationCommand).not.toHaveBeenCalled();
  });

  it("marks unlisted capability reads noindex and returns a distinct public-only 429", async () => {
    // Break caught: unlisted pages enter indexing or public throttling is disguised as resource existence.
    const unlisted = appFor({
      resolveGuestResource: vi.fn(async () => ({
        state: "unlisted",
        noindex: true,
        playlist: {
          songs: [], currentlyPlaying: undefined, playedSongs: [], playlists: [],
          user: { id: 11, username: "empty-owner", guestUrl: "empty-unlisted" },
        },
      })),
    });
    const found = await request(unlisted.app).get(`/api/playlist/${"A".repeat(43)}`);
    expect(found.status).toBe(200);
    expect(found.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(found.body).toMatchObject({ songs: [], playlists: [], user: { id: 11, username: "empty-owner", guestUrl: "empty-unlisted" } });

    const limitedLookup = vi.fn(async () => ({ state: "public", playlist: { id: 2 } }));
    const limited = appFor({ resolveGuestResource: limitedLookup }, { publicRateLimited: () => true });
    const rejected = await request(limited.app).get("/api/playlist/discoverable-slug");
    expect(rejected.status).toBe(429);
    expect(rejected.body.error.code).toBe("RATE_LIMITED");
    expect(rejected.headers["retry-after"]).toBe("60");
    expect(limitedLookup).not.toHaveBeenCalled();
  });

  it("passes source, resource, and optional capability dimensions to public limiting", async () => {
    // Break caught: public limiting is keyed only by attacker-controlled slug cardinality.
    const inputs: unknown[] = [];
    const capability = "C".repeat(43);
    const { app } = appFor({
      resolveGuestResource: vi.fn(async () => ({ state: "public", playlist: { id: 2 } })),
    }, {
      publicRateLimited: (input: unknown) => { inputs.push(input); return false; },
    });

    const response = await request(app).get("/api/playlist/discoverable-slug")
      .set("X-Music-Guest-Capability", capability);
    expect(response.status).toBe(200);
    expect(inputs).toEqual([{
      source: expect.stringMatching(/127\.0\.0\.1$/),
      resource: "discoverable-slug",
      capability,
    }]);
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

  it("accepts a public publication request without weakening unlisted authority", async () => {
    const resolveGuestRequestAuthority = vi.fn(async (slug: string, capability?: string) =>
      slug === "public-owner" && capability === undefined
        ? { musicUserId: 88, active: true as const, allowSongRequests: true }
        : undefined);
    const { app, calls } = appFor({ resolveGuestRequestAuthority });
    const response = await request(app).post("/api/playlist/public-owner/requests")
      .set("Origin", "https://explorers.example")
      .send({ youtubeId: "yt", title: "t", artist: "a", thumbnailUrl: "https://img" });
    expect(response.status).toBe(201);
    expect(resolveGuestRequestAuthority).toHaveBeenCalledWith("public-owner", undefined);
    expect(calls).toContainEqual(["add-song", 88, { youtubeId: "yt", title: "t", artist: "a", thumbnailUrl: "https://img" }]);

    const unlisted = await request(app).post("/api/playlist/unlisted-owner/requests")
      .set("Origin", "https://explorers.example")
      .send({ youtubeId: "yt", title: "t", artist: "a", thumbnailUrl: "https://img" });
    expect(unlisted.status).toBe(403);
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
