---
Feature: movies-and-shows
Doc type: integration
Status: draft
Created: 2026-03-20
Last updated: 2026-03-20
Updated by: agent
Depends on: movies_and_shows_api_contract.md
---

# Movies & Shows Integration — TMDB API

## 1. TMDB API Overview

**Service:** The Movie Database (TMDB) — https://www.themoviedb.org/

- **API Version:** v3
- **Base URL:** `https://api.themoviedb.org/3`
- **Image CDN:** `https://image.tmdb.org/t/p/`
- **Documentation:** https://developer.themoviedb.org/docs
- **Free Tier:** Yes, free for non-commercial and commercial use with attribution
- **Attribution Requirement:** "This product uses the TMDB API but is not endorsed or certified by TMDB." Must display the TMDB logo on pages using their data.

## 2. Authentication

- **API Key (v3 auth):** Query parameter `?api_key={key}` or header `Authorization: Bearer {read_access_token}`
- **Recommendation:** Use v3 API key via query parameter for simplicity
- **Key Storage:** `VITE_TMDB_API_KEY` environment variable
- **Client-Side Usage:** The API key is exposed in the client bundle. This is acceptable — TMDB keys are free and TMDB allows client-side usage.

## 3. Rate Limits

- **Rate Limit:** Approximately 40 requests per 10 seconds per API key
- **Daily Limit:** None
- **Rate Limit Header:** Response header `X-RateLimit-Remaining` indicates remaining requests
- **Rate Limited Response:** HTTP 429

### Mitigation Strategy

- **Debounce Search Input:** 300ms debounce on search bar input to avoid rapid-fire requests during typing
- **Cache Search Results:** Store search results in component state; if user searches the same term again, use cached results
- **Cache Genre Lists:** Cache genre lists in session; they rarely change
- **Add Flow Efficiency:** For the add flow, only 2-3 API calls per movie (search + details + watch providers), well within rate limits

## 4. Endpoints Used

### 4.1 Search Multi

**Endpoint:** `GET /search/multi`

**Purpose:** Search for movies AND TV shows in one call

**Parameters:**
- `query` (string, required) — search term
- `page` (int, default 1) — pagination
- `include_adult` (boolean, default false)
- `language` (string, default "en-US")

**When Called:** As the creator types in the TMDB search bar (debounced)

**Response Fields Used:**
- `results[].id` — TMDB ID
- `results[].media_type` — `"movie"` or `"tv"` (filter out `"person"`)
- `results[].title` (movie) or `results[].name` (TV)
- `results[].release_date` (movie) or `results[].first_air_date` (TV)
- `results[].poster_path` — image path
- `results[].genre_ids` — array of genre IDs
- `results[].vote_average` — rating (0-10)
- `results[].overview` — description

**Note:** Filter results to only `media_type === "movie"` or `media_type === "tv"`. Ignore `"person"` results.

### 4.2 Movie Details

**Endpoint:** `GET /movie/{movie_id}`

**Purpose:** Get full movie details after selection

**Parameters:**
- `append_to_response=credits,watch/providers` — get credits and streaming in same call
- `language` (string)

**When Called:** After creator selects a movie from search results

**Response Fields Used:**
- `id` — TMDB ID
- `title` — movie title
- `original_title`
- `release_date` — YYYY-MM-DD
- `poster_path` — image path
- `backdrop_path` — image path
- `genres[].id` — genre IDs
- `genres[].name` — genre names
- `vote_average` — rating (0-10 decimal)
- `overview` — description
- `runtime` — duration in minutes
- `credits.crew` — filter for `job === "Director"` to get director name(s)
- `watch/providers.results.{region}` — streaming availability (flatrate, rent, buy arrays)

### 4.3 TV Details

**Endpoint:** `GET /tv/{tv_id}`

**Purpose:** Get full TV show details after selection

**Parameters:**
- `append_to_response=credits,watch/providers` — get credits and streaming in same call
- `language` (string)

**When Called:** After creator selects a TV show from search results

**Response Fields Used:**
- `id` — TMDB ID
- `name` — show title
- `original_name`
- `first_air_date` — YYYY-MM-DD
- `poster_path` — image path
- `backdrop_path` — image path
- `genres[].id` — genre IDs
- `genres[].name` — genre names
- `vote_average` — rating (0-10 decimal)
- `overview` — description
- `episode_run_time[0]` — average episode length in minutes
- `number_of_seasons` — total season count
- `created_by[0].name` — primary creator/showrunner
- `watch/providers.results.{region}` — streaming availability

### 4.4 Watch Providers

**Endpoint:** Included in movie/TV details via `append_to_response=watch/providers`

**Purpose:** Get streaming platform availability

**Data Structure:**
- `watch/providers.results` is keyed by country code (e.g., `"US"`, `"IN"`, `"GB"`)
- Fields per provider: `provider_name`, `logo_path`, `provider_id`
- Categories: `flatrate` (subscription streaming), `rent`, `buy`

**Region Detection:** Use the creator's browser locale or a default region. Store at save time.

**Deep Link:** TMDB provides a `link` field per region that goes to TMDB's "Where to Watch" page. For direct streaming links, we would need JustWatch or similar (out of scope for v1 — use TMDB's link).

### 4.5 Genre Lists

**Endpoint:** `GET /genre/movie/list` and `GET /genre/tv/list`

**Purpose:** Map genre IDs to genre names (search results return `genre_ids`, not names)

**When Called:** Once at app init or first search. Cache in session/memory.

**Response:**
```json
{
  "genres": [
    { "id": 28, "name": "Action" },
    ...
  ]
}
```

## 5. Image URL Construction

**Base URL:** `https://image.tmdb.org/t/p/`

**Poster Sizes:** w92, w154, w185, w342, w500, w780, original

**Backdrop Sizes:** w300, w780, w1280, original

**Logo Sizes (Providers):** w45, w92, w154, w185, w300, w500, original

### Usage Guidelines

- **Carousel Poster Card:** `w342`
- **Grid Poster Card:** `w342`
- **Detail Modal Poster:** `w500`
- **Genre Section Backdrop:** `w780`
- **Streaming Provider Logo:** `w92`

**Storage:** Store only the path (e.g., `/nBNZadXqJSdt05SHLqgT0HuC5Gm.jpg`) in Strapi. Build full URL at render time.

## 6. Data Mapping (TMDB → Strapi)

### For Movies

| TMDB Field | Strapi Field | Transform |
|---|---|---|
| `id` | `tmdb_id` | Direct |
| (hardcoded) | `media_type` | `"movie"` |
| `title` | `title` | Direct |
| `original_title` | `original_title` | Direct |
| `release_date` | `year` | Extract year: `"2014-11-05"` → `"2014"` |
| `poster_path` | `poster_path` | Direct (path only, no base URL) |
| `backdrop_path` | `backdrop_path` | Direct |
| `genres` | `genres` | Direct (array of {id, name}) |
| `credits.crew[job=Director]` | `director` | Extract name of first director |
| `runtime` | `runtime` | Direct (minutes) |
| `vote_average` | `tmdb_rating` | Direct (0-10 decimal) |
| `overview` | `overview` | Direct |
| (n/a) | `season_count` | `null` for movies |
| `watch/providers.results.{region}.flatrate` | `watch_providers` | Transform to array of {provider_name, logo_path, link, provider_id} |

### For TV Shows

| TMDB Field | Strapi Field | Transform |
|---|---|---|
| `id` | `tmdb_id` | Direct |
| (hardcoded) | `media_type` | `"tv"` |
| `name` | `title` | Direct |
| `original_name` | `original_title` | Direct |
| `first_air_date` | `year` | Extract year, optionally append end: `"2019"` or `"2019-2025"` |
| `poster_path` | `poster_path` | Direct |
| `backdrop_path` | `backdrop_path` | Direct |
| `genres` | `genres` | Direct |
| `created_by[0].name` | `director` | Use as "creator" |
| `episode_run_time[0]` | `runtime` | First value (avg episode length) |
| `vote_average` | `tmdb_rating` | Direct |
| `overview` | `overview` | Direct |
| `number_of_seasons` | `season_count` | Direct |
| `watch/providers.results.{region}.flatrate` | `watch_providers` | Same as movies |

## 7. Error Handling

| Error | HTTP Code | Handling |
|---|---|---|
| Invalid API key | 401 | Show error to creator. Check `VITE_TMDB_API_KEY` config. |
| Not found | 404 | Show "Movie not found" in search results |
| Rate limited | 429 | Retry after 1 second (max 2 retries). Show "Please wait..." if still failing. |
| Network error | — | Show "Unable to search. Check your internet connection." |
| Empty search results | 200 (empty array) | Show "No results found for '[query]'" |
| No poster image | 200 (poster_path: null) | Use fallback placeholder image |
| No watch providers for region | 200 (empty region) | Show "Streaming availability not found" or empty section |

## 8. TMDB Attribution Requirement

TMDB requires attribution on any page/product using their data. Add a small "Powered by TMDB" logo + text in the footer of the public movies page and in the add movie overlay. TMDB provides official logos at https://www.themoviedb.org/about/logos-attribution.

## 9. Failure Modes & Resilience

### TMDB API Down During Add Flow

- Creator cannot search for movies. Show error state in search.
- Creator can still manage existing movies (all data stored in Strapi).
- Public pages are unaffected (they read from Strapi only).

### TMDB CDN Down (Image URLs Broken)

- Poster images fail to load on public pages.
- Fallback: show placeholder image with movie title text.
- This is a rare scenario — TMDB CDN has excellent uptime.
- **Long-term mitigation (out of scope):** Download and re-host poster images in S3.

### TMDB Data Changes

- Our stored data becomes stale. Acceptable for v1.
- **Future enhancement:** Periodic refresh job to update metadata from TMDB for stored movies.
