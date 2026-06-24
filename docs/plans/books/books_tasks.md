---
Feature: books
Doc type: tasks
Status: draft
Created: 2026-03-25
Last updated: 2026-03-25
Updated by: agent
Depends on: books_decisions.md
---

# Books — Task Breakdown

Epic-level breakdown with subtasks, dependencies, execution order, and risk register.

---

## Execution Order Overview

```
Phase A: Documentation (D1-D9)
    ↓
Phase B: Strapi Setup (H1) — Handoff to user
    ↓
Phase C: Foundation (T1-T3) — Google Books service, GraphQL, routes
    ↓
Phase D: Dashboard (T4-T8) — Sidebar, books home, list view, add overlay, top reads
    ↓
Phase E: Public Page (T9-T13) — Carousel layout, cover cards, detail modal, subject pages
    ↓
Phase F: Polish & Test (T14-T16) — i18n, responsive QA, manual testing
```

---

## Phase A: Documentation

### D1 — Decisions Document
- **Status:** Done
- **Output:** `books_decisions.md`

### D2 — Tasks Document
- **Status:** Done (this document)
- **Output:** `books_tasks.md`

### D3 — PRD
- **Depends on:** D1, D2
- **Output:** `books_prd.md`
- **Subtasks:**
  - Write goal, context, scope
  - Define user stories (creator dashboard + visitor public page)
  - Define acceptance criteria
  - Summarize data model, API, business logic
  - List open questions

### D4 — Schema
- **Depends on:** D1
- **Output:** `books_schema.md`
- **Subtasks:**
  - Define `RecommendedBook` collection fields, types, constraints
  - Define `BookList` collection fields
  - Define `Book_Category` collection
  - Document relations between collections
  - Document field-level notes for Strapi admin creation

### D5 — API Contract
- **Depends on:** D4
- **Output:** `books_api_contract.md`
- **Subtasks:**
  - Define GraphQL queries (book lists, books by list, book details, pinned books, books by subject)
  - Define GraphQL mutations (CRUD for lists and books, pin toggle, reorder)
  - Define Google Books API calls (search volumes, volume details)
  - Document request/response shapes for all

### D6 — Flow
- **Depends on:** D3
- **Output:** `books_flow.md`
- **Subtasks:**
  - Creator flow: dashboard entry → create list → add book → publish → share
  - Creator flow: manage top reads (pin, reorder, customize heading)
  - Visitor flow: browse carousels → tap cover → detail modal → tap list heading → grid page
  - Visitor flow: browse subjects → subject page
  - Edge case flows: empty states, single item, missing cover, long author lists

### D7 — Architecture
- **Depends on:** D4, D5
- **Output:** `books_architecture.md`
- **Subtasks:**
  - Component tree (new components, where they live in feature structure)
  - New routes and route structure
  - Google Books service module design
  - File/folder structure for Books feature module
  - Integration points with existing code (sidebar, category cards, DashboardLayout)

### D8 — Integration (Google Books)
- **Depends on:** D5
- **Output:** `books_integration.md`
- **Subtasks:**
  - Google Books API authentication and setup
  - Endpoints used (search volumes, volume details)
  - Rate limits and error handling
  - Data mapping (Google Books response → Strapi entity)
  - Image URL construction and HTTPS upgrade
  - Fallback behavior when Google Books is unavailable

### D9 — Testing
- **Depends on:** D3, D6
- **Output:** `books_testing.md`
- **Subtasks:**
  - Manual test scenarios (creator flows, visitor flows, edge cases)
  - Component test cases
  - Integration test cases (Google Books service)
  - Cross-browser/device testing matrix

---

## Phase B: Strapi Setup (Handoff)

### H1 — Create Strapi Collections
- **Depends on:** D4 (schema doc approved)
- **Owner:** User (TK)
- **Description:** User creates the three Strapi collections as documented in `books_schema.md`:
  1. `BookList` — with all fields and account relation
  2. `RecommendedBook` — with all metadata fields and book_list relation
  3. `Book_Category` — with subject_name and book relation
- **Deliverable:** Strapi collections live and accessible via GraphQL
- **Verification:** Agent runs a test GraphQL query to confirm collections exist and fields are correct
- **API Permissions to set:**
  - `BookList`: authenticated (CRUD), public (find, findOne)
  - `RecommendedBook`: authenticated (CRUD), public (find, findOne)
  - `Book_Category`: authenticated (CRUD), public (find, findOne)

---

## Phase C: Foundation

### T1 — Google Books Service Module
- **Depends on:** D8, H1
- **Description:** Create the Google Books API service module with search, volume detail fetch, and cover URL builders.
- **Subtasks:**
  - Create `src/services/googleBooksService.ts`
  - Implement `searchBooks(query: string, options?)` — calls `/volumes` endpoint
  - Implement `getVolumeDetails(volumeId: string)` — calls `/volumes/{volumeId}`
  - Implement `getThumbnailUrl(volumeInfo)` — returns HTTPS thumbnail URL
  - Implement `getLargeCoverUrl(thumbnailUrl)` — derive large URL from thumbnail
  - Implement `upgradeToHttps(url)` — upgrade http → https
  - Implement `extractISBN(identifiers, type)` — extract ISBN-13 or ISBN-10
  - Implement `extractYear(publishedDate)` — extract 4-digit year from date string
  - Implement `formatBuyLinks(saleInfo)` — build buy links array from Google Books saleInfo
  - Implement `transformGoogleBooksResult(item)` — map Google Books response to Strapi-ready object
  - Add TypeScript interfaces for all Google Books response types (`GoogleBooksSearchResult`, `GoogleBooksVolumeDetail`)
  - Add `GoogleBooksError` class with statusCode
  - Add error handling and retry logic for 429 responses
  - Add `VITE_GOOGLE_BOOKS_API_KEY` to env config
- **Files to create:** `src/services/googleBooksService.ts`, `src/types/googleBooksTypes.ts`
- **Files to modify:** `src/config.ts` (add GOOGLE_BOOKS_CONFIG), `.env.example`
- **Risk:** Google Books cover image URLs vary in quality and availability. Mitigated by fallback placeholder logic.

### T2 — GraphQL Queries & Mutations for Books
- **Depends on:** H1 (Strapi collections must exist)
- **Description:** Write all GraphQL queries and mutations for the Books feature.
- **Subtasks:**
  - Create `src/features/Books/api/query.ts` — all read queries
  - Create `src/features/Books/api/mutation.ts` — all write mutations
  - Queries: bookListsByAccount, booksByList, bookDetails, pinnedBooks, booksBySubject, bookListBySlug, publicBookData
  - Mutations: createBookList, updateBookList, deleteBookList, createRecommendedBook, updateRecommendedBook, deleteRecommendedBook
  - Add TypeScript types matching Strapi schema
- **Files to create:** `src/features/Books/api/query.ts`, `src/features/Books/api/mutation.ts`, `src/features/Books/types/index.ts`
- **Risk:** GraphQL schema mismatch with Strapi. Mitigated by testing queries against live Strapi after H1.

### T3 — Routes & Feature Module Structure
- **Depends on:** D7
- **Description:** Set up the Books feature module folder structure and routing.
- **Subtasks:**
  - Create feature directory: `src/features/Books/`
  - Create subdirectories: `components/dashboard/`, `components/public/`, `hooks/`, `api/`, `types/`, `utils/`
  - Add protected routes:
    - `/recommendations/books` — Books home
    - `/recommendations/books/:listId` — Inside a book list
    - `/recommendations/books/:listId/new-book` — Add book overlay
    - `/recommendations/books/:listId/:bookId/edit` — Edit book overlay
    - `/recommendations/books/top-reads` — Top Reads manager
  - Add public routes:
    - `/:username/books` — Public books page
    - `/:username/books/:listSlug` — Public list grid page
    - `/:username/books/subject/:subjectSlug` — Public subject grid page
  - Integrate with existing route structure
  - **Update shared components:**
    - `DashboardSidebar.tsx`: Add Books item, widen type
    - `CategoryCards.tsx`: Add Books card, widen type
    - `DashboardLayout.tsx`: Widen currentCategory type
- **Files to create:** `src/features/Books/index.ts`
- **Files to modify:** `src/routes/ProtectedRoutes.tsx`, `src/routes/PublicRoutes.tsx`, `src/components/DashboardSidebar.tsx`, `src/components/CategoryCards.tsx`, `src/components/DashboardLayout.tsx`
- **Risk:** Route conflicts or sidebar type errors. Mitigated by using `/books` namespace and properly widening shared types.

---

## Phase D: Dashboard

### T4 — Dashboard Sidebar & Category Cards Update
- **Depends on:** T3
- **Description:** Add Books as a third category in the shared navigation components.
- **Subtasks:**
  - Add Books icon (`BookOpenIcon` or similar) to sidebar items list
  - Add Books category card to mobile category cards grid
  - Update active state logic for `/recommendations/books/*` routes
  - Ensure Places and Movies & Shows remain fully functional
  - Update Navbar active state if applicable
- **Files to modify:** `src/components/DashboardSidebar.tsx`, `src/components/CategoryCards.tsx`, `src/components/Navbar.tsx`
- **Risk:** Breaking existing sidebar state for Movies and Places. Mitigated by additive-only pattern — no existing items removed.

### T5 — Books Home View
- **Depends on:** T2, T4
- **Description:** The Books landing page in the dashboard showing all book lists and Top Reads strip.
- **Subtasks:**
  - Create `BooksHome.tsx` component
  - Fetch all book lists for the current user (useBookLists hook)
  - Display lists as cards: name, book count, publish toggle, pin count, "Open →" link
  - Top Reads strip at top: horizontal scroll of pinned book covers with "Manage" link
  - "+ New List" button opening create list modal
  - Empty state for no lists (with first-list CTA)
  - Create list modal: name, description, optional cover, auto-generated slug
  - Slug auto-generation from list name (reuse slugify utility from Movies)
- **Files to create:** `src/features/Books/components/dashboard/BooksHome.tsx`, `src/features/Books/components/dashboard/CreateBookListModal.tsx`

### T6 — Book List View (Inside a List)
- **Depends on:** T5
- **Description:** The view inside a specific book list showing all books with management controls.
- **Subtasks:**
  - Create `BookListView.tsx` component
  - Two tabs: Recommendations | Manage
  - **Recommendations tab:**
    - Book rows with: cover thumbnail, title, author(s), year, subjects, Google rating, user rating, note preview
    - Pin toggle (⭐) per row
    - ⋮ menu per row: Edit, Delete, Move to another list
    - Drag handles (≡) for reordering (dnd-kit, same as Movies)
    - Sort presets dropdown: Custom, Rating, Year, Recently added
    - "+ Add Book" button → navigates to add overlay
    - Empty state
  - **Manage tab:**
    - Shareable URL display with copy button
    - QR code (reuse existing `qrcode.react` pattern)
    - List settings: edit name, description, cover, slug
    - Delete list with confirmation modal
- **Files to create:** `BookListView.tsx`, `BookRow.tsx`, `BookListManage.tsx`
- **Dependencies:** T2, T5

### T7 — Add Book Overlay
- **Depends on:** T1, T6
- **Description:** Full-page overlay for searching and adding a book to a list.
- **Subtasks:**
  - Create `AddBookPage.tsx` page component (routes: `new-book` + `/:bookId/edit`)
  - **Step 1 — Search:**
    - Google Books search input with debounced API calls (300ms)
    - Results: cover thumbnail, title, subtitle, author(s), year, publisher, subjects, page count
    - ISBN detection: if query looks like ISBN, send as `q=isbn:{query}`
    - "Select" button on each result
  - **Step 2 — Details form (after selection):**
    - Auto-filled book info: large cover, title, subtitle, author(s), publisher, year, pages, subjects, description
    - "Change Selection" link to back to search
    - Personal note (optional, Tiptap rich text — reuse same TiptapEditor as Movies)
    - User rating (1-5 stars — reuse same star component)
    - Buy Links section: auto-add Google Books buyLink if present; creator can add more (name + URL form)
    - Media upload: photos from device (S3 upload, reuse existing pattern)
    - "Add to Top Reads" checkbox
    - "Cancel" and "Add to List" buttons
  - Form validation (Formik + Yup — same as Movies)
  - Submit flow: createRecommendedBook mutation → upload media → navigate back
  - Edit mode: pre-fill form from existing book data
- **Files to create:** `AddBookPage.tsx`, `GoogleBooksSearch.tsx`, `BuyLinks.tsx`
- **Dependencies:** T1 (Google Books service), T2 (mutations), T6
- **Risk:** Google Books cover image quality is inconsistent. Mitigated by fallback placeholder and option for manual photo upload.

### T8 — Top Reads Manager
- **Depends on:** T6
- **Description:** Dedicated view for managing pinned book recommendations.
- **Subtasks:**
  - Create `TopReadsManager.tsx` component
  - Customizable display name field
  - Drag-to-reorder list of all pinned books (dnd-kit)
  - Each item: cover thumbnail, title, author(s), source list name, remove (×) button
  - Counter: "4/15 reads used"
  - "Add from your lists" button → picker showing all books with checkboxes
  - Save order mutation (reorderPinnedBooks)
- **Files to create:** `TopReadsManager.tsx`
- **Dependencies:** T2, T6

---

## Phase E: Public Page

### T9 — Public Books Page (Carousel Layout)
- **Depends on:** T2, T3
- **Description:** The main public-facing books page with horizontal carousel rows.
- **Subtasks:**
  - Create `PublicBooks.tsx` page component
  - Header: "[Creator]'s Books · [count] books"
  - Top Reads carousel row (first, if pinned items exist)
  - Per-list carousel rows (published lists in creator-defined order)
  - Each row: list name heading with ">" arrow, book count, horizontal scrollable cover cards
  - Subject browse section at the bottom (2-col mobile, 4-col desktop)
  - Subject cards: book cover as background image, subject name, book count
  - Empty state (no published books)
  - Lazy loading per carousel row
  - SEO meta tags
  - Google Books attribution badge ("Powered by Google")
- **Files to create:** `PublicBooks.tsx`, `BookCarouselRow.tsx`, `SubjectBrowse.tsx`
- **Dependencies:** T2

### T10 — Cover Card Component
- **Depends on:** None (can be built standalone)
- **Description:** The book cover card used in carousels and grids.
- **Subtasks:**
  - Create `BookCoverCard.tsx` component
  - Full cover image (2:3 aspect ratio portrait, same ratio as movie posters) with object-cover
  - Rating badge overlay (bottom-right, semi-transparent dark pill, star + rating)
    - Prefer `user_rating` if available, else `google_rating`
  - Title text below cover (one line, truncated)
  - Author text below title (first author or "First et al.", truncated)
  - Hover scale animation (1.05x on desktop — same as MoviePosterCard)
  - Click handler (opens detail modal)
  - Fallback image when cover unavailable (generic book cover graphic)
  - Lazy image loading
  - Skeleton loading state (`BookCoverSkeleton.tsx`)
- **Files to create:** `BookCoverCard.tsx`, `BookCoverSkeleton.tsx`

### T11 — Book Detail Modal
- **Depends on:** T10
- **Description:** Slide-up modal showing book details when a cover is tapped on the public page.
- **Subtasks:**
  - Create `BookDetailModal.tsx` component
  - Drag bar at top for swipe-to-close (reuse PlaceOverview / MovieDetailModal pattern)
  - Close button (×)
  - Large cover image
  - Book metadata: title, subtitle, author(s), publisher, year, page count, subjects (chips)
  - Google rating display (if available)
  - Creator's rating (1-5 glowing yellow stars — same as MovieDetailModal)
  - Creator's note section (Tiptap formatted)
  - Where to Find: buy link badges (tappable, open in new tab)
  - Creator's photos (horizontal scroll thumbnails, if any uploaded)
  - "From the list: [list name] →" link
  - Share button
  - Swipe-down-to-dismiss (threshold: 100px, same as existing modals)
- **Files to create:** `BookDetailModal.tsx`
- **Dependencies:** T10

### T12 — Public List Grid Page
- **Depends on:** T9, T10
- **Description:** Full cover grid page when visitor taps a list heading.
- **Subtasks:**
  - Create `PublicBookList.tsx` page component
  - Route: `/:username/books/:listSlug`
  - "← [Creator]'s Books" back navigation
  - List name as heading
  - List description below heading
  - Book count
  - 3-column cover grid (mobile), 5-6 column (desktop)
  - Tapping a cover opens the detail modal (T11)
  - SEO meta tags
- **Files to create:** `PublicBookList.tsx`
- **Dependencies:** T10, T11

### T13 — Public Subject Page
- **Depends on:** T9, T10
- **Description:** Subject page showing all books of a subject across all lists.
- **Subtasks:**
  - Create `PublicBookSubject.tsx` page component
  - Route: `/:username/books/subject/:subjectSlug`
  - Subject slug ↔ name conversion using `subjectUtils.ts`
  - "← [Creator]'s Books" back navigation
  - Subject name as heading
  - Book count
  - 3-column cover grid (mobile), 5-6 column (desktop)
  - Aggregates books across all published lists matching the subject
  - Deduplicate by `volume_id`
  - Tapping a cover opens the detail modal (T11)
  - SEO meta tags
- **Files to create:** `PublicBookSubject.tsx`
- **Dependencies:** T10, T11

---

## Phase F: Polish & Testing

### T14 — Internationalization (i18n)
- **Depends on:** T4-T13
- **Description:** Add translation keys for all new UI text.
- **Subtasks:**
  - Add translation keys under `books.*` namespace (dashboard + public)
  - Keys: sidebar label, list management, add flow, top reads, empty states, error messages
  - Test with at least one non-English locale if i18n is actively used
- **Files to modify:** `src/i18n/` locale files

### T15 — Responsive QA & Polish
- **Depends on:** T4-T13
- **Subtasks:**
  - Test sidebar Books item at desktop breakpoint (≥768px)
  - Test Books category card at mobile breakpoint (<768px)
  - Test carousel scroll behavior (touch on mobile, mouse on desktop)
  - Test cover card scaling and badge placement at various sizes
  - Test detail modal swipe-to-close on mobile
  - Test add overlay form on mobile (keyboard, scroll)
  - Verify no regressions in Places or Movies dashboards
  - Check Google Books attribution badge placement

### T16 — Manual Testing & Bug Fixes
- **Depends on:** T15
- **Description:** End-to-end manual testing of all flows.
- **Subtasks:**
  - Execute all test scenarios from `books_testing.md`
  - Creator flow: create list → add books → pin top reads → reorder → publish → share
  - Visitor flow: browse carousels → tap cover → modal → tap list → grid → tap subject → subject page
  - Edge cases: empty lists, single book, no cover available, multiple authors, very long titles
  - Fix bugs discovered during testing
  - Final visual QA pass

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Google Books cover image unavailable for many books | Medium | Medium | Fallback generic book cover placeholder with title text |
| Google Books API response shape changes | Low | Medium | Typed interfaces, integration tests |
| Google Books rate limiting (1000 req/day without key) | Medium | Low | Use API key in production; debounce search input |
| Strapi schema mismatch with frontend queries | Medium | High | Schema doc reviewed before creation, test queries after H1 |
| Existing Places/Movies dashboard regression | Low | High | Sidebar is additive (type widening only), existing code untouched, manual QA |
| Subject slugs colliding with list slugs in routes | Low | Medium | Subject page uses `/subject/:slug` namespace, never conflicts with `/:listSlug` |
| Long Google Books descriptions (HTML content) | Medium | Low | Sanitize description before storing. Strip HTML tags or use DOMPurify. |
| Author list too long for compact card display | Medium | Low | Show "First Author et al." in cards; full list in detail modal |

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
       ├──→ T1 (Google Books Service) ←── D8             │
       │         │                                        │
       ├──→ T2 (GraphQL) ←── D5                          │
       │         │                                        │
       └──→ T3 (Routes + Sidebar) ←── D7 ────────────────┘
                 │
                 ├──→ T4 (Sidebar/Cards update)
                 │         │
                 │         ├──→ T5 (Books Home)
                 │         │         │
                 │         │         ├──→ T6 (List View)
                 │         │         │         │
                 │         │         │         ├──→ T7 (Add Overlay) ←── T1
                 │         │         │         │
                 │         │         │         └──→ T8 (Top Reads)
                 │         │         │
                 │    T10 (Cover Card)
                 │         │
                 ├──→ T9 (Public Books) ←── T10
                 │         │
                 │         ├──→ T11 (Detail Modal)
                 │         │
                 │         ├──→ T12 (List Grid Page)
                 │         │
                 │         └──→ T13 (Subject Page)
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
| D: Dashboard | T4-T8 | 4-6 days |
| E: Public Page | T9-T13 | 3-5 days |
| F: Polish & Test | T14-T16 | 1-2 days |
| **Total** | | **~12-18 days** |

> **Note:** Faster than Movies & Shows (~15-20 days) because:
> - Sidebar/category cards pattern already exists (additive update only)
> - DashboardLayout, carousel row, poster card patterns are reused/adapted
> - Modal slide-up, Tiptap editor, star rating, dnd-kit reorder — all reused
> - Main new work: Google Books service, Books-specific components, subject browsing
