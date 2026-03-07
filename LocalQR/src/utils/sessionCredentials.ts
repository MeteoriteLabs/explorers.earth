/**
 * Session Storage Utility for User Credentials
 * 
 * This utility manages storing and retrieving user credentials in session storage
 * for Local Tunes account creation during onboarding.
 */

export interface UserCredentials {
  username: string;
  email: string;
  password: string;
  timestamp: number;
}

const CREDENTIALS_KEY = 'explorers_user_credentials';
const CREDENTIALS_EXPIRY = 30 * 60 * 1000; // 30 minutes

/**
 * Store user credentials in session storage
 * @param credentials - User credentials to store
 */
export function storeUserCredentials(credentials: Omit<UserCredentials, 'timestamp'>): void {
  try {
    const credentialsWithTimestamp: UserCredentials = {
      ...credentials,
      timestamp: Date.now()
    };

    sessionStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentialsWithTimestamp));
    console.log('User credentials stored in session storage');
  } catch (error) {
    console.error('Failed to store user credentials:', error);
  }
}

/**
 * Retrieve user credentials from session storage
 * @returns User credentials or null if not found/expired
 */
export function getUserCredentials(): UserCredentials | null {
  try {
    const stored = sessionStorage.getItem(CREDENTIALS_KEY);
    if (!stored) {
      console.log('No user credentials found in session storage');
      return null;
    }

    const credentials: UserCredentials = JSON.parse(stored);

    // Check if credentials have expired
    const now = Date.now();
    if (now - credentials.timestamp > CREDENTIALS_EXPIRY) {
      console.log('User credentials have expired, removing from session storage');
      removeUserCredentials();
      return null;
    }

    console.log('User credentials retrieved from session storage');
    return credentials;
  } catch (error) {
    console.error('Failed to retrieve user credentials:', error);
    return null;
  }
}

/**
 * Remove user credentials from session storage
 */
export function removeUserCredentials(): void {
  try {
    sessionStorage.removeItem(CREDENTIALS_KEY);
    console.log('User credentials removed from session storage');
  } catch (error) {
    console.error('Failed to remove user credentials:', error);
  }
}

/**
 * Check if user credentials exist and are valid
 * @returns boolean indicating if credentials are available
 */
export function hasValidCredentials(): boolean {
  const credentials = getUserCredentials();
  return credentials !== null;
}

/**
 * Get credentials for Local Tunes registration
 * @returns Formatted credentials for Local Tunes API or null
 */
export function getCredentialsForLocalTunes(): Omit<UserCredentials, 'timestamp'> | null {
  const credentials = getUserCredentials();
  if (!credentials) {
    return null;
  }

  return {
    username: credentials.username,
    email: credentials.email,
    password: credentials.password
  };
}

/**
 * Debug function to check session storage status
 */
export function debugSessionStorage(): void {
  console.log('=== Session Storage Debug ===');
  console.log('Has valid credentials:', hasValidCredentials());

  const credentials = getUserCredentials();
  if (credentials) {
    console.log('Stored credentials:', {
      username: credentials.username,
      email: credentials.email,
      password: '[HIDDEN]',
      timestamp: new Date(credentials.timestamp).toISOString(),
      age: Math.round((Date.now() - credentials.timestamp) / 1000) + ' seconds'
    });
  } else {
    console.log('No credentials found');
  }
  console.log('============================');
}
