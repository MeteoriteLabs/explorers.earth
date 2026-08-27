import { randomUUID } from "node:crypto";
import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import { MusicIdentityError, musicErrorEnvelope } from "../../shared/musicError";
import { isMusicPublicationIdempotencyKeyCurrent } from "../../shared/musicPublicationContract";
import { createMusicPrincipalMiddleware, MusicPrincipalError, type MusicPrincipal } from "../middleware/musicPrincipal";
import { consumeContainmentLimit, consumePublicSurfaceLimit, safeMusicRequestError } from "../security-containment";
import {
  entitlementDecision,
  hashGuestCapability,
  MUSIC_ENTITLEMENT_MAX_AGE_SECONDS,
  type MusicEntitlementState,
} from "../policies/musicSurfacePolicy";
import { matchRetiredMusicSurface } from "../policies/musicRetirementPolicy";

interface CanonicalMusicRepository {
  listPlaylists(ownerId: number): Promise<unknown[]>;
  getPlaylist(ownerId: number, playlistId: number): Promise<unknown | undefined>;
  createPlaylist(ownerId: number, input: { name: string; description: string | null }): Promise<unknown | undefined>;
  updatePlaylist(ownerId: number, playlistId: number, input: { name: string; description: string | null }): Promise<unknown | undefined>;
  deletePlaylist(ownerId: number, playlistId: number): Promise<boolean>;
  addPlaylistSong(ownerId: number, playlistId: number, input: { youtubeId: string; title: string; artist: string; thumbnailUrl: string }): Promise<unknown | null | undefined>;
  removePlaylistSong(ownerId: number, playlistId: number, songId: number): Promise<boolean>;
  reorderPlaylistSong(ownerId: number, playlistId: number, songId: number, position: number): Promise<boolean>;
  setPlaylistVisibility(ownerId: number, playlistId: number, visible: boolean): Promise<boolean>;
  listQueue(ownerId: number): Promise<unknown[]>;
  replaceQueue(ownerId: number, idempotencyKey: string, expectedRevision: number, songs: Array<{ playlistId: number; songId: number }>): Promise<
    | { status: "completed"; replayed: boolean; response: { version: "music-queue/v1"; revision: number; songs: unknown[] } }
    | { status: "stale"; revision: number }
    | { status: "conflict" }
    | { status: "not_found" }
  >;
  ownerDashboard(ownerId: number): Promise<unknown>;
  getGuestControls(ownerId: number): Promise<GuestControls | undefined>;
  updateGuestControls(ownerId: number, controls: GuestControls): Promise<GuestControls | undefined>;
  addSong(ownerId: number, input: { youtubeId: string; title: string; artist: string; thumbnailUrl: string }): Promise<unknown>;
  setPlaying(ownerId: number, songId: number | null): Promise<unknown | null | undefined>;
  updateSongPosition(ownerId: number, songId: number, position: number): Promise<unknown | undefined>;
  removeSong(ownerId: number, songId: number): Promise<boolean>;
  removeSongs(ownerId: number, songIds: number[]): Promise<number>;
  clearHistory(ownerId: number): Promise<number>;
  setPublicationMode(ownerId: number, mode: "private" | "unlisted" | "public", capabilityHash?: string): Promise<{ mode: "private" | "unlisted" | "public"; publicSlug: string } | undefined>;
  executePublicationCommand(ownerId: number, idempotencyKey: string, mode: "private" | "unlisted" | "public"): Promise<
    | { status: "completed"; replayed: boolean; response: { version: "music-publication/v1"; publication: { mode: "private" | "unlisted" | "public"; publicSlug: string }; capability?: string } }
    | { status: "rate_limited"; retryAfterSeconds: number }
    | { status: "conflict" | "expired" | "invalid" | "not_found" }
  >;
  rotateGuestCapability(ownerId: number, capabilityHash: string): Promise<unknown>;
  revokeGuestCapability(ownerId: number): Promise<void>;
  setDiscoverable?(ownerId: number, discoverable: boolean): Promise<void>;
  resolveEntitlement(ownerId: number): Promise<{ state: MusicEntitlementState; sourceUpdatedAt?: Date } | undefined>;
  resolveGuestResource(publicSlug: string, capability?: string): Promise<{ state: string; noindex?: boolean; playlist?: unknown } | undefined>;
  resolveGuestSocketAuthority(capability: string): Promise<{ musicUserId: number; active: true; allowSongRequests: boolean } | undefined>;
  resolveGuestRequestAuthority(publicSlug: string, capability?: string): Promise<{ musicUserId: number; active: true; allowSongRequests: boolean } | undefined>;
}

export interface CanonicalMusicRouteDependencies {
  repository: CanonicalMusicRepository;
  resolvePrincipal(token: string): Promise<MusicPrincipal>;
  requestIdFactory?: () => string;
  now?: () => Date;
  allowedOrigins: string[];
  trustedProxyHops?: 0 | 1;
  isTrustedProxy?: (peerAddress: string | undefined) => boolean;
  publicRateLimited?: (input: { source: string; resource: string; capability?: string }) => boolean;
  youtube?: {
    search(input: { query: string; pageToken?: string }): Promise<unknown>;
    videoFromUrl(url: string): Promise<unknown | undefined>;
  };
}

const OWNER_KEYS = new Set([
  "username", "email", "userId", "musicUserId", "ownerId", "accountId", "documentId",
  "strapiUser", "strapiUserDocumentId", "strapiAccountDocumentId",
]);

export function isExactMusicOriginAllowed(req: Pick<Request, "get">, allowedOrigins: readonly string[]): boolean {
  const origin = req.get("origin");
  return typeof origin === "string" && allowedOrigins.includes(origin);
}

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
    if (!isExactMusicOriginAllowed(req, dependencies.allowedOrigins)) return next(new MusicIdentityError(
      "ORIGIN_FORBIDDEN", 403, "The request origin is not allowed.", "none", false,
    ));
    next();
  };
  const owner = (...handlers: RequestHandler[]) => [identify, principal, ownerInputGuard, ...handlers];
  const mutation = (...handlers: RequestHandler[]) => owner(originGuard, ...handlers);
  app.get("/api/playlists", ...owner(async (req, res, next) => {
    try { res.status(200).json((await dependencies.repository.listPlaylists(req.musicPrincipal!.musicUserId)).map(playlistDto)); } catch (error) { next(error); }
  }));

  app.post("/api/playlists", ...mutation(async (req, res, next) => {
    try {
      const input = playlistInput(req.body);
      const playlist = await dependencies.repository.createPlaylist(req.musicPrincipal!.musicUserId, input);
      if (!playlist) throw playlistLimitReached();
      res.status(201).json(playlistDto(playlist));
    } catch (error) { next(error); }
  }));

  app.get("/api/playlists/:playlistId", ...owner(async (req, res, next) => {
    try {
      const playlist = await dependencies.repository.getPlaylist(req.musicPrincipal!.musicUserId, positiveId(req.params.playlistId));
      if (!playlist) throw notFound();
      res.status(200).json(playlistDto(playlist));
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
      res.status(200).json(playlistDto(playlist));
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
      if (song === null) throw savedPlaylistLimitReached();
      if (!song) throw notFound();
      res.status(201).json(playlistSongDto(song));
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
    try { res.status(200).json((await dependencies.repository.listQueue(req.musicPrincipal!.musicUserId)).map(songDto)); } catch (error) { next(error); }
  }));

  app.post("/api/music/queue/replace", ...mutation(async (req, res, next) => {
    try {
      const idempotencyKey = req.get("idempotency-key");
      const input = queueReplaceInput(req.body);
      if (!idempotencyKey || idempotencyKey.length > 128) throw invalidQueue();
      const result = await dependencies.repository.replaceQueue(
        req.musicPrincipal!.musicUserId, idempotencyKey, input.expectedRevision, input.songs,
      );
      if (result.status === "stale") throw new MusicIdentityError(
        "QUEUE_REVISION_CONFLICT", 409, "The queue changed before replacement.", "retry", false,
      );
      if (result.status === "conflict") throw new MusicIdentityError(
        "IDEMPOTENCY_CONFLICT", 409, "The idempotency key was already used for another Music command.", "none", false,
      );
      if (result.status === "not_found") throw notFound();
      res.status(200).json({
        version: "music-queue/v1",
        revision: result.response.revision,
        songs: result.response.songs.map(songDto),
      });
    } catch (error) { next(error); }
  }));

  app.get("/api/music/dashboard", ...owner(async (req, res, next) => {
    try { res.status(200).json(dashboardDto(await dependencies.repository.ownerDashboard(req.musicPrincipal!.musicUserId), true)); } catch (error) { next(error); }
  }));

  app.patch("/api/music/guest-controls", ...mutation(async (req, res, next) => {
    try {
      const controls = guestControlsInput(req.body);
      const updated = await dependencies.repository.updateGuestControls(req.musicPrincipal!.musicUserId, controls);
      if (!updated) throw notFound();
      res.status(200).json(guestControlsDto(updated));
    } catch (error) { next(error); }
  }));
  app.get("/api/music/guest-controls", ...owner(async (req, res, next) => {
    try {
      const controls = await dependencies.repository.getGuestControls(req.musicPrincipal!.musicUserId);
      if (!controls) throw notFound();
      res.status(200).json(guestControlsDto(controls));
    } catch (error) { next(error); }
  }));

  app.post("/api/playlist/songs", ...mutation(async (req, res, next) => {
    try {
      const song = await dependencies.repository.addSong(req.musicPrincipal!.musicUserId, songInput(req.body));
      if (!song) throw queueLimitReached();
      res.status(201).json(songDto(song));
    } catch (error) { next(error); }
  }));

  app.post("/api/playlist/currently-playing", ...mutation(async (req, res, next) => {
    try {
      if (!req.body || Object.keys(req.body).some((key) => key !== "songId")) throw invalidQueue();
      const songId = req.body.songId === null ? null : positiveId(String(req.body.songId));
      const song = await dependencies.repository.setPlaying(req.musicPrincipal!.musicUserId, songId);
      if (songId === null) return res.status(204).end();
      if (!song) throw notFound();
      res.status(200).json(songDto(song));
    } catch (error) { next(error); }
  }));

  app.delete("/api/playlist/songs/bulk", ...mutation(async (req, res, next) => {
    try {
      const songIds = Array.isArray(req.body?.songIds) ? req.body.songIds.map((value: unknown) => positiveId(String(value))) : undefined;
      if (!songIds?.length || songIds.length > 500 || Object.keys(req.body).some((key) => key !== "songIds")) throw invalidQueue();
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
      res.status(200).json(songDto(song));
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

  app.post("/api/music/publication", ...mutation(async (req, res, next) => {
    try {
      const mode = req.body?.mode;
      const idempotencyKey = req.get("idempotency-key");
      if (!req.body || Object.keys(req.body).some((key) => key !== "mode")
          || !["private", "unlisted", "public"].includes(mode)
          || !idempotencyKey
          || !isMusicPublicationIdempotencyKeyCurrent(idempotencyKey, (dependencies.now?.() ?? new Date()).getTime())) {
        throw new MusicIdentityError("REQUEST_INVALID", 400, "The publication command is invalid.", "none", false);
      }
      const result = await dependencies.repository.executePublicationCommand(
        req.musicPrincipal!.musicUserId,
        idempotencyKey,
        mode,
      );
      if (result.status !== "completed") {
        if (result.status === "invalid") {
          throw new MusicIdentityError("REQUEST_INVALID", 400, "The publication command is invalid.", "none", false);
        }
        if (result.status === "conflict") {
          throw new MusicIdentityError("IDEMPOTENCY_CONFLICT", 409, "The idempotency key was already used for another Music command.", "none", false);
        }
        if (result.status === "expired") {
          throw new MusicIdentityError("PUBLICATION_REPLAY_EXPIRED", 409, "The publication replay window has expired.", "none", false);
        }
        if (result.status === "rate_limited") {
          throw new MusicIdentityError("RATE_LIMITED", 429, "Too many publication commands.", "retry", true, result.retryAfterSeconds);
        }
        throw notFound();
      }
      res.status(200).json(result.response);
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
      const suppliedCapability = req.get("x-music-guest-capability");
      const capability = suppliedCapability && /^[A-Za-z0-9_-]{43}$/.test(suppliedCapability)
        ? suppliedCapability
        : undefined;
      const peerAddress = req.socket.remoteAddress;
      const source = dependencies.trustedProxyHops === 1 && dependencies.isTrustedProxy?.(peerAddress)
        ? (req.ip ?? peerAddress ?? "unknown")
        : (peerAddress ?? "unknown");
      const rateInput = { source, resource: req.params.guestUrl, ...(capability ? { capability } : {}) };
      const limited = dependencies.publicRateLimited?.(rateInput) ?? consumePublicSurfaceLimit(rateInput);
      if (limited) throw new MusicIdentityError(
        "RATE_LIMITED", 429, "Too many Music requests.", "retry", true, 60,
      );
      const resource = await dependencies.repository.resolveGuestResource(req.params.guestUrl, capability);
      if (!resource || !["unlisted", "public"].includes(resource.state) || !resource.playlist) throw notFound();
      if (resource.noindex) res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.status(200).json(publicPlaylistDto(resource.playlist));
    } catch (error) { next(error); }
  });

  app.post("/api/playlist/:guestUrl/youtube/search", identify, originGuard, async (req, res, next) => {
    try {
      const authority = await guestRequestAuthority(req, dependencies);
      if (!dependencies.youtube || !req.body || typeof req.body.query !== "string"
          || req.body.query.trim().length < 1 || req.body.query.length > 200
          || Object.keys(req.body).some((key) => !["query", "pageToken"].includes(key))
          || (req.body.pageToken !== undefined && (typeof req.body.pageToken !== "string" || req.body.pageToken.length > 256))) {
        throw new MusicIdentityError("REQUEST_INVALID", 400, "The YouTube search input is invalid.", "none", false);
      }
      void authority;
      res.status(200).json(await dependencies.youtube.search({ query: req.body.query.trim(), pageToken: req.body.pageToken }));
    } catch (error) { next(error); }
  });

  app.post("/api/playlist/:guestUrl/youtube/video-from-url", identify, originGuard, async (req, res, next) => {
    try {
      await guestRequestAuthority(req, dependencies);
      if (!dependencies.youtube || !req.body || typeof req.body.url !== "string" || req.body.url.length > 2_048
          || Object.keys(req.body).some((key) => key !== "url")) {
        throw new MusicIdentityError("REQUEST_INVALID", 400, "The YouTube URL is invalid.", "none", false);
      }
      const video = await dependencies.youtube.videoFromUrl(req.body.url);
      if (!video) throw notFound();
      res.status(200).json(video);
    } catch (error) { next(error); }
  });

  app.post("/api/playlist/:guestUrl/requests", identify, originGuard, async (req, res, next) => {
    try {
      const capability = req.get("x-music-guest-capability") ?? "";
      const capabilityValid = /^[A-Za-z0-9_-]{43}$/.test(capability);
      const authorityKey = capabilityValid ? hashGuestCapability(capability) : `public:${req.params.guestUrl}`;
      if (consumeContainmentLimit(`c6-guest-request:${authorityKey}`, 20, 60_000)) {
        throw new MusicIdentityError("RATE_LIMITED", 429, "Too many Music requests.", "retry", true, 60);
      }
      const authority = await dependencies.repository.resolveGuestRequestAuthority(req.params.guestUrl, capabilityValid ? capability : undefined);
      if (!authority?.active || !authority.allowSongRequests) throw invalidGuestCapability();
      const song = await dependencies.repository.addSong(authority.musicUserId, songInput(req.body));
      if (!song) throw queueLimitReached();
      res.status(201).json(songDto(song));
    } catch (error) { next(error); }
  });

  app.use((cause: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    const error = safeRouteError(cause);
    if (error.status === 429 || error.status === 503) res.setHeader("Retry-After", String(error.retryAfterSeconds ?? 1));
    const currentHeader = res.getHeader("X-Request-Id");
    const requestId = res.locals.musicRequestId
      ?? (typeof currentHeader === "string" ? currentHeader : undefined)
      ?? requestIdFactory();
    res.setHeader("X-Request-Id", requestId);
    res.status(error.status).json(musicErrorEnvelope(error, requestId));
  });
}

/**
 * First-handler fail-closed boundary for every legacy surface which has not
 * been replaced by a canonical route above it. It never delegates owner,
 * paid, admin, GraphQL, or ambiguous legacy authority into old handlers.
 */
export function setupMusicSurfaceBoundary(app: Express, dependencies: CanonicalMusicRouteDependencies): void {
  const requestIdFactory = dependencies.requestIdFactory ?? randomUUID;
  app.all("/{*musicRetiredPath}", async (req, res, next) => {
    const requestId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(req.get("x-request-id") ?? "")
      ? req.get("x-request-id")!
      : requestIdFactory();
    res.setHeader("X-Request-Id", requestId);
    const retirement = matchRetiredMusicSurface(req.originalUrl);
    if (!retirement) return next();
    if (retirement.family === "legacy-browser-identity" && consumeContainmentLimit(`c6-legacy-identity:${req.socket.remoteAddress ?? "unknown"}`, 30, 60_000)) {
      const error = new MusicIdentityError("RATE_LIMITED", 429, "Too many Music requests.", "retry", true, 60);
      res.setHeader("Retry-After", "60");
      return res.status(429).json(musicErrorEnvelope(error, requestId));
    }
    const error = new MusicIdentityError("SURFACE_REMOVED", 410, "This Music operation is unavailable.", "none", false);
    return res.status(410).json(musicErrorEnvelope(error, requestId));
  });
}

function hasForbiddenOwnerInput(req: Request): boolean {
  return ["x-username", "x-user-id", "x-owner-id", "x-account-id", "x-email"].some((header) => req.get(header) !== undefined)
    || Object.keys(req.query).some((key) => OWNER_KEYS.has(key))
    || !!req.body && typeof req.body === "object" && !Array.isArray(req.body) && Object.keys(req.body).some((key) => OWNER_KEYS.has(key));
}

type DtoRecord = Record<string, unknown>;

function record(value: unknown): DtoRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as DtoRecord : {};
}

function property(source: DtoRecord, camelCase: string, snakeCase: string = camelCase): unknown {
  return source[camelCase] ?? source[snakeCase];
}

function dateTime(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  return value instanceof Date ? value.toISOString() : String(value);
}

function songDto(value: unknown) {
  const source = record(value);
  return {
    id: property(source, "id"),
    userId: property(source, "userId", "user_id"),
    youtubeId: property(source, "youtubeId", "youtube_id"),
    title: property(source, "title"),
    artist: property(source, "artist"),
    thumbnailUrl: property(source, "thumbnailUrl", "thumbnail_url"),
    position: property(source, "position"),
    status: property(source, "status"),
    playedAt: dateTime(property(source, "playedAt", "played_at")) ?? null,
  };
}

function playlistSongDto(value: unknown) {
  const source = record(value);
  return {
    id: property(source, "id"),
    playlistId: property(source, "playlistId", "playlist_id"),
    youtubeId: property(source, "youtubeId", "youtube_id"),
    title: property(source, "title"),
    artist: property(source, "artist"),
    thumbnailUrl: property(source, "thumbnailUrl", "thumbnail_url"),
    position: property(source, "position"),
    addedAt: dateTime(property(source, "addedAt", "added_at")),
  };
}

function playlistDto(value: unknown) {
  const source = record(value);
  const songs = property(source, "songs");
  return {
    id: property(source, "id"),
    userId: property(source, "userId", "user_id"),
    name: property(source, "name"),
    description: property(source, "description") ?? null,
    isVisibleToGuests: property(source, "isVisibleToGuests", "is_visible_to_guests") === true,
    createdAt: dateTime(property(source, "createdAt", "created_at")),
    updatedAt: dateTime(property(source, "updatedAt", "updated_at")),
    songs: Array.isArray(songs) ? songs.map(playlistSongDto) : [],
  };
}

function dashboardDto(value: unknown, includeQueueRevision = false) {
  const source = record(value);
  const songs = property(source, "songs");
  const playedSongs = property(source, "playedSongs", "played_songs");
  const currentlyPlaying = property(source, "currentlyPlaying", "currently_playing");
  const publication = record(property(source, "publication"));
  return {
    ...(includeQueueRevision ? { queueRevision: Number(property(source, "queueRevision", "queue_revision") ?? 0) } : {}),
    songs: Array.isArray(songs) ? songs.map(songDto) : [],
    currentlyPlaying: currentlyPlaying ? songDto(currentlyPlaying) : null,
    playedSongs: Array.isArray(playedSongs) ? playedSongs.map(songDto) : [],
    ...(property(source, "publication") ? { publication: {
      mode: property(publication, "mode"),
      publicSlug: property(publication, "publicSlug", "public_slug"),
    } } : {}),
    ...(property(source, "guestControls", "guest_controls") ? { guestControls: guestControlsDto(property(source, "guestControls", "guest_controls")) } : {}),
  };
}

type GuestControls = {
  allowSongRequests: boolean;
  allowGuestPlayOnDevice: boolean;
  allowPlaylistSharing: boolean;
  allowRecentlyPlayedVisibility: boolean;
};

const GUEST_CONTROL_KEYS = ["allowSongRequests", "allowGuestPlayOnDevice", "allowPlaylistSharing", "allowRecentlyPlayedVisibility"] as const;

function guestControlsInput(value: unknown): GuestControls {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidQueue();
  const source = value as Record<string, unknown>;
  if (Object.keys(source).length !== GUEST_CONTROL_KEYS.length
      || Object.keys(source).some((key) => !GUEST_CONTROL_KEYS.includes(key as typeof GUEST_CONTROL_KEYS[number]))
      || GUEST_CONTROL_KEYS.some((key) => typeof source[key] !== "boolean")) throw invalidQueue();
  return Object.fromEntries(GUEST_CONTROL_KEYS.map((key) => [key, source[key]])) as unknown as GuestControls;
}

function guestControlsDto(value: unknown): GuestControls {
  const source = record(value);
  return {
    allowSongRequests: property(source, "allowSongRequests", "allow_song_requests") === true,
    allowGuestPlayOnDevice: property(source, "allowGuestPlayOnDevice", "allow_guest_play_on_device") === true,
    allowPlaylistSharing: property(source, "allowPlaylistSharing", "allow_playlist_sharing") === true,
    allowRecentlyPlayedVisibility: property(source, "allowRecentlyPlayedVisibility", "allow_recently_played_visibility") === true,
  };
}

function publicPlaylistDto(value: unknown) {
  const source = record(value);
  const user = record(property(source, "user"));
  const playlists = property(source, "playlists");
  return {
    ...dashboardDto(source),
    user: {
      id: property(user, "id"),
      username: property(user, "username"),
      guestUrl: property(user, "guestUrl", "guest_url"),
      venueName: property(user, "venueName", "venue_name") ?? null,
      theme: property(user, "theme") ?? null,
      allowSongRequests: property(user, "allowSongRequests", "allow_song_requests") === true,
      allowGuestPlayOnDevice: property(user, "allowGuestPlayOnDevice", "allow_guest_play_on_device") === true,
      allowPlaylistSharing: property(user, "allowPlaylistSharing", "allow_playlist_sharing") === true,
      allowRecentlyPlayedVisibility: property(user, "allowRecentlyPlayedVisibility", "allow_recently_played_visibility") === true,
    },
    allowGuestPlayOnDevice: property(source, "allowGuestPlayOnDevice", "allow_guest_play_on_device") === true,
    allowRecentlyPlayedVisibility: property(source, "allowRecentlyPlayedVisibility", "allow_recently_played_visibility") === true,
    playlists: Array.isArray(playlists) ? playlists.map(playlistDto) : [],
  };
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
      || typeof body.youtubeId !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(body.youtubeId)
      || ![body.title, body.artist].every((entry) => typeof entry === "string" && entry.length >= 1 && entry.length <= 1_024)
      || typeof body.thumbnailUrl !== "string" || body.thumbnailUrl.length < 1 || body.thumbnailUrl.length > 2_048) {
    throw invalidQueue();
  }
  return { youtubeId: body.youtubeId as string, title: body.title as string, artist: body.artist as string, thumbnailUrl: body.thumbnailUrl as string };
}

function queueReplaceInput(value: unknown): { expectedRevision: number; songs: Array<{ playlistId: number; songId: number }> } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidQueue();
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["expectedRevision", "songs"].includes(key))
      || !Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0
      || !Array.isArray(body.songs) || body.songs.length > 500) throw invalidQueue();
  const songs = body.songs.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidQueue();
    const source = value as Record<string, unknown>;
    if (Object.keys(source).some((key) => !["playlistId", "songId"].includes(key))
        || !Number.isSafeInteger(source.playlistId) || Number(source.playlistId) < 1
        || !Number.isSafeInteger(source.songId) || Number(source.songId) < 1) throw invalidQueue();
    return { playlistId: Number(source.playlistId), songId: Number(source.songId) };
  });
  return { expectedRevision: Number(body.expectedRevision), songs };
}

function invalidQueue() {
  return new MusicIdentityError("REQUEST_INVALID", 400, "The queue input is invalid.", "none", false);
}

function queueLimitReached() {
  return new MusicIdentityError("REQUEST_INVALID", 400, "The Music queue can contain at most 500 songs.", "none", false);
}

function playlistLimitReached() {
  return new MusicIdentityError("REQUEST_INVALID", 400, "Music can contain at most 200 saved playlists.", "none", false);
}

function savedPlaylistLimitReached() {
  return new MusicIdentityError("REQUEST_INVALID", 400, "A saved playlist can contain at most 500 songs.", "none", false);
}

function notFound() {
  return new MusicIdentityError("PUBLIC_NOT_FOUND", 404, "The Music resource was not found.", "none", false);
}

function invalidGuestCapability() {
  return new MusicIdentityError("GUEST_CAPABILITY_INVALID", 403, "The guest capability is invalid.", "none", false);
}

async function guestRequestAuthority(req: Request, dependencies: CanonicalMusicRouteDependencies) {
  const capability = req.get("x-music-guest-capability") ?? "";
  const capabilityValid = /^[A-Za-z0-9_-]{43}$/.test(capability);
  const authorityKey = capabilityValid ? hashGuestCapability(capability) : `public:${req.params.guestUrl}`;
  if (consumeContainmentLimit(`c6-guest-lookup:${authorityKey}`, 30, 60_000)) {
    throw new MusicIdentityError("RATE_LIMITED", 429, "Too many Music requests.", "retry", true, 60);
  }
  const authority = await dependencies.repository.resolveGuestRequestAuthority(req.params.guestUrl, capabilityValid ? capability : undefined);
  if (!authority?.active || !authority.allowSongRequests) throw invalidGuestCapability();
  return authority;
}

function safeRouteError(cause: unknown): MusicIdentityError {
  if (cause instanceof MusicIdentityError) return cause;
  if (cause instanceof MusicPrincipalError) {
    return new MusicIdentityError(cause.code, cause.status, cause.message, cause.status === 403 ? "contact_support" : "authenticate", false);
  }
  return safeMusicRequestError(cause);
}
