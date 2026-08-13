import type { Express } from "express";
import type { Server } from "http";
import type { IStorage } from "../storage";
import { setupSwagger } from "../swagger";
import { setupUserRoutes } from "../user-routes";
import { setupPaymentRoutes } from "./paymentRoutes";
import { setupSubscriptionRoutes } from "./subscriptionRoutes";
import { setupGeminiRoutes } from "./geminiRoutes";
import { setupInstagramRoutes } from "./instagramRoutes";
import { setupGoogleOAuthRoutes } from "../google-oauth-routes";
import { setupAuthBridgeRoutes } from "../auth-bridge-routes";
import { setupSeoRoutes } from "../seo-routes";
import { setupAuthRoutes } from "./authRoutes";
import { setupPlaylistRoutes } from "./playlistRoutes";
import { setupAdminRoutes } from "./adminRoutes";
import { setupStrapiRoutes } from "./strapiRoutes";
import { setupYoutubeRoutes } from "./youtubeRoutes";
import { setupEmailRoutes } from "./emailRoutes";
import { setupPageRoutes } from "./pageRoutes";
import { setupReactivationRoutes } from "./reactivationRoutes";
import scrapeRoutes from "./scrapeRoutes";
import { setupMusicFixtureProbeRoute } from "./musicFixtureProbe";
import { pool } from "../db";
import { setupMusicHealthRoutes } from "../deployment/music-health";
import { checkMusicDatabaseReadiness } from "../db/readiness";
import { requestIdFor, sendContainmentError, setupNativeSessionContainment, setupOwnerContainment } from "../security-containment";
import { setupMusicIdentityRoutes } from "./musicIdentityRoutes";
import { BoundedIdentityRateLimiter } from "../middleware/identityRateLimit";
import { StrapiIdentityGateway } from "../services/strapiIdentityGateway";
import { MusicProjectionService } from "../services/musicProjectionService";
import { MusicIdentityRepository } from "../repositories/musicIdentityRepository";
import { resolveMusicEntryPolicy } from "../deployment/music-deployment";

export function registerRoutes(app: Express, _storage: IStorage): Server {
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
  setupSwagger(app);

  setupNativeSessionContainment(app);
  const identityGateway = new StrapiIdentityGateway({
    baseUrl: process.env.STRAPI_URL ?? "http://127.0.0.1:1337",
    maxConcurrency: 8,
    retries: 2,
    connectTimeoutMs: Number(process.env.MUSIC_CONNECT_TIMEOUT_MS ?? 2_000),
    readTimeoutMs: Number(process.env.MUSIC_READ_TIMEOUT_MS ?? 4_000),
    overallTimeoutMs: 10_000,
    cacheTtlMs: 30_000,
    circuitFailureThreshold: Number(process.env.MUSIC_CIRCUIT_FAILURE_THRESHOLD ?? 3),
    circuitOpenMs: 15_000,
  });
  const identityProjection = new MusicProjectionService(identityGateway, new MusicIdentityRepository(pool));
  setupMusicIdentityRoutes(app, {
    ensure: (proof, requestId) => identityProjection.ensure(proof, requestId),
    entryEnabled: () => resolveMusicEntryPolicy({
      killSwitch: process.env.MUSIC_NEW_ENTRY_KILL_SWITCH !== "false",
      cohortEnabled: process.env.MUSIC_COHORT_ENABLED === "true",
      inCohort: false,
    }).newMusicEntryEnabled,
    telemetry: () => ({ ...identityGateway.stats(), coalesced: identityProjection.stats().coalesced }),
    metrics: (entry) => console.info("music_identity_metric", entry),
    limiter: new BoundedIdentityRateLimiter({
      limit: Number(process.env.MUSIC_RATE_LIMIT_PER_MINUTE ?? 30),
      windowMs: 60_000,
      maxEntries: 10_000,
    }),
  });
  setupAuthRoutes(app);
  setupOwnerContainment(app);
  const server = setupPlaylistRoutes(app);
  setupAdminRoutes(app);
  setupStrapiRoutes(app);
  setupYoutubeRoutes(app);
  setupEmailRoutes(app);
  setupPageRoutes(app);
  setupReactivationRoutes(app);

  setupUserRoutes(app);
  setupPaymentRoutes(app);
  setupSubscriptionRoutes(app);
  setupGeminiRoutes(app);
  setupInstagramRoutes(app);
  setupGoogleOAuthRoutes(app);
  setupAuthBridgeRoutes(app);
  setupSeoRoutes(app);

  // Scraper Routes
  app.use("/api", scrapeRoutes);

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
  
  // GraphQL Proxy for Strapi
  app.post("/graphql", async (req, res) => {
    return sendContainmentError(res, 410, "GRAPHQL_PROXY_REMOVED", requestIdFor(req));
  });

  return server;
}
