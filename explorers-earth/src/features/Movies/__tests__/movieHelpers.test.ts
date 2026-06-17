import { describe, it, expect } from 'vitest';
import {
  buildImageUrl,
  buildPosterUrl,
  buildBackdropUrl,
  buildLogoUrl,
  extractYear,
  genreToSlug,
  slugToGenreName,
  extractUniqueGenres,
  parseGenres,
  getGenreNames,
  generateSlug,
  formatRuntime,
  formatRating,
  extractNoteText,
  deduplicateMovies,
} from '../utils/movieHelpers';

describe('movieHelpers', () => {
  describe('URL builders', () => {
    it('builds image URLs', () => {
      expect(buildImageUrl('/test.jpg', 'w500')).toBe('https://image.tmdb.org/t/p/w500/test.jpg');
      expect(buildImageUrl('https://ext.com/img.jpg', 'w500')).toBe('https://ext.com/img.jpg');
      expect(buildImageUrl(null, 'w500')).toBe('');
    });

    it('builds specific URLs with defaults', () => {
      expect(buildPosterUrl('/poster.jpg')).toBe('https://image.tmdb.org/t/p/w342/poster.jpg');
      expect(buildBackdropUrl('/bg.jpg')).toBe('https://image.tmdb.org/t/p/w780/bg.jpg');
      expect(buildLogoUrl('/logo.jpg')).toBe('https://image.tmdb.org/t/p/w92/logo.jpg');
    });
  });

  describe('extractYear', () => {
    it('extracts year from date string', () => {
      expect(extractYear('2024-01-01')).toBe('2024');
      expect(extractYear(null)).toBe('');
    });
  });

  describe('Genre helpers', () => {
    it('converts genre to slug', () => {
      expect(genreToSlug('Sci-Fi & Fantasy')).toBe('sci-fi-fantasy');
      expect(genreToSlug('Action')).toBe('action');
    });

    it('converts slug to genre name', () => {
      expect(slugToGenreName('sci-fi-fantasy')).toBe('Sci Fi Fantasy'); // capitalization and space replacement
    });

    it('extracts unique genres', () => {
      const arr1 = [{ id: 1, name: 'Action' }, { id: 2, name: 'Drama' }];
      const arr2 = [{ id: 1, name: 'Action' }, { id: 3, name: 'Comedy' }];
      const arr3 = ['Drama', 'Thriller'] as any;
      
      const unique = extractUniqueGenres([arr1, arr2, arr3]);
      expect(unique).toEqual(['Action', 'Comedy', 'Drama', 'Thriller']); // sorted alphabetically
    });

    it('parses genres', () => {
      expect(parseGenres([{ id: 1, name: 'Action' }])).toEqual([{ id: 1, name: 'Action' }]);
      expect(parseGenres(['Action'])).toEqual([{ id: 0, name: 'Action' }]);
      expect(parseGenres(null)).toEqual([]);
    });

    it('gets genre names', () => {
      expect(getGenreNames([{ id: 1, name: 'Action' }, 'Comedy'])).toEqual(['Action', 'Comedy']);
    });
  });

  describe('generateSlug', () => {
    it('generates a clean slug', () => {
      expect(generateSlug('The Batman: Part II')).toBe('the-batman-part-ii');
      expect(generateSlug('  Hello_World  --- ')).toBe('hello-world');
    });
  });

  describe('format helpers', () => {
    it('formats runtime', () => {
      expect(formatRuntime(125)).toBe('2h 5m');
      expect(formatRuntime(60)).toBe('1h');
      expect(formatRuntime(45)).toBe('45m');
      expect(formatRuntime(null)).toBe('');
    });

    it('formats rating', () => {
      expect(formatRating(8.123)).toBe('8.1');
      expect(formatRating(null)).toBe('');
    });
  });

  describe('extractNoteText', () => {
    it('extracts from string', () => {
      expect(extractNoteText('test')).toBe('test');
    });

    it('extracts from blocks', () => {
      const blocks = [
        { children: [{ text: 'Hello ' }, { text: 'World' }] },
        { children: [{ text: 'New line' }] }
      ];
      expect(extractNoteText(blocks)).toBe('Hello World\nNew line');
    });

    it('handles empty', () => {
      expect(extractNoteText(null)).toBe('');
    });
  });

  describe('deduplicateMovies', () => {
    it('deduplicates by documentId', () => {
      const movies = [
        { documentId: '1', title: 'A' },
        { documentId: '2', title: 'B' },
        { documentId: '1', title: 'A' }, // duplicate
      ];
      expect(deduplicateMovies(movies)).toHaveLength(2);
      expect(deduplicateMovies(null)).toEqual([]);
    });
  });
});
