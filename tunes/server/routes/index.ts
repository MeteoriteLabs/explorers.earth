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
import { createMusicCohortEntryResolver, parseMusicCohortConfiguration } from "../deployment/music-deployment";
import type { MusicIdentityRuntimeConfig } from "../config/music-identity-config";
import { MusicTokenService } from "../services/musicTokenService";
import { createMusicSocketCredentialVerifier, MusicPrincipalService } from "../middleware/musicPrincipal";
import { MusicDomainRepository } from "../repositories/musicDomainRepository";
import { MusicPublicationOperationRepository } from "../repositories/musicPublicationOperationRepository";
import { MusicPublicationResponseCipher } from "../services/musicPublicationResponseCrypto";
import { createYouTubeReadService } from "../services/youtubeReadService";
import { setupCanonicalMusicRoutes, setupMusicSurfaceBoundary } from "./musicSurfaceRoutes";
import { setupMusicOpenApiRoutes } from "./musicOpenApiRoutes";
import { MusicLifecycleService } from "../services/musicLifecycleService";
import { MusicOwnerSocketRegistry } from "../socket/musicSocketServer";
import {
  runMusicLifecycleWorkerOnce,
  startMusicLifecycleWorker,
  type AuthoritativeAbsence,
} from "../workers/musicLifecycleWorker";
import { startMusicReconciliationSuspensionListener } from "../services/musicReconciliationSuspensionListener";
import { MusicFeatureDecisionService, type MusicFeatureFlag } from "../services/musicFeatureDecisionService";
import { setupMusicFeatureRoutes } from "./musicFeatureRoutes";

const featureAllowlist = (value?: string) => new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean));
const featurePercentage = (value?: string) => { const parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 0; };

export async function registerRoutes(
  app: Express,
  _storage: IStorage,
  musicConfig: Omit<MusicIdentityRuntimeConfig, "lifecycleProofToken">,
  lifecycleAbsenceProof: {
    proveAbsence(identity: { userDocumentId: string; accountDocumentId: string }): Promise<AuthoritativeAbsence>;
    fixtureReadToken?: string;
  },
): Promise<Server> {
  if (process.env.MUSIC_DEPLOYMENT_HEALTH_ENABLED === "true") {
    setupMusicHealthRoutes(app, { pool });
  }
  if (process.env.MUSIC_MODE === "fixture") setupMusicFixtureProbeRoute(app, {
    mode: "fixture",
    databaseQuery: (sql) => pool.query(sql),
    migrationReadiness: () => checkMusicDatabaseReadiness(pool),
    strapiUrl: process.env.STRAPI_URL ?? "",
    strapiReadToken: lifecycleAbsenceProof.fixtureReadToken ?? "",
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
  const cohortEntryEnabled = createMusicCohortEntryResolver({
    killSwitch: () => process.env.MUSIC_NEW_ENTRY_KILL_SWITCH !== "false",
    cohort: parseMusicCohortConfiguration(process.env),
    resolveIdentity: (proof, requestId) => identityGateway.resolve(proof, requestId),
  });
  const musicTokens = new MusicTokenService(musicConfig.musicToken);
  const musicPrincipals = new MusicPrincipalService(musicTokens, identityRepository);
  const ownerSocketRegistry = new MusicOwnerSocketRegistry();
  const lifecycle = new MusicLifecycleService(identityGateway, identityRepository, {
    disconnectOwner: (musicUserId) => ownerSocketRegistry.disconnectOwner(musicUserId),
  });
  setupMusicIdentityRoutes(app, {
    ensure: (proof, requestId) => identityProjection.ensure(proof, requestId),
    mintCredential: (identity) => musicTokens.mint(identity),
    resolvePrincipal: (token) => musicPrincipals.resolve(token),
    lifecycle,
    isMusicCredential: (token) => {
      try { musicTokens.verify(token); return true; }
      catch { return false; }
    },
    entryEnabled: cohortEntryEnabled,
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
  const publicationOperations = new MusicPublicationOperationRepository(
    pool,
    new MusicPublicationResponseCipher(musicConfig.publicationResponse),
  );
  await publicationOperations.verifyReplayReadiness();
  const musicDomain = new MusicDomainRepository(pool, publicationOperations);
  const canonicalDependencies = {
    repository: musicDomain,
    resolvePrincipal: (token: string) => musicPrincipals.resolve(token),
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean) ?? ["http://localhost:5173"],
    trustedProxyHops: musicConfig.trustedProxyHops,
    isTrustedProxy: musicConfig.isTrustedProxy,
    youtube: createYouTubeReadService(process.env.YOUTUBE_API_KEY),
  };
  const featureFlags: MusicFeatureFlag[] = ["ownerWorkspace", "guestWorkspace", "playlistImports"];
  const featureEnvironment: Record<MusicFeatureFlag, string> = { ownerWorkspace: "OWNER_WORKSPACE", guestWorkspace: "GUEST_WORKSPACE", playlistImports: "PLAYLIST_IMPORTS" };
  const allowlists = Object.fromEntries(featureFlags.map((flag) => [flag, featureAllowlist(process.env[`MUSIC_FEATURE_${featureEnvironment[flag]}_ALLOWLIST`])])) as Record<MusicFeatureFlag, Set<string>>;
  const percentages = Object.fromEntries(featureFlags.map((flag) => [flag, featurePercentage(process.env[`MUSIC_FEATURE_${featureEnvironment[flag]}_PERCENT`])])) as Record<MusicFeatureFlag, number>;
  const featureDecisions = new MusicFeatureDecisionService({
    killSwitch: () => process.env.MUSIC_WORKSPACE_KILL_SWITCH !== "false",
    salt: process.env.MUSIC_FEATURE_COHORT_SALT ?? "",
    cohortVersion: process.env.MUSIC_FEATURE_COHORT_VERSION ?? "disabled-v1",
    allowlists,
    percentages,
    log: (entry) => console.info("music_feature_exposure", entry),
  });
  setupMusicFeatureRoutes(app, { resolvePrincipal: (token) => musicPrincipals.resolve(token), decide: (principal) => featureDecisions.decide(principal), allowedOrigins: canonicalDependencies.allowedOrigins });
  setupCanonicalMusicRoutes(app, canonicalDependencies);
  setupMusicOpenApiRoutes(app);
  setupAuthRoutes(app);
  setupReactivationRoutes(app, {
    reactivateMusic: async (identity) => { await lifecycle.reactivateBoundIdentity(identity); },
  });
  setupMusicSurfaceBoundary(app, canonicalDependencies);
  setupOwnerContainment(app);
  const server = setupPlaylistRoutes(app, {
    allowedOrigins: canonicalDependencies.allowedOrigins,
    ownerCredentials: createMusicSocketCredentialVerifier(musicPrincipals),
    resolveGuestCapability: (capability) => musicDomain.resolveGuestSocketAuthority(capability),
    ownerRegistry: ownerSocketRegistry,
  });
  let suspensionSafetyFailed = false;
  const failClosedSuspensionSafety = (): void => {
    if (suspensionSafetyFailed) return;
    suspensionSafetyFailed = true;
    const wasListening = server.listening;
    if (wasListening) server.close();
    void ownerSocketRegistry.disconnectAllSockets().catch(() => {
      console.error("music_reconciliation_socket_shutdown_failed");
    }).finally(() => {
      if (!wasListening) server.emit("error", new Error("Music reconciliation suspension safety failed"));
    });
  };
  const suspensionListener = await startMusicReconciliationSuspensionListener({
    pool,
    disconnectOwner: (musicUserId) => ownerSocketRegistry.disconnectOwner(musicUserId),
    onDisconnectError: () => {
      console.error("music_reconciliation_owner_disconnect_failed");
      failClosedSuspensionSafety();
    },
    onFatal: () => {
      console.error("music_reconciliation_suspension_listener_failed");
      failClosedSuspensionSafety();
    },
  });
  setupSeoRoutes(app, { listPublishedMusicPlaylists: () => musicDomain.listPublishedMusicPlaylists() });
  const lifecycleWorker = startMusicLifecycleWorker({
    intervalMs: 30_000,
    onError: () => console.error("music_lifecycle_worker_failed"),
    runOnce: async () => {
      const result = await runMusicLifecycleWorkerOnce({
        repository: identityRepository,
        proveAbsence: (identity) => lifecycleAbsenceProof.proveAbsence(identity),
        maxAttempts: 5,
        batchSize: 10,
      });
      if (result.claimed > 0) console.info("music_lifecycle_worker", result);
    },
  });
  const publicationShredTimer = setInterval(() => {
    void publicationOperations.shredExpiredResponses(1_000)
      .then(() => publicationOperations.compactExpiredOperations(1_000))
      .catch(() => {
      console.error("music_publication_response_shred_failed");
      });
  }, 60 * 1_000);
  publicationShredTimer.unref();
  server.once("close", () => {
    lifecycleWorker.stop();
    clearInterval(publicationShredTimer);
    void suspensionListener.stop().catch(() => {
      console.error("music_reconciliation_suspension_listener_stop_failed");
    });
  });

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
