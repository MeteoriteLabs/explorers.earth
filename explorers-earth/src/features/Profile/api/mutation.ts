import { gql } from "@apollo/client";

export const updateProfileMutation = gql`
  mutation UpdateAccount($documentId: ID!, $data: AccountInput!) {
    updateAccount(documentId: $documentId, data: $data) {
      documentId
      username
      Bio
      Addresss
      Primary_Address
      Public_Profile_Address
  Feed_Data
      Account_Type
      Account_Name
      mobile_number
      mobile_number_visibility
      social_media
      profile_picture {
        url
        alternativeText
      }
      bg_picture {
        url
        alternativeText
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