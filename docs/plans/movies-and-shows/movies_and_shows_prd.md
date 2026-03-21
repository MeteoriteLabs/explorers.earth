---
Feature: movies-and-shows
Doc type: prd
Status: draft
Created: 2026-03-20
Last updated: 2026-03-20
Updated by: agent
Depends on: movies_and_shows_decisions.md
---

# Movies & Shows — Product Requirements Document

## Goal

Enable creators, influencers, and businesses on explorers.earth to curate and share movie and TV show recommendations with their audience, expanding the platform beyond place-based recommendations into lifestyle curation.

**Problem:** Creators currently can only recommend physical places. Their audience frequently asks "what are you watching?" and creators have no native way to share movie/show recommendations within their explorers.earth profile. Creators resort to scattered Instagram stories or third-party apps, fragmenting their recommendation identity.

**For whom:** Creators and influencers who want to build a comprehensive taste profile. Their audiences who want trusted, personal recommendations (not algorithmic suggestions).

**Why now:** This is the first category expansion beyond Places, establishing the architectural pattern for Books, Music, Products, and other categories to follow. Movies & Shows is a strong first expansion — universally relevant, rich visual content (posters), and a free, excellent API (TMDB).

## Scope

### In Scope
- New Strapi collections for movie recommendations and movie lists
- Dashboard sidebar (desktop) and category cards (mobile) for category navigation
- Movies home view showing all movie lists with management controls
- Movie list view with table/list layout, reordering, pin toggles
- Full-page add/edit movie overlay with TMDB search integration
- Top Picks pinning system with dedicated manager
- Public movies page with Netflix/IMDb-style horizontal carousel rows
- Movie poster card component with rating badge overlay
- Movie detail slide-up modal
- Public list grid page (full poster grid for a specific list)
- Public genre page (poster grid for a genre across all lists)
- Genre browse section with backdrop image cards
- List-level publish/draft toggle
- Manage tab with sharing URL, QR code, list settings
- Streaming platform "Where to Watch" with clickable deep links
- i18n translation keys
- Responsive design (mobile + desktop)

### Out of Scope
- Visitor save/bookmark functionality (v2)
- Cross-category Top Picks on profile hub page (v2)
- URL-based individual movie sharing with SEO (v2 — modal only in v1)
- Visitor-side regional streaming platform filtering (v2)
- Other recommendation categories (Books, Music, Products, Links, Tools, Games)
- Changes to the existing Places feature
- Backend/Strapi plugin development (user creates collections manually)
- Analytics tracking for movie page views (can be added later)

## User Stories

### Creator Stories

**US-1: Category Navigation**
As a creator, I want to switch between Places and Movies on my dashboard, so I can manage different types of recommendations.
- Desktop: persistent sidebar with category icons
- Mobile: category cards grid as dashboard landing, back-navigation into each category

**US-2: Create Movie List**
As a creator, I want to create a named movie list (e.g., "Mind-Bending Sci-Fi") so I can organize my recommendations thematically.
- Fields: list name (required), description (optional), cover image (optional, auto from first movie), slug (auto-generated, editable)
- List creation takes under 10 seconds

**US-3: Add Movie**
As a creator, I want to search for a movie or TV show and add it to my list with my personal note.
- Full-page overlay with TMDB search
- Search results show: poster, title, year, director/creator, genres, rating, runtime
- After selection: auto-filled details, personal note (optional), where to watch (auto from TMDB), pin checkbox, media upload
- Submit saves all metadata to Strapi

**US-4: Manage Movies in List**
As a creator, I want to view, edit, delete, reorder, and pin movies within a list.
- Table/list rows with poster thumbnail, title, year, genre, rating, note preview
- Pin toggle (⭐) per row
- ⋮ menu: Edit, Delete, Move to another list
- Drag handles for reorder
- Sort presets: Custom, Rating, Year, Recently added

**US-5: Publish List**
As a creator, I want to toggle a list between published and draft, so I can control what's visible on my public page.
- Toggle on list card (Movies home) and inside list view
- Published = visible on public page. Draft = hidden

**US-6: Manage Top Picks**
As a creator, I want to pin my favorite movies as "Top Picks" and control how they appear on my public page.
- Customizable display name
- Drag-to-reorder pinned items
- Max 15 pins
- Counter showing usage

**US-7: Share List**
As a creator, I want to get a shareable URL and QR code for any movie list.
- Manage tab shows URL, QR code, copy button
- URL format: `explorers.earth/[username]/movies/[list-slug]`

### Visitor Stories

**US-8: Browse Movie Recommendations**
As a visitor, I want to see a creator's movie recommendations organized in themed rows that I can scroll through.
- Netflix/IMDb-style horizontal carousel rows
- Top Picks row first (if exists), then published lists, then genre browse
- Poster cards with rating badge overlay + title below

**US-9: View Movie Details**
As a visitor, I want to tap a movie poster to see the creator's recommendation details.
- Slide-up modal: poster, metadata, creator's note, where to watch, creator's photos, source list
- Share button
- Swipe-down to dismiss

**US-10: Browse by List**
As a visitor, I want to tap a list heading to see all movies in that list as a grid.
- Full poster grid page at `/:username/movies/:listSlug`
- List name, description, movie count
- Back navigation to main movies page

**US-11: Browse by Genre**
As a visitor, I want to browse movies by genre across all the creator's lists.
- Genre cards at bottom of movies page with backdrop images
- Tap opens genre page at `/:username/movies/genre/:genreSlug`
- Poster grid of all movies in that genre across all lists

## Data Model Summary

See `movies_and_shows_schema.md` for complete field-level detail.

- **Movie List collection** — list name, description, cover image, slug, visibility, account relation, movie relations, pin order settings
- **RecommendedMovie collection** — TMDB metadata (tmdb_id, title, year, poster, genres, director, runtime, rating, media_type), creator's note, where to watch (JSON), is_pinned, pin_order, media uploads, list relation, Movie_Category relation

## API Summary

See `movies_and_shows_api_contract.md` for complete request/response shapes.

- GraphQL queries: movie lists by user, movies by list (paginated), pinned movies, movies by genre, single movie details
- GraphQL mutations: CRUD for lists and movies, pin toggle, pin reorder, list reorder
- TMDB API: search multi, movie/TV details, watch providers, genre list

## Business Logic

- **Duplicate prevention:** When adding a movie, check if the same TMDB ID already exists in the target list. Allow the same movie in different lists.
- **Pin limit:** Max 15 pinned movies. UI shows counter and disables pin toggle when limit reached.
- **Slug generation:** Auto-generate from list name (lowercase, hyphens, remove special chars). Must be unique per user. Append number if duplicate.
- **Cover image fallback:** If no cover image uploaded, use the first movie's poster as the list cover.
- **Genre extraction:** Genres come from TMDB metadata stored in each movie. Genre browse section aggregates across all published lists. Only genres with at least 1 movie are shown.
- **Streaming platform data:** Stored at save time using creator's region. Not dynamically updated. Creator can manually edit.
- **Media upload:** Reuse existing media upload patterns (max 10 files, device + Google Images). Stored in S3 with structured paths.
- **List ordering on public page:** Creator-defined via drag-and-drop in Manage. Stored as an order field on the list entity.
- **Poster images:** Stored as TMDB CDN URLs in Strapi (not downloaded and re-hosted). TMDB CDN is reliable and free.

## Acceptance Criteria

### Creator Dashboard
- [ ] Desktop sidebar shows Places and Movies & Shows categories
- [ ] Mobile shows category cards grid with Places and Movies & Shows
- [ ] Clicking Movies opens the Movies home view
- [ ] Creator can create a new movie list with name, description, optional cover
- [ ] Creator can add a movie via TMDB search with auto-filled metadata
- [ ] Personal note is optional during add
- [ ] Where to Watch platforms are auto-populated from TMDB
- [ ] Creator can pin movies to Top Picks (max 15) via star toggle
- [ ] Creator can drag-to-reorder movies within a list
- [ ] Creator can drag-to-reorder pinned items in Top Picks manager
- [ ] Creator can customize Top Picks display name
- [ ] Creator can toggle list between Published and Draft
- [ ] Manage tab shows shareable URL and QR code
- [ ] Creator can edit and delete movies
- [ ] Creator can edit list name, description, cover, slug
- [ ] Creator can delete a list (with confirmation)
- [ ] Existing Places dashboard is fully functional and unchanged

### Public Page
- [ ] Public movies page loads at `/:username/movies`
- [ ] Header shows "[Creator]'s Movies · [count] movies"
- [ ] Top Picks carousel row appears first (if pinned items exist)
- [ ] Published lists appear as horizontal carousel rows in creator-defined order
- [ ] Poster cards show poster image with rating badge overlay + title below
- [ ] TV shows display a "Series" badge
- [ ] Tapping a poster opens the detail modal
- [ ] Detail modal shows: poster, metadata, creator's note, where to watch (clickable), photos, source list, share
- [ ] Detail modal swipe-down-to-dismiss works on mobile
- [ ] Tapping list heading opens full poster grid page
- [ ] Genre browse section shows at bottom with backdrop image cards
- [ ] Tapping genre card opens genre poster grid page
- [ ] Empty states render gracefully (no published movies, no pinned items, etc.)

### Cross-Cutting
- [ ] All new UI text has i18n translation keys
- [ ] Responsive across mobile (<768px) and desktop (≥768px)
- [ ] Loading skeletons shown during data fetch
- [ ] No regressions in existing Places feature

## Open Questions

1. **TV show season/episode detail** — In v1, do we store only show-level data from TMDB, or also allow recommending specific seasons/episodes? Recommendation: show-level only in v1.
2. **Poster image caching** — If TMDB changes a poster URL or removes it, stored URLs break. Do we need a fallback strategy beyond a default placeholder? Recommendation: store TMDB poster path, build URL at render time using TMDB image CDN. If image fails to load, show fallback.
3. **List ordering persistence** — How does the public page order field get stored? Recommendation: `display_order` integer field on the list entity, updated via mutation when creator reorders.
