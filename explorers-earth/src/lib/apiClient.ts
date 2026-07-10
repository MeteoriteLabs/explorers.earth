// API utilities for playlist management
import axios from 'axios';
import { getCredentialsForLocalTunes } from '../utils/sessionCredentials';

// Local Tunes API configuration
const LOCAL_TUNES_API_URL = import.meta.env.VITE_LOCAL_TUNES_API_URL || 'https://localtunes.earth';

/**
 * IMPORTANT: Cross-Origin Cookie Issue
 * 
 * For SSO to work between localhost:5173 and localtunes.earth, the server MUST set
 * the session cookie with `SameSite=None; Secure` attributes.
 * 
 * Current issue: The server sets cookies with `SameSite=Lax`, which prevents them
 * from being sent with cross-origin XHR/Fetch requests. This causes authentication
 * to fail after login.
 * 
 * Server-side fix required:
 * - Set cookie with: `SameSite=None; Secure`
 * - This requires HTTPS on both ends (or at least the server)
 * - Example: `Set-Cookie: cosmic.sid=...; Path=/; SameSite=None; Secure; HttpOnly`
 * 
 * Note: Browsers block JavaScript from reading Set-Cookie headers from cross-origin
 * responses for security reasons, so we cannot extract the cookie client-side.
 */

// Create axios instance for Local Tunes API
const localTunesClient = axios.create({
  baseURL: LOCAL_TUNES_API_URL,
  timeout: 60000, // 60s default; playlist imports use a longer timeout (see importYouTubePlaylist / importSpotifyPlaylist)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for Local Tunes API
localTunesClient.interceptors.request.use(
  (config) => {
    // Local Tunes API uses JWT-based authentication now
    // We get the token and username from the Zustand auth-storage
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      try {
        const authData = JSON.parse(authStorage);
        // NOTE: Zustand persists token as `state.token` (not `state.jwt`)
        const token = authData?.state?.token ?? authData?.state?.jwt;
        const username = authData?.state?.user?.username;

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        // X-Username header lets the server map the Strapi JWT → Neon DB user
        if (username) {
          config.headers['X-Username'] = username;
        }
      } catch (error) {
        console.error('Failed to parse auth storage:', error);
      }
    }

    // Add CSRF token to headers if available (still useful for some endpoints)
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and cookie extraction
localTunesClient.interceptors.response.use(
  (response) => {
    // Extract session cookie from Set-Cookie header if present
    const setCookieHeader = response.headers['set-cookie'];
    if (setCookieHeader) {
      // Handle both string and array formats
      const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

      for (const cookie of cookies) {
        // Look for cosmic.sid cookie
        const match = cookie.match(/cosmic\.sid=([^;]+)/);
        if (match) {
          sessionCookieValue = decodeURIComponent(match[1]);
          console.log('✅ Extracted session cookie from response:', sessionCookieValue.substring(0, 20) + '...');
          break;
        }
      }
    }

    return response;
  },
  (error) => {
    // Also try to extract cookie from error response
    if (error.response?.headers?.['set-cookie']) {
      const setCookieHeader = error.response.headers['set-cookie'];
      const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

      for (const cookie of cookies) {
        const match = cookie.match(/cosmic\.sid=([^;]+)/);
        if (match) {
          sessionCookieValue = decodeURIComponent(match[1]);
          console.log('✅ Extracted session cookie from error response:', sessionCookieValue.substring(0, 20) + '...');
          break;
        }
      }
    }

    console.error('Local Tunes API Error:', error);
    return Promise.reject(error);
  }
);

// Generic API request function for Local Tunes
export const localTunesRequest = async (method: string, url: string, data?: any) => {
  try {
    const response = await localTunesClient.request({
      method,
      url,
      data,
    });
    return response.data;
  } catch (error) {
    console.error(`Local Tunes API ${method} ${url} failed:`, error);
    throw error;
  }
};

// Local Tunes session management
interface LocalTunesSession {
  csrfToken: string;
  sessionId: string;
  timestamp: number;
  expiresAt: number;
}

const SESSION_STORAGE_KEY = 'localTunes_session';
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

// Store CSRF token for Local Tunes API
let csrfToken: string | null = null;

// Store session ID cookie value for cross-origin requests
let sessionCookieValue: string | null = null;

// Function to extract CSRF token from cookies
const getCsrfTokenFromCookies = () => {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'XSRF-TOKEN') {
      return decodeURIComponent(value);
    }
  }
  return null;
};

// Function to get session ID from cookies
const getSessionIdFromCookies = () => {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'cosmic.sid') {
      return value;
    }
  }
  return null;
};

// Store session in localStorage
const storeSession = (session: LocalTunesSession) => {
  try {
    console.log('💾 Storing session in localStorage:', {
      csrfToken: session.csrfToken?.substring(0, 10) + '...',
      sessionId: session.sessionId?.substring(0, 10) + '...',
      expiresAt: new Date(session.expiresAt).toISOString()
    });

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));

    // Verify it was stored
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      console.log('✅ Session successfully stored in localStorage');
    } else {
      console.log('❌ Failed to store session in localStorage');
    }
  } catch (error) {
    console.error('❌ Failed to store session:', error);
  }
};

// Get session from localStorage
const getStoredSession = (): LocalTunesSession | null => {
  try {
    console.log('🔍 Checking localStorage for session...');
    const stored = localStorage.getItem(SESSION_STORAGE_KEY);
    console.log('Raw stored data:', stored);

    if (!stored) {
      console.log('❌ No session data in localStorage');
      return null;
    }

    const session: LocalTunesSession = JSON.parse(stored);
    console.log('📦 Parsed session:', {
      csrfToken: session.csrfToken?.substring(0, 10) + '...',
      sessionId: session.sessionId?.substring(0, 10) + '...',
      expiresAt: new Date(session.expiresAt).toISOString(),
      currentTime: new Date().toISOString()
    });

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      console.log('⏰ Local Tunes session expired, removing from storage');
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    console.log('✅ Valid session found in localStorage');
    return session;
  } catch (error) {
    console.error('❌ Failed to get stored session:', error);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
};

// Check if current session is valid
const isSessionValid = (): boolean => {
  const storedSession = getStoredSession();
  if (!storedSession) {
    console.log('No stored session found');
    return false;
  }

  console.log('Checking session validity:', {
    storedSession: {
      csrfToken: storedSession.csrfToken?.substring(0, 10) + '...',
      sessionId: storedSession.sessionId?.substring(0, 10) + '...',
      expiresAt: new Date(storedSession.expiresAt).toISOString()
    },
    currentTime: new Date().toISOString(),
    isExpired: Date.now() > storedSession.expiresAt
  });

  // Check if session is expired
  if (Date.now() > storedSession.expiresAt) {
    console.log('Session expired, removing from storage');
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return false;
  }

  // For fallback sessions, just check expiry
  if (storedSession.sessionId.startsWith('fallback-session-')) {
    console.log('Using fallback session (cookies not accessible)');
    return true;
  }

  // Session exists and is not expired
  console.log('Valid session found, using cached session');
  return true;
};

// Authenticate with Local Tunes using stored credentials
const authenticateWithLocalTunes = async () => {
  console.log('=== authenticateWithLocalTunes called ===');

  // First, check if we have valid cross-domain SSO data
  try {
    const crossDomainAuth = localStorage.getItem('localtunes_cross_domain_auth');
    if (crossDomainAuth) {
      const authData = JSON.parse(crossDomainAuth);

      // Check if expired
      if (Date.now() > authData.expiresAt) {
        localStorage.removeItem('localtunes_cross_domain_auth');
        sessionStorage.removeItem('localtunes_cross_domain_auth');
      } else {
        console.log('✅ Valid LocalTunes cross-domain SSO data found, skipping login');
        return;
      }
    }
  } catch (error) {
    console.log('⚠️ Failed to validate cross-domain SSO data, proceeding with fallback authentication');
  }

  // Check if we already have a valid session
  if (isSessionValid()) {
    const storedSession = getStoredSession();
    if (storedSession) {
      csrfToken = storedSession.csrfToken;
      console.log('✅ Using existing Local Tunes session, skipping login');
      return;
    }
  }

  console.log('❌ No valid session or cross-domain auth found, proceeding with login');

  const credentials = getCredentialsForLocalTunes();
  if (!credentials) {
    throw new Error('No Local Tunes credentials available');
  }

  try {
    console.log('🔐 Authenticating with Local Tunes...');

    // Try to get CSRF token from cookies first
    csrfToken = getCsrfTokenFromCookies();

    // If not in cookies, try to get it from API
    if (!csrfToken) {
      try {
        const csrfResponse = await localTunesRequest('GET', '/api/csrf-token');
        csrfToken = csrfResponse.csrfToken;
      } catch (csrfError) {
        console.log('Could not get CSRF token from API, proceeding without it');
        csrfToken = null;
      }
    }

    // Login to Local Tunes to establish session
    const loginData: any = {
      username: credentials.username,
      password: credentials.password
    };

    if (csrfToken) {
      loginData._csrf = csrfToken;
    }

    await localTunesClient.post('/api/login', loginData);

    // The session cookie should be extracted by the response interceptor
    // But we also try to get it from cookies as a fallback
    const newCsrfToken = getCsrfTokenFromCookies();
    const sessionId = getSessionIdFromCookies() || sessionCookieValue;

    console.log('After login - CSRF Token:', newCsrfToken ? 'Found' : 'Not found');
    console.log('After login - Session ID:', sessionId ? 'Found' : 'Not found');
    console.log('After login - Session Cookie Value:', sessionCookieValue ? 'Found' : 'Not found');

    if (newCsrfToken && sessionId) {
      csrfToken = newCsrfToken;

      // Store session in localStorage
      const session: LocalTunesSession = {
        csrfToken: newCsrfToken,
        sessionId: sessionId,
        timestamp: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION
      };

      storeSession(session);
      console.log('✅ Successfully authenticated with Local Tunes and stored session');
    } else if (sessionCookieValue) {
      // Use the extracted session cookie value even if we can't read from document.cookie
      csrfToken = newCsrfToken || csrfToken;

      const session: LocalTunesSession = {
        csrfToken: csrfToken || 'extracted-token',
        sessionId: sessionCookieValue,
        timestamp: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION
      };

      storeSession(session);
      console.log('✅ Successfully authenticated with Local Tunes using extracted session cookie');
    } else {
      // Fallback: Store session even without cookies (for cross-origin issues)
      console.log('⚠️ Cookies not accessible, storing session with available data');
      const fallbackSession: LocalTunesSession = {
        csrfToken: csrfToken || 'fallback-token',
        sessionId: 'fallback-session-' + Date.now(),
        timestamp: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION
      };

      storeSession(fallbackSession);
      console.log('✅ Successfully authenticated with Local Tunes and stored fallback session');
    }
  } catch (error) {
    console.error('❌ Failed to authenticate with Local Tunes:', error);
    throw error;
  }
};

// Clear Local Tunes session
const clearSession = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  csrfToken = null;
  sessionCookieValue = null;
  console.log('🧹 Local Tunes session cleared');
};

// Complete logout - clear all storage
const completeLogout = async () => {
  console.log('🧹 Performing complete logout - clearing all storage');

  // Clear Local Tunes session
  clearSession();

  // Clear LocalTunes cross-domain SSO data
  localStorage.removeItem('localtunes_cross_domain_auth');
  sessionStorage.removeItem('localtunes_cross_domain_auth');

  // Clear all localStorage
  localStorage.clear();

  // Clear all sessionStorage
  sessionStorage.clear();

  // Clear all cookies
  document.cookie.split(";").forEach(function (c) {
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });

  console.log('✅ All storage and cookies cleared successfully');

  // Note: Navigation should be handled by the calling component
  // This function only handles the cleanup
};

// Local Tunes API functions
export const localTunesAPI = {
  // Get playlist data from Local Tunes
  getPlaylist: (guestUrl: string) =>
    localTunesRequest('GET', `/api/playlist/${guestUrl}`),

  // Add song to playlist (if supported by Local Tunes API)
  addSong: (guestUrl: string, songData: any) =>
    localTunesRequest('POST', `/api/playlist/${guestUrl}/songs`, songData),

  // Delete song (if supported by Local Tunes API)
  deleteSong: (guestUrl: string, songId: number) =>
    localTunesRequest('DELETE', `/api/playlist/${guestUrl}/songs/${songId}`),

  // Update currently playing (if supported by Local Tunes API)
  updateCurrentlyPlaying: (guestUrl: string, songId: number) =>
    localTunesRequest('POST', `/api/playlist/${guestUrl}/currently-playing`, { songId }),

  // Get user data from Local Tunes (with authentication)
  getUser: async () => {
    await authenticateWithLocalTunes();
    return localTunesRequest('GET', '/api/user');
  },

  // Clear session (useful for logout)
  clearSession,

  // Complete logout - clear all storage
  completeLogout,

  // Check if session is valid
  isSessionValid,

  // Debug function to check session status
  debugSession: () => {
    const storedSession = getStoredSession();
    console.log('=== Local Tunes Session Debug ===');
    console.log('Stored session:', storedSession);
    console.log('Is session valid:', isSessionValid());
    console.log('Current CSRF token:', csrfToken);
    console.log('Cookies:', document.cookie);
    console.log('All localStorage keys:', Object.keys(localStorage));
    console.log('localTunes_session value:', localStorage.getItem('localTunes_session'));
    console.log('===============================');
  },
};

// YouTube search API (might need to be proxied through Local Tunes)
export const youtubeAPI = {
  search: (query: string, pageToken?: string) => {
    // Get username from localStorage auth-storage
    let username: string | undefined;
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) {
        const authData = JSON.parse(authStorage);
        username = authData?.state?.user?.username;
      }
    } catch (error) {
      console.error('Error getting username from auth storage:', error);
    }

    return localTunesRequest('POST', '/api/youtube/search', { query, pageToken, username }).then(async (searchResult) => {
      // Track song request in parallel (don't wait for it)
      if (username && !pageToken) {
        // Only track on initial search, not pagination
        try {
          const { trackSongRequest } = await import('../services/requestTrackingService');
          trackSongRequest(username).catch(err => {
            console.error('[Tracking] Failed to track song request:', err);
          });
        } catch (err) {
          console.error('[Tracking] Failed to load tracking service:', err);
        }
      }
      return searchResult;
    });
  },
  // Get video details from YouTube URL
  getVideoFromUrl: (url: string, guestUrl?: string) => {
    const params = guestUrl ? `?guestUrl=${encodeURIComponent(guestUrl)}` : '';
    return localTunesRequest('POST', `/api/youtube/video-from-url${params}`, { url });
  },
  // Import YouTube playlist — uses a 5-minute timeout because large playlists can take a long time
  importYouTubePlaylist: async (url: string, guestUrl?: string) => {
    const params = guestUrl ? `?guestUrl=${encodeURIComponent(guestUrl)}` : '';
    try {
      const response = await localTunesClient.request({
        method: 'POST',
        url: `/api/playlist/import-youtube${params}`,
        data: { url },
        timeout: 300000, // 5 minutes
      });
      return response.data;
    } catch (error) {
      console.error('Local Tunes API POST /api/playlist/import-youtube failed:', error);
      throw error;
    }
  },
  // Import Spotify playlist — uses a 5-minute timeout because large playlists can take a long time
  importSpotifyPlaylist: async (url: string, guestUrl?: string) => {
    const params = guestUrl ? `?guestUrl=${encodeURIComponent(guestUrl)}` : '';
    try {
      const response = await localTunesClient.request({
        method: 'POST',
        url: `/api/playlist/import-spotify${params}`,
        data: { url },
        timeout: 300000, // 5 minutes
      });
      return response.data;
    } catch (error) {
      console.error('Local Tunes API POST /api/playlist/import-spotify failed:', error);
      throw error;
    }
  },

  // Import YouTube playlist INTO a specific saved playlist (not the main queue)
  importYouTubePlaylistToPlaylist: async (url: string, playlistId: number) => {
    try {
      const response = await localTunesClient.request({
        method: 'POST',
        url: `/api/playlists/${playlistId}/import-youtube`,
        data: { url },
        timeout: 300000, // 5 minutes
      });
      return response.data;
    } catch (error) {
      console.error(`Local Tunes API POST /api/playlists/${playlistId}/import-youtube failed:`, error);
      throw error;
    }
  },

  // Import Spotify playlist INTO a specific saved playlist (not the main queue)
  importSpotifyPlaylistToPlaylist: async (url: string, playlistId: number) => {
    try {
      const response = await localTunesClient.request({
        method: 'POST',
        url: `/api/playlists/${playlistId}/import-spotify`,
        data: { url },
        timeout: 300000, // 5 minutes
      });
      return response.data;
    } catch (error) {
      console.error(`Local Tunes API POST /api/playlists/${playlistId}/import-spotify failed:`, error);
      throw error;
    }
  },
};

// Legacy API functions for backward compatibility
export const apiRequest = localTunesRequest;
export const playlistAPI = localTunesAPI;

export default localTunesClient;
