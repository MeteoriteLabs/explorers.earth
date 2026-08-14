import { randomUUID } from "node:crypto";
import type { Express } from "express";

const ownerSecurity = [{ musicCredential: [] }];
const ownerOperation = (summary: string) => ({ summary, security: ownerSecurity, responses: { "2XX": { description: "Success" }, "4XX": { $ref: "#/components/responses/MusicError" } } });

export const MUSIC_OPENAPI_DOCUMENT = {
  openapi: "3.1.0",
  info: { title: "Explorers Music API", version: "music-principal-v1" },
  paths: {
    "/api/music/identity/ensure": { post: { summary: "Mint a local Music credential from an authoritative Explorer proof", responses: { "200": { description: "Credential minted" }, "4XX": { $ref: "#/components/responses/MusicError" } } } },
    "/api/music/identity/current": { get: ownerOperation("Resolve the current local Music principal") },
    "/api/playlists": { get: ownerOperation("List owner playlists"), post: ownerOperation("Create an owner playlist") },
    "/api/playlists/{playlistId}": { get: ownerOperation("Read an owner playlist"), patch: ownerOperation("Update an owner playlist"), delete: ownerOperation("Delete an owner playlist") },
    "/api/playlists/{playlistId}/songs": { post: ownerOperation("Add a saved-playlist item") },
    "/api/playlists/{playlistId}/songs/{songId}": { delete: ownerOperation("Remove a saved-playlist item") },
    "/api/playlists/{playlistId}/reorder": { patch: ownerOperation("Reorder a saved-playlist item") },
    "/api/playlists/{playlistId}/visibility": { patch: ownerOperation("Update saved-playlist guest visibility") },
    "/api/playlist/songs": { get: ownerOperation("List the owner queue"), post: ownerOperation("Add to the owner queue") },
    "/api/music/dashboard": { get: ownerOperation("Read private owner playback state") },
    "/api/playlist/currently-playing": { post: ownerOperation("Set the owner playing item") },
    "/api/playlist/songs/bulk": { delete: ownerOperation("Remove owner queue items") },
    "/api/playlist/songs/{songId}": { delete: ownerOperation("Remove an owner queue item") },
    "/api/playlist/songs/{songId}/position": { patch: ownerOperation("Reposition an owner queue item") },
    "/api/playlist/history": { delete: ownerOperation("Clear owner history") },
    "/api/music/guest-capability/rotate": { post: ownerOperation("Rotate the owner's guest capability") },
    "/api/music/guest-capability/revoke": { post: ownerOperation("Revoke the owner's guest capability") },
    "/api/music/publication/{action}": { post: ownerOperation("Publish or unpublish owner discovery") },
    "/api/music/paid/import": { post: ownerOperation("Entitlement-gated import tombstone") },
    "/api/music/entitlement": { get: ownerOperation("Read server-derived Music entitlement freshness") },
    "/api/youtube/search": { post: ownerOperation("Run typed read-only YouTube search") },
    "/api/youtube/video-from-url": { post: ownerOperation("Resolve one typed YouTube video URL") },
    "/api/playlist/{guestUrl}": { get: { summary: "Read an unlisted capability or explicit public playlist", responses: { "200": { description: "Published playlist" }, "404": { $ref: "#/components/responses/MusicError" }, "429": { $ref: "#/components/responses/MusicError" } } } },
    "/api/music/guest/request": { post: { summary: "Submit an allowlisted guest song request", responses: { "201": { description: "Request accepted" }, "403": { $ref: "#/components/responses/MusicError" }, "429": { $ref: "#/components/responses/MusicError" } } } },
  },
  components: {
    securitySchemes: { musicCredential: { type: "http", scheme: "bearer", bearerFormat: "C5 Music credential" } },
    responses: { MusicError: { description: "Shared request-bound Music failure", headers: { "X-Request-Id": { schema: { type: "string" } } }, content: { "application/json": { schema: { $ref: "#/components/schemas/MusicError" } } } } },
    schemas: { MusicError: { type: "object", required: ["version", "error"], properties: { version: { const: "music-error/v1" }, error: { type: "object", required: ["code", "message", "action", "retryable", "requestId"] } } } },
  },
} as const;

export function setupMusicOpenApiRoutes(app: Express): void {
  app.get("/api-docs", (req, res) => {
    const supplied = req.get("x-request-id");
    const requestId = supplied && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(supplied) ? supplied : randomUUID();
    res.setHeader("X-Request-Id", requestId);
    res.status(200).json(MUSIC_OPENAPI_DOCUMENT);
  });
}
