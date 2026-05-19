import { describe, it, expect, vi, beforeEach } from 'vitest';
import tmdbService, { TMDBError } from '../tmdbService';

describe('tmdbService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API fetch wrappers', () => {
    it('searchMulti filters correctly and calls fetch', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ media_type: 'movie' }, { media_type: 'person' }, { media_type: 'tv' }] }),
      });

      const results = await tmdbService.searchMulti('batman');
      
      expect(fetch).toHaveBeenCalledTimes(1);
      const url = new URL((global.fetch as any).mock.calls[0][0]);
      expect(url.pathname).toBe('/3/search/multi');
      expect(url.searchParams.get('query')).toBe('batman');
      expect(results).toHaveLength(2); // movie and tv
    });

    it('searchMulti returns empty array on empty query', async () => {
      global.fetch = vi.fn();
      const results = await tmdbService.searchMulti('   ');
      expect(results).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('getMovieDetails calls fetch correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 123, title: 'Test Movie' }),
      });

      const result = await tmdbService.getMovieDetails(123);
      
      expect(fetch).toHaveBeenCalledTimes(1);
      const url = new URL((global.fetch as any).mock.calls[0][0]);
      expect(url.pathname).toBe('/3/movie/123');
      expect(url.searchParams.get('append_to_response')).toBe('credits');
      expect(result.id).toBe(123);
    });

    it('getTVDetails calls fetch correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 123, name: 'Test TV' }),
      });

      const result = await tmdbService.getTVDetails(123);
      
      expect(fetch).toHaveBeenCalledTimes(1);
      const url = new URL((global.fetch as any).mock.calls[0][0]);
      expect(url.pathname).toBe('/3/tv/123');
      expect(url.searchParams.get('append_to_response')).toBe('credits');
    });

    it('getWatchProviders deduplicates and sorts providers', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: {
            US: {
              link: 'test-link',
              flatrate: [{ provider_id: 1, provider_name: 'Netflix', display_priority: 2 }],
              rent: [{ provider_id: 2, provider_name: 'Amazon', display_priority: 1 }],
              buy: [{ provider_id: 1, provider_name: 'Netflix', display_priority: 2 }], // Duplicate
            }
          }
        }),
      });

      const providers = await tmdbService.getWatchProviders(123, 'movie', 'US');
      
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(providers).toHaveLength(2);
      expect(providers[0].provider_name).toBe('Amazon'); // priority 1
      expect(providers[1].provider_name).toBe('Netflix'); // priority 2
      expect(providers[0].link).toBe('test-link');
    });

    it('getWatchProviders returns empty array if region not found', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: {} }),
      });

      const providers = await tmdbService.getWatchProviders(123, 'movie', 'US');
      expect(providers).toEqual([]);
    });

    it('getMovieGenres calls fetch', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ genres: [{ id: 1, name: 'Action' }] }),
      });

      const genres = await tmdbService.getMovieGenres();
      expect(genres).toHaveLength(1);
    });

    it('getTrending calls fetch correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [{ id: 1 }] }),
      });

      const results = await tmdbService.getTrending('movie');
      expect(fetch).toHaveBeenCalledTimes(1);
      const url = new URL((global.fetch as any).mock.calls[0][0]);
      expect(url.pathname).toBe('/3/trending/movie/week');
      expect(results).toHaveLength(1);
    });

    it('throws TMDBError on fetch failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(tmdbService.searchMulti('test')).rejects.toThrow(TMDBError);
      await expect(tmdbService.searchMulti('test')).rejects.toThrow('TMDB API error: Not Found');
    });

    it('throws TMDBError on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(tmdbService.searchMulti('test')).rejects.toThrow(TMDBError);
      await expect(tmdbService.searchMulti('test')).rejects.toThrow('Failed to fetch from TMDB');
    });
  });

  describe('Image URL Builders', () => {
    it('buildImageUrl handles paths correctly', () => {
      expect(tmdbService.buildImageUrl('/img.jpg', 'w500')).toBe('https://image.tmdb.org/t/p/w500/img.jpg');
      expect(tmdbService.buildImageUrl('https://external.com/img.jpg', 'w500')).toBe('https://external.com/img.jpg');
      expect(tmdbService.buildImageUrl(null, 'w500')).toBe('');
    });

    it('buildPosterUrl uses correct default size', () => {
      expect(tmdbService.buildPosterUrl('/poster.jpg')).toBe('https://image.tmdb.org/t/p/w342/poster.jpg');
      expect(tmdbService.buildPosterUrl('/poster.jpg', 'w185')).toBe('https://image.tmdb.org/t/p/w185/poster.jpg');
    });

    it('buildBackdropUrl uses correct default size', () => {
      expect(tmdbService.buildBackdropUrl('/bg.jpg')).toBe('https://image.tmdb.org/t/p/w780/bg.jpg');
    });

    it('buildLogoUrl uses correct default size', () => {
      expect(tmdbService.buildLogoUrl('/logo.jpg')).toBe('https://image.tmdb.org/t/p/w92/logo.jpg');
    });
  });

  describe('Utility functions', () => {
    it('extractYear extracts year', () => {
      expect(tmdbService.extractYear('2023-01-01')).toBe('2023');
      expect(tmdbService.extractYear(null)).toBe('');
    });

    it('extractDirector gets the director from credits', () => {
      const movie: any = {
        credits: {
          crew: [
            { job: 'Writer', name: 'John' },
            { job: 'Director', name: 'Jane' },
          ]
        }
      };
      expect(tmdbService.extractDirector(movie)).toBe('Jane');

      const movieNoDirector: any = { credits: { crew: [] } };
      expect(tmdbService.extractDirector(movieNoDirector)).toBeNull();
    });
  });
});
