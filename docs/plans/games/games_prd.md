---
Feature: games
Doc type: prd
Status: draft
Created: 2026-03-26
Last updated: 2026-03-26
Updated by: agent
Depends on: games_decisions.md, UI_UX_Implementation.md
---

# Games — Product Requirements Document

## Goal

Enable creators, influencers, and gaming communities on explorers.earth to curate and share game recommendations with their audience, expanding the platform's recommendation ecosystem into interactive media.

**Problem:** Creators currently recommend places, movies, and books — but games are a defining part of many creators' identities. Their audience frequently asks "what are you playing?" and "what games should I try?" Creators have no native way to share game recommendations within their explorers.earth profile. They resort to scattered Steam wishlists, Twitter threads, or Instagram stories, fragmenting their gaming identity.

**For whom:** Gamers, streamers, content creators, esports commentators, and gaming journalists who want to build a comprehensive taste profile. Their audiences who want trusted, personal game recommendations — not algorithmic Steam suggestions.

**Why now:** Movies & Shows and Books have established the architectural pattern (separate collection, carousel public page, external API for search). Games is the third category expansion, further validating the pattern before Music and Products follow. IGDB (powered by Twitch) is the richest freely available game database API.

## UI/UX Implementation Standards
To ensure 90%+ implementation accuracy and dashboard consistency:
- **Blue Branding**: Use `var(--dash-accent)` for all primary dashboard actions (blue theme).
- **Mobile Safety**: Add `pb-32` or `pb-40` to main containers to prevent content overlap with the fixed footer navigation.
- **Interactive**: Use the standard `Switch` component for visibility toggles.
- **Clickability**: Hero cards must be fully clickable.
- Refer to [UI_UX_Implementation.md](./UI_UX_Implementation.md) for detailed CSS and component rules.

## Scope

### In Scope
- New Strapi collections for game recommendations and game lists
- Dashboard sidebar (desktop) and category cards (mobile) updated to include Games
- Games home view showing all game lists with management controls
- Game list view with table/list layout, reordering, pin toggles
- Full-page add/edit game overlay with IGDB search integration
- Top Picks pinning system with dedicated manager
- Public games page with horizontal carousel rows (one per list)
- Game cover card component with rating badge overlay
- Game detail slide-up modal
- Public list grid page (full cover grid for a specific list)
- Public genre page (cover grid for a genre across all lists)
- Genre browse section with game art image cards
- List-level publish/draft toggle
- Manage tab with sharing URL, QR code, list settings
- Platform display (PC, PlayStation, Xbox, Nintendo Switch, etc.)
- i18n translation keys
- Responsive design (mobile + desktop)

### Out of Scope
- Visitor save/wishlist functionality (v2)
- Cross-category Top Picks on profile hub page (v2)
- URL-based individual game sharing with SEO (v2 — modal only in v1)
- Game ownership / played status tracking (v2)
- Playtime tracking or achievements
- Price / purchase link auto-population (no free API for this)
- Steam inventory import/sync
- Changes to existing Places, Movies & Shows, or Books features
- Backend/Strapi plugin development (user creates collections manually)
- Analytics tracking for game page views

## User Stories

### Creator Stories

**US-1: Category Navigation**
As a creator, I want to switch between Places, Movies & Shows, Books, and Games on my dashboard, so I can manage all my recommendation categories.
- Desktop: persistent sidebar now shows Places, Movies & Shows, Books, Games
- Mobile: category cards grid updated to show all four categories

**US-2: Create Game List**
As a creator, I want to create a named game list (e.g., "All-Time Favorites", "Indie Gems", "Perfect for Beginners") so I can organize my recommendations thematically.
- Fields: list name (required), description (optional), cover image (optional, auto from first game), slug (auto-generated, editable)
- List creation takes under 10 seconds

**US-3: Add Game**
As a creator, I want to search for a game and add it to my list with my personal note.
- Full-page overlay with IGDB search
- Search results show: cover art, title, release year, platforms, genres, IGDB rating
- After selection: auto-filled details, personal note (rich text), user rating (1-10 stars), optional media upload, and pin to Top Picks

**US-4: Manage Games in List**
As a creator, I want to view, edit, delete, reorder, and pin games within a list.
- Table/list rows with: cover art, title, release year, platforms, genres, IGDB rating, user rating, note preview
- Pin toggle (⭐) per row
- ⋮ menu: Edit, Delete, Move to another list
- Drag handles for reorder
- Sort presets: Custom, Rating, Year, Recently added

**US-5: Publish List**
As a creator, I want to toggle a list between published and draft, so I can control what's visible on my public page.
- Toggle on list card (Games home) and inside list view
- Published = visible on public page. Draft = hidden.

**US-6: Manage Top Picks**
As a creator, I want to pin my favorite games as "Top Picks" and control how they appear on my public page.
- Customizable display name (e.g., "Games You Must Play", "All-Time Favorites")
- Drag-to-reorder pinned items
- Max 15 pins
- Counter showing usage

**US-7: Share List**
As a creator, I want to get a shareable URL and QR code for any game list.
- Manage tab shows URL, QR code, copy button
- URL format: `explorers.earth/[username]/games/[list-slug]`

### Visitor Stories

**US-8: Browse Game Recommendations**
As a visitor, I want to see a creator's game recommendations organized in themed rows that I can scroll through.
- Horizontal carousel rows (one per list)
- Top Picks row first (if exists), then published lists, then genre browse
- Game cover cards with rating badge overlay + title below

**US-9: View Game Details**
As a visitor, I want to tap a game cover to see the creator's recommendation details.
- Slide-up modal: cover art, metadata (title, platforms, developer, publisher, release year, genres, IGDB rating), creator's note, creator's rating, creator's photos, source list
- Share button
- Swipe-down to dismiss

**US-10: Browse by List**
As a visitor, I want to tap a list heading to see all games in that list as a grid.
- Full cover grid page at `/:username/games/:listSlug`
- List name, description, game count
- Back navigation to main games page

**US-11: Browse by Genre**
As a visitor, I want to browse games by genre across all the creator's lists.
- Genre cards at bottom of games page with game art backgrounds
- Tap opens genre page at `/:username/games/genre/:genreSlug`
- Cover grid of all games in that genre across all lists

## Data Model Summary

See `games_schema.md` for complete field-level detail.

- **GameList collection** — list name, description, cover image, slug, visibility, account relation, game relations, display order, top picks heading
- **RecommendedGame collection** — IGDB metadata (igdb_id, slug, title, cover_image_id, cover_url, genres JSON, platforms JSON, developer, publisher, release_date, igdb_rating, igdb_rating_count, summary, storyline, game_modes JSON, screenshots JSON), creator's note (Tiptap blocks), user_rating (1-10 integer), is_pinned, pin_order, display_order, media snapshots, list relation, Game_Category relation

## API Summary

See `games_api_contract.md` for complete request/response shapes.

- GraphQL queries: game lists by user, games by list (paginated), pinned games, games by genre, single game details
- GraphQL mutations: CRUD for lists and games, pin toggle, pin reorder, list reorder
- IGDB API: search games, game details, cover images, genres, platforms

## Business Logic

- **Duplicate prevention:** When adding a game, check if the same IGDB `igdb_id` already exists in the target list. Allow the same game in different lists.
- **Pin limit:** Max 15 pinned games. UI shows counter and disables pin toggle when limit reached.
- **Slug generation:** Auto-generate from list name (lowercase, hyphens, remove special chars). Must be unique per user. Append number if duplicate.
- **Cover image fallback:** If no cover image uploaded for the list, use the first game's cover as the list cover.
- **Genre extraction:** Genres come from IGDB metadata stored in each game. Genre browse section aggregates across all published lists. Only genres with at least 1 game are shown.
- **Platform display:** IGDB platform data stored as a JSON array of platform names. Displayed as compact chips in cards/modal.
- **Media upload:** Reuse existing media upload patterns (max 10 files, device upload). Stored in S3 with structured paths: `{username}/games/{gameListId}/{igdbId}/{filename}`.
- **IGDB cover images:** URLs constructed from IGDB `image_id` using the pattern `https://images.igdb.com/igdb/image/upload/t_{size}/{image_id}.jpg`. Sizes: `cover_big` for cards, `1080p` for detail modal.
- **IGDB rating:** Stored from IGDB `total_rating` at save time (0-100 scale, displayed as /10 or as a percentage). Not dynamically updated.
- **IGDB authentication:** IGDB requires a Twitch OAuth `client_credentials` token. This token must be obtained **server-side** (in a backend proxy or Strapi middleware) because the client secret cannot be exposed to the frontend. Calls to IGDB are proxied through Strapi.
- **List ordering on public page:** Creator-defined via drag-and-drop in Manage. Stored as `display_order` field on the list entity.

## Acceptance Criteria

### Creator Dashboard
- [ ] Desktop sidebar shows Places, Movies & Shows, Books, and Games categories
- [ ] Mobile shows category cards grid with all four categories
- [ ] Clicking Games opens the Games home view
- [ ] Creator can create a new game list with name, description, optional cover
- [ ] Creator can add a game via IGDB search with auto-filled metadata
- [ ] Personal note is rich text format (Tiptap)
- [ ] Creator can manually upload photos directly to S3
- [ ] User can provide a 1-10 star user rating (consistent with Movies & Shows and Books)
- [ ] Creator can pin games to Top Picks (max 15) via star toggle
- [ ] Creator can drag-to-reorder games within a list
- [ ] Creator can drag-to-reorder pinned items in Top Picks manager
- [ ] Creator can customize Top Picks display name
- [ ] Creator can toggle list between Published and Draft
- [ ] Manage tab shows shareable URL and QR code
- [ ] Creator can edit and delete games
- [ ] Creator can edit list name, description, cover, slug
- [ ] Creator can delete a list (with confirmation)
- [ ] Existing Places, Movies & Shows, and Books dashboards are fully functional and unchanged

### Public Page
- [ ] Public games page loads at `/:username/games`
- [ ] Header shows "[Creator]'s Games · [count] games"
- [ ] Top Picks carousel row appears first (if pinned items exist)
- [ ] Published lists appear as horizontal carousel rows in creator-defined order
- [ ] Cover cards show game cover art with rating badge overlay + title below
- [ ] Platform chips displayed below each card title
- [ ] Tapping a cover opens the detail modal
- [ ] Detail modal shows: cover art, metadata (title, platforms, developer, publisher, release year, genres), creator's note, creator's rating, photos, source list, share
- [ ] Detail modal swipe-down-to-dismiss works on mobile
- [ ] Tapping list heading opens full cover grid page
- [ ] Genre browse section shows at bottom
- [ ] Tapping genre card opens genre cover grid page
- [ ] Empty states render gracefully

### Cross-Cutting
- [ ] All new UI text has i18n translation keys
- [ ] Responsive across mobile (<768px) and desktop (≥768px)
- [ ] Loading skeletons shown during data fetch
- [ ] No regressions in existing Places, Movies & Shows, or Books features

## Open Questions

1. **IGDB proxy architecture** — Because IGDB requires a secret-bearing Twitch token, search calls cannot be made directly from the frontend. Options: (a) Strapi custom route acting as a proxy, (b) a lightweight serverless function (e.g., Vercel Edge). Decision needed before T1 (service module).
2. **IGDB rating scale** — IGDB returns `total_rating` on a 0-100 scale (not 0-10 like TMDB or 0-5 like Google Books). Should we display it as-is (e.g., "87"), divide by 10 (e.g., "8.7"), or display as a percentage? Recommendation: divide by 10 and display with one decimal for consistency with other categories.
3. **Game modes display** — IGDB provides game modes (Single-player, Multiplayer, Co-op, etc.). Should these be displayed as chips alongside genres in v1? Recommendation: yes, show alongside genres in detail modal.
4. **Screenshots storage** — IGDB provides screenshot image IDs. Should we fetch and store them in Strapi (as URL strings), or download and re-host in S3? Recommendation: store as IGDB URL strings (same as Books cover approach), not re-hosted.
5. **DLC / Editions filtering** — IGDB returns DLC, expansions, and remasters alongside base games in search results. Should we filter these out? Recommendation: include all by default, let creator choose, but add a `category` filter in the search query to show only main games by default (IGDB `category: [0]` = main game).
