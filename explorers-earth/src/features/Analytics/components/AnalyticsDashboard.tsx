import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useQuery, gql } from '@apollo/client';
import { GET_PUBLIC_PAGE_ANALYTICS, AnalyticsEvent, PublicPageAnalyticsData } from '../api/queries';
import useAuthStore from '../../../store/store';
import { EarthLoader } from "../../../components/EarthLoader";
import { useTranslation } from 'react-i18next';
import TopCountriesChart from './charts/TopCountriesChart';
import TrafficSourceChart from './charts/TrafficSourceChart';
import LocationEngagementChart from './charts/LocationEngagementChart';
import RecommendedPlacesChart from './charts/RecommendedPlacesChart';
import SocialMediaInteractionChart from './charts/SocialMediaInteractionChart';
import WorldMapChart from './charts/WorldMapChart';
import ContentEngagementChart from './charts/ContentEngagementChart';
import PageViewsTrendChart from './charts/PageViewsTrendChart';
import { batchResolveIPsToCountries } from '../utils/geolocationService';

// Time filter types
type TimeFilter = 'today' | 'last7days' | 'last30days' | 'custom';

interface TimeFilterState {
  type: TimeFilter;
  startDate?: Date;
  endDate?: Date;
}

// Time filter options will be created using translations

/**
 * Analytics Dashboard Component
 * 
 * Fetches analytics data, resolves IP addresses to countries,
 * and renders summary metrics with interactive charts.
 */
const AnalyticsDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user, isAuthenticated, token } = useAuthStore();
  const [eventsWithCountries, setEventsWithCountries] = useState<AnalyticsEvent[]>([]);
  const [isResolvingCountries, setIsResolvingCountries] = useState(false);
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const [accountAnalyticsData, setAccountAnalyticsData] = useState<PublicPageAnalyticsData[]>([]);

  // Time filter state
  const [timeFilter, setTimeFilter] = useState<TimeFilterState>({
    type: 'last30days',
    startDate: undefined,
    endDate: undefined
  });

  // Time filter dropdown state
  const [isTimeFilterDropdownOpen, setIsTimeFilterDropdownOpen] = useState(false);
  const timeFilterDropdownRef = useRef<HTMLDivElement>(null);

  // Time filter options for dropdown (with translations)
  const TIME_FILTER_OPTIONS = useMemo(() => [
    { value: 'today', label: t('analytics.dashboard.timeFilter.today') },
    { value: 'last7days', label: t('analytics.dashboard.timeFilter.last7days') },
    { value: 'last30days', label: t('analytics.dashboard.timeFilter.last30days') },
    { value: 'custom', label: t('analytics.dashboard.timeFilter.custom') },
  ] as const, [t]);

  // Fetch analytics data from Strapi
  const { data, loading, error } = useQuery(GET_PUBLIC_PAGE_ANALYTICS, {
    errorPolicy: 'all', // Return data even if there are errors
    fetchPolicy: 'cache-and-network', // Always fetch fresh data while showing cached instantly
    skip: !isAuthenticated || !user?.documentId || !token, // Skip query if not authenticated
  });

  // Fetch account data to get the correct account ID for filtering analytics
  const { data: accountData } = useQuery(gql`
    query GetAccountId($documentId: ID!) {
      usersPermissionsUser(documentId: $documentId) {
        createdAt
        accounts {
          documentId
          createdAt
        }
      }
    }
  `, {
    variables: { documentId: user?.documentId },
    skip: !user?.documentId,
  });

  const accountDocumentId = accountData?.usersPermissionsUser?.accounts?.[0]?.documentId;

  // Calculate date range based on time filter
  const getDateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (timeFilter.type) {
      case 'today':
        return {
          startDate: today,
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1) // End of today
        };
      case 'last7days': {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Include today
        return {
          startDate: sevenDaysAgo,
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      }
      case 'last30days': {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // Include today
        return {
          startDate: thirtyDaysAgo,
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      }
      case 'custom':
        // For custom range, both dates must be provided
        if (!timeFilter.startDate || !timeFilter.endDate) {
          return null; // Return null to indicate incomplete custom range
        }
        return {
          startDate: timeFilter.startDate,
          endDate: timeFilter.endDate
        };
      default:
        return {
          startDate: today,
          endDate: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
    }
  }, [timeFilter]);

  // Check if custom range is complete
  const isCustomRangeComplete = useMemo(() => {
    if (timeFilter.type !== 'custom') return true;
    return timeFilter.startDate && timeFilter.endDate;
  }, [timeFilter]);

  // Filter events by date range
  const filteredEvents = useMemo(() => {
    if (!eventsWithCountries.length || !getDateRange) return [];

    return eventsWithCountries.filter(event => {
      const eventDate = new Date(event.timestamp);
      return eventDate >= getDateRange.startDate && eventDate <= getDateRange.endDate;
    });
  }, [eventsWithCountries, getDateRange]);

  // Filter raw analytics data by date range
  const filteredRawAnalyticsData = useMemo(() => {
    if (!accountAnalyticsData.length || !getDateRange) return [];

    return accountAnalyticsData.map(data => ({
      ...data,
      Stats: data.Stats?.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= getDateRange.startDate && eventDate <= getDateRange.endDate;
      }) || []
    })).filter(data => data.Stats.length > 0);
  }, [accountAnalyticsData, getDateRange]);

  // Check if there's any analytics data at all (before date filtering)
  // MUST be before any early returns to follow Rules of Hooks
  const hasAnyAnalyticsData = useMemo(() => {
    if (!data?.publicPageAnalytics || !accountDocumentId) return false;
    const accountData = data.publicPageAnalytics.filter(
      (item: PublicPageAnalyticsData) => item.Account_Id === accountDocumentId
    );
    // Check if there are any events in the account's analytics data
    return accountData.some((item: PublicPageAnalyticsData) =>
      item.Stats && item.Stats.length > 0
    );
  }, [data?.publicPageAnalytics, accountDocumentId]);

  // Generate context-aware empty state message
  const getEmptyStateMessage = () => {
    // Check if custom range is incomplete
    if (timeFilter.type === 'custom' && !isCustomRangeComplete) {
      if (!timeFilter.startDate && !timeFilter.endDate) {
        return t('analytics.dashboard.emptyState.customRange.bothMissing');
      } else if (!timeFilter.startDate) {
        return t('analytics.dashboard.emptyState.customRange.startMissing');
      } else if (!timeFilter.endDate) {
        return t('analytics.dashboard.emptyState.customRange.endMissing');
      }
    }
    if (!hasAnyAnalyticsData) {
      return t('analytics.dashboard.emptyState.noDataMessage');

    }

    // If there's data but not for the selected time range
    switch (timeFilter.type) {
      case 'today':
        return t('analytics.dashboard.emptyState.noDataForPeriod.today');
      case 'last7days':
        return t('analytics.dashboard.emptyState.noDataForPeriod.last7days');
      case 'last30days':

        return t('analytics.dashboard.emptyState.noDataForPeriod.last30days');

      case 'custom': {
        const startDateStr = timeFilter.startDate
          ? timeFilter.startDate.toLocaleDateString()
          : t('analytics.dashboard.dateRange.from');

        const endDateStr = timeFilter.endDate
          ? timeFilter.endDate.toLocaleDateString()
          : t('analytics.dashboard.dateRange.to');

        return t('analytics.dashboard.emptyState.noDataForPeriod.custom', {
          startDate: startDateStr,
          endDate: endDateStr,
        });
      }

      default:
        return t('analytics.dashboard.emptyState.noDataForPeriod.default');
    }
  };

  // Handle click outside to close time filter dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (timeFilterDropdownRef.current && !timeFilterDropdownRef.current.contains(event.target as Node)) {
        setIsTimeFilterDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Effect to resolve countries for IP addresses when data changes
  useEffect(() => {
    const resolveCountries = async () => {
      if (!data?.publicPageAnalytics || !accountDocumentId) {
        setEventsWithCountries([]);
        setAccountAnalyticsData([]);
        return;
      }

      // Filter data by account ID
      const accountData = data.publicPageAnalytics.filter(
        (item: PublicPageAnalyticsData) => item.Account_Id === accountDocumentId
      );

      // Store the raw account data for LocationEngagementChart
      setAccountAnalyticsData(accountData);

      // Flatten all events from the filtered data
      const allEvents: AnalyticsEvent[] = accountData.flatMap(
        (item: PublicPageAnalyticsData) => item.Stats || []
      );

      // Get unique IP addresses from view events
      const viewEvents = allEvents.filter(event => event.type === 'view' && event.ipAddress);
      const uniqueIPs = [...new Set(viewEvents.map(event => event.ipAddress!))];

      if (uniqueIPs.length === 0) {
        setEventsWithCountries(allEvents);
        return;
      }

      setIsResolvingCountries(true);
      setGeolocationError(null);

      try {
        // Resolve IP addresses to countries
        const ipToCountryMap = await batchResolveIPsToCountries(uniqueIPs);

        // Add country information to events
        const eventsWithCountryInfo = allEvents.map(event => ({
          ...event,
          country: event.ipAddress ? ipToCountryMap.get(event.ipAddress) : undefined
        }));

        setEventsWithCountries(eventsWithCountryInfo);

        // Check if we got any country data
        const resolvedCount = Array.from(ipToCountryMap.values()).filter(country => country !== null).length;
        if (resolvedCount === 0 && uniqueIPs.length > 0) {
          setGeolocationError(t('analytics.dashboard.charts.topCountries.unableToResolve'));
        }
      } catch (error) {
        // Error resolving countries - handled gracefully
        setEventsWithCountries(allEvents);
        setGeolocationError(t('analytics.dashboard.charts.topCountries.failedToResolve'));
      } finally {
        setIsResolvingCountries(false);
      }
    };

    resolveCountries();
  }, [data, accountDocumentId]);

  // Calculate metrics from filtered events
  const processedData = useMemo(() => {
    if (filteredEvents.length === 0) {
      return {
        totalViews: 0,
        totalClicks: 0,
        totalQRScans: 0,
        totalViewsOtherSources: 0
      };
    }

    // Calculate totals from filtered events
    const totalViews = filteredEvents.filter(event => event.type === 'view').length;
    const totalClicks = filteredEvents.filter(event => event.type === 'click').length;

    // Calculate QR views based on UTM parameters
    const totalQRScans = filteredEvents.filter(event =>
      event.type === 'view' &&
      event.utmParams?.utm_source === 'qr_code_scan' &&
      event.utmParams?.utm_medium === 'qr_code'
    ).length;

    // Calculate views from other sources (non-QR views)
    const totalViewsOtherSources = filteredEvents.filter(event =>
      event.type === 'view' &&
      !(event.utmParams?.utm_source === 'qr_code_scan' && event.utmParams?.utm_medium === 'qr_code')
    ).length;

    return {
      totalViews,
      totalClicks,
      totalQRScans,
      totalViewsOtherSources
    };
  }, [filteredEvents]);

  // Loading state - only block for initial data fetch, not country resolution
  if (loading) {
    return (
      <div className="bg-dashboard-bg min-h-screen flex items-center justify-center">
        <EarthLoader context="general" size="small" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-dashboard-bg min-h-screen">
        <div className="dashboard-theme flex items-center justify-center min-h-[400px]">
          <div className="dt-surface p-6 rounded-lg text-center max-w-md">
            <h3 className="dt-heading mb-2 text-dashboard-danger">{t('analytics.dashboard.error.title')}</h3>
            <p className="dt-subtext mb-4">
              {t('analytics.dashboard.error.message')}
            </p>
            <p className="dt-subtext text-xs">
              {t('analytics.dashboard.error.errorLabel')} {error.message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No data state - ONLY show if there's truly NO analytics data in the account at all
  // If there's data (even if filtered out), show the dashboard with appropriate messaging
  if (!hasAnyAnalyticsData) {
    return (
      <div className="bg-dashboard-bg min-h-screen">
        <div className="dashboard-theme p-4 sm:p-5 md:p-6 space-y-6">
          {/* Header with Time Filter - Always Visible */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="dt-heading mb-2">{t('analytics.dashboard.title')}</h1>
                <p className="dt-subtext">
                  {t('analytics.dashboard.subtitle')}
                </p>
              </div>

              {/* Time Filter Dropdown - Always Visible */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="dt-label text-sm">{t('analytics.dashboard.timePeriod')}</label>
                <div className="w-full sm:w-auto sm:min-w-[180px] relative" ref={timeFilterDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsTimeFilterDropdownOpen(!isTimeFilterDropdownOpen)}
                    className="dt-input w-full text-left flex justify-between items-center dt-label px-3 py-2 text-sm border border-dashboard-border rounded-lg bg-dashboard-surface text-dashboard focus:outline-none focus:ring-2 focus:ring-dashboard-accent focus:border-transparent"
                  >
                    <span>
                      {TIME_FILTER_OPTIONS.find(option => option.value === timeFilter.type)?.label || t('analytics.dashboard.timeFilter.selectPeriod')}
                    </span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isTimeFilterDropdownOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isTimeFilterDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 dt-surface border border-dashboard rounded-lg shadow-dashboard-elevated z-50 max-h-60 overflow-y-auto scrollbar-hide">
                      {TIME_FILTER_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setTimeFilter(prev => ({
                              ...prev,
                              type: option.value as TimeFilter,
                              startDate: option.value === 'custom' ? prev.startDate : undefined,
                              endDate: option.value === 'custom' ? prev.endDate : undefined
                            }));
                            setIsTimeFilterDropdownOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left dt-label hover:bg-dashboard-muted transition-colors ${timeFilter.type === option.value ? 'bg-dashboard-muted text-dashboard-accent' : ''
                            }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Custom Date Range Inputs */}
            {timeFilter.type === 'custom' && (
              <div className="mt-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex items-center gap-2">
                  <label className="dt-label text-sm">
                    {t('analytics.dashboard.dateRange.from')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={timeFilter.startDate ? timeFilter.startDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : undefined;
                      setTimeFilter(prev => ({ ...prev, startDate: date }));
                    }}
                    className={`dt-input px-3 py-2 text-sm border rounded-lg bg-dashboard-surface text-dashboard focus:outline-none focus:ring-2 focus:ring-dashboard-accent focus:border-transparent ${timeFilter.type === 'custom' && !timeFilter.startDate
                        ? 'border-red-300'
                        : 'border-dashboard-border'
                      }`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="dt-label text-sm">
                    {t('analytics.dashboard.dateRange.to')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={timeFilter.endDate ? timeFilter.endDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : undefined;
                      setTimeFilter(prev => ({ ...prev, endDate: date }));
                    }}
                    className={`dt-input px-3 py-2 text-sm border rounded-lg bg-dashboard-surface text-dashboard focus:outline-none focus:ring-2 focus:ring-dashboard-accent focus:border-transparent ${timeFilter.type === 'custom' && !timeFilter.endDate
                        ? 'border-red-300'
                        : 'border-dashboard-border'
                      }`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Context-Aware Empty State */}
          <div className="flex items-center justify-center min-h-[400px] px-4">
            <div className="dt-surface p-4 sm:p-5 md:p-6 rounded-lg text-center w-full max-w-md mx-auto">
              <div className="mb-4">
                <div className="w-16 h-16 mx-auto mb-4 bg-dashboard-muted rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-dashboard" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="dt-heading mb-2">{t('analytics.dashboard.emptyState.title')}</h3>
                <p className="dt-subtext mb-4">
                  {getEmptyStateMessage()}
                </p>
              </div>

              <div className="space-y-2 text-left">
                <h4 className="dt-label mb-2">{t('analytics.dashboard.emptyState.howToStart.title')}</h4>
                <ul className="dt-subtext space-y-1">
                  <li>{t('analytics.dashboard.emptyState.howToStart.shareQR')}</li>
                  <li>{t('analytics.dashboard.emptyState.howToStart.includeQR')}</li>
                  <li>{t('analytics.dashboard.emptyState.howToStart.askFriends')}</li>
                  <li>{t('analytics.dashboard.emptyState.howToStart.viewProfile')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dashboard-bg min-h-screen">
      <div className="dashboard-theme p-6 space-y-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="dt-heading mb-2">{t('analytics.dashboard.title')}</h1>
              <p className="dt-subtext">
                {t('analytics.dashboard.subtitle')}
              </p>
            </div>

            {/* Time Filter Dropdown */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="dt-label text-sm">{t('analytics.dashboard.timePeriod')}</label>
              <div className="w-full sm:w-auto sm:min-w-[180px] relative" ref={timeFilterDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsTimeFilterDropdownOpen(!isTimeFilterDropdownOpen)}
                  className="dt-input w-full text-left flex justify-between items-center dt-label px-3 py-2 text-sm border border-dashboard-border rounded-lg bg-dashboard-surface text-dashboard focus:outline-none focus:ring-2 focus:ring-dashboard-accent focus:border-transparent"
                >
                  <span>
                    {TIME_FILTER_OPTIONS.find(option => option.value === timeFilter.type)?.label || t('analytics.dashboard.timeFilter.selectPeriod')}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${isTimeFilterDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isTimeFilterDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 dt-surface border border-dashboard rounded-lg shadow-dashboard-elevated z-50 max-h-60 overflow-y-auto scrollbar-hide">
                    {TIME_FILTER_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setTimeFilter(prev => ({
                            ...prev,
                            type: option.value as TimeFilter,
                            startDate: option.value === 'custom' ? prev.startDate : undefined,
                            endDate: option.value === 'custom' ? prev.endDate : undefined
                          }));
                          setIsTimeFilterDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left dt-label hover:bg-dashboard-muted transition-colors ${timeFilter.type === option.value ? 'bg-dashboard-muted text-dashboard-accent' : ''
                          }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Custom Date Range Inputs */}
          {timeFilter.type === 'custom' && (
            <div className="mt-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex items-center gap-2">
                <label className="dt-label text-sm">{t('analytics.dashboard.dateRange.from')}</label>
                <input
                  type="date"
                  value={timeFilter.startDate ? timeFilter.startDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : undefined;
                    setTimeFilter(prev => ({ ...prev, startDate: date }));
                  }}
                  className="dt-input px-3 py-2 text-sm border border-dashboard-border rounded-lg bg-dashboard-surface text-dashboard focus:outline-none focus:ring-2 focus:ring-dashboard-accent focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="dt-label text-sm">{t('analytics.dashboard.dateRange.to')}</label>
                <input
                  type="date"
                  value={timeFilter.endDate ? timeFilter.endDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : undefined;
                    setTimeFilter(prev => ({ ...prev, endDate: date }));
                  }}
                  className="dt-input px-3 py-2 text-sm border border-dashboard-border rounded-lg bg-dashboard-surface text-dashboard focus:outline-none focus:ring-2 focus:ring-dashboard-accent focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
          <div className="dt-surface p-4 rounded-lg flex-shrink-0 min-w-[200px]">
            <h3 className="dt-label mb-1">{t('analytics.dashboard.summaryCards.totalViews')}</h3>
            <p className="text-2xl font-bold text-dashboard-accent">
              {processedData.totalViews.toLocaleString()}
            </p>
          </div>
          <div className="dt-surface p-4 rounded-lg flex-shrink-0 min-w-[200px]">
            <h3 className="dt-label mb-1">{t('analytics.dashboard.summaryCards.totalClicks')}</h3>
            <p className="text-2xl font-bold text-dashboard-accent">
              {processedData.totalClicks.toLocaleString()}
            </p>
          </div>
          <div className="dt-surface p-4 rounded-lg flex-shrink-0 min-w-[200px]">
            <h3 className="dt-label mb-1">{t('analytics.dashboard.summaryCards.totalQRViews')}</h3>
            <p className="text-2xl font-bold text-dashboard-accent">
              {processedData.totalQRScans.toLocaleString()}
            </p>
          </div>
          <div className="dt-surface p-4 rounded-lg flex-shrink-0 min-w-[200px]">
            <h3 className="dt-label mb-1">{t('analytics.dashboard.summaryCards.totalLinkViews')}</h3>
            <p className="text-2xl font-bold text-dashboard-accent">
              {processedData.totalViewsOtherSources.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Charts Section */}
        <div className="space-y-6 pb-20 md:pb-6">
          {/* Top Countries Chart */}
          <div className="dt-surface p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="dt-heading">{t('analytics.dashboard.charts.topCountries.title')}</h2>
              {geolocationError && (
                <button
                  onClick={() => {
                    setGeolocationError(null);
                    // Force re-run the effect by clearing events
                    setEventsWithCountries([]);
                  }}
                  className="dt-button-text px-3 py-1 text-sm bg-dashboard-accent text-white rounded hover:opacity-90 transition-opacity"
                >
                  {t('analytics.dashboard.charts.topCountries.retryGeolocation')}
                </button>
              )}
            </div>

            {geolocationError && (
              <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>{t('analytics.dashboard.charts.topCountries.geolocationIssue')}</strong> {geolocationError}
                </p>
              </div>
            )}

            <TopCountriesChart events={filteredEvents} isResolvingCountries={isResolvingCountries} />
          </div>

          {/* World Map Chart */}
          <div className="dt-surface p-6 rounded-lg">
            <div className="mb-4">
              <h2 className="dt-heading">{t('analytics.dashboard.charts.worldMap.title')}</h2>
              <p className="dt-subtext">
                {t('analytics.dashboard.charts.worldMap.subtitle')}
              </p>
            </div>

            <WorldMapChart events={filteredEvents} isResolvingCountries={isResolvingCountries} />
          </div>

          {/* Traffic Source Chart */}
          <div className="dt-surface p-6 rounded-lg">
            <div className="mb-4">
              <h2 className="dt-heading">{t('analytics.dashboard.charts.trafficSource.title')}</h2>
              <p className="dt-subtext">
                {t('analytics.dashboard.charts.trafficSource.subtitle')}
              </p>
            </div>

            <TrafficSourceChart events={filteredEvents} />
          </div>

          {/* Location Engagement Chart */}
          <div className="dt-surface p-6 rounded-lg">
            <div className="mb-4">
              <h2 className="dt-heading">{t('analytics.dashboard.charts.locationEngagement.title')}</h2>
              <p className="dt-subtext">
                {t('analytics.dashboard.charts.locationEngagement.subtitle')}
              </p>
            </div>

            <LocationEngagementChart
              rawAnalyticsData={filteredRawAnalyticsData}
            />
          </div>

          {/* Recommended Places Chart */}
          <div className="dt-surface p-6 rounded-lg">
            <div className="mb-4">
              <h2 className="dt-heading">{t('analytics.dashboard.charts.recommendedPlaces.title')}</h2>
              <p className="dt-subtext">
                {t('analytics.dashboard.charts.recommendedPlaces.subtitle')}
              </p>
            </div>

            <RecommendedPlacesChart
              rawAnalyticsData={filteredRawAnalyticsData}
            />
          </div>

          {/* Social Media Interaction Chart */}
          <div className="dt-surface p-6 rounded-lg">
            <div className="mb-4">
              <h2 className="dt-heading">{t('analytics.dashboard.charts.socialMedia.title')}</h2>
              <p className="dt-subtext">
                {t('analytics.dashboard.charts.socialMedia.subtitle')}
              </p>
            </div>

            <SocialMediaInteractionChart
              rawAnalyticsData={filteredRawAnalyticsData}
            />
          </div>

          {/* Content Page Performance — NEW */}
          <div className="dt-surface p-6 rounded-lg">
            <div className="mb-4">
              <h2 className="dt-heading">Content Page Performance</h2>
              <p className="dt-subtext">
                Views &amp; click-throughs across Music, Movies, Books, Games and Guides pages.
              </p>
            </div>
            <ContentEngagementChart events={filteredEvents} />
          </div>

          {/* Daily Views Trend by Section — NEW */}
          <div className="dt-surface p-6 rounded-lg">
            <div className="mb-4">
              <h2 className="dt-heading">Daily Views Trend by Section</h2>
              <p className="dt-subtext">
                How each content section (Places, Music, Movies, Books, Games, Guides) is trending over time.
              </p>
            </div>
            <PageViewsTrendChart events={filteredEvents} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
