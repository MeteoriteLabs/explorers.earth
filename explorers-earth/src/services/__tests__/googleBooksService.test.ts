import { describe, it, expect, vi, beforeEach } from 'vitest';
import googleBooksService, { GoogleBooksItem } from '../googleBooksService';

describe('googleBooksService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API fetch wrappers', () => {
    it('searchBooks calls fetch with correct URL', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [{ id: '1' }] }),
      });

      const result = await googleBooksService.searchBooks('harry potter');
      
      expect(fetch).toHaveBeenCalledTimes(1);
      const url = new URL((global.fetch as any).mock.calls[0][0]);
      expect(url.pathname).toBe('/books/v1/volumes');
      expect(url.searchParams.get('q')).toBe('harry potter');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('searchBooks formats ISBN correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] }),
      });

      await googleBooksService.searchBooks('978-3-16-148410-0');
      
      const url = new URL((global.fetch as any).mock.calls[0][0]);
      expect(url.searchParams.get('q')).toBe('isbn:9783161484100');
    });

    it('searchBooks returns empty array on empty query', async () => {
      global.fetch = vi.fn();
      const result = await googleBooksService.searchBooks('   ');
      expect(result).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('searchBooks throws on error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(googleBooksService.searchBooks('test')).rejects.toThrow('Google Books API error: 404 Not Found');
    });

    it('getVolumeDetails calls fetch with correct URL', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: '123' }),
      });

      const result = await googleBooksService.getVolumeDetails('123');
      
      expect(fetch).toHaveBeenCalledTimes(1);
      const url = new URL((global.fetch as any).mock.calls[0][0]);
      expect(url.pathname).toBe('/books/v1/volumes/123');
      expect(result.id).toBe('123');
    });
  });

  describe('Utility functions', () => {
    it('upgradeToHttps upgrades HTTP to HTTPS', () => {
      expect(googleBooksService.upgradeToHttps('http://example.com/image.jpg')).toBe('https://example.com/image.jpg');
      expect(googleBooksService.upgradeToHttps('https://example.com/image.jpg')).toBe('https://example.com/image.jpg');
      expect(googleBooksService.upgradeToHttps('')).toBe('');
    });

    it('extractYear extracts YYYY from date strings', () => {
      expect(googleBooksService.extractYear('2023-05-12')).toBe('2023');
      expect(googleBooksService.extractYear('1999-01')).toBe('1999');
      expect(googleBooksService.extractYear('1984')).toBe('1984');
      expect(googleBooksService.extractYear(undefined)).toBe('');
    });

    it('formatAuthors formats author arrays', () => {
      expect(googleBooksService.formatAuthors(undefined)).toBe('Unknown Author');
      expect(googleBooksService.formatAuthors([])).toBe('Unknown Author');
      expect(googleBooksService.formatAuthors(['J.K. Rowling'])).toBe('J.K. Rowling');
      expect(googleBooksService.formatAuthors(['Author 1', 'Author 2'])).toBe('Author 1 & Author 2');
      expect(googleBooksService.formatAuthors(['Auth 1', 'Auth 2', 'Auth 3'])).toBe('Auth 1 et al.');
    });

    it('extractIsbn prioritizes ISBN_13', () => {
      const vi13 = { title: 'Fixture', industryIdentifiers: [{ type: 'ISBN_13', identifier: '131313' }, { type: 'ISBN_10', identifier: '101010' }] };
      expect(googleBooksService.extractIsbn(vi13)).toBe('131313');

      const vi10 = { title: 'Fixture', industryIdentifiers: [{ type: 'ISBN_10', identifier: '101010' }] };
      expect(googleBooksService.extractIsbn(vi10)).toBe('101010');

      const viEmpty = { title: 'Fixture', industryIdentifiers: [] };
      expect(googleBooksService.extractIsbn(viEmpty)).toBe('');
    });
  });

  describe('transformVolumeToBook', () => {
    it('transforms a full GoogleBooksItem', () => {
      const item: GoogleBooksItem = {
        id: 'vol_123',
        volumeInfo: {
          title: 'Great Book',
          subtitle: 'An Epic',
          authors: ['John Doe'],
          publishedDate: '2020-01-01',
          description: 'A great description.',
          pageCount: 300,
          categories: ['Fiction'],
          averageRating: 4.5,
          imageLinks: { thumbnail: 'http://example.com/thumb.jpg', small: 'http://example.com/small.jpg' },
          industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780000000000' }],
          publisher: 'Penguin',
          previewLink: 'http://preview.com',
        },
        saleInfo: { buyLink: 'http://buy.com' }
      };

      const mapped = googleBooksService.transformVolumeToBook(item);

      expect(mapped.volume_id).toBe('vol_123');
      expect(mapped.title).toBe('Great Book');
      expect(mapped.subtitle).toBe('An Epic');
      expect(mapped.authors).toEqual(['John Doe']);
      expect(mapped.year).toBe('2020');
      expect(mapped.cover_url).toBe('https://example.com/small.jpg');
      expect(mapped.cover_url_large).toBe('https://example.com/thumb.jpg');
      expect(mapped.subjects).toEqual(['Fiction']);
      expect(mapped.publisher).toBe('Penguin');
      expect(mapped.page_count).toBe(300);
      expect(mapped.google_rating).toBe(4.5);
      expect(mapped.description).toBe('A great description.');
      expect(mapped.isbn_13).toBe('9780000000000');
      expect(mapped.preview_link).toBe('http://preview.com');
      expect(mapped.google_books_buy_link).toBe('http://buy.com');
    });
  });
});
