import { describe, it, expect, vi } from 'vitest';
import googleBooksService from '../googleBooksService';

describe('googleBooksService mapping and errors', () => {
  it('should transform volume item to book structure', () => {
    const rawItem = {
      id: 'vol-1',
      volumeInfo: {
        title: 'Clean Code',
        authors: ['Robert C. Martin'],
        publishedDate: '2008-08-01',
        averageRating: 4.5,
        description: 'Software quality handbook.',
        industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780132350884' }]
      }
    };
    
    const mapped = googleBooksService.transformVolumeToBook(rawItem as any);
    expect(mapped.volume_id).toBe('vol-1');
    expect(mapped.title).toBe('Clean Code');
    expect(mapped.isbn_13).toBe('9780132350884');
  });

  it('should handle API failure response in getVolumeDetails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error'
    } as unknown as Response);

    await expect(googleBooksService.getVolumeDetails('vol-1')).rejects.toThrow('Google Books API error: 500');
  });
});
