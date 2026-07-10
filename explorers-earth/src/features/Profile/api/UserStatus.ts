// src/features/profile/api/UserStatus.ts

import { gql } from "@apollo/client";

export const DASHBOARD_STATUS_QUERY = gql`
  query GetDashboardStatus($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      documentId
      # Traverses the confirmed relations: accounts, Account_Name, Bio, etc.
      accounts {
        documentId
        Account_Name 
        Bio
        updatedAt
        profile_picture {
          url
        }
        bg_picture {
          url
        }
        social_media
        Feed_Data
        recommendation_lists {
          documentId
          publishedAt
          recommended_places {
            documentId
          }
        }
      }
    }
  }
`;