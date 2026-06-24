import { gql } from "@apollo/client";

// ─────────────────────────────────────────────────────────────
// Query 1.1 — Game Lists by Account (Dashboard + Public)
// ─────────────────────────────────────────────────────────────
export const GAME_LISTS_BY_ACCOUNT = gql`
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
      recommended_games(sort: ["display_order:asc"], pagination: { limit: 200 }) {
        documentId
        igdb_id
        title
        cover_url
        cover_url_large
        summary
        release_year
        genres
        platforms
        is_pinned
        display_order
        screenshot_ids
        media_details
        Media {
          documentId
          url
        }
        game_categories {
          documentId
          genre_name
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
// Query 1.2 — Games by List (paginated, for list view)
// ─────────────────────────────────────────────────────────────
export const GAMES_BY_LIST = gql`
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
      top_picks_heading
      display_order
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
        media_details
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
    }
  }
`;

// Page-0 window shared by the list view's query AND the Add-page refetch, so the
// two can never drift. A drift would make the refetch target a different cache
// key — a silent no-op that leaves the list stale after an add.
export const GAMES_BY_LIST_PAGE_SIZE = 200;
export const gamesByListVars = (listId: string) => ({
  gameListDocumentId: listId,
  page: 0,
  pageSize: GAMES_BY_LIST_PAGE_SIZE,
});
export const refetchGamesByList = (listId: string) => [
  { query: GAMES_BY_LIST, variables: gamesByListVars(listId) },
];

// ─────────────────────────────────────────────────────────────
// Query 1.3 — Single Game Detail
// ─────────────────────────────────────────────────────────────
export const GAME_DETAILS = gql`
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
`;

// ─────────────────────────────────────────────────────────────
// Query 1.4 — Pinned Games (Top Picks) for a user
// ─────────────────────────────────────────────────────────────
export const PINNED_GAMES = gql`
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
      summary
      release_year
      igdb_rating
      user_rating
      genres
      platforms
      user_recommendation_note
      is_pinned
      pin_order
      screenshot_ids
      media_details
      Media {
        documentId
        url
      }
      game_categories {
        documentId
        genre_name
      }
      game_list {
        documentId
        List_Name
        slug
      }
    }
}
`;

// ─────────────────────────────────────────────────────────────
// Query 1.5 — Games by Genre (for public genre page)
// ─────────────────────────────────────────────────────────────
export const GAMES_BY_GENRE = gql`
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
`;

// ─────────────────────────────────────────────────────────────
// Query 1.6 — Game List by Slug (Public list page)
// ─────────────────────────────────────────────────────────────
export const GAME_LIST_BY_SLUG = gql`
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
      recommended_games(sort: ["display_order:asc"], pagination: { limit: 200 }) {
        documentId
        igdb_id
        title
        cover_url
        summary
        release_year
        platforms
        genres
        screenshot_ids
        media_details
        igdb_rating
        user_rating
        is_pinned
        pin_order
        Media {
          documentId
          url
        }
        game_categories {
          documentId
          genre_name
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
// Query 1.7 — Public Game Data (All published lists)
// ─────────────────────────────────────────────────────────────
export const PUBLIC_GAME_DATA = gql`
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
      cover_image {
        url
      }
      top_picks_heading
      recommended_games(
        sort: ["is_pinned:desc", "pin_order:asc", "display_order:asc"]
        pagination: { limit: 200 }
      ) {
        documentId
        igdb_id
        title
        cover_url
        summary
        release_year
        screenshot_ids
        media_details
        user_recommendation_note
        igdb_rating
        user_rating
        genres
        platforms
        is_pinned
        pin_order
        Media {
          documentId
          url
          caption
        }
        game_categories {
          documentId
          genre_name
        }
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
      summary
      release_year
      screenshot_ids
      media_details
      game_categories {
        documentId
        genre_name
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.8 — All Game Categories
// ─────────────────────────────────────────────────────────────
export const GAME_CATEGORIES = gql`
  query GameCategories {
    gameCategories(pagination: { limit: 100 }) {
      documentId
      genre_name
    }
  }
`;
