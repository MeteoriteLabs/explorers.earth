---
Feature: movies-and-shows
Doc type: decisions
Status: draft
Created: 2026-03-20
Last updated: 2026-03-20
Updated by: agent
Depends on: none
---

# Movies & Shows — Decisions Log

Every architectural and design decision for this feature, with context, alternatives considered, and rationale.

---

## D1: Separate Strapi Collection vs Extend RecommendedPlace

**Decision:** Create a new `RecommendedMovie` Strapi collection with properly typed fields.

**Context:** The existing `RecommendedPlace` collection is tightly coupled to Google Places data — `Place_Id`, `Place_Address`, `Geometry` (lat/lng), `Rating` from Google. Movies have fundamentally different metadata (TMDB ID, director, runtime, genres, streaming platforms).

**Alternatives considered:**

1. **Extend RecommendedPlace with Entity_Type enum + JSON metadata** — Would avoid a new collection, but creates a shapeless JSON blob that Strapi can't validate. Admin panel forms become generic. GraphQL returns untyped data the frontend must parse and hope is correct. Every query returns null fields irrelevant to the entity type.

2. **Polymorphic entity table with Item_Metadata JSONB** — Architecturally clean for 9+ entity types, but requires a massive rewrite of the existing Strapi schema, all GraphQL queries, the category mapper, and every component touching recommendations. Overkill for the current stage.

**Rationale:** Separate collections give clean, typed schemas. Strapi admin panel provides proper forms. GraphQL returns strongly typed data. Each collection evolves independently. Zero risk to existing Places functionality.

**Impact on implementation:** New Strapi collection to create. New GraphQL queries/mutations to write. Frontend components are new (no modification of existing place components).

**Impact on future work:** When Books, Games, Music, etc. ship, each gets its own collection following this same pattern. The `RecommendationList` becomes the unifying layer across all entity types.

---

## D2: RecommendationList — Extend Existing vs Separate MovieList

**Decision:** Create a new Strapi collection for movie lists (effectively a `MovieList` or extend `RecommendationList` with `List_Type`). The exact Strapi collection structure will be documented in the schema doc for the user to create.

**Context:** The existing `RecommendationList` is tightly coupled to places — it stores `List_Name_Details` with `place_id`, geographic `location`, and thumbnail fetched from Google Places. Movie lists don't have geographic metadata.

**Alternatives considered:**

1. **Add List_Type enum to existing RecommendationList** — Unifies all list types. But requires migrating all existing lists to `List_Type='places'`, and the existing `List_Name_Details` JSON structure with `place_id` and `location` fields becomes confusing for movie lists that don't have those.

2. **Create a completely separate MovieList collection** — Clean separation, zero risk to existing lists. But introduces a second list system to query and manage.

**Rationale:** The user will create the Strapi collections. The schema doc will specify exactly what fields are needed. Whether it's an extension of the existing collection or a new one, the frontend treats it as a typed entity. The schema doc will recommend the cleanest approach.

**Impact on implementation:** Frontend queries will target whatever collection the schema specifies. The dashboard sidebar and category routing are frontend-only concerns.

**Impact on future work:** Sets the pattern for how all future category lists are structured in Strapi.

---

## D3: Dashboard Navigation Pattern

**Decision:** Sidebar navigation on desktop, category cards grid on mobile.

**Context:** The current dashboard has no category layer — it goes directly to the location carousel. With Movies (and future categories), creators need a way to switch between content types.

**Alternatives considered:**

1. **Category pills above list carousel** — Minimal disruption, stays in current layout. But adds horizontal scroll on top of horizontal scroll (pills + list carousel), which is cluttered on mobile.

2. **Category cards grid (both desktop and mobile)** — Clean entry point, but adds an extra tap on desktop where screen space allows a persistent sidebar.

3. **Sidebar on both desktop and mobile** — Sidebar on mobile takes too much space or becomes a hamburger menu, adding friction.

**Rationale:** Desktop has horizontal space for a persistent sidebar — always visible, fast switching, clear wayfinding. Mobile doesn't have that space, so category cards as a landing page with back-navigation into each category is cleaner. Each platform gets the pattern that works best for its constraints.

**Impact on implementation:** New sidebar component for desktop. New category cards view for mobile. Responsive breakpoint at `md` (768px) matching existing patterns. Each category view is a child route within the dashboard.

**Impact on future work:** Adding a new category = adding a sidebar item + category card. Minimal incremental effort.

---

## D4: Public Page Layout — Carousel Rows vs Grid

**Decision:** Netflix/IMDb-style vertical scroll of horizontal poster carousels.

**Context:** The creator's movie recommendations are organized in themed lists. The public page needs to showcase these lists in a visually engaging way that encourages browsing and discovery.

**Alternatives considered:**

1. **Flat poster grid with category/list filters** — Utilitarian, good for search/scan. But loses the narrative structure of themed lists. A flat grid of 27 movie posters doesn't tell a story.

2. **Card grid matching current Places layout** — Consistent with existing Places page. But movie posters are tall (2:3 ratio) while place cards are wide. The visual mismatch would feel like a poor adaptation rather than a purpose-built experience.

**Rationale:** Each horizontal carousel row IS a list. The row heading carries the creator's voice ("Mind-Bending Sci-Fi", "Comfort Watches"). This preserves the curation narrative while being visually rich. The pattern is universally understood (Netflix, IMDb, Disney+, every streaming service). Mobile-friendly — vertical scroll is the dominant behavior.

**Impact on implementation:** New carousel component (or adapt existing horizontal scroll patterns). Per-list data fetching. Lazy loading per row.

**Impact on future work:** This carousel row pattern becomes the template for Books, Games, Music, Products. Build it well once, reuse across categories.

---

## D5: Poster Card Style

**Decision:** Netflix-style full-image poster with subtle rating badge overlay + title below.

**Context:** Movie posters are the primary visual element. The card design determines the overall feel of the public page.

**Alternatives considered:**

1. **Poster + title + rating + genre below (IMDb style)** — More informative but takes more vertical space per card. Reduces the number of visible cards, especially on mobile.

2. **Poster only, no text (pure Netflix)** — Cleanest, most cinematic. But forces tap/hover to identify the movie, which slows browsing.

3. **Poster with title + rating below** — Middle ground but clutters the clean poster aesthetic.

**Rationale:** Full poster image as the dominant visual (cinematic feel). A small semi-transparent rating badge overlaid in the bottom-right corner (visible but not intrusive). Title in small text below the poster (identifiable without tapping). For TV shows, a small "Series" badge in the top-left corner to distinguish from movies. On desktop hover: slight scale-up (1.05x) matching existing place card behavior.

**Impact on implementation:** Single card component with conditional badge rendering. CSS overlay positioning. Hover animation.

**Impact on future work:** Similar badge patterns can be adapted for Books (page count badge), Games (platform badges), Products (price badge).

---

## D6: Add Movie Flow — Full-Page Overlay

**Decision:** Full-page overlay (route-based navigation like `/:listId/new-movie`), matching the existing add-place pattern.

**Context:** Adding a movie involves searching TMDB, selecting a result, writing a personal note, optionally uploading media, and optionally pinning to Top Picks.

**Alternatives considered:**

1. **Modal/slide-up panel (80% screen)** — Faster, stays in context. But the add form has multiple sections (search, movie details, note, where to watch, media upload, pin toggle) which need vertical scroll space. A modal with internal scrolling feels cramped, especially on mobile.

2. **Inline expansion within the list** — Movie search + form expands within the list view. Too complex, breaks the list layout.

**Rationale:** Full-page overlay is consistent with the existing add-place flow (`/:listId/new`). Gives full vertical space for the form. Clean "← Back to [list name]" navigation. Route-based means browser back button works naturally. The user explicitly confirmed this approach.

**Impact on implementation:** New route + page component. TMDB search integration. Form with conditional sections based on search selection.

**Impact on future work:** This overlay pattern becomes the template for adding Books (Google Books search), Games (IGDB search), etc.

---

## D7: Publish Model — List-Level Only

**Decision:** Publish/draft toggle applies at the list level. All movies in a published list are visible on the public page. No per-item visibility control.

**Context:** Creators need to control what's visible on their public page.

**Alternatives considered:**

1. **Both list-level + item-level** — More granular control. But adds complexity to the UI (two layers of visibility toggles) and makes the publish state harder to understand ("is this movie hidden because the list is draft, or because the movie itself is hidden?").

2. **Item-level only** — Maximum granularity. But creators would need to toggle each movie individually, which is tedious for lists with 10+ items.

**Rationale:** List-level publish is simple to understand (list is either live or not), fast to use (one toggle), and matches the existing Places pattern. If a creator wants to hide specific movies, they can move them to a draft list. The mental model is clear: published list = all its movies are visible.

**Impact on implementation:** Single `Visibility` boolean on the list entity (matching existing pattern). Toggle component on the list card and inside the list view.

**Impact on future work:** Same pattern for all future categories. Consistent behavior across the platform.

---

## D8: Top Picks — Pin Model

**Decision:** Creators pin individual movies to "Top Picks" via a star/pin icon on each item. Pinned items from across all lists aggregate into the first row on the public page.

**Context:** Creators want to highlight their absolute favorite movies regardless of which list they belong to.

**Alternatives considered:**

1. **Special "Top Picks" list** — Creator manages a separate list. Items are added to or linked from other lists. But creates management overhead and risks going stale if the creator forgets to update it.

2. **Auto-generated from ratings** — System picks the highest-rated items. But removes creator agency and doesn't account for personal preference.

**Rationale:** Pin model is zero-friction (one tap on any item), stays in sync (pinned items always reflect the latest list contents), and requires no separate list management. The creator can customize the Top Picks row heading (e.g., "Maya's Must-Watch Movies" instead of generic "Top Picks"). Max 15 pins prevents the Top Picks from becoming "All Picks." Drag-to-reorder in a dedicated manager lets creators control the exact order.

**Data model:** `is_pinned: boolean` and `pin_order: number` fields on `RecommendedMovie`. The public page queries all pinned items sorted by `pin_order`.

**Impact on implementation:** Two fields on the movie entity. Star toggle on card UI. Dedicated Top Picks management view with drag-and-drop.

**Impact on future work:** Same pin model for Books, Games, Music, Products. Cross-category Top Picks on the profile hub page (v2) would query pinned items across all entity collections.

---

## D9: Detail View — Modal Overlay

**Decision:** Tapping a movie poster on the public page opens a slide-up modal overlay (not a full-page navigation).

**Context:** Visitors browsing the public page need to see movie details without losing their scroll position in the carousel rows.

**Alternatives considered:**

1. **Full detail page with dedicated route** — Better for SEO, shareable URL per movie. But breaks the browsing flow — visitor loses their scroll position and context.

2. **Modal + URL update (hybrid)** — Modal overlay that also updates the URL for shareability. Best of both worlds but adds routing complexity.

**Rationale:** Modal keeps the visitor in context — they can close it and continue scrolling. Matches the existing `PlaceOverview` modal pattern. The modal includes: large poster, title/year/rating/genres/director/runtime, creator's personal note (highlighted), where-to-watch streaming badges with deep links, creator's photos (if any), source list link, and a share button. Swipe-down-to-dismiss on mobile (existing pattern). URL-based shareability of individual movies is deferred — sharing the list URL is sufficient for v1.

**Impact on implementation:** New modal component following `PlaceOverview` patterns. Data fetching for single movie details. Swipe gesture handling.

**Impact on future work:** Same modal pattern for Books, Games detail views. URL-based individual item sharing can be added in v2 across all categories.

---

## D10: TMDB API Integration — Hybrid (Client + Store)

**Decision:** Client-side TMDB search during the add flow. All metadata stored in Strapi when saving. Public pages read exclusively from Strapi.

**Context:** explorers-earth is a frontend SPA with no backend server. TMDB API needs to be called for movie search and metadata fetching.

**Alternatives considered:**

1. **Client-side only** — Simple but means public pages depend on TMDB availability for metadata. TMDB rate limits could affect page loads.

2. **Server-side proxy through Strapi custom route** — Hides API key, enables caching. But requires Strapi plugin development, which is outside the frontend scope and adds deployment complexity.

3. **Netlify serverless function as proxy** — Hides API key via serverless function. Good middle ground but adds infrastructure.

**Rationale:** TMDB explicitly allows client-side usage. API keys are free and rate limits are generous (40 req/10 sec). Search during the add flow is interactive and benefits from direct client-side calls (lower latency). When the creator saves a movie, all TMDB metadata (poster URL, title, year, genres, director, runtime, streaming platforms, TMDB ID) is stored in Strapi. Public pages never call TMDB — they read from Strapi. This means public page performance is independent of TMDB availability.

**Impact on implementation:** New `VITE_TMDB_API_KEY` env variable. TMDB service module with search and detail fetch functions. Movie entity stores all display-relevant metadata.

**Impact on future work:** Same hybrid pattern for Google Books API (Books), IGDB API (Games). Client search → store metadata → serve from Strapi.

---

## D11: Streaming Links — Clickable Deep Links

**Decision:** "Where to Watch" streaming platform badges link directly to the movie's page on each streaming service.

**Context:** TMDB provides watch provider data including deep links for each region.

**Alternatives considered:**

1. **Static badges (names only)** — Simpler, no broken links. But less useful — the visitor still has to manually search for the movie on the streaming platform.

2. **Links without regional context** — Show all global platforms. But confusing if a visitor sees "Available on Netflix" and it's not available in their region.

**Rationale:** Clickable deep links provide maximum utility — one tap and the visitor is watching. TMDB provides region-specific watch providers via the `/movie/{id}/watch/providers` endpoint. The creator's region is used at save time to populate the initial list; the creator can manually add/remove platforms. Regional differences are acknowledged but not dynamically resolved per visitor in v1 (would require visitor geolocation).

**Impact on implementation:** Store streaming platform data (name, logo URL, deep link URL) as a JSON array in the movie entity. Render as tappable badges in the detail modal.

**Impact on future work:** Visitor-side regional filtering of streaming platforms could be added in v2.

---

## D12: Genre Browse Section

**Decision:** Genre cards at the bottom of the public Movies page. 2-column grid on mobile, 4-column on desktop. Each card has a backdrop image, genre name, and movie count. Tapping opens a dedicated genre page with a poster grid.

**Context:** Visitors may want to browse the creator's movies by genre rather than by the creator's custom lists.

**Alternatives considered:**

1. **Filter pills (filter in-place)** — Tapping "Sci-Fi" filters the existing carousel rows. Quick, no navigation. But loses the carousel row structure — filtered rows with 1-2 items look sparse.

2. **Expand genre card into a carousel row** — In-place expansion. Novel but unfamiliar pattern, harder to implement.

**Rationale:** Dedicated genre page (`/:username/movies/genre/sci-fi`) is shareable, SEO-friendly, and gives the full picture of a genre across all lists. The poster grid format is appropriate here because the visitor has already narrowed their intent to a specific genre — they want to see everything, not browse by list. Backdrop images come from TMDB's backdrop data for a movie in that genre, making the genre cards visually rich.

**Impact on implementation:** Genre extraction from movie metadata at query time. New genre page component with poster grid. Dynamic route handling.

**Impact on future work:** Same genre/subject browse pattern for Books (by subject), Games (by genre).

---

## D13: Notes — Optional, No Special Quick-Add Mode

**Decision:** The personal note field exists in the add movie form but is not required. No separate "quick add" batch mode.

**Context:** The personal note is what makes a recommendation personal (vs. a catalog entry). But forcing a note on every single movie adds friction, especially during initial profile setup.

**Alternatives considered:**

1. **Required note** — Forces quality curation. But blocks rapid list building and causes abandonment during initial setup.

2. **Optional note + dedicated quick-add batch mode** — Best of both worlds. But adds UI complexity (two different add flows) for a marginal benefit.

**Rationale:** Making the note optional in the regular flow achieves the same result as a quick-add mode without the UI complexity. Creators who want to batch-add can skip the note for each movie and come back later to edit. Creators who want to write thoughtful notes can do so during the add flow. One flow, flexible behavior.

**Impact on implementation:** Note field is optional in form validation. Edit flow lets creators add/update notes on existing movies.

**Impact on future work:** Same approach for all categories — note is always optional.

---

## D14: Visitor Save — Deferred to v2

**Decision:** No save/bookmark functionality for visitors in v1. Detail modal shows view and share options only.

**Context:** A "Save" button would let logged-in visitors bookmark movies from a creator's page to their own profile.

**Rationale:** Building a visitor-facing saved items system is a separate feature with its own data model, UI, and UX. It's valuable but not required for the core creator experience. Deferring keeps v1 scope focused on the creator's ability to curate and publish movie recommendations. Share button provides the primary visitor action.

**Impact on future work:** When visitor save ships (v2), it applies across all categories — save a place, book, movie, product. Better to build it once for all types than piecemeal per category.

---

## D15: Manage Tab — Separate Tab

**Decision:** List management (sharing URL, QR code, list settings, delete) lives in a separate "Manage" tab within the list view, matching the current Places dashboard pattern.

**Context:** Inside a movie list, the creator needs access to both item management (add/edit/delete/reorder movies) and list management (sharing, settings, delete list).

**Alternatives considered:**

1. **Inline at bottom of item list** — Everything on one scrollable page. Fewer clicks but mixes content management with list administration.

2. **Action bar with icon buttons** — Share/QR/Settings as icon buttons in the header. Minimal space. But hides important actions behind icons that may not be discoverable.

**Rationale:** Separate Manage tab is consistent with the existing Places dashboard. Creators already know this pattern. Content management (Recommendations tab) stays clean and focused on movies. List administration (Manage tab) groups all related actions. Tab switching is fast (no page navigation).

**Impact on implementation:** Two-tab layout matching existing `Favorites` page pattern. Manage tab renders URL, QR, settings, delete.

**Impact on future work:** Same two-tab pattern for all future categories.
