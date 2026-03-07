import { useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAnalytics, AnalyticsEventCategory, AnalyticsEventAction } from '@/hooks/use-analytics';

/**
 * Component that automatically tracks page views
 * Place this once at the root level of the application
 */
export default function AnalyticsTracker() {
  const { trackPageView, trackEvent } = useAnalytics();
  const [location] = useLocation();

  // Generate page title based on the current route
  const pageTitle = useMemo(() => {
    if (location === '/') return 'Home';
    if (location === '/auth') return 'Authentication';
    if (location === '/dashboard') return 'Dashboard';
    if (location === '/settings') return 'User Settings';
    if (location.startsWith('/admin')) return 'Admin Dashboard';
    if (location.startsWith('/playlist/')) return 'Playlist View';
    if (location.startsWith('/user/')) return 'User Details';
    
    // Default to capitalized path without slashes
    return location.substring(1).split('/').map(segment => 
      segment.charAt(0).toUpperCase() + segment.slice(1)
    ).join(' ');
  }, [location]);

  useEffect(() => {
    // Track page view when location changes
    trackPageView(location, pageTitle);
    
    // Additionally track as a navigation event for more detailed analytics
    trackEvent({
      category: AnalyticsEventCategory.NAVIGATION,
      action: AnalyticsEventAction.PAGE_VIEW,
      label: pageTitle,
      path: location
    });
  }, [location, pageTitle, trackPageView, trackEvent]);

  return null; // This component doesn't render anything
}