import { describe, it, expect, vi } from 'vitest';
import igdbService from '../igdbService';

describe('igdbService transforming and details error scenarios', () => {
  it('should transform raw IGDB result correctly', () => {
    const rawItem = {
      id: 123,
      slug: 'zelda-totk',
      name: 'Tears of the Kingdom',
      cover: { image_id: 'img123' },
      summary: 'Epic adventure game',
      first_release_date: 1683849600,
      total_rating: 96.2,
      total_rating_count: 500,
      genres: [{ name: 'Adventure' }, { name: 'RPG' }],
      platforms: [{ name: 'Nintendo Switch' }]
    };

    const transformed = igdbService.transformIgdbResult(rawItem as any);
    expect(transformed.igdb_id).toBe(123);
    expect(transformed.title).toBe('Tears of the Kingdom');
    expect(transformed.release_year).toBe('2023');
    expect(transformed.igdb_rating).toBe(9.6);
  });

  it('should throw an IgdbError on detail fetching HTTP errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request'
    } as unknown as Response);

    await expect(igdbService.getGameDetails(123)).rejects.toThrow('Failed to fetch game details.');
  });
});
