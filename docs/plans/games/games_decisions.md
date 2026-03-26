---
Feature: games
Doc type: decisions
Status: draft
Created: 2026-03-26
Last updated: 2026-03-26
Updated by: agent
Depends on: none
---

# Games — Decisions Log

Every architectural and design decision for this feature, with context, alternatives considered, and rationale.

---

## D1: Separate Strapi Collection vs Extend Existing Collections

**Decision:** Create a new `RecommendedGame` Strapi collection with properly typed fields.

**Context:** Following the exact pattern established by Movies & Shows and Books. Games have fundamentally different metadata: IGDB ID, platforms (PC, PS5, Xbox, Switch), developer, publisher, game modes, screenshots, ESRB/PEGI ratings. Reusing `RecommendedMovie` or `RecommendedBook` would create a shapeless JSON blob with many null fields irrelevant to games.

**Alternatives considered:**

1. **Extend RecommendedMovie with Entity_Type enum + JSON metadata** — Avoids a new collection but creates an untyped generic blob. Strapi can't validate fields. GraphQL returns weakly-typed data. Every movie query would need to handle nulls for game-only fields.

2. **Polymorphic entity table with Item_Metadata JSONB** — Architecturally elegant for 9+ entity types, but requires massive rewrite. Premature optimization.

**Rationale:** Separate collections give clean, typed schemas conforming to each domain. This pattern was established by Movies, reinforced by Books, now confirmed by Games.

**Impact on implementation:** New Strapi collection to create. New GraphQL queries/mutations. Frontend components are net-new.

**Impact on future work:** When Music, Products, etc. ship, each gets its own collection. This is the third reinforcement of D1.

---

## D2: Game List — Separate GameList Collection

**Decision:** Create a new `GameList` Strapi collection (not extending `RecommendationList`, `MovieList`, or `BookList`).

**Context:** Identical rationale as Movies D2 and Books D2. Game lists share the same fundamental structure (name, description, slug, visibility, display_order) but are semantically distinct.

**Rationale:** New `GameList` collection mirrors the `MovieList` and `BookList` patterns. Same field structure, same relation patterns, same visibility logic. The frontend treats it as a typed entity. Continues the "one collection per category" convention.

**Impact on future work:** Further establishes the template for Music, Products list collections.

---

## D3: External API — IGDB (Internet Game Database)

**Decision:** Use IGDB API (v4, powered by Twitch) as the primary data source for game search and metadata.

**Context:** Games need a reliable, comprehensive, free API for searching by title and retrieving rich metadata (cover art, platforms, genres, developer, publisher, ratings). The analogous TMDB for games is IGDB.

**Alternatives considered:**

1. **Steam Store API** — Excellent data for Steam titles, but doesn't cover console exclusives (PS5, Xbox, Nintendo Switch), mobile games, or older titles comprehensively. Coverage is limited to the Steam ecosystem.

2. **rawg.io API** — Good coverage, REST-only, free tier. However, data quality and completeness are inconsistent. IGDB is richer (storyline, game modes, screenshots, franchise data).

3. **Giant Bomb API** — Rich editorial data but requires explicit API key approval. Slower to obtain access. Less actively maintained than IGDB.

4. **Hardcoded manual entry (no API)** — Eliminates API dependency but creates terrible UX for finding cover art, platform lists, release dates.

**Rationale:** IGDB is the TMDB equivalent for games: free, comprehensive (300k+ games), excellent metadata quality (cover art, screenshots, platforms, genres, developers, ESRB ratings, game modes), actively maintained by Twitch/Amazon. Used by industry-grade applications. Follows the same hybrid pattern as TMDB and Google Books: client-side search during add flow → store metadata in Strapi → public pages read from Strapi only.

**Key IGDB advantage:** Cover images via Twitch CDN (`images.igdb.com`) are highly reliable and available in multiple sizes.

**Impact on implementation:** New `VITE_IGDB_CLIENT_ID` + `VITE_IGDB_PROXY_URL` env variables. IGDB requires Twitch OAuth — must be proxied (see D4). New `igdbService.ts` service module.

---

## D4: IGDB Authentication — Server-Side Proxy (Critical Difference from Books/Movies)

**Decision:** IGDB API calls are proxied through a Strapi custom route (or serverless function) because the Twitch client secret cannot be exposed in the frontend bundle.

**Context:** IGDB requires a Twitch `client_credentials` OAuth token (`POST https://id.twitch.tv/oauth2/token?client_id=...&client_secret=...&grant_type=client_credentials`). Unlike TMDB (API key only) and Google Books (API key only), IGDB needs a `client_secret` in addition to a `client_id`. A client secret MUST NOT be in the frontend bundle.

**Alternatives considered:**

1. **Expose client secret in frontend** — Insecure. Anyone who views the page source can steal the credentials and abuse the Twitch account. Explicitly rejected.

2. **Vercel Edge Function / Cloudflare Worker** — Valid option. Creates a micro-proxy that exchanges the token and passes requests. Requires additional deployment infrastructure.

3. **Strapi custom route** — Add a custom controller to Strapi that acts as a proxy for IGDB search and detail requests. The Strapi server holds the client secret in its own environment variables. Frontend calls Strapi (which is already deployed and trusted). **Selected approach.**

4. **Cache the access token in Strapi** — The Twitch token expires after ~60 days. Strapi proxy should cache the current token and refresh it when it expires (or on 401).

**Rationale:** Strapi is already deployed, already trusted, already proxies authenticated GraphQL. Adding a custom REST route for `/api/igdb-proxy/search` and `/api/igdb-proxy/game/:igdbId` is minimal work and keeps secrets server-side. This is the most seamless option given the current infrastructure.

**Impact on implementation:**
- Strapi: new custom route `GET /api/igdb-proxy/search?q={query}` and `GET /api/igdb-proxy/game/:igdbId`
- Strapi: environment variables `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` (server-side only)
- Frontend: calls Strapi proxy instead of IGDB directly; uses `VITE_IGDB_PROXY_URL` env variable

---

## D5: Dashboard Navigation — Extend Existing Sidebar

**Decision:** Add Games as a new category item in the existing dashboard sidebar (desktop) and category cards grid (mobile), alongside Places, Movies & Shows, and Books.

**Context:** Same rationale as Books D4. The sidebar/category cards were built with future categories in mind. Adding Games is purely additive.

**Rationale:** Consistent patterns. Minimal friction. The sidebar is already established navigation. Users already know it from Movies & Shows and Books.

**Impact on implementation:** Update `DashboardSidebar.tsx`, `CategoryCards.tsx`, widen `currentCategory` type to include `'games'`.

---

## D6: Public Page Layout — Carousel Rows (Same as Movies & Books)

**Decision:** Same Netflix-style vertical scroll of horizontal carousel rows as Movies & Shows and Books — one row per game list.

**Context:** The carousel row pattern is the established template for all recommendation categories. Games map perfectly: a creator has themed lists ("All-Time Favorites", "Great for Beginners", "Indie Gems"), each becomes a carousel row.

**Alternatives considered:**

1. **Gaming storefront style (Steam/Xbox layout)** — Visually distinctive but complex. Inconsistent with the rest of the platform.

2. **Masonry grid with screenshots as background** — Visually rich but breaks the consistent platform aesthetic.

**Rationale:** Game covers (portrait ratio, matching movie posters and book covers) work identically in the carousel row pattern. Code reuse. Visual consistency across categories.

**Impact on implementation:** Reuse or closely mirror `BookCarouselRow`, `BookCoverCard` patterns. Create game-specific variants.

---

## D7: Add Game Flow — Full-Page Overlay (Same as Movies & Books)

**Decision:** Full-page overlay (route-based: `/:listId/new-game`) matching the existing add-movie and add-book patterns.

**Context:** The add flow requires: searching IGDB, selecting a result, writing a personal note, optionally uploading a screenshot, optionally pinning to Top Picks, and providing a user rating. This is a multi-section form needing full vertical space.

**Rationale:** Consistent with Movies and Books. Full-page overlay is the universal add-item pattern across all categories.

**Impact on implementation:** New `AddGamePage.tsx` following `AddBookPage.tsx` structure. IGDB search replaces Google Books search.

---

## D8: Publish Model — List-Level Only (Same as Movies & Books)

**Decision:** Publish/draft toggle at the list level. All games in a published list are visible. No per-item visibility control.

**Rationale:** Identical to Movies D7 and Books D7. One toggle, clear mental model, consistent across all categories.

**Impact on implementation:** `Visibility` boolean on `GameList`. Toggle component on list card and inside list view.

---

## D9: Top Picks — Pin Model (Same as Movies & Books)

**Decision:** Creators pin individual games to "Top Picks" via a pin/star icon. Pinned games from across all lists aggregate into the first row on the public page. Max 15 pins.

**Rationale:** Identical to Movies D8 and Books D8. Pin model is zero-friction, stays in sync, requires no separate list management.

**Impact on implementation:** `is_pinned` and `pin_order` fields on `RecommendedGame`. Star toggle on card UI. Dedicated Top Picks management view.

---

## D10: Detail View — Modal Overlay (Same as Movies & Books)

**Decision:** Tapping a game cover on the public page opens a slide-up modal overlay. No full-page navigation for individual games in v1.

**Rationale:** Modal keeps visitor in context. Matches `PlaceOverview`, `MovieDetailModal`, and `BookDetailModal` patterns.

**Content in detail modal:** large cover art, title, platforms (chips), developer, publisher, release year, genres (chips), game modes (chips), IGDB rating, creator's personal note, creator's rating (1-10 stars), creator's photos (if any), source list link, share button. Swipe-down-to-dismiss on mobile.

---

## D11: IGDB Cover Images — Twitch CDN URL Construction

**Decision:** Store the IGDB cover `image_id` in Strapi and construct URLs on the frontend using the Twitch CDN pattern. Also store pre-built URLs for convenience.

**Context:** IGDB covers use a consistent CDN URL pattern: `https://images.igdb.com/igdb/image/upload/t_{size}/{image_id}.jpg`. This is more flexible than Google Books (full opaque URLs) and similar to TMDB (path + base).

**Sizes available:**
- `thumb` — ~90×128px — small thumbnails
- `cover_small` — 90×128px
- `cover_big` — 264×374px — use for carousel cards ✓
- `screenshot_med` — 569×320px
- `720p` — 1280×720px
- `1080p` — 1920×1080px — use for detail modal ✓

**Decision detail:** Store both `image_id` (for future size flexibility) and pre-built `cover_url` (cover_big, ~264×374px) and `cover_url_large` (1080p) at save time. This avoids URL reconstruction on every render.

**Impact on implementation:** `igdb_image_id`, `cover_url`, `cover_url_large` fields on `RecommendedGame`. `igdbService.ts` provides helpers for building various size URLs.

---

## D12: Genre Browse Section

**Decision:** Genre browse section at the bottom of the public Games page, mirroring the genre browse section in Movies. Each genre card shows cover art from a game in that genre, genre name, and game count.

**Context:** Games have rich genre data from IGDB (Action, RPG, Strategy, Simulation, etc.). These allow visitors to browse by genre across all of a creator's game lists.

**Rationale:** Genre browse follows the Movies genre browse pattern. Dedicated genre page at `/:username/games/genre/:genreSlug`. Only genres with ≥1 game in published lists are shown.

---

## D13: Platform Display

**Decision:** Store platforms as a JSON array of platform names from IGDB. Display as compact chips in cards and full list in detail modal.

**Context:** IGDB provides rich platform data. A game may be on many platforms (PC, PS5, Xbox Series X, Nintendo Switch, etc.). Showing all platforms is valuable to visitors to know if a game is available on their platform.

**Alternatives considered:**

1. **Filter to major platforms only** — Reduces noise. But risks hiding relevant info (e.g., a Nintendo exclusive on Switch only).
2. **Show all platforms** — Most accurate. **Selected.**
3. **Let creator select relevant platforms** — Adds friction. Auto-populated from IGDB is better UX.

**Rationale:** Auto-populate all platforms from IGDB, show compact chips. In detail modal, show full list. In cover cards, show the first 2-3 most relevant platforms to keep cards compact.

---

## D14: IGDB Rating Scale

**Decision:** Store IGDB `total_rating` (0-100 scale) as-is. Display it divided by 10 (e.g., "8.7/10") for consistency with other categories.

**Context:** IGDB uses a 0-100 scale for `total_rating` (a weighted average of critic and user ratings). Creator's `user_rating` is stored as 1-10 integer (consistent with Movies & Shows and Books).

**Rationale:** Dividing by 10 makes IGDB rating visually consistent with other categories' display. Stored raw (0-100) in Strapi for precision.

---

## D15: Notes — Optional Rich Text (Same as Movies & Books)

**Decision:** Personal note field is optional, uses Tiptap rich text editor. Not required.

**Rationale:** Identical to Movies and Books. Creator can batch-add games and add notes later via the edit flow.

---

## D16: Visitor Save — Deferred to v2

**Decision:** No save/bookmark functionality for visitors in v1.

**Context:** Same as Movies and Books. Cross-category visitor save/wishlist is a v2 feature.

---

## D17: Game Screenshots — Store IGDB URL Strings

**Decision:** Store IGDB screenshot `image_id` values as a JSON array in Strapi. Construct full URLs on the frontend. Do NOT re-host in S3.

**Context:** Unlike Movies (where TMDB images are re-hosted in S3), IGDB's Twitch CDN (`images.igdb.com`) is highly reliable. Re-hosting would add significant storage costs and complexity for screenshot-heavy games.

**Alternatives considered:**

1. **Re-host in S3** — High reliability, no CDN dependency. But adds storage cost and complexity. IGDB CDN is already excellent.
2. **Store full URLs** — Less flexible if CDN structure changes.
3. **Store image_ids only, build URLs at render time** — Most flexible. **Selected.**

**Rationale:** Store `screenshot_ids` as a JSON array of IGDB image IDs. Build screenshot URLs at render time using `igdbService.getScreenshotUrl(imageId, size)`. This is resilient and storage-efficient.

---

## D18: Tiptap Editor & User Ratings (Same as Movies & Books)

**Decision:** Creator notes stored as Tiptap JSON blocks. `user_rating` field is 1-10 integer, matching Movies & Shows and Books exactly.

**Context:** Same rationale as Movies D17 and Books D17. Rich text for engaging notes. Creator's personal 1-10 rating adds their subjective voice independently of IGDB's 0-100 aggregate rating.

**Rationale:** `user_recommendation_note` uses Tiptap blocks. `user_rating` stores a 1-10 integer rendered as stars. IGDB `total_rating` stored separately as `igdb_rating` for display/reference.
