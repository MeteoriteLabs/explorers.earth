import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApolloClient } from '@apollo/client';
import { ClaimablePlaceProfileService, createClaimablePlaceProfileService } from '../services/claimablePlaceProfileService';

describe('ClaimablePlaceProfileService', () => {
  let mockApolloClient: any;
  let service: ClaimablePlaceProfileService;

  beforeEach(() => {
    mockApolloClient = {
      query: vi.fn(),
      mutate: vi.fn(),
    };
    service = createClaimablePlaceProfileService(mockApolloClient as unknown as ApolloClient<any>);
  });

  const mockData = {
    Place_Id: 'place_1',
    Name: 'Test Place',
    Address: '123 Test St',
    Lat: 10,
    Long: 20,
    currentUserId: 'user_1',
  };

  it('returns null if initial collection check fails', async () => {
    mockApolloClient.query.mockRejectedValueOnce(new Error('Collection missing'));
    
    const result = await service.updateOrCreateClaimablePlaceProfile(mockData);
    expect(result).toBeNull();
  });

  it('creates new profile if none exists', async () => {
    // Initial check passes
    mockApolloClient.query.mockResolvedValueOnce({});
    // Find query returns empty array
    mockApolloClient.query.mockResolvedValueOnce({
      data: { claimablePlaceProfiles: [] }
    });
    // Create mutation succeeds
    mockApolloClient.mutate.mockResolvedValueOnce({
      data: { createClaimablePlaceProfile: { documentId: 'new_doc' } }
    });

    const result = await service.updateOrCreateClaimablePlaceProfile(mockData);
    
    expect(mockApolloClient.mutate).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({
        data: expect.objectContaining({
          Place_Id: 'place_1',
          Recommendation_Count: 1,
          Added_By_User: ['user_1'],
        })
      })
    }));
    expect(result).toEqual({ documentId: 'new_doc' });
  });

  it('throws error if create mutation has GraphQL errors', async () => {
    mockApolloClient.query.mockResolvedValueOnce({});
    mockApolloClient.query.mockResolvedValueOnce({
      data: { claimablePlaceProfiles: [] }
    });
    mockApolloClient.mutate.mockResolvedValueOnce({
      errors: [{ message: 'Validation failed' }]
    });

    await expect(service.updateOrCreateClaimablePlaceProfile(mockData))
      .rejects.toThrow('GraphQL errors: Validation failed');
  });

  it('returns existing record if user already added it', async () => {
    mockApolloClient.query.mockResolvedValueOnce({});
    const existingRecord = {
      documentId: 'doc_1',
      Added_By_User: ['user_1'],
      Recommendation_Count: 1,
    };
    mockApolloClient.query.mockResolvedValueOnce({
      data: { claimablePlaceProfiles: [existingRecord] }
    });

    const result = await service.updateOrCreateClaimablePlaceProfile(mockData);
    
    expect(mockApolloClient.mutate).not.toHaveBeenCalled();
    expect(result).toEqual(existingRecord);
  });

  it('updates existing record if user has not added it', async () => {
    mockApolloClient.query.mockResolvedValueOnce({});
    const existingRecord = {
      documentId: 'doc_1',
      Added_By_User: ['user_2'],
      Recommendation_Count: 1,
    };
    mockApolloClient.query.mockResolvedValueOnce({
      data: { claimablePlaceProfiles: [existingRecord] }
    });
    // Update mutation succeeds
    mockApolloClient.mutate.mockResolvedValueOnce({
      data: { updateClaimablePlaceProfile: { documentId: 'doc_1', Recommendation_Count: 2 } }
    });

    const result = await service.updateOrCreateClaimablePlaceProfile(mockData);
    
    expect(mockApolloClient.mutate).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({
        documentId: 'doc_1',
        data: expect.objectContaining({
          Recommendation_Count: 2,
          Added_By_User: ['user_2', 'user_1'],
        })
      })
    }));
    expect(result).toEqual({ documentId: 'doc_1', Recommendation_Count: 2 });
  });

  it('throws error if update mutation has GraphQL errors', async () => {
    mockApolloClient.query.mockResolvedValueOnce({});
    mockApolloClient.query.mockResolvedValueOnce({
      data: { claimablePlaceProfiles: [{ documentId: 'doc_1', Added_By_User: [], Recommendation_Count: 1 }] }
    });
    mockApolloClient.mutate.mockResolvedValueOnce({
      errors: [{ message: 'Update failed' }]
    });

    await expect(service.updateOrCreateClaimablePlaceProfile(mockData))
      .rejects.toThrow('GraphQL errors: Update failed');
  });

  // Additional 4+ tests to reach >= 10:
  it('creates new profile passing optional properties (Phone, Website, Meta_Data) correctly', async () => {
    mockApolloClient.query.mockResolvedValueOnce({});
    mockApolloClient.query.mockResolvedValueOnce({
      data: { claimablePlaceProfiles: [] }
    });
    mockApolloClient.mutate.mockResolvedValueOnce({
      data: { createClaimablePlaceProfile: { documentId: 'new_doc_optional' } }
    });

    const optionalData = {
      ...mockData,
      Phone: '+1234567890',
      Website: 'https://place.com',
      Meta_Data: { rating: 4.8 },
    };

    const result = await service.updateOrCreateClaimablePlaceProfile(optionalData);

    expect(mockApolloClient.mutate).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({
        data: expect.objectContaining({
          Phone: '+1234567890',
          Website: 'https://place.com',
          Meta_Data: { rating: 4.8 },
        })
      })
    }));
    expect(result).toEqual({ documentId: 'new_doc_optional' });
  });

  it('updates existing record passing optional properties correctly', async () => {
    mockApolloClient.query.mockResolvedValueOnce({});
    const existingRecord = {
      documentId: 'doc_1',
      Added_By_User: ['user_2'],
      Recommendation_Count: 1,
    };
    mockApolloClient.query.mockResolvedValueOnce({
      data: { claimablePlaceProfiles: [existingRecord] }
    });
    mockApolloClient.mutate.mockResolvedValueOnce({
      data: { updateClaimablePlaceProfile: { documentId: 'doc_1' } }
    });

    const optionalData = {
      ...mockData,
      Phone: '+1234567890',
      Website: 'https://place.com',
      Meta_Data: { rating: 4.8 },
    };

    await service.updateOrCreateClaimablePlaceProfile(optionalData);

    expect(mockApolloClient.mutate).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({
        documentId: 'doc_1',
        data: expect.objectContaining({
          Phone: '+1234567890',
          Website: 'https://place.com',
          Meta_Data: { rating: 4.8 },
        })
      })
    }));
  });

  it('handles added_by_user being null or missing in existing record gracefully', async () => {
    mockApolloClient.query.mockResolvedValueOnce({});
    const existingRecord = {
      documentId: 'doc_1',
      Added_By_User: null,
      Recommendation_Count: 1,
    };
    mockApolloClient.query.mockResolvedValueOnce({
      data: { claimablePlaceProfiles: [existingRecord] }
    });
    mockApolloClient.mutate.mockResolvedValueOnce({
      data: { updateClaimablePlaceProfile: { documentId: 'doc_1' } }
    });

    await service.updateOrCreateClaimablePlaceProfile(mockData);

    expect(mockApolloClient.mutate).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({
        documentId: 'doc_1',
        data: expect.objectContaining({
          Added_By_User: ['user_1'],
        })
      })
    }));
  });

  it('propagates top-level unexpected errors', async () => {
    mockApolloClient.query.mockResolvedValueOnce({});
    mockApolloClient.query.mockRejectedValueOnce(new Error('Database disconnected'));

    await expect(service.updateOrCreateClaimablePlaceProfile(mockData))
      .rejects.toThrow('Database disconnected');
  });
});
