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
