import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import igdbService, { IgdbError } from '../igdbService';
import { IGDBSearchResult } from '../../types/igdbTypes';

vi.mock('axios');

describe('igdbService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset private fields via any
    (igdbService as any).igdbToken = null;
    (igdbService as any).tokenExpiresAt = 0;
  });

  describe('Utility functions', () => {
    it('formatIgdbRating formats correctly', () => {
      expect(igdbService.formatIgdbRating(85.555)).toBe('8.6');
      expect(igdbService.formatIgdbRating(null)).toBeNull();
    });

    it('shortenPlatform shortens known platforms', () => {
      expect(igdbService.shortenPlatform('PlayStation 5')).toBe('PS5');
      expect(igdbService.shortenPlatform('PC (Microsoft Windows)')).toBe('PC');
      expect(igdbService.shortenPlatform('Unknown Platform')).toBe('Unknown Platform');
    });

    it('extractDeveloper gets the developer name', () => {
      const companies = [
        { company: { name: 'Dev Studio' }, developer: true, publisher: false },
        { company: { name: 'Pub Studio' }, developer: false, publisher: true },
      ];
      expect(igdbService.extractDeveloper(companies)).toBe('Dev Studio');
      expect(igdbService.extractDeveloper(undefined)).toBeNull();
    });

    it('extractPublisher gets the publisher name', () => {
      const companies = [
        { company: { name: 'Dev Studio' }, developer: true, publisher: false },
        { company: { name: 'Pub Studio' }, developer: false, publisher: true },
      ];
      expect(igdbService.extractPublisher(companies)).toBe('Pub Studio');
    });

    it('igdbTimestampToYear converts timestamp to year', () => {
      expect(igdbService.igdbTimestampToYear(1577836800)).toBe('2020'); // Jan 1 2020
      expect(igdbService.igdbTimestampToYear(null)).toBeNull();
    });

    it('igdbTimestampToDateString converts timestamp to date string', () => {
      expect(igdbService.igdbTimestampToDateString(1577836800)).toBe('2020-01-01');
      expect(igdbService.igdbTimestampToDateString(null)).toBeNull();
    });

    it('getCoverUrl generates correct URL', () => {
      expect(igdbService.getCoverUrl('img123')).toBe('https://images.igdb.com/igdb/image/upload/t_cover_big/img123.jpg');
      expect(igdbService.getCoverUrl(null)).toBeNull();
    });

    it('getScreenshotUrl generates correct URL', () => {
      expect(igdbService.getScreenshotUrl('img123')).toBe('https://images.igdb.com/igdb/image/upload/t_720p/img123.jpg');
    });
  });

  describe('API and Auth methods', () => {
    it('fetches games using the test-mode token bypass', async () => {
      (axios.post as any).mockImplementation((url: string) => {
        if (url.includes('/igdb-api/v4/games')) {
          return Promise.resolve({ data: [{ id: 1, name: 'Zelda' }] });
        }
        return Promise.reject(new Error('not found'));
      });

      const results = await igdbService.searchGames('Zelda');

      // MODE === 'test' (and jsdom's localhost hostname) short-circuits Twitch
      // OAuth in getAccessToken, so only the IGDB games request reaches axios.
      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Zelda');

      // Token stays cached; the next call adds exactly one more IGDB request.
      await igdbService.getGameDetails(1);
      expect(axios.post).toHaveBeenCalledTimes(2);
    });

    it('searchGames returns empty array for empty query', async () => {
      const results = await igdbService.searchGames('   ');
      expect(results).toEqual([]);
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('getGameDetails returns null if not found', async () => {
      (axios.post as any).mockImplementation((url: string) => {
        if (url.includes('oauth2/token')) {
          return Promise.resolve({ data: { access_token: 'fake-token', expires_in: 3600 } });
        }
        return Promise.resolve({ data: [] });
      });

      const result = await igdbService.getGameDetails(999);
      expect(result).toBeNull();
    });

    it('handles auth error', async () => {
      (axios.post as any).mockRejectedValue(new Error('Auth failed'));

      await expect(igdbService.searchGames('test')).rejects.toThrow(IgdbError);
      // Credentials are present (stubbed in setup), so the request is actually
      // attempted and the auth failure is what gets wrapped — not the creds guard.
      expect(axios.post).toHaveBeenCalled();
    });
  });

  describe('transformIgdbResult', () => {
    it('transforms full result correctly', () => {
      const raw: IGDBSearchResult = {
        id: 1,
        name: 'Test Game',
        slug: 'test-game',
        summary: 'A test game',
        first_release_date: 1577836800,
        total_rating: 85.5,
        total_rating_count: 100,
        cover: { image_id: 'cov1' },
        genres: [{ id: 1, name: 'RPG' }],
        platforms: [{ id: 1, name: 'PlayStation 5' }],
        involved_companies: [{ company: { name: 'Dev' }, developer: true, publisher: false }],
        game_modes: [{ id: 1, name: 'Single player' }],
        screenshots: [{ image_id: 'scr1' }],
        url: 'https://igdb.com/game'
      };

      const mapped = igdbService.transformIgdbResult(raw);

      expect(mapped.igdb_id).toBe(1);
      expect(mapped.title).toBe('Test Game');
      expect(mapped.igdb_slug).toBe('test-game');
      expect(mapped.cover_url).toContain('cov1');
      expect(mapped.igdb_rating).toBe(8.6); // formatted and parsed
      expect(mapped.genres).toEqual(['RPG']);
      expect(mapped.platforms).toEqual(['PS5']); // shortened
      expect(mapped.developer).toBe('Dev');
      expect(mapped.release_year).toBe('2020');
      expect(mapped.screenshot_ids).toEqual(['scr1']);
    });
  });
});
