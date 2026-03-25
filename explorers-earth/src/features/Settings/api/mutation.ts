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

export const deleteAccountMutation = gql`
  mutation DeleteAccount($deleteUsersPermissionsUserId: ID!, $filters: AccountFiltersInput, $deleteAccountDocumentId2: ID!, $documentId: ID!) {
    deleteRecommendationList(documentId: $documentId) {
      documentId
    }
    deleteUsersPermissionsUser(id: $deleteUsersPermissionsUserId) {
      data {
        accounts(filters: $filters) {
          Account_Name
          Account_Type
          documentId
          Bio
          Addresss
        }
      }
    }
    deleteAccount(documentId: $deleteAccountDocumentId2) {
      documentId
    }
  }
`;

export const accountQuery = gql`
  query Account($filters: AccountFiltersInput) {
    accounts(filters: $filters) {
      documentId
      localtunes_integrated
      public_profile
      public_recommendations
      public_music
      public_movie
      public_guides
      public_books
    }
  }
`;

export const updateAccountMutation = gql`
  mutation UpdateAccount($documentId: ID!, $data: AccountInput!) {
    updateAccount(documentId: $documentId, data: $data) {
      documentId
      localtunes_integrated
      localtunes_public
      public_profile
      public_recommendations
      public_music
      public_movie
      public_books
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
        localtunes_integrated
        localtunes_public
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
