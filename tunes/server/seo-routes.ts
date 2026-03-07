import { Express } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { insertSeoSettingsSchema } from "@shared/schema";

/**
 * Registers SEO-related routes
 * @param app Express application instance
 */
export function setupSeoRoutes(app: Express) {
  // Get SEO settings
  app.get("/api/seo", async (req, res) => {
    try {
      const settings = await storage.getSeoSettings();
      
      if (!settings) {
        return res.status(404).json({ message: "SEO settings not found" });
      }
      
      return res.json(settings);
    } catch (error) {
      console.error("Error getting SEO settings:", error);
      return res.status(500).json({ message: "Error getting SEO settings" });
    }
  });

  // Update SEO settings - super admin only
  app.put("/api/seo", async (req, res) => {
    // Only allow the super admin user (yapral27) to update SEO settings
    if (!req.isAuthenticated() || req.user!.username !== 'yapral27') {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    try {
      // Validate the update data
      const updateSchema = insertSeoSettingsSchema.partial();
      const validateResult = updateSchema.safeParse(req.body);
      
      if (!validateResult.success) {
        return res.status(400).json({ 
          message: "Invalid SEO settings data",
          errors: validateResult.error.format() 
        });
      }
      
      // Add the current user's ID as the updater
      const updates = {
        ...validateResult.data,
        updatedBy: req.user!.id
      };
      
      const updatedSettings = await storage.updateSeoSettings(updates);
      return res.json(updatedSettings);
    } catch (error) {
      console.error("Error updating SEO settings:", error);
      return res.status(500).json({ message: "Error updating SEO settings" });
    }
  });

  // Get robots.txt content
  app.get("/robots.txt", async (req, res) => {
    try {
      const settings = await storage.getSeoSettings();
      
      if (!settings) {
        // Default robots.txt if no settings exist
        return res.type('text/plain').send('User-agent: *\nAllow: /');
      }
      
      return res.type('text/plain').send(settings.robotsTxt);
    } catch (error) {
      console.error("Error getting robots.txt:", error);
      return res.status(500).type('text/plain').send('User-agent: *\nAllow: /');
    }
  });

  // Get sitemap.xml content
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const settings = await storage.getSeoSettings();
      
      if (!settings) {
        // Default sitemap.xml if no settings exist
        const defaultSitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://cosmic.app/</loc>\n    <lastmod>2025-04-03</lastmod>\n    <priority>1.0</priority>\n  </url>\n</urlset>';
        return res.type('application/xml').send(defaultSitemap);
      }
      
      return res.type('application/xml').send(settings.sitemapXml);
    } catch (error) {
      console.error("Error getting sitemap.xml:", error);
      const defaultSitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://cosmic.app/</loc>\n    <lastmod>2025-04-03</lastmod>\n    <priority>1.0</priority>\n  </url>\n</urlset>';
      return res.status(500).type('application/xml').send(defaultSitemap);
    }
  });
}