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
  
  // GraphQL Proxy for Strapi
  app.post("/graphql", async (req, res) => {
    try {
      const strapiUrl = process.env.STRAPI_URL;
      const strapiToken = process.env.STRAPI_ACCESS_TOKEN;
      
      if (!strapiUrl) {
        return res.status(500).json({ error: "STRAPI_URL not configured" });
      }

      const authHeader = req.headers.authorization;
      const finalToken = authHeader || (strapiToken ? `Bearer ${strapiToken}` : undefined);
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      if (finalToken) {
        headers["Authorization"] = finalToken;
      }

      const response = await fetch(`${strapiUrl}/graphql`, {
        method: "POST",
        headers,
        body: JSON.stringify(req.body),
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error("❌ GraphQL Proxy Error:", error);
      res.status(500).json({ 
        error: "GraphQL Proxy Error", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  return server;
}
