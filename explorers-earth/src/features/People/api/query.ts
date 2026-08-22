import { gql } from "@apollo/client";

// ─────────────────────────────────────────────────────────────
// Query 1.1 — Person Lists by Account (Dashboard + Public)
// ─────────────────────────────────────────────────────────────
export const PERSON_LISTS_BY_ACCOUNT = gql`
  query PersonListsByAccount($accountDocumentId: ID!) {
    personLists(
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
      top_people_heading: top_picks_heading
      recommended_people(sort: ["display_order:asc"], pagination: { limit: 200 }) {
        documentId
        name
        username_handle
        headline
        location
        avatar_path
        media_details
        primary_platform
        social_urls
        skills_tags
        user_recommendation_note
        user_rating
        is_pinned
        pin_order
        display_order
        people_category {
          documentId
          Category_name
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
// Query 1.2 — People by List (paginated, for list view)
// ─────────────────────────────────────────────────────────────
export const PEOPLE_BY_LIST = gql`
  query PeopleByList(
    $personListDocumentId: ID!
    $page: Int!
    $pageSize: Int!
  ) {
    personLists(
      filters: { documentId: { eq: $personListDocumentId } }
    ) {
      documentId
      List_Name
      list_description
      slug
      Visibility
      top_people_heading: top_picks_heading
      display_order
      recommended_people(
        sort: ["display_order:asc"]
        pagination: { start: $page, limit: $pageSize }
      ) {
        documentId
        name
        username_handle
        headline
        location
        avatar_path
        media_details
        primary_platform
        social_urls
        skills_tags
        user_recommendation_note
        user_rating
        is_pinned
        pin_order
        display_order
        people_category {
          documentId
          Category_name
        }
      }
    }
  }
`;

export const PEOPLE_BY_LIST_PAGE_SIZE = 200;
export const peopleByListVars = (listId: string) => ({
  personListDocumentId: listId,
  page: 0,
  pageSize: PEOPLE_BY_LIST_PAGE_SIZE,
});
export const refetchPeopleByList = (listId: string) => [
  { query: PEOPLE_BY_LIST, variables: peopleByListVars(listId) },
];

// ─────────────────────────────────────────────────────────────
// Query 1.3 — Pinned People (Top Picks) for a user
// ─────────────────────────────────────────────────────────────
export const PINNED_PEOPLE = gql`
  query PinnedPeople($accountDocumentId: ID!) {
    recommendedPeople(
      filters: {
        is_pinned: { eq: true }
        person_list: { account: { documentId: { eq: $accountDocumentId } } }
      }
      sort: ["pin_order:asc"]
      pagination: { limit: 100 }
    ) {
      documentId
      name
      username_handle
      headline
      location
      avatar_path
      media_details
      primary_platform
      social_urls
      skills_tags
      user_recommendation_note
      user_rating
      is_pinned
      pin_order
      people_category {
        documentId
        Category_name
      }
      person_list {
        documentId
        List_Name
        slug
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.4 — Public Person Data (All published lists)
// ─────────────────────────────────────────────────────────────
export const PUBLIC_PEOPLE_DATA = gql`
  query PublicPeopleData($accountDocumentId: ID!) {
    personLists(
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
      top_people_heading: top_picks_heading
      recommended_people(
        sort: ["is_pinned:desc", "pin_order:asc", "display_order:asc"]
        pagination: { limit: 200 }
      ) {
        documentId
        name
        username_handle
        headline
        location
        avatar_path
        media_details
        primary_platform
        social_urls
        skills_tags
        user_recommendation_note
        user_rating
        is_pinned
        pin_order
        people_category {
          documentId
          Category_name
        }
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.5 — Person List by Slug (Public list page)
// ─────────────────────────────────────────────────────────────
export const PERSON_LIST_BY_SLUG = gql`
  query PersonListBySlug(
    $slug: String!
    $accountDocumentId: ID!
    $pagination: PaginationArg!
  ) {
    personLists(
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
      top_people_heading: top_picks_heading
      account {
        documentId
        username
      }
    }
    recommendedPeople_connection(
      filters: {
        person_list: {
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
        name
        username_handle
        headline
        location
        avatar_path
        media_details
        primary_platform
        social_urls
        skills_tags
        user_recommendation_note
        user_rating
        is_pinned
        pin_order
        people_category {
          documentId
          Category_name
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

export const PEOPLE_BY_SECTOR = gql`
  query PeopleBySector(
    $accountDocumentId: ID!
    $taxonomyDocumentId: ID!
    $legacySectorName: String!
    $pagination: PaginationArg!
  ) {
    peopleCategories(
      filters: {
        or: [
          { documentId: { eq: $taxonomyDocumentId } }
          { Category_name: { eq: $legacySectorName } }
        ]
      }
      pagination: { limit: 1 }
    ) {
      documentId
      Category_name
    }
    recommendedPeople_connection(
      filters: {
        people_category: {
          or: [
            { documentId: { eq: $taxonomyDocumentId } }
            { Category_name: { eq: $legacySectorName } }
          ]
        }
        person_list: {
          account: { documentId: { eq: $accountDocumentId } }
          Visibility: { eq: true }
        }
      }
      sort: ["display_order:asc", "documentId:asc"]
      pagination: $pagination
    ) {
      nodes {
        documentId
        name
        username_handle
        headline
        location
        avatar_path
        media_details
        primary_platform
        social_urls
        skills_tags
        user_recommendation_note
        user_rating
        is_pinned
        pin_order
        display_order
        people_category {
          documentId
          Category_name
        }
        person_list {
          documentId
          List_Name
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
// Query 1.6 — All Person Categories (Mapped to PeopleCategory)
// ─────────────────────────────────────────────────────────────
export const PERSON_CATEGORIES = gql`
  query PersonCategories {
    peopleCategories(pagination: { limit: 100 }) {
      documentId
      Category_name
    }
  }
`;
