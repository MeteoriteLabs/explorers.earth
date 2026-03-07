import { gql } from "@apollo/client";

/**
 * GraphQL query to check if a username is available
 * Returns account data if username exists, empty array if available
 */
export const CHECK_USERNAME_AVAILABILITY = gql`
  query CheckUsernameAvailability($username: String!) {
    accounts(filters: { username: { eq: $username } }) {
      documentId
      username
      Account_Name
    }
  }
`;
