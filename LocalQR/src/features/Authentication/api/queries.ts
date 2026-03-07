import { gql } from "@apollo/client";

// Mutation to create a verify claim record
export const createVerifyClaimMutation = gql`
  mutation CreateVerifyClaim($data: VerifyClaimInput!) {
    createVerifyClaim(data: $data) {
      documentId
      Name
      Email
      Phone
      Message
      Attachment {
        url
        name
        size
        mime
      }
      createdAt
      updatedAt
    }
  }
`;

// Query to check if claimable place profile exists based on phone only
export const checkClaimablePlaceProfileByPhoneQuery = gql`
  query CheckClaimablePlaceProfileByPhone($phone: String) {
    claimablePlaceProfiles(
      filters: {
        Phone: { eq: $phone }
      }
    ) {
      documentId
      Name
      Phone
      Address
      Website
      Recommendation_Count
      Place_Id
      Meta_Data
      Long
      Lat
      Is_Claimed
      createdAt
      updatedAt
      publishedAt
    }
  }
`;

// Query to check if claimable place profile exists based on address only
export const checkClaimablePlaceProfileByAddressQuery = gql`
  query CheckClaimablePlaceProfileByAddress($address: String) {
    claimablePlaceProfiles(
      filters: {
        Address: { containsi: $address }
      }
    ) {
      documentId
      Name
      Phone
      Address
      Website
      Recommendation_Count
      Place_Id
      Meta_Data
      Long
      Lat
      Is_Claimed
      createdAt
      updatedAt
      publishedAt
    }
  }
`;