import { gql } from "@apollo/client";

export const recommendationListQuery = gql`
  query RecommendationLists {
    recommendationLists {
      documentId
      List_Name
      Visibility
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
      public_profile
      public_recommendations
      public_music
      public_movie
      public_guides
      recommendation_lists(pagination: { limit: 100 })  {
        documentId
        List_Name
        Visibility
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
      public_guides
      recommendation_lists(filters: $listFilters) {
        List_Name
        Visibility
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
      public_guides
    }
  }
`;

// Full profile data query — used ONLY on the PublicProfile page
// Includes social media, feed, bio, etc. but NOT mobile_number
// Mobile number is fetched separately only when visibility is confirmed
export const getPublicProfileDataQuery = gql`
  query PublicProfileData($filters: AccountFiltersInput) {
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
      public_guides
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
      public_guides
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
