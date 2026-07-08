---
Feature: products
Doc type: prd
Status: draft
Created: 2026-07-02
Last updated: 2026-07-02
Updated by: agent
Depends on: products_decisions.md, UI_UX_Implementation.md
---

# Products — Product Requirements Document

## Goal

Enable creators, influencers, and brands on explorers.earth to curate, organize, and share physical product recommendations (e.g., desk setups, camera equipment, travel essentials, skincare routines) with their audience, expanding the platform's recommendation capabilities to physical lifestyle curation.

**Problem:** Creators currently recommend physical places, movies, and books, but physical products and gear are key components of their professional tools and lifestyle identity. Audiences frequently ask "where did you buy that?", "what camera gear do you use?", or "what is your skincare routine?" Creators resort to Amazon Storefronts, LTK (LikeToKnow.it), or static Linktree profiles, which fragment their brand identity.

**For whom:** Tech reviewers, photographers, travel bloggers, beauty influencers, and lifestyle curators. Their audiences who want to buy trusted, curated items.

**Why now:** This completes the core category expansions (Places, Movies, Books, Games, Apps, Products), establishing a unified profile hub for a creator's complete lifestyle recommendation identity.

## UI/UX Implementation Standards
To ensure 90%+ implementation accuracy and dashboard consistency:
- **Blue Branding**: Use `var(--dash-accent)` for all primary dashboard actions.
- **Mobile Safety**: Add `pb-32` or `pb-40` to main containers to prevent content overlap with the fixed footer navigation.
- **Interactive**: Use the standard `Switch` component for visibility toggles.
- **Clickability**: Hero cards must be fully clickable.
- Refer to [UI_UX_Implementation.md](./UI_UX_Implementation.md) for detailed CSS and component rules.

## Scope

### In Scope
- New Strapi collections for product recommendations and product lists.
- Dashboard sidebar (desktop) and category cards (mobile) updated to include Products.
- Products home view showing all product lists with management controls.
- Product list view with table/list layout, reordering, pin toggles.
- Full-page add/edit product overlay with **Retail Link Scraping & Enrichment** (extracts product title, description, brand, price, currency, and product images from Amazon, Shopify, Etsy, or general sites via Open Graph/JSON-LD).
- Top Products pinning system (Max 15) with dedicated manager.
- Public products page with horizontal carousel rows (one per list).
- Product card component showing image, brand, title, price badge, rating badge, and affiliate link indicator.
- Product detail slide-up modal showing image gallery, specs list, creator note, and buy CTA.
- Custom Specifications System (dynamic JSON key-value pairs, e.g. "Color: Space Grey", "Weight: 1.2kg").
- Currency picker and price input (pre-filled by scraper, editable).
- List-level publish/draft toggle.
- Manage tab with sharing URL, QR code, list settings.
- i18n translation keys and responsive design.

### Out of Scope
- Direct checking of live inventory status or stock levels (v1).
- Cart, checkout, or native payment processing (v1 — redirects to merchant via buy link).
- Automatic price tracking charts over time (v2).
- Native affiliate cookie injection scripts (v1 relies on the creator pasting pre-baked affiliate/referral links).

## User Stories

### Creator Stories

**US-1: Category Navigation**
As a creator, I want to switch between Places, Movies, Books, Games, Apps, and Products on my dashboard.
- Desktop: persistent sidebar updated to show Products.
- Mobile: dashboard categories landing page updated to include Products card.

**US-2: Create Product List**
As a creator, I want to create a named product list (e.g., "My Vlog Setup", "Office Desk Gear") so I can organize my recommendations thematically.
- Fields: list name (required), description (optional), cover image (optional, auto-fallback to first product's image), slug (auto-generated, editable).

**US-3: Add Product**
As a creator, I want to paste a retail link and have product metadata auto-populate.
- Full-page overlay with URL input.
- Paste URL -> Scraping API fetches page metadata -> Pre-fills: Product Title, Description, Brand, Price, Currency, Image URL.
- Creator input: personal recommendation note (rich text), user rating (1-10 stars), custom specifications (dynamic table), and custom affiliate/buy link.

**US-4: Manage Products in List**
As a creator, I want to view, edit, delete, reorder, and pin products within a list.
- Table rows showing: product thumbnail, brand, title, price, user rating, pin toggle, Edit/Delete menu.
- Drag-and-drop handles for manual reordering.

**US-5: Publish List**
As a creator, I want to toggle lists between Published and Draft to control visitor visibility.
- standard Switch toggle inside list view and on list cards.

**US-6: Manage Top Products**
As a creator, I want to pin my favorite products as "Top Products" to feature them at the top of my public page.
- Customizable Top Products display name (e.g., "Must Haves").
- Drag-to-reorder pinned items (max 15).

**US-7: Share List**
As a creator, I want to get a shareable URL and QR code for any product list.
- URL format: `explorers.earth/[username]/products/[list-slug]`.

### Visitor Stories

**US-8: Browse Product Recommendations**
As a visitor, I want to see a creator's product recommendations organized in themed rows.
- Top Products section displayed first, followed by list rows and category filters.
- Product cards show: product thumbnail, brand, title, price, rating badge.

**US-9: View Product Details**
As a visitor, I want to tap a product card to see the creator's recommendation details.
- Slide-up modal: image gallery, brand, title, specs list (dynamic key-value table), creator's rating, creator's note, and a prominent buy button.

**US-10: Browse by List / Category**
As a visitor, I want to see all products in a specific list or browse products by category (e.g., "Gear") across all lists.
- Full grid pages at `/:username/products/:listSlug` and `/:username/products/category/:categorySlug`.

## Data Model Summary
See `products_schema.md` for field-level details.
- **ProductList collection** — list name, description, cover image, slug, visibility, account relation, product relations, display_order, top_products_heading.
- **RecommendedProduct collection** — product URL, title, brand, price, currency, buy_url (affiliate), logo_url (main image S3 URL), description, specifications (JSON), user_recommendation_note (Tiptap blocks), user_rating (1-10), is_pinned, pin_order, display_order, images (JSON array of S3 URLs), list relation, Product_Category relation.

## API Summary
See `products_api_contract.md` for GraphQL schema shapes.
- Queries: list products, product detail, top products, products by category.
- Mutations: CRUD for lists/products, pin toggle, reorder.
- Scraper: `scrapeProductMetadata(url: String!): ScrapedProductMetadata!` endpoint returning product name, description, brand, price, currency, and high-res images.

## Business Logic
- **Duplicate prevention:** Same Product URL or ASIN cannot be added twice to the same list.
- **Pin limit:** Max 15 pinned products.
- **Price/Currency fallback:** If scraper fails to extract price, price is set to null, currency defaults to USD, and creator enters manually.
- **S3 download:** Images downloaded from retail page and uploaded to S3 under `{username}/products/{listId}/{productSlug}/image`.
- **List ordering:** Creator-defined via drag-and-drop, stored as `display_order`.

## Acceptance Criteria
- [ ] Sidebar and mobile category dashboard updated to show Products.
- [ ] Creator can create, edit, delete ProductLists.
- [ ] Paste URL auto-populates product title, logo, brand, and price.
- [ ] Rich text editor (Tiptap) and 1-10 rating active for product notes.
- [ ] Custom specifications system saves and edits key-value pairs.
- [ ] Top Products pinning works with drag-to-reorder (max 15).
- [ ] Product images downloaded and served from S3.
- [ ] Public page loads at `/:username/products` showing Top Products hero, lists rows, and category section.
- [ ] Tapping a product card opens the slide-up modal with buy links and creator's note.
- [ ] Grid pages for list detail and category browse work correctly.
- [ ] Responsive UI and translation keys implemented.

## Open Questions
1. **Amazon Scraping** — Amazon often blocks basic scraping. How do we bypass? Recommendation: Backend scraper targets Open Graph headers. If blocked, backend immediately falls back to a search parsing structure, or notifies the user to fill the details manually if an access block is encountered.
2. **Multi-Currency** — How do we handle different currencies? Recommendation: Store raw price as a decimal and currency as a 3-letter ISO code (USD, EUR, GBP). Format at render time using `Intl.NumberFormat`.
