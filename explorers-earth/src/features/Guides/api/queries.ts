import { gql } from "@apollo/client";

// Query to get account ID from user
export const GET_USER_ACCOUNT_QUERY = gql`
  query GetUserAccount($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      accounts {
        documentId
        Account_Name
        public_guides
      }
    }
  }
`;

export const GET_GUIDES_QUERY = gql`
  query GetGuides($filters: GuideFiltersInput, $pagination: PaginationArg) {
    guides(filters: $filters, pagination: $pagination, sort: ["createdAt:desc"]) {
      documentId
      Title
      Description
      Guide_Type
      Visibility
      Estimated_Budget
      Budget_Type
      is_Multicity
      slug
      Guide_Media {
        url
        name
      }
      Place_Details
      Number_Of_Days
      Category
      Best_Time_To_Visit
      Guide_Tags
      Tips_Notes
      Guide_Section_Details
      guide_sections {
        documentId
        Timeline
        Stay
        Recommendation_Activity
        Budget
      }
      account {
        documentId
      }
      is_pinned
      pin_order
      display_order
      createdAt
      updatedAt
    }
  }
`;

export const GET_GUIDE_BY_ID_QUERY = gql`
  query GetGuideById($documentId: ID!) {
    guide(documentId: $documentId) {
      documentId
      Title
      Description
      Guide_Type
      Visibility
      Estimated_Budget
      Budget_Type
      is_Multicity
      Number_Of_Days
      Category
      Best_Time_To_Visit
      slug
      Guide_Media {
        url
        name
      }
      Place_Details
      Tips_Notes
      Guide_Section_Details
      Guide_Tags
      guide_sections(pagination: { limit: 100 }, sort: ["Sequence:asc"]) {
        documentId
        Title
        Sequence
        Description
        Timeline
        Transport
        Stay
        Recommendation_Activity
        Map_Details
        Packing_List
        Pre_Tasks
        Section_tags
        Budget
      }
      is_pinned
      pin_order
      display_order
      createdAt
      updatedAt
    }
  }
`;

// Query to fetch all guide categories from Guide_Category collection
// Each category is a separate entry with Category_Name field
export const GET_GUIDE_CATEGORIES_QUERY = gql`
  query GetGuideCategories {
    guideCategories(pagination: { limit: 100 }) {
      documentId
      Category_Name
    }
  }
`;

export const GET_GUIDE_SECTIONS_QUERY = gql`
  query GetGuideSections($guideDocumentId: ID!) {
    guideSections(
      filters: { guide: { documentId: { eq: $guideDocumentId } } }
      pagination: { limit: 100 }
      sort: ["Sequence:asc"]
    ) {
      documentId
      Title
      Sequence
      Description
      Timeline
      Transport
      Stay
      Recommendation_Activity
      Map_Details
      Packing_List
      Pre_Tasks
      Section_tags
      Budget
      createdAt
      updatedAt
    }
  }
`;

// Query to get public guides by account (for public pages)
export const GET_PUBLIC_GUIDES_QUERY = gql`
  query GetPublicGuides($filters: GuideFiltersInput, $pagination: PaginationArg) {
    guides(filters: $filters, pagination: $pagination, sort: ["createdAt:desc"]) {
      documentId
      Title
      Description
      Guide_Type
      Visibility
      Estimated_Budget
      Budget_Type
      is_Multicity
      slug
      Guide_Media {
        url
        name
      }
      Place_Details
      Number_Of_Days
      Category
      Best_Time_To_Visit
      Guide_Tags
      Tips_Notes
      account {
        documentId
      }
      is_pinned
      pin_order
      display_order
      createdAt
      updatedAt
    }
  }
`;

// Query to get a single public guide by ID (for public viewing)
export const GET_PUBLIC_GUIDE_BY_ID_QUERY = gql`
  query GetPublicGuideById($documentId: ID!) {
    guide(documentId: $documentId) {
      documentId
      Title
      Description
      Guide_Type
      Visibility
      Estimated_Budget
      Number_Of_Days
      slug
      Guide_Media {
        url
        name
      }
      Place_Details
      Tips_Notes
      Guide_Section_Details
      Guide_Tags
      guide_sections(pagination: { limit: 100 }, sort: ["Sequence:asc"]) {
        documentId
        Title
        Sequence
        Description
        Timeline
        Transport
        Stay
        Recommendation_Activity
        Map_Details
        Packing_List
        Pre_Tasks
        Section_tags
        Budget
      }
      is_pinned
      pin_order
      display_order
      createdAt
      updatedAt
    }
  }
`;

// Resolve a public guide leaf in one account-scoped, visibility-scoped lookup.
export const GET_PUBLIC_GUIDE_BY_SLUG_QUERY = gql`
  query GetPublicGuideBySlug(
    $accountDocumentId: ID!
    $slug: String!
    $documentId: ID!
    $sectionPagination: PaginationArg!
  ) {
    guides(
      filters: {
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
        or: [{ slug: { eq: $slug } }, { documentId: { eq: $documentId } }]
      }
      pagination: { limit: 1 }
    ) {
      documentId
      Title
      Description
      Guide_Type
      Visibility
      Estimated_Budget
      Number_Of_Days
      slug
      Guide_Media {
        url
        name
      }
      Place_Details
      Tips_Notes
      Guide_Section_Details
      Guide_Tags
      is_pinned
      pin_order
      display_order
      createdAt
      updatedAt
    }
    guideSections_connection(
      filters: {
        guide: {
          or: [
            {
              account: { documentId: { eq: $accountDocumentId } }
              Visibility: { eq: true }
              slug: { eq: $slug }
            }
            {
              account: { documentId: { eq: $accountDocumentId } }
              Visibility: { eq: true }
              documentId: { eq: $documentId }
            }
          ]
        }
      }
      pagination: $sectionPagination
      sort: ["Sequence:asc", "documentId:asc"]
    ) {
      nodes {
        documentId
        Title
        Sequence
        Description
        Timeline
        Transport
        Stay
        Recommendation_Activity
        Map_Details
        Packing_List
        Pre_Tasks
        Section_tags
        Budget
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
