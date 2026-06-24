import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTMDBSearch } from '../hooks/useTMDBSearch';
import tmdbService, { TMDBError } from '../../../services/tmdbService';

vi.mock('../../../services/tmdbService', () => ({
  default: {
    searchMulti: vi.fn(),
  },
  TMDBError: class TMDBError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'TMDBError';
    }
  }
}));

describe('useTMDBSearch hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty results immediately for empty query', () => {
    const { result } = renderHook(() => useTMDBSearch('   '));
    
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(tmdbService.searchMulti).not.toHaveBeenCalled();
  });

  it('debounces and fetches data', async () => {
    const mockResults = [{ id: 1, title: 'Batman' }];
    (tmdbService.searchMulti as any).mockResolvedValue(mockResults);

    const { result } = renderHook(() => useTMDBSearch('batman'));

    // Initially loading should be false because of debounce
    expect(result.current.loading).toBe(false);

    // Fast-forward debounce timer (300ms)
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(tmdbService.searchMulti).toHaveBeenCalledWith('batman');
    
    // Fast-forward promises
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.results).toEqual(mockResults);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('handles TMDBError gracefully', async () => {
    (tmdbService.searchMulti as any).mockRejectedValue(new TMDBError('TMDB failure'));

    const { result } = renderHook(() => useTMDBSearch('batman'));

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(result.current.error).toBe('TMDB failure');
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('handles generic error gracefully', async () => {
    (tmdbService.searchMulti as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTMDBSearch('batman'));

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve(); // Allow microtasks to resolve promise rejections
      await Promise.resolve(); // Additional tick to let state updates settle
    });

    expect(result.current.error).toBe('Search failed. Please try again.');
    expect(result.current.results).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});
