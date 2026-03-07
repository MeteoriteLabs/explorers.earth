/**
 * Cookie Management Utilities for LocalTunes SSO
 * 
 * This utility manages HTTP-only cookies for LocalTunes authentication
 * to enable Single Sign-On (SSO) between explorers and LocalTunes platforms.
 */

export interface LocalTunesAuthCookies {
  auth_token: string;
  auth_user: string;
}

const COOKIE_NAMES = {
  AUTH_TOKEN: 'localtunes_auth_token',
  AUTH_USER: 'localtunes_auth_user',
} as const;

const COOKIE_CONFIG = {
  domain: window.location.hostname,
  path: '/',
  secure: window.location.protocol === 'https:',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

/**
 * Set a cookie with HTTP-only configuration
 * @param name - Cookie name
 * @param value - Cookie value
 * @param options - Cookie options
 */
function setCookie(
  name: string,
  value: string,
  options: {
    domain?: string;
    path?: string;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    maxAge?: number;
    httpOnly?: boolean;
  } = {}
): void {
  try {
    const cookieOptions = {
      domain: options.domain || COOKIE_CONFIG.domain,
      path: options.path || COOKIE_CONFIG.path,
      secure: options.secure !== undefined ? options.secure : COOKIE_CONFIG.secure,
      sameSite: options.sameSite || COOKIE_CONFIG.sameSite,
      maxAge: options.maxAge || COOKIE_CONFIG.maxAge,
      httpOnly: options.httpOnly !== undefined ? options.httpOnly : true,
    };

    let cookieString = `${name}=${encodeURIComponent(value)}`;

    if (cookieOptions.domain) {
      cookieString += `; Domain=${cookieOptions.domain}`;
    }

    if (cookieOptions.path) {
      cookieString += `; Path=${cookieOptions.path}`;
    }

    if (cookieOptions.maxAge) {
      cookieString += `; Max-Age=${cookieOptions.maxAge}`;
    }

    if (cookieOptions.secure) {
      cookieString += `; Secure`;
    }

    if (cookieOptions.sameSite) {
      cookieString += `; SameSite=${cookieOptions.sameSite}`;
    }

    if (cookieOptions.httpOnly) {
      cookieString += `; HttpOnly`;
    }

    document.cookie = cookieString;
    console.log(`✅ Cookie set: ${name}`);
  } catch (error) {
    console.error(`❌ Failed to set cookie ${name}:`, error);
  }
}

/**
 * Get a cookie value by name
 * @param name - Cookie name
 * @returns Cookie value or null if not found
 */
function getCookie(name: string): string | null {
  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [cookieName, cookieValue] = cookie.trim().split('=');
      if (cookieName === name) {
        return decodeURIComponent(cookieValue);
      }
    }
    return null;
  } catch (error) {
    console.error(`❌ Failed to get cookie ${name}:`, error);
    return null;
  }
}

/**
 * Delete a cookie by name
 * @param name - Cookie name
 * @param domain - Cookie domain (optional)
 * @param path - Cookie path (optional)
 */
function deleteCookie(name: string, domain?: string, path?: string): void {
  try {
    const cookieOptions = {
      domain: domain || COOKIE_CONFIG.domain,
      path: path || COOKIE_CONFIG.path,
    };

    let cookieString = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`;

    if (cookieOptions.domain) {
      cookieString += `; Domain=${cookieOptions.domain}`;
    }

    if (cookieOptions.path) {
      cookieString += `; Path=${cookieOptions.path}`;
    }

    document.cookie = cookieString;
    console.log(`✅ Cookie deleted: ${name}`);
  } catch (error) {
    console.error(`❌ Failed to delete cookie ${name}:`, error);
  }
}

/**
 * Set LocalTunes authentication cookies
 * @param authData - LocalTunes authentication data
 */
export function setLocalTunesAuthCookies(authData: LocalTunesAuthCookies): void {
  try {
    console.log('🍪 Setting LocalTunes authentication cookies...');

    setCookie(COOKIE_NAMES.AUTH_TOKEN, authData.auth_token);
    setCookie(COOKIE_NAMES.AUTH_USER, authData.auth_user);

    console.log('✅ LocalTunes authentication cookies set successfully');
  } catch (error) {
    console.error('❌ Failed to set LocalTunes authentication cookies:', error);
  }
}

/**
 * Get LocalTunes authentication cookies
 * @returns LocalTunes authentication data or null if not found
 */
export function getLocalTunesAuthCookies(): LocalTunesAuthCookies | null {
  try {
    const authToken = getCookie(COOKIE_NAMES.AUTH_TOKEN);
    const authUser = getCookie(COOKIE_NAMES.AUTH_USER);

    if (authToken && authUser) {
      console.log('✅ LocalTunes authentication cookies found');
      return {
        auth_token: authToken,
        auth_user: authUser,
      };
    }

    console.log('❌ LocalTunes authentication cookies not found');
    return null;
  } catch (error) {
    console.error('❌ Failed to get LocalTunes authentication cookies:', error);
    return null;
  }
}

/**
 * Clear LocalTunes authentication cookies
 */
export function clearLocalTunesAuthCookies(): void {
  try {
    console.log('🧹 Clearing LocalTunes authentication cookies...');

    deleteCookie(COOKIE_NAMES.AUTH_TOKEN);
    deleteCookie(COOKIE_NAMES.AUTH_USER);

    console.log('✅ LocalTunes authentication cookies cleared successfully');
  } catch (error) {
    console.error('❌ Failed to clear LocalTunes authentication cookies:', error);
  }
}

/**
 * Check if LocalTunes authentication cookies exist and are valid
 * @returns boolean indicating if cookies are available
 */
export function hasLocalTunesAuthCookies(): boolean {
  const authCookies = getLocalTunesAuthCookies();
  return authCookies !== null;
}

/**
 * Debug function to check cookie status
 */
export function debugCookies(): void {
  console.log('=== LocalTunes Cookie Debug ===');
  console.log('Has auth cookies:', hasLocalTunesAuthCookies());

  const authCookies = getLocalTunesAuthCookies();
  if (authCookies) {
    console.log('Auth token:', authCookies.auth_token.substring(0, 20) + '...');
    console.log('Auth user:', authCookies.auth_user);
  } else {
    console.log('No auth cookies found');
  }

  console.log('All cookies:', document.cookie);
  console.log('===============================');
}

/**
 * Validate LocalTunes authentication cookies by making a test API call
 * @returns Promise<boolean> indicating if cookies are valid
 */
export async function validateLocalTunesAuthCookies(): Promise<boolean> {
  try {
    const authCookies = getLocalTunesAuthCookies();
    if (!authCookies) {
      return false;
    }

    // Make a test API call to LocalTunes to validate the cookies
    const response = await fetch(`${import.meta.env.VITE_LOCAL_TUNES_API_URL}/api/user`, {
      method: 'GET',
      credentials: 'include', // Include cookies in the request
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const isValid = response.ok;
    console.log(`🔍 LocalTunes auth cookies validation: ${isValid ? 'valid' : 'invalid'}`);

    if (!isValid) {
      // Clear invalid cookies
      clearLocalTunesAuthCookies();
    }

    return isValid;
  } catch (error) {
    console.error('❌ Failed to validate LocalTunes auth cookies:', error);
    // Clear cookies on validation error
    clearLocalTunesAuthCookies();
    return false;
  }
}
