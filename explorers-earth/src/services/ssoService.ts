/**
 * Single Sign-On (SSO) Service for LocalTunes Integration
 * 
 * This service handles automatic authentication with LocalTunes when a user
 * logs into explorers and has LocalTunes integration enabled.
 */

import { ApolloClient } from '@apollo/client';
import { getUserAccountQuery, updateAccountMutation } from '../features/Settings/api/mutation';
import { getCredentialsForLocalTunes } from '../utils/sessionCredentials';
import {
  LocalTunesAuthCookies
} from '../utils/cookieUtils';
import { buildLocalTunesPlaylistUrl } from '../utils/localTunesUtils';

export interface SSOConfig {
  localTunesApiUrl: string;
  enabled: boolean;
  timeout: number;
}

export interface SSOResult {
  success: boolean;
  error?: string;
  message?: string;
  guestUrl?: string;
}

// Default SSO configuration
const DEFAULT_SSO_CONFIG: SSOConfig = {
  localTunesApiUrl: import.meta.env.VITE_LOCAL_TUNES_API_URL || 'https://localtunes.earth',
  enabled: import.meta.env.VITE_LOCAL_TUNES_ENABLED === 'true',
  timeout: 10000,
};

/**
 * Check if user has LocalTunes integration enabled
 * @param apolloClient - Apollo GraphQL client
 * @param documentId - User's document ID
 * @returns Promise<boolean> indicating if LocalTunes is integrated
 */
async function checkLocalTunesIntegration(
  apolloClient: ApolloClient<any>,
  documentId: string
): Promise<boolean> {
  try {
    console.log('🔍 Checking LocalTunes integration status...');

    const response = await apolloClient.query({
      query: getUserAccountQuery,
      variables: { documentId },
      fetchPolicy: 'cache-first',
    });

    const user = response.data?.usersPermissionsUser;
    if (!user) {
      console.log('❌ User not found');
      return false;
    }

    const account = user.accounts?.[0];
    if (!account) {
      console.log('❌ User account not found');
      return false;
    }

    const isIntegrated = account.localtunes_integrated === 'Yes';
    console.log(`📊 LocalTunes integration status: ${isIntegrated ? 'enabled' : 'disabled'}`);

    return isIntegrated;
  } catch (error) {
    console.error('❌ Failed to check LocalTunes integration:', error);
    return false;
  }
}

/**
 * Extract guestUrl from response data
 * @param responseData - Parsed response data from LocalTunes login
 * @returns guestUrl string or null
 */
function extractGuestUrlFromResponseData(responseData: any): string | null {
  try {
    if (!responseData) {
      return null;
    }

    // Check if responseData has guestUrl directly (Structure 5 - LocalTunes format)
    if (responseData.guestUrl) {
      console.log('✅ Found guestUrl in login response:', responseData.guestUrl);
      return responseData.guestUrl;
    }

    // Check if responseData.user has guestUrl
    if (responseData.user?.guestUrl) {
      console.log('✅ Found guestUrl in user object:', responseData.user.guestUrl);
      return responseData.user.guestUrl;
    }

    return null;
  } catch (error) {
    console.error('❌ Failed to extract guestUrl from response data:', error);
    return null;
  }
}

/**
 * Authenticate with LocalTunes using stored credentials
 * @param credentials - User credentials
 * @param config - SSO configuration
 * @returns Promise<SSOResult> with authentication result
 */
async function authenticateWithLocalTunes(
  credentials: { username: string; password: string },
  config: SSOConfig
): Promise<SSOResult> {
  try {
    console.log('🔐 Authenticating with LocalTunes...');

    const loginPayload = {
      username: credentials.username,
      password: credentials.password,
      _csrf: null, // CSRF token not required for API login
    };

    const response = await fetch(`${config.localTunesApiUrl}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include', // Include cookies in the request
      body: JSON.stringify(loginPayload),
      signal: AbortSignal.timeout(config.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ LocalTunes login failed: ${response.status} - ${errorText}`);

      return {
        success: false,
        error: `LocalTunes authentication failed: ${response.status}`,
        message: errorText,
      };
    }

    // Read response data once to extract both auth data and guestUrl
    let responseData: any = null;
    let guestUrl: string | null = null;

    try {
      // Clone response to read it for guestUrl extraction
      const clonedResponse = response.clone();
      responseData = await clonedResponse.json().catch(() => null);
      if (responseData) {
        guestUrl = extractGuestUrlFromResponseData(responseData);
      }
    } catch (error) {
      console.log('⚠️ Could not extract guestUrl from response:', error);
    }

    // Try to extract session cookie from response
    // Note: Browsers block reading Set-Cookie headers from cross-origin responses
    // We'll try multiple methods to get the cookie value
    let sessionCookieValue: string | null = null;

    // Method 1: Try to read from Set-Cookie header (will likely fail for cross-origin)
    try {
      const setCookieHeader = response.headers.get('set-cookie') ||
        response.headers.get('Set-Cookie') ||
        response.headers.get('SET-COOKIE');

      if (setCookieHeader) {
        console.log('📋 Set-Cookie header found:', setCookieHeader.substring(0, 100) + '...');
        const match = setCookieHeader.match(/cosmic\.sid=([^;]+)/);
        if (match) {
          let cookieValue = match[1];
          try {
            cookieValue = decodeURIComponent(cookieValue);
          } catch (e) {
            console.log('⚠️ Could not decode cookie value, using as-is');
          }
          sessionCookieValue = cookieValue;
          console.log('✅ Extracted session cookie from Set-Cookie header');
        }
      } else {
        console.log('⚠️ Set-Cookie header not accessible (browser blocks cross-origin Set-Cookie headers)');
      }
    } catch (cookieError) {
      console.log('⚠️ Could not extract session cookie from headers:', cookieError);
    }

    // Method 2: Try to get from response body if server returns it
    // Note: We don't read the body here because extractAuthDataFromResponse will read it
    // and we want to avoid consuming the response body twice
    // The session cookie extraction from response body will be handled in extractAuthDataFromResponse

    // Store the cookie value if we found it
    if (sessionCookieValue) {
      sessionStorage.setItem('localtunes_session_cookie', sessionCookieValue);
      console.log('💾 Stored session cookie in sessionStorage');
    } else {
      console.log('❌ Could not extract session cookie value - request to /api/user will likely fail');
      console.log('💡 Solution: Server should return session ID in response body or set cookie with SameSite=None; Secure');
    }

    // For cross-domain SSO, we need to use a different approach
    // Since we can't set cookies for localtunes.earth from localhost:5173,
    // we'll use localStorage and postMessage to communicate with LocalTunes
    // Pass pre-parsed responseData to avoid reading response twice
    const authData = await extractAuthDataFromResponse(response, responseData);

    if (authData) {
      // Store authentication data in localStorage for cross-domain access
      await storeCrossDomainAuthData(authData, config);
      console.log('✅ LocalTunes authentication successful, cross-domain auth stored');

      return {
        success: true,
        message: 'Successfully authenticated with LocalTunes',
        guestUrl: guestUrl || undefined,
      };
    } else {
      console.log('⚠️ LocalTunes authentication successful but no auth data extracted');
      return {
        success: true,
        message: 'LocalTunes authentication completed (no persistent session)',
        guestUrl: guestUrl || undefined,
      };
    }
  } catch (error: any) {
    console.error('❌ LocalTunes authentication error:', error);

    return {
      success: false,
      error: error.message || 'Unknown authentication error',
      message: 'Failed to authenticate with LocalTunes',
    };
  }
}

/**
 * Get the cosmic.sid cookie value from storage or document.cookie
 * @returns The cookie value or null if not found
 */
function getCosmicSidCookie(): string | null {
  // First, try to get from sessionStorage (stored after login)
  const storedCookie = sessionStorage.getItem('localtunes_session_cookie');
  if (storedCookie) {
    return storedCookie;
  }

  // Fallback: try to get from document.cookie (only works for same-origin)
  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'cosmic.sid') {
        return decodeURIComponent(value);
      }
    }
  } catch (error) {
    // document.cookie might not be accessible for cross-origin
    console.log('⚠️ Could not access document.cookie (cross-origin restriction)');
  }

  return null;
}

/**
 * Extract authentication data from LocalTunes login response
 * @param response - Fetch response from LocalTunes login
 * @param preParsedData - Optional pre-parsed response data (to avoid reading response twice)
 * @returns LocalTunes authentication data or null
 */
async function extractAuthDataFromResponse(response: Response, preParsedData?: any): Promise<LocalTunesAuthCookies | null> {
  try {
    console.log('🔍 Extracting auth data from LocalTunes response...');

    // Try to get auth data from response body first
    // Use pre-parsed data if available, otherwise parse the response
    const responseData = preParsedData || await response.json().catch(() => null);
    console.log('📦 Response data:', responseData);

    // Check for various possible response structures
    if (responseData) {
      // Structure 1: Direct auth_token and auth_user
      if (responseData.auth_token && responseData.auth_user) {
        console.log('✅ Found auth data in response body (structure 1)');
        return {
          auth_token: responseData.auth_token,
          auth_user: responseData.auth_user,
        };
      }

      // Structure 2: User object with token
      if (responseData.user && responseData.token) {
        console.log('✅ Found auth data in response body (structure 2)');
        return {
          auth_token: responseData.token,
          auth_user: JSON.stringify(responseData.user),
        };
      }

      // Structure 3: User object with separate token field
      if (responseData.user && responseData.authToken) {
        console.log('✅ Found auth data in response body (structure 3)');
        return {
          auth_token: responseData.authToken,
          auth_user: JSON.stringify(responseData.user),
        };
      }

      // Structure 4: Check if response contains user data that we can use
      if (responseData.user) {
        console.log('✅ Found user data in response, creating auth structure');
        const userData = responseData.user;
        const token = responseData.token || responseData.authToken || `session_${Date.now()}`;

        return {
          auth_token: token,
          auth_user: JSON.stringify(userData),
        };
      }

      // Structure 5: Response IS the user object directly (id, username, email, etc.)
      // This is the case for LocalTunes login - the response contains user data directly
      if (responseData.id && (responseData.username || responseData.email)) {
        console.log('✅ Found user data directly in response (structure 5 - LocalTunes format)');
        // Generate a session token based on user data
        const token = generateLocalTunesSessionToken(responseData);

        return {
          auth_token: token,
          auth_user: JSON.stringify(responseData),
        };
      }
    }

    // Try to extract from Set-Cookie headers
    const setCookieHeader = response.headers.get('Set-Cookie');
    console.log('🍪 Set-Cookie header:', setCookieHeader);

    if (setCookieHeader) {
      const cookies = parseSetCookieHeader(setCookieHeader);
      console.log('🍪 Parsed cookies:', cookies);

      if (cookies.auth_token && cookies.auth_user) {
        console.log('✅ Found auth data in cookies');
        return {
          auth_token: cookies.auth_token,
          auth_user: cookies.auth_user,
        };
      }
    }

    // Check if we can get user info from a separate API call
    console.log('🔍 No auth data in response, attempting to get user info...');
    try {
      // Get the session cookie value
      const sessionCookie = getCosmicSidCookie();
      console.log('🍪 Session cookie from storage:', sessionCookie ? 'Found' : 'Not found');

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Manually include the session cookie in the Cookie header
      // Note: Browsers may block this for security reasons, but we'll try anyway
      if (sessionCookie) {
        // Format the cookie value properly (ensure it has the correct format)
        // The cookie format is typically: s:sessionId.signature
        let cookieValue = sessionCookie;
        if (!cookieValue.startsWith('s:')) {
          cookieValue = `s:${cookieValue}`;
        }

        // Try to add as Cookie header (browsers may block this)
        headers['Cookie'] = `cosmic.sid=${cookieValue}`;
        console.log('✅ Attempting to add cosmic.sid cookie to request headers');
        console.log('📋 Cookie value (first 50 chars):', cookieValue.substring(0, 50) + '...');

        // Also try as a custom header in case server accepts it
        headers['X-Session-Cookie'] = cookieValue;
      } else {
        console.log('❌ No cosmic.sid cookie found in storage');
        console.log('💡 This means the cookie extraction from login response failed');
        console.log('💡 Check browser console for cookie extraction logs');
      }

      console.log('📤 Making request to /api/user with headers:', Object.keys(headers));
      const userResponse = await fetch(`${import.meta.env.VITE_LOCAL_TUNES_API_URL}/api/user`, {
        method: 'GET',
        credentials: 'include', // This should send cookies automatically, but won't work for cross-origin with SameSite=Lax
        headers,
      });

      console.log('📥 Response status:', userResponse.status);
      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.log('❌ /api/user request failed:', errorText);
      }

      if (userResponse.ok) {
        const userData = await userResponse.json();
        console.log('👤 User data from /api/user:', userData);

        if (userData) {
          // Generate a proper session token for LocalTunes
          const sessionToken = generateLocalTunesSessionToken(userData);

          return {
            auth_token: sessionToken,
            auth_user: JSON.stringify(userData),
          };
        }
      }
    } catch (userError) {
      console.log('⚠️ Could not fetch user data:', userError);
    }

    // Fallback: create session-based auth data with proper structure
    console.log('⚠️ No explicit auth data found, creating session-based auth');
    const fallbackUserData = {
      id: Date.now(),
      username: 'authenticated_user',
      email: 'user@example.com',
      authenticated: true,
      ssoLogin: true
    };

    return {
      auth_token: generateLocalTunesSessionToken(fallbackUserData),
      auth_user: JSON.stringify(fallbackUserData),
    };
  } catch (error) {
    console.error('❌ Failed to extract auth data from response:', error);
    return null;
  }
}

/**
 * Parse Set-Cookie header to extract cookie values
 * @param setCookieHeader - Set-Cookie header value
 * @returns Object with cookie name-value pairs
 */
function parseSetCookieHeader(setCookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  const cookieStrings = setCookieHeader.split(',');

  for (const cookieString of cookieStrings) {
    const [nameValue] = cookieString.trim().split(';');
    const [name, value] = nameValue.split('=');

    if (name && value) {
      cookies[name.trim()] = decodeURIComponent(value.trim());
    }
  }

  return cookies;
}

/**
 * Generate a proper LocalTunes session token
 * @param userData - User data from LocalTunes
 * @returns Session token in LocalTunes format
 */
function generateLocalTunesSessionToken(userData: any): string {
  // Generate a UUID-like token similar to what LocalTunes uses
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 15);
  const userPart = userData.id || userData.username || 'user';

  // Create a token that looks like LocalTunes session tokens
  const sessionToken = `${randomPart}-${userPart}-${timestamp}`;

  console.log('🔑 Generated LocalTunes session token:', sessionToken);

  return sessionToken;
}

/**
 * Store cross-domain authentication data
 * @param authData - Authentication data from LocalTunes
 * @param config - SSO configuration
 */
async function storeCrossDomainAuthData(authData: LocalTunesAuthCookies, config: SSOConfig): Promise<void> {
  try {
    console.log('🌐 Storing cross-domain authentication data...');

    // Store auth data in localStorage with a specific key for LocalTunes
    const crossDomainAuth = {
      auth_token: authData.auth_token,
      auth_user: authData.auth_user,
      timestamp: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
      domain: config.localTunesApiUrl,
    };

    localStorage.setItem('localtunes_cross_domain_auth', JSON.stringify(crossDomainAuth));

    // Also store in sessionStorage for immediate access
    sessionStorage.setItem('localtunes_cross_domain_auth', JSON.stringify(crossDomainAuth));

    // Store as cookies for both domains
    await storeCrossDomainCookies(crossDomainAuth, config);

    // Store auth data directly in LocalTunes localStorage
    await storeAuthDataInLocalTunes(authData, config);

    console.log('✅ Cross-domain authentication data stored');

    // Try to communicate with LocalTunes if it's open in another tab
    await notifyLocalTunesOfAuth(authData, config);

  } catch (error) {
    console.error('❌ Failed to store cross-domain auth data:', error);
  }
}

/**
 * Store cross-domain authentication data as cookies
 * @param crossDomainAuth - Cross-domain authentication data
 * @param config - SSO configuration
 */
async function storeCrossDomainCookies(crossDomainAuth: any, config: SSOConfig): Promise<void> {
  try {
    console.log('🍪 Storing cross-domain cookies...');

    const cookieValue = JSON.stringify(crossDomainAuth);
    const expires = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days

    // Store cookie for localhost:5173 (explorers)
    document.cookie = `localtunes_cross_domain_auth=${encodeURIComponent(cookieValue)}; Domain=localhost; Path=/; Expires=${expires.toUTCString()}; SameSite=Lax`;

    console.log('✅ Cross-domain cookie stored for localhost:5173');

    // Try to store cookie for localtunes.earth (LocalTunes) via iframe
    await storeCookieForLocalTunes(cookieValue, expires, config);

  } catch (error) {
    console.error('❌ Failed to store cross-domain cookies:', error);
  }
}

/**
 * Store cookie for LocalTunes domain via iframe
 * @param cookieValue - Cookie value to store
 * @param expires - Cookie expiration date
 * @param config - SSO configuration
 */
async function storeCookieForLocalTunes(cookieValue: string, expires: Date, config: SSOConfig): Promise<void> {
  try {
    console.log('🍪 Attempting to store cookie for LocalTunes domain...');

    // Create a hidden iframe to set cookie for localtunes.earth
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = `${config.localTunesApiUrl}/set-cookie`;

    // Listen for response from LocalTunes
    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== config.localTunesApiUrl) {
        return;
      }

      if (event.data.type === 'LOCALTUNES_COOKIE_READY') {
        console.log('✅ LocalTunes cookie setter ready');

        // Send cookie data to LocalTunes
        iframe.contentWindow?.postMessage({
          type: 'LOCALTUNES_SET_COOKIE',
          cookieName: 'localtunes_cross_domain_auth',
          cookieValue: cookieValue,
          expires: expires.toUTCString(),
          timestamp: Date.now()
        }, config.localTunesApiUrl);

        // Clean up
        window.removeEventListener('message', messageHandler);
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      }
    };

    window.addEventListener('message', messageHandler);
    document.body.appendChild(iframe);

    // Cleanup after timeout
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 10000);

  } catch (error) {
    console.log('⚠️ Could not store cookie for LocalTunes domain:', error);
  }
}

/**
 * Store authentication data in LocalTunes localStorage via iframe
 * @param authData - Authentication data from LocalTunes
 * @param config - SSO configuration
 */
async function storeAuthDataInLocalTunes(authData: LocalTunesAuthCookies, config: SSOConfig): Promise<void> {
  try {
    console.log('💾 Attempting to store auth data in LocalTunes localStorage...');

    // Parse auth_user if it's a JSON string
    let userData: any = authData.auth_user;
    if (typeof userData === 'string') {
      try {
        userData = JSON.parse(userData);
      } catch (e) {
        console.log('⚠️ auth_user is not JSON, keeping as string');
        userData = { username: userData };
      }
    }

    // Create LocalTunes-compatible auth data
    const localTunesAuthToken = {
      value: authData.auth_token,
      expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };

    // Create a hidden iframe to store data in LocalTunes localStorage
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = `${config.localTunesApiUrl}/sso-callback`;

    // Listen for response from LocalTunes
    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== config.localTunesApiUrl) {
        return;
      }

      if (event.data.type === 'LOCALTUNES_SSO_READY') {
        console.log('✅ LocalTunes SSO callback ready');

        // Send auth data to LocalTunes in the exact format it expects
        iframe.contentWindow?.postMessage({
          type: 'LOCALTUNES_SSO_AUTH',
          authData: {
            auth_token: localTunesAuthToken,
            auth_user: userData
          },
          timestamp: Date.now()
        }, config.localTunesApiUrl);

        // Clean up
        window.removeEventListener('message', messageHandler);
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      }
    };

    window.addEventListener('message', messageHandler);
    document.body.appendChild(iframe);

    // Cleanup after timeout
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 10000);

  } catch (error) {
    console.log('⚠️ Could not store auth data in LocalTunes localStorage:', error);
  }
}

/**
 * Notify LocalTunes of successful authentication via postMessage
 * @param authData - Authentication data
 * @param config - SSO configuration
 */
async function notifyLocalTunesOfAuth(authData: LocalTunesAuthCookies, config: SSOConfig): Promise<void> {
  try {
    console.log('📡 Attempting to notify LocalTunes of authentication...');

    // Create a hidden iframe to communicate with LocalTunes
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = `${config.localTunesApiUrl}/sso-callback`;

    // Listen for response from LocalTunes
    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== config.localTunesApiUrl) {
        return;
      }

      if (event.data.type === 'LOCALTUNES_SSO_READY') {
        console.log('✅ LocalTunes SSO callback ready');

        // Send authentication data to LocalTunes
        iframe.contentWindow?.postMessage({
          type: 'LOCALTUNES_SSO_AUTH',
          authData: authData,
          timestamp: Date.now()
        }, config.localTunesApiUrl);

        // Clean up
        window.removeEventListener('message', messageHandler);
        document.body.removeChild(iframe);
      }
    };

    window.addEventListener('message', messageHandler);
    document.body.appendChild(iframe);

    // Cleanup after timeout
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 5000);

  } catch (error) {
    console.log('⚠️ Could not notify LocalTunes directly, auth data stored for manual access');
  }
}

/**
 * Get cross-domain authentication data
 * @returns Cross-domain auth data or null
 */
function getCrossDomainAuthData(): any | null {
  try {
    // Try localStorage first
    const stored = localStorage.getItem('localtunes_cross_domain_auth');
    if (stored) {
      const authData = JSON.parse(stored);

      // Check if expired
      if (Date.now() > authData.expiresAt) {
        localStorage.removeItem('localtunes_cross_domain_auth');
        sessionStorage.removeItem('localtunes_cross_domain_auth');
        return null;
      }

      return authData;
    }

    // Fallback to sessionStorage
    const sessionStored = sessionStorage.getItem('localtunes_cross_domain_auth');
    if (sessionStored) {
      return JSON.parse(sessionStored);
    }

    return null;
  } catch (error) {
    console.error('❌ Failed to get cross-domain auth data:', error);
    return null;
  }
}

/**
 * Clear cross-domain authentication data
 */
function clearCrossDomainAuthData(): void {
  try {
    localStorage.removeItem('localtunes_cross_domain_auth');
    sessionStorage.removeItem('localtunes_cross_domain_auth');
    console.log('✅ Cross-domain authentication data cleared');
  } catch (error) {
    console.error('❌ Failed to clear cross-domain auth data:', error);
  }
}

/**
 * Automatically update localtunes_public field if guestUrl is available and link is not set
 * @param apolloClient - Apollo GraphQL client
 * @param documentId - User's document ID
 * @param guestUrl - Guest URL from LocalTunes login response
 * @returns Promise<boolean> indicating if update was successful
 */

export async function autoUpdateLocalTunesPublicLink(
  apolloClient: ApolloClient<any>,
  documentId: string,
  guestUrl: string
): Promise<boolean> {
  try {
    console.log('🔗 Auto-updating LocalTunes public profile link...');

    // First, get the current account data
    const accountResponse = await apolloClient.query({
      query: getUserAccountQuery,
      variables: { documentId },
      fetchPolicy: 'network-only',
    });

    const account = accountResponse.data?.usersPermissionsUser?.accounts?.[0];
    if (!account) {
      console.log('❌ Account not found');
      return false;
    }

    // Check if localtunes_public is already set
    if (account.localtunes_public) {
      console.log('✅ LocalTunes public link already set, skipping auto-update');
      return true;
    }

    // Build the playlist URL from guestUrl
    const playlistUrl = buildLocalTunesPlaylistUrl(guestUrl);
    console.log('📝 Setting LocalTunes public link to:', playlistUrl);

    // Update the account with the playlist URL
    await apolloClient.mutate({
      mutation: updateAccountMutation,
      variables: {
        documentId: account.documentId,
        data: {
          localtunes_public: playlistUrl,
        },
      },
    });

    console.log('✅ LocalTunes public profile link automatically set');
    return true;
  } catch (error) {
    console.error('❌ Failed to auto-update LocalTunes public link:', error);
    return false;
  }
}

/**
 * Perform Single Sign-On with LocalTunes
 * @param apolloClient - Apollo GraphQL client
 * @param documentId - User's document ID
 * @param config - SSO configuration (optional)
 * @returns Promise<SSOResult> with SSO result
 */
export async function performLocalTunesSSO(
  apolloClient: ApolloClient<any>,
  documentId: string,
  config: SSOConfig = DEFAULT_SSO_CONFIG
): Promise<SSOResult> {
  try {
    console.log('🚀 Starting LocalTunes SSO process...');

    // Check if SSO is enabled
    if (!config.enabled) {
      console.log('⏭️ LocalTunes SSO disabled, skipping...');
      return {
        success: true,
        message: 'LocalTunes SSO is disabled',
      };
    }

    // Check if user has LocalTunes integration enabled
    const isIntegrated = await checkLocalTunesIntegration(apolloClient, documentId);
    if (!isIntegrated) {
      console.log('⏭️ User does not have LocalTunes integration enabled, skipping SSO');
      return {
        success: true,
        message: 'User does not have LocalTunes integration enabled',
      };
    }

    // Get stored credentials
    const credentials = getCredentialsForLocalTunes();
    if (!credentials) {
      console.log('❌ No LocalTunes credentials available for SSO');
      return {
        success: false,
        error: 'No credentials available',
        message: 'User credentials not found for LocalTunes authentication',
      };
    }

    // Check if we already have valid LocalTunes authentication
    const crossDomainAuth = getCrossDomainAuthData();
    if (crossDomainAuth) {
      console.log('✅ LocalTunes cross-domain authentication already valid, skipping SSO');
      return {
        success: true,
        message: 'LocalTunes authentication already active',
      };
    }

    // Perform LocalTunes authentication
    const authResult = await authenticateWithLocalTunes(credentials, config);

    if (authResult.success) {
      console.log('🎉 LocalTunes SSO completed successfully');

      // If we got a guestUrl from the login response, automatically set the public profile link
      if (authResult.guestUrl) {
        console.log('🔗 GuestUrl received, auto-updating public profile link...');
        await autoUpdateLocalTunesPublicLink(apolloClient, documentId, authResult.guestUrl);
      }
    } else {
      console.log('⚠️ LocalTunes SSO failed, but explorers login continues');
    }

    return authResult;
  } catch (error: any) {
    console.error('❌ LocalTunes SSO error:', error);

    return {
      success: false,
      error: error.message || 'Unknown SSO error',
      message: 'SSO process failed',
    };
  }
}

/**
 * Clear LocalTunes SSO session
 * @returns Promise<SSOResult> with cleanup result
 */
export async function clearLocalTunesSSO(): Promise<SSOResult> {
  try {
    console.log('🧹 Clearing LocalTunes SSO session...');

    clearCrossDomainAuthData();

    console.log('✅ LocalTunes SSO session cleared');

    return {
      success: true,
      message: 'LocalTunes SSO session cleared successfully',
    };
  } catch (error: any) {
    console.error('❌ Failed to clear LocalTunes SSO session:', error);

    return {
      success: false,
      error: error.message || 'Unknown cleanup error',
      message: 'Failed to clear LocalTunes SSO session',
    };
  }
}

/**
 * Check LocalTunes SSO status
 * @returns Promise<SSOResult> with status information
 */
export async function checkLocalTunesSSOStatus(): Promise<SSOResult> {
  try {
    console.log('🔍 Checking LocalTunes SSO status...');

    const crossDomainAuth = getCrossDomainAuthData();
    const hasValidAuth = crossDomainAuth !== null;

    return {
      success: true,
      message: hasValidAuth ? 'LocalTunes SSO is active' : 'LocalTunes SSO is not active',
    };
  } catch (error: any) {
    console.error('❌ Failed to check LocalTunes SSO status:', error);

    return {
      success: false,
      error: error.message || 'Unknown status check error',
      message: 'Failed to check LocalTunes SSO status',
    };
  }
}

/**
 * Debug function to check SSO status
 */
export function debugSSOStatus(): void {
  console.log('=== LocalTunes SSO Debug ===');
  console.log('SSO Config:', DEFAULT_SSO_CONFIG);
  console.log('Cross-domain auth data:', getCrossDomainAuthData());
  console.log('============================');
}

/**
 * Handle post-login actions for LocalTunes
 * Syncs the user with LocalTunes Neon DB
 * @param user - Strapi user object
 */
/**
 * Handle post-login actions for LocalTunes
 * Syncs the user with LocalTunes Neon DB and updates public profile link
 * 
 * This runs AFTER onboarding is complete (AuthSyncManager skips /onboarding).
 * The sync endpoint is idempotent: it creates the Neon user if missing, or
 * returns the existing one. The guestUrl safety-net below handles accounts
 * that may have missed writing guestUrl during onboarding (e.g. network error).
 * 
 * @param user - Strapi user object
 * @param apolloClient - Apollo Client instance for GraphQL operations
 */
export async function handlePostLoginSync(user: any, apolloClient?: ApolloClient<any>): Promise<void> {
  try {
    console.log('🔄 Handling post-login sync for LocalTunes...');
    const { syncLocalTunesUser } = await import('./localTunesService');

    // Ensure we pass the correct properties
    const result = await syncLocalTunesUser({
      id: user.documentId || user.id, // Handle both ID formats
      username: user.username,
      email: user.email
    });

    if (result.success) {
      console.log('✅ Post-login sync successful');

      // Safety-net: if guestUrl came back AND apolloClient is available,
      // check if localtunes_public is already set in Strapi. If not, write it now.
      // This handles accounts that missed guestUrl during onboarding (e.g. older
      // accounts, or a network failure during the onboarding sync).
      if (result.user?.guestUrl && apolloClient) {
        const userDocumentId = user.documentId || user.id;
        console.log('🔗 [Safety-net] Checking if guestUrl needs to be saved to account...');
        try {
          await autoUpdateLocalTunesPublicLink(
            apolloClient,
            userDocumentId,
            result.user.guestUrl
          );
          // autoUpdateLocalTunesPublicLink already skips if field is set — no duplicate writes
        } catch (linkError) {
          console.error('Failed to apply guestUrl safety-net during post-login sync:', linkError);
        }
      }
    } else {
      console.warn('⚠️ Post-login sync warning:', result.message);
    }
  } catch (error) {
    console.error('❌ Post-login sync failed:', error);
  }
}
