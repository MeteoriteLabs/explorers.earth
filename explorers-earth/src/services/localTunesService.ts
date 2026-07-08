import axios, { AxiosResponse } from 'axios';
import localTunesClient from '../lib/apiClient';

// Local Tunes API configuration
const LOCAL_TUNES_CONFIG = {
  apiUrl: import.meta.env.VITE_LOCAL_TUNES_API_URL || 'https://localtunes.earth',
  enabled: import.meta.env.VITE_LOCAL_TUNES_ENABLED === 'true',
  timeout: parseInt(import.meta.env.VITE_LOCAL_TUNES_TIMEOUT || '10000'),
  retryAttempts: parseInt(import.meta.env.VITE_LOCAL_TUNES_RETRY_ATTEMPTS || '3'),
};

import useAuthStore from '../store/store';

// Types for Local Tunes API
export interface LocalTunesUserData {
  username: string;
  email: string;
  password: string;
  venueName: string;
}

export interface LocalTunesUserResponse {
  id: number;
  username: string;
  guestUrl: string;
  message?: string;
}

export interface LocalTunesError {
  message: string;
  status?: number;
}

export interface SyncUserData {
  id: string;
  username: string;
  email: string;
}

/**
 * Sync user with Local Tunes
 * This creates or updates the user in Local Tunes Neon DB based on Strapi user data
 * @param strapiUser - User data from Strapi
 * @returns Promise with sync result
 */
export async function syncLocalTunesUser(
  strapiUser: SyncUserData
): Promise<{ success: boolean; user?: any; message?: string }> {
  try {
    if (!LOCAL_TUNES_CONFIG.enabled) {
      console.log('Local Tunes integration disabled, skipping sync');
      return { success: true, message: 'Integration disabled' };
    }

    console.log('Syncing user with LocalTunes:', strapiUser.username);

    // We rely on the JWT token set in the interceptor for authentication
    // The sync endpoint typically requires the user to be authenticated via JWT

    // Note: For the initial sync after signup (where we might not rely on the interceptor 
    // because auth state might not be fully settled in storage yet), we can pass the user data
    // The backend sync endpoint likely expects { strapiUser: { ... } } body

    // Check if we have a token in storage first
    let tokenVerified = false;
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const authData = JSON.parse(authStorage);
      if (authData?.state?.jwt) {
        tokenVerified = true;
      }
    }

    if (!tokenVerified) {
      console.warn('⚠️ No JWT token found in storage before sync call. This might fail if the endpoint is protected.');
    }

    const response = await localTunesClient.post(
      '/api/auth/sync',
      { strapiUser },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: LOCAL_TUNES_CONFIG.timeout
      }
    );

    console.log('LocalTunes user synced successfully:', response.data);
    return {
      success: true,
      user: response.data.user,
      message: 'User synced with LocalTunes'
    };

  } catch (error: any) {
    console.error('Failed to sync LocalTunes user:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Sync failed'
    };
  }
}


/**
 * Create a user in Local Tunes application
 * @param userData - User data for Local Tunes registration
 * @returns Promise with Local Tunes user response or null if failed
 */
/**
 * @deprecated Use syncLocalTunesUser instead
 * Create a user in Local Tunes application
 * @param userData - User data for Local Tunes registration
 * @returns Promise with Local Tunes user response or null if failed
 */
export async function createLocalTunesUser(userData: LocalTunesUserData): Promise<LocalTunesUserResponse | null> {
  try {
    // Check if Local Tunes integration is enabled
    if (!LOCAL_TUNES_CONFIG.enabled) {
      console.log('Local Tunes integration disabled, skipping...');
      console.log('Config:', LOCAL_TUNES_CONFIG);
      return null;
    }

    console.log('Creating Local Tunes user:', {
      username: userData.username,
      email: userData.email,
      venueName: userData.venueName,
      apiUrl: LOCAL_TUNES_CONFIG.apiUrl
    });

    // Log the exact payload being sent
    console.log('📤 Local Tunes registration payload:', JSON.stringify(userData, null, 2));

    // Call Local Tunes registration endpoint
    const response: AxiosResponse<LocalTunesUserResponse> = await axios.post(
      `${LOCAL_TUNES_CONFIG.apiUrl}/api/register`,
      userData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: LOCAL_TUNES_CONFIG.timeout
      }
    );

    console.log('Local Tunes user created successfully:', {
      id: response.data.id,
      username: response.data.username,
      guestUrl: response.data.guestUrl
    });

    return response.data;

  } catch (error: any) {
    // Check for CORS errors
    if (error.code === 'ERR_NETWORK' || error.message?.includes('CORS') || error.message?.includes('Network Error')) {
      console.error('❌ CORS Error: Failed to create Local Tunes user due to CORS policy:', {
        message: error.message,
        code: error.code,
        apiUrl: LOCAL_TUNES_CONFIG.apiUrl,
        origin: window.location.origin,
        note: 'The server at localtunes.earth may not be configured to allow requests from localhost:5173'
      });
    } else {
      console.error('Failed to create Local Tunes user:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        username: userData.username,
        email: userData.email,
        apiUrl: LOCAL_TUNES_CONFIG.apiUrl,
        fullError: error
      });
    }

    // Handle specific error cases
    if (error.response?.status === 400) {
      // Try to extract error message from various possible response formats
      const responseData = error.response.data;
      let errorMessage = '';

      if (typeof responseData === 'string') {
        errorMessage = responseData;
      } else if (responseData?.message) {
        errorMessage = responseData.message;
      } else if (responseData?.error) {
        errorMessage = responseData.error;
      } else if (responseData?.errors && Array.isArray(responseData.errors)) {
        errorMessage = responseData.errors.map((e: any) => e.message || e).join(', ');
      } else {
        errorMessage = JSON.stringify(responseData);
      }

      console.error('❌ Local Tunes API returned 400 Bad Request:', {
        message: errorMessage,
        fullResponse: responseData,
        responseHeaders: error.response.headers,
        requestPayload: userData,
        requestUrl: `${LOCAL_TUNES_CONFIG.apiUrl}/api/register`
      });

      // Check if it's a "user already exists" error - this is not a failure
      const errorStr = typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage);
      if (errorStr.includes('Username already exists') ||
        errorStr.includes('Email address is already in use') ||
        errorStr.includes('already exists') ||
        errorStr.toLowerCase().includes('duplicate')) {
        console.log('User already exists in Local Tunes, continuing...');
        return null; // Don't fail the entire registration process
      }

      // For other 400 errors (validation, missing fields, etc.), create a detailed error
      const detailedError = new Error(`Local Tunes registration failed: ${errorStr}`);
      (detailedError as any).response = error.response;
      (detailedError as any).status = 400;
      throw detailedError;
    }

    // For other errors (network, 500, etc.), throw to surface the error
    throw error;
  }
}

/**
 * Create Local Tunes user with retry mechanism
 * @param userData - User data for Local Tunes registration
 * @param maxRetries - Maximum number of retry attempts
 * @returns Promise with Local Tunes user response or null if failed
 */
/**
 * @deprecated Use syncLocalTunesUser instead
 * Create Local Tunes user with retry mechanism
 * @param userData - User data for Local Tunes registration
 * @param maxRetries - Maximum number of retry attempts
 * @returns Promise with Local Tunes user response or null if failed
 */
export async function createLocalTunesUserWithRetry(
  userData: LocalTunesUserData,
  maxRetries: number = LOCAL_TUNES_CONFIG.retryAttempts
): Promise<LocalTunesUserResponse | null> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await createLocalTunesUser(userData);
      if (result) {
        return result;
      }

      // If result is null (user already exists or integration disabled), don't retry
      if (attempt === 1) {
        return null;
      }

    } catch (error: any) {
      lastError = error;
      console.error(`Local Tunes creation attempt ${attempt} failed:`, error.message);

      // Don't retry on 400 errors (validation errors, user already exists, etc.)
      if (error.response?.status === 400) {
        console.error('400 error detected, not retrying');
        throw error; // Re-throw to surface the error
      }

      if (attempt === maxRetries) {
        console.error('All Local Tunes creation attempts failed');
        throw lastError; // Throw the last error instead of returning null
      }

      // Wait before retry (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retrying Local Tunes user creation in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but just in case
  throw lastError || new Error('Local Tunes user creation failed after all retries');
}

/**
 * Prepare user data for Local Tunes registration
 * @param strapiUserData - User data from explorers/Strapi registration
 * @returns Formatted data for Local Tunes API
 */
export function prepareLocalTunesUserData(strapiUserData: {
  username: string;
  email: string;
  password: string;
  accountName?: string;
  businessName?: string;
}): LocalTunesUserData {
  // Ensure all required fields are present and not empty
  if (!strapiUserData.username || !strapiUserData.email || !strapiUserData.password) {
    throw new Error('Missing required fields: username, email, and password are required');
  }

  const venueName = strapiUserData.accountName ||
    strapiUserData.businessName ||
    strapiUserData.username ||
    strapiUserData.email;

  if (!venueName || venueName.trim() === '') {
    throw new Error('venueName cannot be empty');
  }

  return {
    username: strapiUserData.username.trim(),
    email: strapiUserData.email.trim(),
    password: strapiUserData.password,
    venueName: venueName.trim()
  };
}

/**
 * Log user creation completion
 * @param strapiUserId - explorers/Strapi user ID
 * @param localTunesResult - Result from Local Tunes creation
 */
export function logUserCreation(strapiUserId: string, localTunesResult: LocalTunesUserResponse | null): void {
  console.log('Dual user creation completed:', {
    strapiUserId,
    localTunesUserId: localTunesResult?.id,
    localTunesGuestUrl: localTunesResult?.guestUrl,
    localTunesUsername: localTunesResult?.username,
    success: !!localTunesResult,
    timestamp: new Date().toISOString()
  });
}

/**
 * Check if Local Tunes integration is enabled
 * @returns boolean indicating if integration is enabled
 */
export function isLocalTunesEnabled(): boolean {
  return LOCAL_TUNES_CONFIG.enabled;
}

/**
 * Check if a Local Tunes account exists for the given username
 * @param username - Username to check
 * @returns Promise with boolean indicating if account exists
 */
export async function checkLocalTunesAccountExists(username: string): Promise<boolean> {
  try {
    if (!LOCAL_TUNES_CONFIG.enabled) {
      console.log('Local Tunes integration disabled, cannot check account status');
      return false;
    }

    console.log('Checking Local Tunes account existence for:', username);

    // Try to get user info from Local Tunes API
    const response = await axios.get(
      `${LOCAL_TUNES_CONFIG.apiUrl}/api/users/${username}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: LOCAL_TUNES_CONFIG.timeout
      }
    );

    console.log('Local Tunes account exists:', response.status === 200);
    return response.status === 200;

  } catch (error: any) {
    console.log('Local Tunes account check result:', {
      username,
      exists: false,
      reason: error.response?.status === 404 ? 'Account not found' : 'API error',
      status: error.response?.status
    });

    // If 404, account doesn't exist
    if (error.response?.status === 404) {
      return false;
    }

    // For other errors, assume account doesn't exist
    return false;
  }
}

/**
 * Get Local Tunes configuration
 * @returns Local Tunes configuration object
 */
export function getLocalTunesConfig() {
  return {
    ...LOCAL_TUNES_CONFIG,
    // Don't expose sensitive data
    apiUrl: LOCAL_TUNES_CONFIG.apiUrl,
    enabled: LOCAL_TUNES_CONFIG.enabled,
    timeout: LOCAL_TUNES_CONFIG.timeout,
    retryAttempts: LOCAL_TUNES_CONFIG.retryAttempts
  };
}





/**
 * Change password in LocalTunes
 * @param currentPassword - Current password
 * @param newPassword - New password
 * @param username - Username for authentication (optional)
 * @returns Promise with success status
 */
/**
 * Change password in LocalTunes
 * @deprecated Password sync is no longer required as per new auth flow
 */
export async function changeLocalTunesPassword(): Promise<{ success: boolean; message?: string }> {
  console.log('Local Tunes password sync disabled by configuration');
  return { success: true, message: 'Sync disabled' };
}


/**
 * Update username in LocalTunes
 * @param newUsername - New username
 * @param currentUsername - Current username (required for verification)
 * @returns Promise with success status
 */
export async function updateLocalTunesUsername(
  newUsername: string,
  currentUsername: string
): Promise<{ success: boolean; message?: string }> {
  console.log('🔄 updateLocalTunesUsername called with:', { currentUsername, newUsername });
  try {
    // Check if Local Tunes integration is enabled
    if (!LOCAL_TUNES_CONFIG.enabled) {
      console.log('Local Tunes integration disabled, skipping username sync');
      return { success: true, message: 'Integration disabled' };
    }

    console.log('Syncing username change with LocalTunes via /api/user endpoint...');

    // Get the JWT token from the store
    const token = useAuthStore.getState().token;

    if (!token) {
      console.error('❌ No auth token found for LocalTunes sync');
      return { success: false, message: 'Authentication required' };
    }

    // Use localTunesClient which automatically adds the Strapi JWT to the Authorization header
    const response = await localTunesClient.patch('/api/user', {
      currentUsername: currentUsername,
      username: newUsername,
      _csrf: null
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('LocalTunes username updated successfully:', response.status, response.data);
    return { success: true, message: 'Username synced with LocalTunes' };

  } catch (error: any) {
    console.error('❌ Error in updateLocalTunesUsername:', error);

    // Detailed error logging
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }

    // Handle specific errors
    if (error.response?.status === 409) {
      return { success: false, message: 'Username already taken in LocalTunes' };
    }

    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to sync with LocalTunes'
    };
  }
}
