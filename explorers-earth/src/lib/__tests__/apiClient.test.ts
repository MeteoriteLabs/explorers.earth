import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { localTunesRequest, localTunesAPI, youtubeAPI } from '../apiClient';

vi.mock('axios', () => {
  const mockInstance = {
    request: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return {
    default: {
      create: vi.fn(() => mockInstance),
    },
  };
});

// Have to import after mocking to get the mocked instance
import localTunesClient from '../apiClient';

// Capture the request interceptor's success handler at module-evaluation time,
// before any beforeEach can call vi.clearAllMocks() and wipe mock.calls.
// axios.create is called exactly once during apiClient import, so results[0] exists here.
const _axiosCreateResults = (axios.create as any).mock.results;
const _capturedMockInstance =
  _axiosCreateResults[0]?.value ?? _axiosCreateResults.at?.(-1)?.value;
const _capturedInterceptorOnFulfilled: (config: any) => any =
  _capturedMockInstance?.interceptors?.request?.use?.mock?.calls?.[0]?.[0];

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('localTunesRequest', () => {
    it('makes request and returns data', async () => {
      (localTunesClient.request as any).mockResolvedValueOnce({ data: { success: true } });
      
      const result = await localTunesRequest('GET', '/test-url');
      
      expect(localTunesClient.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/test-url',
        data: undefined,
      });
      expect(result).toEqual({ success: true });
    });

    it('throws error on failure', async () => {
      const error = new Error('Network error');
      (localTunesClient.request as any).mockRejectedValueOnce(error);
      
      await expect(localTunesRequest('GET', '/test-url')).rejects.toThrow('Network error');
    });
  });

  describe('request interceptor (auth injection)', () => {
    // _capturedInterceptorOnFulfilled was grabbed at module-evaluation time
    // (before any beforeEach wipes mock.calls via vi.clearAllMocks()).

    it('adds Authorization without mutable owner headers from auth-storage', () => {
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({ state: { token: 'jwt-abc', user: { username: 'alice' } } })
      );

      // The interceptor's success handler was registered on the mocked instance
      // at import time; grab it and run it against a bare config.
      const config = _capturedInterceptorOnFulfilled({ headers: {} });

      expect(config.headers.Authorization).toBe('Bearer jwt-abc');
      expect(config.headers['X-Username']).toBeUndefined();
    });

    it('omits auth headers when no token is stored', () => {
      // localStorage is cleared by the parent beforeEach before each test,
      // so no 'auth-storage' key is present here.
      const config = _capturedInterceptorOnFulfilled({ headers: {} });

      expect(config.headers.Authorization).toBeUndefined();
      expect(config.headers['X-Username']).toBeUndefined();
    });
  });

  describe('localTunesAPI', () => {
    it('getPlaylist calls correct endpoint', async () => {
      (localTunesClient.request as any).mockResolvedValueOnce({ data: { playlist: [] } });
      await localTunesAPI.getPlaylist('guest123');
      expect(localTunesClient.request).toHaveBeenCalledWith({
        method: 'GET',
        url: '/api/playlist/guest123',
        data: undefined,
      });
    });

    it('clearSession clears localStorage', () => {
      localStorage.setItem('localTunes_session', 'some_session');
      localTunesAPI.clearSession();
      expect(localStorage.getItem('localTunes_session')).toBeNull();
    });

    it('isSessionValid returns false when no session', () => {
      expect(localTunesAPI.isSessionValid()).toBe(false);
    });
  });

  describe('youtubeAPI', () => {
    it('search calls correct endpoint', async () => {
      (localTunesClient.request as any).mockResolvedValueOnce({ data: { items: [] } });
      
      await youtubeAPI.search('test query');
      
      expect(localTunesClient.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/api/youtube/search',
        data: { query: 'test query', pageToken: undefined, username: undefined },
      });
    });
  });
});
