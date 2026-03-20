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

Complete data model for the Movies & Shows feature. These collections need to be created in the Strapi admin panel.

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
| `slug` | UID (from List_Name) | Yes | Auto | URL-safe slug for shareable links. Auto-generated from List_Name, editable. Must be unique per user. |
| `Visibility` | Boolean | Yes | `false` | Published (true) = visible on public page. Draft (false) = hidden. |
| `cover_image` | Media (single) | No | — | Cover image for the list. Falls back to first movie's poster if not set. |
| `display_order` | Integer | No | `0` | Order position on the public page. Lower = higher on page. |
| `top_picks_heading` | Short text | No | "Top Picks" | Custom display name for the Top Picks section on the public page |
| `account` | Relation (Many-to-One) | Yes | — | Relates to the user's Account. Many MovieLists belong to one Account. |
| `recommended_movies` | Relation (One-to-Many) | No | — | Movies in this list. One MovieList has many RecommendedMovies. |

### Notes for Strapi Admin
- `slug` should use Strapi's UID field type linked to `List_Name`
- `account` relation connects to the existing Account/User collection
- Enable Draft & Publish system if desired, or use the `Visibility` boolean (matching existing `RecommendationList` pattern)
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
| `tmdb_id` | Integer | Yes | — | TMDB unique identifier for the movie/show |
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
| `Media` | Media (multiple) | No | — | Creator's uploaded photos/videos (max 10) |
| `media_details` | JSON | No | — | Structured media metadata: `{ "imageDetails": [...], "thumbnail": "url" }`. Matches existing RecommendedPlace pattern. |
| **Relations** | | | | |
| `movie_list` | Relation (Many-to-One) | Yes | — | The MovieList this movie belongs to. Many RecommendedMovies belong to one MovieList. |
| `recommendation_category` | Relation (Many-to-One) | No | — | Links to existing RecommendationCategory (auto-matched to "Entertainment" or a new "Movies & Shows" category) |
| `recommendation_sub_category` | Relation (Many-to-One) | No | — | Links to existing RecommendationSubCategory (e.g., "Sci-Fi", "Drama", "Documentary") |

### Notes for Strapi Admin
- `tmdb_id` + `movie_list` combination should be unique (prevent duplicate movies in same list)
- `genres` is a JSON field storing the array as-is from TMDB. This avoids needing a separate Genres collection.
- `watch_providers` is a JSON field. Each object contains the platform name, logo path, deep link URL, and TMDB provider ID.
- `poster_path` and `backdrop_path` store only the TMDB path, NOT the full URL. The frontend builds the full URL using the TMDB image CDN base URL + desired size + path. This allows serving different image sizes for different contexts.
- `media_details` JSON structure matches the existing `RecommendedPlace.media_details` pattern for consistency.
- Add API permissions for authenticated (CRUD) and public (find, findOne) access.

---

## Category Additions

### Option A: Use Existing "Entertainment" Category
The existing `RecommendationCategory` collection has an "Entertainment" category. Movies could use this.

### Option B: Create New "Movies & Shows" Category (Recommended)
Create a new entry in the existing `RecommendationCategory` collection:

| Field | Value |
|---|---|
| `Category_Name` | Movies & Shows |
| Sub-categories | Action, Adventure, Animation, Comedy, Crime, Documentary, Drama, Family, Fantasy, History, Horror, Music, Mystery, Romance, Science Fiction, Thriller, War, Western, Reality, Talk Show |

**Recommendation:** Option B. A dedicated "Movies & Shows" category keeps movie sub-categories separate from place sub-categories (the existing "Entertainment" category has place-oriented subs like "amusement_park", "movie_theater", "museum").

---

## Relation Diagram

```
Account (existing)
    │
    ├── 1:N ── MovieList
    │              │
    │              ├── 1:N ── RecommendedMovie
    │              │              │
    │              │              ├── N:1 ── RecommendationCategory (existing)
    │              │              │
    │              │              └── N:1 ── RecommendationSubCategory (existing)
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

- No migration of existing data required. This is entirely new collections.
- No changes to existing `RecommendationList`, `RecommendedPlace`, or any other existing collection.
- The new `MovieList` and `RecommendedMovie` collections are independent — they share the `Account` relation and the `RecommendationCategory`/`RecommendationSubCategory` relations with existing collections, but no data dependencies.
