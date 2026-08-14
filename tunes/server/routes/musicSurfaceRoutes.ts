import { randomUUID } from "node:crypto";
import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import { MusicIdentityError, musicErrorEnvelope } from "../../shared/musicError";
import { createMusicPrincipalMiddleware, MusicPrincipalError, resolveMusicPrincipalRequest, type MusicPrincipal } from "../middleware/musicPrincipal";
import { consumeContainmentLimit } from "../security-containment";
import {
  createGuestCapability,
  entitlementDecision,
  hashGuestCapability,
  MUSIC_ENTITLEMENT_MAX_AGE_SECONDS,
  type MusicEntitlementState,
} from "../policies/musicSurfacePolicy";

interface CanonicalMusicRepository {
  listPlaylists(ownerId: number): Promise<unknown[]>;
  getPlaylist(ownerId: number, playlistId: number): Promise<unknown | undefined>;
  createPlaylist(ownerId: number, input: { name: string; description: string | null }): Promise<unknown>;
  updatePlaylist(ownerId: number, playlistId: number, input: { name: string; description: string | null }): Promise<unknown | undefined>;
  deletePlaylist(ownerId: number, playlistId: number): Promise<boolean>;
  addPlaylistSong(ownerId: number, playlistId: number, input: { youtubeId: string; title: string; artist: string; thumbnailUrl: string }): Promise<unknown | undefined>;
  removePlaylistSong(ownerId: number, playlistId: number, songId: number): Promise<boolean>;
  reorderPlaylistSong(ownerId: number, playlistId: number, songId: number, position: number): Promise<boolean>;
  setPlaylistVisibility(ownerId: number, playlistId: number, visible: boolean): Promise<boolean>;
  listQueue(ownerId: number): Promise<unknown[]>;
  ownerDashboard(ownerId: number): Promise<unknown>;
  addSong(ownerId: number, input: { youtubeId: string; title: string; artist: string; thumbnailUrl: string }): Promise<unknown>;
  setPlaying(ownerId: number, songId: number | null): Promise<unknown | null | undefined>;
  updateSongPosition(ownerId: number, songId: number, position: number): Promise<unknown | undefined>;
  removeSong(ownerId: number, songId: number): Promise<boolean>;
  removeSongs(ownerId: number, songIds: number[]): Promise<number>;
  clearHistory(ownerId: number): Promise<number>;
  rotateGuestCapability(ownerId: number, capabilityHash: string): Promise<unknown>;
  revokeGuestCapability(ownerId: number): Promise<void>;
  setDiscoverable?(ownerId: number, discoverable: boolean): Promise<void>;
  resolveEntitlement(ownerId: number): Promise<{ state: MusicEntitlementState; sourceUpdatedAt?: Date } | undefined>;
  resolveGuestResource(publicSlug: string, capability?: string): Promise<{ state: string; noindex?: boolean; playlist?: unknown } | undefined>;
  resolveGuestSocketAuthority(capability: string): Promise<{ musicUserId: number; active: true; allowSongRequests: boolean } | undefined>;
}

export interface CanonicalMusicRouteDependencies {
  repository: CanonicalMusicRepository;
  resolvePrincipal(token: string): Promise<MusicPrincipal>;
  requestIdFactory?: () => string;
  now?: () => Date;
  allowedOrigins: string[];
  publicRateLimited?: (anonymousKeyHash: string) => boolean;
  youtube?: {
    search(input: { query: string; pageToken?: string }): Promise<unknown>;
    videoFromUrl(url: string): Promise<unknown | undefined>;
  };
}

const OWNER_KEYS = new Set([
  "username", "email", "userId", "musicUserId", "ownerId", "accountId", "documentId",
  "strapiUser", "strapiUserDocumentId", "strapiAccountDocumentId",
]);

export function setupCanonicalMusicRoutes(app: Express, dependencies: CanonicalMusicRouteDependencies): void {
  const requestIdFactory = dependencies.requestIdFactory ?? randomUUID;
  const principal = createMusicPrincipalMiddleware(dependencies.resolvePrincipal);
  const identify: RequestHandler = (req, res, next) => {
    const supplied = req.get("x-request-id");
    const requestId = supplied && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(supplied) ? supplied : requestIdFactory();
    res.locals.musicRequestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
  };
  const ownerInputGuard: RequestHandler = (req, _res, next) => {
    const headerTarget = ["x-username", "x-user-id", "x-owner-id", "x-account-id", "x-email"]
      .some((header) => req.get(header) !== undefined);
    const queryTarget = Object.keys(req.query).some((key) => OWNER_KEYS.has(key));
    const bodyTarget = req.body && typeof req.body === "object" && !Array.isArray(req.body)
      && Object.keys(req.body).some((key) => OWNER_KEYS.has(key));
    if (headerTarget || queryTarget || bodyTarget) return next(new MusicIdentityError(
      "REQUEST_INVALID", 400, "Owner targets are not accepted on Music requests.", "none", false,
    ));
    next();
  };
  const originGuard: RequestHandler = (req, _res, next) => {
    const origin = req.get("origin");
    if (!origin || !dependencies.allowedOrigins.includes(origin)) return next(new MusicIdentityError(
      "ORIGIN_FORBIDDEN", 403, "The request origin is not allowed.", "none", false,
    ));
    next();
  };
  const owner = (...handlers: RequestHandler[]) => [identify, principal, ownerInputGuard, ...handlers];
  const mutation = (...handlers: RequestHandler[]) => owner(originGuard, ...handlers);

  app.get("/api/playlists", ...owner(async (req, res, next) => {
    try { res.status(200).json(await dependencies.repository.listPlaylists(req.musicPrincipal!.musicUserId)); } catch (error) { next(error); }
  }));

  app.post("/api/playlists", ...mutation(async (req, res, next) => {
    try {
      const input = playlistInput(req.body);
      res.status(201).json(await dependencies.repository.createPlaylist(req.musicPrincipal!.musicUserId, input));
    } catch (error) { next(error); }
  }));

  app.get("/api/playlists/:playlistId", ...owner(async (req, res, next) => {
    try {
      const playlist = await dependencies.repository.getPlaylist(req.musicPrincipal!.musicUserId, positiveId(req.params.playlistId));
      if (!playlist) throw notFound();
      res.status(200).json(playlist);
    } catch (error) { next(error); }
  }));

  app.patch("/api/playlists/:playlistId", ...mutation(async (req, res, next) => {
    try {
      const playlist = await dependencies.repository.updatePlaylist(
        req.musicPrincipal!.musicUserId,
        positiveId(req.params.playlistId),
        playlistInput(req.body),
      );
      if (!playlist) throw notFound();
      res.status(200).json(playlist);
    } catch (error) { next(error); }
  }));

  app.delete("/api/playlists/:playlistId", ...mutation(async (req, res, next) => {
    try {
      if (!await dependencies.repository.deletePlaylist(req.musicPrincipal!.musicUserId, positiveId(req.params.playlistId))) throw notFound();
      res.status(204).end();
    } catch (error) { next(error); }
  }));

  app.post("/api/playlists/:playlistId/songs", ...mutation(async (req, res, next) => {
    try {
      const song = await dependencies.repository.addPlaylistSong(
        req.musicPrincipal!.musicUserId, positiveId(req.params.playlistId), songInput(req.body),
      );
      if (!song) throw notFound();
      res.status(201).json(song);
    } catch (error) { next(error); }
  }));

  app.delete("/api/playlists/:playlistId/songs/:songId", ...mutation(async (req, res, next) => {
    try {
      if (!await dependencies.repository.removePlaylistSong(
        req.musicPrincipal!.musicUserId, positiveId(req.params.playlistId), positiveId(req.params.songId),
      )) throw notFound();
      res.status(204).end();
    } catch (error) { next(error); }
  }));

  app.patch("/api/playlists/:playlistId/reorder", ...mutation(async (req, res, next) => {
    try {
      if (!req.body || Object.keys(req.body).some((key) => !["songId", "position"].includes(key))
          || !Number.isSafeInteger(req.body.position) || req.body.position < 0
          || !await dependencies.repository.reorderPlaylistSong(
            req.musicPrincipal!.musicUserId, positiveId(req.params.playlistId), positiveId(String(req.body.songId)), req.body.position,
          )) throw notFound();
      res.status(204).end();
    } catch (error) { next(error); }
  }));

  app.patch("/api/playlists/:playlistId/visibility", ...mutation(async (req, res, next) => {
    try {
      if (!req.body || Object.keys(req.body).some((key) => key !== "isVisibleToGuests")
          || typeof req.body.isVisibleToGuests !== "boolean") throw invalidQueue();
      if (!await dependencies.repository.setPlaylistVisibility(
        req.musicPrincipal!.musicUserId, positiveId(req.params.playlistId), req.body.isVisibleToGuests,
      )) throw notFound();
      res.status(204).end();
    } catch (error) { next(error); }
  }));

  app.get("/api/playlist/songs", ...owner(async (req, res, next) => {
    try { res.status(200).json(await dependencies.repository.listQueue(req.musicPrincipal!.musicUserId)); } catch (error) { next(error); }
  }));

  app.get("/api/music/dashboard", ...owner(async (req, res, next) => {
    try { res.status(200).json(await dependencies.repository.ownerDashboard(req.musicPrincipal!.musicUserId)); } catch (error) { next(error); }
  }));

  app.post("/api/playlist/songs", ...mutation(async (req, res, next) => {
    try { res.status(201).json(await dependencies.repository.addSong(req.musicPrincipal!.musicUserId, songInput(req.body))); } catch (error) { next(error); }
  }));

  app.post("/api/playlist/currently-playing", ...mutation(async (req, res, next) => {
    try {
      if (!req.body || Object.keys(req.body).some((key) => key !== "songId")) throw invalidQueue();
      const songId = req.body.songId === null ? null : positiveId(String(req.body.songId));
      const song = await dependencies.repository.setPlaying(req.musicPrincipal!.musicUserId, songId);
      if (songId === null) return res.status(204).end();
      if (!song) throw notFound();
      res.status(200).json(song);
    } catch (error) { next(error); }
  }));

  app.delete("/api/playlist/songs/bulk", ...mutation(async (req, res, next) => {
    try {
      const songIds = Array.isArray(req.body?.songIds) ? req.body.songIds.map((value: unknown) => positiveId(String(value))) : undefined;
      if (!songIds?.length || songIds.length > 100 || Object.keys(req.body).some((key) => key !== "songIds")) throw invalidQueue();
      await dependencies.repository.removeSongs(req.musicPrincipal!.musicUserId, songIds);
      res.status(204).end();
    } catch (error) { next(error); }
  }));

  app.delete("/api/playlist/songs/:songId", ...mutation(async (req, res, next) => {
    try {
      if (!await dependencies.repository.removeSong(req.musicPrincipal!.musicUserId, positiveId(req.params.songId))) throw notFound();
      res.status(204).end();
    } catch (error) { next(error); }
  }));

  app.patch("/api/playlist/songs/:songId/position", ...mutation(async (req, res, next) => {
    try {
      if (!req.body || Object.keys(req.body).some((key) => key !== "position")
          || !Number.isSafeInteger(req.body.position) || req.body.position < 0) throw invalidQueue();
      const song = await dependencies.repository.updateSongPosition(
        req.musicPrincipal!.musicUserId,
        positiveId(req.params.songId),
        req.body.position,
      );
      if (!song) throw notFound();
      res.status(200).json(song);
    } catch (error) { next(error); }
  }));

  app.delete("/api/playlist/history", ...mutation(async (req, res, next) => {
    try { await dependencies.repository.clearHistory(req.musicPrincipal!.musicUserId); res.status(204).end(); } catch (error) { next(error); }
  }));

  app.post("/api/youtube/search", ...mutation(async (req, res, next) => {
    try {
      if (!dependencies.youtube || !req.body || typeof req.body.query !== "string"
          || req.body.query.trim().length < 1 || req.body.query.length > 200
          || Object.keys(req.body).some((key) => !["query", "pageToken"].includes(key))
          || (req.body.pageToken !== undefined && (typeof req.body.pageToken !== "string" || req.body.pageToken.length > 256))) {
        throw new MusicIdentityError("REQUEST_INVALID", 400, "The YouTube search input is invalid.", "none", false);
      }
      res.status(200).json(await dependencies.youtube.search({ query: req.body.query.trim(), pageToken: req.body.pageToken }));
    } catch (error) { next(error); }
  }));

  app.post("/api/youtube/video-from-url", ...mutation(async (req, res, next) => {
    try {
      if (!dependencies.youtube || !req.body || typeof req.body.url !== "string" || req.body.url.length > 2_048
          || Object.keys(req.body).some((key) => key !== "url")) {
        throw new MusicIdentityError("REQUEST_INVALID", 400, "The YouTube URL is invalid.", "none", false);
      }
      const video = await dependencies.youtube.videoFromUrl(req.body.url);
      if (!video) throw notFound();
      res.status(200).json(video);
    } catch (error) { next(error); }
  }));

  app.post("/api/music/guest-capability/rotate", ...mutation(async (req, res, next) => {
    try {
      const capability = createGuestCapability();
      await dependencies.repository.rotateGuestCapability(req.musicPrincipal!.musicUserId, hashGuestCapability(capability));
      res.status(200).json({ version: "music-guest-capability/v1", capability });
    } catch (error) { next(error); }
  }));

  app.post("/api/music/guest-capability/revoke", ...mutation(async (req, res, next) => {
    try { await dependencies.repository.revokeGuestCapability(req.musicPrincipal!.musicUserId); res.status(204).end(); } catch (error) { next(error); }
  }));

  app.post("/api/music/publication/:action", ...mutation(async (req, res, next) => {
    try {
      if (!dependencies.repository.setDiscoverable || !["publish", "unpublish"].includes(req.params.action)) {
        throw new MusicIdentityError("REQUEST_INVALID", 400, "The publication action is invalid.", "none", false);
      }
      await dependencies.repository.setDiscoverable(req.musicPrincipal!.musicUserId, req.params.action === "publish");
      res.status(204).end();
    } catch (error) { next(error); }
  }));

  app.post("/api/music/paid/import", ...mutation(async (req, res, next) => {
    try {
      const entitlement = await dependencies.repository.resolveEntitlement(req.musicPrincipal!.musicUserId);
      if (!entitlement || !entitlementDecision(entitlement, dependencies.now?.() ?? new Date()).paidMutation) {
        throw new MusicIdentityError("ENTITLEMENT_REQUIRED", 403, "A current Music entitlement is required.", "none", false);
      }
      throw new MusicIdentityError("SURFACE_REMOVED", 410, "This Music operation is unavailable.", "none", false);
    } catch (error) { next(error); }
  }));

  app.get("/api/music/entitlement", ...owner(async (req, res, next) => {
    try {
      const entitlement = await dependencies.repository.resolveEntitlement(req.musicPrincipal!.musicUserId)
        ?? { state: "unknown" as const };
      const decision = entitlementDecision(entitlement, dependencies.now?.() ?? new Date());
      res.status(200).json({
        state: entitlement.state,
        sourceUpdatedAt: entitlement.sourceUpdatedAt?.toISOString(),
        paidMutation: decision.paidMutation,
        coreRead: decision.coreRead,
        coreMutation: decision.coreMutation,
        maxAgeSeconds: MUSIC_ENTITLEMENT_MAX_AGE_SECONDS,
      });
    } catch (error) { next(error); }
  }));

  app.get("/api/playlist/:guestUrl", identify, async (req, res, next) => {
    try {
      const anonymousKeyHash = hashGuestCapability(req.params.guestUrl);
      const limited = dependencies.publicRateLimited?.(anonymousKeyHash)
        ?? consumeContainmentLimit(`c6-public:${anonymousKeyHash}`, 60, 60_000);
      if (limited) throw new MusicIdentityError(
        "RATE_LIMITED", 429, "Too many Music requests.", "retry", true, 60,
      );
      const suppliedCapability = req.get("x-music-guest-capability");
      const capability = suppliedCapability && /^[A-Za-z0-9_-]{43}$/.test(suppliedCapability)
        ? suppliedCapability
        : undefined;
      const resource = await dependencies.repository.resolveGuestResource(req.params.guestUrl, capability);
      if (!resource || !["unlisted", "public"].includes(resource.state) || !resource.playlist) throw notFound();
      if (resource.noindex) res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.status(200).json(resource.playlist);
    } catch (error) { next(error); }
  });

  app.post("/api/music/guest/request", identify, originGuard, async (req, res, next) => {
    try {
      const capability = req.get("x-music-guest-capability") ?? "";
      if (!/^[A-Za-z0-9_-]{43}$/.test(capability)) throw invalidGuestCapability();
      const capabilityHash = hashGuestCapability(capability);
      if (consumeContainmentLimit(`c6-guest-request:${capabilityHash}`, 20, 60_000)) {
        throw new MusicIdentityError("RATE_LIMITED", 429, "Too many Music requests.", "retry", true, 60);
      }
      const authority = await dependencies.repository.resolveGuestSocketAuthority(capability);
      if (!authority?.active || !authority.allowSongRequests) throw invalidGuestCapability();
      res.status(201).json(await dependencies.repository.addSong(authority.musicUserId, songInput(req.body)));
    } catch (error) { next(error); }
  });

  app.use((cause: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    const error = safeRouteError(cause);
    if (error.status === 429 || error.status === 503) res.setHeader("Retry-After", String(error.retryAfterSeconds ?? 1));
    res.status(error.status).json(musicErrorEnvelope(error, res.locals.musicRequestId ?? requestIdFactory()));
  });
}

/**
 * First-handler fail-closed boundary for every legacy surface which has not
 * been replaced by a canonical route above it. It never delegates owner,
 * paid, admin, GraphQL, or ambiguous legacy authority into old handlers.
 */
export function setupMusicSurfaceBoundary(app: Express, dependencies: CanonicalMusicRouteDependencies): void {
  const requestIdFactory = dependencies.requestIdFactory ?? randomUUID;
  app.use(async (req, res, next) => {
    const requestId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(req.get("x-request-id") ?? "")
      ? req.get("x-request-id")!
      : requestIdFactory();
    res.setHeader("X-Request-Id", requestId);
    const path = req.path;
    const admin = path.startsWith("/api/admin/");
    const tombstone = path === "/graphql" || path === "/api/strapi/graphql"
      || path === "/api"
      || path === "/api/strapi/config" || path === "/api/debug/strapi"
      || path.startsWith("/api-docs/")
      || path.startsWith("/api/page-contents/") || path.startsWith("/api/verify-email")
      || path === "/api/resend-verification"
      || path.startsWith("/api/auth/") || path === "/api/register" || path === "/api/connect/google";
    if (path.startsWith("/api/auth/") && consumeContainmentLimit(`c6-legacy-identity:${req.socket.remoteAddress ?? "unknown"}`, 30, 60_000)) {
      const error = new MusicIdentityError("RATE_LIMITED", 429, "Too many Music requests.", "retry", true, 60);
      res.setHeader("Retry-After", "60");
      return res.status(429).json(musicErrorEnvelope(error, requestId));
    }
    if (admin || tombstone) {
      const error = new MusicIdentityError("SURFACE_REMOVED", 410, "This Music operation is unavailable.", "none", false);
      return res.status(410).json(musicErrorEnvelope(error, requestId));
    }
    const publicPath = path.startsWith("/health/") || [
      "/api/music-entry/status", "/robots.txt", "/sitemap.xml", "/api/explorers-sitemap.xml",
      "/itunes-api/search", "/api/user/request-reactivation", "/api/user/reactivate", "/api/music-fixture/readiness",
    ].includes(path);
    const nativePath = ["/api/login", "/api/logout", "/api/check", "/api/csrf-token"].includes(path);
    if (publicPath || nativePath || !isLegacyMusicSurface(path)) return next();
    try {
      req.musicPrincipal = await resolveMusicPrincipalRequest(req, dependencies.resolvePrincipal);
      if (hasForbiddenOwnerInput(req)) {
        throw new MusicIdentityError("REQUEST_INVALID", 400, "Owner targets are not accepted on Music requests.", "none", false);
      }
      if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
        const origin = req.get("origin");
        if (!origin || !dependencies.allowedOrigins.includes(origin)) {
          throw new MusicIdentityError("ORIGIN_FORBIDDEN", 403, "The request origin is not allowed.", "none", false);
        }
      }
      if (isPaidSurface(path)) {
        const entitlement = await dependencies.repository.resolveEntitlement(req.musicPrincipal.musicUserId);
        if (!entitlement || !entitlementDecision(entitlement, dependencies.now?.() ?? new Date()).paidMutation) {
          throw new MusicIdentityError("ENTITLEMENT_REQUIRED", 403, "A current Music entitlement is required.", "none", false);
        }
      }
      throw new MusicIdentityError("SURFACE_REMOVED", 410, "This Music operation is unavailable.", "none", false);
    } catch (cause) {
      const error = safeRouteError(cause);
      return res.status(error.status).json(musicErrorEnvelope(error, requestId));
    }
  });
}

function isPaidSurface(path: string): boolean {
  return path.startsWith("/api/payments/") || path.startsWith("/api/subscriptions/")
    || path.startsWith("/api/gemini/") || path.startsWith("/api/playlist/import-");
}

function isLegacyMusicSurface(path: string): boolean {
  return path.startsWith("/api/playlists") || path.startsWith("/api/playlist/")
    || path.startsWith("/api/user") || path.startsWith("/api/system-settings/")
    || path.startsWith("/api/youtube/") || path.startsWith("/api/instagram/")
    || path.startsWith("/api/payments/") || path.startsWith("/api/subscriptions/")
    || path.startsWith("/api/gemini/") || path.startsWith("/api/email/")
    || path === "/api/seo" || path.startsWith("/apps/") || path.startsWith("/products/")
    || path.startsWith("/people/") || path === "/proxy-image"
    || path.startsWith("/api/apps/") || path.startsWith("/api/products/")
    || path.startsWith("/api/people/") || path === "/api/proxy-image";
}

function hasForbiddenOwnerInput(req: Request): boolean {
  return ["x-username", "x-user-id", "x-owner-id", "x-account-id", "x-email"].some((header) => req.get(header) !== undefined)
    || Object.keys(req.query).some((key) => OWNER_KEYS.has(key))
    || !!req.body && typeof req.body === "object" && !Array.isArray(req.body) && Object.keys(req.body).some((key) => OWNER_KEYS.has(key));
}

function positiveId(value: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new MusicIdentityError("REQUEST_INVALID", 400, "The resource identifier is invalid.", "none", false);
  return id;
}

function playlistInput(value: unknown): { name: string; description: string | null } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MusicIdentityError("REQUEST_INVALID", 400, "The playlist input is invalid.", "none", false);
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["name", "description"].includes(key))
      || typeof body.name !== "string" || body.name.trim().length < 1 || body.name.length > 120
      || (body.description !== undefined && body.description !== null && (typeof body.description !== "string" || body.description.length > 2_000))) {
    throw new MusicIdentityError("REQUEST_INVALID", 400, "The playlist input is invalid.", "none", false);
  }
  return { name: body.name.trim(), description: typeof body.description === "string" ? body.description : null };
}

function songInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidQueue();
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["youtubeId", "title", "artist", "thumbnailUrl"].includes(key))
      || ![body.youtubeId, body.title, body.artist, body.thumbnailUrl].every((entry) => typeof entry === "string" && entry.length >= 1 && entry.length <= 1_024)) {
    throw invalidQueue();
  }
  return { youtubeId: body.youtubeId as string, title: body.title as string, artist: body.artist as string, thumbnailUrl: body.thumbnailUrl as string };
}

function invalidQueue() {
  return new MusicIdentityError("REQUEST_INVALID", 400, "The queue input is invalid.", "none", false);
}

function notFound() {
  return new MusicIdentityError("PUBLIC_NOT_FOUND", 404, "The Music resource was not found.", "none", false);
}

function invalidGuestCapability() {
  return new MusicIdentityError("GUEST_CAPABILITY_INVALID", 403, "The guest capability is invalid.", "none", false);
}

function safeRouteError(cause: unknown): MusicIdentityError {
  if (cause instanceof MusicIdentityError) return cause;
  if (cause instanceof MusicPrincipalError) {
    return new MusicIdentityError(cause.code, cause.status, cause.message, cause.status === 403 ? "contact_support" : "authenticate", false);
  }
  return new MusicIdentityError("TOKEN_INVALID", 401, "The Music credential is invalid.", "authenticate", false);
}
