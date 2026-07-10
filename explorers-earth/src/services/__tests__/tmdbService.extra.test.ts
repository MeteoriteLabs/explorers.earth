import { describe, it, expect, vi } from 'vitest';
import tmdbService from '../tmdbService';

describe('tmdbService Error & Formatting States', () => {
  it('should handle extractYear helper', () => {
    expect(tmdbService.extractYear('2026-07-08')).toBe('2026');
    expect(tmdbService.extractYear(undefined)).toBe('');
  });

  it('should handle invalid HTTP response statuses in tmdbService.getMovieDetails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ status_message: 'Not Found' })
    } as unknown as Response);

    await expect(tmdbService.getMovieDetails('invalid-id')).rejects.toThrow('TMDB API error: Not Found');
  });
});
