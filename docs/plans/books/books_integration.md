---
Feature: books
Doc type: integration
Status: draft
Created: 2026-03-25
Last updated: 2026-03-25
Updated by: agent
Depends on: books_api_contract.md
---

# Books Integration — Google Books API

## 1. Google Books API Overview

**Service:** Google Books API — https://developers.google.com/books

- **API Version:** v1
- **Base URL:** `https://www.googleapis.com/books/v1`
- **Documentation:** https://developers.google.com/books/docs/v1/reference
- **Free Tier:** Yes — 1,000 requests/day without API key (shared quota); with API key up to 1,000 requests per 100 seconds per user
- **Attribution Requirement:** Display "Powered by Google" badge on any page using Google Books data. Use the official Google Books branding.

## 2. Authentication

- **API Key:** Query parameter `?key={apiKey}`
- **No key (anonymous):** Works but shares the default quota pool — not recommended for production
- **Recommendation:** Use a Google Cloud API key restricted to the Books API and the explorers.earth domain
- **Key Storage:** `VITE_GOOGLE_BOOKS_API_KEY` environment variable
- **Client-Side Usage:** The API key is exposed in the frontend bundle. Mitigate by restricting the key in Google Cloud Console to specific HTTP referer(s): `explorers.earth`, `localhost:*`

## 3. Rate Limits

- **Requests per day:** 1,000 (without key, shared); higher with API key and billing enabled
- **Requests per 100 seconds per user:** 100 (anonymous), 1,000 (with API key)
- **Rate Limited Response:** HTTP 429

### Mitigation Strategy

- **Debounce Search Input:** 300ms debounce on search bar input (mirrors TMDB integration)
- **Cache Search Results:** Store search results in component state; if user searches same term, use cached results
- **Efficient Detail Fetch:** Only one API call per book selection (volume detail endpoint)
- **No Public Page API Calls:** Public pages read from Strapi only — Google Books API is never called by visitors

## 4. Endpoints Used

### 4.1 Search Volumes

**Endpoint:** `GET /volumes`

**Purpose:** Search for books by title, author, ISBN, or keyword

**Parameters:**
- `q` (string, required) — search query
  - Search by title: `q=intitle:Atomic+Habits`
  - Search by author: `q=inauthor:James+Clear`
  - Search by ISBN: `q=isbn:9780735211292`
  - General keyword: `q=atomic+habits`
- `maxResults` (int, default 10, max 40) — number of results to return
- `startIndex` (int, default 0) — pagination offset
- `langRestrict` (string, optional) — restrict to a language (e.g., `en`)
- `printType` (string) — `books` to exclude magazines
- `orderBy` (string) — `relevance` (default) or `newest`
- `key` (string) — API key

**When Called:** As the creator types in the Google Books search bar (debounced 300ms)

**Response Fields Used:**
- `items[].id` — Google Books volume ID
- `items[].volumeInfo.title` — book title
- `items[].volumeInfo.subtitle` — subtitle (if any)
- `items[].volumeInfo.authors[]` — array of author names
- `items[].volumeInfo.publisher` — publisher name
- `items[].volumeInfo.publishedDate` — publication date (YYYY or YYYY-MM-DD)
- `items[].volumeInfo.description` — synopsis
- `items[].volumeInfo.pageCount` — total pages
- `items[].volumeInfo.categories[]` — subject categories
- `items[].volumeInfo.averageRating` — Google Books rating (0-5)
- `items[].volumeInfo.ratingsCount` — number of ratings
- `items[].volumeInfo.imageLinks.thumbnail` — cover image URL (zoom=1)
- `items[].volumeInfo.imageLinks.smallThumbnail` — smaller cover image URL
- `items[].volumeInfo.industryIdentifiers[]` — ISBNs (type: ISBN_13 or ISBN_10)
- `items[].volumeInfo.language` — language code
- `items[].volumeInfo.previewLink` — Google Books page URL
- `items[].saleInfo.buyLink` — Google Play Books purchase link (if available)

**Note:** Filter results to only show volumes with `volumeInfo` present. Some results may be magazines or partial data — apply `printType=books` to reduce noise.

### 4.2 Volume Details

**Endpoint:** `GET /volumes/{volumeId}`

**Purpose:** Get full details for a specific volume after selection in search

**Parameters:**
- `volumeId` (path parameter) — Google Books volume ID
- `key` (string) — API key

**When Called:** After creator selects a book from search results (to get the most complete and up-to-date data)

**Response Fields Used:**
Same as search endpoint's `items[0]`, but more complete:
- `id` — volume ID
- `volumeInfo.title`
- `volumeInfo.subtitle`
- `volumeInfo.authors[]`
- `volumeInfo.publisher`
- `volumeInfo.publishedDate`
- `volumeInfo.description`
- `volumeInfo.pageCount`
- `volumeInfo.categories[]`
- `volumeInfo.averageRating`
- `volumeInfo.ratingsCount`
- `volumeInfo.imageLinks.thumbnail` — `zoom=1` cover
- `volumeInfo.imageLinks.small` — `zoom=2` cover
- `volumeInfo.imageLinks.medium` — `zoom=3` cover
- `volumeInfo.imageLinks.large` — `zoom=0` cover (highest quality from standard fields)
- `volumeInfo.industryIdentifiers[]` — ISBNs
- `volumeInfo.language`
- `volumeInfo.previewLink`
- `saleInfo.buyLink`

**Note:** The `imageLinks` may contain `thumbnail`, `smallThumbnail`, `small`, `medium`, `large`, `extraLarge`. Not all sizes are always present. Store `thumbnail` as `cover_url` and derive the large variant.

## 5. Image URL Construction

Unlike TMDB (base + path), Google Books returns full image URLs with query parameters.

**Zoom levels via URL parameter:**
- `zoom=5` — Small thumbnail (~80px)
- `zoom=1` — Default thumbnail (~128px) — use for carousel/grid cards
- `zoom=2` — Small (~200px)
- `zoom=3` — Medium (~300px)
- `zoom=0` — Large (~400px) — use for detail modal

**Fife image service (alternative):**
- Append `&fife=w400-h600` to get a specific size from Google's image server
- Example: `https://books.google.com/books/content?id=zyTCAlFPjgYC&printsec=frontcover&img=1&zoom=1&fife=w400-h600`

**HTTPS upgrade:**
Google Books sometimes returns `http://` image URLs. Always upgrade to `https://` before storing or rendering:
```typescript
function upgradeToHttps(url: string): string {
  return url.replace(/^http:\/\//, 'https://');
}
```

**Usage guidelines:**
- **Carousel card cover:** `zoom=1` (thumbnail)
- **Grid cover:** `zoom=1` (thumbnail)
- **Detail modal cover:** `zoom=0` (large) or fife `w400`
- **Subject card background:** `zoom=1` of representative book

**Storage:**
Store both `cover_url` (thumbnail, zoom=1) and `cover_url_large` (zoom=0 or fife variant) in Strapi at save time. This prevents URL reconstruction issues.

## 6. Data Mapping (Google Books → Strapi)

| Google Books Field | Strapi Field | Transform |
|---|---|---|
| `id` | `volume_id` | Direct |
| `volumeInfo.title` | `title` | Direct |
| `volumeInfo.subtitle` | `subtitle` | Direct (may be null) |
| `volumeInfo.authors` | `authors` | Direct (JSON array, may be empty) |
| `volumeInfo.publisher` | `publisher` | Direct (may be null) |
| `volumeInfo.publishedDate` | `published_date` | Direct (stored as text) |
| `volumeInfo.publishedDate` | `year` | Extract first 4 chars: `"2018-10-16"` → `"2018"` |
| `volumeInfo.description` | `description` | Direct (may be HTML, sanitize) |
| `volumeInfo.imageLinks.thumbnail` | `cover_url` | Upgrade http → https |
| (derived) | `cover_url_large` | Replace `zoom=1` with `zoom=0` in cover_url |
| `volumeInfo.categories` | `subjects` | Direct (JSON array) |
| `volumeInfo.pageCount` | `page_count` | Direct (may be 0 or null) |
| `volumeInfo.industryIdentifiers[type=ISBN_13].identifier` | `isbn_13` | Extract from array |
| `volumeInfo.industryIdentifiers[type=ISBN_10].identifier` | `isbn_10` | Extract from array |
| `volumeInfo.averageRating` | `google_rating` | Direct (0-5 scale) |
| `volumeInfo.ratingsCount` | `ratings_count` | Direct |
| `volumeInfo.language` | `language` | Direct |
| `volumeInfo.previewLink` | `preview_link` | Direct |
| `saleInfo.buyLink` | `buy_links[0]` | Wrap in object: `{ name: "Google Books", url: buyLink, logo: "google-books" }` |

## 7. Search Query Strategy

Google Books search supports field-specific queries:

```
intitle:     - Search in title only
inauthor:    - Search in author only
inpublisher: - Search in publisher
subject:     - Search by subject category
isbn:        - Search by ISBN (exact)
```

**Implementation:**
The `GoogleBooksSearch` component sends a plain text query to the API with `printType=books`. As the creator types:
1. If the query looks like an ISBN (13 digits or 10 chars starting with digit), send as `q=isbn:{query}`
2. Otherwise, send as a general search: `q={query}&printType=books&orderBy=relevance`

## 8. Error Handling

| Error | HTTP Code | Handling |
|---|---|---|
| Invalid API key | 400 | Show error to creator. Check `VITE_GOOGLE_BOOKS_API_KEY` config. |
| Not found | 404 | Show "Book not found" |
| Rate limited | 429 | Retry after 1 second (max 2 retries). Show "Please wait..." if still failing. |
| Network error | — | Show "Unable to search. Check your internet connection." |
| Empty search results | 200 (totalItems: 0) | Show "No results found for '[query]'. Try searching by ISBN or different keywords." |
| No cover image | 200 (imageLinks: null) | Use fallback generic book cover placeholder |
| API quota exceeded | 403 | Show "Search temporarily unavailable. Please try again later." |

## 9. Google Books Attribution Requirement

Google Books requires attribution when displaying their data. Add a small "Powered by Google" badge on:
- The public books page footer
- The add book overlay
- Official branding assets at: https://developers.google.com/books/branding

Attribution text: "Book data provided by Google Books"

## 10. Failure Modes & Resilience

### Google Books API Down During Add Flow
- Creator cannot search for books. Show error state in search.
- Creator can still manage existing books (all data stored in Strapi).
- Public pages are unaffected (they read from Strapi only).

### Google Books Image URLs Broken
- Cover images fail to load on public pages.
- Fallback: show generic book cover placeholder with book title text.
- This is a rare scenario — Google's image CDN has excellent uptime.

### Google Books Data Stale
- Our stored data becomes stale over time. Acceptable for v1.
- **Future enhancement:** Periodic refresh job to update metadata for stored books.

### Missing Metadata
- Many books on Google Books have incomplete data (no cover, no page count, no description).
- Fallback display rules:
  - No cover → show generic book cover placeholder
  - No description → hide description section in detail modal
  - No authors → show "Unknown Author"
  - No page count → hide page count badge
  - No publisher → hide publisher line
