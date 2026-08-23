import SwaggerParser from "@apidevtools/swagger-parser";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import express from "express";
import request from "supertest";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inventoryRuntimeSurfaces } from "../../../scripts/inventory-runtime-surfaces";
import { MUSIC_OPENAPI_DOCUMENT } from "../../routes/musicOpenApiRoutes";
import { setupCanonicalMusicRoutes } from "../../routes/musicSurfaceRoutes";

type Operation = {
  parameters?: Array<{ name?: string; in?: string; required?: boolean }>;
  requestBody?: unknown;
  responses?: Record<string, { headers?: Record<string, unknown> }>;
  security?: Array<Record<string, unknown>>;
};

const METHODS = ["get", "post", "patch", "delete", "put"] as const;
const root = resolve(import.meta.dirname, "../../../..");
const inventory = inventoryRuntimeSurfaces(root);

function openApiPath(path: string): string {
  return path.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, "{$1}");
}

function liveCanonicalOperations(): string[] {
  return inventory.routes
    .filter((route) => [
      "strapi-identity-boundary", "local-music-owner", "paid-local-music-owner", "guest-capability",
    ].includes(route.classification) || route.path === "/api-docs")
    .map((route) => `${route.method.toLowerCase()} ${openApiPath(route.path)}`)
    .sort();
}

function documentedOperations(): string[] {
  return Object.entries(MUSIC_OPENAPI_DOCUMENT.paths).flatMap(([path, pathItem]) => METHODS
    .filter((method) => method in pathItem)
    .map((method) => `${method} ${path}`)).sort();
}

function operations(): Array<{ method: string; path: string; operation: Operation }> {
  return Object.entries(MUSIC_OPENAPI_DOCUMENT.paths).flatMap(([path, pathItem]) => METHODS.flatMap((method) => {
    const operation = (pathItem as Record<string, Operation>)[method];
    return operation ? [{ method, path, operation }] : [];
  }));
}

describe("Music OpenAPI 3.1 executable contract", () => {
  it("parses as OpenAPI 3.1 and has exact parity with every live canonical route", async () => {
    await expect(SwaggerParser.validate(MUSIC_OPENAPI_DOCUMENT as never)).resolves.toBeDefined();
    expect(documentedOperations()).toEqual(liveCanonicalOperations());
  });

  it("declares exact path parameters, status codes, schemas, and request correlation", () => {
    for (const { path, operation } of operations()) {
      for (const name of [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1])) {
        expect(operation.parameters, `${path} must declare ${name}`).toContainEqual(expect.objectContaining({
          name, in: "path", required: true,
        }));
      }
      expect(Object.keys(operation.responses ?? {}), `${path} must use exact statuses`)
        .not.toEqual(expect.arrayContaining([expect.stringMatching(/^[1-5]XX$/)]));
      for (const [status, response] of Object.entries(operation.responses ?? {})) {
        expect(response.headers, `${path} ${status} must return X-Request-Id`).toHaveProperty("X-Request-Id");
      }
    }
  });

  it("documents C5, origin, guest header, publication, and entitlement semantics", () => {
    for (const { method, path, operation } of operations()) {
      const isIdentityBoundary = path.includes("/identity/ensure") || path.includes("/identity/lifecycle/");
      const isOwner = !isIdentityBoundary && !path.includes("{guestUrl}") && path !== "/api-docs";
      if (isIdentityBoundary) expect(operation.security, `${method} ${path}`).toContainEqual({ explorerProof: [] });
      if (isOwner) expect(operation.security, `${method} ${path}`).toContainEqual({ musicCredential: [] });
      if (isOwner && method !== "get" || path.endsWith("/{guestUrl}/requests")) {
        expect(operation.parameters, `${method} ${path} requires an exact Origin`).toContainEqual(expect.objectContaining({
          name: "Origin", in: "header", required: true,
        }));
      }
    }
    expect(MUSIC_OPENAPI_DOCUMENT.paths["/api/playlist/{guestUrl}"].get.parameters)
      .toContainEqual(expect.objectContaining({ name: "X-Music-Guest-Capability", in: "header", required: false }));
    expect(MUSIC_OPENAPI_DOCUMENT.paths["/api/playlist/{guestUrl}/requests"].post.parameters)
      .toContainEqual(expect.objectContaining({ name: "X-Music-Guest-Capability", in: "header", required: true }));
    expect(JSON.stringify(MUSIC_OPENAPI_DOCUMENT.paths["/api/playlist/{guestUrl}"].get)).toMatch(/unlisted.*noindex/i);
    expect(JSON.stringify(MUSIC_OPENAPI_DOCUMENT.paths["/api/music/paid/import"].post.responses)).toContain("ENTITLEMENT_REQUIRED");
    expect(MUSIC_OPENAPI_DOCUMENT.components.schemas.Dashboard.required).toContain("publication");
    expect(JSON.stringify(MUSIC_OPENAPI_DOCUMENT.components.schemas.Dashboard.properties.publication)).toContain("publicSlug");
    expect(JSON.stringify(MUSIC_OPENAPI_DOCUMENT.components.schemas.Dashboard.properties.publication)).not.toMatch(/capability|secret|hash/i);
    expect(MUSIC_OPENAPI_DOCUMENT.paths).toHaveProperty("/api/music/publication");
    expect(MUSIC_OPENAPI_DOCUMENT.paths).not.toHaveProperty("/api/music/publication/{action}");
    expect(MUSIC_OPENAPI_DOCUMENT.paths).not.toHaveProperty("/api/music/guest-capability/rotate");
    expect(MUSIC_OPENAPI_DOCUMENT.paths).not.toHaveProperty("/api/music/guest-capability/revoke");
    expect(MUSIC_OPENAPI_DOCUMENT.paths["/api/music/publication"].post.parameters)
      .toContainEqual(expect.objectContaining({ name: "Idempotency-Key", in: "header", required: true }));
    const publicationContract = JSON.stringify(MUSIC_OPENAPI_DOCUMENT.paths["/api/music/publication"].post);
    expect(publicationContract).toContain("PUBLICATION_REPLAY_EXPIRED");
    expect(publicationContract).toMatch(/24 hours|86400/i);
    expect(publicationContract).not.toMatch(/cipher|nonce|tag|response.key|aes|capability.hash/i);
    expect(JSON.stringify(MUSIC_OPENAPI_DOCUMENT.paths["/api/playlist/{guestUrl}"].get).toLowerCase()).not.toContain("zero-visible resources share the same safe 404");
  });

  it("documents the bounded publication command quota as a retryable 429", () => {
    const publication = MUSIC_OPENAPI_DOCUMENT.paths["/api/music/publication"].post;
    const responses = publication.responses as Record<string, unknown>;
    expect(responses["429"])
      .toMatchObject({ headers: { "Retry-After": expect.any(Object) } });
    const serialized = JSON.stringify(publication);
    expect(serialized).toContain("RATE_LIMITED");
    expect(serialized).toMatch(/100|quota/i);
  });

  it("validates mounted success DTOs for every product family against resolved 3.1 schemas", async () => {
    // Break caught: syntax-valid documentation advertises camelCase/enum shapes that live route bodies do not return.
    const addedAt = new Date("2026-08-14T10:00:00.000Z");
    const queueRow = {
      id: 21, user_id: 11, youtube_id: "queue-video", title: "Queue", artist: "Artist",
      thumbnail_url: "https://img/queue", position: 0, status: "queued", played_at: null,
    };
    const savedRow = {
      id: 31, playlist_id: 7, youtube_id: "saved-video", title: "Saved", artist: "Artist",
      thumbnail_url: "https://img/saved", position: 0, added_at: addedAt,
    };
    const playlistRow = {
      id: 7, user_id: 11, name: "Saved list", description: null, is_visible_to_guests: true,
      created_at: addedAt, updated_at: addedAt, songs: [savedRow],
    };
    const youtubeVideo = {
      id: { videoId: "abcdefghijk" },
      snippet: {
        title: "Video",
        channelTitle: "Channel",
        thumbnails: { default: { url: "https://img/video" } },
      },
    };
    const publicPlaylist = {
      songs: [{ id: 41, userId: 11, youtubeId: "public-video", title: "Public", artist: "Artist", thumbnailUrl: "https://img/public", position: 0, status: "playing", playedAt: null }],
      currentlyPlaying: { id: 41, userId: 11, youtubeId: "public-video", title: "Public", artist: "Artist", thumbnailUrl: "https://img/public", position: 0, status: "playing", playedAt: null },
      playedSongs: [],
      user: {
        id: 11, username: "display", guestUrl: "public-owner", venueName: "Venue", theme: { primary: "#123456" },
        allowSongRequests: true, allowGuestPlayOnDevice: false, allowPlaylistSharing: true, allowRecentlyPlayedVisibility: true,
      },
      allowGuestPlayOnDevice: false,
      allowRecentlyPlayedVisibility: true,
      playlists: [{ id: 7, userId: 11, name: "Saved list", description: null, isVisibleToGuests: true, createdAt: addedAt.toISOString(), updatedAt: addedAt.toISOString(), songs: [{ id: 31, playlistId: 7, youtubeId: "saved-video", title: "Saved", artist: "Artist", thumbnailUrl: "https://img/saved", position: 0, addedAt: addedAt.toISOString() }] }],
    };
    const repository = {
      listPlaylists: async () => [playlistRow], getPlaylist: async () => playlistRow,
      createPlaylist: async () => playlistRow, updatePlaylist: async () => playlistRow, deletePlaylist: async () => true,
      addPlaylistSong: async () => savedRow, removePlaylistSong: async () => true, reorderPlaylistSong: async () => true,
      setPlaylistVisibility: async () => true, listQueue: async () => [queueRow], ownerDashboard: async () => ({ songs: [queueRow], currentlyPlaying: queueRow, playedSongs: [], publication: { mode: "public", publicSlug: "public-owner" } }),
      addSong: async () => queueRow, setPlaying: async (_owner: number, songId: number | null) => songId === null ? null : queueRow,
      updateSongPosition: async () => queueRow, removeSong: async () => true, removeSongs: async () => 1, clearHistory: async () => 1,
      rotateGuestCapability: async () => ({}), revokeGuestCapability: async () => undefined, setDiscoverable: async () => undefined,
      setPublicationMode: async (_owner: number, mode: "private" | "unlisted" | "public") => ({ mode, publicSlug: "public-owner" }),
      executePublicationCommand: async (_owner: number, _key: string, mode: "private" | "unlisted" | "public") => ({
        status: "completed" as const,
        replayed: false,
        response: { version: "music-publication/v1" as const, publication: { mode, publicSlug: "public-owner" }, ...(mode === "unlisted" ? { capability: "C".repeat(43) } : {}) },
      }),
      resolveEntitlement: async () => ({ state: "included" as const, sourceUpdatedAt: addedAt }),
      resolveGuestResource: async () => ({ state: "public", noindex: false, playlist: publicPlaylist }),
      resolveGuestSocketAuthority: async () => ({ musicUserId: 11, active: true as const, allowSongRequests: true }),
      resolveGuestRequestAuthority: async () => ({ musicUserId: 11, active: true as const, allowSongRequests: true }),
    };
    const app = express();
    app.use(express.json());
    setupCanonicalMusicRoutes(app, {
      repository,
      resolvePrincipal: async () => ({ musicUserId: 11, subject: "subject", accountDocumentId: "account", sessionVersion: 1 }),
      allowedOrigins: ["https://explorers.example"],
      requestIdFactory: () => "openapi-success-request",
      now: () => new Date("2026-08-14T10:00:01.000Z"),
      publicRateLimited: () => false,
      youtube: {
        search: async () => ({ items: [youtubeVideo], nextPageToken: null }),
        videoFromUrl: async () => youtubeVideo,
      },
    });
    const ownerRead = { Authorization: "Bearer aaa.bbb.ccc" };
    const ownerWrite = { ...ownerRead, Origin: "https://explorers.example" };
    const guestWrite = { Origin: "https://explorers.example", "X-Music-Guest-Capability": "G".repeat(43) };
    const songInput = { youtubeId: "video", title: "Video", artist: "Artist", thumbnailUrl: "https://img/video" };
    const cases = [
      ["get", "/api/playlists", "/api/playlists", 200, undefined, ownerRead],
      ["post", "/api/playlists", "/api/playlists", 201, { name: "Saved list", description: null }, ownerWrite],
      ["get", "/api/playlists/{playlistId}", "/api/playlists/7", 200, undefined, ownerRead],
      ["patch", "/api/playlists/{playlistId}", "/api/playlists/7", 200, { name: "Saved list", description: null }, ownerWrite],
      ["post", "/api/playlists/{playlistId}/songs", "/api/playlists/7/songs", 201, songInput, ownerWrite],
      ["get", "/api/playlist/songs", "/api/playlist/songs", 200, undefined, ownerRead],
      ["post", "/api/playlist/songs", "/api/playlist/songs", 201, songInput, ownerWrite],
      ["post", "/api/playlist/currently-playing", "/api/playlist/currently-playing", 200, { songId: 21 }, ownerWrite],
      ["patch", "/api/playlist/songs/{songId}/position", "/api/playlist/songs/21/position", 200, { position: 0 }, ownerWrite],
      ["get", "/api/music/dashboard", "/api/music/dashboard", 200, undefined, ownerRead],
      ["post", "/api/youtube/search", "/api/youtube/search", 200, { query: "video" }, ownerWrite],
      ["post", "/api/youtube/video-from-url", "/api/youtube/video-from-url", 200, { url: "https://youtu.be/abcdefghijk" }, ownerWrite],
      ["post", "/api/playlist/{guestUrl}/youtube/search", "/api/playlist/public-owner/youtube/search", 200, { query: "video" }, guestWrite],
      ["post", "/api/playlist/{guestUrl}/youtube/video-from-url", "/api/playlist/public-owner/youtube/video-from-url", 200, { url: "https://youtu.be/abcdefghijk" }, guestWrite],
      ["post", "/api/music/publication", "/api/music/publication", 200, { mode: "public" }, { ...ownerWrite, "Idempotency-Key": "openapi-publication-1" }],
      ["get", "/api/music/entitlement", "/api/music/entitlement", 200, undefined, ownerRead],
      ["get", "/api/playlist/{guestUrl}", "/api/playlist/public-owner", 200, undefined, {}],
      ["post", "/api/playlist/{guestUrl}/requests", "/api/playlist/public-owner/requests", 201, songInput, guestWrite],
    ] as const;

    const dereferenced = await SwaggerParser.dereference(JSON.parse(JSON.stringify(MUSIC_OPENAPI_DOCUMENT)) as never) as any;
    const validator = new Ajv2020({ allErrors: true, strict: false });
    addFormats(validator);
    for (const [method, documentedPath, actualPath, status, requestBody, headers] of cases) {
      let pending = request(app)[method](actualPath).set(headers as Record<string, string>);
      if (requestBody !== undefined) pending = pending.send(requestBody);
      const response = await pending;
      expect(response.status, `${method} ${actualPath}`).toBe(status);
      const schema = dereferenced.paths[documentedPath][method].responses[String(status)].content["application/json"].schema;
      const validate = validator.compile(schema);
      expect(validate(response.body), `${method} ${actualPath}: ${JSON.stringify(validate.errors)}`).toBe(true);
    }

    const noContentCases = [
      ["delete", "/api/playlists/{playlistId}", "/api/playlists/7", undefined],
      ["delete", "/api/playlists/{playlistId}/songs/{songId}", "/api/playlists/7/songs/31", undefined],
      ["patch", "/api/playlists/{playlistId}/reorder", "/api/playlists/7/reorder", { songId: 31, position: 0 }],
      ["patch", "/api/playlists/{playlistId}/visibility", "/api/playlists/7/visibility", { isVisibleToGuests: true }],
      ["post", "/api/playlist/currently-playing", "/api/playlist/currently-playing", { songId: null }],
      ["delete", "/api/playlist/songs/bulk", "/api/playlist/songs/bulk", { songIds: [21] }],
      ["delete", "/api/playlist/songs/{songId}", "/api/playlist/songs/21", undefined],
      ["delete", "/api/playlist/history", "/api/playlist/history", undefined],
    ] as const;
    for (const [method, documentedPath, actualPath, requestBody] of noContentCases) {
      let pending = request(app)[method](actualPath).set(ownerWrite);
      if (requestBody !== undefined) pending = pending.send(requestBody);
      const response = await pending;
      expect(response.status, `${method} ${actualPath}`).toBe(204);
      expect(response.text).toBe("");
      expect(dereferenced.paths[documentedPath][method].responses["204"]).not.toHaveProperty("content");
    }

    expect((MUSIC_OPENAPI_DOCUMENT.components.schemas.EntitlementResponse.properties.state as { enum: readonly string[] }).enum)
      .toEqual(["unknown", "included", "eligible", "entitled", "revoked"]);
    expect(MUSIC_OPENAPI_DOCUMENT.components.schemas).toHaveProperty("PublicUser");

    const videoSchema = validator.compile(dereferenced.components.schemas.YouTubeVideo);
    expect(videoSchema(youtubeVideo)).toBe(true);
    expect(videoSchema({ ...youtubeVideo, unexpected: true }), JSON.stringify(videoSchema.errors)).toBe(false);
    expect(videoSchema({ ...youtubeVideo, snippet: { title: "Video", thumbnails: youtubeVideo.snippet.thumbnails } }), JSON.stringify(videoSchema.errors)).toBe(false);
    expect(videoSchema({ ...youtubeVideo, id: { videoId: "too-short" } }), JSON.stringify(videoSchema.errors)).toBe(false);

    const searchSchema = validator.compile(dereferenced.components.schemas.YouTubeSearchResponse);
    expect(searchSchema({ items: [youtubeVideo], nextPageToken: null })).toBe(true);
    expect(searchSchema({ items: [youtubeVideo] }), JSON.stringify(searchSchema.errors)).toBe(false);
    expect(searchSchema({ items: [youtubeVideo], nextPageToken: null, unexpected: true }), JSON.stringify(searchSchema.errors)).toBe(false);

    const publicUserSchema = validator.compile(dereferenced.components.schemas.PublicUser);
    expect(publicUserSchema(publicPlaylist.user)).toBe(true);
    expect(publicUserSchema({ ...publicPlaylist.user, theme: null })).toBe(true);
    expect(publicUserSchema({ ...publicPlaylist.user, theme: {} }), JSON.stringify(publicUserSchema.errors)).toBe(false);
    expect(publicUserSchema({ ...publicPlaylist.user, theme: { primary: "#123456", unexpected: true } }), JSON.stringify(publicUserSchema.errors)).toBe(false);
  });

  it("expresses the exact entitlement truth table and rejects unsupported or impossible responses", async () => {
    // Break caught: the published contract permits a core denial or grants premium mutation to a non-entitled state.
    const dereferenced = await SwaggerParser.dereference(JSON.parse(JSON.stringify(MUSIC_OPENAPI_DOCUMENT)) as never) as any;
    const validator = new Ajv2020({ allErrors: true, strict: false });
    addFormats(validator);
    const validate = validator.compile(dereferenced.components.schemas.EntitlementResponse);
    const base = { coreRead: true, coreMutation: true, paidMutation: false, maxAgeSeconds: 600 };

    for (const state of ["unknown", "included", "eligible", "revoked"] as const) {
      expect(validate({ ...base, state }), `${state}: ${JSON.stringify(validate.errors)}`).toBe(true);
    }
    expect(validate({ ...base, state: "entitled", paidMutation: true, sourceUpdatedAt: "2026-08-14T09:55:00.000Z" }), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...base, state: "entitled", paidMutation: false }), JSON.stringify(validate.errors)).toBe(true);

    expect(validate({ ...base, state: "paused" })).toBe(false);
    expect(validate({ ...base, state: "included", paidMutation: true })).toBe(false);
    expect(validate({ ...base, state: "entitled", paidMutation: true })).toBe(false);
    expect(validate({ ...base, state: "revoked", coreMutation: false })).toBe(false);
  });

  it("expresses the exact conditional publication response for every requested mode", async () => {
    const dereferenced = await SwaggerParser.dereference(JSON.parse(JSON.stringify(MUSIC_OPENAPI_DOCUMENT)) as never) as any;
    const validator = new Ajv2020({ allErrors: true, strict: false });
    const validate = validator.compile(dereferenced.components.schemas.PublicationCommandResponse);
    const slug = "public-owner-slug";
    const capability = "C".repeat(43);

    expect(validate({ version: "music-publication/v1", publication: { mode: "private", publicSlug: slug } })).toBe(true);
    expect(validate({ version: "music-publication/v1", publication: { mode: "public", publicSlug: slug } })).toBe(true);
    expect(validate({ version: "music-publication/v1", publication: { mode: "unlisted", publicSlug: slug }, capability })).toBe(true);

    for (const invalid of [
      { version: "music-publication/v1", publication: { mode: "unlisted", publicSlug: slug } },
      { version: "music-publication/v1", publication: { mode: "public", publicSlug: slug }, capability },
      { version: "music-publication/v1", publication: { mode: "private", publicSlug: null } },
      { version: "music-publication/v1", publication: { mode: "public", publicSlug: slug }, extra: true },
      { version: "music-publication/v1", publication: { mode: "public", publicSlug: slug, extra: true } },
      { version: "music-publication/v1", publication: { mode: "unlisted", publicSlug: slug }, capability: "short" },
    ]) expect(validate(invalid), JSON.stringify(validate.errors)).toBe(false);
  });
});
