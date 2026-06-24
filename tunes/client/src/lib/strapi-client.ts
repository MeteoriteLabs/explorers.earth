/**
 * Strapi GraphQL Client
 * Handles client-side interactions with Strapi CMS directly
 */

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: any }>;
}

interface StrapiConfig {
  strapiUrl: string;
  accessToken: string;
  graphqlEndpoint: string;
}

// Cache the Strapi config to avoid fetching it on every request
let strapiConfigCache: StrapiConfig | null = null;
let configFetchPromise: Promise<StrapiConfig> | null = null;

/**
 * Get Strapi configuration
 * First tries environment variables, then fetches from server
 */
async function getStrapiConfig(): Promise<StrapiConfig> {
  // Return cached config if available
  if (strapiConfigCache) {
    return strapiConfigCache;
  }

  // If a fetch is already in progress, wait for it
  if (configFetchPromise) {
    return configFetchPromise;
  }

  // Use environment variables directly
  const envUrl = import.meta.env.VITE_REST_API_URL;
  const envToken = import.meta.env.VITE_PUBLIC_ACCESS_TOKEN;

  if (envUrl && envToken) {
    const cleanUrl = envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
    strapiConfigCache = {
      strapiUrl: cleanUrl,
      accessToken: envToken,
      graphqlEndpoint: `${cleanUrl}/graphql`,
    };
    return strapiConfigCache;
  }

  // Fetch from server if env vars not available
  configFetchPromise = fetch('/api/strapi/config', {
    credentials: 'include',
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error('Failed to fetch Strapi configuration from server');
      }
      const data = await res.json();
      const cleanUrl = data.strapiUrl.endsWith('/') ? data.strapiUrl.slice(0, -1) : data.strapiUrl;
      const config: StrapiConfig = {
        strapiUrl: cleanUrl,
        accessToken: data.accessToken,
        graphqlEndpoint: `${cleanUrl}/graphql`,
      };
      strapiConfigCache = config;
      return config;
    })
    .finally(() => {
      configFetchPromise = null;
    });

  return configFetchPromise;
}

/**
 * Execute a GraphQL query or mutation directly to Strapi
 */
export async function strapiRequest<T>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  try {
    const config = await getStrapiConfig();

    const response = await fetch(config.graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Strapi API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result: GraphQLResponse<T> = await response.json();

    if (result.errors && result.errors.length > 0) {
      const errorMessages = result.errors.map(e => e.message).join(', ');
      throw new Error(`GraphQL errors: ${errorMessages}`);
    }

    if (!result.data) {
      throw new Error('No data returned from Strapi');
    }

    return result.data;
  } catch (error) {
    console.error('Strapi GraphQL request failed:', error);
    throw error;
  }
}

