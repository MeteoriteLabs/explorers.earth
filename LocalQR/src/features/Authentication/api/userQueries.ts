import { gql } from "@apollo/client";

/**
 * GraphQL query to fetch the current user's profile data
 * Used for pre-populating forms with user information
 */
export const GET_CURRENT_USER_QUERY = gql`
  query GetCurrentUser($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      id
      documentId
      username
      email
      blocked
      createdAt
      updatedAt
    }
  }
`;

/**
 * GraphQL query to fetch user's basic profile info for onboarding
 * Includes username and email for form pre-population
 */
export const GET_USER_FOR_ONBOARDING = gql`
  query GetUserForOnboarding($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      username
      email
    }
  }
`;
