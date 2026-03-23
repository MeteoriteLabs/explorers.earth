import { Express } from "express";
import { storage } from "./storage";
import { z } from "zod";
import { insertSeoSettingsSchema, users } from "@shared/schema";
import { db } from "./db";
import { isNotNull } from "drizzle-orm";

const TUNES_BASE_URL = "https://localtunes.earth";
const EXPLORERS_BASE_URL = "https://explorers.earth";
const SITEMAP_CACHE_TTL = 60 * 60 * 1000; // 1 hour in ms

// Simple in-memory cache for sitemaps
const sitemapCache: Record<string, { xml: string; timestamp: number }> = {};

function getCachedSitemap(key: string): string | null {
  const cached = sitemapCache[key];
  if (cached && Date.now() - cached.timestamp < SITEMAP_CACHE_TTL) {
    return cached.xml;
  }
  return null;
}

function setCachedSitemap(key: string, xml: string): void {
  sitemapCache[key] = { xml, timestamp: Date.now() };
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildSitemapXml(urls: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: number }>): string {
  const today = new Date().toISOString().split("T")[0];
  const entries = urls
    .map(
      (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod || today}</lastmod>
    <changefreq>${u.changefreq || "weekly"}</changefreq>
    <priority>${u.priority ?? 0.5}</priority>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
}

/**
 * Generate dynamic tunes sitemap with real venue guest URLs
 */
async function generateTunesSitemap(): Promise<string> {
  const cached = getCachedSitemap("tunes");
  if (cached) return cached;

  const urls: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: number }> = [
    // Static pages
    { loc: `${TUNES_BASE_URL}/`, changefreq: "weekly", priority: 1.0 },
    { loc: `${TUNES_BASE_URL}/auth`, changefreq: "monthly", priority: 0.6 },
    { loc: `${TUNES_BASE_URL}/terms`, changefreq: "monthly", priority: 0.5 },
    { loc: `${TUNES_BASE_URL}/privacy`, changefreq: "monthly", priority: 0.5 },
    // Feature pages
    { loc: `${TUNES_BASE_URL}/features/venues`, changefreq: "monthly", priority: 0.8 },
    { loc: `${TUNES_BASE_URL}/features/guest-experience`, changefreq: "monthly", priority: 0.8 },
    { loc: `${TUNES_BASE_URL}/features/karaoke`, changefreq: "monthly", priority: 0.7 },
    { loc: `${TUNES_BASE_URL}/features/silent-parties`, changefreq: "monthly", priority: 0.7 },
  ];

  try {
    // Query all users with guest URLs (these are public playlist pages)
    const venueUsers = await db
      .select({ guestUrl: users.guestUrl, updatedAt: users.updatedAt })
      .from(users)
      .where(isNotNull(users.guestUrl));

    for (const venue of venueUsers) {
      if (venue.guestUrl) {
        urls.push({
          loc: `${TUNES_BASE_URL}/playlist/${venue.guestUrl}`,
          lastmod: venue.updatedAt
            ? new Date(venue.updatedAt).toISOString().split("T")[0]
            : undefined,
          changefreq: "weekly",
          priority: 0.8,
        });
      }
    }
  } catch (error) {
    console.error("Error querying venues for sitemap:", error);
    // Continue with static pages only
  }

  const xml = buildSitemapXml(urls);
  setCachedSitemap("tunes", xml);
  return xml;
}

/**
 * Generate dynamic explorers.earth sitemap by querying Strapi for public users
 */
async function generateExplorersSitemap(): Promise<string> {
  const cached = getCachedSitemap("explorers");
  if (cached) return cached;

  const urls: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: number }> = [
    // Static pages
    { loc: `${EXPLORERS_BASE_URL}/`, changefreq: "weekly", priority: 1.0 },
    { loc: `${EXPLORERS_BASE_URL}/contact`, changefreq: "monthly", priority: 0.8 },
    { loc: `${EXPLORERS_BASE_URL}/privacy`, changefreq: "monthly", priority: 0.7 },
    { loc: `${EXPLORERS_BASE_URL}/terms`, changefreq: "monthly", priority: 0.7 },
    { loc: `${EXPLORERS_BASE_URL}/cookies`, changefreq: "monthly", priority: 0.6 },
    { loc: `${EXPLORERS_BASE_URL}/login`, changefreq: "monthly", priority: 0.5 },
    { loc: `${EXPLORERS_BASE_URL}/register`, changefreq: "monthly", priority: 0.5 },
  ];

  const strapiUrl = process.env.STRAPI_URL;
  const strapiToken = process.env.STRAPI_ACCESS_TOKEN;

  if (strapiUrl && strapiToken) {
    try {
      const response = await fetch(`${strapiUrl}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${strapiToken}`,
        },
        body: JSON.stringify({
          query: `query PublicAccountsForSitemap {
            accounts(filters: { public_profile: { eq: "Yes" } }, pagination: { limit: 1000 }) {
              username
              updatedAt
            }
          }`,
        }),
      });

      const result = await response.json();
      const accounts = result?.data?.accounts || [];

      for (const account of accounts) {
        if (account.username) {
          const lastmod = account.updatedAt
            ? new Date(account.updatedAt).toISOString().split("T")[0]
            : undefined;
          urls.push({
            loc: `${EXPLORERS_BASE_URL}/${account.username}`,
            lastmod,
            changefreq: "weekly",
            priority: 0.9,
          });
          urls.push({
            loc: `${EXPLORERS_BASE_URL}/${account.username}/places`,
            lastmod,
            changefreq: "weekly",
            priority: 0.8,
          });
        }
      }
    } catch (error) {
      console.error("Error querying Strapi for explorers sitemap:", error);
      // Continue with static pages only
    }
  } else {
    console.warn("Strapi not configured — explorers sitemap will only contain static pages");
  }

  const xml = buildSitemapXml(urls);
  setCachedSitemap("explorers", xml);
  return xml;
}

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

  // Dynamic tunes sitemap — queries DB for all venue guest URLs
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const xml = await generateTunesSitemap();
      return res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(xml);
    } catch (error) {
      console.error("Error generating tunes sitemap:", error);
      // Fallback: try DB-stored sitemap
      try {
        const settings = await storage.getSeoSettings();
        if (settings?.sitemapXml) {
          return res.type("application/xml").send(settings.sitemapXml);
        }
      } catch {}
      // Last resort: minimal sitemap
      const fallback = buildSitemapXml([{ loc: `${TUNES_BASE_URL}/`, priority: 1.0 }]);
      return res.status(500).type("application/xml").send(fallback);
    }
  });

  // Dynamic explorers.earth sitemap — queries Strapi for public user profiles
  // Served at /api/explorers-sitemap.xml, proxied by Nginx on explorers.earth
  app.get("/api/explorers-sitemap.xml", async (req, res) => {
    try {
      const xml = await generateExplorersSitemap();
      return res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(xml);
    } catch (error) {
      console.error("Error generating explorers sitemap:", error);
      // Fallback: static pages only
      const fallback = buildSitemapXml([
        { loc: `${EXPLORERS_BASE_URL}/`, priority: 1.0 },
      ]);
      return res.status(500).type("application/xml").send(fallback);
    }
  });
}
