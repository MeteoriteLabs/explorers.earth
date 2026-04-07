---
Feature: books
Doc type: prd
Status: draft
Created: 2026-03-25
Last updated: 2026-03-26
Updated by: agent
Depends on: books_decisions.md, UI_UX_Implementation.md
---

# Books — Product Requirements Document

## Goal

Enable creators, influencers, and businesses on explorers.earth to curate and share book recommendations with their audience, expanding the platform's recommendation ecosystem into literary lifestyle curation.

**Problem:** Creators currently recommend physical places and movies, but books are a core part of many creators' identities. Their audience frequently asks "what are you reading?" and "what books changed your life?" — creators have no native way to share book recommendations within their explorers.earth profile. They resort to scattered Amazon wishlists, Goodreads profiles, or Instagram story highlights, fragmenting their recommendation identity.

**For whom:** Creators, authors, educators, and influencers who want to build a comprehensive taste profile. Their audiences who want trusted, personal book recommendations — not algorithmic Goodreads suggestions.

**Why now:** Movies & Shows established the architectural pattern (separate collection, carousel public page, Google Books replaces TMDB). Books is the second category expansion, validating and stress-testing the pattern before Music, Games, and Products follow.

## UI/UX Implementation Standards
To ensure 90%+ implementation accuracy and dashboard consistency:
- **Blue Branding**: Use `var(--dash-accent)` for all primary dashboard actions (blue theme).
- **Mobile Safety**: Add `pb-32` or `pb-40` to main containers to prevent content overlap with the fixed footer navigation.
- **Interactive**: Use the standard `Switch` component for visibility toggles.
- **Clickability**: Hero cards must be fully clickable.
- Refer to [UI_UX_Implementation.md](./UI_UX_Implementation.md) for detailed CSS and component rules.

## Scope

### In Scope
- New Strapi collections for book recommendations and book lists
- Dashboard sidebar (desktop) and category cards (mobile) updated to include Books
- Books home view showing all book lists with management controls
- Book list view with table/list layout, reordering, pin toggles
- Full-page add/edit book overlay with Google Books search integration
- Top Reads pinning system with dedicated manager
- Public books page with horizontal carousel rows (one per list)
- Book cover card component with rating badge overlay
- Book detail slide-up modal
- Public list grid page (full cover grid for a specific list)
- Public subject page (cover grid for a subject/genre across all lists)
- Subject browse section with book-cover image cards
- List-level publish/draft toggle
- Manage tab with sharing URL, QR code, list settings
- Optional "Where to Buy" links (Google Books link + manual entry)
- i18n translation keys
- Responsive design (mobile + desktop)

### Out of Scope
- Visitor save/wishlist functionality (v2)
- Cross-category Top Picks on profile hub page (v2)
- URL-based individual book sharing with SEO (v2 — modal only in v1)
- Reading status tracking (Read / Currently Reading / Want to Read) — v2
- Goodreads import/sync
- Changes to existing Places or Movies & Shows features
- Backend/Strapi plugin development (user creates collections manually)
- Analytics tracking for book page views

## User Stories

### Creator Stories

**US-1: Category Navigation**
As a creator, I want to switch between Places, Movies & Shows, and Books on my dashboard, so I can manage all my recommendation categories.
- Desktop: persistent sidebar now shows Places, Movies & Shows, Books
- Mobile: category cards grid updated to show all three categories

**US-2: Create Book List**
As a creator, I want to create a named book list (e.g., "Life-Changing Reads", "Business Essentials") so I can organize my recommendations thematically.
- Fields: list name (required), description (optional), cover image (optional, auto from first book), slug (auto-generated, editable)
- List creation takes under 10 seconds

**US-3: Add Book**
As a creator, I want to search for a book and add it to my list with my personal note.
- Full-page overlay with Google Books search
- Search results show: cover thumbnail, title, author(s), year, publisher, subjects, page count, description
  - After selection: auto-filled details, personal note (rich text), user rating (1-10 stars, matching Movies & Shows consistent UX), where to buy, optional media upload, and pin to Top Reads
  - Submit saves all metadata to Strapi

**US-4: Manage Books in List**
As a creator, I want to view, edit, delete, reorder, and pin books within a list.
- Table/list rows with: cover thumbnail, title, author(s), year, subjects, Google rating, user rating, note preview
- Pin toggle (⭐) per row
- ⋮ menu: Edit, Delete, Move to another list
- Drag handles for reorder
- Sort presets: Custom, Rating, Year, Recently added

**US-5: Publish List**
As a creator, I want to toggle a list between published and draft, so I can control what's visible on my public page.
- Toggle on list card (Books home) and inside list view
- Published = visible on public page. Draft = hidden.

**US-6: Manage Top Reads**
As a creator, I want to pin my favorite books as "Top Reads" and control how they appear on my public page.
- Customizable display name (e.g., "Books That Changed My Life", "Must-Reads")
- Drag-to-reorder pinned items
- Max 15 pins
- Counter showing usage

**US-7: Share List**
As a creator, I want to get a shareable URL and QR code for any book list.
- Manage tab shows URL, QR code, copy button
- URL format: `explorers.earth/[username]/books/[list-slug]`

### Visitor Stories

**US-8: Browse Book Recommendations**
As a visitor, I want to see a creator's book recommendations organized in themed rows that I can scroll through.
- Horizontal carousel rows (one per list)
- Top Reads row first (if exists), then published lists, then subject browse
- Book cover cards with rating badge overlay + title below

**US-9: View Book Details**
As a visitor, I want to tap a book cover to see the creator's recommendation details.
- Slide-up modal: cover, metadata (title, author, publisher, year, pages, subjects), creator's note, creator's rating, where to buy, creator's photos, source list
- Share button
- Swipe-down to dismiss

**US-10: Browse by List**
As a visitor, I want to tap a list heading to see all books in that list as a grid.
- Full cover grid page at `/:username/books/:listSlug`
- List name, description, book count
- Back navigation to main books page

**US-11: Browse by Subject**
As a visitor, I want to browse books by subject across all the creator's lists.
- Subject cards at bottom of books page
- Tap opens subject page at `/:username/books/subject/:subjectSlug`
- Cover grid of all books in that subject across all lists

## Data Model Summary

See `books_schema.md` for complete field-level detail.

- **BookList collection** — list name, description, cover image, slug, visibility, account relation, book relations, display order, top reads heading
- **RecommendedBook collection** — Google Books metadata (volume_id, title, authors, cover_url, subjects, publisher, page_count, google_rating, description, isbn), creator's note (Tiptap blocks), user_rating (1-10 integer, matching Movies & Shows), buy_links (JSON), is_pinned, pin_order, display_order, media snapshots, list relation, Book_Category relation

## API Summary

See `books_api_contract.md` for complete request/response shapes.

- GraphQL queries: book lists by user, books by list (paginated), pinned books, books by subject, single book details
- GraphQL mutations: CRUD for lists and books, pin toggle, pin reorder, list reorder
- Google Books API: search volumes, volume details

## Business Logic

- **Duplicate prevention:** When adding a book, check if the same Google Books `volume_id` already exists in the target list. Allow the same book in different lists.
- **Pin limit:** Max 15 pinned books. UI shows counter and disables pin toggle when limit reached.
- **Slug generation:** Auto-generate from list name (lowercase, hyphens, remove special chars). Must be unique per user. Append number if duplicate.
- **Cover image fallback:** If no cover image uploaded for the list, use the first book's cover as the list cover.
- **Subject extraction:** Subjects come from Google Books metadata stored in each book. Subject browse section aggregates across all published lists. Only subjects with at least 1 book are shown.
- **Buy links:** Google Books `buyLink` (if available) auto-populated at save time. Creator can manually add/edit links (Amazon affiliate, library, etc.).
- **Media upload:** Reuse existing media upload patterns (max 10 files, device + Google Images). Stored in S3 with structured paths.
- **List ordering on public page:** Creator-defined via drag-and-drop in Manage. Stored as `display_order` field on the list entity.
- **Cover images:** Stored as full Google Books thumbnail URLs in Strapi (not downloaded and re-hosted). Google Books CDN is reliable and free.
- **Google rating:** Stored from Google Books `averageRating` at save time (0-5 scale). Not dynamically updated.

## Acceptance Criteria

### Creator Dashboard
- [ ] Desktop sidebar shows Places, Movies & Shows, and Books categories
- [ ] Mobile shows category cards grid with all three categories
- [ ] Clicking Books opens the Books home view
- [ ] Creator can create a new book list with name, description, optional cover
- [ ] Creator can add a book via Google Books search with auto-filled metadata
- [ ] Personal note is rich text format (Tiptap)
- [ ] Google Books buy link is auto-populated if available
- [ ] Creator can manually add or edit buy links
- [ ] User can manually upload photos directly to S3
- [ ] User can provide a 1-10 star user rating (consistent with Movies & Shows)
- [ ] Creator can pin books to Top Reads (max 15) via star toggle
- [ ] Creator can drag-to-reorder books within a list
- [ ] Creator can drag-to-reorder pinned items in Top Reads manager
- [ ] Creator can customize Top Reads display name
- [ ] Creator can toggle list between Published and Draft
- [ ] Manage tab shows shareable URL and QR code
- [ ] Creator can edit and delete books
- [ ] Creator can edit list name, description, cover, slug
- [ ] Creator can delete a list (with confirmation)
- [ ] Existing Places and Movies & Shows dashboards are fully functional and unchanged

### Public Page
- [ ] Public books page loads at `/:username/books`
- [ ] Header shows "[Creator]'s Books · [count] books"
- [ ] Top Reads carousel row appears first (if pinned items exist)
- [ ] Published lists appear as horizontal carousel rows in creator-defined order
- [ ] Cover cards show book cover with rating badge overlay + title below
- [ ] Tapping a cover opens the detail modal
- [ ] Detail modal shows: cover, metadata (title, author, publisher, year, pages, subjects), creator's note, creator's rating, where to buy (clickable), photos, source list, share
- [ ] Detail modal swipe-down-to-dismiss works on mobile
- [ ] Tapping list heading opens full cover grid page
- [ ] Subject browse section shows at bottom
- [ ] Tapping subject card opens subject cover grid page
- [ ] Empty states render gracefully

### Cross-Cutting
- [ ] All new UI text has i18n translation keys
- [ ] Responsive across mobile (<768px) and desktop (≥768px)
- [ ] Loading skeletons shown during data fetch
- [ ] No regressions in existing Places or Movies & Shows features

## Open Questions

1. **Multiple authors** — Many books have multiple authors. In v1, display all authors comma-separated. In detail modal, show all. In card compact view, show first author + "et al." if more than one?
2. **ISBN as identifier** — Should we store ISBN-13 as an additional identifier alongside `volume_id` for future use (e.g., integrating with library APIs)?
3. **Google Books cover quality** — Google Books thumbnails are sometimes low resolution. Is a "no cover" placeholder sufficient, or should we allow manual cover upload per book?
4. **Subject normalization** — Google Books subjects can be very specific ("Authors, American — 20th Century"). Should we normalize/simplify? Recommendation: store raw subjects from Google Books, display as chip tags. Let the subject browse page handle grouping at query level.
