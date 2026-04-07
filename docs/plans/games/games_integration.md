---
Feature: games
Doc type: integration
Status: draft
Created: 2026-03-26
Last updated: 2026-03-26
Updated by: agent
Depends on: games_api_contract.md
---

# Games Integration — IGDB API

## 1. IGDB API Overview

**Service:** IGDB API — https://api.igdb.com/v4
**Powered by:** Twitch (Amazon)

- **API Version:** v4
- **Base URL:** `https://api.igdb.com/v4`
- **Documentation:** https://api-docs.igdb.com/
- **Free Tier:** Yes — no hard rate limit advertised; Twitch recommends max 4 requests/second
- **Authentication:** Twitch OAuth2 `client_credentials` — **server-side ONLY** (see Section 2)
- **Query Language:** Apicalypse (IGDB custom query language, used in POST request body)

> [!IMPORTANT]
> Unlike TMDB and Google Books, IGDB requires a **client secret** for authentication. This secret MUST be kept server-side. All IGDB API calls from the frontend must go through the **Strapi proxy** described in Section 3.

---

## 2. Authentication

### Twitch OAuth Flow (Server-Side)

IGDB uses Twitch's OAuth 2.0 `client_credentials` grant type.

**Step 1: Obtain Access Token (Strapi server, not frontend)**
```
POST https://id.twitch.tv/oauth2/token
  ?client_id={IGDB_CLIENT_ID}
  &client_secret={IGDB_CLIENT_SECRET}
  &grant_type=client_credentials
```

**Response:**
```json
{
  "access_token": "abc123xyz",
  "expires_in": 5011271,
  "token_type": "bearer"
}
```

**Step 2: Use token in all IGDB API requests**
```
POST https://api.igdb.com/v4/games
Headers:
  Client-ID: {IGDB_CLIENT_ID}
  Authorization: Bearer {access_token}
Body (Apicalypse):
  fields name, cover.image_id, total_rating;
  search "The Witcher 3";
  limit 10;
```

### Token Caching Strategy (Strapi Proxy)

- The Twitch access token is valid for ~60 days (varies)
- Strapi proxy should cache the token in memory or a simple store
- On expiry (401 response from IGDB), re-fetch the token and retry the request
- Token expiry: `expires_in` seconds from issue time

### Environment Variables

**Server-side (Strapi `.env`):**
```
IGDB_CLIENT_ID=your_twitch_client_id_here
IGDB_CLIENT_SECRET=your_twitch_client_secret_here
```

**Frontend (React `.env`):**
```
VITE_IGDB_PROXY_URL=https://your-strapi-domain.com/api/igdb-proxy
```

> [!CAUTION]
> `IGDB_CLIENT_SECRET` must NEVER appear in the frontend `.env` or any file with the `VITE_` prefix. It must only exist in Strapi's server environment.

---

## 3. Strapi Proxy Architecture

Since IGDB requests require a server-side secret, create a custom Strapi controller to act as a proxy.

### Proxy Endpoints (Strapi Custom Routes)

**Search Games:**
```
GET /api/igdb-proxy/search?q={query}&limit={limit}
```
- Authenticated (requires valid user JWT)  
- Strapi proxy appends `Client-ID` and `Authorization: Bearer` headers
- Calls `POST https://api.igdb.com/v4/games` with Apicalypse query

**Get Game Details:**
```
GET /api/igdb-proxy/game/{igdbId}
```
- Authenticated (requires valid user JWT)
- Returns full game details from IGDB

### Strapi Custom Controller Sketch

```javascript
// src/api/igdb-proxy/controllers/igdb-proxy.js

'use strict';

const axios = require('axios');

let cachedToken = null;
let tokenExpiresAt = 0;

async function getIgdbToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }
  const { CLIENT_ID, CLIENT_SECRET } = strapi.config.get('igdb');
  const resp = await axios.post(
    `https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`
  );
  cachedToken = resp.data.access_token;
  tokenExpiresAt = Date.now() + (resp.data.expires_in - 60) * 1000; // 1min buffer
  return cachedToken;
}

async function igdbPost(endpoint, body) {
  const token = await getIgdbToken();
  const clientId = strapi.config.get('igdb.CLIENT_ID');
  return axios.post(`https://api.igdb.com/v4/${endpoint}`, body, {
    headers: {
      'Client-ID': clientId,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'text/plain',
    }
  });
}

module.exports = {
  async search(ctx) {
    const { q, limit = 10 } = ctx.query;
    if (!q) return ctx.badRequest('Missing query parameter q');

    const body = `
      fields id, name, slug, cover.image_id, total_rating, total_rating_count,
             genres.name, genres.id, platforms.name, platforms.id,
             first_release_date, summary, involved_companies.company.name,
             involved_companies.developer, involved_companies.publisher,
             game_modes.name, screenshots.image_id, url, category;
      search "${q.replace(/"/g, '')}";
      where category = (0,8,9);
      limit ${Math.min(Number(limit), 20)};
    `;

    const { data } = await igdbPost('games', body);
    ctx.body = data;
  },

  async getGame(ctx) {
    const { igdbId } = ctx.params;

    const body = `
      fields id, name, slug, cover.image_id, total_rating, total_rating_count,
             genres.name, genres.id, platforms.name, platforms.id,
             first_release_date, summary, storyline,
             involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
             game_modes.name, screenshots.image_id, url, category, aggregated_rating;
      where id = ${igdbId};
    `;

    const { data } = await igdbPost('games', body);
    ctx.body = data[0] || null;
  }
};
```

---

## 4. IGDB Apicalypse Query Language

IGDB uses a custom POST body query language called Apicalypse. All requests use `POST` with `Content-Type: text/plain`.

### Key Clauses

| Clause | Example | Description |
|---|---|---|
| `fields` | `fields name, cover.image_id;` | Specify which fields to return |
| `search` | `search "Elden Ring";` | Full-text search |
| `where` | `where category = 0;` | Filter results |
| `limit` | `limit 10;` | Max results (max 500) |
| `offset` | `offset 10;` | Pagination offset |
| `sort` | `sort total_rating desc;` | Sort order |

### Game Categories (for `where` filter)

| Value | Category |
|---|---|
| 0 | Main game ← **Use this** |
| 1 | DLC / Addon |
| 2 | Expansion |
| 3 | Bundle |
| 4 | Standalone DLC |
| 5 | Mod |
| 6 | Episode |
| 7 | Season |
| 8 | Remake ← **Also include** |
| 9 | Remaster ← **Also include** |
| 10 | Expanded Game |
| 11 | Port |
| 12 | Fork |

**Default search filter:** `where category = (0,8,9);` — shows main games, remakes, and remasters. Excludes DLCs and expansions from default results.

---

## 5. Endpoints Used

### 5.1 Search Games (via Strapi Proxy)

**Proxy Endpoint:** `GET /api/igdb-proxy/search?q={query}&limit={limit}`

**IGDB Endpoint Called:** `POST https://api.igdb.com/v4/games`

**Apicalypse body used:**
```
fields id, name, slug, cover.image_id, total_rating, total_rating_count,
       genres.name, genres.id, platforms.name, platforms.id,
       first_release_date, summary, involved_companies.company.name,
       involved_companies.developer, involved_companies.publisher,
       game_modes.name, screenshots.image_id, url, category;
search "{query}";
where category = (0,8,9);
limit 10;
```

**When Called:** As the creator types in the IGDB search bar (debounced 300ms)

**Response Fields Used:**
- `id` — IGDB numeric game ID
- `name` — game title
- `slug` — IGDB URL slug
- `cover.image_id` — cover image ID for URL construction
- `total_rating` — aggregate rating (0-100)
- `total_rating_count` — number of ratings
- `genres[]` — array of `{ id, name }` genre objects
- `platforms[]` — array of `{ id, name }` platform objects
- `first_release_date` — Unix timestamp of first release
- `summary` — game description
- `involved_companies[]` — array with `company.name`, `developer`, `publisher` booleans
- `game_modes[]` — array of `{ id, name }` game mode objects
- `screenshots[]` — array of `{ image_id }` screenshot objects
- `url` — IGDB page URL

### 5.2 Get Game Details (via Strapi Proxy)

**Proxy Endpoint:** `GET /api/igdb-proxy/game/{igdbId}`

**IGDB Endpoint Called:** `POST https://api.igdb.com/v4/games`

**When Called:** After creator selects a game from search results (to get most complete data)

**Response:** Same structure as search, but `storyline` also included, and `where id = {igdbId}` ensures exact match.

---

## 6. Image URL Construction

IGDB images are hosted on the Twitch CDN with a consistent URL pattern.

**Pattern:**
```
https://images.igdb.com/igdb/image/upload/t_{size}/{image_id}.jpg
```

**Sizes:**
| Size Key | Dimensions | Use Case |
|---|---|---|
| `thumb` | 90×128 | Mini thumbnails |
| `cover_small` | 90×128 | Small cards |
| `cover_big` | 264×374 | **Carousel and grid cards** ✓ |
| `screenshot_med` | 569×320 | In-modal screenshots |
| `720p` | 1280×720 | Large screenshots |
| `1080p` | 1920×1080 | **Detail modal cover** ✓ |

**Frontend helper functions:**
```typescript
export function getCoverUrl(imageId: string, size: string = 'cover_big'): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

export function getScreenshotUrl(imageId: string, size: string = 'screenshot_med'): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}
```

**Usage:**
- Card cover: `getCoverUrl(igdb_image_id, 'cover_big')`
- Modal cover: `getCoverUrl(igdb_image_id, '1080p')`
- Screenshot: `getScreenshotUrl(screenshotId, '720p')`

---

## 7. Data Mapping (IGDB → Strapi)

| IGDB Field | Strapi Field | Transform |
|---|---|---|
| `id` | `igdb_id` | Direct (integer) |
| `slug` | `igdb_slug` | Direct |
| `name` | `title` | Direct |
| `cover.image_id` | `igdb_image_id` | Direct |
| (derived) | `cover_url` | `getCoverUrl(image_id, 'cover_big')` |
| (derived) | `cover_url_large` | `getCoverUrl(image_id, '1080p')` |
| `summary` | `summary` | Direct (may be null) |
| `storyline` | `storyline` | Direct (may be null) |
| `first_release_date` | `release_date` | Unix timestamp → ISO date string `"2015-05-19"` |
| (derived) | `release_year` | Extract year from Unix timestamp |
| `total_rating` | `igdb_rating` | Direct (0-100 Decimal) |
| `total_rating_count` | `igdb_rating_count` | Direct |
| `genres[]` | `genres` | Store as JSON: `[{ id, name }]` |
| `platforms[]` | `platforms` | Store as JSON: `[{ id, name }]` |
| `involved_companies[developer=true].company.name` | `developer` | First developer company name |
| `involved_companies[publisher=true].company.name` | `publisher` | First publisher company name |
| `game_modes[].name` | `game_modes` | Store as JSON string array: `["Single player"]` |
| `screenshots[].image_id` | `screenshot_ids` | Store as JSON string array: `["scm8yz"]` |
| `url` | `igdb_url` | Direct |

**Release date conversion:**
```typescript
// IGDB returns Unix timestamps for dates
export function igdbTimestampToDateString(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().split('T')[0]; // "2015-05-19"
}

export function igdbTimestampToYear(timestamp: number): string {
  return new Date(timestamp * 1000).getFullYear().toString(); // "2015"
}
```

**Developer/Publisher extraction:**
```typescript
export function extractDeveloper(involvedCompanies: IGDBInvolvedCompany[]): string | null {
  const dev = involvedCompanies?.find(ic => ic.developer);
  return dev?.company?.name ?? null;
}

export function extractPublisher(involvedCompanies: IGDBInvolvedCompany[]): string | null {
  const pub = involvedCompanies?.find(ic => ic.publisher);
  return pub?.company?.name ?? null;
}
```

---

## 8. Error Handling

| Error | Condition | Handling |
|---|---|---|
| Invalid credentials | 401 from Twitch token endpoint | Log error, show "Search temporarily unavailable." |
| IGDB 401 | Token expired | Refresh token and retry once |
| IGDB 429 | Rate limited (>4 req/s) | Retry after 1s (max 2 retries). Show "Please wait..." |
| Strapi proxy 500 | Proxy error | Show "Unable to search. Please try again." |
| Network error | No connectivity | Show "Unable to search. Check your internet connection." |
| Empty search results | IGDB returns `[]` | Show "No games found for '[query]'. Try a different title." |
| No cover image | `cover` is null/missing | Show generic game controller placeholder |
| Missing platforms | `platforms` is null/`[]` | Hide platform chips, show nothing |
| Future token expiry | Strapi proxy monitors `expires_in` | Auto-refresh before expiry |

---

## 9. Rate Limits & Mitigation

- **IGDB recommended max:** 4 requests per second
- **No strict daily limit** (but Twitch monitors for abuse)

**Mitigation strategy:**
- **Debounce search input:** 300ms debounce on search bar (same as TMDB, Google Books)
- **Result caching:** Component-level cache of last search results (same query → return cache)
- **Strapi-side token caching:** Single shared token for all users avoids multiple simultaneous token requests
- **No public page API calls:** Public pages read from Strapi only — IGDB is never called by visitors

---

## 10. IGDB Attribution

IGDB does not mandate a specific attribution badge (unlike Google Books). However, best practice is to include a small credit.

**Recommended attribution text:** "Game data provided by IGDB"

**Placement:** Footer of the add game overlay and public games page.

---

## 11. Failure Modes & Resilience

### IGDB/Strapi Proxy Down During Add Flow
- Creator cannot search for games. Show error state in search.
- Creator can still manage existing games (all data stored in Strapi).
- Public pages are unaffected (they read from Strapi only).

### IGDB Cover Image URLs Broken
- Cover images fail to load on public pages.
- Fallback: show generic game controller / placeholder cover with game title text overlay.
- IGDB's Twitch CDN has excellent uptime.

### Missing Metadata
- Many indie or older games may have incomplete IGDB data.
- Fallback display rules:
  - No cover → show generic game cover placeholder
  - No summary → hide description section in detail modal
  - No genres → hide genre chips
  - No platforms → hide platform chips
  - No developer/publisher → hide that line
  - No release date → hide year chip
  - No rating → hide IGDB rating badge

### Token Expiry During Active Session
- Strapi proxy auto-refreshes the token
- Creator experiences no interruption
- If auto-refresh fails → 15min retry window before surfacing error
