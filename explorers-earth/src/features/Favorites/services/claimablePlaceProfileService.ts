import { ApolloClient, gql } from '@apollo/client';
import { 
  createClaimablePlaceProfileMutation,
  updateClaimablePlaceProfileMutation,
  findClaimablePlaceProfileByPlaceIdQuery
} from '../api/mutation';

export interface ClaimablePlaceProfileData {
  Place_Id: string;
  Name: string;
  Address: string;
  Lat: number;
  Long: number;
  Phone?: string;
  Website?: string;
  Meta_Data?: any;
  currentUserId: string;
}

export interface ClaimablePlaceProfileResult {
  documentId: string;
  Place_Id: string;
  Name: string;
  Address: string;
  Lat: number;
  Long: number;
  Phone?: string;
  Website?: string;
  Meta_Data?: any;
  Recommendation_Count: number;
  Added_By_User: string[];
  Is_Claimed: boolean;
  Claiming_Account?: {
    documentId: string;
  };
}

export class ClaimablePlaceProfileService {
  constructor(private apolloClient: ApolloClient<any>) {}

  async updateOrCreateClaimablePlaceProfile(
    data: ClaimablePlaceProfileData
  ): Promise<ClaimablePlaceProfileResult | null> {
    try {
      try {
        await this.apolloClient.query({
          query: gql`query { claimablePlaceProfiles { documentId } }`,
          fetchPolicy: 'network-only'
        });
      } catch (collectionError) {
        return null;
      }

      const existingRecords = await this.apolloClient.query({
        query: findClaimablePlaceProfileByPlaceIdQuery,
        variables: {
          filters: {
            Place_Id: {
              eq: data.Place_Id
            }
          }
        },
        fetchPolicy: 'network-only'
      });

      const existingRecord = existingRecords.data.claimablePlaceProfiles[0];

      if (!existingRecord) {
        const result = await this.apolloClient.mutate({
          mutation: createClaimablePlaceProfileMutation,
          variables: {
            data: {
              Place_Id: data.Place_Id,
              Name: data.Name,
              Address: data.Address,
              Lat: data.Lat,
              Long: data.Long,
              Phone: data.Phone,
              Website: data.Website,
              Meta_Data: data.Meta_Data,
              Recommendation_Count: 1,
              Added_By_User: [data.currentUserId],
              Is_Claimed: false,
            },
          },
        });

        if (result.errors) {
          throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
        }

        return result.data.createClaimablePlaceProfile;
      } else {
        const addedByUsers = existingRecord.Added_By_User || [];

        if (addedByUsers.includes(data.currentUserId)) {
          return existingRecord;
        }
        
        const result = await this.apolloClient.mutate({
          mutation: updateClaimablePlaceProfileMutation,
          variables: {
            documentId: existingRecord.documentId,
            data: {
              Name: data.Name,
              Address: data.Address,
              Lat: data.Lat,
              Long: data.Long,
              Phone: data.Phone,
              Website: data.Website,
              Meta_Data: data.Meta_Data,
              Recommendation_Count: existingRecord.Recommendation_Count + 1,
              Added_By_User: [...addedByUsers, data.currentUserId],
            },
          },
        });

        if (result.errors) {
          throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
        }

        return result.data.updateClaimablePlaceProfile;
      }
    } catch (error) {
      console.error("Failed to update or create claimable place profile:", error);
      throw error;
    }
  }
}

export const createClaimablePlaceProfileService = (apolloClient: ApolloClient<any>) => {
  return new ClaimablePlaceProfileService(apolloClient);
};
