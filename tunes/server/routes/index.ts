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
import { requestIdFor, sendContainmentError, setupNativeSessionContainment, setupOwnerContainment } from "../security-containment";

export function registerRoutes(app: Express, _storage: IStorage): Server {
  if (process.env.MUSIC_DEPLOYMENT_HEALTH_ENABLED === "true") {
    setupMusicHealthRoutes(app, { pool });
  }
  if (process.env.MUSIC_MODE === "fixture") setupMusicFixtureProbeRoute(app, {
    mode: "fixture",
    databaseQuery: (sql) => pool.query(sql),
    strapiUrl: process.env.STRAPI_URL ?? "",
    fetchImpl: fetch,
  });
  setupSwagger(app);

  setupNativeSessionContainment(app);
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
