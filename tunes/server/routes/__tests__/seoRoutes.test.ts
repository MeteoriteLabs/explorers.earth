import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSitemapXml, EXPLORERS_STATIC_SITEMAP_URLS, setupSeoRoutes } from "../../seo-routes";

describe("explorers sitemap static pages", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("includes the About and Use Cases marketing routes", () => {
    const xml = buildSitemapXml(EXPLORERS_STATIC_SITEMAP_URLS);

    expect(xml).toContain("<loc>https://explorers.earth/about</loc>");
    expect(xml).toContain("<loc>https://explorers.earth/use-cases</loc>");
  });

  it("serves the marketing routes from the public sitemap endpoint", async () => {
    vi.stubEnv("STRAPI_URL", "");
    vi.stubEnv("STRAPI_ACCESS_TOKEN", "");
    const app = express();
    setupSeoRoutes(app);

    const response = await request(app).get("/api/explorers-sitemap.xml");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/xml/);
    expect(response.text).toContain("<loc>https://explorers.earth/about</loc>");
    expect(response.text).toContain("<loc>https://explorers.earth/use-cases</loc>");
  });
});
