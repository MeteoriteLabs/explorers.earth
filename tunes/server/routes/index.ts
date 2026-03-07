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

export function registerRoutes(app: Express, _storage: IStorage): Server {
  setupSwagger(app);

  setupAuthRoutes(app);
  const server = setupPlaylistRoutes(app);
  setupAdminRoutes(app);
  setupStrapiRoutes(app);
  setupYoutubeRoutes(app);
  setupEmailRoutes(app);
  setupPageRoutes(app);

  setupUserRoutes(app);
  setupPaymentRoutes(app);
  setupSubscriptionRoutes(app);
  setupGeminiRoutes(app);
  setupInstagramRoutes(app);
  setupGoogleOAuthRoutes(app);
  setupAuthBridgeRoutes(app);
  setupSeoRoutes(app);

  return server;
}
