---
Feature: books
Doc type: schema
Status: draft
Created: 2026-03-25
Last updated: 2026-03-25
Updated by: agent
Depends on: books_decisions.md
---

# Books — Strapi Schema

Complete data model for the Books feature. These collections need to be created in the Strapi admin panel (Content-Type Builder).

> [!IMPORTANT]
> Since we use a unified S3 storage logic, remember to always use the `path` parameter when uploading media. See **Storage Logic** sections below.

---

## Collection 1: BookList

**Purpose:** A themed list of book recommendations created by a user (e.g., "Life-Changing Reads", "Business Essentials", "Sci-Fi Classics").

**API ID (singular):** `book-list`
**API ID (plural):** `book-lists`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `List_Name` | Short text | Yes | — | Display name of the list (e.g., "Life-Changing Reads") |
| `list_description` | Long text | No | — | Creator's description of what this list is about |
| `slug` | Short text | Yes | Auto | URL-safe slug for shareable links. Auto-generated from List_Name, editable. Must be unique per user. |
| `Visibility` | Boolean | Yes | `false` | Published (true) = visible on public page. Draft (false) = hidden. |
| `cover_image` | Media (single) | No | — | Cover image for the list. Falls back to first book's cover if not set. |
| `display_order` | Integer | No | `0` | Order position on the public page. Lower = higher on page. |
| `top_reads_heading` | Short text | No | "Top Reads" | Custom display name for the Top Reads section on the public page |
| `account` | Relation (Many-to-One) | Yes | — | Relates to the user's Account. Many BookLists belong to one Account. |
| `recommended_books` | Relation (One-to-Many) | No | — | Books in this list. One BookList has many RecommendedBooks. |

### Notes for Strapi Admin
- `account` relation connects to the existing Account/User collection
- Use the `Visibility` boolean (matching existing `MovieList` pattern)
- **Manual Path Configuration**: For `cover_image`, use the path: `{username}/books/{bookListId}/cover/`
- Add API permissions for authenticated (CRUD) and public (find, findOne) access

---

## Collection 2: RecommendedBook

**Purpose:** A single book recommendation with Google Books metadata and the creator's personal note.

**API ID (singular):** `recommended-book`
**API ID (plural):** `recommended-books`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| **Google Books Metadata** | | | | |
| `volume_id` | Short text | Yes | — | Google Books unique volume identifier (e.g., `"zyTCAlFPjgYC"`) |
| `title` | Short text | Yes | — | Book title |
| `subtitle` | Short text | No | — | Book subtitle (if any) |
| `authors` | JSON | No | `[]` | Array of author name strings: `["James Clear", "Atomic Habits Co-Author"]` |
| `publisher` | Short text | No | — | Publisher name |
| `published_date` | Short text | No | — | Publication date. Stored as text for flexibility (e.g., "2018", "2018-10-16") |
| `year` | Short text | No | — | Publication year extracted from `published_date`. For display use. |
| `description` | Long text | No | — | Google Books description/synopsis |
| `cover_url` | Short text | No | — | Full Google Books thumbnail URL (e.g., `http://books.google.com/books/content?id=...&zoom=1`). Used directly in `<img>` tags. |
| `cover_url_large` | Short text | No | — | Larger Google Books cover URL (zoom=0 variant). Used in detail modal. |
| `subjects` | JSON | No | `[]` | Array of subject/category strings from Google Books: `["Self-Help", "Business & Economics"]` |
| `page_count` | Integer | No | — | Total page count |
| `isbn_13` | Short text | No | — | ISBN-13 identifier for future integrations |
| `isbn_10` | Short text | No | — | ISBN-10 identifier |
| `google_rating` | Decimal | No | — | Google Books average rating (0-5 scale) |
| `ratings_count` | Integer | No | — | Number of Google Books ratings |
| `language` | Short text | No | `"en"` | Language code (e.g., "en", "fr") |
| `preview_link` | Short text | No | — | Google Books preview/about page URL |
| **Creator Content** | | | | |
| `user_recommendation_note` | Rich text | No | — | Creator's personal recommendation note. Tiptap/Blocks format. |
| `user_rating` | Integer | No | — | User's 1-10 rating (consistent with Movies & Shows feature) |
| `buy_links` | JSON | No | `[]` | Array of buy/find link objects: `[{ "name": "Google Books", "url": "...", "logo": "google-books" }, { "name": "Amazon", "url": "...", "logo": "amazon" }]` |
| `is_pinned` | Boolean | No | `false` | Whether this book is pinned to Top Reads |
| `pin_order` | Integer | No | `null` | Order within Top Reads (null if not pinned). Lower = earlier. |
| `display_order` | Integer | No | `0` | Order within the list. Lower = earlier position. |
| **Media** | | | | |
| `Media` | Media (multiple) | No | — | Creator's uploaded photos (max 10). Stored in S3 at `{username}/books/{bookListId}/{volumeId}/{filename}` |
| `media_details` | JSON | No | — | Structured media metadata: `{ "imageDetails": [...], "thumbnail": "url" }`. Matches existing RecommendedPlace/RecommendedMovie pattern. |
| **Relations** | | | | |
| `book_list` | Relation (Many-to-One) | Yes | — | The BookList this book belongs to. Many RecommendedBooks belong to one BookList. |
| `book_categories` | Relation (Many-to-Many) | No | — | Links to the Book_Category collection representing matched Google Books subjects. |

### Notes for Strapi Admin
- `volume_id` + `book_list` combination should be unique (prevent duplicate books in same list)
- `subjects` is a JSON field storing the array as-is from Google Books
- `authors` is a JSON array. Display as comma-separated list. Multiple authors are common.
- `cover_url` stores the full URL returned directly by Google Books API (unlike TMDB which stores only the path)
- `buy_links` JSON structure: Each entry has `name` (display name), `url` (link URL), and optionally `logo` (key for logo image lookup)
- `media_details` JSON structure matches the existing `RecommendedPlace.media_details` and `RecommendedMovie.media_details` pattern
- **S3 Storage Logic**: All media files must be uploaded with the specific `path` parameter:
  - `BookList` cover: `{username}/books/{bookListId}/cover/{filename}`
  - `RecommendedBook` media: `{username}/books/{bookListId}/{volumeId}/{filename}`
- Add API permissions for authenticated (CRUD) and public (find, findOne) access

---

## Collection 3: Book_Category

**Purpose:** A dedicated category collection for the Books feature, representing Google Books subjects/genres.

**API ID (singular):** `book-category`
**API ID (plural):** `book-categories`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `subject_name` | Short text | Yes | — | The name of the book subject/genre (e.g., "Fiction", "Business & Economics", "Self-Help") |
| `recommended_books` | Relation (Many-to-Many) | No | — | Relates to the RecommendedBook collection |

### Notes for Strapi Admin
- Mirrors the `Movie_Category` collection pattern
- Keeps books categorized cleanly without polluting place or movie recommendations
- Subject names should match Google Books subject strings for easy mapping

---

## Relation Diagram

```
Account (existing)
    │
    ├── 1:N ── BookList
    │              │
    │              ├── 1:N ── RecommendedBook
    │              │              │
    │              │              └── M:M ── Book_Category
    │              │
    │              └── (cover_image: Media)
    │
    ├── 1:N ── MovieList (existing, untouched)
    │              │
    │              └── 1:N ── RecommendedMovie (existing, untouched)
    │
    └── 1:N ── RecommendationList (existing, untouched)
                   │
                   └── 1:N ── RecommendedPlace (existing, untouched)
```

---

## Google Books Cover URL Construction

Google Books returns cover image URLs directly (not a base + path pattern like TMDB).

**URL format returned by API:**
```
http://books.google.com/books/content?id={volumeId}&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api
```

**Size variants:**
- `zoom=1` — Thumbnail (~128px wide) — use for carousel cards
- `zoom=0` — Larger (~400px wide) — use for detail modal
- `&fife=w400-h600` — Specify exact dimensions via Google's Fife image service

**Upgrade to HTTPS:** Google Books sometimes returns `http://` URLs. Always upgrade to `https://` in the service layer before storing or rendering.

**Usage in frontend:**
```
Cover card (carousel): cover_url (zoom=1, thumbnail)
Cover card (grid): cover_url (zoom=1, thumbnail)
Detail modal cover: cover_url_large (zoom=0) or cover_url with fife param
Subject card: cover_url of a representative book in that subject
```

**Example:**
- Stored `cover_url`: `https://books.google.com/books/content?id=zyTCAlFPjgYC&printsec=frontcover&img=1&zoom=1`
- Stored `cover_url_large`: `https://books.google.com/books/content?id=zyTCAlFPjgYC&printsec=frontcover&img=1&zoom=0`

---

## Migration Notes

- No migration of existing data required. These are entirely new collections.
- No changes to existing `RecommendationList`, `RecommendedPlace`, `MovieList`, `RecommendedMovie`, or any other existing collection.
- The new `BookList`, `RecommendedBook`, and `Book_Category` collections are completely independent. They only share the `Account` relation with existing collections, keeping the books feature cleanly separated from places and movies.
