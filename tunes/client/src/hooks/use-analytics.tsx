import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import ReactGA from 'react-ga4';

// Types for our analytics context
type EventParams = {
  category: string;
  action: string;
  label?: string;
  value?: number;
  nonInteraction?: boolean;
  transport?: 'beacon' | 'xhr' | 'image';
  [key: string]: any;
};

type UserParams = {
  userId?: string | number;
  isHost?: boolean;
  isGuest?: boolean;
  [key: string]: any;
};

type AnalyticsContextType = {
  initialized: boolean;
  trackPageView: (path: string, title?: string) => void;
  trackEvent: (params: EventParams) => void;
  setUser: (params: UserParams) => void;
};

const defaultContext: AnalyticsContextType = {
  initialized: false,
  trackPageView: () => {},
  trackEvent: () => {},
  setUser: () => {},
};

const AnalyticsContext = createContext<AnalyticsContextType>(defaultContext);

interface AnalyticsProviderProps {
  children: ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const measurementId = import.meta.env.VITE_GOOGLE_ANALYTICS_ID;
    
    if (measurementId) {
      try {
        // Add GA4 script directly to the head for better detection
        const addGAScript = () => {
          const script = document.createElement('script');
          script.async = true;
          script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
          document.head.appendChild(script);
          
          const inlineScript = document.createElement('script');
          inlineScript.innerHTML = `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${measurementId}');
          `;
          document.head.appendChild(inlineScript);
        };
        
        // Add the GA script directly to the head
        if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js"]`)) {
          addGAScript();
        }
        
        // Also initialize ReactGA for our own tracking functions
        ReactGA.initialize(measurementId, {
          testMode: import.meta.env.DEV,
          gaOptions: {
            cookieFlags: 'SameSite=None;Secure',
          },
        });
        
        setInitialized(true);
        console.log('Google Analytics initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Google Analytics:', error);
      }
    } else {
      console.warn('Google Analytics Measurement ID not provided');
    }
  }, []);

  // Track page views
  const trackPageView = (path: string, title?: string) => {
    if (!initialized) return;

    ReactGA.send({
      hitType: 'pageview',
      page: path,
      title: title,
    });
  };

  // Track events
  const trackEvent = (params: EventParams) => {
    if (!initialized) return;

    ReactGA.event({
      category: params.category,
      action: params.action,
      label: params.label,
      value: params.value,
      nonInteraction: params.nonInteraction,
      transport: params.transport,
      ...params,
    });
  };

  // Set user properties
  const setUser = (params: UserParams) => {
    if (!initialized) return;

    if (params.userId) {
      ReactGA.set({ userId: params.userId });
    }

    // Set custom dimensions
    ReactGA.set({
      userType: params.isHost ? 'host' : params.isGuest ? 'guest' : 'unknown',
      ...params,
    });
  };

  const contextValue: AnalyticsContextType = {
    initialized,
    trackPageView,
    trackEvent,
    setUser,
  };

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
}

// Common analytics event categories
export const AnalyticsEventCategory = {
  AUTH: 'Authentication',
  USER: 'User',
  PLAYLIST: 'Playlist',
  SONG: 'Song',
  GUEST: 'Guest',
  ADMIN: 'Admin',
  NAVIGATION: 'Navigation',
  FEATURE: 'Feature',
  ERROR: 'Error',
};

// Common analytics event actions
export const AnalyticsEventAction = {
  // Auth
  LOGIN: 'Login',
  REGISTER: 'Register',
  LOGOUT: 'Logout',
  PASSWORD_RESET: 'Password Reset',
  
  // Playlist
  CREATE_PLAYLIST: 'Create Playlist',
  DELETE_PLAYLIST: 'Delete Playlist',
  SHARE_PLAYLIST: 'Share Playlist',
  UPDATE_PLAYLIST: 'Update Playlist',
  ADD_PLAYLIST_TO_QUEUE: 'Add Playlist To Queue',
  
  // Song
  ADD_SONG: 'Add Song',
  REMOVE_SONG: 'Remove Song',
  PLAY_SONG: 'Play Song',
  SEARCH_SONG: 'Search Song',
  ADD_TO_QUEUE: 'Add To Queue',
  
  // Guest
  GUEST_VIEW: 'Guest View',
  GUEST_REQUEST: 'Guest Request',
  GUEST_PLAY: 'Guest Play',
  
  // Admin
  ADMIN_VIEW: 'Admin View',
  ADMIN_USER_MANAGE: 'Admin User Manage',
  ADMIN_TEMPLATE_MANAGE: 'Admin Template Manage',
  ADMIN_TOKEN_MANAGE: 'Admin Token Manage',
  
  // Navigation
  PAGE_VIEW: 'Page View',
  MENU_CLICK: 'Menu Click',
  
  // Feature
  FEATURE_TOGGLE: 'Feature Toggle',
  FEATURE_USE: 'Feature Use',
  
  // Error
  API_ERROR: 'API Error',
  VALIDATION_ERROR: 'Validation Error',
};