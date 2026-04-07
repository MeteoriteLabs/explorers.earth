---
Feature: games
Doc type: schema
Status: draft
Created: 2026-03-26
Last updated: 2026-03-26
Updated by: agent
Depends on: games_decisions.md
---

# Games — Strapi Schema

Complete data model for the Games feature. These collections need to be created in the Strapi admin panel (Content-Type Builder).

> [!IMPORTANT]
> Since we use a unified S3 storage logic, remember to always use the `path` parameter when uploading media. See **Storage Logic** sections below.

---

## Collection 1: GameList

**Purpose:** A themed list of game recommendations created by a user (e.g., "All-Time Favorites", "Indie Gems", "Perfect for Beginners").

**API ID (singular):** `game-list`
**API ID (plural):** `game-lists`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `List_Name` | Short text | Yes | — | Display name of the list (e.g., "All-Time Favorites") |
| `list_description` | Long text | No | — | Creator's description of what this list is about |
| `slug` | Short text | Yes | Auto | URL-safe slug for shareable links. Auto-generated from List_Name, editable. Must be unique per user. |
| `Visibility` | Boolean | Yes | `false` | Published (true) = visible on public page. Draft (false) = hidden. |
| `cover_image` | Media (single) | No | — | Cover image for the list. Falls back to first game's cover if not set. |
| `display_order` | Integer | No | `0` | Order position on the public page. Lower = higher on page. |
| `top_picks_heading` | Short text | No | `"Top Picks"` | Custom display name for the Top Picks section on the public page |
| `account` | Relation (Many-to-One) | Yes | — | Relates to the user's Account. Many GameLists belong to one Account. |
| `recommended_games` | Relation (One-to-Many) | No | — | Games in this list. One GameList has many RecommendedGames. |

### Notes for Strapi Admin
- `account` relation connects to the existing Account/User collection
- Use the `Visibility` boolean (matching existing `MovieList`, `BookList` pattern)
- **Manual Path Configuration**: For `cover_image`, use the path: `{username}/games/{gameListId}/cover/`
- Add API permissions for authenticated (CRUD) and public (find, findOne) access

---

## Collection 2: RecommendedGame

**Purpose:** A single game recommendation with IGDB metadata and the creator's personal note.

**API ID (singular):** `recommended-game`
**API ID (plural):** `recommended-games`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| **IGDB Metadata** | | | | |
| `igdb_id` | Integer | Yes | — | IGDB unique game identifier (numeric, e.g., `1877` for The Witcher 3) |
| `igdb_slug` | Short text | No | — | IGDB URL slug for the game (e.g., `"the-witcher-3-wild-hunt"`) |
| `title` | Short text | Yes | — | Game title |
| `igdb_image_id` | Short text | No | — | IGDB cover image ID (e.g., `"co1wyy"`). Used to construct cover URLs. |
| `cover_url` | Short text | No | — | Pre-built IGDB cover URL at `cover_big` size (~264×374px). For carousel/grid cards. |
| `cover_url_large` | Short text | No | — | Pre-built IGDB cover URL at `1080p` size. For detail modal. |
| `summary` | Long text | No | — | IGDB game summary / description |
| `storyline` | Long text | No | — | IGDB storyline (if available) |
| `release_date` | Short text | No | — | First release date. Stored as text (e.g., "2015-05-19") |
| `release_year` | Short text | No | — | Extracted release year for display (e.g., "2015") |
| `igdb_rating` | Decimal | No | — | IGDB `total_rating` (0-100 scale). Displayed as /10 after dividing by 10. |
| `igdb_rating_count` | Integer | No | — | Number of ratings contributing to `igdb_rating` |
| `genres` | JSON | No | `[]` | Array of genre objects: `[{ "id": 12, "name": "Role-playing (RPG)" }]` |
| `platforms` | JSON | No | `[]` | Array of platform objects: `[{ "id": 6, "name": "PC (Microsoft Windows)" }, { "id": 167, "name": "PlayStation 5" }]` |
| `developer` | Short text | No | — | Primary developer/studio name (extracted from IGDB `involved_companies`) |
| `publisher` | Short text | No | — | Primary publisher name (extracted from IGDB `involved_companies`) |
| `game_modes` | JSON | No | `[]` | Array of game mode strings: `["Single player", "Multiplayer", "Co-operative"]` |
| `screenshot_ids` | JSON | No | `[]` | Array of IGDB screenshot image IDs: `["scm8yz", "sck3xa"]`. Used to build screenshot URLs. |
| `igdb_url` | Short text | No | — | IGDB website URL for this game (e.g., `"https://www.igdb.com/games/the-witcher-3-wild-hunt"`) |
| **Creator Content** | | | | |
| `user_recommendation_note` | Rich text | No | — | Creator's personal recommendation note. Tiptap/Blocks format. |
| `user_rating` | Integer | No | — | User's 1-10 rating (consistent with Movies & Shows and Books features) |
| `is_pinned` | Boolean | No | `false` | Whether this game is pinned to Top Picks |
| `pin_order` | Integer | No | `null` | Order within Top Picks (null if not pinned). Lower = earlier. |
| `display_order` | Integer | No | `0` | Order within the list. Lower = earlier position. |
| **Media** | | | | |
| `Media` | Media (multiple) | No | — | Creator's uploaded photos/screenshots (max 10). Stored in S3 at `{username}/games/{gameListId}/{igdbId}/{filename}` |
| `media_details` | JSON | No | — | Structured media metadata: `{ "imageDetails": [...], "thumbnail": "url" }`. Matches existing RecommendedPlace/RecommendedMovie/RecommendedBook pattern. |
| **Relations** | | | | |
| `game_list` | Relation (Many-to-One) | Yes | — | The GameList this game belongs to. Many RecommendedGames belong to one GameList. |
| `game_categories` | Relation (Many-to-Many) | No | — | Links to the Game_Category collection representing matched IGDB genres. |

### Notes for Strapi Admin
- `igdb_id` + `game_list` combination should be unique (prevent duplicate games in same list)
- `genres` is a JSON array storing genre id+name objects. Used for genre browse section.
- `platforms` is a JSON array storing platform id+name objects. Displayed as chips.
- `game_modes` is a JSON array of strings e.g., `["Single player", "Multiplayer"]`
- `screenshot_ids` JSON array of IGDB image IDs. Frontend constructs URLs using `igdbService.getScreenshotUrl(id, size)`.
- `cover_url` and `cover_url_large` store pre-built Twitch CDN URLs (stable, not reconstructed on every render)
- `developer` and `publisher` are extracted from IGDB `involved_companies` at save time (company with `developer: true` / `publisher: true`)
- `media_details` JSON structure matches the existing `RecommendedPlace.media_details`, `RecommendedMovie.media_details`, and `RecommendedBook.media_details` pattern
- **S3 Storage Logic**: All media files must be uploaded with the specific `path` parameter:
  - `GameList` cover: `{username}/games/{gameListId}/cover/{filename}`
  - `RecommendedGame` media: `{username}/games/{gameListId}/{igdbId}/{filename}`
- Add API permissions for authenticated (CRUD) and public (find, findOne) access

---

## Collection 3: Game_Category

**Purpose:** A dedicated category collection for the Games feature, representing IGDB genres.

**API ID (singular):** `game-category`
**API ID (plural):** `game-categories`

### Fields

| Field Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `genre_name` | Short text | Yes | — | The name of the game genre (e.g., "Role-playing (RPG)", "Strategy", "Action") |
| `igdb_genre_id` | Integer | No | — | IGDB's numeric genre ID for reference (optional, useful for future sync) |
| `recommended_games` | Relation (Many-to-Many) | No | — | Relates to the RecommendedGame collection |

### Notes for Strapi Admin
- Mirrors the `Movie_Category` and `Book_Category` collection pattern
- `genre_name` should match IGDB genre name strings for easy mapping
- `igdb_genre_id` is optional but useful for future IGDB genre sync

---

## Relation Diagram

```
Account (existing)
    │
    ├── 1:N ── GameList
    │              │
    │              ├── 1:N ── RecommendedGame
    │              │              │
    │              │              └── M:M ── Game_Category
    │              │
    │              └── (cover_image: Media)
    │
    ├── 1:N ── BookList (existing, untouched)
    │              │
    │              └── 1:N ── RecommendedBook (existing, untouched)
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

## IGDB Cover Image URL Construction

IGDB returns a `cover.image_id` string. URLs are built using the Twitch image CDN.

**URL pattern:**
```
https://images.igdb.com/igdb/image/upload/t_{size}/{image_id}.jpg
```

**Available sizes:**
- `thumb` — ~90×128px (small thumbnails)
- `cover_small` — 90×128px
- `cover_big` — 264×374px → **use for carousel/grid cards** ✓
- `screenshot_med` — 569×320 (for screenshots)
- `720p` — 1280×720 (for screenshots/backdrops)
- `1080p` — 1920×1080 → **use for detail modal cover** ✓

**Example:**
- `image_id`: `co1wyy`
- Card URL: `https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg`
- Large URL: `https://images.igdb.com/igdb/image/upload/t_1080p/co1wyy.jpg`

**Usage in frontend:**
```
Cover card (carousel): cover_url (pre-built cover_big)
Cover card (grid):     cover_url (pre-built cover_big)
Detail modal cover:    cover_url_large (pre-built 1080p)
Screenshots:           igdbService.getScreenshotUrl(screenshotId, '720p')
Genre card background: cover_url of a representative game in that genre
```

---

## Migration Notes

- No migration of existing data required. These are entirely new collections.
- No changes to existing `RecommendationList`, `RecommendedPlace`, `MovieList`, `RecommendedMovie`, `BookList`, `RecommendedBook`, or any other existing collection.
- The new `GameList`, `RecommendedGame`, and `Game_Category` collections are completely independent. They only share the `Account` relation with existing collections, keeping the games feature cleanly separated.
