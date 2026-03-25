---
Feature: books
Doc type: decisions
Status: draft
Created: 2026-03-25
Last updated: 2026-03-25
Updated by: agent
Depends on: none
---

# Books — Decisions Log

Every architectural and design decision for this feature, with context, alternatives considered, and rationale.

---

## D1: Separate Strapi Collection vs Extend RecommendedMovie/Place

**Decision:** Create a new `RecommendedBook` Strapi collection with properly typed fields.

**Context:** The existing `RecommendedMovie` and `RecommendedPlace` collections are tightly coupled to their respective data sources (TMDB, Google Places). Books have fundamentally different metadata: ISBN, authors (may be multiple), publisher, page count, Google Books volume ID, subjects/genres, publication date. Reusing either existing collection would create a shapeless JSON blob with many null fields irrelevant to books.

**Alternatives considered:**

1. **Extend RecommendedMovie with Entity_Type enum + JSON metadata** — Avoids a new collection, but creates an untyped generic blob. Strapi can't validate fields. GraphQL returns weakly-typed data. Every movie query would need to handle nulls for book-only fields and vice versa.

2. **Polymorphic entity table with Item_Metadata JSONB** — Architecturally elegant for 9+ entity types, but requires a massive rewrite of existing schema, GraphQL queries, category mappers, and all components. Premature optimization at this stage.

**Rationale:** Separate collections give clean, typed schemas conforming to each domain. Strapi admin provides proper forms. GraphQL returns strongly typed data. Each collection evolves independently. Zero risk to existing Places or Movies functionality. This pattern was established by Movies and Books is the second implementation.

**Impact on implementation:** New Strapi collection to create. New GraphQL queries/mutations. Frontend components are net-new.

**Impact on future work:** When Music, Games, Products, etc. ship, each gets its own collection. D1 from Movies established this pattern; Books reinforces it.

---

## D2: Book List — Separate BookList Collection

**Decision:** Create a new `BookList` Strapi collection (not extending `RecommendationList` or `MovieList`).

**Context:** `RecommendationList` is coupled to Google Places data. `MovieList` has movie-specific fields (`top_picks_heading` as movies concept). Book lists share the same fundamental structure (name, description, slug, visibility, display_order) but are semantically distinct.

**Alternatives considered:**

1. **Add List_Type enum to MovieList** — Reuses existing collection but conflates movie and book list management. Admin panel becomes confusing. Queries must always filter by type.

2. **Generic universal list collection** — One list collection that all categories use. Cleanest long-term but requires migrating MovieList and RecommendationList, which is out of scope.

**Rationale:** New `BookList` collection mirrors the `MovieList` pattern established in Movies & Shows. Same field structure, same relation patterns, same visibility logic. The frontend treats it as a typed entity. Sets the "one collection per category" convention.

**Impact on implementation:** New Strapi collection with the same structural fields as MovieList. Frontend queries target this collection. Sidebar/navigation additions are purely frontend concerns.

**Impact on future work:** Establishes the template for Music, Games, Products list collections.

---

## D3: External API — Google Books API

**Decision:** Use Google Books API (v1) as the primary data source for book search and metadata.

**Context:** Books need a reliable, comprehensive, free API for searching by title/author/ISBN and retrieving rich metadata. The analogous TMDB for movies is Google Books for books.

**Alternatives considered:**

1. **Open Library API (archive.org)** — Free, open, no API key required. Good coverage of classic/public domain works. However, metadata quality is inconsistent (many missing covers, descriptions, ISBNs), and the search relevance is noticeably weaker than Google Books.

2. **Amazon Product Advertising API** — Excellent data, commerce links. Requires AWS account, approval, and has strict terms of service (must show Amazon affiliate links). Overkill and restricted.

3. **Hardcoded manual entry (no API)** — Creator types all book metadata manually. Eliminates API dependency but creates terrible UX — finding cover images, ISBNs, author details all becomes manual work.

**Rationale:** Google Books API is the TMDB equivalent for books. Free, generous rate limits (1,000 requests/day without a key, up to 1,000/100 seconds with an API key), excellent coverage (10M+ books), high metadata quality (covers, descriptions, authors, publishers, categories, ISBNs). Widely used and well-documented. API key is optional (quota is shared without one; recommended to use a key for production). Follows same hybrid pattern as TMDB: client-side search during add flow, all metadata stored in Strapi, public pages read from Strapi only.

**Impact on implementation:** New `VITE_GOOGLE_BOOKS_API_KEY` env variable. New `googleBooksService.ts` service module. Book entity stores all display-relevant metadata from Google Books at save time.

**Impact on future work:** Confirms the "client search → store metadata → serve from Strapi" hybrid integration pattern for all future categories.

---

## D4: Dashboard Navigation — Extend Existing Sidebar

**Decision:** Add Books as a new category item in the existing dashboard sidebar (desktop) and category cards grid (mobile), alongside Places and Movies & Shows.

**Context:** The sidebar/category cards navigation was built for Movies & Shows with the explicit design goal of supporting future categories. Adding Books is purely additive — new icon + label + route in the sidebar, new card in the category cards grid.

**Alternatives considered:**

1. **Separate navigation system for Books** — Unnecessary. The sidebar component accepts a `currentCategory` prop and renders items accordingly. Adding Books requires adding to the items list, not a new system.

2. **Nested category grouping (e.g., "Recommendations" header > Places, Movies, Books)** — Future consideration when there are 5+ categories. Premature for three categories.

**Rationale:** Minimal friction addition. The sidebar is already the established navigation pattern. Users understand it from Movies & Shows. Consistent patterns are better than novel ones.

**Impact on implementation:** Update `DashboardSidebar.tsx` to add Books item. Update `CategoryCards.tsx` to add Books card. Update route definitions.

---

## D5: Public Page Layout — Carousel Rows (Same as Movies)

**Decision:** Same Netflix-style vertical scroll of horizontal carousel rows as Movies & Shows — one row per book list.

**Context:** The carousel row pattern was established in Movies & Shows and is explicitly documented as the template for all future content categories. Books map cleanly to this pattern: a creator has themed lists ("Summer Reading", "Business Essentials", "Sci-Fi Classics"), each becomes a carousel row.

**Alternatives considered:**

1. **Horizontal book spine layout** — Mimics a physical bookshelf (spine view). Visually distinctive but poor for mobile — spines are too narrow to read. Complex to implement.

2. **Goodreads-style with rating + progress bars** — Rich but overdesigned for a recommendation page. The creator is recommending books, not showing reading progress.

3. **Card with cover + title + author below** — The most natural representation. This IS the carousel row pattern, just with book covers instead of movie posters.

**Rationale:** Book covers are the primary visual element (tall portrait ratio, same as movie posters). The carousel row pattern works identically. Reusing the same visual framework delivers consistency and code reuse (`BookPosterCard` is the book equivalent of `MoviePosterCard`). Creator's curated lists are expressed as named rows — the list names carry the editorial voice.

**Impact on implementation:** Reuse or closely mirror `MovieCarouselRow`, `MoviePosterCard` patterns. Create book-specific variants. Same lazy loading, same scroll behavior.

**Impact on future work:** Validates the carousel row pattern's generalizability. Each new category reuses this scaffold.

---

## D6: Add Book Flow — Full-Page Overlay (Same as Movies)

**Decision:** Full-page overlay (route-based: `/:listId/new-book`) matching the existing add-movie and add-place patterns.

**Context:** The add flow requires: searching Google Books, selecting a result, writing a personal note, optionally adding a "Read by" date, optionally uploading a photo (e.g., creator reading the book), optionally pinning to Top Picks, and optionally providing a user rating. This is a multi-section form needing full vertical space.

**Alternatives considered:**

1. **Slide-up modal** — Same arguments as Movies: too many form sections, cramped on mobile, no room for rich text editor.

**Rationale:** Full-page overlay is consistent with Movies and Places add flows. Same UX patterns apply: back button, TMDB-equivalent search, auto-filled metadata after selection, form sections below. Browser back button works naturally. The user confirmed this approach for Movies; Books follows the same decision.

**Impact on implementation:** New `AddBookPage.tsx` following `AddMoviePage.tsx` structure. Google Books search replaces TMDB search. Form sections adapted for book-specific fields.

**Impact on future work:** Confirms the full-page overlay as the universal add-item pattern across all categories.

---

## D7: Publish Model — List-Level Only (Same as Movies)

**Decision:** Publish/draft toggle at the list level. All books in a published list are visible. No per-item visibility control.

**Context:** Identical decision context as Movies. Creator controls list-level visibility. Simple, fast, matches existing patterns.

**Rationale:** Identical to Movies D7. One toggle, clear mental model (published list = all books visible), zero confusion about "which layer is hiding this?". Consistent across all categories.

**Impact on implementation:** `Visibility` boolean on `BookList`. Toggle component on list card and inside list view.

---

## D8: Top Picks — Pin Model (Same as Movies)

**Decision:** Creators pin individual books to "Top Picks" via a pin/star icon. Pinned books from across all lists aggregate into the first row on the public page. Max 15 pins.

**Context:** Identical decision context as Movies. Creators want to highlight their absolute favorite books regardless of which list they belong to.

**Rationale:** Identical to Movies D8. Pin model is zero-friction, stays in sync, requires no separate list management. `is_pinned` and `pin_order` fields on `RecommendedBook`. Drag-to-reorder in dedicated manager.

**Impact on implementation:** Two fields on the book entity. Star toggle on card UI. Dedicated Top Reads management view with drag-and-drop.

**Impact on future work:** Same pin model across all categories. Cross-category Top Picks on profile hub page (v2).

---

## D9: Detail View — Modal Overlay (Same as Movies)

**Decision:** Tapping a book cover on the public page opens a slide-up modal overlay. No full-page navigation for individual books in v1.

**Context:** Identical decision context as Movies. Visitor should not lose scroll position when viewing book details.

**Rationale:** Modal keeps visitor in context. Matches `PlaceOverview` and `MovieDetailModal` patterns. Detail modal contains: large cover image, title, author(s), publisher, publication year, page count, subjects/genres, description, creator's personal note, creator's rating (1-5 stars), creator's photos (if any), "Where to Buy" links (optional), source list link, share button. Swipe-down-to-dismiss on mobile.

**Impact on implementation:** New `BookDetailModal.tsx` following `MovieDetailModal.tsx`. Content adapted for book-specific fields.

---

## D10: Google Books API Integration — Hybrid (Client + Store)

**Decision:** Client-side Google Books search during the add flow. All metadata stored in Strapi when saving. Public pages read exclusively from Strapi.

**Context:** Identical decision context as Movies/TMDB. Frontend SPA with no backend server.

**Alternatives considered:**

1. **Client-side only** — Public pages depend on Google Books availability.
2. **Server-side proxy** — Requires backend changes, out of scope.

**Rationale:** Google Books API allows client-side usage. API key is free and rate limits are generous. Search during the add flow benefits from direct client-side calls (low latency). When saving, all Google Books metadata (volume ID, title, authors, cover, description, subjects, publisher, page count, ISBN) is stored in Strapi. Public pages never call Google Books — they read from Strapi. Public page performance is independent of Google Books availability.

**Impact on implementation:** New `VITE_GOOGLE_BOOKS_API_KEY` env variable. `googleBooksService.ts` module. Book entity stores all display-relevant metadata.

---

## D11: Book Cover Images — Google Books Thumbnail URLs

**Decision:** Store the Google Books cover thumbnail URL as a full URL string in Strapi (not path + base like TMDB). Prefer the `thumbnail` size for cards, `large` for detail modal.

**Context:** Unlike TMDB (which uses a CDN base + path pattern), Google Books returns full cover image URLs directly from the API (e.g., `http://books.google.com/books/content?id=...&printsec=frontcover&img=1&zoom=1`). Google Books also provides `smallThumbnail` and `thumbnail` sizes.

**Alternatives considered:**

1. **Store as path only** — Not applicable. Google Books doesn't use a base + path pattern.
2. **Download and re-host in S3** — Would ensure persistence but adds complexity. Google Books cover URLs are generally stable.

**Rationale:** Store the full `thumbnail` URL for use in cards and the `large` parameter variant for detail views. Build the large URL by replacing `zoom=1` with `zoom=0` or by using the `&fife=w400` parameter. This approach is consistent with how Google Books URLs work. If a cover URL breaks (rare), show a generic book cover placeholder.

**Impact on implementation:** `cover_url` field on `RecommendedBook` stores the full thumbnail URL. Frontend uses it directly. `googleBooksService.ts` provides helpers for size variants.

---

## D12: Genre / Subject Browse Section

**Decision:** Subject browse section at the bottom of the public Books page, mirroring the Genre browse section in Movies. Each subject card shows cover image from a book in that subject, subject name, and book count.

**Context:** Books have "subjects" (equivalent to movie genres) from Google Books API — e.g., "Fiction", "Science", "Business & Economics", "Self-Help". These allow visitors to browser by subject across all of a creator's book lists.

**Alternatives considered:**

1. **Filter pills in-place** — Filters the carousel rows. Consistent with genre filtering but loses the carousel structure.
2. **No subject browse** — Simpler. But loses discovery path for genre-oriented browsing.

**Rationale:** Subject browse section follows the Movies genre browse pattern exactly. Dedicated subject page at `/:username/books/subject/:subjectSlug`. This provides visitors a genre-oriented discovery path. Subjects come from Google Books metadata stored on each book. Only subjects with ≥1 book in published lists are shown. Backdrop-style card with a book cover image gives visual richness.

**Impact on implementation:** Subject extraction from book metadata at query time. New subject page component. Dynamic route.

---

## D13: "Where to Buy" Links (Optional)

**Decision:** Optionally include "Where to Buy" links (e.g., Amazon, Goodreads, Google Play Books) as a simple editable field, not auto-populated from an external API.

**Context:** Unlike streaming platforms (TMDB provides watch provider data), there is no equivalent free API that returns per-region bookstore deep links. Amazon Affiliate API requires approval. Google Books provides a `buyLink` field that points to Google Play Books (useful but limited).

**Alternatives considered:**

1. **Auto-populate from Google Books `buyLink`** — Google Books returns a `buyLink` for some volumes. Limited to Google Play Books, not available for all books.
2. **No "Where to Buy"** — Simplest. Creator's note and metadata are the value-add; purchase links are secondary.
3. **Manual entry by creator** — Creator can optionally add links to Amazon, Goodreads, their library, etc.

**Rationale:** Store the Google Books `buyLink` automatically if available, plus allow the creator to manually add or override with their own links (e.g., their affiliate Amazon link, a library link). Stored as a JSON array matching the `watch_providers` pattern. This gives creators who want to monetize through affiliate links the ability to do so. Not auto-populated from a full bookstore data feed.

**Impact on implementation:** `buy_links` JSON field on `RecommendedBook`. Optional chip group in add form. Creator can toggle/edit available links.

---

## D14: Notes — Optional Rich Text (Same as Movies)

**Decision:** Personal note field is optional, uses Tiptap rich text editor, not required. No separate quick-add mode.

**Context:** Identical decision as Movies D13. Book recommendations benefit from context ("Why I loved it", "Perfect for anyone who...") but forcing notes on every entry adds friction.

**Rationale:** Same as Movies. One add flow, flexible behavior. Creator can batch-add books and add notes later via the edit flow.

---

## D15: Visitor Save — Deferred to v2

**Decision:** No save/bookmark functionality for visitors in v1.

**Context:** Same as Movies D14. Cross-category visitor save/wishlist is a v2 feature to be built once for all categories simultaneously.

---

## D16: "Reading Status" Field — Out of Scope for v1

**Decision:** No "reading status" field (e.g., "Read", "Currently Reading", "Want to Read") in v1. Creator recommends books they have read and enjoyed.

**Context:** Goodreads tracks reading status per user. The question is whether creators on explorers.earth want to show reading status on their recommendations.

**Alternatives considered:**

1. **Add reading_status enum** — Rich personal context. But the platform is about sharing recommendations, not tracking personal reading habits. Status tracking is a Goodreads use case.

**Rationale:** The platform's core value is recommendations. If a creator is recommending a book, the implicit status is "I've read it and love it." Adding reading status adds complexity without clear visitor-facing value in v1. Can be added in v2 if users request it.

---

## D17: Tiptap Editor & User Ratings (Same as Movies)

**Decision:** Creator notes are stored as Tiptap JSON format blocks. A `user_rating` field (1-5 integer) exists independently of any Google Books rating (which is not explicitly exposed as a simple score).

**Context:** Same rationale as Movies D17. Rich text for engaging notes. Creator's personal 1-5 star rating adds their subjective voice alongside the book metadata.

**Rationale:** `user_recommendation_note` expects Tiptap blocks. `user_rating` stores a 1-5 integer that renders as glowing yellow stars in the UI, matching the Movies & Shows implementation. Google Books returns a `averageRating` (out of 5) which we store separately as `google_rating` for reference.

**Impact on implementation:** `user_rating` and `google_rating` added to schema. Form uses `TiptapEditor` component (same as Movies).
