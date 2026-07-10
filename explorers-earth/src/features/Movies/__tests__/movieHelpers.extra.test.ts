import { describe, it, expect } from 'vitest';
import { formatRuntime, formatRating, buildBackdropUrl, extractYear } from '../utils/movieHelpers';

describe('movieHelpers Extra Cases', () => {
  it('should handle runtime formatting boundary cases', () => {
    expect(formatRuntime(undefined)).toBe('');
    expect(formatRuntime(null)).toBe('');
    expect(formatRuntime(45)).toBe('45m');
    expect(formatRuntime(120)).toBe('2h');
    expect(formatRuntime(135)).toBe('2h 15m');
  });

  it('should format ratings safely', () => {
    expect(formatRating(undefined)).toBe('');
    expect(formatRating(null)).toBe('');
    expect(formatRating(8.345)).toBe('8.3');
  });

  it('should generate empty string for empty backdrop paths', () => {
    expect(buildBackdropUrl(null)).toBe('');
    expect(buildBackdropUrl('')).toBe('');
  });
  
  it('should return external link backdrops unchanged', () => {
    const extUrl = 'https://images.tmdb.org/t/p/w1280/ext.jpg';
    expect(buildBackdropUrl(extUrl)).toBe(extUrl);
  });

  it('should extract years safely', () => {
    expect(extractYear(undefined)).toBe('');
    expect(extractYear('')).toBe('');
    expect(extractYear('2026-07-08')).toBe('2026');
  });
});
