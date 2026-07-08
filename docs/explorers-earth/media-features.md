# explorers-earth — Curation Categories (Movies, Books, Games, Apps, Products)

## Overview

Beyond places, explorers-earth supports multiple recommendation categories: Movies & Shows, Books, Games, Apps & Tools, and Products. Each is an independent feature module under `src/features/` backed by a dedicated API or metadata service.

## Architecture Pattern

All features share the same architectural pattern:

```
Feature Module (src/features/{Movies|Books|Games|AppsAndTools|Products}/)
  ├── components/         # UI (dashboard, list cards, modals, search/scraper)
  ├── hooks/              # Feature-specific data hooks
  └── index.ts            # Module exports

Service (src/services/{tmdb|googleBooks|igdb}Service.ts or scraper endpoint)
  └── Third-party API / Scraper calls (search, metadata, images)
```

---

## Slug Prefixing Strategy

To avoid global uniqueness conflicts between content types (e.g. an apps list and a movies list could both be named "favorites"), all curation category list slugs are **prefixed at the persistence layer**:

| Content Type | Slug Prefix | Example Stored Slug |
|---|---|---|
| Movies / Shows | `movies-` | `movies-my-watchlist` |
| Books | `books-` | `books-reading-2026` |
| Games | `games-` | `games-indie-gems` |
| Apps & Tools | `apps-` | `apps-dev-utilities` |
| Products | `products-` | `products-desk-setup` |

The prefix is added when creating or saving a list in Strapi, and public-facing URLs expose the prefixed slug transparently. The UI strips or handles the prefix to keep display names clean.

---

## Movies & Shows (`features/Movies/`)

**API**: TMDB (The Movie Database)  
**Service**: `src/services/tmdbService.ts`  
**Config**: `VITE_TMDB_API_KEY`, `VITE_TMDB_ACCESS_TOKEN`

### TMDB Image URLs

Images are constructed from constants defined in `src/config.ts`:

```typescript
TMDB_API_BASE  = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p"

// Poster sizes
TMDB_POSTER_SIZE = { xs: "w92", sm: "w185", md: "w342", lg: "w500", xl: "w780", original: "original" }

// Backdrop sizes
TMDB_BACKDROP_SIZE = { sm: "w300", md: "w780", lg: "w1280", original: "original" }
```

Image URL pattern: `{TMDB_IMAGE_BASE}/{size}/{path}`

### Key Capabilities

- Movie/show search by title
- Fetch detailed metadata (cast, crew, overview, ratings, runtime)
- Poster and backdrop image retrieval
- Lists use `movies-` slug prefix

---

## Books (`features/Books/`)

**API**: Google Books API  
**Service**: `src/services/googleBooksService.ts`  
**Config**: `VITE_GOOGLE_BOOKS_API_KEY`

### Search

Books are searched by free-text query (title, author, ISBN). The API returns `VolumeInfo` objects with:

| Field | Description |
|-------|-------------|
| `title` | Book title |
| `authors` | Array of author names |
| `publisher` | Publisher name |
| `publishedDate` | Publication date |
| `description` | Book synopsis |
| `pageCount` | Number of pages |
| `imageLinks.thumbnail` | Cover image URL |

### Key Capabilities

- Full-text book search
- Volume metadata and cover images
- Lists use `books-` slug prefix

---

## Games (`features/Games/`)

**API**: IGDB (Internet Game Database) via Twitch  
**Service**: `src/services/igdbService.ts`  
**Config**: `VITE_IGDB_CLIENT_ID`, `VITE_IGDB_CLIENT_SECRET`

### Authentication

IGDB uses Twitch OAuth 2.0 client credentials flow. The service fetches a short-lived access token (typically valid for ~60 days) before making API requests:

```
POST https://id.twitch.tv/oauth2/token
  ?client_id={VITE_IGDB_CLIENT_ID}
  &client_secret={VITE_IGDB_CLIENT_SECRET}
  &grant_type=client_credentials

→ { access_token, expires_in, token_type }
```

The access token is then used as a Bearer token in IGDB API calls alongside the `Client-ID` header.

### Key Capabilities

- Game search by title
- Detailed game metadata (genres, platforms, release date, ratings)
- Cover art images
- Lists use `games-` slug prefix

---

## Apps & Tools (`features/AppsAndTools/`)

**API**: Custom URL Scraper  
**Service**: Backend metadata extraction API (`/api/apps/scrape-url`)  

### Key Capabilities

- Paste URL and auto-enrich app metadata (title, description, and high-res logos/favicons).
- Supports macOS, Windows, Linux, iOS, Android, Web, and Extensions.
- Price tier tags (Free, Freemium, Paid, Subscription).
- Self-hosted logo & screenshots stored on S3.
- Lists use `apps-` slug prefix.

---

## Products (`features/Products/`)

**API**: Custom Retail Scraper  
**Service**: Backend link extraction API (`/api/products/scrape-link`)  

### Key Capabilities

- Paste product page URL (Amazon, Shopify, Etsy, Nike, etc.) to extract brand, title, description, price, currency, and image gallery via Open Graph / JSON-LD schemas.
- Structured JSON Specifications System (dynamic key-value specs grid).
- Price and currency (ISO) tracking.
- Affiliate buy links formatting.
- Lists use `products-` slug prefix.

---

## Related Documentation

- [Integrations](integrations.md) — Full API configuration details (TMDB, IGDB, Google Books)
- [Environment Variables](../environment-variables.md) — All API keys
- [Overview](overview.md) — Full feature module list and platform description

