import { describe, it, expect } from 'vitest';
import {
  generateSlug,
  subjectToSlug,
  slugToSubjectName,
  extractUniqueSubjects,
  parseSubjects,
  formatRating,
  formatPageCount,
  formatAuthors,
  parseAuthors,
  extractNoteText,
  deduplicateBooks,
  buildCoverUrl,
} from '../utils/bookHelpers';

describe('bookHelpers', () => {
  describe('slug generation', () => {
    it('generates a clean slug', () => {
      expect(generateSlug('The Hobbit: An Unexpected Journey')).toBe('the-hobbit-an-unexpected-journey');
      expect(generateSlug('  Hello_World  --- ')).toBe('hello-world');
    });

    it('converts subject to slug', () => {
      expect(subjectToSlug('Sci-Fi & Fantasy')).toBe('sci-fi-fantasy');
    });

    it('converts slug to subject name', () => {
      expect(slugToSubjectName('sci-fi-fantasy')).toBe('Sci Fi Fantasy');
    });
  });

  describe('subject extractors', () => {
    it('extracts unique subjects', () => {
      const arr1 = ['Action', 'Drama'];
      const arr2 = ['Action', 'Comedy'];
      
      const unique = extractUniqueSubjects([arr1, arr2, null]);
      expect(unique).toEqual(['Action', 'Comedy', 'Drama']); // sorted
    });

    it('parses subjects', () => {
      expect(parseSubjects(['Action', 123, null])).toEqual(['Action']);
      expect(parseSubjects(null)).toEqual([]);
    });
  });

  describe('format helpers', () => {
    it('formats rating', () => {
      expect(formatRating(4.567)).toBe('4.6');
      expect(formatRating(null)).toBe('');
    });

    it('formats page count', () => {
      expect(formatPageCount(350)).toBe('350 pages');
      expect(formatPageCount(null)).toBe('');
    });

    it('formats authors', () => {
      expect(formatAuthors(null)).toBe('Unknown Author');
      expect(formatAuthors([])).toBe('Unknown Author');
      expect(formatAuthors(['J.R.R. Tolkien'])).toBe('J.R.R. Tolkien');
      expect(formatAuthors(['Author 1', 'Author 2'])).toBe('Author 1 & Author 2');
      expect(formatAuthors(['Auth 1', 'Auth 2', 'Auth 3'])).toBe('Auth 1 et al.');
    });

    it('parses authors', () => {
      expect(parseAuthors(['Author 1', 123])).toEqual(['Author 1']);
      expect(parseAuthors('Single Author')).toEqual(['Single Author']);
      expect(parseAuthors(null)).toEqual([]);
    });
  });

  describe('extractNoteText', () => {
    it('extracts from string', () => {
      expect(extractNoteText('test')).toBe('test');
    });

    it('extracts from blocks', () => {
      const blocks = [
        { children: [{ text: 'Hello ' }, { text: 'World' }] },
      ];
      expect(extractNoteText(blocks)).toBe('Hello World');
    });
  });

  describe('deduplicateBooks', () => {
    it('deduplicates by documentId', () => {
      const books = [
        { documentId: '1', title: 'A' },
        { documentId: '2', title: 'B' },
        { documentId: '1', title: 'A' },
      ];
      expect(deduplicateBooks(books)).toHaveLength(2);
      expect(deduplicateBooks(null)).toEqual([]);
    });
  });

  describe('buildCoverUrl', () => {
    it('returns as-is for http links', () => {
      expect(buildCoverUrl('http://example.com/cover.jpg')).toBe('http://example.com/cover.jpg');
    });

    it('prefixes strapi relative paths', () => {
      // VITE_REST_API_URL is typically not set in test environment, falling back to http://localhost:1337
      expect(buildCoverUrl('/uploads/cover.jpg')).toBe('http://localhost:1337/uploads/cover.jpg');
    });

    it('handles empty', () => {
      expect(buildCoverUrl(null)).toBe('');
    });
  });
});
