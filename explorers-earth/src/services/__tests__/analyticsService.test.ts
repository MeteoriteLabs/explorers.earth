import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTrackAnalytics, { createAnalyticsOptions, getAccountIdFromUsername } from '../analyticsService';
import useAuthStore from '../../store/store';
import * as apollo from '@apollo/client';
import * as urlHelpers from '../../utils/urlHelpers';

// Mock Apollo Client
vi.mock('@apollo/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apollo/client')>();
  return {
    ...actual,
    useMutation: vi.fn(),
    ApolloClient: vi.fn(),
    InMemoryCache: vi.fn(),
    createHttpLink: vi.fn(),
  };
});

// Mock urlHelpers
vi.mock('../../utils/urlHelpers', () => ({
  extractUtmParamsFromCurrentUrl: vi.fn(() => ({})),
}));

describe('analyticsService', () => {
  const mockCreateAnalytic = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    mockCreateAnalytic.mockClear();

    // Setup Apollo mock
    mockCreateAnalytic.mockResolvedValue({ data: { createPublicPageAnalytic: { documentId: '123' } } });
    (apollo.useMutation as any).mockReturnValue([mockCreateAnalytic]);

    // Setup global fetch mock for IP address
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ip: '192.168.1.1' }),
    });

    // Clear session storage
    sessionStorage.clear();

    // Reset Auth Store
    useAuthStore.setState({ isAuthenticated: false, user: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── getAccountIdFromUsername ─────────────────────────────────────────────
  describe('getAccountIdFromUsername', () => {
    it('returns the username as account ID', async () => {
      const result = await getAccountIdFromUsername('testuser');
      expect(result).toBe('testuser');
    });
  });

  // ── createAnalyticsOptions ───────────────────────────────────────────────
  describe('createAnalyticsOptions', () => {
    it('creates profile options correctly', () => {
      const options = createAnalyticsOptions.profile('doc123', 'john');
      expect(options).toEqual({
        accountId: 'doc123',
        pageName: 'public-profile',
        pageUsername: 'john',
        autoTrackView: true
      });
    });

    it('creates home options correctly', () => {
      const options = createAnalyticsOptions.home('doc123', 'john', 'loc123', 'rec123', 'Paris');
      expect(options).toEqual({
        accountId: 'doc123',
        locationId: 'loc123',
        recommendationId: 'rec123',
        pageName: 'public-home',
        pageUsername: 'john',
        autoTrackView: true,
        cityName: 'Paris'
      });
    });

    // ... similarly for others, just test one more
    it('creates movies options correctly', () => {
      const options = createAnalyticsOptions.movies('doc123', 'john', 'list1', 'movie1');
      expect(options.pageName).toBe('public-movies');
      expect(options.locationId).toBe('list1');
      expect(options.recommendationId).toBe('movie1');
    });
  });

  // ── useTrackAnalytics ────────────────────────────────────────────────────
  describe('useTrackAnalytics', () => {
    it('auto-tracks view on mount', async () => {
      renderHook(() => useTrackAnalytics({
        accountId: 'acc1',
        pageName: 'public-profile',
        autoTrackView: true
      }));

      // Advance timers if necessary or wait for async IP fetch
      await vi.runAllTimersAsync();

      expect(mockCreateAnalytic).toHaveBeenCalledTimes(1);
      const callArgs = mockCreateAnalytic.mock.calls[0][0].variables.data;
      expect(callArgs.Account_Id).toBe('acc1');
      expect(callArgs.Stats[0].type).toBe('view');
    });

    it('skips tracking if user is visiting their own page', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: '1', documentId: 'acc1', username: 'john', email: 'e', blocked: false }
      });

      renderHook(() => useTrackAnalytics({
        accountId: 'acc1',
        pageName: 'public-profile',
        pageUsername: 'john',
        autoTrackView: true
      }));

      await vi.runAllTimersAsync();

      expect(mockCreateAnalytic).not.toHaveBeenCalled();
    });

    it('debounces rapid events of same type', async () => {
      const { result } = renderHook(() => useTrackAnalytics({
        accountId: 'acc1',
        pageName: 'custom-page',
        autoTrackView: false
      }));

      await act(async () => {
        result.current.trackClick('btn-1');
        result.current.trackClick('btn-1'); // should be debounced
      });

      await vi.runAllTimersAsync();

      expect(mockCreateAnalytic).toHaveBeenCalledTimes(1);
    });

    it('allows different events to pass debounce', async () => {
      const { result } = renderHook(() => useTrackAnalytics({
        accountId: 'acc1',
        pageName: 'custom-page',
        autoTrackView: false
      }));

      await act(async () => {
        result.current.trackClick('place-card-1');
        result.current.trackClick('place-card-2'); 
      });

      await vi.runAllTimersAsync();

      expect(mockCreateAnalytic).toHaveBeenCalledTimes(2);
    });

    it('tracks interaction events', async () => {
      const { result } = renderHook(() => useTrackAnalytics({
        accountId: 'acc1',
        pageName: 'custom-page',
        autoTrackView: false
      }));

      await act(async () => {
        result.current.trackInteraction('scroll');
      });

      await vi.runAllTimersAsync();

      expect(mockCreateAnalytic).toHaveBeenCalledTimes(1);
      const callArgs = mockCreateAnalytic.mock.calls[0][0].variables.data;
      expect(callArgs.Stats[0].type).toBe('interaction');
      expect(callArgs.Stats[0].element).toBe('scroll');
    });

    it('includes UTM params and IP address in payload', async () => {
      (urlHelpers.extractUtmParamsFromCurrentUrl as any).mockReturnValue({ utm_source: 'twitter' });
      
      const { result } = renderHook(() => useTrackAnalytics({
        accountId: 'acc1',
        pageName: 'custom-page',
        autoTrackView: false
      }));

      await act(async () => {
        result.current.trackView();
      });

      await vi.runAllTimersAsync();

      const callArgs = mockCreateAnalytic.mock.calls[0][0].variables.data;
      expect(callArgs.Stats[0].ipAddress).toBe('192.168.1.1');
      expect(callArgs.Stats[0].utmParams).toEqual({ utm_source: 'twitter' });
    });
  });
});
