import { gql } from "@apollo/client";

// Query to get account ID from user
export const GET_USER_ACCOUNT_QUERY = gql`
  query GetUserAccount($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      accounts {
        documentId
        Account_Name
        Account_Type
        mobile_number
        public_guides
      }
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

