---
Feature: games
Doc type: api_contract
Status: draft
Created: 2026-03-26
Last updated: 2026-03-26
Updated by: agent
Depends on: games_schema.md
---

# Games API Contract

## Overview

The Games feature combines:
- **Strapi CMS (GraphQL)**: Manages game lists, recommendations, and user content
- **IGDB API (via Strapi Proxy)**: Creator-side search and metadata enrichment
- **Apollo Client**: Frontend GraphQL client for all Strapi interactions

This document specifies the API contracts between frontend, Strapi CMS, and IGDB.

---

## 1. GraphQL Queries (Strapi)

All queries use Strapi v4+ GraphQL with `documentId` pattern, filters, pagination, and sorting — mirroring the Movies & Shows and Books patterns.

### 1.1 gameListsByAccount

**Purpose**: Fetch all game lists for a user account. Used by dashboard Games Home and public profile page.

**Query**:
```graphql
query GameListsByAccount($accountDocumentId: ID!) {
  gameLists(
    filters: { account: { documentId: { eq: $accountDocumentId } } }
    sort: ["display_order:asc"]
    pagination: { limit: 100 }
  ) {
    documentId
    List_Name
    list_description
    slug
    Visibility
    cover_image {
      url
      alternativeText
    }
    display_order
    top_picks_heading
    recommended_games {
      documentId
      igdb_id
      title
      cover_url
      is_pinned
    }
    account {
      documentId
      username
    }
  }
}
```

**Variables**:
```typescript
{ accountDocumentId: string; }
```

**Response Type**:
```typescript
interface GameListsResponse {
  gameLists: Array<{
    documentId: string;
    List_Name: string;
    list_description: string | null;
    slug: string;
    Visibility: boolean;
    cover_image: { url: string; alternativeText: string | null } | null;
    display_order: number;
    top_picks_heading: string | null;
    recommended_games: Array<{
      documentId: string;
      igdb_id: number;
      title: string;
      cover_url: string | null;
      is_pinned: boolean;
    }>;
    account: { documentId: string; username: string };
  }>;
}
```

---

### 1.2 gamesByList

**Purpose**: Fetch paginated games in a specific list. Used by dashboard list view and public carousel.

**Query**:
```graphql
query GamesByList(
  $gameListDocumentId: ID!
  $page: Int!
  $pageSize: Int!
) {
  gameLists(
    filters: { documentId: { eq: $gameListDocumentId } }
  ) {
    documentId
    List_Name
    list_description
    slug
    Visibility
    recommended_games(
      sort: ["display_order:asc"]
      pagination: { start: $page, limit: $pageSize }
    ) {
      documentId
      igdb_id
      igdb_slug
      title
      cover_url
      cover_url_large
      igdb_image_id
      summary
      release_date
      release_year
      igdb_rating
      igdb_rating_count
      genres
      platforms
      developer
      publisher
      game_modes
      screenshot_ids
      igdb_url
      user_recommendation_note
      user_rating
      is_pinned
      pin_order
      display_order
      game_categories {
        documentId
        genre_name
      }
      Media {
        documentId
        url
        caption
      }
    }
    _count {
      recommended_games
    }
  }
}
```

**Variables**:
```typescript
{
  gameListDocumentId: string;
  page: number;      // 0-indexed
  pageSize: number;  // typically 12 or 20
}
```

---

### 1.3 gameDetails

**Purpose**: Fetch full details for a single game. Used by detail modal and edit form.

**Query**:
```graphql
query GameDetails($documentId: ID!) {
  recommendedGames(filters: { documentId: { eq: $documentId } }) {
    documentId
    igdb_id
    igdb_slug
    title
    cover_url
    cover_url_large
    igdb_image_id
    summary
    storyline
    release_date
    release_year
    igdb_rating
    igdb_rating_count
    genres
    platforms
    developer
    publisher
    game_modes
    screenshot_ids
    igdb_url
    user_recommendation_note
    user_rating
    is_pinned
    pin_order
    display_order
    media_details
    Media {
      documentId
      url
      caption
    }
    game_list {
      documentId
      List_Name
      slug
    }
    game_categories {
      documentId
      genre_name
    }
  }
}
```

**Variables**:
```typescript
{ documentId: string; }
```

---

### 1.4 pinnedGames

**Purpose**: Fetch all pinned games for a user across all lists. Used by Top Picks row and Top Picks manager.

**Query**:
```graphql
query PinnedGames($accountDocumentId: ID!) {
  recommendedGames(
    filters: {
      is_pinned: { eq: true }
      game_list: { account: { documentId: { eq: $accountDocumentId } } }
    }
    sort: ["pin_order:asc"]
    pagination: { limit: 100 }
  ) {
    documentId
    igdb_id
    title
    cover_url
    cover_url_large
    igdb_rating
    user_rating
    platforms
    is_pinned
    pin_order
    game_list {
      documentId
      List_Name
      slug
    }
  }
}
```

**Variables**:
```typescript
{ accountDocumentId: string; }
```

---

### 1.5 gamesByGenre

**Purpose**: Fetch all games for a user with a specific genre. Used by public genre page.

**Query**:
```graphql
query GamesByGenre($accountDocumentId: ID!, $genreName: String!) {
  recommendedGames(
    filters: {
      game_categories: { genre_name: { eq: $genreName } }
      game_list: {
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
      }
    }
    sort: ["display_order:asc"]
    pagination: { limit: 200 }
  ) {
    documentId
    igdb_id
    title
    cover_url
    igdb_rating
    user_rating
    genres
    platforms
    release_year
    game_list {
      documentId
      List_Name
      slug
    }
  }
}
```

**Variables**:
```typescript
{
  accountDocumentId: string;
  genreName: string; // e.g., "Role-playing (RPG)", "Action"
}
```

---

### 1.6 gameListBySlug

**Purpose**: Fetch a single game list by slug and username for public list page.

**Query**:
```graphql
query GameListBySlug($slug: String!, $username: String!) {
  gameLists(
    filters: {
      slug: { eq: $slug }
      account: { username: { eq: $username } }
      Visibility: { eq: true }
    }
  ) {
    documentId
    List_Name
    list_description
    slug
    cover_image {
      url
      alternativeText
    }
    top_picks_heading
    recommended_games(sort: ["display_order:asc"]) {
      documentId
      igdb_id
      title
      cover_url
      release_year
      platforms
      genres
      igdb_rating
      user_rating
      is_pinned
      pin_order
    }
    account {
      documentId
      username
    }
  }
}
```

---

### 1.7 publicGameData

**Purpose**: Fetch aggregated data for public games page (all published lists with games and genre summary).

**Query**:
```graphql
query PublicGameData($accountDocumentId: ID!) {
  gameLists(
    filters: {
      account: { documentId: { eq: $accountDocumentId } }
      Visibility: { eq: true }
    }
    sort: ["display_order:asc"]
  ) {
    documentId
    List_Name
    list_description
    slug
    cover_image { url }
    top_picks_heading
    recommended_games(sort: ["is_pinned:desc", "pin_order:asc"]) {
      documentId
      igdb_id
      title
      cover_url
      igdb_rating
      user_rating
      genres
      platforms
      is_pinned
      pin_order
    }
  }
  recommendedGames(
    filters: {
      game_list: {
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
      }
    }
  ) {
    genres
    cover_url
    game_categories {
      documentId
      genre_name
    }
  }
}
```

---

## 2. GraphQL Mutations (Strapi)

### 2.1 createGameList

**Mutation**:
```graphql
mutation CreateGameList(
  $List_Name: String!
  $list_description: String
  $slug: String!
  $Visibility: Boolean!
  $cover_image: ID
  $display_order: Int!
  $top_picks_heading: String
  $account: ID!
) {
  createGameList(
    data: {
      List_Name: $List_Name
      list_description: $list_description
      slug: $slug
      Visibility: $Visibility
      cover_image: $cover_image
      display_order: $display_order
      top_picks_heading: $top_picks_heading
      account: $account
    }
  ) {
    documentId
    List_Name
    slug
    Visibility
    display_order
  }
}
```

**Input Type**:
```typescript
interface CreateGameListInput {
  List_Name: string;
  list_description?: string;
  slug: string;
  Visibility: boolean;
  cover_image?: string;       // Media documentId
  display_order: number;
  top_picks_heading?: string;
  account: string;            // Account documentId
}
```

---

### 2.2 updateGameList

**Mutation**:
```graphql
mutation UpdateGameList(
  $documentId: ID!
  $List_Name: String
  $list_description: String
  $slug: String
  $Visibility: Boolean
  $cover_image: ID
  $display_order: Int
  $top_picks_heading: String
) {
  updateGameList(
    documentId: $documentId
    data: {
      List_Name: $List_Name
      list_description: $list_description
      slug: $slug
      Visibility: $Visibility
      cover_image: $cover_image
      display_order: $display_order
      top_picks_heading: $top_picks_heading
    }
  ) {
    documentId
    List_Name
    slug
    Visibility
    display_order
    top_picks_heading
  }
}
```

---

### 2.3 deleteGameList

**Mutation**:
```graphql
mutation DeleteGameList($documentId: ID!) {
  deleteGameList(documentId: $documentId) {
    documentId
  }
}
```

---

### 2.4 createRecommendedGame

**Mutation**:
```graphql
mutation CreateRecommendedGame(
  $igdb_id: Int!
  $igdb_slug: String
  $title: String!
  $igdb_image_id: String
  $cover_url: String
  $cover_url_large: String
  $summary: String
  $storyline: String
  $release_date: String
  $release_year: String
  $igdb_rating: Float
  $igdb_rating_count: Int
  $genres: JSON
  $platforms: JSON
  $developer: String
  $publisher: String
  $game_modes: JSON
  $screenshot_ids: JSON
  $igdb_url: String
  $user_recommendation_note: JSON
  $user_rating: Int
  $is_pinned: Boolean
  $pin_order: Int
  $display_order: Int!
  $game_list: ID!
  $game_categories: [ID]
) {
  createRecommendedGame(
    data: {
      igdb_id: $igdb_id
      igdb_slug: $igdb_slug
      title: $title
      igdb_image_id: $igdb_image_id
      cover_url: $cover_url
      cover_url_large: $cover_url_large
      summary: $summary
      storyline: $storyline
      release_date: $release_date
      release_year: $release_year
      igdb_rating: $igdb_rating
      igdb_rating_count: $igdb_rating_count
      genres: $genres
      platforms: $platforms
      developer: $developer
      publisher: $publisher
      game_modes: $game_modes
      screenshot_ids: $screenshot_ids
      igdb_url: $igdb_url
      user_recommendation_note: $user_recommendation_note
      user_rating: $user_rating
      is_pinned: $is_pinned
      pin_order: $pin_order
      display_order: $display_order
      game_list: $game_list
      game_categories: $game_categories
    }
  ) {
    documentId
    igdb_id
    title
    cover_url
    is_pinned
    display_order
  }
}
```

---

### 2.5 updateRecommendedGame

**Mutation**:
```graphql
mutation UpdateRecommendedGame(
  $documentId: ID!
  $user_recommendation_note: JSON
  $user_rating: Int
  $is_pinned: Boolean
  $pin_order: Int
  $display_order: Int
  $game_categories: [ID]
) {
  updateRecommendedGame(
    documentId: $documentId
    data: {
      user_recommendation_note: $user_recommendation_note
      user_rating: $user_rating
      is_pinned: $is_pinned
      pin_order: $pin_order
      display_order: $display_order
      game_categories: $game_categories
    }
  ) {
    documentId
    user_rating
    is_pinned
    pin_order
  }
}
```

---

### 2.6 deleteRecommendedGame

**Mutation**:
```graphql
mutation DeleteRecommendedGame($documentId: ID!) {
  deleteRecommendedGame(documentId: $documentId) {
    documentId
  }
}
```

---

### 2.7 toggleGamePin

**Mutation**: Use `updateRecommendedGame` with only pin fields:
```typescript
// Pin a game
await updateRecommendedGame({
  documentId,
  is_pinned: true,
  pin_order: nextAvailablePinOrder
});

// Unpin a game
await updateRecommendedGame({
  documentId,
  is_pinned: false,
  pin_order: null
});
```

---

### 2.8 reorderGamesInList

**Strategy**: Batch update `display_order` for all affected games after drag-and-drop.

```typescript
await Promise.all(
  reorderedGames.map((game, index) =>
    updateRecommendedGame({
      documentId: game.documentId,
      display_order: index
    })
  )
);
```

---

### 2.9 reorderPinnedGames

**Strategy**: Batch update `pin_order` for all pinned games after Top Picks reorder.

```typescript
await Promise.all(
  reorderedPins.map((game, index) =>
    updateRecommendedGame({
      documentId: game.documentId,
      pin_order: index
    })
  )
);
```

---

## 3. IGDB API (via Strapi Proxy)

### 3.1 Search Games

**Frontend calls:** `GET {VITE_IGDB_PROXY_URL}/search?q={query}&limit=10`

**Strapi calls IGDB:** `POST https://api.igdb.com/v4/games`

**Example Strapi Proxy Response:**
```json
[
  {
    "id": 1877,
    "name": "The Witcher 3: Wild Hunt",
    "slug": "the-witcher-3-wild-hunt",
    "cover": {
      "image_id": "co2ms3"
    },
    "total_rating": 93.2,
    "total_rating_count": 1847,
    "genres": [
      { "id": 12, "name": "Role-playing (RPG)" },
      { "id": 31, "name": "Adventure" }
    ],
    "platforms": [
      { "id": 6, "name": "PC (Microsoft Windows)" },
      { "id": 48, "name": "PlayStation 4" },
      { "id": 49, "name": "Xbox One" },
      { "id": 130, "name": "Nintendo Switch" }
    ],
    "first_release_date": 1431993600,
    "summary": "The Witcher 3: Wild Hunt is an action role-playing game...",
    "involved_companies": [
      {
        "developer": true,
        "publisher": false,
        "company": { "name": "CD Projekt Red" }
      },
      {
        "developer": false,
        "publisher": true,
        "company": { "name": "CD Projekt" }
      }
    ],
    "game_modes": [
      { "id": 1, "name": "Single player" }
    ],
    "screenshots": [
      { "image_id": "scm8yz" },
      { "image_id": "sck3xa" }
    ],
    "url": "https://www.igdb.com/games/the-witcher-3-wild-hunt",
    "category": 0
  }
]
```

---

### 3.2 Get Game Details

**Frontend calls:** `GET {VITE_IGDB_PROXY_URL}/game/{igdbId}`

**Response:** Single game object, same structure as search result but with `storyline` field also guaranteed.

---

## 4. Data Flow: Add Game

```
Creator types query
  → useIgdbSearch debounces 300ms
  → igdbService.searchGames(query)
    → GET /api/igdb-proxy/search?q={query}
    → Strapi proxy calls IGDB /games with Apicalypse query
  → Display results in IgdbSearch dropdown

Creator selects a game
  → igdbService.getGameDetails(igdbId)
    → GET /api/igdb-proxy/game/{igdbId}
  → igdbHelpers.transformIgdbResult(data)
    → Extract: igdb_id, title, cover_url, cover_url_large, genres, platforms,
               developer, publisher, game_modes, screenshot_ids, release_date, etc.
  → Pre-fill AddGamePage form

Creator completes form and saves
  → createRecommendedGame mutation
    → Saves all metadata to Strapi RecommendedGame
  → If media uploaded: POST to S3 via existing upload endpoint
  → Navigate back to GameListView

Public page visitor views game
  → Apollo query: gameDetails(documentId)
    → Reads from Strapi (never calls IGDB)
  → Render GameDetailModal with stored data
```

---

## 5. TypeScript Types

```typescript
// Strapi types
export interface GameList {
  documentId: string;
  List_Name: string;
  slug: string;
  list_description: string | null;
  Visibility: boolean;
  cover_image: { url: string; alternativeText: string | null } | null;
  display_order: number;
  top_picks_heading: string | null;
  recommended_games: Game[];
  account: { documentId: string; username: string };
}

export interface Game {
  documentId: string;
  igdb_id: number;
  igdb_slug: string | null;
  title: string;
  igdb_image_id: string | null;
  cover_url: string | null;
  cover_url_large: string | null;
  summary: string | null;
  storyline: string | null;
  release_date: string | null;
  release_year: string | null;
  igdb_rating: number | null;      // 0-100 scale
  igdb_rating_count: number | null;
  genres: IGDBGenre[];             // [{ id, name }]
  platforms: IGDBPlatform[];       // [{ id, name }]
  developer: string | null;
  publisher: string | null;
  game_modes: string[];            // ["Single player", "Multiplayer"]
  screenshot_ids: string[];        // IGDB image IDs
  igdb_url: string | null;
  user_recommendation_note: any;  // Tiptap blocks
  user_rating: number | null;      // 1-10 integer
  is_pinned: boolean;
  pin_order: number | null;
  display_order: number;
  game_categories: GameCategory[];
  createdAt: string;
}

export interface IGDBGenre {
  id: number;
  name: string;
}

export interface IGDBPlatform {
  id: number;
  name: string;
}

export interface GameCategory {
  documentId: string;
  genre_name: string;
}

// IGDB API response types (from proxy)
export interface IGDBSearchResult {
  id: number;
  name: string;
  slug: string;
  cover?: { image_id: string };
  total_rating?: number;
  total_rating_count?: number;
  genres?: Array<{ id: number; name: string }>;
  platforms?: Array<{ id: number; name: string }>;
  first_release_date?: number;  // Unix timestamp
  summary?: string;
  storyline?: string;
  involved_companies?: Array<{
    developer: boolean;
    publisher: boolean;
    company: { name: string };
  }>;
  game_modes?: Array<{ id: number; name: string }>;
  screenshots?: Array<{ image_id: string }>;
  url?: string;
  category?: number;
}
```
