import { gql, useMutation, ApolloClient, InMemoryCache } from "@apollo/client";
import { useCallback, useEffect, useState, useRef } from "react";
import { extractUtmParamsFromCurrentUrl, UTMParameters } from "../utils/urlHelpers";
import useAuthStore from "../store/store";
import {
  createApolloTransport,
  resolveBrowserApolloCapabilities,
} from "../lib/apolloTransport";

export const protectedQaRunMetadata = (): Record<string, string> => {
  const value = String(import.meta.env.VITE_PUBLIC_PROFILE_QA_RUN_ID ?? "");
  return /^qa[-_][a-z0-9_-]{1,64}$/i.test(value) ? { qaRunId: value } : {};
};

const analyticsClient = new ApolloClient({
  link: createApolloTransport({
    uri: import.meta.env.VITE_API_URL,
    getSessionToken: () => localStorage.getItem("qrtoken"),
    capabilities: resolveBrowserApolloCapabilities(import.meta.env),
  }),
  cache: new InMemoryCache(),
});

// GraphQL Mutations for Analytics
export const CREATE_PUBLIC_PAGE_ANALYTIC = gql`
  mutation CreatePublicPageAnalytic($data: PublicPageAnalyticInput!) {
    createPublicPageAnalytic(data: $data) {
      documentId
      Account_Id
      Location_Id
      Recommendation_Id
      Stats
    }
  }
`;


// Types for Analytics
export interface AnalyticsEvent {
  type: 'view' | 'click' | 'interaction';
  timestamp: string;
  page: string;
  element?: string;
  metadata?: Record<string, any>;
  utmParams?: UTMParameters; // Add UTM parameters to analytics events
}

export interface AnalyticsData {
  Account_Id: string;
  Location_Id?: string | null;
  Recommendation_Id?: string | null;
  Stats: AnalyticsEvent[];
}

export interface UseTrackAnalyticsOptions {
  accountId: string; // Should be documentId, not username
  locationId?: string | null; // Should be documentId, not name
  recommendationId?: string | null; // Should be documentId, not name
  pageName: string;
  pageUsername?: string; // Username from the URL (e.g., from useParams)
  autoTrackView?: boolean;
  waitForLocation?: boolean; // Wait for location to be set before auto-tracking view
  cityName?: string; // City name for public-home page analytics
  routeVariant?: AnalyticsRouteVariant;
  routePath?: string;
}

export type AnalyticsRouteVariant = "profile" | "index" | "list" | "filter" | "detail";

export type AnalyticsRouteMetadata = {
  variant: AnalyticsRouteVariant;
  path: string;
};

export interface UseTrackAnalyticsReturn {
  trackEvent: (event: Omit<AnalyticsEvent, 'timestamp' | 'page'>) => void;
  trackView: () => void;
  trackClick: (element: string, metadata?: Record<string, any>) => void;
  trackInteraction: (element: string, metadata?: Record<string, any>) => void;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook for tracking analytics events
 * Always creates new analytics records with session-based duplicate prevention
 */
export const useTrackAnalytics = (options: UseTrackAnalyticsOptions): UseTrackAnalyticsReturn => {
  const {
    accountId,
    locationId,
    recommendationId,
    pageName,
    pageUsername,
    autoTrackView = true,
    waitForLocation = false,
    cityName,
    routeVariant,
    routePath,
  } = options;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const trackingInProgress = useRef<Set<string>>(new Set());

  // Get authentication state and current user
  const { isAuthenticated, user } = useAuthStore();
  
  // Determine if tracking should be skipped
  // Skip tracking if:
  // 1. User is authenticated AND
  // 2. User is visiting their own public page (pageUsername matches authenticated user's username)
  const shouldSkipTracking = isAuthenticated && user?.username && pageUsername && user.username === pageUsername;

  // Mutation using analytics client with API token
  const [createAnalytic] = useMutation(CREATE_PUBLIC_PAGE_ANALYTIC, { client: analyticsClient });

  // Reset tracking state when page changes
  useEffect(() => {
    setHasTrackedView(false);
  }, [pageName, accountId, locationId, recommendationId, routeVariant, routePath]);

  // Auto-track view event on mount (only once per page load)
  // Skip if user is authenticated and visiting their own page
  useEffect(() => {
    if (autoTrackView && accountId && !hasTrackedView && !shouldSkipTracking) {
      // If waitForLocation is true, only track when locationId is available
      if (waitForLocation && !locationId) {
        return;
      }
      trackView();
      setHasTrackedView(true);
    }
  }, [accountId, autoTrackView, hasTrackedView, shouldSkipTracking, waitForLocation, locationId]);

  /**
   * Generate session key for this specific page and event type
   * For public-home page, use a route-specific key that ignores locationId changes
   */
  const getSessionKey = useCallback((eventType: string) => {
    // Places city selection can change locationId without changing route identity.
    if (pageName === 'public-home') {
      if (eventType === 'view') {
        return `analytics_${pageName}_${routeVariant || 'route'}_${routePath || 'path'}_${eventType}_${accountId}`;
      }
      return `analytics_${pageName}_${eventType}_${accountId}`;
    }
    // For other pages, include locationId and recommendationId
    return `analytics_${pageName}_${routeVariant || 'route'}_${routePath || 'path'}_${eventType}_${accountId}_${locationId || 'null'}_${recommendationId || 'null'}`;
  }, [pageName, routeVariant, routePath, accountId, locationId, recommendationId]);

  const getEventTypeToCheck = useCallback((event: Omit<AnalyticsEvent, 'timestamp' | 'page'>) => {
    if (event.type !== 'click' || !event.element) return event.type;

    const stableIdentifier =
      event.metadata?.id ??
      event.metadata?.recommendationDocumentId ??
      event.metadata?.recommendationId ??
      event.metadata?.platform ??
      event.metadata?.index ??
      event.metadata?.cityId;

    return stableIdentifier === undefined
      ? `click-${event.element}`
      : `click-${event.element}-${String(stableIdentifier)}`;
  }, []);

  /**
   * Check if event already exists in session storage
   */
  const isEventTrackedInSession = useCallback((eventType: string) => {
    const sessionKey = getSessionKey(eventType);
    return !!sessionStorage.getItem(sessionKey);
  }, [getSessionKey]);

  /**
   * Mark event as tracked in session storage
   */
  const markEventAsTracked = useCallback((eventType: string) => {
    const sessionKey = getSessionKey(eventType);
    sessionStorage.setItem(sessionKey, 'true');
  }, [getSessionKey]);

  /**
   * Generic event tracking function - always creates new records
   */
  const trackEvent = useCallback(async (event: Omit<AnalyticsEvent, 'timestamp' | 'page'>) => {
    // Skip tracking if user is authenticated and visiting their own page
    if (shouldSkipTracking) {
      return;
    }

    if (!accountId) {
      setError('Account ID is required for tracking');
      return;
    }

    const eventTypeToCheck = getEventTypeToCheck(event);
    const eventKey = getSessionKey(eventTypeToCheck);
    if (isEventTrackedInSession(eventTypeToCheck)) {
      return;
    }

    // Check if this event type is currently being tracked (prevent concurrent calls)
    if (trackingInProgress.current.has(eventKey)) {
      return;
    }

    // Mark this event as being tracked
    trackingInProgress.current.add(eventKey);
    setLoading(true);
    setError(null);

    // Extract UTM parameters from current URL
    const utmParams = extractUtmParamsFromCurrentUrl();

    const analyticsEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      page: pageName,
      utmParams: Object.keys(utmParams).length > 0 ? utmParams : undefined, // Only include if UTM params exist
      metadata: {
        ...event.metadata,
        ...protectedQaRunMetadata(),
        routeVariant,
        routePath: routePath || window.location.pathname,
      }
    };


    try {
      // For place-card events (both click and view), use the placeId/recommendationId from metadata as Recommendation_Id
      const dynamicRecommendationId =
        analyticsEvent.metadata?.recommendationDocumentId ||
        analyticsEvent.metadata?.recommendationId ||
        (event.element?.includes('-card')
          ? analyticsEvent.metadata?.id || analyticsEvent.metadata?.placeId || recommendationId
          : recommendationId);

      // Always create new record with current locationId and recommendationId
      // But use consistent session key for public-home page
      const dataToSend = {
        Account_Id: accountId,
        Location_Id: locationId,
        Recommendation_Id: dynamicRecommendationId,
        Stats: [analyticsEvent]
      };

      const result = await createAnalytic({
        variables: {
          data: dataToSend
        }
      });

      if (result.data?.createPublicPageAnalytic?.documentId) {
        // Mark this event type as tracked in session
        markEventAsTracked(eventTypeToCheck);
      }
    } catch (err) {
      console.error('Analytics tracking error:', err);
      setError(err instanceof Error ? err.message : 'Failed to track analytics event');
    } finally {
      setLoading(false);
      // Remove from tracking in progress
      trackingInProgress.current.delete(eventKey);
    }
  }, [
    accountId,
    locationId,
    recommendationId,
    createAnalytic,
    getEventTypeToCheck,
    getSessionKey,
    isEventTrackedInSession,
    markEventAsTracked,
    routePath,
    routeVariant,
    shouldSkipTracking,
  ]);

  /**
   * Track page view event
   */
  const trackView = useCallback(() => {
    // Skip if user is authenticated and visiting their own page
    if (shouldSkipTracking) {
      return;
    }

    // Prevent duplicate view tracking using both state and session
    if (hasTrackedView || isEventTrackedInSession('view')) {
      return;
    }
    
    // Prepare metadata for view tracking
    const viewMetadata: Record<string, any> = {
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent
    };

    // Add city name metadata for public-home page view events only
    if (pageName === 'public-home' && cityName) {
      viewMetadata.cityname = cityName;
    }
    
    trackEvent({
      type: 'view',
      metadata: viewMetadata
    });
  }, [trackEvent, hasTrackedView, isEventTrackedInSession, pageName, cityName, shouldSkipTracking]);

  /**
   * Track click event
   */
  const trackClick = useCallback((element: string, metadata?: Record<string, any>) => {
    // Skip if user is authenticated and visiting their own page
    if (shouldSkipTracking) {
      return;
    }

    trackEvent({
      type: 'click',
      element,
      metadata: {
        ...metadata,
        url: window.location.href,
        originalElement: element,
      }
    });
  }, [shouldSkipTracking, trackEvent]);

  /**
   * Track interaction event (hover, scroll, etc.)
   */
  const trackInteraction = useCallback((element: string, metadata?: Record<string, any>) => {
    // Skip if user is authenticated and visiting their own page
    if (shouldSkipTracking) {
      return;
    }

    // Check if interaction events have been tracked for this page in this session
    if (isEventTrackedInSession('interaction')) {
      return;
    }

    trackEvent({
      type: 'interaction',
      element,
      metadata: {
        ...metadata,
        url: window.location.href
      }
    });
  }, [trackEvent, isEventTrackedInSession, shouldSkipTracking]);


  return {
    trackEvent,
    trackView,
    trackClick,
    trackInteraction,
    loading,
    error
  };
};

/**
 * Utility function to extract account ID from username
 * This can be used when you only have a username but need the account ID
 */
export const getAccountIdFromUsername = async (username: string): Promise<string | null> => {
  try {
    // This would need to be implemented based on your existing user query structure
    // For now, we'll assume the username is the account ID or can be used to fetch it
    return username;
  } catch (error) {
    console.error('Failed to get account ID from username:', error);
    return null;
  }
};

const createCollectionAnalyticsOptions = (
  accountDocumentId: string,
  pageUsername: string | undefined,
  pageName: string,
  pathSegment: string,
  locationDocumentId?: string,
  recommendationDocumentId?: string,
  route?: AnalyticsRouteMetadata,
): UseTrackAnalyticsOptions => ({
  accountId: accountDocumentId,
  locationId: locationDocumentId || null,
  recommendationId: recommendationDocumentId || null,
  pageName,
  pageUsername,
  autoTrackView: true,
  routeVariant: route?.variant || (locationDocumentId ? 'list' : 'index'),
  routePath: route?.path || `/${pageUsername || ''}/${pathSegment}`.replace('//', '/'),
});

/**
 * Utility function to create analytics options for different page types
 * Note: All IDs should be documentIds, not names/usernames
 */
export const createAnalyticsOptions = {
  /**
   * For public profile pages
   */
  profile: (accountDocumentId: string, pageUsername?: string): UseTrackAnalyticsOptions => ({
    accountId: accountDocumentId,
    pageName: 'public-profile',
    pageUsername,
    autoTrackView: true,
    routeVariant: 'profile',
    routePath: `/${pageUsername || ''}`,
  }),

  /**
   * For public home pages (recommendations)
   */
  home: (
    accountDocumentId: string,
    pageUsername?: string,
    locationDocumentId?: string,
    recommendationDocumentId?: string,
    cityName?: string,
    route?: AnalyticsRouteMetadata,
  ): UseTrackAnalyticsOptions => ({
    accountId: accountDocumentId,
    locationId: locationDocumentId || null,
    recommendationId: recommendationDocumentId || null,
    pageName: 'public-home',
    pageUsername,
    autoTrackView: true,
    cityName,
    routeVariant: route?.variant || 'index',
    routePath: route?.path || `/${pageUsername || ''}/places`.replace('//', '/'),
  }),

  /**
   * For specific recommendation pages
   */
  recommendation: (accountDocumentId: string, pageUsername?: string, locationDocumentId?: string, recommendationDocumentId?: string): UseTrackAnalyticsOptions => ({
    accountId: accountDocumentId,
    locationId: locationDocumentId || null,
    recommendationId: recommendationDocumentId || null,
    pageName: 'recommendation-detail',
    pageUsername,
    autoTrackView: true
  }),

  /**
   * For public music pages
   */
  music: (accountDocumentId: string, pageUsername?: string): UseTrackAnalyticsOptions => ({
    accountId: accountDocumentId,
    pageName: 'public-music',
    pageUsername,
    autoTrackView: true,
    routeVariant: 'index',
    routePath: `/${pageUsername || ''}/music`.replace('//', '/'),
  }),

  /**
   * For public movies/shows pages
   */
  movies: (
    accountDocumentId: string,
    pageUsername?: string,
    listDocumentId?: string,
    movieDocumentId?: string,
    route?: AnalyticsRouteMetadata,
  ): UseTrackAnalyticsOptions => createCollectionAnalyticsOptions(
    accountDocumentId,
    pageUsername,
    'public-movies',
    'movies',
    listDocumentId,
    movieDocumentId,
    route,
  ),

  /**
   * For public books pages
   */
  books: (
    accountDocumentId: string,
    pageUsername?: string,
    listDocumentId?: string,
    bookDocumentId?: string,
    route?: AnalyticsRouteMetadata,
  ): UseTrackAnalyticsOptions => createCollectionAnalyticsOptions(
    accountDocumentId,
    pageUsername,
    'public-books',
    'books',
    listDocumentId,
    bookDocumentId,
    route,
  ),

  /**
   * For public games pages
   */
  games: (
    accountDocumentId: string,
    pageUsername?: string,
    listDocumentId?: string,
    gameDocumentId?: string,
    route?: AnalyticsRouteMetadata,
  ): UseTrackAnalyticsOptions => createCollectionAnalyticsOptions(
    accountDocumentId,
    pageUsername,
    'public-games',
    'games',
    listDocumentId,
    gameDocumentId,
    route,
  ),

  guides: (
    accountDocumentId: string,
    pageUsername?: string,
    guideDocumentId?: string,
    route?: AnalyticsRouteMetadata,
  ): UseTrackAnalyticsOptions => createCollectionAnalyticsOptions(
    accountDocumentId,
    pageUsername,
    'public-guides',
    'guides',
    undefined,
    guideDocumentId,
    route || (guideDocumentId && pageUsername
      ? { variant: 'detail', path: `/${pageUsername}/guides/${guideDocumentId}` }
      : undefined),
  ),

  apps: (
    accountDocumentId: string,
    pageUsername?: string,
    listDocumentId?: string,
    appDocumentId?: string,
    route?: AnalyticsRouteMetadata,
  ): UseTrackAnalyticsOptions => createCollectionAnalyticsOptions(
    accountDocumentId,
    pageUsername,
    'public-apps',
    'apps',
    listDocumentId,
    appDocumentId,
    route,
  ),

  products: (
    accountDocumentId: string,
    pageUsername?: string,
    listDocumentId?: string,
    productDocumentId?: string,
    route?: AnalyticsRouteMetadata,
  ): UseTrackAnalyticsOptions => createCollectionAnalyticsOptions(
    accountDocumentId,
    pageUsername,
    'public-products',
    'products',
    listDocumentId,
    productDocumentId,
    route,
  ),

  people: (
    accountDocumentId: string,
    pageUsername?: string,
    listOrSectorDocumentId?: string,
    personDocumentId?: string,
    route?: AnalyticsRouteMetadata,
  ): UseTrackAnalyticsOptions => createCollectionAnalyticsOptions(
    accountDocumentId,
    pageUsername,
    'public-people',
    'people',
    listOrSectorDocumentId,
    personDocumentId,
    route,
  ),
};

export default useTrackAnalytics;
