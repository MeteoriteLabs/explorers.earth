import { gql } from "@apollo/client";

// ─────────────────────────────────────────────────────────────
// Query 1.1 — App Lists by Account (Dashboard + Public)
// ─────────────────────────────────────────────────────────────
export const APP_LISTS_BY_ACCOUNT = gql`
  query AppListsByAccount($accountDocumentId: ID!) {
    appLists(
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
      top_apps_heading
      recommended_apps(sort: ["display_order:asc"], pagination: { limit: 200 }) {
        documentId
        app_url
        title
        description
        logo_url
        developer
        platforms
        price_tier
        download_url
        is_pinned
        display_order
        screenshots
        user_recommendation_note
        user_rating
        pin_order
        app_category {
          documentId
          name
          slug
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
// Query 1.2 — Apps by List (paginated, for list view)
// ─────────────────────────────────────────────────────────────
export const APPS_BY_LIST = gql`
  query AppsByList(
    $appListDocumentId: ID!
    $page: Int!
    $pageSize: Int!
  ) {
    appLists(
      filters: { documentId: { eq: $appListDocumentId } }
    ) {
      documentId
      List_Name
      list_description
      slug
      Visibility
      top_apps_heading
      display_order
      recommended_apps(
        sort: ["display_order:asc"]
        pagination: { start: $page, limit: $pageSize }
      ) {
        documentId
        app_url
        title
        description
        logo_url
        developer
        platforms
        price_tier
        download_url
        user_recommendation_note
        user_rating
        is_pinned
        pin_order
        display_order
        screenshots
        app_category {
          documentId
          name
          slug
        }
      }
    }
  }
`;

export const APPS_BY_LIST_PAGE_SIZE = 200;
export const appsByListVars = (listId: string) => ({
  appListDocumentId: listId,
  page: 0,
  pageSize: APPS_BY_LIST_PAGE_SIZE,
});
export const refetchAppsByList = (listId: string) => [
  { query: APPS_BY_LIST, variables: appsByListVars(listId) },
];

// ─────────────────────────────────────────────────────────────
// Query 1.3 — Pinned Apps (Top Picks) for a user
// ─────────────────────────────────────────────────────────────
export const PINNED_APPS = gql`
  query PinnedApps($accountDocumentId: ID!) {
    recommendedApps(
      filters: {
        is_pinned: { eq: true }
        app_list: { account: { documentId: { eq: $accountDocumentId } } }
      }
      sort: ["pin_order:asc"]
      pagination: { limit: 100 }
    ) {
      documentId
      app_url
      title
      logo_url
      description
      developer
      platforms
      price_tier
      user_recommendation_note
      user_rating
      is_pinned
      pin_order
      screenshots
      app_category {
        documentId
        name
        slug
      }
      app_list {
        documentId
        List_Name
        slug
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.4 — Public App Data (All published lists)
// ─────────────────────────────────────────────────────────────
export const PUBLIC_APP_DATA = gql`
  query PublicAppData($accountDocumentId: ID!) {
    appLists(
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
      top_apps_heading
      recommended_apps(
        sort: ["is_pinned:desc", "pin_order:asc", "display_order:asc"]
        pagination: { limit: 200 }
      ) {
        documentId
        app_url
        title
        logo_url
        description
        developer
        platforms
        price_tier
        download_url
        screenshots
        user_recommendation_note
        user_rating
        is_pinned
        pin_order
        app_category {
          documentId
          name
          slug
        }
      }
    }
    recommendedApps(
      filters: {
        app_list: {
          account: { documentId: { eq: $accountDocumentId } }
          Visibility: { eq: true }
        }
      }
    ) {
      platforms
      price_tier
      app_category {
        documentId
        name
        slug
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.5 — App List by Slug (Public list page)
// ─────────────────────────────────────────────────────────────
export const APP_LIST_BY_SLUG = gql`
  query AppListBySlug(
    $slug: String!
    $accountDocumentId: ID!
    $pagination: PaginationArg!
  ) {
    appLists(
      filters: {
        slug: { eq: $slug }
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
      }
      pagination: { limit: 1 }
    ) {
      documentId
      List_Name
      list_description
      slug
      cover_image {
        url
        alternativeText
      }
      top_apps_heading
      account {
        documentId
        username
      }
    }
    recommendedApps_connection(
      filters: {
        app_list: {
          slug: { eq: $slug }
          account: { documentId: { eq: $accountDocumentId } }
          Visibility: { eq: true }
        }
      }
      sort: ["display_order:asc", "documentId:asc"]
      pagination: $pagination
    ) {
      nodes {
        documentId
        app_url
        title
        logo_url
        description
        developer
        platforms
        price_tier
        download_url
        screenshots
        user_recommendation_note
        user_rating
        is_pinned
        pin_order
        app_category {
          documentId
          name
          slug
        }
      }
      pageInfo {
        page
        pageSize
        pageCount
        total
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.6 — Apps by Category (for public category page)
// ─────────────────────────────────────────────────────────────
export const APPS_BY_CATEGORY = gql`
  query AppsByCategory($accountDocumentId: ID!, $categorySlug: String!) {
    recommendedApps(
      filters: {
        app_category: { slug: { eq: $categorySlug } }
        app_list: {
          account: { documentId: { eq: $accountDocumentId } }
          Visibility: { eq: true }
        }
      }
      sort: ["display_order:asc"]
      pagination: { limit: 200 }
    ) {
      documentId
      app_url
      title
      logo_url
      developer
      platforms
      price_tier
      user_rating
      app_category {
        documentId
        name
        slug
      }
      app_list {
        documentId
        List_Name
        slug
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.7 — All App Categories
// ─────────────────────────────────────────────────────────────
export const APP_CATEGORIES = gql`
  query AppCategories {
    appCategories(pagination: { limit: 100 }) {
      documentId
      name
      slug
    }
  }
`;
