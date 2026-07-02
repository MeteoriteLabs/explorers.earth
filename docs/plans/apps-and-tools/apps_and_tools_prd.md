---
Feature: apps-and-tools
Doc type: prd
Status: draft
Created: 2026-07-02
Last updated: 2026-07-02
Updated by: agent
Depends on: apps_and_tools_decisions.md, UI_UX_Implementation.md
---

# Apps & Tools — Product Requirements Document

## Goal

Enable creators, developers, designers, and productivity curators on explorers.earth to recommend and organize their favorite software, applications, extensions, and digital utilities for their audience, expanding the platform's recommendation capabilities to digital-native curation.

**Problem:** Creators currently recommend physical places, movies, and books, but software and digital tools are central to modern professional and creative workflows (e.g., "What tools do you use to edit?", "What coding environment do you use?"). Creators have no native way to share tool stacks or app recommendations, resulting in fragmented text links, Linktree folders, or static blogs.

**For whom:** Software developers, designers, writers, creators, productivity influencers, and professionals. Their audiences who want to copy their workflows or find top tools for specific niches.

**Why now:** Following the patterns of Movies, Books, and Games, this expands the curation ecosystem into digital productivity and utilities, validating the URL scraping metadata enrichment model.

## UI/UX Implementation Standards
To ensure 90%+ implementation accuracy and dashboard consistency:
- **Blue Branding**: Use `var(--dash-accent)` for all primary dashboard actions.
- **Mobile Safety**: Add `pb-32` or `pb-40` to main containers to prevent content overlap with the fixed footer navigation.
- **Interactive**: Use the standard `Switch` component for visibility toggles.
- **Clickability**: Hero cards must be fully clickable.
- Refer to [UI_UX_Implementation.md](./UI_UX_Implementation.md) for detailed CSS and component rules.

## Scope

### In Scope
- New Strapi collections for app recommendations and app lists.
- Dashboard sidebar (desktop) and category cards (mobile) updated to include Apps & Tools.
- Apps home view showing all app lists with management controls.
- App list view with table/list layout, reordering, pin toggles.
- Full-page add/edit app overlay with **URL Scraping / Enrichment Integration** (scraping metadata like title, description, favicon, apple-touch-icon, and Open Graph image).
- Top Apps pinning system (Max 15) with dedicated manager.
- Public apps page with horizontal carousel rows (one per list) showing rounded-square app icons.
- App card component with platform badges and rating overlay.
- App detail slide-up modal showing logo, description, platforms, price tier, and download links.
- Public list grid page (full grid for a specific list).
- Public category page (grid for a category/genre across all lists).
- List-level publish/draft toggle.
- Manage tab with sharing URL, QR code, list settings.
- Platform support tags (Web, macOS, Windows, Linux, iOS, Android, Chrome Extension, Safari Extension, etc.).
- Price Tier indicator (Free, Freemium, Paid, Subscription).
- Custom download/buy links (supporting affiliate parameters).
- i18n translation keys and responsive design.

### Out of Scope
- Direct integration with Chrome Web Store / App Store APIs for live search (v1 — URL scraper is more versatile).
- Chrome extension for immediate saving from the browser (v2).
- Automatic broken link checking/monitoring (v2).
- Analytics tracking for referral link click rates (v2).
- Changes to existing categories (Places, Movies, Books, Games).

## User Stories

### Creator Stories

**US-1: Category Navigation**
As a creator, I want to switch between Places, Movies, Books, Games, and Apps on my dashboard so I can manage my digital recommendations.
- Desktop: persistent sidebar updated to show Apps & Tools.
- Mobile: dashboard categories landing page updated to include Apps & Tools card.

**US-2: Create App List**
As a creator, I want to create a named app/tool list (e.g., "My Editing Stack", "Figma Plugins I Love") so I can organize my tools thematically.
- Fields: list name (required), description (optional), cover image (optional, auto-fallback to first app's logo), slug (auto-generated, editable).

**US-3: Add App**
As a creator, I want to add an app by pasting its URL and having the system auto-populate its metadata.
- Full-page overlay with URL input.
- Paste URL -> Debounced metadata request to backend scraper -> Pre-fills: title, description/synopsis, logo URL (from favicon/apple-touch-icon/OG image).
- Creator input: personal recommendation note (rich text), user rating (1-10 stars), platforms (checkboxes), price tier (select dropdown), direct download/purchase link (with affiliate tag), and optional screenshots.

**US-4: Manage Apps in List**
As a creator, I want to view, edit, delete, reorder, and pin apps within a list.
- Table rows showing: app icon, title, platforms, price tier, user rating, pin toggle, Edit/Delete menu.
- Drag-and-drop handles for manual reordering.

**US-5: Publish List**
As a creator, I want to toggle lists between Published and Draft to control visitor visibility.
- standard Switch toggle inside list view and on list cards.

**US-6: Manage Top Apps**
As a creator, I want to pin my favorite apps as "Top Apps" to feature them at the top of my public page.
- Customizable Top Apps display name (e.g., "Daily Drivers").
- Drag-to-reorder pinned items (max 15).

**US-7: Share List**
As a creator, I want to get a shareable URL and QR code for any app list.
- URL format: `explorers.earth/[username]/apps/[list-slug]`.

### Visitor Stories

**US-8: Browse App Recommendations**
As a visitor, I want to see a creator's app recommendations organized in themed rows.
- Top Apps section displayed first, followed by list rows and category filters.
- App cards show: rounded logo, title, platforms (icons), price tier, rating badge.

**US-9: View App Details**
As a visitor, I want to tap an app card to see the creator's recommendation details.
- Slide-up modal: rounded logo, metadata (developer, platforms, price tier, direct download link), creator's rating, creator's note, screenshots, and link to the source list.

**US-10: Browse by List / Category**
As a visitor, I want to see all apps in a specific list or browse apps by category (e.g., "Productivity") across all lists.
- Full poster-style grid pages at `/:username/apps/:listSlug` and `/:username/apps/category/:categorySlug`.

## Data Model Summary
See `apps_and_tools_schema.md` for field-level details.
- **AppList collection** — list name, description, cover image, slug, visibility, account relation, app relations, display_order, top_apps_heading.
- **RecommendedApp collection** — app URL, title, logo_url (S3 URL), description/synopsis, developer, platforms (JSON array), price_tier, download_url (with affiliate parameters), user_recommendation_note (Tiptap blocks), user_rating (1-10), is_pinned, pin_order, display_order, screenshot_urls (JSON array of S3 URLs), list relation, App_Category relation.

## API Summary
See `apps_and_tools_api_contract.md` for GraphQL schema shapes.
- Queries: list apps, app detail, top apps, apps by category.
- Mutations: CRUD for lists/apps, pin toggle, reorder.
- Scraper: `scrapeUrlMetadata(url: String!): ScrapedAppMetadata!` endpoint returning page title, description, and high-res logos/icons.

## Business Logic
- **Duplicate prevention:** Same App URL or domain cannot be added twice to the same list.
- **Pin limit:** Max 15 pinned apps.
- **Scraper fallback:** If the URL scraping fails or is blocked, the user is presented with a blank form to enter details manually.
- **Favicon extraction:** Scraper prioritizes `apple-touch-icon`, then high-res OG image, then standard favicon, downloading it to S3 under `{username}/apps/{listId}/{appSlug}/logo`.
- **List ordering:** Creator-defined via drag-and-drop, stored as `display_order`.

## Acceptance Criteria
- [ ] Sidebar and mobile category dashboard updated to show Apps & Tools.
- [ ] Creator can create, edit, delete AppLists.
- [ ] Paste URL auto-populates app title, logo, and description.
- [ ] Rich text editor (Tiptap) and 1-10 rating active for app notes.
- [ ] Platform tags and price tier dropdown correctly saved.
- [ ] Top Apps pinning works with drag-to-reorder (max 15).
- [ ] App logo and screenshots downloaded and served from S3.
- [ ] Public page loads at `/:username/apps` showing Top Apps hero, lists rows, and category section.
- [ ] Tapping an app card opens the slide-up modal with download links and creator's note.
- [ ] Grid pages for list detail and category browse work correctly.
- [ ] Responsive UI and translation keys implemented.

## Open Questions
1. **Scraping blockages** — What if a site blocks our scraper (e.g., Cloudflare)? Recommendation: Scraper runs via a basic proxy or falls back to server-side user-agent spoofing. If it still fails, notify the user and prompt them to enter details manually.
2. **Platform Icons** — How do we render platform tags? Recommendation: Map standard strings ("macOS", "Windows", "Web", "iOS") to Lucide-React icons or custom SVG badges in the frontend.
