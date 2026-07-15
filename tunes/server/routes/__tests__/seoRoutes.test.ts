import { describe, expect, it } from "vitest";
import { buildSitemapXml, EXPLORERS_STATIC_SITEMAP_URLS } from "../../seo-routes";

describe("explorers sitemap static pages", () => {
  it("includes the About and Use Cases marketing routes", () => {
    const xml = buildSitemapXml(EXPLORERS_STATIC_SITEMAP_URLS);

    expect(xml).toContain("<loc>https://explorers.earth/about</loc>");
    expect(xml).toContain("<loc>https://explorers.earth/use-cases</loc>");
  });
});
