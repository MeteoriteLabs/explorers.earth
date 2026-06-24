---
Feature: games
Doc type: tasks
Status: draft
Created: 2026-03-26
Last updated: 2026-03-26
Updated by: agent
Depends on: games_decisions.md
---

# Games — Task Breakdown

Epic-level breakdown with subtasks, dependencies, execution order, and risk register.

---

## Execution Order Overview

```
Phase A: Documentation (D1-D9)
    ↓
Phase B: Strapi Setup (H1) — Handoff to user
    ↓
Phase B2: Strapi Proxy Setup (H2) — Handoff to user/agent
    ↓
Phase C: Foundation (T1-T3) — IGDB service, GraphQL, routes
    ↓
Phase D: Dashboard (T4-T8) — Sidebar, games home, list view, add overlay, top picks
    ↓
Phase E: Public Page (T9-T13) — Carousel layout, cover cards, detail modal, genre pages
    ↓
Phase F: Polish & Test (T14-T16) — i18n, responsive QA, manual testing
```

---

## Phase A: Documentation

### D1 — Decisions Document
- **Status:** Done
- **Output:** `games_decisions.md`

### D2 — Tasks Document
- **Status:** Done (this document)
- **Output:** `games_tasks.md`

### D3 — PRD
- **Depends on:** D1, D2
- **Output:** `games_prd.md`
- **Subtasks:**
  - Write goal, context, scope
  - Define user stories (creator dashboard + visitor public page)
  - Define acceptance criteria
  - Summarize data model, API, business logic
  - List open questions

### D4 — Schema
- **Depends on:** D1
- **Output:** `games_schema.md`
- **Subtasks:**
  - Define `RecommendedGame` collection fields, types, constraints
  - Define `GameList` collection fields
  - Define `Game_Category` collection
  - Document relations between collections
  - Document field-level notes for Strapi admin creation

### D5 — API Contract
- **Depends on:** D4
- **Output:** `games_api_contract.md`
- **Subtasks:**
  - Define GraphQL queries (game lists, games by list, game details, pinned games, games by genre)
  - Define GraphQL mutations (CRUD for lists and games, pin toggle, reorder)
  - Define IGDB API calls (search games, game details via Strapi proxy)
  - Document request/response shapes for all

### D6 — Flow
- **Depends on:** D3
- **Output:** `games_flow.md`
- **Subtasks:**
  - Creator flow: dashboard entry → create list → add game → publish → share
  - Creator flow: manage top picks (pin, reorder, customize heading)
  - Visitor flow: browse carousels → tap cover → detail modal → tap list heading → grid page
  - Visitor flow: browse genres → genre page
  - Edge case flows: empty states, single item, missing cover, many platforms, no IGDB rating

### D7 — Architecture
- **Depends on:** D4, D5
- **Output:** `games_architecture.md`
- **Subtasks:**
  - Component tree (new components, where they live in feature structure)
  - New routes and route structure
  - IGDB service module design (proxy-based)
  - File/folder structure for Games feature module
  - Integration points with existing code

### D8 — Integration (IGDB)
- **Depends on:** D5
- **Output:** `games_integration.md`
- **Subtasks:**
  - IGDB + Twitch authentication (client_credentials flow)
  - Strapi proxy architecture
  - Apicalypse query language examples
  - Rate limits and error handling
  - Data mapping (IGDB response → Strapi entity)
  - Image URL construction
  - Token caching strategy
  - Failure modes and resilience

### D9 — Testing
- **Depends on:** D3, D6
- **Output:** `games_testing.md`
- **Subtasks:**
  - Manual test scenarios (creator flows, visitor flows, edge cases)
  - Component test cases
  - Integration test cases (IGDB proxy service)
  - Cross-browser/device testing matrix

---

## Phase B: Strapi Setup (Handoff)

### H1 — Create Strapi Collections
- **Depends on:** D4 (schema doc approved)
- **Owner:** User (TK)
- **Description:** User creates the three Strapi collections as documented in `games_schema.md`:
  1. `GameList` — with all fields and account relation
  2. `RecommendedGame` — with all metadata fields and game_list relation
  3. `Game_Category` — with genre_name and game relation
- **Deliverable:** Strapi collections live and accessible via GraphQL
- **Verification:** Agent runs a test GraphQL query to confirm collections exist and fields are correct
- **API Permissions to set:**
  - `GameList`: authenticated (CRUD), public (find, findOne)
  - `RecommendedGame`: authenticated (CRUD), public (find, findOne)
  - `Game_Category`: authenticated (CRUD), public (find, findOne)

---

## Phase B2: Strapi Proxy Setup (Handoff / Agent)

### H2 — Create IGDB Proxy in Strapi
- **Depends on:** D8 (integration doc)
- **Owner:** Agent (with user deploying Strapi)
- **Description:** Create a custom Strapi controller and routes to proxy IGDB API calls. This is the critical difference from Books/Movies — IGDB secrets must stay server-side.
- **Subtasks:**
  - Create `src/api/igdb-proxy/` directory in Strapi project
  - Create `controllers/igdb-proxy.js` with `search` and `getGame` methods
  - Implement Twitch token acquisition and caching logic
  - Create `routes/igdb-proxy.js` with GET route definitions
  - Add `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` to Strapi `.env`
  - Test proxy: `GET /api/igdb-proxy/search?q=elden+ring` returns IGDB results
  - Test proxy: `GET /api/igdb-proxy/game/1877` returns The Witcher 3 details
  - Set route authentication (require valid user JWT for search routes)
- **Files to create (Strapi):**
  - `src/api/igdb-proxy/controllers/igdb-proxy.js`
  - `src/api/igdb-proxy/routes/igdb-proxy.js`
- **Risk:** Twitch token management complexity. Mitigated by simple in-memory cache solution.

---

## Phase C: Foundation

### T1 — IGDB Service Module (Frontend)
- **Depends on:** D8, H2 (proxy must be working)
- **Description:** Create the IGDB API service module that calls the Strapi proxy.
- **Subtasks:**
  - Create `src/services/igdbService.ts`
  - Implement `searchGames(query, options?)` — calls Strapi proxy `/search`
  - Implement `getGameDetails(igdbId)` — calls Strapi proxy `/game/{id}`
  - Implement `getCoverUrl(imageId, size?)` — builds Twitch CDN cover URL
  - Implement `getScreenshotUrl(imageId, size?)` — builds Twitch CDN screenshot URL
  - Implement `formatIgdbRating(rating)` — formats 0-100 as "x.x/10"
  - Implement `shortenPlatform(name)` — abbreviates long platform names
  - Implement `extractDeveloper(involvedCompanies)` — find developer company
  - Implement `extractPublisher(involvedCompanies)` — find publisher company
  - Implement `igdbTimestampToDateString(timestamp)` — Unix → ISO date
  - Implement `igdbTimestampToYear(timestamp)` — Unix → year string
  - Implement `transformIgdbResult(item)` — map proxy response to Strapi-ready object
  - Add TypeScript interfaces for all IGDB response types
  - Add `IgdbError` class
  - Add debounce + retry logic
  - Add `VITE_IGDB_PROXY_URL` to env config
- **Files to create:** `src/services/igdbService.ts`, `src/types/igdbTypes.ts`
- **Files to modify:** `src/config.ts` (add IGDB_CONFIG), `.env.example`
- **Risk:** Proxy is a new pattern. Mitigated by thorough integration doc and test in H2.

### T2 — GraphQL Queries & Mutations for Games
- **Depends on:** H1 (Strapi collections must exist)
- **Description:** Write all GraphQL queries and mutations for the Games feature.
- **Subtasks:**
  - Create `src/features/Games/api/query.ts` — all read queries
  - Create `src/features/Games/api/mutation.ts` — all write mutations
  - Queries: gameListsByAccount, gamesByList, gameDetails, pinnedGames, gamesByGenre, gameListBySlug, publicGameData
  - Mutations: createGameList, updateGameList, deleteGameList, createRecommendedGame, updateRecommendedGame, deleteRecommendedGame
  - Add TypeScript types matching Strapi schema
- **Files to create:** `src/features/Games/api/query.ts`, `src/features/Games/api/mutation.ts`, `src/features/Games/types/index.ts`
- **Risk:** GraphQL schema mismatch with Strapi. Mitigated by testing queries after H1.

### T3 — Routes & Feature Module Structure
- **Depends on:** D7
- **Description:** Set up the Games feature module folder structure and routing.
- **Subtasks:**
  - Create feature directory: `src/features/Games/`
  - Create subdirectories: `components/dashboard/`, `components/public/`, `hooks/`, `api/`, `types/`, `utils/`
  - Add protected routes:
    - `/recommendations/games` — Games home
    - `/recommendations/games/:listId` — Inside a game list
    - `/recommendations/games/:listId/new-game` — Add game overlay
    - `/recommendations/games/:listId/:gameId/edit` — Edit game overlay
    - `/recommendations/games/top-picks` — Top Picks manager
  - Add public routes:
    - `/:username/games` — Public games page
    - `/:username/games/:listSlug` — Public list grid page
    - `/:username/games/genre/:genreSlug` — Public genre grid page
  - **Update shared components:**
    - `DashboardSidebar.tsx`: Add Games item, widen type
    - `CategoryCards.tsx`: Add Games card, widen type
    - `DashboardLayout.tsx`: Widen currentCategory type
- **Files to create:** `src/features/Games/index.ts`
- **Files to modify:** `src/routes/ProtectedRoutes.tsx`, `src/routes/PublicRoutes.tsx`, `src/components/DashboardSidebar.tsx`, `src/components/CategoryCards.tsx`, `src/components/DashboardLayout.tsx`

---

## Phase D: Dashboard

### T4 — Dashboard Sidebar & Category Cards Update
- **Depends on:** T3
- **Description:** Add Games as a fourth category in the shared navigation components.
- **Subtasks:**
  - Add Games icon (`Gamepad2` from lucide-react) to sidebar items list
  - Add Games category card to mobile category cards grid
  - Update active state logic for `/recommendations/games/*` routes
  - Ensure Places, Movies & Shows, and Books remain fully functional
- **Files to modify:** `src/components/DashboardSidebar.tsx`, `src/components/CategoryCards.tsx`
- **Risk:** Breaking existing sidebar state. Mitigated by additive-only pattern.

### T5 — Games Home View
- **Depends on:** T2, T4
- **Description:** The Games landing page in the dashboard showing all game lists and Top Picks strip.
- **Subtasks:**
  - Create `GamesHome.tsx` component
  - Fetch all game lists for the current user (useGameLists hook)
  - Display lists as cards: name, game count, publish toggle, pin count, "Open →" link
  - Top Picks strip at top: horizontal scroll of pinned game covers with "Manage" link
  - "+ New List" button opening create list modal
  - Empty state for no lists (with first-list CTA)
  - Create list modal: name, description, optional cover, auto-generated slug
  - Slug auto-generation from list name (reuse slugify utility from Movies/Books)
- **Files to create:** `src/features/Games/components/dashboard/GamesHome.tsx`, `src/features/Games/components/dashboard/CreateGameListModal.tsx`

### T6 — Game List View (Inside a List)
- **Depends on:** T5
- **Description:** The view inside a specific game list showing all games with management controls.
- **Subtasks:**
  - Create `GameListView.tsx` component
  - Two tabs: Recommendations | Manage
  - **Recommendations tab:**
    - Game rows with: cover art, title, year, platforms chips, genres, IGDB rating, user rating, note preview
    - Pin toggle (⭐) per row
    - ⋮ menu per row: Edit, Delete, Move to another list
    - Drag handles (≡) for reordering (dnd-kit, same as Movies & Books)
    - Sort presets dropdown: Custom, Rating, Year, Recently added
    - "+ Add Game" button → navigates to add overlay
    - Empty state
  - **Manage tab:**
    - Shareable URL display with copy button
    - QR code (reuse existing `qrcode.react` pattern)
    - List settings: edit name, description, cover, slug
    - Delete list with confirmation modal
- **Files to create:** `GameListView.tsx`, `GameRow.tsx`, `GameListManage.tsx`

### T7 — Add Game Overlay
- **Depends on:** T1, T6
- **Description:** Full-page overlay for searching and adding a game to a list.
- **Subtasks:**
  - Create `AddGamePage.tsx` page component (routes: `new-game` + `/:gameId/edit`)
  - Search:
    - IGDB search input via Strapi proxy (debounced 300ms)
    - Results: cover art, title, release year, developer, platforms chips, genres, IGDB rating
    - "Select" button on each result
  - Details form (after selection):
    - Auto-filled info: large cover, title, year, platforms, genres, game modes, developer, publisher, rating, summary
    - "Change Selection" link to go back to search
    - Personal note (optional, Tiptap rich text — reuse same TiptapEditor as Movies & Books)
    - User rating (1-10 stars — reuse same star component)
    - Media upload: photos from device (S3 upload, reuse existing pattern)
    - "Add to Top Picks" checkbox
    - "Cancel" and "Add to List" buttons
  - Form validation (Formik + Yup — same as Movies & Books)
  - Submit flow: createRecommendedGame mutation → upload media → navigate back
  - Edit mode: pre-fill form from existing game data
- **Files to create:** `AddGamePage.tsx`, `IgdbSearch.tsx`
- **Risk:** Proxy latency may be higher than direct API calls. Mitigated by debounce and loading states.

### T8 — Top Picks Manager
- **Depends on:** T6
- **Description:** Dedicated view for managing pinned game recommendations.
- **Subtasks:**
  - Create `TopPicksManager.tsx` component
  - Customizable display name field
  - Drag-to-reorder list of all pinned games (dnd-kit)
  - Each item: cover art, title, release year, platforms chips, source list name, remove (×) button
  - Counter: "4/15 picks used"
  - "Add from your lists" button → picker showing all games with checkboxes
  - Save order mutation (reorderPinnedGames)
- **Files to create:** `TopPicksManager.tsx`

---

## Phase E: Public Page

### T9 — Public Games Page (Carousel Layout)
- **Depends on:** T2, T3
- **Description:** The main public-facing games page with horizontal carousel rows.
- **Subtasks:**
  - Create `PublicGames.tsx` page component
  - Header: "[Creator]'s Games · [count] games"
  - Top Picks carousel row (first, if pinned items exist)
  - Per-list carousel rows (published lists in creator-defined order)
  - Each row: list name heading with ">" arrow, game count, horizontal scrollable cover cards
  - Genre browse section at the bottom (2-col mobile, 4-col desktop)
  - Genre cards: game cover art as background, genre name, game count
  - Empty state (no published games)
  - Lazy loading per carousel row
  - SEO meta tags
  - "Game data provided by IGDB" attribution
- **Files to create:** `PublicGames.tsx`, `GameCarouselRow.tsx`, `GenreBrowse.tsx`

### T10 — Cover Card Component
- **Depends on:** None (can be built standalone)
- **Description:** The game cover card used in carousels and grids.
- **Subtasks:**
  - Create `GameCoverCard.tsx` component
  - Full cover art image (3:4 portrait aspect ratio) with object-cover
  - Rating badge overlay (bottom-right, semi-transparent dark pill, star + rating)
    - Prefer `user_rating` if available, else `igdb_rating / 10`
  - Title text below cover (one line, truncated)
  - Platform chips below title (max 3, truncated with "+N more")
  - Hover scale animation (1.05x on desktop)
  - Click handler (opens detail modal)
  - Fallback image when cover art unavailable (generic game controller placeholder)
  - Lazy image loading
  - Skeleton loading state (`GameCoverSkeleton.tsx`)
- **Files to create:** `GameCoverCard.tsx`, `GameCoverSkeleton.tsx`

### T11 — Game Detail Modal
- **Depends on:** T10
- **Description:** Slide-up modal showing game details when a cover is tapped on the public page.
- **Subtasks:**
  - Create `GameDetailModal.tsx` component
  - Drag bar at top for swipe-to-close (reuse PlaceOverview / MovieDetailModal / BookDetailModal pattern)
  - Close button (×)
  - Large cover art image
  - Game metadata: title, release year, platforms (all chips), developer, publisher, genres, game modes
  - IGDB rating display (x.x/10, if available)
  - Creator's rating (1-10 glowing yellow stars — same as MovieDetailModal & BookDetailModal)
  - Creator's note section (Tiptap formatted)
  - Screenshots section (horizontal scroll from IGDB screenshot_ids)
  - Creator's photos (horizontal scroll thumbnails, if any uploaded)
  - IGDB link (small, subtle secondary link)
  - "From the list: [list name] →" link
  - Share button
  - Swipe-down-to-dismiss (threshold: 100px, same as existing modals)
- **Files to create:** `GameDetailModal.tsx`

### T12 — Public List Grid Page
- **Depends on:** T9, T10
- **Description:** Full cover grid page when visitor taps a list heading.
- **Subtasks:**
  - Create `PublicGameList.tsx` page component
  - Route: `/:username/games/:listSlug`
  - "← [Creator]'s Games" back navigation
  - List name as heading
  - List description below heading
  - Game count
  - 3-column cover grid (mobile), 5-6 column (desktop)
  - Tapping a cover opens the detail modal (T11)
  - SEO meta tags
- **Files to create:** `PublicGameList.tsx`

### T13 — Public Genre Page
- **Depends on:** T9, T10
- **Description:** Genre page showing all games of a genre across all lists.
- **Subtasks:**
  - Create `PublicGameGenre.tsx` page component
  - Route: `/:username/games/genre/:genreSlug`
  - Genre slug ↔ name conversion using `genreUtils.ts`
  - "← [Creator]'s Games" back navigation
  - Genre name as heading
  - Game count
  - 3-column cover grid (mobile), 5-6 column (desktop)
  - Aggregates games across all published lists matching the genre
  - Deduplicate by `igdb_id`
  - Tapping a cover opens the detail modal (T11)
  - SEO meta tags
- **Files to create:** `PublicGameGenre.tsx`

---

## Phase F: Polish & Testing

### T14 — Internationalization (i18n)
- **Depends on:** T4-T13
- **Description:** Add translation keys for all new UI text.
- **Subtasks:**
  - Add translation keys under `games.*` namespace (dashboard + public)
  - Keys: sidebar label, list management, add flow, top picks, empty states, error messages
  - Test with at least one non-English locale if i18n is actively used
- **Files to modify:** `src/i18n/` locale files

### T15 — Responsive QA & Polish
- **Depends on:** T4-T13
- **Subtasks:**
  - Test sidebar Games item at desktop breakpoint (≥768px)
  - Test Games category card at mobile breakpoint (<768px)
  - Test carousel scroll behavior (touch on mobile, mouse on desktop)
  - Test cover card scaling and badge placement at various sizes
  - Test platform chips overflow (+N more logic)
  - Test detail modal swipe-to-close on mobile
  - Test add overlay form on mobile (keyboard, scroll, proxy latency)
  - Verify no regressions in Places, Movies & Shows, or Books dashboards
  - Check IGDB attribution placement

### T16 — Manual Testing & Bug Fixes
- **Depends on:** T15
- **Description:** End-to-end manual testing of all flows.
- **Subtasks:**
  - Execute all test scenarios from `games_testing.md`
  - Creator flow: create list → add games → pin top picks → reorder → publish → share
  - Visitor flow: browse carousels → tap cover → modal → tap list → grid → tap genre → genre page
  - Edge cases: empty lists, single game, no cover art, many platforms, missing IGDB rating, proxy down
  - Fix bugs discovered during testing
  - Final visual QA pass

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Strapi proxy complexity vs Books/Movies | Medium | High | Comprehensive integration doc, test H2 before T1 |
| Twitch token expiry during active session | Low | Medium | Token caching with auto-refresh in Strapi proxy controller |
| IGDB cover art unavailable for obscure games | Medium | Medium | Fallback generic game controller placeholder |
| IGDB API response shape changes | Low | Medium | Typed interfaces, integration tests |
| Strapi proxy adding latency to search | Medium | Low | Debounce reduces calls; loading state shown; proxy is on same domain |
| Strapi schema mismatch with frontend queries | Medium | High | Schema doc reviewed before creation, test queries after H1 |
| Existing Places/Movies/Books regression | Low | High | Sidebar is additive (type widening only), existing code untouched, manual QA |
| Platform list too long for compact card display | High | Low | "+N more" chip pattern, full list in detail modal |
| IGDB rating `null` for many games | High | Low | Show nothing (no badge) if no rating; no fallback to "N/A" |
| Genre slug colliding with list slug in routes | Low | Medium | Genre page uses `/genre/:slug` namespace, never conflicts with `/:listSlug` |

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
H1 (Strapi Collections) ←── D4                           │
       │                                                  │
H2 (Strapi Proxy) ←── D8                                 │
       │                                                  │
       ├──→ T1 (IGDB Service) ←── D8, H2                 │
       │         │                                        │
       ├──→ T2 (GraphQL) ←── D5, H1                      │
       │         │                                        │
       └──→ T3 (Routes + Sidebar) ←── D7 ────────────────┘
                 │
                 ├──→ T4 (Sidebar/Cards update)
                 │         │
                 │         ├──→ T5 (Games Home)
                 │         │         │
                 │         │         ├──→ T6 (List View)
                 │         │         │         │
                 │         │         │         ├──→ T7 (Add Overlay) ←── T1
                 │         │         │         │
                 │         │         │         └──→ T8 (Top Picks)
                 │         │         │
                 │    T10 (Cover Card)
                 │         │
                 ├──→ T9 (Public Games) ←── T10
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
| B2: Proxy Setup | H2 | 0.5-1 day (agent + user deploy) |
| C: Foundation | T1-T3 | 2-3 days |
| D: Dashboard | T4-T8 | 4-6 days |
| E: Public Page | T9-T13 | 3-5 days |
| F: Polish & Test | T14-T16 | 1-2 days |
| **Total** | | **~12-19 days** |

> **Note:** Similar effort to Books (~12-18 days) because:
> - Sidebar/category cards pattern already exists (additive update only)
> - Carousel row, cover card patterns are reused/adapted from Movies & Books
> - Modal slide-up, Tiptap editor, star rating, dnd-kit reorder — all reused
> - Main new work: Strapi proxy (H2 + T1), IGDB-specific components, genre browsing
> - The proxy adds ~0.5-1 day of backend Strapi work compared to Books
