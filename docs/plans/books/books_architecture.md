---
Feature: books
Doc type: architecture
Status: draft
Created: 2026-03-25
Last updated: 2026-03-25
Updated by: agent
Depends on: books_schema.md, books_api_contract.md
---

# Books Feature Architecture

## Overview

The Books feature extends explorers.earth with creator-managed book recommendations. Creators curate custom lists, add personal notes and ratings, mark top reads, and share with visitors. Visitors browse public lists by creator, subject, or featured recommendations.

This document follows the exact same pattern established by the Movies & Shows feature.

## 1. Feature Module Structure

```
src/features/Books/
├── api/
│   ├── query.ts              — GraphQL queries (lists, books, subjects)
│   └── mutation.ts           — GraphQL mutations (CRUD operations)
├── components/
│   ├── dashboard/            — Creator dashboard (protected routes)
│   │   ├── BooksHome.tsx             — Main books dashboard view
│   │   ├── BookListView.tsx          — Single list detail + book management
│   │   ├── BookRow.tsx               — Draggable book row in list
│   │   ├── BookListManage.tsx        — Settings, QR, delete, sharing
│   │   ├── CreateBookListModal.tsx   — Create new list modal
│   │   ├── AddBookPage.tsx           — Page to add/edit book in list (Google Books search)
│   │   ├── GoogleBooksSearch.tsx     — Google Books autocomplete search component
│   │   ├── BuyLinks.tsx              — Buy/find link entry and chips
│   │   └── TopReadsManager.tsx       — Pin/feature top reads manager
│   └── public/               — Visitor-facing components
│       ├── PublicBooks.tsx           — Public books landing page
│       ├── BookCarouselRow.tsx       — Horizontal scrollable cover carousel
│       ├── BookCoverCard.tsx         — Cover + metadata compact card
│       ├── BookCoverSkeleton.tsx     — Loading skeleton
│       ├── BookDetailModal.tsx       — Slide-up book detail view
│       ├── PublicBookList.tsx        — List grid page for single list
│       ├── PublicBookSubject.tsx     — Subject grid page
│       └── SubjectBrowse.tsx        — Subject selection / discovery
├── hooks/
│   ├── useBookLists.ts               — Fetch creator's book lists
│   ├── useBooksByList.ts             — Fetch books in specific list
│   ├── usePinnedBooks.ts             — Fetch top reads across all lists
│   ├── useBookDetail.ts              — Fetch single book details
│   ├── useGoogleBooksSearch.ts       — Google Books search with debounce
│   └── useBookActions.ts             — Create, update, delete, pin, reorder
├── types/
│   └── index.ts              — TypeScript interfaces (BookList, Book, GoogleBooks*)
├── utils/
│   ├── subjectUtils.ts       — Subject slug generation, slug-to-name mapping
│   └── bookHelpers.ts        — Cover URL builders, author formatters, data transformers
└── index.ts                  — Public exports (components, hooks, types)
```

### Directory Explanations

**api/**
- `query.ts`: GraphQL queries (getBookLists, getBooksByList, getBookDetail, getPublicBooks, getTopReads, getPublishedLists, getBooksBySubject)
- `mutation.ts`: GraphQL mutations (createBookList, updateBookList, deleteBookList, createBook, updateBook, deleteBook, pinBook, reorderBooks, publishList)

**components/dashboard/**
- `BooksHome.tsx`: Dashboard landing showing creator's lists, top reads strip, create list button
- `BookListView.tsx`: Detailed view of single list with Recommendations and Manage tabs
- `BookRow.tsx`: Individual draggable book row with cover thumbnail, title, author, subjects, rating, note, action menu
- `BookListManage.tsx`: Settings panel with share URL, QR code, list settings, delete option
- `CreateBookListModal.tsx`: Form to create new list (name, description, cover)
- `AddBookPage.tsx`: Dedicated page to add/edit book (Google Books search, rich text notes, buy links, photos, user ratings)
- `GoogleBooksSearch.tsx`: Search input with debounce, autocomplete dropdown showing books with covers/authors
- `BuyLinks.tsx`: Editable list of buy/find links (Google Books auto-added + manual entries)
- `TopReadsManager.tsx`: Dedicated manager page at `/recommendations/books/top-reads`. Also usable as a slide-up modal (matching the `TopPicksManager` pattern from Movies) — the component is instantiated as a modal from BooksHome in some contexts.

**components/public/**
- `PublicBooks.tsx`: Public landing page for a creator's books (featured lists, carousels, subject browse). Top Reads are displayed in a carousel row, not a cinematic hero, due to portrait cover aspect ratios.
- `BookCarouselRow.tsx`: Horizontal scrollable carousel of book cover cards
- `BookCoverCard.tsx`: Compact cover card with image, title, author, rating badge (tappable)
- `BookCoverSkeleton.tsx`: Placeholder skeleton for loading state
- `BookDetailModal.tsx`: Slide-up overlay showing full book details, creator notes, buy links, photos
- `PublicBookList.tsx`: Grid page showing all books in a published list
- `PublicBookSubject.tsx`: Grid page showing all books in a subject
- `SubjectBrowse.tsx`: Subject selection interface (2x2 or 4xN grid of subject cards)

**hooks/**
- `useBookLists.ts`: Query creator's lists (useQuery with Apollo)
- `useBooksByList.ts`: Query books in a specific list ID
- `usePinnedBooks.ts`: Query top reads across all of creator's lists
- `useBookDetail.ts`: Query single book details (from Strapi)
- `useGoogleBooksSearch.ts`: Search Google Books with debounce, return formatted results
- `useBookActions.ts`: Mutations for CRUD and reorder operations

**types/index.ts**
```typescript
// GraphQL types (from Strapi schema)
export interface BookList {
  documentId: string;
  List_Name: string;
  slug: string;
  list_description: string | null;
  Visibility: boolean;
  cover_image: { url: string; alternativeText: string | null } | null;
  display_order: number;
  top_reads_heading: string | null;
  recommended_books: Book[];
  account: { documentId: string; username: string };
}

export interface Book {
  documentId: string;
  listId: string;
  // Google Books metadata
  volume_id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  published_date: string | null;
  year: string | null;
  description: string | null;
  cover_url: string | null;
  cover_url_large: string | null;
  subjects: string[];
  page_count: number | null;
  isbn_13: string | null;
  isbn_10: string | null;
  google_rating: number | null;
  ratings_count: number | null;
  language: string | null;
  preview_link: string | null;
  // Creator content
  user_recommendation_note: any;
  user_rating: number | null;       // 1-10 integer (matching Movies & Shows)
  buy_links: BuyLink[];
  is_pinned: boolean;
  pin_order: number | null;
  display_order: number;
  book_categories: BookCategory[];
  createdAt: string;
}

export interface BuyLink {
  name: string;
  url: string;
  logo?: string; // key for logo lookup (e.g., "google-books", "amazon")
}

export interface BookCategory {
  documentId: string;
  subject_name: string;
}

// Google Books API response types
export interface GoogleBooksSearchResult {
  id: string;
  volumeInfo: {
    title: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    averageRating?: number;
    ratingsCount?: number;
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
    };
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    language?: string;
    previewLink?: string;
  };
  saleInfo?: {
    buyLink?: string;
  };
}

export interface GoogleBooksVolumeDetail extends GoogleBooksSearchResult {
  // Same structure, but more fields guaranteed to be present
}
```

**utils/subjectUtils.ts**
- `subjectSlugFromName(name: string): string` — Convert subject name to URL slug
- `subjectNameFromSlug(slug: string): string` — Convert URL slug to display name
- `deduplicateSubjects(subjects: string[]): string[]` — Remove duplicates and sort
- `normalizeSubject(subject: string): string` — Simplify verbose Google Books subjects

**utils/bookHelpers.ts**
- `buildLargeCoverUrl(thumbnailUrl: string): string` — Build large cover URL from thumbnail
- `upgradeToHttps(url: string): string` — Upgrade http → https
- `formatAuthors(authors: string[]): string` — Format author list for display
- `formatAuthorsShort(authors: string[]): string` — First author + "et al."
- `extractYear(publishedDate: string): string` — Extract year from date string
- `extractISBN(identifiers: Array<{type: string, identifier: string}>, type: 'ISBN_13' | 'ISBN_10'): string | null`
- `transformGoogleBooksResult(item: GoogleBooksSearchResult): Partial<Book>` — Map API response to Strapi entity

## 2. Shared Components — Updates

These existing shared components need to be updated to include Books:

### src/components/DashboardSidebar.tsx

**Change:** Add Books item to the category list.

```typescript
// Update type to include 'books'
interface DashboardSidebarProps {
  currentCategory: 'places' | 'movies' | 'books';
  onCategoryChange: (category: 'places' | 'movies' | 'books') => void;
}

// Sidebar items (updated):
const items = [
  { key: 'places', label: 'Places', icon: MapPinIcon, route: '/recommendations' },
  { key: 'movies', label: 'Movies & Shows', icon: FilmIcon, route: '/recommendations/movies' },
  { key: 'books',  label: 'Books', icon: BookOpenIcon, route: '/recommendations/books' },
];
```

### src/components/CategoryCards.tsx

**Change:** Add Books card to the category cards grid.

```typescript
// Update type to include 'books'
interface CategoryCardsProps {
  currentCategory: 'places' | 'movies' | 'books';
  onCategoryChange: (category: 'places' | 'movies' | 'books') => void;
}

// Cards: Places, Movies & Shows, Books
```

### src/components/DashboardLayout.tsx

**Change:** Update prop type to accept `'books'`.

## 3. Route Structure

### Protected Routes (Dashboard) — src/routes/ProtectedRoutes.tsx

```typescript
// NEW: Books dashboard routes (add to existing ProtectedRoute elements)

<Route path="/recommendations/books" element={<ProtectedRoute><DashboardLayout currentCategory="books"><BooksHome /></DashboardLayout></ProtectedRoute>} />

<Route path="/recommendations/books/:listId" element={<ProtectedRoute><DashboardLayout currentCategory="books"><BookListView /></DashboardLayout></ProtectedRoute>} />

<Route path="/recommendations/books/:listId/new-book" element={<ProtectedRoute><DashboardLayout currentCategory="books"><AddBookPage mode="create" /></DashboardLayout></ProtectedRoute>} />

<Route path="/recommendations/books/:listId/:bookId/edit" element={<ProtectedRoute><DashboardLayout currentCategory="books"><AddBookPage mode="edit" /></DashboardLayout></ProtectedRoute>} />

<Route path="/recommendations/books/top-reads" element={<ProtectedRoute><DashboardLayout currentCategory="books"><TopReadsManager /></DashboardLayout></ProtectedRoute>} />
```

### Public Routes — src/routes/PublicRoutes.tsx

```typescript
// NEW: Public books routes (add to existing dynamic username routes)

<Route path="/:username/books" element={<PublicBooks />} />

<Route path="/:username/books/:listSlug" element={<PublicBookList />} />

<Route path="/:username/books/subject/:subjectSlug" element={<PublicBookSubject />} />
```

## 4. State Management

Same approach as Movies & Shows:

- **Apollo Client (GraphQL Cache):** Book lists and books cached by Strapi `__typename` + `id`
- **No Zustand store needed:** Apollo cache handles all shared data; form state is local; search results are ephemeral
- **Query policies:**
  - `cache-first`: Lists/books
  - `cache-and-network`: Top reads
  - `no-cache`: Google Books search (always fresh)

## 5. Google Books Service Module

Location: `src/services/googleBooksService.ts`

### Configuration

```typescript
const GOOGLE_BOOKS_API_BASE = 'https://www.googleapis.com/books/v1';
const GOOGLE_BOOKS_API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY;
```

### API Functions

```typescript
// Search volumes (books)
export async function searchBooks(
  query: string,
  options?: { maxResults?: number; langRestrict?: string }
): Promise<GoogleBooksSearchResult[]>

// Get single volume details
export async function getVolumeDetails(
  volumeId: string
): Promise<GoogleBooksVolumeDetail>

// Image URL helpers
export function getThumbnailUrl(volumeInfo: VolumeInfo): string | null
export function getLargeCoverUrl(thumbnailUrl: string): string
export function upgradeToHttps(url: string): string

// Data extraction helpers
export function extractISBN(
  identifiers: Array<{type: string; identifier: string}>,
  type: 'ISBN_13' | 'ISBN_10'
): string | null

export function extractYear(publishedDate: string): string
export function formatBuyLinks(saleInfo: SaleInfo): BuyLink[]
```

### Error Handling

```typescript
export class GoogleBooksError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'GoogleBooksError';
  }
}
```

### Debouncing Strategy

```typescript
export function useGoogleBooksSearch(query: string) {
  const [results, setResults] = useState<GoogleBooksSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await googleBooksService.searchBooks(query);
        setResults(data);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce — same as TMDB

    return () => clearTimeout(timer);
  }, [query]);

  return { results, loading };
}
```

## 6. Component Tree Diagrams

### Dashboard: Books Home

```
DashboardLayout (currentCategory="books")
├── DashboardSidebar (desktop, currentCategory="books")
├── CategoryCards (mobile, currentCategory="books")
└── BooksHome (creator's dashboard)
    ├── PageHeader (title, list count)
    ├── TopReadsStrip (horizontal carousel of pinned books)
    │   └── BookCoverCard[] (image, title, author)
    ├── BookListCard[] (card per list)
    │   ├── ListHeader (name, published toggle, stats)
    │   ├── BookCoverPreview[] (3-4 covers)
    │   └── ViewButton / EditButton
    └── CreateBookListModal (button + modal)
        ├── NameInput
        ├── DescriptionInput
        └── CreateButton
```

### Dashboard: Book List View

```
BookListView
├── ListHeader
│   ├── BackButton
│   ├── ListName (editable)
│   ├── BookCount badge
│   ├── PublishedToggle
│   └── Menu (more actions)
├── Tabs (Recommendations | Manage)
│   ├── Tab: Recommendations
│   │   ├── SortDropdown (date added, rating, title, pinned first)
│   │   ├── BookRow[]
│   │   │   ├── DragHandle
│   │   │   ├── Cover thumbnail
│   │   │   ├── Title + Author(s)
│   │   │   ├── Subjects (chip tags)
│   │   │   ├── Rating badge (google or user)
│   │   │   ├── Note preview (truncated)
│   │   │   ├── PinIcon (clickable ⭐)
│   │   │   └── Menu (edit, delete, move)
│   │   └── EmptyState + AddBookButton
│   └── Tab: Manage
│       └── BookListManage
│           ├── ShareURLField (copy button)
│           ├── QRCode display
│           ├── PublishedToggle
│           ├── ListSettings (name, description, slug, cover)
│           └── DeleteListButton (with confirmation)
└── EmptyState (if no books)
```

### Dashboard: Add/Edit Book Page

```
AddBookPage (Full page, mode: "create" | "edit")
├── BackNavigation / CloseButton
├── GoogleBooksSearch (Inline search)
│   ├── SearchInput (placeholder: "Search by title, author, or ISBN...")
│   ├── LoadingSpinner (debounced)
│   └── SearchResultRow[]
│       ├── Cover thumbnail
│       ├── Title + Author(s) + Year
│       ├── Publisher + Pages
│       └── SelectButton
├── SelectedBook Preview Auto-filled
│   ├── Large cover image
│   ├── Title + Subtitle
│   ├── Author(s)
│   ├── Publisher + Year + Pages
│   ├── Subjects (chip tags)
│   └── Description (truncated, expandable)
├── Details Form
│   ├── NoteField (TiptapEditor, "Why do I recommend this?")
│   ├── UserRating (1-5 Interactive star selector)
│   ├── BuyLinks (auto + manual)
│   │   ├── Auto: Google Books buyLink chip (if available)
│   │   └── AddLinkButton → input for name + URL
│   └── CreatorPhotosUpload (optional, multi-upload to S3)
└── SubmitButtons (Save | Cancel)
```

### Public: Books Home

```
PublicBooks (/:username/books)
├── PageHeader
│   ├── CreatorPhoto
│   ├── CreatorName
│   ├── BookCount + "Recommendations"
│   └── ShareButton
├── TopReadsCarousel (if creator has pinned books)
│   ├── CarouselHeader ("Top Reads" or custom name)
│   └── BookCarouselRow
│       └── BookCoverCard[]
├── PublishedListCarousel[] (per published list)
│   ├── ListHeader (name, count, ">" link)
│   ├── BookCarouselRow
│   │   └── BookCoverCard[] (tappable → detail modal)
│   └── ViewFullListButton
├── SubjectBrowse section
│   ├── SectionHeader ("Browse by Subject")
│   └── SubjectCard[]
│       ├── Cover image background
│       ├── Subject name
│       └── Book count
└── EmptyState (if creator has no published lists)
```

### Public: Detail Modal

```
BookDetailModal (slide-up overlay, fullscreen on mobile)
├── HeaderBar
│   ├── DragBar (mobile-only)
│   ├── Title + Author
│   └── CloseButton (X)
├── Content (scrollable)
│   ├── CoverImage (large)
│   ├── MetadataSection
│   │   ├── Title (large)
│   │   ├── Author(s) (secondary)
│   │   ├── Publisher · Year · Pages
│   │   ├── Subjects (chip group)
│   │   ├── GoogleRating badge (if available)
│   │   └── Description (expandable)
│   ├── CreatorSection
│   │   ├── UserRating (1-5 glowing stars)
│   │   └── CreatorNote (Tiptap formatted)
│   ├── BuyLinksSection (if any)
│   │   ├── "Where to Find"
│   │   └── BuyLinkChip[] (tappable, external)
│   ├── CreatorPhotosCarousel (if any)
│   └── SourceListLink → PublicBookList
├── FixedFooter
│   └── ShareButton
└── SafeAreaInsets (mobile)
```

## 7. Integration Points with Existing Code

All modifications are **additive only**. Existing places, movies, and guide features are untouched.

### src/routes/ProtectedRoutes.tsx
**Change:** Add book dashboard routes

### src/routes/PublicRoutes.tsx
**Change:** Add public book routes

### src/components/DashboardSidebar.tsx
**Change:** Add Books item to items array. Widen `currentCategory` type.

### src/components/CategoryCards.tsx
**Change:** Add Books card. Widen type.

### src/components/DashboardLayout.tsx
**Change:** Widen `currentCategory` type to `'places' | 'movies' | 'books'`.

### .env.example
**Change:** Add new environment variable:
```
# Google Books API
VITE_GOOGLE_BOOKS_API_KEY=your_google_books_api_key_here
```

### src/config.ts
**Change:** Add Google Books configuration:
```typescript
export const GOOGLE_BOOKS_CONFIG = {
  apiKey: import.meta.env.VITE_GOOGLE_BOOKS_API_KEY,
  apiBase: 'https://www.googleapis.com/books/v1',
};
```

### src/i18n/ locale files
**Change:** Add `books` namespace:
```json
{
  "dashboard": {
    "title": "Books",
    "createList": "Create New List",
    "topReads": "Top Reads",
    "noReads": "No top reads yet. Pin books to feature them here."
  },
  "list": {
    "name": "List Name",
    "bookCount": "{{count}} book",
    "bookCount_plural": "{{count}} books",
    "manage": "Manage",
    "recommendations": "Recommendations"
  },
  "book": {
    "addBook": "Add Book",
    "search": "Search by title, author, or ISBN...",
    "selectBook": "Select a book",
    "myNote": "My Note",
    "whereToFind": "Where to Find",
    "topRead": "Top Read",
    "pinAsTopRead": "Pin as top read",
    "authors": "by {{authors}}",
    "pages": "{{count}} pages"
  },
  "public": {
    "bookRecommendations": "{{creator}}'s Book Recommendations",
    "browseBySubject": "Browse by Subject",
    "viewFullList": "View full list",
    "nothingYet": "No books shared yet"
  }
}
```

## 8. Environment Variables

### New Variable
```
VITE_GOOGLE_BOOKS_API_KEY=<your_google_cloud_api_key>
```

**Notes:**
- Obtain from Google Cloud Console — create a project → enable Books API → create credentials (API key)
- Restrict key to HTTP referers: `explorers.earth/*` and `localhost:*`
- Without a key: works but uses shared anonymous quota (not recommended for production)
- Key is exposed in frontend bundle (same as TMDB key for Movies)
- Never commit actual keys to repo; use `.env.local` (already in .gitignore)

## 9. Conventions to Follow

Same conventions as Movies & Shows:
- **Strict TypeScript** — All components and hooks fully typed
- **Functional components only** — No class components
- **Apollo Client for GraphQL** — All Strapi queries/mutations go through Apollo
- **Formik + Yup** — Form state management and validation
- **Tiptap** — Rich text editor for creator notes (same instance as Movies)
- **dnd-kit** — Drag-and-drop for list reordering (same as Movies)
- **No inline styles** — All styling via CSS modules or Tailwind classes per project convention
