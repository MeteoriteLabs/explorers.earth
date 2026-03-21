import { gql } from "@apollo/client";

// ─────────────────────────────────────────────────────────────
// Query 1.1 — Movie Lists by Account (Dashboard + Public)
// ─────────────────────────────────────────────────────────────
export const MOVIE_LISTS_BY_ACCOUNT = gql`
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
`;

// ─────────────────────────────────────────────────────────────
// Query 1.2 — Movies by List (paginated, for list view)
// ─────────────────────────────────────────────────────────────
export const MOVIES_BY_LIST = gql`
  query MoviesByList(
    $movieListDocumentId: ID!
    $page: Int!
    $pageSize: Int!
  ) {
    movieLists(filters: { documentId: { eq: $movieListDocumentId } }) {
      documentId
      List_Name
      list_description
      slug
      Visibility
      top_picks_heading
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
        Media {
          documentId
          url
          caption
        }
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.3 — Single Movie Detail
// ─────────────────────────────────────────────────────────────
export const MOVIE_DETAILS = gql`
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
      overview
      season_count
      user_recommendation_note
      watch_providers
      is_pinned
      pin_order
      display_order
      media_details
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
      movie_categories {
        documentId
        genre_name
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.4 — Pinned Movies (Top Picks) for a user
// ─────────────────────────────────────────────────────────────
export const PINNED_MOVIES = gql`
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
      year
      is_pinned
      pin_order
      movie_list {
        documentId
        List_Name
        slug
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.5 — Movies by Genre (for public genre page)
// ─────────────────────────────────────────────────────────────
export const MOVIES_BY_GENRE = gql`
  query MoviesByGenre($accountDocumentId: ID!, $genreName: String!) {
    recommendedMovies(
      filters: {
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
`;

// ─────────────────────────────────────────────────────────────
// Query 1.6 — Movie List by Slug (Public list page)
// ─────────────────────────────────────────────────────────────
export const MOVIE_LIST_BY_SLUG = gql`
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
        overview
        watch_providers
        is_pinned
        pin_order
        user_recommendation_note
        Media {
          documentId
          url
          caption
        }
      }
      account {
        documentId
        username
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.7 — Public Movie Data (All published lists + genre aggregation)
// ─────────────────────────────────────────────────────────────
export const PUBLIC_MOVIE_DATA = gql`
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
      recommended_movies(sort: ["is_pinned:desc", "pin_order:asc", "display_order:asc"]) {
        documentId
        tmdb_id
        media_type
        title
        poster_path
        tmdb_rating
        genres
        year
        is_pinned
        pin_order
        user_recommendation_note
        watch_providers
        overview
        director
        runtime
        season_count
        backdrop_path
        Media {
          url
        }
        movie_list {
          documentId
          List_Name
          slug
        }
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.8 — All Movie Categories
// ─────────────────────────────────────────────────────────────
export const MOVIE_CATEGORIES = gql`
  query MovieCategories {
    movieCategories(pagination: { limit: 100 }) {
      documentId
      genre_name
    }
  }
`;
