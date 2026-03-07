/**
 * Strapi GraphQL Service
 * Handles interactions with Strapi CMS for song limit tracking
 */

interface SongLimitInput {
  username: string;
  song_requests: number;
}

interface SongLimit {
  documentId: string;
  username: string;
  song_requests: number;
  ai_guide_requests?: number;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface CreateSongLimitResponse {
  createSongLimit: SongLimit;
}

interface UpdateSongLimitResponse {
  updateSongLimit: SongLimit;
}

interface SongLimitsQueryResponse {
  songLimits: SongLimit[];
}

class StrapiService {
  private strapiUrl: string;
  private accessToken: string;
  private graphqlEndpoint: string;

  constructor() {
    this.strapiUrl = process.env.STRAPI_URL || '';
    this.accessToken = process.env.STRAPI_ACCESS_TOKEN || '';
    this.graphqlEndpoint = `${this.strapiUrl}/graphql`;

    console.log('🔧 Strapi Service initialized:', {
      strapiUrl: this.strapiUrl || 'NOT SET',
      accessToken: this.accessToken ? `${this.accessToken.substring(0, 10)}...` : 'NOT SET',
      graphqlEndpoint: this.graphqlEndpoint || 'NOT SET',
      isConfigured: !!(this.strapiUrl && this.accessToken)
    });

    if (!this.strapiUrl) {
      console.warn('⚠️ STRAPI_URL environment variable is not set');
    }
    if (!this.accessToken) {
      console.warn('⚠️ STRAPI_ACCESS_TOKEN environment variable is not set');
    }
  }

  /**
   * Execute a GraphQL query/mutation
   */
  private async executeGraphQL<T>(
    query: string,
    variables?: Record<string, any>
  ): Promise<T> {
    if (!this.strapiUrl || !this.accessToken) {
      const error = 'Strapi configuration is missing. Please set STRAPI_URL and STRAPI_ACCESS_TOKEN environment variables.';
      console.error('❌', error);
      throw new Error(error);
    }

    try {
      console.log('📡 Making Strapi GraphQL request:', {
        endpoint: this.graphqlEndpoint,
        query: query.substring(0, 100) + '...',
        variables: variables ? JSON.stringify(variables) : 'none'
      });

      const response = await fetch(this.graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      console.log('📥 Strapi GraphQL response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Strapi API error response:', errorText);
        throw new Error(`Strapi API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result: GraphQLResponse<T> = await response.json();

      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map(e => e.message).join(', ');
        console.error('❌ GraphQL errors:', errorMessages);
        throw new Error(`GraphQL errors: ${errorMessages}`);
      }

      if (!result.data) {
        console.error('❌ No data returned from Strapi');
        throw new Error('No data returned from Strapi');
      }

      console.log('✅ Strapi GraphQL request successful');
      return result.data;
    } catch (error) {
      console.error('❌ Strapi GraphQL request failed:', error);
      throw error;
    }
  }

  /**
   * Find a song limit record by username
   */
  async findSongLimitByUsername(username: string): Promise<SongLimit | null> {
    const query = `
      query Query($filters: SongLimitFiltersInput) {
        songLimits(filters: $filters) {
          documentId
          username
          song_requests
          ai_guide_requests
          createdAt
          updatedAt
          publishedAt
        }
      }
    `;

    const variables = {
      filters: {
        username: {
          eq: username,
        },
      },
    };

    try {
      const data = await this.executeGraphQL<SongLimitsQueryResponse>(query, variables);

      if (data.songLimits && data.songLimits.length > 0) {
        return data.songLimits[0];
      }

      return null;
    } catch (error) {
      console.error(`Error finding song limit for username ${username}:`, error);
      throw error;
    }
  }

  /**
   * Create a new song limit record
   */
  async createSongLimit(username: string, songRequests: number = 1, aiGuideRequests: number = 0): Promise<SongLimit> {
    const mutation = `
      mutation Mutation($data: SongLimitInput!) {
        createSongLimit(data: $data) {
          documentId
          username
          song_requests
          ai_guide_requests
          createdAt
          updatedAt
          publishedAt
        }
      }
    `;

    const variables = {
      data: {
        username,
        song_requests: songRequests,
        ai_guide_requests: aiGuideRequests,
      },
    };

    try {
      const data = await this.executeGraphQL<CreateSongLimitResponse>(mutation, variables);
      return data.createSongLimit;
    } catch (error) {
      console.error(`Error creating song limit for username ${username}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing song limit record
   */
  async updateSongLimit(documentId: string, songRequests?: number, aiGuideRequests?: number): Promise<SongLimit> {
    const mutation = `
      mutation UpdateSongLimit($documentId: ID!, $data: SongLimitInput!) {
        updateSongLimit(documentId: $documentId, data: $data) {
          documentId
          username
          song_requests
          ai_guide_requests
          createdAt
          updatedAt
          publishedAt
        }
      }
    `;

    const variables = {
      documentId,
      data: {} as Record<string, number>,
    };

    // Only include fields that are provided
    if (songRequests !== undefined) {
      variables.data.song_requests = songRequests;
    }
    if (aiGuideRequests !== undefined) {
      variables.data.ai_guide_requests = aiGuideRequests;
    }

    try {
      const data = await this.executeGraphQL<UpdateSongLimitResponse>(mutation, variables);
      return data.updateSongLimit;
    } catch (error) {
      console.error(`Error updating song limit for documentId ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Increment song requests for a user
   * Creates a new record if it doesn't exist, or increments existing one
   */
  async incrementSongRequests(username: string): Promise<SongLimit> {
    console.log(`🔄 Starting incrementSongRequests for username: ${username}`);
    try {
      // First, try to find existing record
      console.log(`🔍 Searching for existing record for username: ${username}`);
      const existing = await this.findSongLimitByUsername(username);

      if (existing) {
        // Increment existing record
        const newCount = existing.song_requests + 1;
        console.log(`📈 Found existing record. Incrementing song requests for ${username}: ${existing.song_requests} -> ${newCount}`);
        const result = await this.updateSongLimit(existing.documentId, newCount);
        console.log(`✅ Successfully updated record for ${username}, new song_requests: ${result.song_requests}`);
        return result;
      } else {
        // Create new record with initial count of 1
        console.log(`🆕 No existing record found. Creating new song limit record for ${username} with song_requests: 1`);
        const result = await this.createSongLimit(username, 1);
        console.log(`✅ Successfully created new record for ${username}, song_requests: ${result.song_requests}`);
        return result;
      }
    } catch (error) {
      console.error(`❌ Error incrementing song requests for ${username}:`, error);
      throw error;
    }
  }

  /**
   * Increment AI guide requests for a user
   * Creates a new record if it doesn't exist, or increments existing one
   */
  async incrementAiGuideRequests(username: string): Promise<SongLimit> {
    console.log(`🔄 Starting incrementAiGuideRequests for username: ${username}`);
    try {
      // First, try to find existing record
      console.log(`🔍 Searching for existing record for username: ${username}`);
      const existing = await this.findSongLimitByUsername(username);

      if (existing) {
        // Increment existing record
        const currentCount = existing.ai_guide_requests || 0;
        const newCount = currentCount + 1;
        console.log(`📈 Found existing record. Incrementing ai_guide_requests for ${username}: ${currentCount} -> ${newCount}`);
        const result = await this.updateSongLimit(existing.documentId, undefined, newCount);
        console.log(`✅ Successfully updated record for ${username}, new ai_guide_requests: ${result.ai_guide_requests}`);
        return result;
      } else {
        // Create new record with initial ai_guide_requests of 1
        console.log(`🆕 No existing record found. Creating new song limit record for ${username} with ai_guide_requests: 1`);
        const result = await this.createSongLimit(username, 0, 1);
        console.log(`✅ Successfully created new record for ${username}, ai_guide_requests: ${result.ai_guide_requests}`);
        return result;
      }
    } catch (error) {
      console.error(`❌ Error incrementing ai guide requests for ${username}:`, error);
      throw error;
    }
  }

  /**
   * Reset song limits for a user (both song_requests and ai_guide_requests to 0)
   * Used when a user subscribes/renews their subscription plan
   * Creates a new record if it doesn't exist, or resets existing one to 0
   */
  async resetSongLimits(username: string): Promise<SongLimit> {
    console.log(`🔄 Starting resetSongLimits for username: ${username}`);
    try {
      // First, try to find existing record
      console.log(`🔍 Searching for existing record for username: ${username}`);
      const existing = await this.findSongLimitByUsername(username);

      if (existing) {
        // Reset existing record to 0
        console.log(`🔄 Found existing record. Resetting song_requests and ai_guide_requests to 0 for ${username}`);
        const result = await this.updateSongLimit(existing.documentId, 0, 0);
        console.log(`✅ Successfully reset limits for ${username}, song_requests: ${result.song_requests}, ai_guide_requests: ${result.ai_guide_requests}`);
        return result;
      } else {
        // Create new record with initial count of 0
        console.log(`🆕 No existing record found. Creating new song limit record for ${username} with song_requests: 0, ai_guide_requests: 0`);
        const result = await this.createSongLimit(username, 0, 0);
        console.log(`✅ Successfully created new record for ${username}, song_requests: ${result.song_requests}, ai_guide_requests: ${result.ai_guide_requests}`);
        return result;
      }
    } catch (error) {
      console.error(`❌ Error resetting song limits for ${username}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const strapiService = new StrapiService();

