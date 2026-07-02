import { gql } from "@apollo/client";

// ─────────────────────────────────────────────────────────────
// Query 1.1 — Product Lists by Account (Dashboard + Public)
// ─────────────────────────────────────────────────────────────
export const PRODUCT_LISTS_BY_ACCOUNT = gql`
  query ProductListsByAccount($accountDocumentId: ID!) {
    productLists(
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
      top_products_heading
      recommended_products(sort: ["display_order:asc"], pagination: { limit: 200 }) {
        documentId
        product_url
        title
        brand
        price
        currency
        buy_url
        logo_url
        description
        specifications
        is_pinned
        display_order
        images
        user_recommendation_note
        user_rating
        pin_order
        product_category {
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
// Query 1.2 — Products by List (paginated, for list view)
// ─────────────────────────────────────────────────────────────
export const PRODUCTS_BY_LIST = gql`
  query ProductsByList(
    $productListDocumentId: ID!
    $page: Int!
    $pageSize: Int!
  ) {
    productLists(
      filters: { documentId: { eq: $productListDocumentId } }
    ) {
      documentId
      List_Name
      list_description
      slug
      Visibility
      top_products_heading
      display_order
      recommended_products(
        sort: ["display_order:asc"]
        pagination: { start: $page, limit: $pageSize }
      ) {
        documentId
        product_url
        title
        brand
        price
        currency
        buy_url
        logo_url
        description
        specifications
        user_recommendation_note
        user_rating
        is_pinned
        pin_order
        display_order
        images
        product_category {
          documentId
          name
          slug
        }
      }
    }
  }
`;

export const PRODUCTS_BY_LIST_PAGE_SIZE = 200;
export const productsByListVars = (listId: string) => ({
  productListDocumentId: listId,
  page: 0,
  pageSize: PRODUCTS_BY_LIST_PAGE_SIZE,
});
export const refetchProductsByList = (listId: string) => [
  { query: PRODUCTS_BY_LIST, variables: productsByListVars(listId) },
];

// ─────────────────────────────────────────────────────────────
// Query 1.3 — Pinned Products (Top Picks) for a user
// ─────────────────────────────────────────────────────────────
export const PINNED_PRODUCTS = gql`
  query PinnedProducts($accountDocumentId: ID!) {
    recommendedProducts(
      filters: {
        is_pinned: { eq: true }
        product_list: { account: { documentId: { eq: $accountDocumentId } } }
      }
      sort: ["pin_order:asc"]
      pagination: { limit: 100 }
    ) {
      documentId
      product_url
      title
      logo_url
      brand
      price
      currency
      description
      user_recommendation_note
      user_rating
      is_pinned
      pin_order
      images
      product_category {
        documentId
        name
        slug
      }
      product_list {
        documentId
        List_Name
        slug
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.4 — Public Product Data (All published lists)
// ─────────────────────────────────────────────────────────────
export const PUBLIC_PRODUCT_DATA = gql`
  query PublicProductData($accountDocumentId: ID!) {
    productLists(
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
      top_products_heading
      recommended_products(
        sort: ["is_pinned:desc", "pin_order:asc", "display_order:asc"]
        pagination: { limit: 200 }
      ) {
        documentId
        product_url
        title
        logo_url
        brand
        price
        currency
        buy_url
        images
        description
        user_recommendation_note
        user_rating
        is_pinned
        pin_order
        product_category {
          documentId
          name
          slug
        }
      }
    }
    recommendedProducts(
      filters: {
        product_list: {
          account: { documentId: { eq: $accountDocumentId } }
          Visibility: { eq: true }
        }
      }
    ) {
      price
      currency
      product_category {
        documentId
        name
        slug
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.5 — Product List by Slug (Public list page)
// ─────────────────────────────────────────────────────────────
export const PRODUCT_LIST_BY_SLUG = gql`
  query ProductListBySlug($slug: String!, $username: String!) {
    productLists(
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
      top_products_heading
      recommended_products(sort: ["display_order:asc"], pagination: { limit: 200 }) {
        documentId
        product_url
        title
        logo_url
        brand
        price
        currency
        buy_url
        images
        description
        specifications
        user_recommendation_note
        user_rating
        is_pinned
        pin_order
        product_category {
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
// Query 1.6 — Products by Category (for public category page)
// ─────────────────────────────────────────────────────────────
export const PRODUCTS_BY_CATEGORY = gql`
  query ProductsByCategory($accountDocumentId: ID!, $categorySlug: String!) {
    recommendedProducts(
      filters: {
        product_category: { slug: { eq: $categorySlug } }
        product_list: {
          account: { documentId: { eq: $accountDocumentId } }
          Visibility: { eq: true }
        }
      }
      sort: ["display_order:asc"]
      pagination: { limit: 200 }
    ) {
      documentId
      product_url
      title
      logo_url
      brand
      price
      currency
      user_rating
      product_category {
        documentId
        name
        slug
      }
      product_list {
        documentId
        List_Name
        slug
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.7 — All Product Categories
// ─────────────────────────────────────────────────────────────
export const PRODUCT_CATEGORIES = gql`
  query ProductCategories {
    productCategories(pagination: { limit: 100 }) {
      documentId
      name
      slug
    }
  }
`;
