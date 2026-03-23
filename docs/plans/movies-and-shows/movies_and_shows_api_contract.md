---
Feature: movies-and-shows
Doc type: api_contract
Status: draft
Created: 2026-03-20
Last updated: 2026-03-20
Updated by: agent
Depends on: movies_and_shows_schema.md
---

# Movies & Shows API Contract

## Overview

The Movies & Shows feature provides movie and TV show recommendations with list management and public sharing. The architecture combines:

- **Strapi CMS (GraphQL)**: Manages movie lists, recommendations, relationships, and user content
- **TMDB API (REST)**: Client-side search, metadata enrichment, and genre mappings
- **Apollo Client**: Frontend GraphQL client for Strapi queries and mutations

This document specifies the API contracts between frontend, Strapi CMS, and TMDB services.

---

## 1. GraphQL Queries (Strapi)

All queries use Strapi v4+ GraphQL with `documentId` pattern, filters, pagination, and sorting.

### 1.1 movieListsByAccount

**Purpose**: Fetch all movie lists for a user account. Used by dashboard Movies Home and public profile page.

**Query**:
```graphql
query MovieListsByAccount($accountDocumentId: ID!) {
  movieLists(
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
    recommended_movies {
      documentId
      tmdb_id
      media_type
      title
      poster_path
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
{
  accountDocumentId: string;
}
```

**Response Type**:
```typescript
interface MovieListsResponse {
  movieLists: MovieListWithMovies[];
}

interface MovieListWithMovies {
  documentId: string;
  List_Name: string;
  list_description: string | null;
  slug: string;
  Visibility: boolean;
  cover_image: {
    url: string;
    alternativeText: string | null;
  } | null;
  display_order: number;
  top_picks_heading: string | null;
  recommended_movies: Array<{
    documentId: string;
    tmdb_id: number;
    media_type: 'movie' | 'tv';
    title: string;
    poster_path: string | null;
    is_pinned: boolean;
  }>;
  account: {
    documentId: string;
    username: string;
  };
  movieCount?: number; // Computed on frontend from recommended_movies length
}
```

---

### 1.2 moviesByList

**Purpose**: Fetch paginated movies in a specific list. Used by dashboard list view and public carousel.

**Query**:
```graphql
query MoviesByList(
  $movieListDocumentId: ID!
  $page: Int!
  $pageSize: Int!
) {
  movieLists(
    filters: { documentId: { eq: $movieListDocumentId } }
  ) {
    documentId
    List_Name
    list_description
    slug
    Visibility
    recommended_movies(
      sort: ["display_order:asc"]
      pagination: { start: $page, limit: $pageSize }
    ) {
      documentId
      tmdb_id
      media_type
      title
      original_title
      poster_path
      backdrop_path
      year
      genres
      director
      runtime
      tmdb_rating
      user_rating
      overview
      season_count
      user_recommendation_note
      watch_providers
      is_pinned
      pin_order
      display_order
      movie_categories {
        documentId
        genre_name
      }
      cast_details
      Media {
        documentId
        url
        caption
      }
    }
    _count {
      recommended_movies
    }
  }
}
```

**Variables**:
```typescript
{
  movieListDocumentId: string;
  page: number;      // 0-indexed
  pageSize: number;  // typically 12, 20, etc.
}
```

**Response Type**:
```typescript
interface MoviesByListResponse {
  movieLists: Array<{
    documentId: string;
    List_Name: string;
    list_description: string | null;
    slug: string;
    Visibility: boolean;
    recommended_movies: RecommendedMovie[];
    _count: {
      recommended_movies: number;
    };
  }>;
}

interface RecommendedMovie {
  documentId: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  original_title: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  year: string | null;
  genres: string[];
  director: string | null;
  runtime: number | null;
  tmdb_rating: number | null;
  overview: string | null;
  season_count: number | null;
  user_recommendation_note: string | null;
  user_rating: number | null;
  watch_providers: WatchProvider[];
  is_pinned: boolean;
  pin_order: number | null;
  display_order: number;
  movie_categories: Array<{
    documentId: string;
    genre_name: string;
  }>;
  cast_details: unknown | null;
  Media: Array<{
    documentId: string;
    url: string;
    caption: string | null;
  }>;
}

interface WatchProvider {
  provider_name: string;
  logo_path: string | null;
}
```

---

### 1.3 movieDetails

**Purpose**: Fetch full details for a single movie. Used by detail modal and edit form.

**Query**:
```graphql
query MovieDetails($documentId: ID!) {
  recommendedMovies(filters: { documentId: { eq: $documentId } }) {
    documentId
    tmdb_id
    media_type
    title
    original_title
    year
    poster_path
    backdrop_path
    genres
    director
    runtime
    tmdb_rating
    user_rating
    overview
    season_count
    user_recommendation_note
    watch_providers
    is_pinned
    pin_order
    display_order
    media_details
    cast_details
    Media {
      documentId
      url
      caption
    }
    movie_list {
      documentId
      List_Name
      slug
    }
    recommendation_category {
      documentId
      category_name
    }
    recommendation_sub_category {
      documentId
      sub_category_name
    }
  }
}
```

**Variables**:
```typescript
{
  documentId: string;
}
```

**Response Type**:
```typescript
interface MovieDetailsResponse {
  recommendedMovies: RecommendedMovie[];
}

interface RecommendedMovie {
  documentId: string;
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  original_title: string | null;
  year: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: string[];
  director: string | null;
  runtime: number | null;
  tmdb_rating: number | null;
  user_rating: number | null;
  overview: string | null;
  season_count: number | null;
  user_recommendation_note: string | null;
  watch_providers: WatchProvider[];
  is_pinned: boolean;
  pin_order: number | null;
  display_order: number;
  media_details: Record<string, unknown>;
  cast_details: unknown | null;
  Media: Array<{
    documentId: string;
    url: string;
    caption: string | null;
  }>;
  movie_list: {
    documentId: string;
    List_Name: string;
    slug: string;
  };
  movie_categories: Array<{
    documentId: string;
    genre_name: string;
  }>;
}
```

---

### 1.4 pinnedMovies

**Purpose**: Fetch all pinned movies for a user across all lists. Used by Top Picks row on public page and Top Picks manager.

**Query**:
```graphql
query PinnedMovies($accountDocumentId: ID!) {
  recommendedMovies(
    filters: {
      is_pinned: { eq: true }
      movie_list: { account: { documentId: { eq: $accountDocumentId } } }
    }
    sort: ["pin_order:asc"]
    pagination: { limit: 100 }
  ) {
    documentId
    tmdb_id
    media_type
    title
    poster_path
    backdrop_path
    tmdb_rating
    user_rating
    is_pinned
    pin_order
    movie_list {
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
}
```

**Response Type**:
```typescript
interface PinnedMoviesResponse {
  recommendedMovies: Array<{
    documentId: string;
    tmdb_id: number;
    media_type: 'movie' | 'tv';
    title: string;
    poster_path: string | null;
    backdrop_path: string | null;
    tmdb_rating: number | null;
    user_rating: number | null;
    is_pinned: boolean;
    pin_order: number | null;
    movie_list: {
      documentId: string;
      List_Name: string;
      slug: string;
    };
  }>;
}
```

---

### 1.5 moviesByGenre

**Purpose**: Fetch all movies for a user with a specific genre. Used by public genre filter/page.

**Query**:
```graphql
query MoviesByGenre($accountDocumentId: ID!, $genre: String!) {
  recommendedMovies(
    filters: {
      genres: { contains: $genre }
      movie_list: {
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
      }
    }
    sort: ["display_order:asc"]
    pagination: { limit: 200 }
  ) {
    documentId
    tmdb_id
    media_type
    title
    poster_path
    tmdb_rating
    user_rating
    genres
    overview
    year
    movie_list {
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
  genre: string; // e.g., "Action", "Drama"
}
```

**Response Type**:
```typescript
interface MoviesByGenreResponse {
  recommendedMovies: Array<{
    documentId: string;
    tmdb_id: number;
    media_type: 'movie' | 'tv';
    title: string;
    poster_path: string | null;
    tmdb_rating: number | null;
    user_rating: number | null;
    genres: string[];
    overview: string | null;
    year: string | null;
    movie_list: {
      documentId: string;
      List_Name: string;
      slug: string;
    };
  }>;
}
```

---

### 1.6 movieListBySlug

**Purpose**: Fetch a single movie list by slug and username for public list page.

**Query**:
```graphql
query MovieListBySlug($slug: String!, $username: String!) {
  movieLists(
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
    display_order
    top_picks_heading
    recommended_movies(sort: ["display_order:asc"]) {
      documentId
      tmdb_id
      media_type
      title
      poster_path
      backdrop_path
      year
      genres
      tmdb_rating
      user_rating
      overview
      watch_providers
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

**Variables**:
```typescript
{
  slug: string;
  username: string;
}
```

**Response Type**:
```typescript
interface MovieListBySlugResponse {
  movieLists: Array<{
    documentId: string;
    List_Name: string;
    list_description: string | null;
    slug: string;
    cover_image: {
      url: string;
      alternativeText: string | null;
    } | null;
    display_order: number;
    top_picks_heading: string | null;
    recommended_movies: Array<{
      documentId: string;
      tmdb_id: number;
      media_type: 'movie' | 'tv';
      title: string;
      poster_path: string | null;
      backdrop_path: string | null;
      year: string | null;
      genres: string[];
      tmdb_rating: number | null;
      user_rating: number | null;
      overview: string | null;
      watch_providers: WatchProvider[];
      is_pinned: boolean;
      pin_order: number | null;
    }>;
    account: {
      documentId: string;
      username: string;
    };
  }>;
}
```

---

### 1.7 publicMovieData

**Purpose**: Fetch aggregated data for public movies page (all published lists with movies and genre summary). Used by Movies Home public view.

**Query**:
```graphql
query PublicMovieData($accountDocumentId: ID!) {
  movieLists(
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
    cover_image {
      url
    }
    top_picks_heading
    recommended_movies(sort: ["is_pinned:desc", "pin_order:asc"]) {
      documentId
      tmdb_id
      media_type
      title
      poster_path
      tmdb_rating
      user_rating
      genres
      is_pinned
      pin_order
    }
  }
  recommendedMovies(
    filters: {
      movie_list: {
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
      }
    }
  ) {
    genres
  }
}
```

**Variables**:
```typescript
{
  accountDocumentId: string;
}
```

**Response Type**:
```typescript
interface PublicMovieDataResponse {
  movieLists: Array<{
    documentId: string;
    List_Name: string;
    list_description: string | null;
    slug: string;
    cover_image: {
      url: string;
    } | null;
    top_picks_heading: string | null;
    recommended_movies: Array<{
      documentId: string;
      tmdb_id: number;
      media_type: 'movie' | 'tv';
      title: string;
      poster_path: string | null;
      tmdb_rating: number | null;
      user_rating: number | null;
      genres: string[];
      is_pinned: boolean;
      pin_order: number | null;
    }>;
  }>;
  recommendedMovies: Array<{
    genres: string[];
  }>;
  // Computed on frontend:
  allGenres?: Set<string>;
}
```

---

## 2. GraphQL Mutations (Strapi)

### 2.1 createMovieList

**Purpose**: Create a new movie list for the authenticated user.

**Mutation**:
```graphql
mutation CreateMovieList(
  $List_Name: String!
  $list_description: String
  $slug: String!
  $Visibility: Boolean!
  $cover_image: ID
  $display_order: Int!
  $top_picks_heading: String
  $account: ID!
) {
  createMovieList(
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

**Input Variables**:
```typescript
interface CreateMovieListInput {
  List_Name: string;
  list_description?: string;
  slug: string;             // URL-safe slug
  Visibility: boolean;
  cover_image?: string;     // Media documentId
  display_order: number;
  top_picks_heading?: string;
  account: string;          // Account documentId
}
```

**Response Type**:
```typescript
interface CreateMovieListResponse {
  createMovieList: {
    documentId: string;
    List_Name: string;
    slug: string;
    Visibility: boolean;
    display_order: number;
  };
}
```

---

### 2.2 updateMovieList

**Purpose**: Update list metadata (name, description, cover, slug, visibility, display_order, top_picks_heading).

**Mutation**:
```graphql
mutation UpdateMovieList(
  $documentId: ID!
  $List_Name: String
  $list_description: String
  $slug: String
  $Visibility: Boolean
  $cover_image: ID
  $display_order: Int
  $top_picks_heading: String
) {
  updateMovieList(
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
    list_description
    slug
    Visibility
    display_order
    top_picks_heading
  }
}
```

**Input Variables**:
```typescript
interface UpdateMovieListInput {
  documentId: string;
  List_Name?: string;
  list_description?: string;
  slug?: string;
  Visibility?: boolean;
  cover_image?: string | null;  // Pass null to remove
  display_order?: number;
  top_picks_heading?: string;
}
```

**Response Type**:
```typescript
interface UpdateMovieListResponse {
  updateMovieList: {
    documentId: string;
    List_Name: string;
    list_description: string | null;
    slug: string;
    Visibility: boolean;
    display_order: number;
    top_picks_heading: string | null;
  };
}
```

---

### 2.3 deleteMovieList

**Purpose**: Delete a movie list. Optionally cascade delete its movies.

**Mutation**:
```graphql
mutation DeleteMovieList($documentId: ID!) {
  deleteMovieList(documentId: $documentId) {
    documentId
  }
}
```

**Input Variables**:
```typescript
interface DeleteMovieListInput {
  documentId: string;
}
```

**Response Type**:
```typescript
interface DeleteMovieListResponse {
  deleteMovieList: {
    documentId: string;
  };
}
```

**Note**: Cascading deletion of RecommendedMovie records is handled by Strapi relation settings. If configured with cascade, deleting a list also deletes all its movies. If configured without cascade, the API will fail with a validation error if movies exist.

---

### 2.4 createRecommendedMovie

**Purpose**: Create a new movie recommendation in a list.

**Mutation**:
```graphql
mutation CreateRecommendedMovie(
  $tmdb_id: Int!
  $media_type: ENUM_RECOMMENDEDMOVIE_MEDIA_TYPE!
  $title: String!
  $original_title: String
  $year: String
  $poster_path: String
  $backdrop_path: String
  $genres: JSON!
  $director: String
  $runtime: Int
  $tmdb_rating: Decimal
  $overview: String
  $season_count: Int
  $user_recommendation_note: JSON
  $user_rating: Int
  $watch_providers: JSON!
  $is_pinned: Boolean!
  $pin_order: Int
  $display_order: Int!
  $media_details: JSON
  $cast_details: JSON
  $movie_list: ID!
  $movie_categories: [ID]
) {
  createRecommendedMovie(
    data: {
      tmdb_id: $tmdb_id
      media_type: $media_type
      title: $title
      original_title: $original_title
      year: $year
      poster_path: $poster_path
      backdrop_path: $backdrop_path
      genres: $genres
      director: $director
      runtime: $runtime
      tmdb_rating: $tmdb_rating
      overview: $overview
      season_count: $season_count
      user_recommendation_note: $user_recommendation_note
      user_rating: $user_rating
      watch_providers: $watch_providers
      is_pinned: $is_pinned
      pin_order: $pin_order
      display_order: $display_order
      media_details: $media_details
      cast_details: $cast_details
      movie_list: $movie_list
      movie_categories: $movie_categories
    }
  ) {
    documentId
    tmdb_id
    media_type
    title
    display_order
    is_pinned
  }
}
```

**Input Variables**:
```typescript
interface CreateRecommendedMovieInput {
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  title: string;
  original_title?: string;
  year?: string;
  poster_path?: string;
  backdrop_path?: string;
  genres: string[];           // JSON array
  director?: string;
  runtime?: number;           // in minutes
  tmdb_rating?: number;       // 0-10
  overview?: string;
  season_count?: number;      // TV only
  user_recommendation_note?: unknown;
  user_rating?: number;
  watch_providers: WatchProvider[];  // JSON array
  is_pinned: boolean;
  pin_order?: number;
  display_order: number;
  media_details?: Record<string, unknown>;  // JSON
  cast_details?: unknown; // JSON
  movie_list: string;         // MovieList documentId
  movie_categories?: string[];
}

interface WatchProvider {
  provider_name: string;
  logo_path?: string;
}
```

**Response Type**:
```typescript
interface CreateRecommendedMovieResponse {
  createRecommendedMovie: {
    documentId: string;
    tmdb_id: number;
    media_type: 'movie' | 'tv';
    title: string;
    display_order: number;
    is_pinned: boolean;
  };
}
```

---

### 2.5 updateRecommendedMovie

**Purpose**: Update movie recommendation (note, watch_providers, pinning, ordering, media_details, categories).

**Mutation**:
```graphql
mutation UpdateRecommendedMovie(
  $documentId: ID!
  $user_recommendation_note: JSON
  $user_rating: Int
  $watch_providers: JSON
  $is_pinned: Boolean
  $pin_order: Int
  $display_order: Int
  $media_details: JSON
  $movie_categories: [ID]
) {
  updateRecommendedMovie(
    documentId: $documentId
    data: {
      user_recommendation_note: $user_recommendation_note
      user_rating: $user_rating
      watch_providers: $watch_providers
      is_pinned: $is_pinned
      pin_order: $pin_order
      display_order: $display_order
      media_details: $media_details
      movie_categories: $movie_categories
    }
  ) {
    documentId
    is_pinned
    pin_order
    display_order
    user_recommendation_note
  }
}
```

**Input Variables**:
```typescript
interface UpdateRecommendedMovieInput {
  documentId: string;
  user_recommendation_note?: unknown;
  user_rating?: number;
  watch_providers?: WatchProvider[];
  is_pinned?: boolean;
  pin_order?: number | null;
  display_order?: number;
  media_details?: Record<string, unknown>;
  movie_categories?: string[];
}
```

**Response Type**:
```typescript
interface UpdateRecommendedMovieResponse {
  updateRecommendedMovie: {
    documentId: string;
    is_pinned: boolean;
    pin_order: number | null;
    display_order: number;
    user_recommendation_note: string | null;
  };
}
```

---

### 2.6 deleteRecommendedMovie

**Purpose**: Delete a movie recommendation from a list.

**Mutation**:
```graphql
mutation DeleteRecommendedMovie($documentId: ID!) {
  deleteRecommendedMovie(documentId: $documentId) {
    documentId
  }
}
```

**Input Variables**:
```typescript
interface DeleteRecommendedMovieInput {
  documentId: string;
}
```

**Response Type**:
```typescript
interface DeleteRecommendedMovieResponse {
  deleteRecommendedMovie: {
    documentId: string;
  };
}
```

---

### 2.7 reorderMoviesInList

**Purpose**: Batch update display_order for multiple movies in a list (for drag-and-drop reordering).

**Mutation**:
```graphql
mutation ReorderMoviesInList($updates: [ReorderMovieInput!]!) {
  reorderMoviesInList(updates: $updates) {
    documentId
    display_order
  }
}
```

**Input Variables**:
```typescript
interface ReorderMovieInput {
  documentId: string;
  display_order: number;
}

interface ReorderMoviesInListInput {
  updates: ReorderMovieInput[];
}
```

**Response Type**:
```typescript
interface ReorderMoviesInListResponse {
  reorderMoviesInList: Array<{
    documentId: string;
    display_order: number;
  }>;
}
```

**Implementation Note**: This may need to be implemented as a custom Strapi controller if the default GraphQL mutations don't support batch updates. Alternatively, send multiple `updateRecommendedMovie` mutations in sequence or use a custom endpoint.

---

### 2.8 reorderPinnedMovies

**Purpose**: Batch update pin_order for pinned movies (for Top Picks reordering).

**Mutation**:
```graphql
mutation ReorderPinnedMovies($updates: [ReorderPinnedMovieInput!]!) {
  reorderPinnedMovies(updates: $updates) {
    documentId
    pin_order
  }
}
```

**Input Variables**:
```typescript
interface ReorderPinnedMovieInput {
  documentId: string;
  pin_order: number;
}

interface ReorderPinnedMoviesInput {
  updates: ReorderPinnedMovieInput[];
}
```

**Response Type**:
```typescript
interface ReorderPinnedMoviesResponse {
  reorderPinnedMovies: Array<{
    documentId: string;
    pin_order: number;
  }>;
}
```

**Implementation Note**: Similar to `reorderMoviesInList`, may require custom Strapi controller.

---

## 3. TMDB API Endpoints

All TMDB endpoints use the base URL `https://api.themoviedb.org/3` with authentication via Bearer token in the `Authorization` header.

**Auth Header**: `Authorization: Bearer {TMDB_API_READ_ACCESS_TOKEN}`

### 3.1 Search Multi

**Purpose**: Search movies and TV shows by query string. Client-side search for adding new recommendations.

**Endpoint**: `GET /search/multi`

**Request**:
```
GET https://api.themoviedb.org/3/search/multi
Authorization: Bearer {TMDB_API_READ_ACCESS_TOKEN}
Content-Type: application/json

Query Parameters:
  query (string, required):  Search query (e.g., "The Dark Knight")
  page (int, optional):      Page number for pagination (default: 1)
  include_adult (bool, optional): Include adult content (default: false)
  language (string, optional): ISO 639-1 language code (default: "en-US")
```

**Response (Relevant Fields)**:
```json
{
  "page": 1,
  "results": [
    {
      "id": 155,
      "media_type": "movie",
      "title": "The Dark Knight",
      "original_title": "The Dark Knight",
      "poster_path": "/1hRoyzDZ6yyVn1yZx91VOW0vJUX.jpg",
      "backdrop_path": "/1hsRY0a28hmHnVsVSE7e4pXQ5dK.jpg",
      "release_date": "2008-07-18",
      "genre_ids": [28, 80, 18],
      "overview": "When the menace known as the Joker wreaks havoc..."
    },
    {
      "id": 63633,
      "media_type": "tv",
      "name": "Breaking Bad",
      "original_name": "Breaking Bad",
      "poster_path": "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
      "backdrop_path": "/xnopI5Cer5eC2z6DK0enforce.jpg",
      "first_air_date": "2008-01-20",
      "genre_ids": [18, 80],
      "overview": "When an unassuming high school chemistry teacher..."
    }
  ],
  "total_pages": 42,
  "total_results": 820
}
```

**TypeScript Response Type**:
```typescript
interface TMDBSearchMultiResponse {
  page: number;
  results: Array<TMDBSearchResult>;
  total_pages: number;
  total_results: number;
}

type TMDBSearchResult = TMDBMovieSearchResult | TMDBTVSearchResult;

interface TMDBMovieSearchResult {
  id: number;
  media_type: 'movie';
  title: string;
  original_title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;  // YYYY-MM-DD
  genre_ids: number[];
  overview: string;
}

interface TMDBTVSearchResult {
  id: number;
  media_type: 'tv';
  name: string;
  original_name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;  // YYYY-MM-DD
  genre_ids: number[];
  overview: string;
}
```

---

### 3.2 Movie Details

**Purpose**: Fetch complete details for a specific movie, including credits and watch/streaming providers.

**Endpoint**: `GET /movie/{movie_id}`

**Request**:
```
GET https://api.themoviedb.org/3/movie/{movie_id}
Authorization: Bearer {TMDB_API_READ_ACCESS_TOKEN}
Content-Type: application/json

Path Parameters:
  movie_id (int, required): TMDB movie ID

Query Parameters:
  append_to_response (string): "credits,watch/providers"
  language (string, optional): ISO 639-1 language code (default: "en-US")
```

**Response (Relevant Fields)**:
```json
{
  "id": 155,
  "title": "The Dark Knight",
  "original_title": "The Dark Knight",
  "release_date": "2008-07-18",
  "runtime": 152,
  "genres": [
    { "id": 28, "name": "Action" },
    { "id": 80, "name": "Crime" },
    { "id": 18, "name": "Drama" }
  ],
  "poster_path": "/1hRoyzDZ6yyVn1yZx91VOW0vJUX.jpg",
  "backdrop_path": "/1hsRY0a28hmHnVsVSE7e4pXQ5dK.jpg",
  "overview": "When the menace known as the Joker wreaks havoc...",
  "vote_average": 8.5,
  "credits": {
    "crew": [
      {
        "name": "Christopher Nolan",
        "job": "Director",
        "credit_id": "..."
      }
    ]
  },
  "watch/providers": {
    "results": {
      "US": {
        "link": "https://www.themoviedb.org/movie/155/watch",
        "flatrate": [
          { "logo_path": "/path/to/logo.jpg", "provider_name": "Netflix", "provider_id": 8 }
        ],
        "rent": [
          { "logo_path": "/path/to/logo.jpg", "provider_name": "Amazon Prime Video", "provider_id": 119 }
        ]
      }
    }
  }
}
```

**TypeScript Response Type**:
```typescript
interface TMDBMovieDetailsResponse {
  id: number;
  title: string;
  original_title: string;
  release_date: string;  // YYYY-MM-DD
  runtime: number;       // in minutes
  genres: Array<{ id: number; name: string }>;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;  // 0-10
  credits: {
    crew: Array<{
      name: string;
      job: string;
      credit_id: string;
    }>;
  };
  ['watch/providers']: {
    results: Record<string, WatchProvidersRegion>;
  };
}

interface WatchProvidersRegion {
  link?: string;
  flatrate?: Array<{ logo_path: string; provider_name: string; provider_id: number }>;
  buy?: Array<{ logo_path: string; provider_name: string; provider_id: number }>;
  rent?: Array<{ logo_path: string; provider_name: string; provider_id: number }>;
}
```

---

### 3.3 TV Details

**Purpose**: Fetch complete details for a specific TV show, including credits and watch/streaming providers.

**Endpoint**: `GET /tv/{tv_id}`

**Request**:
```
GET https://api.themoviedb.org/3/tv/{tv_id}
Authorization: Bearer {TMDB_API_READ_ACCESS_TOKEN}
Content-Type: application/json

Path Parameters:
  tv_id (int, required): TMDB TV show ID

Query Parameters:
  append_to_response (string): "credits,watch/providers"
  language (string, optional): ISO 639-1 language code (default: "en-US")
```

**Response (Relevant Fields)**:
```json
{
  "id": 63633,
  "name": "Breaking Bad",
  "original_name": "Breaking Bad",
  "first_air_date": "2008-01-20",
  "last_air_date": "2013-09-29",
  "number_of_seasons": 5,
  "genres": [
    { "id": 18, "name": "Drama" },
    { "id": 80, "name": "Crime" }
  ],
  "poster_path": "/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
  "backdrop_path": "/xnopI5Cer5eC2z6DK0enforce.jpg",
  "overview": "When an unassuming high school chemistry teacher...",
  "vote_average": 9.2,
  "credits": {
    "crew": [
      {
        "name": "Vince Gilligan",
        "job": "Creator",
        "credit_id": "..."
      }
    ]
  },
  "watch/providers": {
    "results": {
      "US": {
        "link": "https://www.themoviedb.org/tv/63633/watch",
        "flatrate": [
          { "logo_path": "/path/to/logo.jpg", "provider_name": "Netflix", "provider_id": 8 }
        ]
      }
    }
  }
}
```

**TypeScript Response Type**:
```typescript
interface TMDBTVDetailsResponse {
  id: number;
  name: string;
  original_name: string;
  first_air_date: string;    // YYYY-MM-DD
  last_air_date: string | null;
  number_of_seasons: number;
  genres: Array<{ id: number; name: string }>;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;      // 0-10
  credits: {
    crew: Array<{
      name: string;
      job: string;
      credit_id: string;
    }>;
  };
  ['watch/providers']: {
    results: Record<string, WatchProvidersRegion>;
  };
}
```

---

### 3.4 Genre Lists

**Purpose**: Fetch master lists of genres for movies and TV shows. Used for filtering and categorization.

**Endpoint (Movies)**: `GET /genre/movie/list`

**Endpoint (TV)**: `GET /genre/tv/list`

**Request**:
```
GET https://api.themoviedb.org/3/genre/movie/list
Authorization: Bearer {TMDB_API_READ_ACCESS_TOKEN}
Content-Type: application/json

Query Parameters:
  language (string, optional): ISO 639-1 language code (default: "en-US")
```

**Response**:
```json
{
  "genres": [
    { "id": 28, "name": "Action" },
    { "id": 12, "name": "Adventure" },
    { "id": 16, "name": "Animation" },
    { "id": 35, "name": "Comedy" },
    { "id": 80, "name": "Crime" },
    { "id": 18, "name": "Drama" },
    { "id": 10751, "name": "Family" },
    { "id": 14, "name": "Fantasy" },
    { "id": 36, "name": "History" },
    { "id": 27, "name": "Horror" },
    { "id": 10402, "name": "Music" },
    { "id": 9648, "name": "Mystery" },
    { "id": 10749, "name": "Romance" },
    { "id": 878, "name": "Science Fiction" },
    { "id": 10770, "name": "TV Movie" },
    { "id": 53, "name": "Thriller" },
    { "id": 10752, "name": "War" },
    { "id": 37, "name": "Western" }
  ]
}
```

**TypeScript Response Type**:
```typescript
interface TMDBGenreListResponse {
  genres: Array<{
    id: number;
    name: string;
  }>;
}
```

---

## 4. Data Mapping: TMDB → Strapi RecommendedMovie

When a user adds a movie from TMDB search results, the frontend fetches full details from TMDB and maps them to Strapi RecommendedMovie fields:

| TMDB Field | Strapi Field | Notes |
|---|---|---|
| `id` | `tmdb_id` | Store as integer |
| `media_type` | `media_type` | "movie" or "tv" |
| `title` \| `name` | `title` | Movie title or TV show name |
| `original_title` \| `original_name` | `original_title` | Original language title |
| `release_date` (year part) \| `first_air_date` (year part) | `year` | Extracted YYYY as string |
| `poster_path` | `poster_path` | Full TMDB CDN URL or relative path |
| `backdrop_path` | `backdrop_path` | Full TMDB CDN URL or relative path |
| `genres[].name` | `genres` | JSON array of genre names: `["Action", "Drama"]` |
| `credits.crew[job="Director"].name` | `director` | First director found, or null |
| `runtime` | `runtime` | In minutes (movies only) |
| `vote_average` | `tmdb_rating` | 0-10 decimal scale |
| `overview` | `overview` | Plot summary |
| `number_of_seasons` | `season_count` | TV shows only; null for movies |
| `watch/providers.results.{region}.{type}[].provider_name` | `watch_providers` | JSON array: `[{ "provider_name": "Netflix", "logo_path": "..." }, ...]` |
| Full TMDB response (optional) | `media_details` | Entire TMDB response stored as JSON for reference |
| (User input) | `user_recommendation_note` | Rich text note explaining why added |
| (Default) | `is_pinned` | false (user can pin later) |
| (Default) | `display_order` | Auto-increment based on list size |

**Mapping Example (Movie)**:
```typescript
function mapTMDBMovieToRecommendedMovie(
  tmdbMovie: TMDBMovieDetailsResponse,
  movieListId: string,
  userNote?: string
): CreateRecommendedMovieInput {
  const director = tmdbMovie.credits.crew.find(c => c.job === 'Director')?.name || null;
  const watchProviders = [];
  const usProviders = tmdbMovie['watch/providers'].results['US'];
  if (usProviders?.flatrate) {
    watchProviders.push(...usProviders.flatrate.map(p => ({
      provider_name: p.provider_name,
      logo_path: p.logo_path,
    })));
  }

  return {
    tmdb_id: tmdbMovie.id,
    media_type: 'movie',
    title: tmdbMovie.title,
    original_title: tmdbMovie.original_title,
    year: tmdbMovie.release_date.split('-')[0],
    poster_path: tmdbMovie.poster_path,
    backdrop_path: tmdbMovie.backdrop_path,
    genres: tmdbMovie.genres.map(g => g.name),
    director,
    runtime: tmdbMovie.runtime,
    tmdb_rating: tmdbMovie.vote_average,
    overview: tmdbMovie.overview,
    watch_providers: watchProviders,
    is_pinned: false,
    display_order: 0,  // Will be set by frontend or incremented
    user_recommendation_note: userNote || '',
    media_details: tmdbMovie as unknown as Record<string, unknown>,
    movie_list: movieListId,
  };
}
```

---

## 5. Error Handling

### 5.1 Strapi GraphQL Errors

**Format**:
```json
{
  "errors": [
    {
      "message": "Validation error",
      "extensions": {
        "code": "GRAPHQL_VALIDATION_FAILED",
        "error": {
          "message": "List_Name is required"
        }
      }
    }
  ]
}
```

**Common Errors**:

| Scenario | Code | Message | Handling |
|---|---|---|---|
| Validation error (missing required field) | `GRAPHQL_VALIDATION_FAILED` | Field validation error | Display validation message to user; highlight field |
| Authentication error (no JWT or expired) | `UNAUTHENTICATED` | "Authentication required" | Redirect to login; refresh auth token |
| Authorization error (user doesn't own resource) | `FORBIDDEN` | "You do not have permission" | Show "Access denied" message |
| Resource not found | `NOT_FOUND` | "Document not found" | Show 404; navigate back |
| Duplicate slug | `GRAPHQL_VALIDATION_FAILED` | "Slug must be unique" | Suggest alternative slug; let user edit |

**Frontend Error Handling**:
```typescript
if (error?.networkError) {
  // Network connectivity issue
  console.error('Network error:', error.networkError);
  showToast('Network error. Please check your connection.');
} else if (error?.graphQLErrors?.length) {
  // GraphQL validation or business logic error
  const graphQLError = error.graphQLErrors[0];
  if (graphQLError.extensions?.code === 'UNAUTHENTICATED') {
    redirectToLogin();
  } else if (graphQLError.message.includes('Slug must be unique')) {
    setSlugError('This slug is already taken. Try another.');
  } else {
    showToast(`Error: ${graphQLError.message}`);
  }
}
```

---

### 5.2 TMDB API Errors

**Format**:
```json
{
  "success": false,
  "status_code": 401,
  "status_message": "Invalid API key: You must be granted a valid key."
}
```

**Common Errors**:

| Status | Message | Handling |
|---|---|---|
| 401 | Invalid API key | Check TMDB_API_READ_ACCESS_TOKEN in env; log error |
| 404 | The resource you requested could not be found | Movie/show doesn't exist on TMDB; show "Not found" in search |
| 429 | Your request count (X) is over the rate limit allowed | Rate limited; implement exponential backoff; show "Try again in a moment" |
| 500 | Internal Server Error | TMDB service down; retry with exponential backoff |

**Frontend Error Handling**:
```typescript
try {
  const response = await fetch(`https://api.themoviedb.org/3/search/multi?query=${query}`, {
    headers: { 'Authorization': `Bearer ${TMDB_API_READ_ACCESS_TOKEN}` },
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 429) {
      // Rate limited; wait and retry
      console.warn('TMDB rate limit hit');
      showToast('Search service temporarily unavailable. Please try again.');
    } else if (response.status === 404) {
      showToast('No results found.');
    } else {
      throw new Error(error.status_message);
    }
  }

  return await response.json();
} catch (error) {
  console.error('TMDB search error:', error);
  showToast('Error searching movies. Please try again.');
}
```

---

## 6. Rate Limiting & Caching

### TMDB Rate Limiting
- **Limit**: 40 requests / 10 seconds per API key
- **Response Header**: `X-RateLimit-Remaining` indicates remaining requests
- **Implementation**: Implement request queue with exponential backoff (1s, 2s, 4s, etc.)

### Apollo Client Caching
- **Cache Policy**: Use Apollo Client's default cache with `cache-first` for stable queries (genre lists)
- **Invalidation**: On mutations, invalidate related queries (e.g., after creating a movie, refetch `moviesByList`)
- **TTL**: Consider 5-minute TTL for TMDB data; longer (1 hour) for genre lists

---

## 7. Security Considerations

- **TMDB API Key**: Store in environment variable (`TMDB_API_READ_ACCESS_TOKEN`); never commit
- **JWT Auth**: Strapi mutations require valid JWT token; validate on every request
- **CSRF Protection**: If using cookies, ensure CSRF tokens are validated by Strapi
- **Rate Limiting**: Implement server-side rate limiting on Strapi mutations to prevent abuse
- **Public Data**: Ensure `Visibility` boolean is respected; never expose private lists in public queries

---

## 8. Appendix: Example Usage

### Add a Movie to a List
1. User searches for a movie via TMDB Search Multi endpoint
2. User clicks "Add to List"
3. Frontend fetches full details from TMDB Movie Details endpoint
4. Frontend maps TMDB data to Strapi RecommendedMovie input
5. Frontend calls `createRecommendedMovie` mutation
6. Apollo Client automatically refetches `moviesByList` query

### View Public Movie List
1. User navigates to `/movies/{username}/{slug}`
2. Frontend calls `movieListBySlug` query with filters `slug`, `username`, `Visibility=true`
3. Frontend renders carousel of movies sorted by `display_order`
4. Top Picks (is_pinned=true) displayed separately at top

### Manage Top Picks
1. User is on dashboard Movies > Top Picks
2. Frontend fetches `pinnedMovies` for the account
3. User drags to reorder; frontend calls `reorderPinnedMovies` mutation
4. Frontend refetches `pinnedMovies` to confirm changes
