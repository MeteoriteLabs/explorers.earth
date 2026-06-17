import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateRandomFileName,
  generateProfileUploadPath,
  generateFeedUploadPath,
  generateLocationThumbnailPath,
  generateRecommendationUploadPath,
  generateGuideUploadPath,
  generateActivityPhotoPath,
  generateMovieUploadPath,
  generateMovieListCoverPath,
  generateBookUploadPath,
  generateBookListCoverPath,
  generateGameListCoverPath,
  generateGameUploadPath,
  sanitizeUsername,
  sanitizeIdentifier
} from '../uploadPathGenerator';

describe('uploadPathGenerator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── generateRandomFileName ─────────────────────────────────────────────────
  describe('generateRandomFileName', () => {
    it('generates a random filename with default jpg extension', () => {
      const filename = generateRandomFileName();
      expect(filename).toMatch(/^\d+-[a-z0-9]{6}\.jpg$/);
    });

    it('uses provided extension', () => {
      const filename = generateRandomFileName(undefined, 'png');
      expect(filename).toMatch(/^\d+-[a-z0-9]{6}\.png$/);
    });

    it('extracts extension from original name', () => {
      const filename = generateRandomFileName('my-vacation.jpeg');
      expect(filename).toMatch(/^\d+-[a-z0-9]{6}\.jpeg$/);
    });

    it('defaults to jpg if original name has no extension', () => {
      const filename = generateRandomFileName('my-vacation');
      expect(filename).toMatch(/^\d+-[a-z0-9]{6}\.jpg$/);
    });
  });

  // ── Path Generators ────────────────────────────────────────────────────────
  describe('Path Generators', () => {
    const filename = '1735689600000-abc123.jpg';

    it('generateProfileUploadPath generates correct path', () => {
      const path = generateProfileUploadPath('JohnDoe', 'profile', filename);
      expect(path).toBe('johndoe/profile/1735689600000-abc123.jpg');
    });

    it('generateFeedUploadPath generates correct path', () => {
      const path = generateFeedUploadPath('JohnDoe', 'images', filename);
      expect(path).toBe('johndoe/feed/images/1735689600000-abc123.jpg');
    });

    it('generateLocationThumbnailPath generates correct directory path', () => {
      const path = generateLocationThumbnailPath('JohnDoe');
      expect(path).toBe('johndoe/locations');
    });

    it('generateRecommendationUploadPath generates correct path', () => {
      const path = generateRecommendationUploadPath('JohnDoe', 'list_123', 'place_456', filename);
      expect(path).toBe('johndoe/list_123/place_456/1735689600000-abc123.jpg');
    });

    it('generateGuideUploadPath generates correct path', () => {
      const path = generateGuideUploadPath('JohnDoe', 'guide-123', filename);
      expect(path).toBe('johndoe/guides/guide-123/1735689600000-abc123.jpg');
    });

    it('generateActivityPhotoPath generates correct path', () => {
      const path = generateActivityPhotoPath('JohnDoe', 'sec-1', 'place-1', filename);
      expect(path).toBe('johndoe/guides/sections/sec-1/activities/place-1/1735689600000-abc123.jpg');
    });

    it('generateMovieUploadPath generates correct path', () => {
      const path = generateMovieUploadPath('JohnDoe', 'list1', 'tmdb1', filename);
      expect(path).toBe('johndoe/movies/list1/tmdb1/1735689600000-abc123.jpg');
    });

    it('generateMovieListCoverPath generates correct path', () => {
      const path = generateMovieListCoverPath('JohnDoe', 'list1', filename);
      expect(path).toBe('johndoe/movies/list1/cover/1735689600000-abc123.jpg');
    });

    it('generateBookUploadPath generates correct path', () => {
      const path = generateBookUploadPath('JohnDoe', 'list1', 'vol1', filename);
      expect(path).toBe('johndoe/books/list1/vol1/1735689600000-abc123.jpg');
    });

    it('generateBookListCoverPath generates correct path', () => {
      const path = generateBookListCoverPath('JohnDoe', 'list1', filename);
      expect(path).toBe('johndoe/books/list1/cover/1735689600000-abc123.jpg');
    });

    it('generateGameUploadPath generates correct path', () => {
      const path = generateGameUploadPath('JohnDoe', 'list1', 'igdb1', filename);
      expect(path).toBe('johndoe/games/list1/igdb1/1735689600000-abc123.jpg');
    });

    it('generateGameListCoverPath generates correct path', () => {
      const path = generateGameListCoverPath('JohnDoe', 'list1', filename);
      expect(path).toBe('johndoe/games/list1/cover/1735689600000-abc123.jpg');
    });
  });

  // ── Sanitization ───────────────────────────────────────────────────────────
  describe('Sanitization', () => {
    it('sanitizeUsername converts to lowercase and handles invalid chars', () => {
      expect(sanitizeUsername('JohnDoe!')).toBe('johndoe');
      expect(sanitizeUsername('user@name')).toBe('user-name');
      expect(sanitizeUsername('my--name')).toBe('my-name');
      expect(sanitizeUsername('-name-')).toBe('name');
    });

    it('sanitizeIdentifier handles invalid chars and preserves case', () => {
      expect(sanitizeIdentifier('Place_123!')).toBe('Place_123');
      expect(sanitizeIdentifier('list@#$123')).toBe('list-123');
      expect(sanitizeIdentifier('my--id')).toBe('my-id');
      expect(sanitizeIdentifier('-id-')).toBe('id');
    });
  });
});
