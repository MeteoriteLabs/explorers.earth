import { gql } from "@apollo/client";

export const CREATE_GUIDE_MUTATION = gql`
  mutation CreateGuide($data: GuideInput!) {
    createGuide(data: $data) {
      documentId
      Title
      Description
      Guide_Type
      Visibility
      Estimated_Budget
    }
  }
`;

export const UPDATE_GUIDE_MUTATION = gql`
  mutation UpdateGuide($documentId: ID!, $data: GuideInput!) {
    updateGuide(documentId: $documentId, data: $data) {
      documentId
      Title
      Description
      Guide_Type
      Visibility
      Estimated_Budget
      Tips_Notes
      Guide_Tags
    }
  }
`;

export const DELETE_GUIDE_MUTATION = gql`
  mutation DeleteGuide($documentId: ID!) {
    deleteGuide(documentId: $documentId) {
      documentId
    }
  }
`;

export const CREATE_GUIDE_SECTION_MUTATION = gql`
  mutation CreateGuideSection($data: GuideSectionInput!) {
    createGuideSection(data: $data) {
      documentId
      Title
      Sequence
      Description
      Timeline
      Transport
      Stay
      Recommendation_Activity
      Map_Details
      Packing_List
      Pre_Tasks
      Section_tags
      Budget
    }
  }
`;

export const UPDATE_GUIDE_SECTION_MUTATION = gql`
  mutation UpdateGuideSection($documentId: ID!, $data: GuideSectionInput!) {
    updateGuideSection(documentId: $documentId, data: $data) {
      documentId
      Title
      Sequence
      Description
      Timeline
      Transport
      Stay
      Recommendation_Activity
      Map_Details
      Packing_List
      Pre_Tasks
      Section_tags
      Budget
    }
  }
`;

export const DELETE_GUIDE_SECTION_MUTATION = gql`
  mutation DeleteGuideSection($documentId: ID!) {
    deleteGuideSection(documentId: $documentId) {
      documentId
    }
  }
`;
