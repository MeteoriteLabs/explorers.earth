import axios from 'axios';

const LOCAL_TUNES_API_URL = import.meta.env.VITE_LOCAL_TUNES_API_URL || 'https://localtunes.earth';
const SESSION_STORAGE_KEY = 'localTunes_session';
const CROSS_DOMAIN_AUTH_KEY = 'localtunes_cross_domain_auth';

const localTunesClient = axios.create({
  baseURL: LOCAL_TUNES_API_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

localTunesClient.interceptors.request.use(
  (config) => {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      try {
        const authData = JSON.parse(authStorage);
        const token = authData?.state?.token ?? authData?.state?.jwt;
        if (token) config.headers.Authorization = `Bearer ${token}`;
      } catch {
        // An invalid application auth cache is ignored without logging its content.
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

localTunesClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

function safeMusicError(error: any): Error {
  const contained = error?.response?.data?.error;
  return Object.assign(new Error(contained?.message || 'Music request failed.'), {
    code: contained?.code || 'MUSIC_REQUEST_FAILED',
    requestId: contained?.requestId,
    retryable: contained?.retryable === true,
  });
}

export const localTunesRequest = async (method: string, url: string, data?: any) => {
  try {
    const response = await localTunesClient.request({ method, url, data });
    return response.data;
  } catch (error) {
    throw safeMusicError(error);
  }
};

const clearSession = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(CROSS_DOMAIN_AUTH_KEY);
  sessionStorage.removeItem(CROSS_DOMAIN_AUTH_KEY);
};

const isSessionValid = (): boolean => {
  clearSession();
  return false;
};

const embeddedSessionDisabled = async (): Promise<never> => {
  clearSession();
  throw Object.assign(new Error('Embedded Music authentication is unavailable.'), {
    code: 'EMBEDDED_MUSIC_SESSION_DISABLED',
  });
};

const completeLogout = async () => clearSession();

export const localTunesAPI = {
  getPlaylist: (guestUrl: string) => localTunesRequest('GET', `/api/playlist/${guestUrl}`),
  addSong: (guestUrl: string, songData: any) =>
    localTunesRequest('POST', `/api/playlist/${guestUrl}/songs`, songData),
  deleteSong: (guestUrl: string, songId: number) =>
    localTunesRequest('DELETE', `/api/playlist/${guestUrl}/songs/${songId}`),
  updateCurrentlyPlaying: (guestUrl: string, songId: number) =>
    localTunesRequest('POST', `/api/playlist/${guestUrl}/currently-playing`, { songId }),
  getUser: embeddedSessionDisabled,
  clearSession,
  completeLogout,
  isSessionValid,
  debugSession: clearSession,
};

async function containedImport(config: { method: string; url: string; data: any; timeout: number }) {
  try {
    const response = await localTunesClient.request(config);
    return response.data;
  } catch (error) {
    throw safeMusicError(error);
  }
}

export const youtubeAPI = {
  search: (query: string, pageToken?: string) => {
    let username: string | undefined;
    try {
      const authStorage = localStorage.getItem('auth-storage');
      if (authStorage) username = JSON.parse(authStorage)?.state?.user?.username;
    } catch {
      // Invalid application auth state is treated as anonymous.
    }
    return localTunesRequest('POST', '/api/youtube/search', { query, pageToken, username });
  },
  getVideoFromUrl: (url: string, guestUrl?: string) => {
    const params = guestUrl ? `?guestUrl=${encodeURIComponent(guestUrl)}` : '';
    return localTunesRequest('POST', `/api/youtube/video-from-url${params}`, { url });
  },
  importYouTubePlaylist: (url: string, guestUrl?: string) => {
    const params = guestUrl ? `?guestUrl=${encodeURIComponent(guestUrl)}` : '';
    return containedImport({ method: 'POST', url: `/api/playlist/import-youtube${params}`, data: { url }, timeout: 300000 });
  },
  importSpotifyPlaylist: (url: string, guestUrl?: string) => {
    const params = guestUrl ? `?guestUrl=${encodeURIComponent(guestUrl)}` : '';
    return containedImport({ method: 'POST', url: `/api/playlist/import-spotify${params}`, data: { url }, timeout: 300000 });
  },
  importYouTubePlaylistToPlaylist: (url: string, playlistId: number) =>
    containedImport({ method: 'POST', url: `/api/playlists/${playlistId}/import-youtube`, data: { url }, timeout: 300000 }),
  importSpotifyPlaylistToPlaylist: (url: string, playlistId: number) =>
    containedImport({ method: 'POST', url: `/api/playlists/${playlistId}/import-spotify`, data: { url }, timeout: 300000 }),
};

export const apiRequest = localTunesRequest;
export const playlistAPI = localTunesAPI;
export default localTunesClient;
