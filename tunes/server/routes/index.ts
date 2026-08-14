import type { Express } from "express";
import type { Server } from "http";
import type { IStorage } from "../storage";
import { setupSeoRoutes } from "../seo-routes";
import { setupAuthRoutes } from "./authRoutes";
import { setupPlaylistRoutes } from "./playlistRoutes";
import { setupReactivationRoutes } from "./reactivationRoutes";
import { setupMusicFixtureProbeRoute } from "./musicFixtureProbe";
import { pool } from "../db";
import { setupMusicHealthRoutes } from "../deployment/music-health";
import { checkMusicDatabaseReadiness } from "../db/readiness";
import { setupNativeSessionContainment, setupOwnerContainment } from "../security-containment";
import { setupMusicIdentityRoutes } from "./musicIdentityRoutes";
import { BoundedIdentityRateLimiter } from "../middleware/identityRateLimit";
import { StrapiIdentityGateway } from "../services/strapiIdentityGateway";
import { MusicProjectionService } from "../services/musicProjectionService";
import { MusicIdentityRepository } from "../repositories/musicIdentityRepository";
import { resolveMusicEntryPolicy } from "../deployment/music-deployment";
import type { MusicIdentityRuntimeConfig } from "../config/music-identity-config";
import { MusicTokenService } from "../services/musicTokenService";
import { createMusicSocketCredentialVerifier, MusicPrincipalService } from "../middleware/musicPrincipal";
import { MusicDomainRepository } from "../repositories/musicDomainRepository";
import { createYouTubeReadService } from "../services/youtubeReadService";
import { setupCanonicalMusicRoutes, setupMusicSurfaceBoundary } from "./musicSurfaceRoutes";
import { setupMusicOpenApiRoutes } from "./musicOpenApiRoutes";

export function registerRoutes(app: Express, _storage: IStorage, musicConfig: MusicIdentityRuntimeConfig): Server {
  if (process.env.MUSIC_DEPLOYMENT_HEALTH_ENABLED === "true") {
    setupMusicHealthRoutes(app, { pool });
  }
  if (process.env.MUSIC_MODE === "fixture") setupMusicFixtureProbeRoute(app, {
    mode: "fixture",
    databaseQuery: (sql) => pool.query(sql),
    migrationReadiness: () => checkMusicDatabaseReadiness(pool),
    strapiUrl: process.env.STRAPI_URL ?? "",
    fetchImpl: fetch,
  });
  setupNativeSessionContainment(app);
  const identityGateway = new StrapiIdentityGateway({
    baseUrl: musicConfig.strapiOrigin,
    fetchImpl: musicConfig.fetchImpl,
    maxConcurrency: musicConfig.maxConcurrency,
    maxPending: musicConfig.maxPending,
    retries: musicConfig.retries,
    connectTimeoutMs: musicConfig.connectTimeoutMs,
    readTimeoutMs: musicConfig.readTimeoutMs,
    overallTimeoutMs: musicConfig.overallTimeoutMs,
    cacheTtlMs: musicConfig.cacheTtlMs,
    circuitFailureThreshold: musicConfig.circuitFailureThreshold,
    circuitOpenMs: musicConfig.circuitOpenMs,
  });
  const identityRepository = new MusicIdentityRepository(pool);
  const identityProjection = new MusicProjectionService(identityGateway, identityRepository, musicConfig.maxInflight);
  const musicTokens = new MusicTokenService(musicConfig.musicToken);
  const musicPrincipals = new MusicPrincipalService(musicTokens, identityRepository);
  setupMusicIdentityRoutes(app, {
    ensure: (proof, requestId) => identityProjection.ensure(proof, requestId),
    mintCredential: (identity) => musicTokens.mint(identity),
    resolvePrincipal: (token) => musicPrincipals.resolve(token),
    entryEnabled: () => resolveMusicEntryPolicy({
      killSwitch: process.env.MUSIC_NEW_ENTRY_KILL_SWITCH !== "false",
      cohortEnabled: process.env.MUSIC_COHORT_ENABLED === "true",
      inCohort: false,
    }).newMusicEntryEnabled,
    trustedProxyHops: musicConfig.trustedProxyHops,
    isTrustedProxy: musicConfig.isTrustedProxy,
    telemetry: () => ({ ...identityGateway.stats(), coalesced: identityProjection.stats().coalesced }),
    metrics: (entry) => console.info("music_identity_metric", entry),
    limiter: new BoundedIdentityRateLimiter({
      limit: musicConfig.rateLimitPerMinute,
      globalLimit: musicConfig.globalRateLimitPerMinute,
      windowMs: 60_000,
      maxEntries: musicConfig.rateMaxEntries,
    }),
  });
  const musicDomain = new MusicDomainRepository(pool);
  const canonicalDependencies = {
    repository: musicDomain,
    resolvePrincipal: (token: string) => musicPrincipals.resolve(token),
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean) ?? ["http://localhost:5173"],
    youtube: createYouTubeReadService(process.env.YOUTUBE_API_KEY),
  };
  setupCanonicalMusicRoutes(app, canonicalDependencies);
  setupMusicOpenApiRoutes(app);
  setupAuthRoutes(app);
  setupMusicSurfaceBoundary(app, canonicalDependencies);
  setupOwnerContainment(app);
  const server = setupPlaylistRoutes(app, {
    allowedOrigins: canonicalDependencies.allowedOrigins,
    ownerCredentials: createMusicSocketCredentialVerifier(musicPrincipals),
    resolveGuestCapability: (capability) => musicDomain.resolveGuestSocketAuthority(capability),
  });
  setupReactivationRoutes(app);
  setupSeoRoutes(app);

  // iTunes Search Proxy
  app.get("/itunes-api/search", async (req, res) => {
    try {
      const { term, entity, limit, media } = req.query;
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(String(term || ""))}&entity=${entity || "software"}&limit=${limit || 12}&media=${media || "software"}`;
      
      const response = await fetch(url);
      const data = await response.json();

      const affiliateToken = process.env.APPLE_AFFILIATE_TOKEN;
      if (affiliateToken && data.results) {
        data.results = data.results.map((item: any) => {
          if (item.trackViewUrl) {
            try {
              const u = new URL(item.trackViewUrl);
              u.searchParams.set("at", affiliateToken);
              item.trackViewUrl = u.toString();
            } catch {
              // ignore url parsing failures
            }
          }
          return item;
        });
      }

      res.json(data);
    } catch (error) {
      console.error("iTunes proxy search failed:", error);
      res.status(500).json({ error: "iTunes search proxy failed" });
    }
  });
  
  return server;
}
