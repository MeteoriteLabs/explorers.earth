---
Feature: apps-and-tools
Doc type: decisions
Status: draft
Created: 2026-07-02
Last updated: 2026-07-02
Updated by: agent
Depends on: none
---

# Apps & Tools — Decisions Log

Key architectural decisions for the Apps & Tools feature, detailing alternatives, rationale, and impact.

---

## D1: Separate Collections for Apps vs Extending Shared recommendation models

**Decision:** Create distinct `RecommendedApp` and `AppList` collections.

**Context:** While we could create a polymorphic "UniversalRecommendation" collection, apps contain specialized metadata (platforms list, pricing tiers, website URL, screenshots) that have zero overlap with Places (coordinate, addresses), Movies (directors, TMDB IDs), or Books (authors, ISBNs). Extending existing schemas would result in an unmaintainable database configuration with hundreds of null columns.

**Alternatives:**
1. **Extend RecommendedPlace with JSON fields:** Avoids new collections, but degrades Strapi admin usability and graphql type safety.
2. **Polymorphic Recommendation Model:** Rebuilding the core model structure is out of scope and high risk.

**Rationale:** Clean segregation ensures developers can modify App fields without breaking Places/Movies.

---

## D2: Metadata Enrichment Source: URL Scraper vs Platform APIs

**Decision:** Deploy a backend URL metadata/Open Graph crawler rather than integrating multiple store APIs.

**Context:** The "Apps & Tools" category spans Mac apps, web-based SaaS tools, Chrome extensions, and mobile apps. No single API covers all these domains. Using Google Play, iOS App Store, Chrome Web Store, and Product Hunt APIs simultaneously would require complex, fragile multi-API search logic.

**Alternatives:**
1. **iOS + Android App Store APIs:** Only covers mobile apps; ignores desktop/SaaS tools (e.g., Notion, Linear, Figma) which are critical creator recommendations.
2. **Pure Manual Input:** Creator fills everything. Poor user experience.

**Rationale:** Paste URL -> Scrape Open Graph -> Auto-fill is extremely robust. It supports *any* website (including self-hosted tools and niche SaaS sites). If scraping fails, the creator can still manually write details.

---

## D3: Self-Hosting Assets (Logo & Screenshots) vs Hotlinking

**Decision:** Download scraped assets (logos/icons, images) and host them on our S3 bucket.

**Context:** If we hotlink to target sites (e.g. `<img src="https://notion.so/logo.png" />`), we suffer from:
1. Mixed content/security issues.
2. CORS blocks.
3. Broken links if the app developer updates their site path.

**Rationale:** Serves images reliably from our own S3 CDN, ensuring visual consistency and performance.

---

## D4: Storing Platforms as JSON/Enum array vs Database Relations

**Decision:** Store `platforms` as a JSON array of strings in the `RecommendedApp` entity.

**Context:** Apps support macOS, Windows, Linux, iOS, Android, Web, and Extensions. If we model this via a separate `Platform` collection and many-to-many joins, it increases query complexity for a static, predictable set of values.

**Rationale:** Keeping platform tags as a simple string list (`["macOS", "Web"]`) is computationally fast, easy to filter in GraphQL, and simple to render as icons.
