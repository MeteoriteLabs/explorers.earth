import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import useTrackAnalytics, { createAnalyticsOptions, getAccountIdFromUsername } from '../analyticsService';
import useAuthStore from '../../store/store';
import * as apollo from '@apollo/client';
import * as urlHelpers from '../../utils/urlHelpers';

const transportHarness = vi.hoisted(() => ({
  transport: { request: vi.fn() },
  capabilities: {
    publicRead: 'public-read-capability',
    analyticsWrite: 'analytics-write-capability',
  },
  createApolloTransport: vi.fn(),
  resolveBrowserApolloCapabilities: vi.fn(),
}));

vi.mock('../../lib/apolloTransport', () => ({
  createApolloTransport: transportHarness.createApolloTransport.mockReturnValue(transportHarness.transport),
  resolveBrowserApolloCapabilities: transportHarness.resolveBrowserApolloCapabilities.mockReturnValue(transportHarness.capabilities),
}));

// Mock Apollo Client
vi.mock('@apollo/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@apollo/client')>();
  return {
    ...actual,
    useMutation: vi.fn(),
    ApolloClient: vi.fn(),
    InMemoryCache: vi.fn(),
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

    global.fetch = vi.fn(() => {
      throw new Error('analytics must not call third-party IP discovery');
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
        autoTrackView: true,
        routeVariant: 'profile',
        routePath: '/john',
      });
    });

    it('creates home options correctly', () => {
      const options = createAnalyticsOptions.home('doc123', 'john', 'loc123', 'rec123', 'Paris', {
        variant: 'detail',
        path: '/john/places/paris',
      });
      expect(options).toEqual({
        accountId: 'doc123',
        locationId: 'loc123',
        recommendationId: 'rec123',
        pageName: 'public-home',
        pageUsername: 'john',
        autoTrackView: true,
        cityName: 'Paris',
        routeVariant: 'detail',
        routePath: '/john/places/paris',
      });
    });

    it('creates complete music route metadata without changing the Music surface', () => {
      expect(createAnalyticsOptions.music('doc123', 'john')).toMatchObject({
        accountId: 'doc123',
        pageName: 'public-music',
        pageUsername: 'john',
        routeVariant: 'index',
        routePath: '/john/music',
      });
    });

    // ... similarly for others, just test one more
    it('creates movies options correctly', () => {
      const options = createAnalyticsOptions.movies('doc123', 'john', 'list1', 'movie1');
      expect(options.pageName).toBe('public-movies');
      expect(options.locationId).toBe('list1');
      expect(options.recommendationId).toBe('movie1');
    });

    it.each([
      ['apps', 'public-apps'],
      ['products', 'public-products'],
      ['people', 'public-people'],
    ] as const)('creates stable-ID %s options for index and nested routes', (factoryName, pageName) => {
      const factory = createAnalyticsOptions[factoryName];

      expect(factory('acct-1', 'alice')).toMatchObject({
        accountId: 'acct-1',
        locationId: null,
        recommendationId: null,
        pageName,
        pageUsername: 'alice',
        autoTrackView: true,
        routeVariant: 'index',
        routePath: `/alice/${factoryName}`,
      });
      expect(factory('acct-1', 'alice', `${factoryName}-list-1`, undefined, {
        variant: 'list',
        path: `/alice/${factoryName}/favorites`,
      })).toMatchObject({
        locationId: `${factoryName}-list-1`,
        routeVariant: 'list',
        routePath: `/alice/${factoryName}/favorites`,
      });
    });

    it('creates guide detail options and nested taxonomy options with stable document IDs', () => {
      expect(createAnalyticsOptions.guides('acct-1', 'alice', 'guide-doc-1', {
        variant: 'detail',
        path: '/alice/guides/europe-trip',
      })).toMatchObject({
        accountId: 'acct-1',
        recommendationId: 'guide-doc-1',
        pageName: 'public-guides',
        routeVariant: 'detail',
        routePath: '/alice/guides/europe-trip',
      });

      expect(createAnalyticsOptions.movies('acct-1', 'alice', 'genre-doc-1', undefined, {
        variant: 'filter',
        path: '/alice/movies/genre/comedy',
      })).toMatchObject({
        locationId: 'genre-doc-1',
        routeVariant: 'filter',
        routePath: '/alice/movies/genre/comedy',
      });
    });
  });

  // ── useTrackAnalytics ────────────────────────────────────────────────────
  describe('useTrackAnalytics', () => {
    it('uses the shared transport with the analytics-write capability', () => {
      expect(transportHarness.resolveBrowserApolloCapabilities).toHaveBeenCalledWith(import.meta.env);
      expect(transportHarness.createApolloTransport).toHaveBeenCalledWith({
        uri: import.meta.env.VITE_API_URL,
        getSessionToken: expect.any(Function),
        capabilities: transportHarness.capabilities,
      });
      expect(apollo.ApolloClient).toHaveBeenCalledWith(expect.objectContaining({
        link: transportHarness.transport,
      }));
    });

    it('auto-tracks view on mount', async () => {
      renderHook(() => useTrackAnalytics({
        accountId: 'acc1',
        pageName: 'public-profile',
        autoTrackView: true
      }));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

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

    it('tracks one view for an authenticated non-owner', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: '2', documentId: 'acc2', username: 'bob', email: 'b', blocked: false }
      });

      renderHook(() => useTrackAnalytics({
        accountId: 'acc1',
        pageName: 'public-apps',
        pageUsername: 'alice',
        autoTrackView: true
      }));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockCreateAnalytic).toHaveBeenCalledTimes(1);
      expect(mockCreateAnalytic.mock.calls[0][0].variables.data.Stats[0].type).toBe('view');
    });

    it('tracks each same-mounted Places pathname identity once while ignoring rerenders, query/hash, and city changes', async () => {
      const wrapper = ({ children }: { children: ReactNode }) => createElement(
        MemoryRouter,
        { initialEntries: ['/alice/places'] },
        children,
      );
      const { result, rerender } = renderHook(
        ({ cityId, cityName }) => {
          const location = useLocation();
          const navigate = useNavigate();
          useTrackAnalytics({
            accountId: 'acc1',
            locationId: cityId,
            pageName: 'public-home',
            pageUsername: 'alice',
            autoTrackView: true,
            waitForLocation: true,
            cityName,
            routeVariant: location.pathname === '/alice/places' ? 'index' : 'detail',
            routePath: location.pathname,
          });
          return { navigate };
        },
        {
          wrapper,
          initialProps: { cityId: 'city-doc-1', cityName: 'Paris' },
        },
      );

      await act(async () => { await vi.runAllTimersAsync(); });
      expect(mockCreateAnalytic).toHaveBeenCalledTimes(1);

      rerender({ cityId: 'city-doc-1', cityName: 'Paris' });
      await act(async () => { await vi.runAllTimersAsync(); });
      act(() => result.current.navigate('/alice/places?utm_source=qa#top'));
      await act(async () => { await vi.runAllTimersAsync(); });
      rerender({ cityId: 'city-doc-2', cityName: 'Rome' });
      await act(async () => { await vi.runAllTimersAsync(); });
      expect(mockCreateAnalytic).toHaveBeenCalledTimes(1);

      act(() => result.current.navigate('/alice/places/paris'));
      await act(async () => { await vi.runAllTimersAsync(); });
      expect(mockCreateAnalytic).toHaveBeenCalledTimes(2);

      act(() => result.current.navigate('/alice/places/paris?tab=guides#details'));
      await act(async () => { await vi.runAllTimersAsync(); });
      act(() => result.current.navigate('/alice/places/rome'));
      await act(async () => { await vi.runAllTimersAsync(); });
      act(() => result.current.navigate('/alice/places'));
      await act(async () => { await vi.runAllTimersAsync(); });
      act(() => result.current.navigate('/alice/places/paris'));
      await act(async () => { await vi.runAllTimersAsync(); });

      expect(mockCreateAnalytic).toHaveBeenCalledTimes(3);
      expect(mockCreateAnalytic.mock.calls.map((call) => call[0].variables.data.Stats[0].metadata)).toEqual([
        expect.objectContaining({ routeVariant: 'index', routePath: '/alice/places' }),
        expect.objectContaining({ routeVariant: 'detail', routePath: '/alice/places/paris' }),
        expect.objectContaining({ routeVariant: 'detail', routePath: '/alice/places/rome' }),
      ]);
    });

    it('uses current owner auth when a same-mounted Places route becomes trackable', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: '2', documentId: 'acc2', username: 'bob', email: 'b', blocked: false }
      });
      const wrapper = ({ children }: { children: ReactNode }) => createElement(
        MemoryRouter,
        { initialEntries: ['/alice/places'] },
        children,
      );
      const { result } = renderHook(() => {
        const location = useLocation();
        const navigate = useNavigate();
        useTrackAnalytics({
          accountId: 'acc1',
          locationId: 'city-doc-1',
          pageName: 'public-home',
          pageUsername: 'alice',
          autoTrackView: true,
          waitForLocation: true,
          routeVariant: location.pathname === '/alice/places' ? 'index' : 'detail',
          routePath: location.pathname,
        });
        return { navigate };
      }, { wrapper });

      await act(async () => { await vi.runAllTimersAsync(); });
      expect(mockCreateAnalytic).toHaveBeenCalledTimes(1);

      act(() => {
        useAuthStore.setState({
          isAuthenticated: true,
          user: { id: '1', documentId: 'acc1', username: 'alice', email: 'a', blocked: false }
        });
        result.current.navigate('/alice/places/paris');
      });
      await act(async () => { await vi.runAllTimersAsync(); });
      expect(mockCreateAnalytic).toHaveBeenCalledTimes(1);

      act(() => {
        useAuthStore.setState({
          isAuthenticated: true,
          user: { id: '2', documentId: 'acc2', username: 'bob', email: 'b', blocked: false }
        });
      });
      await act(async () => { await vi.runAllTimersAsync(); });

      expect(mockCreateAnalytic).toHaveBeenCalledTimes(2);
      expect(mockCreateAnalytic.mock.calls[1][0].variables.data.Stats[0].metadata).toEqual(
        expect.objectContaining({ routeVariant: 'detail', routePath: '/alice/places/paris' }),
      );
    });

    it('uses the current owner identity after render when suppressing clicks', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        user: { id: '2', documentId: 'acc2', username: 'bob', email: 'b', blocked: false }
      });
      const { result } = renderHook(() => useTrackAnalytics({
        accountId: 'acc1',
        pageName: 'public-apps',
        pageUsername: 'alice',
        autoTrackView: false
      }));

      act(() => {
        useAuthStore.setState({
          isAuthenticated: true,
          user: { id: '1', documentId: 'acc1', username: 'alice', email: 'a', blocked: false }
        });
      });
      act(() => {
        result.current.trackClick('app-card', { id: 'app-doc-1' });
      });
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockCreateAnalytic).not.toHaveBeenCalled();
    });

    it('deduplicates each stable card click independently within the session', async () => {
      const { result } = renderHook(() => useTrackAnalytics({
        accountId: 'acc1',
        pageName: 'public-apps',
        pageUsername: 'alice',
        autoTrackView: false,
        routeVariant: 'index',
        routePath: '/alice/apps',
      }));

      await act(async () => {
        result.current.trackClick('app-card', { id: 'app-doc-1', title: 'First' });
        await vi.runAllTimersAsync();
      });
      await act(async () => {
        result.current.trackClick('app-card', { id: 'app-doc-1', title: 'First' });
        result.current.trackClick('app-card', { id: 'app-doc-2', title: 'Second' });
        await vi.runAllTimersAsync();
      });

      expect(mockCreateAnalytic).toHaveBeenCalledTimes(2);
      expect(mockCreateAnalytic.mock.calls.map((call) => call[0].variables.data.Recommendation_Id)).toEqual([
        'app-doc-1',
        'app-doc-2',
      ]);
      expect(mockCreateAnalytic.mock.calls.map((call) => call[0].variables.data.Stats[0].element)).toEqual([
        'app-card',
        'app-card',
      ]);
      expect(mockCreateAnalytic.mock.calls.map((call) => call[0].variables.data.Stats[0].metadata)).toEqual([
        expect.objectContaining({ routeVariant: 'index', routePath: '/alice/apps' }),
        expect.objectContaining({ routeVariant: 'index', routePath: '/alice/apps' }),
      ]);
    });

    it('allows a new event immediately after session storage is reset', async () => {
      const { result } = renderHook(() => useTrackAnalytics({
        accountId: 'acc1',
        pageName: 'public-products',
        pageUsername: 'alice',
        autoTrackView: false
      }));

      await act(async () => {
        result.current.trackClick('product-card', { id: 'product-doc-1' });
        await vi.runAllTimersAsync();
      });
      sessionStorage.clear();
      await act(async () => {
        result.current.trackClick('product-card', { id: 'product-doc-1' });
        await vi.runAllTimersAsync();
      });

      expect(mockCreateAnalytic).toHaveBeenCalledTimes(2);
    });

    it('does not write analytics payloads to the browser debug console', async () => {
      const debugLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      renderHook(() => useTrackAnalytics({
        accountId: 'acc1',
        pageName: 'public-people',
        pageUsername: 'alice',
        autoTrackView: true
      }));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(mockCreateAnalytic).toHaveBeenCalledTimes(1);
      expect(debugLog).not.toHaveBeenCalled();
    });

    it('deduplicates rapid events of the same type', async () => {
      const { result } = renderHook(() => useTrackAnalytics({
        accountId: 'acc1',
        pageName: 'custom-page',
        autoTrackView: false
      }));

      await act(async () => {
        result.current.trackClick('btn-1');
        result.current.trackClick('btn-1');
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

    it('includes UTM params without discovering or sending a browser-supplied IP address', async () => {
      (urlHelpers.extractUtmParamsFromCurrentUrl as any).mockReturnValue({ utm_source: 'twitter' });
      
      const { result } = renderHook(() => useTrackAnalytics({
        accountId: 'acc1',
        pageName: 'custom-page',
        autoTrackView: false
      }));

      await act(async () => {
        result.current.trackView();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      const callArgs = mockCreateAnalytic.mock.calls[0][0].variables.data;
      expect(global.fetch).not.toHaveBeenCalled();
      expect(callArgs.Stats[0]).not.toHaveProperty('ipAddress');
      expect(callArgs.Stats[0].utmParams).toEqual({ utm_source: 'twitter' });
    });
  });
});
