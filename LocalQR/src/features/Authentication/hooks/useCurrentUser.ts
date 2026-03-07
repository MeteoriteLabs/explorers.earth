import { useQuery } from "@apollo/client";
import useAuthStore from "../../../store/store";
import { GET_CURRENT_USER_QUERY, GET_USER_FOR_ONBOARDING } from "../api/userQueries";

/**
 * Custom hook to fetch current user data from Strapi
 * 
 * This hook provides centralized user data fetching with:
 * - Automatic token-based authentication
 * - Error handling for invalid/expired tokens
 * - Loading states
 * - Cached data with refetch capability
 * 
 * @param options Configuration options
 * @param options.skipQuery - Skip the GraphQL query (useful for conditional fetching)
 * @param options.onboardingOnly - Fetch minimal data for onboarding forms only
 * @returns User data, loading state, error state, and refetch function
 */
export const useCurrentUser = (options: {
  skipQuery?: boolean;
  onboardingOnly?: boolean;
} = {}) => {
  const { user, isAuthenticated, token } = useAuthStore();
  const { skipQuery = false, onboardingOnly = false } = options;

  // Choose query based on use case
  const query = onboardingOnly ? GET_USER_FOR_ONBOARDING : GET_CURRENT_USER_QUERY;
  
  const { data, loading, error, refetch } = useQuery(query, {
    variables: { 
      documentId: user?.documentId 
    },
    skip: skipQuery || !isAuthenticated || !user?.documentId || !token,
    fetchPolicy: "cache-first", // Use cached data when available
    notifyOnNetworkStatusChange: true,
    errorPolicy: "ignore", // Ignore errors to prevent UI disruption
  });

  /**
   * Fetched user data from Strapi
   * Contains the most up-to-date user information including username
   */
  const fetchedUser = data?.usersPermissionsUser;

  /**
   * Centralized username value - uses fetched data as source of truth
   * Falls back to stored auth data if fetch is pending/failed
   */
  const username = fetchedUser?.username || user?.username;

  /**
   * Check if the fetched username differs from stored username
   * This can happen if username was updated in another session
   */
  const isUsernameSynced = !fetchedUser || fetchedUser.username === user?.username;

  return {
    // User data
    user: fetchedUser,
    username,
    
    // Sync status
    isUsernameSynced,
    
    // Query state
    loading,
    error,
    refetch,
    
    // Convenience flags
    isReady: !loading && !error && fetchedUser,
    isEmpty: !loading && !fetchedUser,
  };
};

/**
 * Hook specifically for onboarding forms
 * Fetches minimal user data needed for form pre-population
 * 
 * @returns Username and email for form initialization
 */
export const useUserForOnboarding = (skipQuery: boolean = false) => {
  return useCurrentUser({ onboardingOnly: true, skipQuery });
};
