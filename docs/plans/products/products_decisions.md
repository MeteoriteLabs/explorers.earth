---
Feature: products
Doc type: decisions
Status: draft
Created: 2026-07-02
Last updated: 2026-07-02
Updated by: agent
Depends on: none
---

# Products — Decisions Log

Key architectural decisions for the Products feature, detailing alternatives, rationale, and impact.

---

## D1: Separate Collections for Products vs Unified Recommendation model

**Decision:** Create distinct `RecommendedProduct` and `ProductList` collections in Strapi.

**Context:** Physical products possess data models distinct from Places, Movies, and Books (such as Brand, Price, Currency, Affiliate link, and arbitrary specifications JSON). Conflating these entities into a single table would cause layout degradation and database schema bloat.

**Alternatives:**
1. **Reuse Books/Apps schema:** Overlaps are minimal; would create confusion.
2. **Single generic "Item" table:** Requires major refactoring of the platform core.

**Rationale:** Independent collections keep queries separate, clean, and highly performant.

---

## D2: Metadata Source: Retail Scraping vs Amazon/Shopify/Etsy APIs

**Decision:** Use a backend link metadata parser (scraping Open Graph tags + JSON-LD) rather than specific retailer APIs.

**Context:** Creators link items from Amazon, Shopify stores, Nike, Etsy, IKEA, etc. Registering developer accounts and implementing API adapters for every commerce platform is impractical. Amazon in particular restricts its Product Advertising API to high-performing active associates.

**Alternatives:**
1. **Integrate Amazon API only:** Fails to support independent shops, Etsy, or direct brand links.
2. **Strict manual data entry:** Poor UX; creators must manually save cover images and type specs.

**Rationale:** An Open Graph + JSON-LD HTML scraper is site-agnostic. Most product pages expose structured schemas (`ld+json`) describing name, brand, price, currency, and images. Using this scraper offers 90%+ cover coverage, falling back to manual entry on scrape errors.

---

## D3: Specifications Modeling: JSON Field vs Relational Attributes

**Decision:** Store technical specifications as a single flat JSON object (`{"Color": "Space Grey", "Weight": "1.2kg"}`).

**Context:** Products vary widely. A keyboard has specs like "Switch Type" and "Layout", while a camera lens has "Focal Length" and "Aperture". Hardcoding these as database columns or setting up a relational Attribute-Value schema would complicate Strapi forms and graphql layers.

**Rationale:** A JSON object allows the creator to add custom row specs in a simple key-value table. The frontend renders it dynamically, offering ultimate flexibility.

---

## D4: Price & Currency Storage

**Decision:** Store raw price as a decimal field and currency as a 3-character ISO string (`USD`, `EUR`, `GBP`).

**Context:** Creators and visitors come from different regions. Hardcoding currency symbols (e.g. "$") or storing prices as strings prevents formatting localization.

**Rationale:** Storing decimal and ISO currency codes enables the frontend to format prices beautifully using `Intl.NumberFormat` according to the visitor's local system language.
