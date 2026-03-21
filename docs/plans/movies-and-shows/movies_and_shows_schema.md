---
Feature: movies-and-shows
Doc type: schema
Status: draft
Created: 2026-03-20
Last updated: 2026-03-20
Updated by: agent
Depends on: movies_and_shows_decisions.md
---

# Movies & Shows — Strapi Schema

Complete data model for the Movies & Shows feature. These collections need to be created in the Strapi admin panel (Content-Type Builder). 

> [!IMPORTANT]
> Since we use a unified S3 storage logic, remember to always use the `path` parameter when uploading media. See **Storage Logic** sections below.

---

## Collection 1: MovieList

**Purpose:** A themed list of movie/TV show recommendations created by a user (e.g., "Mind-Bending Sci-Fi", "Comfort Watches").

**API ID (singular):** `movie-list`
**API ID (plural):** `movie-lists`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `List_Name` | Short text | Yes | — | Display name of the list (e.g., "Mind-Bending Sci-Fi") |
| `list_description` | Long text | No | — | Creator's description of what this list is about |
| `slug` | Short Text | Yes | Auto | URL-safe slug for shareable links. Auto-generated from List_Name, editable. Must be unique per user. |
| `Visibility` | Boolean | Yes | `false` | Published (true) = visible on public page. Draft (false) = hidden. |
| `cover_image` | Media (single) | No | — | Cover image for the list. Falls back to first movie's poster if not set. |
| `display_order` | Integer | No | `0` | Order position on the public page. Lower = higher on page. |
| `top_picks_heading` | Short text | No | "Top Picks" | Custom display name for the Top Picks section on the public page |
| `account` | Relation (Many-to-One) | Yes | — | Relates to the user's Account. Many MovieLists belong to one Account. |
| `recommended_movies` | Relation (One-to-Many) | No | — | Movies in this list. One MovieList has many RecommendedMovies. |

### Notes for Strapi Admin
- `account` relation connects to the existing Account/User collection
- Enable Draft & Publish system if desired, or use the `Visibility` boolean (matching existing `RecommendationList` pattern)
- **Manual Path Configuration**: For `cover_image`, use the path: `{username}/movies/{movieListId}/cover/`
- Add API permissions for authenticated (CRUD) and public (find, findOne) access

---

## Collection 2: RecommendedMovie

**Purpose:** A single movie or TV show recommendation with TMDB metadata and the creator's personal note.

**API ID (singular):** `recommended-movie`
**API ID (plural):** `recommended-movies`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| **TMDB Metadata** | | | | |
| `tmdb_id` | Short text | Yes | — | TMDB unique identifier for the movie/show |
| `media_type` | Enumeration [`movie`, `tv`] | Yes | — | Whether this is a movie or TV series |
| `title` | Short text | Yes | — | Movie/show title |
| `original_title` | Short text | No | — | Original language title (if different) |
| `year` | Short text | No | — | Release year (movie) or first air year (TV). Stored as text for display flexibility (e.g., "2014", "2019-2025") |
| `poster_path` | Short text | No | — | TMDB poster image path (e.g., `/nBNZadXqJSdt05SHLqgT0HuC5Gm.jpg`). Build full URL at render time: `https://image.tmdb.org/t/p/{size}{poster_path}` |
| `backdrop_path` | Short text | No | — | TMDB backdrop image path. Used for genre section cards. |
| `genres` | JSON | No | `[]` | Array of genre objects: `[{ "id": 878, "name": "Science Fiction" }]` |
| `director` | Short text | No | — | Director name (movie) or creator name (TV) |
| `runtime` | Integer | No | — | Runtime in minutes (movie) or average episode runtime (TV) |
| `tmdb_rating` | Decimal | No | — | TMDB vote average (0-10 scale) |
| `overview` | Long text | No | — | TMDB synopsis/description |
| `season_count` | Integer | No | — | Number of seasons (TV only, null for movies) |
| **Creator Content** | | | | |
| `user_recommendation_note` | Rich text | No | — | Creator's personal recommendation note. Rich text for formatting. |
| `watch_providers` | JSON | No | `[]` | Streaming platforms array: `[{ "provider_name": "Netflix", "logo_path": "/path.jpg", "link": "https://...", "provider_id": 8 }]` |
| `is_pinned` | Boolean | No | `false` | Whether this movie is pinned to Top Picks |
| `pin_order` | Integer | No | `null` | Order within Top Picks (null if not pinned). Lower = earlier in Top Picks row. |
| `display_order` | Integer | No | `0` | Order within the list. Lower = earlier position. |
| **Media** | | | | |
| `Media` | Media (multiple) | No | — | Creator's uploaded photos/videos (max 10). Stored in S3 via Strapi upload endpoint at `{username}/movies/{movieListId}/{tmdbId}/{filename}` |
| `media_details` | JSON | No | — | Structured media metadata: `{ "imageDetails": [...], "thumbnail": "url" }`. Matches existing RecommendedPlace pattern. |
| **Relations** | | | | |
| `movie_list` | Relation (Many-to-One) | Yes | — | The MovieList this movie belongs to. Many RecommendedMovies belong to one MovieList. |
| `movie_category` | Relation | No | — | Links to the new Movie_Category collection (replaces older generic recommendation category logic). |

### Notes for Strapi Admin
- `tmdb_id` + `movie_list` combination should be unique (prevent duplicate movies in same list)
- `genres` is a JSON field storing the array as-is from TMDB. This avoids needing a separate Genres collection.
- `watch_providers` is a JSON field. Each object contains the platform name, logo path, deep link URL, and TMDB provider ID.
- `poster_path` and `backdrop_path` store only the TMDB path, NOT the full URL. The frontend builds the full URL using the TMDB image CDN base URL + desired size + path. This allows serving different image sizes for different contexts.
- `media_details` JSON structure matches the existing `RecommendedPlace.media_details` pattern for consistency.
- **S3 Storage Logic**: All media files must be uploaded with the specific `path` parameter to ensure organization:
  - `MovieList` cover: `{username}/movies/{movieListId}/cover/{filename}`
  - `RecommendedMovie` media: `{username}/movies/{movieListId}/{tmdbId}/{filename}`
- Add API permissions for authenticated (CRUD) and public (find, findOne) access.

---

## Collection 3: Movie_Category

**Purpose:** A dedicated category collection for the Movies & Shows feature, replacing the previous system of using general recommendation categories.

**API ID (singular):** `movie-category`
**API ID (plural):** `movie-categories`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `genre_name` | Text | Yes | — | The name of the movie or show genre (e.g., "Action", "Science Fiction", "Drama") |
| `recommended_movie` | Relation | No | — | Relates to the RecommendedMovie collection |

### Notes for Strapi Admin
- This completely replaces the previous logic of using the generic `RecommendationCategory` or `RecommendationSubCategory`.
- Keeps movies & shows categorized cleanly without polluting place-related recommendations.

---

## Relation Diagram

```
Account (existing)
    │
    ├── 1:N ── MovieList
    │              │
    │              ├── 1:N ── RecommendedMovie
    │              │              │
    │              │              └── Relation ── Movie_Category
    │              │
    │              └── (cover_image: Media)
    │
    └── 1:N ── RecommendationList (existing, untouched)
                   │
                   └── 1:N ── RecommendedPlace (existing, untouched)
```

---

## TMDB Image URL Construction

TMDB images are served from their CDN. The `poster_path` and `backdrop_path` fields store only the path portion.

**Base URL:** `https://image.tmdb.org/t/p/`

**Available poster sizes:** `w92`, `w154`, `w185`, `w342`, `w500`, `w780`, `original`

**Available backdrop sizes:** `w300`, `w780`, `w1280`, `original`

**Usage in frontend:**
```
Poster card (carousel): w342
Poster card (grid): w342
Detail modal poster: w500
Genre card backdrop: w780
```

**Example:**
- Stored: `/nBNZadXqJSdt05SHLqgT0HuC5Gm.jpg`
- Rendered: `https://image.tmdb.org/t/p/w342/nBNZadXqJSdt05SHLqgT0HuC5Gm.jpg`

---

## Migration Notes

- No migration of existing data required. These are entirely new collections.
- No changes to existing `RecommendationList`, `RecommendedPlace`, or any other existing collection.
- The new `MovieList`, `RecommendedMovie`, and `Movie_Category` collections are completely independent. They only share the `Account` relation with existing collections, keeping the movies & shows feature cleanly separated from places.
