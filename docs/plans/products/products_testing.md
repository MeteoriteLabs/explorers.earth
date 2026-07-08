---
Feature: products
Doc type: testing
Status: draft
Created: 2026-07-02
Last updated: 2026-07-02
Updated by: agent
Depends on: products_prd.md, products_api_contract.md
---

# Products — Testing Plan

Comprehensive test cases, manual verification checklists, and automated testing guidelines for the Products feature.

---

## 1. Automated Tests

### Link Scraper API Unit Tests (Backend)
Test that the `/api/products/scrape-link` endpoint properly extracts commerce metadata.
- **Test cases:**
  - Retail page with standard LD+JSON schema (e.g., Shopify store product) -> Verify brand, price, currency, title, and multiple images are parsed correctly.
  - Retail page with only Open Graph product tags -> Verify fallback parsing for price and currency.
  - Amazon page (which might block standard node-fetch) -> Verify scraper handles request limitations, mock user agents, or falls back gracefully without crashing.
  - Invalid URL or missing parameter -> Verify API returns `400 Bad Request`.

### Graphql Mutations & Queries (Integration)
Verify Apollo request/response operations against mock resolvers.
- **Test cases:**
  - Create product list -> Verify default fields (visibility = false, display_order = 0).
  - Add product -> Verify currency is stored as valid 3-letter ISO code and price is stored as decimal.
  - Pinned product -> Verify pin_order incrementing logic.

### End-to-End Tests (Cypress / Playwright)
Automated flow tests in a headful browser.
- **Creator Dashboard Flow:**
  - Login -> Navigate to Products -> Create list named "Desk Setup" -> Open list -> Paste product URL -> Verify form pre-fills title, brand, and price -> Click "+ Add Spec" and enter "Color" and "White" -> Save -> Verify product appears in list table.
  - Reorder products: Drag first row below second -> Verify database mutation executes.
- **Public Profile Page Flow:**
  - Open `/:username/products` -> Click Product Card -> Detail modal slides up -> Verify specs table contains "Color: White" -> Verify "Buy Now" button contains correct affiliate query parameter.

---

## 2. Manual Verification Checklist

### Creator Dashboard
- [ ] Sidebar and mobile category landing menus show the "Products" links.
- [ ] Empty state renders if no list exists.
- [ ] "Create List" modal creates a valid list and auto-redirects to detail page.
- [ ] Pasting a product link auto-fills Name, Brand, Price, Currency, and Description inside 3 seconds.
- [ ] Creator can add, delete, and edit rows inside the dynamic specifications table.
- [ ] Image uploads successfully load files into S3 with correct path structure.
- [ ] Visibility Switch toggles list state between Published and Draft immediately.
- [ ] Deleting a product shows a confirmation dialog and updates list count.

### Public Profile Page
- [ ] Pinned Top Products appear in the hero slider on desktop, and card stack on mobile.
- [ ] Product card displays product brand, name, formatted price (e.g., "$79.99"), and rating badge.
- [ ] Clicking the card slides up the detail modal without page jump.
- [ ] Detail modal displays specs table and scrollable gallery.
- [ ] Buy Now CTA button redirects to target site (with affiliate parameters).
- [ ] Verify translation keys work across all languages when switching locale.
