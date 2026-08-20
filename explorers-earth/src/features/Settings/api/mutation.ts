import { gql } from "@apollo/client";

export const updatePasswordMutation = gql`
  mutation update(
    $currentPassword: String!
    $password: String!
    $passwordConfirmation: String!
  ) {
    changePassword(
      currentPassword: $currentPassword
      password: $password
      passwordConfirmation: $passwordConfirmation
    ) {
      user {
        id
      }
    }
  }
`;

export const updateBlockedStatusMutation = gql`
  mutation UpdateUsersPermissionsUser(
    $updateUsersPermissionsUserId: ID!
    $data: UsersPermissionsUserInput!
  ) {
    updateUsersPermissionsUser(id: $updateUsersPermissionsUserId, data: $data) {
      data {
        blocked
      }
    }
  }
`;

export const deleteExplorerAccountMutation = gql`
  mutation DeleteExplorerAccount($accountDocumentId: ID!) {
    deleteAccount(documentId: $accountDocumentId) {
      documentId
    }
  }
`;

export const deleteExplorerUserMutation = gql`
  mutation DeleteExplorerUser($userId: ID!, $filters: AccountFiltersInput, $recommendationDocumentId: ID!) {
    deleteRecommendationList(documentId: $recommendationDocumentId) {
      documentId
    }
    deleteUsersPermissionsUser(id: $userId) {
      data {
        documentId
        accounts(filters: $filters) {
          Account_Name
          Account_Type
          documentId
          Bio
          Addresss
        }
      }
    }
  }
`;

export const accountQuery = gql`
  query Account($filters: AccountFiltersInput) {
    accounts(filters: $filters) {
      documentId
      public_profile
      public_recommendations
      public_music
      public_movie
      public_guides
      public_books
      public_games
      public_apps
      public_products
      public_people
      pinned_nav_tabs
      auto_pinning
    }
  }
`;

export const updateAccountMutation = gql`
  mutation UpdateAccount($documentId: ID!, $data: AccountInput!) {
    updateAccount(documentId: $documentId, data: $data) {
      documentId
      public_profile
      public_recommendations
      public_music
      public_movie
      public_guides
      public_books
      public_games
      public_apps
      public_products
      public_people
      pinned_nav_tabs
      auto_pinning
    }
  }
`;

export const updateTabVisibilityMutation = gql`
  mutation UpdateTabVisibility($documentId: ID!, $data: AccountInput!) {
    updateAccount(documentId: $documentId, data: $data) {
      documentId
      public_profile
      public_recommendations
      public_music
      public_movie
      public_guides
      public_books
      public_games
      public_apps
      public_products
      public_people
      pinned_nav_tabs
      auto_pinning
    }
  }
`;

export const getUserAccountQuery = gql`
  query UsersPermissionsUser($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      username
      accounts {
        username
        documentId
      }
    }
  }
`;

export const addReasonForLeavingMutation = gql`
  mutation AddReasonForLeaving($Reasons: JSON!, $User_Details: JSON!) {
    createReasonForLeaving(data: { Reasons: $Reasons, User_Details: $User_Details }) {
      Reasons
      User_Details
    }
  }
`;

export const CHECK_PUBLISHED_LISTS = gql`
  query CheckPublishedLists($accountDocumentId: ID!) {
    bookLists(filters: { account: { documentId: { eq: $accountDocumentId } }, visibility: { eq: true } }, pagination: { limit: 1 }) {
      documentId
    }
    gameLists(filters: { account: { documentId: { eq: $accountDocumentId } }, Visibility: { eq: true } }, pagination: { limit: 1 }) {
      documentId
    }
    appLists(filters: { account: { documentId: { eq: $accountDocumentId } }, Visibility: { eq: true } }, pagination: { limit: 1 }) {
      documentId
    }
    productLists(filters: { account: { documentId: { eq: $accountDocumentId } }, Visibility: { eq: true } }, pagination: { limit: 1 }) {
      documentId
    }
    movieLists(filters: { account: { documentId: { eq: $accountDocumentId } }, Visibility: { eq: true } }, pagination: { limit: 1 }) {
      documentId
    }
    personLists(filters: { account: { documentId: { eq: $accountDocumentId } }, Visibility: { eq: true } }, pagination: { limit: 1 }) {
      documentId
    }
    guides(filters: { account: { documentId: { eq: $accountDocumentId } }, Visibility: { eq: true } }, pagination: { limit: 1 }) {
      documentId
    }
    recommendationLists(filters: { account: { documentId: { eq: $accountDocumentId } }, Visibility: { eq: true } }, pagination: { limit: 1 }) {
      documentId
    }
  }
`;

