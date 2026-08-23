import { gql } from "@apollo/client";

// Fetches the count of published lists per content category for a given account.
// Used by PublicNav to rank auto-fill footer nav tabs by number of published lists.
export const getPublicCategoryListCountsQuery = gql`
  query PublicCategoryListCounts($accountDocumentId: ID!) {
    recommendationLists(
      filters: { account: { documentId: { eq: $accountDocumentId } }, Visibility: { eq: true } }
      pagination: { limit: 100 }
    ) { documentId }
    bookLists(
      filters: { account: { documentId: { eq: $accountDocumentId } }, visibility: { eq: true } }
      pagination: { limit: 100 }
    ) { documentId }
    movieLists(
      filters: { account: { documentId: { eq: $accountDocumentId } }, Visibility: { eq: true } }
      pagination: { limit: 100 }
    ) { documentId }
    gameLists(
      filters: { account: { documentId: { eq: $accountDocumentId } }, Visibility: { eq: true } }
      pagination: { limit: 100 }
    ) { documentId }
    appLists(
      filters: { account: { documentId: { eq: $accountDocumentId } }, Visibility: { eq: true } }
      pagination: { limit: 100 }
    ) { documentId }
    productLists(
      filters: { account: { documentId: { eq: $accountDocumentId } }, Visibility: { eq: true } }
      pagination: { limit: 100 }
    ) { documentId }
    personLists(
      filters: { account: { documentId: { eq: $accountDocumentId } }, Visibility: { eq: true } }
      pagination: { limit: 100 }
    ) { documentId }
    guides(
      filters: { account: { documentId: { eq: $accountDocumentId } }, Visibility: { eq: true } }
      pagination: { limit: 100 }
    ) { documentId }
  }
`;

export const recommendationListQuery = gql`
  query RecommendationLists {
    recommendationLists {
      documentId
      List_Name
      Visibility
      is_pinned
      pin_order
      display_order
      account {
        documentId
      }
      List_Name_Details
      Instagram_Media_URL
    }
  }
`;

export const recommendationCategoriesQuery = gql`
  query RecommendationCategories {
    recommendationCategories(pagination: { limit: 100 }) {
      Category_Name
      documentId
      recommendation_sub_categories {
        sub_category
        documentId
      }
    }
  }
`;

// Places leaf data only. Account identity, visibility, navigation pins, and
// theme are owned by PublicProfileBootstrapContext.
export const publicPlacesListsQuery = gql`
  query PublicPlacesLists($accountDocumentId: ID!) {
    recommendationLists(
      filters: {
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
      }
      pagination: { limit: 100 }
    ) {
      documentId
      List_Name
      slug
      Visibility
      is_pinned
      pin_order
      display_order
      List_Name_Details
      recommended_places(pagination: { limit: 100 }) {
        recommendation_category {
          Category_Name
        }
        documentId
        Media {
          url
        }
        Place_Details
        Recommendation_Type
        Contact_Name
        media_details
      }
      person_lists(sort: ["display_order:asc"], pagination: { limit: 50 }) {
        documentId
        List_Name
        slug
        Visibility
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
          display_order
          people_category {
            documentId
            Category_name
          }
        }
      }
      product_lists(sort: ["display_order:asc"], pagination: { limit: 50 }) {
        documentId
        List_Name
        slug
        Visibility
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
          user_recommendation_note
          user_rating
          is_pinned
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
  }
`;

// A place child is resolved by its published account-owned list directly. This
// avoids classifying a slug from an arbitrarily capped collection response.
export const publicPlaceListBySlugQuery = gql`
  query PublicPlaceListBySlug(
    $accountDocumentId: ID!
    $slug: String!
    $documentId: ID!
    $peoplePagination: PaginationArg!
    $productPagination: PaginationArg!
  ) {
    recommendationLists(
      filters: {
        account: { documentId: { eq: $accountDocumentId } }
        or: [{ slug: { eq: $slug } }, { documentId: { eq: $documentId } }]
        Visibility: { eq: true }
      }
      pagination: { limit: 1 }
    ) {
      documentId
      List_Name
      slug
      Visibility
      is_pinned
      pin_order
      display_order
      List_Name_Details
    }
    recommendedPeople_connection(
      filters: {
        person_list: {
          account: { documentId: { eq: $accountDocumentId } }
          Visibility: { eq: true }
          recommendation_list: {
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
      }
      pagination: $peoplePagination
      sort: ["display_order:asc", "documentId:asc"]
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
    recommendedProducts_connection(
      filters: {
        product_list: {
          account: { documentId: { eq: $accountDocumentId } }
          Visibility: { eq: true }
          recommendation_list: {
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
      }
      pagination: $productPagination
      sort: ["display_order:asc", "documentId:asc"]
    ) {
      nodes {
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
        display_order
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
      pageInfo {
        page
        pageSize
        pageCount
        total
      }
    }
  }
`;

export const publicRecommendedPlacesConnectionQuery = gql`
  query PublicRecommendedPlacesConnection(
    $filters: RecommendedPlaceFiltersInput
    $pagination: PaginationArg!
  ) {
    recommendedPlaces_connection(
      filters: $filters
      pagination: $pagination
      sort: ["createdAt:asc", "documentId:asc"]
    ) {
      nodes {
        documentId
        Place_Details
        media_details
        Recommendation_Type
        Contact_Name
        Media {
          url
        }
        recommendation_category {
          Category_Name
        }
        recommendation_list {
          documentId
        }
        user_rating
        google_rating
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

export function buildPublicRecommendedPlacesFilters(
  accountDocumentId: string,
  recommendationListDocumentId: string,
  categoryName?: string,
) {
  return {
    recommendation_list: {
      documentId: { eq: recommendationListDocumentId },
      account: { documentId: { eq: accountDocumentId } },
      Visibility: { eq: true },
    },
    ...(categoryName ? {
      recommendation_category: {
        Category_Name: { eq: categoryName },
      },
    } : {}),
  };
}

export const recommendedListByIdQuery = gql`
  query RecommendationLists($documentId: ID!) {
    recommendationList(documentId: $documentId) {
      recommended_places {
        documentId
        Place_Details
        recommendation_category {
          Category_Name
        }
      }
      documentId
    }
  }
`;

export const accountsDetailQuery = gql`
  query user($filters: AccountFiltersInput) {
    accounts(filters: $filters) {
      Account_Name
      Bio
      users_permissions_users {
        role {
          name
        }
      }
      bg_picture {
        url
        alternativeText
      }
      Primary_Address
      profile_picture {
        url
        alternativeText
      }
      documentId
      localtunes_integrated
      Account_Type
      social_media
      Feed_Data
      public_profile
      public_recommendations
      public_music
      public_movie
      public_books
      public_guides
      public_games
      public_apps
      public_products
      public_people
      pinned_nav_tabs
      auto_pinning
      recommendation_lists(pagination: { limit: 100 })  {
        documentId
        List_Name
        Visibility
        is_pinned
        pin_order
        display_order
        List_Name_Details
        recommended_places {
          recommendation_category {
            Category_Name
          }
          documentId
          Media {
            url
          }
          Place_Details
          Recommendation_Type
          Contact_Name
          media_details
        }
        person_lists(sort: ["display_order:asc"], pagination: { limit: 50 }) {
          documentId
          List_Name
          slug
          Visibility
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
            display_order
            people_category {
              documentId
              Category_name
            }
          }
        }
        product_lists(sort: ["display_order:asc"], pagination: { limit: 50 }) {
          documentId
          List_Name
          slug
          Visibility
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
            user_recommendation_note
            user_rating
            is_pinned
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
    }
  }
`;

export const accountsDetailsByPlace = gql`
  query user(
    $filters: AccountFiltersInput
    $listFilters: RecommendationListFiltersInput
  ) {
    accounts(filters: $filters) {
      Account_Name
      users_permissions_users {
        role {
          name
        }
      }
      bg_picture {
        url
        alternativeText
      }
      profile_picture {
        url
        alternativeText
      }
      Account_Type
      social_media
      public_profile
      public_recommendations
      public_music
      public_movie
      public_books
      public_guides
      public_games
      public_apps
      public_products
      public_people
      pinned_nav_tabs
      recommendation_lists(filters: $listFilters) {
        documentId
        List_Name
        Visibility
        is_pinned
        pin_order
        display_order
        recommended_places {
          recommendation_category {
            Category_Name
          }
          documentId
          Media {
            url
          }
          Place_Details
          Recommendation_Type
          Contact_Name
          media_details
        }
        person_lists(sort: ["display_order:asc"], pagination: { limit: 50 }) {
          documentId
          List_Name
          slug
          Visibility
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
            display_order
            people_category {
              documentId
              Category_name
            }
          }
        }
        product_lists(sort: ["display_order:asc"], pagination: { limit: 50 }) {
          documentId
          List_Name
          slug
          Visibility
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
            user_recommendation_note
            user_rating
            is_pinned
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
    }
  }
`;

export const placeDetailsQuery = gql`
  query RecommendedPlace($documentId: ID!) {
    recommendedPlace(documentId: $documentId) {
      Media {
        url
      }
      Contact_Name
      Contact_Number
      media_details
      Place_Details
      Person_Details
      Recommendation_Type
      Users_Social_URL
      Places_Social_Link
      Places_Website
      user_recommendation_note
      user_rating
      google_rating
      recommendation_category {
        Category_Name
      }
    }
  }
`;

export const getPlaceCoordinatesQuery = gql`
  query Account($filters: AccountFiltersInput) {
    accounts(filters: $filters) {
      Account_Name
      recommendation_lists(pagination: { limit: 100 }, filters: { Visibility: { eq: true } }) {
        List_Name
        recommended_places(pagination: { limit: 100 }) {
          Place_Details
          documentId
          Media {
            url
          }
          recommendation_category {
            Category_Name
          }
        }
      }
    }
  }
`;

export const getPlaceCoordinatesByListQuery = gql`
  query Account(
    $filters: AccountFiltersInput
    $listFilters: RecommendationListFiltersInput
  ) {
    accounts(filters: $filters) {
      recommendation_lists(filters: { and: [$listFilters, { Visibility: { eq: true } }] }, pagination: { limit: 100 }) {
        recommended_places(pagination: { limit: 100 }) {
          Place_Details
          documentId
          Media {
            url
          }
          recommendation_category {
            Category_Name
          }
        }
      }
    }
  }
`;

// Lean query for non-profile public pages (nav, guides, music)
// Only fetches minimal data needed for tab visibility and basic display
export const getPublicAccountBasicQuery = gql`
  query PublicAccountBasic($filters: AccountFiltersInput) {
    accounts(filters: $filters) {
      Account_Name
      Account_Type
      Primary_Address
      documentId
      bg_picture {
        url
      }
      profile_picture {
        url
      }
      localtunes_public
      public_profile
      public_recommendations
      public_music
      public_movie
      public_books
      public_guides
      public_games
      public_apps
      public_products
      public_people
      pinned_nav_tabs
      auto_pinning
    }
  }
`;

// Full profile data query — used ONLY on the PublicProfile page
// Includes social media, feed, bio, etc. but NOT mobile_number
// Mobile number is fetched separately only when visibility is confirmed
export const getPublicProfileDataQuery = gql`
  query PublicProfileContent($documentId: ID!) {
    account(documentId: $documentId) {
      Bio
      createdAt
      Public_Profile_Address
      Feed_Data
      mobile_number_visibility
    }
  }
`;

// @deprecated — Use getPublicAccountBasicQuery or getPublicProfileDataQuery instead
// Kept for backward compatibility but sensitive fields removed
export const getAccountsDataQuery = gql`
  query Account($filters: AccountFiltersInput) {
    accounts(filters: $filters) {
      Account_Name
      Account_Type
      Primary_Address
      Bio
      bg_picture {
        url
      }
      createdAt
      documentId
      profile_picture {
        url
      }
      social_media
      localtunes_public
      Public_Profile_Address
      Feed_Data
      mobile_number_visibility
      public_profile
      public_recommendations
      public_music
      public_movie
      public_books
      public_guides
      public_games
      public_apps
      public_products
      public_people
      pinned_nav_tabs
      auto_pinning
    }
  }
`;

export const getUserMobileStatusQuery = gql`
  query Account($documentId: ID!) {
    account(documentId: $documentId) {
      mobile_number_visibility
    }
  }
`;

export const getUserMobileNumberQuery = gql`
  query Account($documentId: ID!) {
    account(documentId: $documentId) {
      mobile_number
    }
  }
`;
