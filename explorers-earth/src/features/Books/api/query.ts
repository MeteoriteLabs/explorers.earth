import { gql } from "@apollo/client";

// ─────────────────────────────────────────────────────────────
// Query 1.1 — Book Lists by Account (Dashboard + Public)
// ─────────────────────────────────────────────────────────────
export const BOOK_LISTS_BY_ACCOUNT = gql`
  query BookListsByAccount($accountDocumentId: ID!) {
    bookLists(
      filters: { account: { documentId: { eq: $accountDocumentId } } }
      sort: ["display_order:asc"]
      pagination: { limit: 100 }
    ) {
      documentId
      List_Name
      list_description
      slug
      visibility
      cover_image {
        url
        alternativeText
      }
      display_order
      top_reads_heading
      recommended_books(sort: ["display_order:asc"], pagination: { limit: 200 }) {
        documentId
        volume_id
        title
        subtitle
        authors
        year
        cover_url
        cover_url_large
        subjects
        publisher
        page_count
        google_rating
        user_rating
        description
        user_recommendation_note
        buy_links
        is_pinned
        pin_order
        media_details
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
// Query 1.2 — Books by List (paginated, for list view)
// ─────────────────────────────────────────────────────────────
export const BOOKS_BY_LIST = gql`
  query BooksByList(
    $bookListDocumentId: ID!
    $page: Int!
    $pageSize: Int!
  ) {
    bookLists(filters: { documentId: { eq: $bookListDocumentId } }) {
      documentId
      List_Name
      list_description
      slug
      visibility
      top_reads_heading
      recommended_books(
        sort: ["display_order:asc"]
        pagination: { start: $page, limit: $pageSize }
      ) {
        documentId
        volume_id
        title
        subtitle
        authors
        year
        cover_url
        cover_url_large
        subjects
        publisher
        page_count
        google_rating
        description
        isbn_13
        preview_link
        user_recommendation_note
        user_rating
        buy_links
        is_pinned
        pin_order
        display_order
        media_details
        book_categories {
          documentId
          subject_name
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
export const BOOKS_BY_LIST_PAGE_SIZE = 200;
export const booksByListVars = (listId: string) => ({
  bookListDocumentId: listId,
  page: 0,
  pageSize: BOOKS_BY_LIST_PAGE_SIZE,
});
export const refetchBooksByList = (listId: string) => [
  { query: BOOKS_BY_LIST, variables: booksByListVars(listId) },
];

// ─────────────────────────────────────────────────────────────
// Query 1.3 — Single Book Detail
// ─────────────────────────────────────────────────────────────
export const BOOK_DETAILS = gql`
  query BookDetails($documentId: ID!) {
    recommendedBooks(filters: { documentId: { eq: $documentId } }) {
      documentId
      volume_id
      title
      subtitle
      authors
      year
      cover_url
      cover_url_large
      subjects
      publisher
      page_count
      google_rating
      description
      isbn_13
      preview_link
      user_recommendation_note
      user_rating
      buy_links
      is_pinned
      pin_order
      display_order
      media_details
      Media {
        documentId
        url
        caption
      }
      book_list {
        documentId
        List_Name
        slug
      }
      book_categories {
        documentId
        subject_name
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.4 — Pinned Books (Top Reads) for a user
// ─────────────────────────────────────────────────────────────
export const PINNED_BOOKS = gql`
  query PinnedBooks($accountDocumentId: ID!) {
    recommendedBooks(
      filters: {
        is_pinned: { eq: true }
        book_list: { account: { documentId: { eq: $accountDocumentId } } }
      }
      sort: ["pin_order:asc"]
      pagination: { limit: 100 }
    ) {
      documentId
      volume_id
      title
      subtitle
      authors
      year
      cover_url
      cover_url_large
      subjects
      publisher
      page_count
      google_rating
      user_rating
      description
      user_recommendation_note
      buy_links
      is_pinned
      pin_order
      media_details
      Media {
        documentId
        url
        caption
      }
      book_list {
        documentId
        List_Name
        slug
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.5 — Books by Subject (for public subject page)
// ─────────────────────────────────────────────────────────────
export const BOOKS_BY_SUBJECT = gql`
  query BooksBySubject($accountDocumentId: ID!) {
    recommendedBooks(
      filters: {
        book_list: {
          account: { documentId: { eq: $accountDocumentId } }
          visibility: { eq: true }
        }
      }
      sort: ["display_order:asc"]
      pagination: { limit: 200 }
    ) {
      documentId
      volume_id
      title
      authors
      cover_url
      cover_url_large
      google_rating
      user_rating
      subjects
      year
      description
      media_details
      book_list {
        documentId
        List_Name
        slug
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.6 — Book List by Slug (Public list page)
// ─────────────────────────────────────────────────────────────
export const BOOK_LIST_BY_SLUG = gql`
  query BookListBySlug($slug: String!, $username: String!) {
    bookLists(
      filters: {
        slug: { eq: $slug }
        account: { username: { eq: $username } }
        visibility: { eq: true }
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
      top_reads_heading
      recommended_books(sort: ["display_order:asc"], pagination: { limit: 200 }) {
        documentId
        volume_id
        title
        subtitle
        authors
        year
        cover_url
        cover_url_large
        subjects
        google_rating
        user_rating
        description
        user_recommendation_note
        buy_links
        is_pinned
        pin_order
        media_details
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
// Query 1.7 — Public Book Data (All published lists)
// ─────────────────────────────────────────────────────────────
export const PUBLIC_BOOK_DATA = gql`
  query PublicBookData($accountDocumentId: ID!) {
    bookLists(
      filters: {
        account: { documentId: { eq: $accountDocumentId } }
        visibility: { eq: true }
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
      top_reads_heading
      recommended_books(
        sort: ["is_pinned:desc", "pin_order:asc", "display_order:asc"]
        pagination: { limit: 200 }
      ) {
        documentId
        volume_id
        title
        subtitle
        authors
        year
        cover_url
        cover_url_large
        subjects
        google_rating
        user_rating
        description
        user_recommendation_note
        buy_links
        is_pinned
        pin_order
        media_details
        Media {
          url
        }
        book_list {
          documentId
          List_Name
          slug
        }
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.8 — All Book Categories
// ─────────────────────────────────────────────────────────────
export const BOOK_CATEGORIES = gql`
  query BookCategories {
    bookCategories(pagination: { limit: 100 }) {
      documentId
      subject_name
    }
  }
`;
