---
Feature: person
Doc type: prd
Status: draft
Created: 2026-07-05
Last updated: 2026-07-05
Updated by: agent
Depends on: person_decisions.md, UI_UX_Implementation.md
---

# Person — Product Requirements Document

## Goal

Enable creators, curators, and builders on explorers.earth to curate, organize, and share lists of people (e.g., favorite designers, industry mentors, inspiring founders, local artists, tech content creators) with their audience, expanding the platform's utility from places and media into human/network curation.

**Problem:** Creators and professionals are frequently asked "who do you follow?", "who inspires you?", or "who are the best local artists/designers?" Currently, they have no clean way to recommend people. They share listicles in Instagram stories, paste separate LinkedIn links, or build text-heavy lists on Notion. These formats are either temporary or lack a premium profile aesthetic.

**For whom:** Content creators, designers, developers, business strategists, startup founders, and local community curators who want to highlight their professional or creative network. Visitors who want trusted, hand-picked profile recommendations instead of algorithmic discovery.

**Why now:** Following the expansion into Books, Movies, and Products, the Person category provides the final major dimension of curation: the human element. It allows creators to build a complete taste-profile hub covering places, content, products, and the people behind them.

## UI/UX Implementation Standards
To ensure 90%+ implementation accuracy and dashboard consistency:
- **Blue Branding**: Use `var(--dash-accent)` for all primary dashboard actions (blue theme).
- **Mobile Safety**: Add `pb-32` or `pb-40` to main containers to prevent content overlap with the fixed footer navigation.
- **Interactive**: Use the standard `Switch` component for visibility toggles.
- **Clickability**: Person recommendation cards must be fully clickable to open details.
- Refer to [UI_UX_Implementation.md](./UI_UX_Implementation.md) for detailed CSS and component rules.

## Scope

### In Scope
- New Strapi collections for person recommendations (`RecommendedPerson`), lists (`PersonList`), and categories (`People_Category`).
- Dashboard sidebar (desktop) and category navigation (mobile) updated to include "People".
- People home view showing all person lists with management controls.
- Person list view with table/list layout, reordering, and pinning toggles.
- Full-page add/edit person overlay with **Social Profile Scraping & Enrichment** (pasting an Instagram or LinkedIn URL automatically fetches name, username, bio/headline, and avatar where possible via Open Graph or JSON-LD metadata, with a manual entry fallback).
- Endorsement/Rating system: A customizable rating metric or badge (e.g., "Highly Recommended", "Must Follow").
- Multi-platform support: Native logos/badges for Instagram, LinkedIn, X, GitHub, YouTube, and Personal Websites.
- Dynamic key-value "Highlights" or "Skills" tags (e.g., "Skills: React, Figma, UI/UX").
- Top Picks pinning system (Max 15) with a drag-and-drop manager.
- Public people landing page showing pinned people as a hero section, and lists of recommended people as scrollable rows.
- Person card component displaying avatar, name, headline, platform badge, and quick social links.
- Person detail slide-up modal showing bio, creator's endorsement note, tags, full social links, and portfolio screenshots.
- List-level publish/draft toggle.
- Manage tab with sharing URL, QR code, and list settings.
- i18n translation keys and responsive layout.

### Out of Scope
- Dynamic extraction of recent posts, tweets, or feed activity (v1).
- Native private messaging or chat integration (v1 directs users to the recommended person's external social profiles).
- Contact CRM or relationship tracking features (v1 is strictly for public recommendations).

## User Stories

### Creator Stories

**US-1: Category Navigation**
As a creator, I want to switch to the People category on my dashboard, so I can manage my curated lists of people.
- Desktop: persistent sidebar updated to show "People".
- Mobile: category grid updated to include a card for "People".

**US-2: Create Person List**
As a creator, I want to create a named person list (e.g., "Top Product Designers", "Inspiring Founders") to organize my recommendations.
- Fields: list name (required), description (optional), cover image (optional, auto-fallback to first person's avatar), slug (auto-generated, editable).

**US-3: Add Person**
As a creator, I want to add a person by pasting their Instagram or LinkedIn profile URL, with automatic metadata fetching.
- Full-page overlay with URL input.
- Paste URL -> Scraping API attempts metadata fetch -> Pre-fills: Name, Username/Handle, Headline/Bio, Platform type, and Avatar URL.
- If scraping is blocked (common on Instagram/LinkedIn), display a helpful notice and open the form fields for manual entry.
- Creator fields: personal endorsement/recommendation note (rich text), sector/domain (e.g., "Design"), skills/tags array (e.g., "Figma", "Webflow"), specific platform URLs, and a rating metric.
- Media upload: Option to upload portfolio images or screenshots of their work.
- Submit: Profile avatar is downloaded and uploaded to S3 to guarantee self-hosting.

**US-4: Manage People in List**
As a creator, I want to view, edit, delete, reorder, and pin people within a list.
- Table rows showing: avatar, name, headline, main platform, pin toggle, Edit/Delete menu.
- Drag-and-drop handles for manual reordering.

**US-5: Publish List**
As a creator, I want to toggle a list between Published and Draft to control its public visibility.
- standard Switch toggle on the list card and inside the list view.

**US-6: Manage Top Picks**
As a creator, I want to pin my favorite people to "Top Picks" to feature them prominently on my public page.
- Customizable Top Picks display name (e.g., "Core Mentors").
- Drag-to-reorder pinned items (max 15).

**US-7: Share List**
As a creator, I want to get a shareable URL and QR code for any person list.
- URL format: `explorers.earth/[username]/people/[list-slug]`.

### Visitor Stories

**US-8: Browse People Recommendations**
As a visitor, I want to see a creator's recommended people organized in themed rows.
- Top Picks section displayed first (card stack carousel or grid).
- Lists displayed as horizontal scrollable avatar/profile cards.
- Quick action button on each card to visit their primary social profile.

**US-9: View Person Details**
As a visitor, I want to tap a person card to view their full details and the creator's note.
- Slide-up modal: avatar, name, headline, location, sector, custom tags, creator's endorsement note (rich text), portfolio screenshot carousel, and clickable icon badges for all their social profiles (Instagram, LinkedIn, X, etc.).

**US-10: Browse by List / Sector**
As a visitor, I want to browse all people in a specific list, or browse by sector (e.g. "Tech") across all lists.
- Full grid pages at `/:username/people/:listSlug` and `/:username/people/sector/:sectorSlug`.

## Data Model Summary
See `person_schema.md` for field-level details.
- **PersonList collection** — list name, description, cover image, slug, visibility, account relation, recommended_people relations, display_order, top_picks_heading.
- **RecommendedPerson collection** — profile URL, name, username_handle, headline, location, primary_platform (enum), avatar_path (S3 URL), social_urls (JSON), skills_tags (JSON), user_recommendation_note (rich text), user_rating (1-10), is_pinned, pin_order, display_order, portfolio_media (JSON array of S3 URLs), list relation, People_Category relation.

## API Summary
See `person_api_contract.md` for GraphQL schema shapes.
- Queries: list people, person details, top pinned people, people by category/sector.
- Mutations: CRUD for lists/people, pin toggle, reorder.
- Scraper: `scrapeProfileMetadata(url: String!): ScrapedProfileMetadata!` endpoint returning name, handle, biography, primary platform, and avatar URL.

## Business Logic
- **Duplicate prevention:** Same primary profile URL cannot be added twice to the same list.
- **Pin limit:** Max 15 pinned people per user profile.
- **S3 download:** Scraper downloads the profile picture at create time and saves it on S3 under `{username}/people/{listId}/{personSlug}/avatar` to avoid broken hotlink images.
- **Fallback logic:** Since Instagram and LinkedIn heavily restrict bot traffic, if scraping fails, pre-fill is skipped, showing a toast: "Could not fetch profile details automatically. Please enter manually."

## Acceptance Criteria
- [ ] Sidebar and mobile category landing updated to include People.
- [ ] Creator can create, edit, delete PersonLists.
- [ ] Paste Instagram or LinkedIn URL auto-populates metadata if accessible, or falls back gracefully to manual entry.
- [ ] Rich text editor (Tiptap) active for recommendation notes.
- [ ] Skills/Tags system saves and displays tags correctly.
- [ ] Top Picks pinning works with drag-to-reorder (max 15).
- [ ] Avatars and portfolio screenshots downloaded and served from S3.
- [ ] Public page loads at `/:username/people` showing Top Picks, scrollable list rows, and sector filters.
- [ ] Tapping a person card opens the slide-up modal with clickable social icon badges and creator's note.
- [ ] Grid pages for list detail and sector browse work correctly.
- [ ] Responsive UI and translation keys implemented.

## Open Questions
1. **Instagram/LinkedIn Scraping Rate Limits** — Since direct scraping is heavily rate-limited, should we suggest using a paid proxy service or a dedicated third-party scraping API? Recommendation: In v1, use a simple header/scraper wrapper on the backend, and rely heavily on the manual fallback flow which offers a smooth, fast manual input form.
2. **Social URLs validation** — Should we restrict URLs to only known platforms? Recommendation: Validate URLs for standard patterns (Instagram, LinkedIn, X, GitHub, YouTube, Medium, TikTok, personal websites) and map them to their corresponding platform icon, placing all others under a generic "Website" icon.
