---
Feature: movies-and-shows
Doc type: tasks
Status: draft
Created: 2026-03-20
Last updated: 2026-03-20
Updated by: agent
Depends on: movies_and_shows_decisions.md
---

# Movies & Shows — Task Breakdown

Epic-level breakdown with subtasks, dependencies, execution order, and risk register.

---

## Execution Order Overview

```
Phase A: Documentation (D1-D7)
    ↓
Phase B: Strapi Setup (H1) — Handoff to user
    ↓
Phase C: Foundation (T1-T3) — TMDB service, stores, routes
    ↓
Phase D: Dashboard (T4-T8) — Sidebar, movies home, list view, add overlay, top picks
    ↓
Phase E: Public Page (T9-T13) — Carousel layout, poster cards, detail modal, genre pages
    ↓
Phase F: Polish & Test (T14-T16) — i18n, responsive QA, manual testing
```

---

## Phase A: Documentation

### D1 — Decisions Document
- **Status:** Done
- **Output:** `movies_and_shows_decisions.md`

### D2 — Tasks Document
- **Status:** Done (this document)
- **Output:** `movies_and_shows_tasks.md`

### D3 — PRD
- **Depends on:** D1, D2
- **Output:** `movies_and_shows_prd.md`
- **Subtasks:**
  - Write goal, context, scope
  - Define user stories (creator dashboard + visitor public page)
  - Define acceptance criteria
  - Summarize data model, API, business logic
  - List open questions

### D4 — Schema
- **Depends on:** D1
- **Output:** `movies_and_shows_schema.md`
- **Subtasks:**
  - Define `RecommendedMovie` collection fields, types, constraints
  - Define movie list collection fields (new or extended `RecommendationList`)
  - Define Movie_Category collection fields for Movies & Shows
  - Document relations between collections
  - Document field-level notes for Strapi admin creation

### D5 — API Contract
- **Depends on:** D4
- **Output:** `movies_and_shows_api_contract.md`
- **Subtasks:**
  - Define GraphQL queries (movie lists, movies by list, movie details, pinned movies, movies by genre)
  - Define GraphQL mutations (create/update/delete movie, create/update/delete list, toggle pin, reorder)
  - Define TMDB API calls (search, movie details, watch providers)
  - Document request/response shapes for all

### D6 — Flow
- **Depends on:** D3
- **Output:** `movies_and_shows_flow.md`
- **Subtasks:**
  - Creator flow: dashboard entry → create list → add movie → publish → share
  - Creator flow: manage top picks (pin, reorder, customize heading)
  - Visitor flow: browse carousels → tap poster → detail modal → tap list heading → grid page
  - Visitor flow: browse genres → genre page
  - Edge case flows: empty states, single item, single list

### D7 — Architecture
- **Depends on:** D4, D5
- **Output:** `movies_and_shows_architecture.md`
- **Subtasks:**
  - Component tree (new components, where they live in feature structure)
  - New routes and route structure
  - New Zustand stores (if any)
  - TMDB service module design
  - File/folder structure for new feature module
  - Integration points with existing code

### D8 — Integration (TMDB)
- **Depends on:** D5
- **Output:** `movies_and_shows_integration.md`
- **Subtasks:**
  - TMDB API authentication and setup
  - Endpoints used (search, details, watch providers, images)
  - Rate limits and error handling
  - Data mapping (TMDB response → Strapi entity)
  - Fallback behavior when TMDB is unavailable

### D9 — Testing
- **Depends on:** D3, D6
- **Output:** `movies_and_shows_testing.md`
- **Subtasks:**
  - Manual test scenarios (creator flows, visitor flows, edge cases)
  - Component test cases (if applicable)
  - Integration test cases (TMDB service)
  - Cross-browser/device testing matrix

---

## Phase B: Strapi Setup (Handoff)

### H1 — Create Strapi Collections
- **Depends on:** D4 (schema doc approved)
- **Owner:** User (TK)
- **Description:** User creates the Strapi collections, fields, and relations as documented in the schema doc.
- **Deliverable:** Strapi collections live and accessible via GraphQL
- **Verification:** Agent runs a test GraphQL query to confirm collections exist and fields are correct

---

## Phase C: Foundation

### T1 — TMDB Service Module
- **Depends on:** D8, H1
- **Description:** Create the TMDB API service module with search, detail fetch, watch providers, and image URL builders.
- **Subtasks:**
  - Create `src/services/tmdbService.ts`
  - Implement `searchMovies(query: string, page?: number)` — calls TMDB `/search/multi` (movies + TV)
  - Implement `getMovieDetails(tmdbId: number, mediaType: 'movie' | 'tv')` — calls TMDB `/movie/{id}` or `/tv/{id}`
  - Implement `getWatchProviders(tmdbId: number, mediaType: 'movie' | 'tv', region?: string)` — calls TMDB watch providers endpoint
  - Implement `getImageUrl(path: string, size: string)` — builds TMDB image CDN URL
  - Implement `getGenreList()` — fetches genre name/ID mapping
  - Add TypeScript interfaces for all TMDB response types
  - Add error handling and retry logic
  - Add `VITE_TMDB_API_KEY` to env config
- **Files to create:** `src/services/tmdbService.ts`, `src/types/tmdbTypes.ts`
- **Files to modify:** `src/config.ts` (add TMDB config), `.env.example`
- **Risk:** TMDB API response shape changes. Mitigated by typed interfaces and tests.

### T2 — GraphQL Queries & Mutations for Movies
- **Depends on:** H1 (Strapi collections must exist)
- **Description:** Write all GraphQL queries and mutations for the Movies feature.
- **Subtasks:**
  - Create `src/features/Movies/api/query.ts` — all read queries
  - Create `src/features/Movies/api/mutation.ts` — all write mutations
  - Queries: movieLists, moviesByList (paginated), movieDetails, pinnedMovies, moviesByGenre
  - Mutations: createMovieList, updateMovieList, deleteMovieList, createMovie, updateMovie, deleteMovie, togglePin, updatePinOrder
  - Add TypeScript types matching Strapi schema
- **Files to create:** `src/features/Movies/api/query.ts`, `src/features/Movies/api/mutation.ts`, `src/features/Movies/types/index.ts`
- **Risk:** GraphQL schema mismatch with Strapi. Mitigated by testing queries against live Strapi after H1.

### T3 — Routes & Feature Module Structure
- **Depends on:** D7
- **Description:** Set up the Movies feature module folder structure and routing.
- **Subtasks:**
  - Create feature directory: `src/features/Movies/`
  - Create subdirectories: `components/`, `hooks/`, `api/`, `types/`, `utils/`
  - Add protected routes for dashboard:
    - `/recommendations/movies` — Movies home
    - `/recommendations/movies/:listId` — Inside a movie list
    - `/recommendations/movies/:listId/new-movie` — Add movie overlay
    - `/recommendations/movies/:listId/:movieId/edit` — Edit movie overlay
    - `/recommendations/movies/top-picks` — Top Picks manager
  - Add public routes:
    - `/:username/movies` — Public movies page
    - `/:username/movies/:listSlug` — Public list grid page
    - `/:username/movies/genre/:genreSlug` — Public genre grid page
  - Integrate with existing route structure in `src/routes/`
- **Files to create:** `src/features/Movies/index.ts`, route entries
- **Files to modify:** `src/routes/ProtectedRoutes.tsx`, `src/routes/PublicRoutes.tsx`
- **Risk:** Route conflicts with existing patterns. Mitigated by using `/movies` namespace.

---

## Phase D: Dashboard

### T4 — Dashboard Sidebar (Desktop) & Category Cards (Mobile)
- **Depends on:** T3
- **Description:** Add the category navigation layer to the dashboard.
- **Subtasks:**
  - Create sidebar component for desktop (vertical nav with category icons)
  - Sidebar items: Places (links to existing `/recommendations`), Movies & Shows (links to `/recommendations/movies`)
  - Create category cards grid for mobile (category card components)
  - Add responsive breakpoint logic (sidebar at `md:` and above, cards below)
  - Ensure existing Places dashboard is fully accessible and unchanged
  - Active state highlighting on sidebar for current category
- **Files to create:** `src/components/DashboardSidebar.tsx`, `src/components/CategoryCards.tsx`
- **Files to modify:** `src/pages/Favorites.tsx` (or layout wrapper), dashboard layout component
- **Risk:** Breaking existing Places dashboard layout. Mitigated by keeping Places as the default view and adding the sidebar as a wrapper.

### T5 — Movies Home View
- **Depends on:** T2, T4
- **Description:** The Movies landing page inside the dashboard showing all movie lists and Top Picks strip.
- **Subtasks:**
  - Create `MoviesHome.tsx` component
  - Fetch all movie lists for the current user
  - Display lists as cards with: name, movie count, publish toggle, pin count, "Open →" link
  - Publish toggle on each list card (inline switch)
  - Top Picks strip at the top (horizontal scroll of pinned movie posters with "Manage" link)
  - "+ New List" button opening create list modal
  - Empty state for no lists
  - Create list modal: name, description, optional cover image, auto-generated slug
- **Files to create:** `src/features/Movies/components/MoviesHome.tsx`, `src/features/Movies/components/CreateMovieListModal.tsx`
- **Dependencies:** T2 (GraphQL queries for lists)

### T6 — Movie List View (Inside a List)
- **Depends on:** T5
- **Description:** The view inside a specific movie list showing all movies with management controls.
- **Subtasks:**
  - Create `MovieListView.tsx` component
  - Two tabs: Recommendations | Manage
  - **Recommendations tab:**
    - List/table rows with: poster thumbnail, title, year, genre tags, TMDB rating, personal note preview
    - Pin toggle (⭐) on each row
    - ⋮ menu per row: Edit, Delete, Move to another list
    - Drag handles (≡) for reordering
    - Sort presets dropdown: Custom, Rating (high-low), Year (newest), Recently added
    - Publish toggle at the top
    - "+ Add Movie" button → navigates to add overlay
    - Suggestions row at bottom: trending movies from TMDB
    - Pagination / infinite scroll
    - Empty state
  - **Manage tab:**
    - Shareable URL display with copy button
    - QR code generation (reuse existing `qrcode.react` pattern)
    - List settings: edit name, description, cover image, slug
    - Public page order (drag to reorder among published lists)
    - Delete list with confirmation modal
- **Files to create:** `src/features/Movies/components/MovieListView.tsx`, `src/features/Movies/components/MovieRow.tsx`, `src/features/Movies/components/MovieListManage.tsx`
- **Dependencies:** T2 (queries/mutations), T5 (navigation context)

### T7 — Add Movie Overlay
- **Depends on:** T1, T6
- **Description:** Full-page overlay for searching and adding a movie to a list.
- **Subtasks:**
  - Create `AddMovie.tsx` page component (route: `/:listId/new-movie`)
  - **Step 1 — Search:**
    - TMDB search input with debounced API calls
    - Search results with: poster thumbnail, title, year, director/creator, genres, rating, runtime
    - "Select" button on each result
    - Differentiate movie vs TV show results
  - **Step 2 — Details form (after selection):**
    - Auto-filled movie info card: large poster, title, year, rating, genres, director, runtime
    - "Change Selection" link to go back to search
    - Personal note field (optional, rich text or plain textarea)
    - Where to Watch section: auto-populated from TMDB watch providers, toggleable platform chips
    - "Add to Top Picks" checkbox
    - Media upload section: upload from device, Google Images search (reuse existing pattern)
    - "Cancel" and "Add to List" buttons
  - Form validation (Formik + Yup matching existing patterns)
  - Submit flow: create movie entity in Strapi, upload media, update list, navigate back
  - "← Back to [list name]" navigation
  - Reuse `EditMovie.tsx` with pre-filled data for edit route (`/:listId/:movieId/edit`)
- **Files to create:** `src/features/Movies/components/AddMovie.tsx`, `src/features/Movies/components/TMDBSearch.tsx`, `src/features/Movies/components/WatchProviders.tsx`
- **Dependencies:** T1 (TMDB service), T2 (mutations), T6 (navigation context)
- **Risk:** TMDB search latency affecting UX. Mitigated by debouncing (300ms) and showing loading skeletons.

### T8 — Top Picks Manager
- **Depends on:** T6
- **Description:** Dedicated view for managing pinned movie recommendations.
- **Subtasks:**
  - Create `TopPicksManager.tsx` component
  - Customizable display name field ("What should this section be called on your public page?")
  - Drag-to-reorder list of all pinned movies
  - Each item shows: poster thumbnail, title, source list name, remove button (×)
  - Counter: "4/15 picks used"
  - "Add from your lists" button → picker showing all movies with checkboxes
  - Save order mutation
- **Files to create:** `src/features/Movies/components/TopPicksManager.tsx`
- **Dependencies:** T2 (queries for pinned movies, reorder mutation), T6 (accessible from list view)

---

## Phase E: Public Page

### T9 — Public Movies Page (Carousel Layout)
- **Depends on:** T2, T3
- **Description:** The main public-facing movies page with horizontal carousel rows.
- **Subtasks:**
  - Create `PublicMovies.tsx` page component
  - Minimal header: "[Creator]'s Movies · [count] movies"
  - Top Picks carousel row (first, if pinned items exist)
  - Per-list carousel rows (published lists in creator-defined order)
  - Each row: list name heading with ">" arrow, movie count, horizontal scrollable poster cards
  - Genre browse section at the bottom (2-col mobile, 4-col desktop grid of genre cards)
  - Genre cards: backdrop image, genre name, movie count
  - Share button in header
  - Empty state (creator has no published movies)
  - Lazy loading per carousel row
  - SEO meta tags (title, description, OG image)
- **Files to create:** `src/features/Movies/components/PublicMovies.tsx`, `src/features/Movies/components/MovieCarouselRow.tsx`, `src/features/Movies/components/GenreBrowse.tsx`
- **Dependencies:** T2 (public queries for movie data)

### T10 — Poster Card Component
- **Depends on:** None (can be built standalone)
- **Description:** The movie poster card used in carousels and grids.
- **Subtasks:**
  - Create `MoviePosterCard.tsx` component
  - Full poster image (2:3 aspect ratio) with object-cover
  - Rating badge overlay (bottom-right, semi-transparent dark pill, star + rating number)
  - "Series" badge overlay (top-left, only for TV shows)
  - Title text below poster (one line, truncated)
  - Hover scale animation (1.05x on desktop)
  - Click handler (opens detail modal or navigates)
  - Fallback image when poster is unavailable
  - Lazy image loading
  - Skeleton loading state
- **Files to create:** `src/features/Movies/components/MoviePosterCard.tsx`, `src/features/Movies/components/MoviePosterSkeleton.tsx`

### T11 — Movie Detail Modal
- **Depends on:** T10
- **Description:** Slide-up modal showing movie details when a poster is tapped on the public page.
- **Subtasks:**
  - Create `MovieDetailModal.tsx` component
  - Drag bar at top for swipe-to-close (reuse existing PlaceOverview swipe pattern)
  - Close button (×)
  - Large poster image
  - Movie metadata: title, year, rating, genres, director, runtime
  - "Series" indicator for TV shows (with season count)
  - Creator's note section (visually differentiated — subtle background or quote styling)
  - Where to Watch: streaming platform badges with deep links (tappable)
  - Creator's photos (horizontal scroll thumbnails, if any uploaded)
  - "From the list: [list name] →" link
  - Share button
  - Swipe-down-to-dismiss (threshold: 100px, matching existing pattern)
  - Desktop: could render as side panel (40% width) — confirm during implementation
- **Files to create:** `src/features/Movies/components/MovieDetailModal.tsx`
- **Dependencies:** T10 (poster card triggers modal)

### T12 — Public List Grid Page
- **Depends on:** T9, T10
- **Description:** Full poster grid page when visitor taps a list heading.
- **Subtasks:**
  - Create `PublicMovieList.tsx` page component
  - Route: `/:username/movies/:listSlug`
  - "← [Creator]'s Movies" back navigation
  - List name as heading
  - List description below heading
  - Movie count
  - 3-column poster grid (mobile), 5-6 column (desktop)
  - Infinite scroll or pagination
  - Tapping a poster opens the detail modal (T11)
  - SEO meta tags
- **Files to create:** `src/features/Movies/components/PublicMovieList.tsx`
- **Dependencies:** T10 (poster card), T11 (detail modal)

### T13 — Public Genre Page
- **Depends on:** T9, T10
- **Description:** Genre page showing all movies of a genre across all lists.
- **Subtasks:**
  - Create `PublicMovieGenre.tsx` page component
  - Route: `/:username/movies/genre/:genreSlug`
  - "← [Creator]'s Movies" back navigation
  - Genre name as heading
  - Movie count
  - 3-column poster grid (mobile), 5-6 column (desktop)
  - Aggregates movies across all published lists matching the genre
  - Infinite scroll or pagination
  - Tapping a poster opens the detail modal (T11)
  - SEO meta tags
- **Files to create:** `src/features/Movies/components/PublicMovieGenre.tsx`
- **Dependencies:** T10, T11

---

## Phase F: Polish & Testing

### T14 — Internationalization (i18n)
- **Depends on:** T4-T13
- **Description:** Add translation keys for all new UI text.
- **Subtasks:**
  - Add translation keys under `dashboard.movies.*` namespace
  - Cover: sidebar labels, list management, add flow, publish states, empty states, error messages
  - Add public page translation keys under `public.movies.*`
  - Test with at least one non-English locale (if i18n is actively used)
- **Files to modify:** `src/i18n/` locale files

### T15 — Responsive QA & Polish
- **Depends on:** T4-T13
- **Description:** Cross-device testing and visual polish.
- **Subtasks:**
  - Test dashboard sidebar at desktop breakpoint (≥768px)
  - Test category cards at mobile breakpoint (<768px)
  - Test carousel scroll behavior (touch on mobile, mouse on desktop)
  - Test poster card scaling and badge placement at various sizes
  - Test detail modal swipe-to-close on mobile
  - Test add overlay form on mobile (keyboard handling, scroll)
  - Verify no regressions in existing Places dashboard
  - Check loading skeletons and empty states

### T16 — Manual Testing & Bug Fixes
- **Depends on:** T15
- **Description:** End-to-end manual testing of all flows.
- **Subtasks:**
  - Execute all test scenarios from `movies_and_shows_testing.md`
  - Creator flow: create list → add movies → pin top picks → reorder → publish → share
  - Visitor flow: browse carousels → tap poster → modal → tap list → grid → tap genre → genre page
  - Edge cases: empty lists, single movie, 15+ movies in a list, very long list names, very long notes
  - Fix bugs discovered during testing
  - Final visual QA pass

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| TMDB API response shape changes | Low | Medium | Typed interfaces, integration tests, version-pin API |
| TMDB rate limiting during heavy use | Low | Low | Debounce search (300ms), cache results in session |
| Strapi schema mismatch with frontend queries | Medium | High | Schema doc reviewed before creation, test queries after H1 |
| Existing Places dashboard regression | Medium | High | Sidebar is additive (wrapper), Places code untouched, manual QA |
| Carousel performance with many lists/movies | Low | Medium | Lazy load per row, image lazy loading, pagination |
| Poster image loading slow (TMDB CDN) | Low | Low | Use appropriate TMDB image sizes (w342 for cards, w500 for detail) |
| Deep links to streaming services break | Medium | Low | Links are informational, not critical. Show platform name even if link fails |

---

## Dependency Graph

```
D1 (Decisions) ──→ D3 (PRD)
       │              │
       ├──→ D4 (Schema) ──→ D5 (API Contract) ──→ D7 (Architecture)
       │                          │                       │
       │                          ├──→ D8 (Integration)   │
       │                          │                       │
       │              D6 (Flow) ←─┘                       │
       │                                                  │
       └──→ D9 (Testing)                                  │
                                                          │
H1 (Strapi Setup) ←── D4                                 │
       │                                                  │
       ├──→ T1 (TMDB Service) ←── D8                     │
       │         │                                        │
       ├──→ T2 (GraphQL) ←── D5                          │
       │         │                                        │
       └──→ T3 (Routes) ←── D7 ──────────────────────────┘
                 │
                 ├──→ T4 (Sidebar/Cards)
                 │         │
                 │         ├──→ T5 (Movies Home)
                 │         │         │
                 │         │         ├──→ T6 (List View)
                 │         │         │         │
                 │         │         │         ├──→ T7 (Add Overlay) ←── T1
                 │         │         │         │
                 │         │         │         └──→ T8 (Top Picks)
                 │         │         │
                 │    T10 (Poster Card)
                 │         │
                 ├──→ T9 (Public Movies) ←── T10
                 │         │
                 │         ├──→ T11 (Detail Modal)
                 │         │
                 │         ├──→ T12 (List Grid Page)
                 │         │
                 │         └──→ T13 (Genre Page)
                 │
                 └──→ T14 (i18n) → T15 (Responsive QA) → T16 (Manual Testing)
```

---

## Estimation Summary

| Phase | Tasks | Estimated Effort |
|---|---|---|
| A: Documentation | D1-D9 | 1-2 days |
| B: Strapi Setup | H1 | 0.5 day (user) |
| C: Foundation | T1-T3 | 2-3 days |
| D: Dashboard | T4-T8 | 5-7 days |
| E: Public Page | T9-T13 | 4-5 days |
| F: Polish & Test | T14-T16 | 2-3 days |
| **Total** | | **~15-20 days** |
