import { gql, useMutation, ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";
import { useCallback, useEffect, useState, useRef } from "react";
import { extractUtmParamsFromCurrentUrl, UTMParameters } from "../utils/urlHelpers";
import useAuthStore from "../store/store";

// Create Apollo Client for analytics using VITE_PUBLIC_ACCESS_TOKEN
const analyticsClient = new ApolloClient({
  link: createHttpLink({
    uri: import.meta.env.VITE_API_URL,
    headers: {
      authorization: `Bearer ${import.meta.env.VITE_PUBLIC_ACCESS_TOKEN}`,
    },
  }),
  cache: new InMemoryCache(),
});

// Analytics service using VITE_PUBLIC_ACCESS_TOKEN for API access

// Function to get user's IP address
const getUserIPAddress = async (): Promise<string | null> => {
  try {
    // Try multiple IP detection services for better reliability
    const ipServices = [
      'https://api.ipify.org?format=json',
      'https://ipapi.co/json/',
      'https://ipinfo.io/json',
      'https://api.ipgeolocation.io/ipgeo?api_key=free'
    ];

    for (const service of ipServices) {
      try {
        const response = await fetch(service, { 
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache'
        });
        
        if (response.ok) {
          const data = await response.json();
          // Different services return IP in different fields
          const ip = data.ip || data.query || data.ipAddress;
          if (ip && typeof ip === 'string') {
            return ip;
          }
        }
      } catch (error) {
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting IP address:', error);
    return null;
  }
};

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
  ipAddress?: string; // Add IP address to analytics events
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
}

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
  const { accountId, locationId, recommendationId, pageName, pageUsername, autoTrackView = true, waitForLocation = false, cityName } = options;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [trackingInProgress, setTrackingInProgress] = useState<Set<string>>(new Set());
  const lastCallTime = useRef<Map<string, number>>(new Map());

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
  }, [pageName, accountId, locationId, recommendationId]);

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
   * For public-home page, use a consistent key regardless of locationId changes
   */
  const getSessionKey = useCallback((eventType: string) => {
    // For public-home page, use a consistent key that doesn't change with locationId
    // This prevents duplicate records when navigating via navbar
    if (pageName === 'public-home') {
      return `analytics_${pageName}_${eventType}_${accountId}`;
    }
    // For other pages, include locationId and recommendationId
    return `analytics_${pageName}_${eventType}_${accountId}_${locationId || 'null'}_${recommendationId || 'null'}`;
  }, [pageName, accountId, locationId, recommendationId]);

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
  const trackEvent = useCallback(async (event: Omit<AnalyticsEvent, 'timestamp' | 'page' | 'ipAddress'>) => {
    // Skip tracking if user is authenticated and visiting their own page
    if (shouldSkipTracking) {
      return;
    }

    if (!accountId) {
      setError('Account ID is required for tracking');
      return;
    }

    // Create unique event key for tracking in progress and debouncing
    // For place-card events (both click and view), include the ID to make each unique
    let eventKey: string;
    if (event.element?.includes('place-card')) {
      eventKey = `${pageName}_${event.type}_${event.element}`;
    } else {
      eventKey = `${pageName}_${event.type}`;
    }
    
    const now = Date.now();
    const DEBOUNCE_TIME = 1000; // 1 second debounce

    // Check if this event type has already been tracked in this session
    // For place-card events (both click and view), use the full element identifier
    // For click events with a specific element, use the element identifier to allow
    // tracking multiple different items (e.g. different movie cards) per session
    let eventTypeToCheck: string;
    if (event.element?.includes('place-card')) {
      eventTypeToCheck = `${event.type}-${event.element}`;
    } else if (event.type === 'click' && event.element) {
      // Each unique element (e.g. game-card-abc123) gets its own session check
      eventTypeToCheck = `click-${event.element}`;
    } else {
      eventTypeToCheck = event.type;
    }
    if (isEventTrackedInSession(eventTypeToCheck)) {
      return;
    }

    // Check if this event type is currently being tracked (prevent concurrent calls)
    if (trackingInProgress.has(eventKey)) {
      return;
    }

    // Check debounce - prevent rapid successive calls
    const lastCall = lastCallTime.current.get(eventKey);
    if (lastCall && (now - lastCall) < DEBOUNCE_TIME) {
      return;
    }

    // Update last call time
    lastCallTime.current.set(eventKey, now);

    // Mark this event as being tracked
    setTrackingInProgress(prev => new Set(prev).add(eventKey));
    setLoading(true);
    setError(null);

    // Get user's IP address
    const ipAddress = await getUserIPAddress();

    // Extract UTM parameters from current URL
    const utmParams = extractUtmParamsFromCurrentUrl();

    const analyticsEvent: AnalyticsEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      page: pageName,
      ipAddress: ipAddress || undefined, // Only include if we successfully got an IP
      utmParams: Object.keys(utmParams).length > 0 ? utmParams : undefined, // Only include if UTM params exist
      metadata: {
        ...event.metadata
      }
    };


    try {
      // For place-card events (both click and view), use the placeId/recommendationId from metadata as Recommendation_Id
      const dynamicRecommendationId = 
        event.element?.includes('place-card')
          ? analyticsEvent.metadata?.placeId || analyticsEvent.metadata?.recommendationId || recommendationId
        : recommendationId;

      // Always create new record with current locationId and recommendationId
      // But use consistent session key for public-home page
      const dataToSend = {
        Account_Id: accountId,
        Location_Id: locationId,
        Recommendation_Id: dynamicRecommendationId,
        Stats: [analyticsEvent]
      };

      console.log('Creating analytics record:', {
        eventType: event.type,
        element: event.element,
        dataToSend
      });

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
      setTrackingInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(eventKey);
        return newSet;
      });
    }
  }, [accountId, locationId, recommendationId, pageName, createAnalytic, isAuthenticated, isEventTrackedInSession, markEventAsTracked, trackingInProgress]);

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
  }, [trackEvent, hasTrackedView, isAuthenticated, isEventTrackedInSession, pageName, cityName]);

  /**
   * Track click event
   */
  const trackClick = useCallback((element: string, metadata?: Record<string, any>) => {
    // Skip if user is authenticated and visiting their own page
    if (shouldSkipTracking) {
      return;
    }

    // Create a unique click identifier based on element and context
    let clickIdentifier = element;
    
    // For social media links, use platform
    if (metadata?.platform) {
      clickIdentifier = `${element}-${metadata.platform}`;
    }
    // For gallery items, use index to make each click unique
    else if (metadata?.index !== undefined) {
      clickIdentifier = `${element}-${metadata.index}`;
    }
    // For city selection, use cityId
    else if (metadata?.cityId) {
      clickIdentifier = `${element}-${metadata.cityId}`;
    }
    // For other elements, use any unique identifier in metadata
    else if (metadata?.id) {
      clickIdentifier = `${element}-${metadata.id}`;
    }
    // Fallback to element name
    else {
      clickIdentifier = element;
    }
    
    // Check if this specific click type has been tracked for this page in this session
    if (isEventTrackedInSession(`click-${clickIdentifier}`)) {
      return;
    }

    trackEvent({
      type: 'click',
      element: clickIdentifier, // Use the unique identifier as element
      metadata: {
        ...metadata,
        url: window.location.href,
        originalElement: element // Keep original element for reference
      }
    });
  }, [trackEvent, isAuthenticated, isEventTrackedInSession]);

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
  }, [trackEvent, isAuthenticated, isEventTrackedInSession]);


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
    autoTrackView: true
  }),

  /**
   * For public home pages (recommendations)
   */
  home: (accountDocumentId: string, pageUsername?: string, locationDocumentId?: string, recommendationDocumentId?: string, cityName?: string): UseTrackAnalyticsOptions => ({
    accountId: accountDocumentId,
    locationId: locationDocumentId || null,
    recommendationId: recommendationDocumentId || null,
    pageName: 'public-home',
    pageUsername,
    autoTrackView: true,
    cityName
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
    autoTrackView: true
  }),

  /**
   * For public movies/shows pages
   */
  movies: (accountDocumentId: string, pageUsername?: string, listDocumentId?: string, movieDocumentId?: string): UseTrackAnalyticsOptions => ({
    accountId: accountDocumentId,
    locationId: listDocumentId || null,
    recommendationId: movieDocumentId || null,
    pageName: 'public-movies',
    pageUsername,
    autoTrackView: true
  }),

  /**
   * For public books pages
   */
  books: (accountDocumentId: string, pageUsername?: string, listDocumentId?: string, bookDocumentId?: string): UseTrackAnalyticsOptions => ({
    accountId: accountDocumentId,
    locationId: listDocumentId || null,
    recommendationId: bookDocumentId || null,
    pageName: 'public-books',
    pageUsername,
    autoTrackView: true
  }),

  /**
   * For public games pages
   */
  games: (accountDocumentId: string, pageUsername?: string, listDocumentId?: string, gameDocumentId?: string): UseTrackAnalyticsOptions => ({
    accountId: accountDocumentId,
    locationId: listDocumentId || null,
    recommendationId: gameDocumentId || null,
    pageName: 'public-games',
    pageUsername,
    autoTrackView: true
  })
};

export default useTrackAnalytics;
