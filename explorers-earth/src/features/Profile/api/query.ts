import { gql } from "@apollo/client";

export const profileDataQuery = gql`
  query UsersPermissionsUser($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      username
      email
      mobile_number
      mobile_number_visibility
      createdAt
      updatedAt
      accounts {
        documentId
        Account_Name
        Account_Type
        Bio
        Addresss
        Primary_Address
        Public_Profile_Address
  Feed_Data
        social_media
        mobile_number
        mobile_number_visibility
        createdAt
        updatedAt
        profile_picture {
          url
        }
        bg_picture {
          url
        }
      }
    }
  }
`;
