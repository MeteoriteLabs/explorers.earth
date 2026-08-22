import { memo, useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@apollo/client";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { usePublicRouteLifecycle } from "../../../layouts/usePublicRouteLifecycle";
import { GET_PUBLIC_GUIDE_BY_SLUG_QUERY } from "../../Guides/api/queries";
import { usePublicProfileBootstrapAccount } from "../../../layouts/PublicProfileBootstrapContext";
import JourneyIcon from "../../../assets/icons/JourneyIcon";
import TransportationIcon from "../../../assets/icons/TransportationIcon";
import StayIcon from "../../../assets/icons/StayIcon";
import BudgetIcon from "../../../assets/icons/BudgetIcon";
import TipsIcon from "../../../assets/icons/TipsIcon";
import DayNavigationView from "./PublicGuideViews/DayNavigationView";
import PublicGuideTransportView from "./PublicGuideViews/PublicGuideTransportView";
import PublicGuideStayView from "./PublicGuideViews/PublicGuideStayView";
import PublicGuideBudgetView from "./PublicGuideViews/PublicGuideBudgetView";
import PublicGuideTipsView from "./PublicGuideViews/PublicGuideTipsView";
import GuideMapView from "./PublicGuideViews/GuideMapView";
import Button from "../../../components/ui/Button";
import WhiteMap from "../../../assets/icons/WhiteMap";
import { parseTimeline, parseStay, parseBudget } from "../../Guides/utils/guideDataParser";
import { getTransportSegments } from "../../Guides/utils/guideHelpers";
import SEO from "../../../components/SEO";
import { createCanonicalUrl, getBaseUrl } from "../../../utils/getCurrentDomain";
import { createLocationGEOData } from "../../../utils/geoHelpers";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { PublicProfileFallbackRedirect } from "../../../routes/PublicProfileFallbackRedirect";
import { resolvePublicChildState } from "../../../routes/resolvePublicChildState";
import {
  mergePublicConnectionPage,
  usePublicConnectionPagination,
} from "../../../hooks/usePublicConnectionPagination";
import { PublicConnectionPaginationControl } from "../../../components/PublicConnectionPaginationControl";
import { usePublicLeafRequestGeneration } from "../../../layouts/PublicRouteReadinessContext";

const PublicGuideDetailPage = memo(() => {
  const { username, guideSlug } = useParams<{ username: string; guideSlug: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("journey");
  const [selectedDay, setSelectedDay] = useState<string>("overview");
  const [isMapView, setIsMapView] = useState(false);
  const [highlightedPlaceId, setHighlightedPlaceId] = useState<string | null>(null);
  const [isMainTabsSticky, setIsMainTabsSticky] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mainTabsRef = useRef<HTMLDivElement>(null);
  const coverImageRef = useRef<HTMLDivElement>(null);
  const dayTabsRef = useRef<HTMLDivElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [isDayTabsSticky, setIsDayTabsSticky] = useState(false);
  const lastScrollTop = useRef(0);

  const handleBack = () => {
    navigate(`/${username}/guides`);
  };


  const accountDocumentId = usePublicProfileBootstrapAccount().documentId;
  const requestGeneration = usePublicLeafRequestGeneration(`${accountDocumentId}:${guideSlug}`);

  const {
    data,
    loading,
    error,
    refetch,
    fetchMore,
  } = useQuery(GET_PUBLIC_GUIDE_BY_SLUG_QUERY, {
    variables: {
      accountDocumentId,
      slug: guideSlug,
      documentId: guideSlug,
      sectionPagination: { page: 1, pageSize: 200 },
    },
    skip: !accountDocumentId || !guideSlug,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const guideRecord = data?.guides?.[0];
  const guide = useMemo(() => guideRecord ? ({
    ...guideRecord,
    guide_sections: data?.guideSections_connection?.nodes ?? [],
  }) : undefined, [data?.guideSections_connection?.nodes, guideRecord]);
  const childState = resolvePublicChildState({
    loading,
    error,
    bootstrapReady: Boolean(accountDocumentId && guideSlug),
    resourceKind: "child",
    entityExists: Boolean(guide),
    empty: false,
  });

  usePublicRouteLifecycle({
    loading,
    error,
    retry: refetch,
    hasUsableData: Boolean(guide),
    empty: childState === "empty",
  });

  const loadSectionPage = useCallback(async (
    page: number,
    request: { isCurrent: () => boolean },
  ) => {
    await fetchMore({
      variables: { sectionPagination: { page, pageSize: 200 } },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!request.isCurrent()) return previous;
        const previousConnection = previous.guideSections_connection;
        const nextConnection = fetchMoreResult?.guideSections_connection;
        if (!previousConnection || !nextConnection) return previous;
        return {
          ...previous,
          guideSections_connection: mergePublicConnectionPage(
            previousConnection,
            nextConnection,
          ),
        };
      },
    });
  }, [fetchMore]);
  const sectionPagination = usePublicConnectionPagination({
    pageInfo: data?.guideSections_connection?.pageInfo,
    loadPage: loadSectionPage,
    resetKey: `${accountDocumentId}:${guideSlug}`,
  });

  // Scroll detection for sticky tabs and header visibility
  // This effect needs to run after guide data is loaded and DOM is ready
  useEffect(() => {
    // Wait for guide data to be loaded
    if (loading || !guide) return;

    let cleanup: (() => void) | null = null;
    let timeoutId: NodeJS.Timeout;

    const initializeScroll = () => {
      const scrollContainer = scrollContainerRef.current;
      const mainTabs = mainTabsRef.current;
      const coverImage = coverImageRef.current;

      if (!scrollContainer || !mainTabs) {
        // Retry after a short delay if refs aren't ready
        timeoutId = setTimeout(initializeScroll, 100);
        return;
      }

      let ticking = false;

      const handleScroll = () => {
        if (!ticking) {
          window.requestAnimationFrame(() => {
            // Get scroll position from container (prioritize container scroll)
            const containerScrollTop = scrollContainer.scrollTop || 0;
            const windowScrollTop = window.scrollY || window.pageYOffset || 0;
            // Use the scroll position that's actually changing
            const currentScrollTop = containerScrollTop > 0 ? containerScrollTop : windowScrollTop;

            const headerHeight = 56; // h-14 = 56px

            // Calculate when tabs should become sticky
            // Tabs should stick when we've scrolled past the cover image
            if (coverImage) {
              // Get positions relative to the viewport
              const coverImageRect = coverImage.getBoundingClientRect();

              // Tabs should stick when cover image bottom is above the header
              // This means: coverImageRect.bottom <= headerHeight
              setIsMainTabsSticky(coverImageRect.bottom <= headerHeight);
            } else {
              // Fallback: use tabs position relative to scroll container
              const tabsOffsetTop = mainTabs.offsetTop - (scrollContainer.offsetTop || 0);
              setIsMainTabsSticky(currentScrollTop + headerHeight >= tabsOffsetTop);
            }

            // Hide/show header based on scroll direction
            const scrollDelta = currentScrollTop - lastScrollTop.current;

            // Always show header at the very top (within 20px of top)
            if (currentScrollTop <= 20) {
              setIsHeaderVisible(true);
            } else if (Math.abs(scrollDelta) > 3) {
              // Only update if scroll delta is significant enough to avoid flickering
              if (scrollDelta > 0) {
                // Scrolling down - hide header
                setIsHeaderVisible(false);
              } else {
                // Scrolling up - show header
                setIsHeaderVisible(true);
              }
            }

            lastScrollTop.current = currentScrollTop;
            ticking = false;
          });
          ticking = true;
        }
      };

      // Listen to both container and window scroll events
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('scroll', handleScroll, { passive: true });

      // Initial check after a small delay to ensure DOM is fully rendered
      setTimeout(() => {
        handleScroll();
      }, 100);

      cleanup = () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
        window.removeEventListener('scroll', handleScroll);
      };
    };

    // Initialize after a short delay to ensure DOM is ready
    timeoutId = setTimeout(initializeScroll, 50);

    return () => {
      clearTimeout(timeoutId);
      if (cleanup) {
        cleanup();
      }
    };
  }, [loading, guide]);

  // Parse guide sections and remove duplicates
  // IMPORTANT: Only include sections that belong to THIS guide
  const sections = useMemo(() => {
    if (!guide?.guide_sections) {
      console.log('[PublicGuideDetailPage] No guide_sections found');
      return [];
    }

    const allSections = guide.guide_sections || [];

    // Filter out duplicates and ensure sections belong to this guide
    const uniqueSections = allSections.filter(
      (section: any, index: number, self: any[]) => {
        // Remove duplicates by documentId
        const isUnique = index === self.findIndex((s: any) => s.documentId === section.documentId);

        // Validate section has required properties
        const isValid = section && typeof section === 'object';

        if (!isValid) {
          console.warn('[PublicGuideDetailPage] Invalid section found:', section);
        }

        return isUnique && isValid;
      }
    ).sort((a: any, b: any) => {
      // Handle both numeric and string sequences
      const seqA = typeof a.Sequence === 'number' ? a.Sequence : (typeof a.Sequence === 'string' ? parseInt(a.Sequence, 10) : 0);
      const seqB = typeof b.Sequence === 'number' ? b.Sequence : (typeof b.Sequence === 'string' ? parseInt(b.Sequence, 10) : 0);
      return (seqA || 0) - (seqB || 0);
    });

    console.log(`[PublicGuideDetailPage] Processed ${uniqueSections.length} unique sections for guide: ${guide.Title || guide.documentId}`);

    return uniqueSections;
  }, [guide?.guide_sections, guide?.Title, guide?.documentId]);

  // Helper function to get days with data for a specific tab
  const getDaysWithDataForTab = useMemo(() => {
    return (tabId: string) => {
      if (!sections || sections.length === 0) return [];

      let filteredSections: any[] = [];

      switch (tabId) {
        case "journey":
          // Journey: sections with timeline data (places) or Description
          filteredSections = sections.filter((section: any) => {
            const timeline = parseTimeline(section.Timeline);
            const hasPlaces =
              (timeline.morning?.length || 0) +
              (timeline.afternoon?.length || 0) +
              (timeline.evening?.length || 0) >
              0;
            return hasPlaces || section.Description;
          });
          break;

        case "transportation":
          // Transport: sections with transport segments
          filteredSections = sections.filter((section: any) => {
            const segments = getTransportSegments(section);
            return segments.length > 0;
          });
          break;

        case "stay":
          // Stay: sections with stay data (accommodations)
          filteredSections = sections.filter((section: any) => {
            if (!section.Stay) return false;
            const stayData = parseStay(section.Stay);
            const accoms = Array.isArray(stayData.accommodations)
              ? stayData.accommodations
              : [];
            return accoms.length > 0;
          });
          break;

        case "budget":
          // Budget: sections with budget data
          filteredSections = sections.filter((section: any) => {
            if (!section.Budget) return false;
            const budget = parseBudget(section.Budget);
            const allBudgetPlaces = [
              ...(budget.morning || []),
              ...(budget.afternoon || []),
              ...(budget.evening || []),
            ];
            return allBudgetPlaces.some(
              (place: any) =>
                place &&
                (place.budgetAmount !== undefined ||
                  place.customBudget ||
                  place.priceRange ||
                  (typeof place.priceLevel === "number" && place.priceLevel !== null))
            );
          });
          break;

        case "tips":
          // Tips: sections with tips in places or guide-level tips
          filteredSections = sections.filter((section: any) => {
            const timeline = parseTimeline(section.Timeline);
            const allPlaces = [
              ...(timeline.morning || []),
              ...(timeline.afternoon || []),
              ...(timeline.evening || []),
            ];
            return allPlaces.some(
              (place: any) => place && typeof place.tips === "string" && place.tips.trim().length > 0
            );
          });
          break;

        default:
          // Default: return all sections
          filteredSections = sections;
      }

      return filteredSections.sort((a: any, b: any) => {
        const seqA = typeof a.Sequence === 'number' ? a.Sequence : (typeof a.Sequence === 'string' ? parseInt(a.Sequence, 10) : 0);
        const seqB = typeof b.Sequence === 'number' ? b.Sequence : (typeof b.Sequence === 'string' ? parseInt(b.Sequence, 10) : 0);
        return (seqA || 0) - (seqB || 0);
      });
    };
  }, [sections]);

  // Get days with data for the current active tab
  const daysWithData = useMemo(() => {
    return getDaysWithDataForTab(activeTab);
  }, [activeTab, getDaysWithDataForTab]);

  // Check if a tab has any data (at least one day with data)
  const tabHasData = useCallback((tabId: string): boolean => {
    const daysForTab = getDaysWithDataForTab(tabId);

    // Special case for tips: also check for guide-level tips (Tips_Notes)
    if (tabId === "tips") {
      const hasGuideLevelTips = guide?.Tips_Notes && (
        (typeof guide.Tips_Notes === "string" && guide.Tips_Notes.trim().length > 0) ||
        (Array.isArray(guide.Tips_Notes) && guide.Tips_Notes.length > 0)
      );
      return daysForTab.length > 0 || hasGuideLevelTips;
    }

    return daysForTab.length > 0;
  }, [getDaysWithDataForTab, guide?.Tips_Notes]);

  // Get available tabs (tabs that have at least one day with data)
  const availableTabs = useMemo(() => {
    const allTabs = [
      { id: "journey", icon: JourneyIcon, label: "Journey" },
      { id: "transportation", icon: TransportationIcon, label: "Transport" },
      { id: "stay", icon: StayIcon, label: "Stay" },
      { id: "budget", icon: BudgetIcon, label: "Budget" },
      { id: "tips", icon: TipsIcon, label: "Tips" },
    ];

    return allTabs.filter(tab => tabHasData(tab.id));
  }, [tabHasData]);

  // Ensure activeTab is valid - if current activeTab has no data, switch to first available tab
  useEffect(() => {
    if (availableTabs.length > 0) {
      // If current activeTab has no data, switch to first available tab
      if (!tabHasData(activeTab)) {
        setActiveTab(availableTabs[0].id);
        setSelectedDay("overview");
      }
    }
  }, [activeTab, availableTabs, tabHasData]);

  // Handle tab change - reset to overview if current selectedDay doesn't exist in new tab
  const handleTabChange = useCallback((newTab: string) => {
    setActiveTab(newTab);
    // Check if current selectedDay exists in the new tab's days
    if (selectedDay !== "overview") {
      const daysForNewTab = getDaysWithDataForTab(newTab);
      const dayNum = parseInt(selectedDay.replace("day-", ""));
      const dayExists = daysForNewTab.some((day: any) => (day.Sequence || 0) === dayNum);
      if (!dayExists) {
        setSelectedDay("overview");
      }
    }
  }, [selectedDay, getDaysWithDataForTab]);

  // Scroll detection for sticky day tabs
  useEffect(() => {
    if (!scrollContainerRef?.current || !dayTabsRef.current) return;

    const scrollContainer = scrollContainerRef.current;
    const dayTabs = dayTabsRef.current;

    const handleScroll = () => {
      // Day tabs should only be sticky when:
      // 1. Main tabs are sticky (we've scrolled past cover image)
      // 2. AND day tabs would be scrolled past their position
      if (isMainTabsSticky) {
        // Get positions relative to the viewport
        const dayTabsRect = dayTabs.getBoundingClientRect();
        const headerHeight = 56; // h-14 = 56px
        // Main tabs height: ~80px mobile, ~96px sm, ~120px md, ~168px lg, ~184px xl
        const mainTabsHeight = window.innerWidth >= 1280 ? 184 : (window.innerWidth >= 1024 ? 168 : (window.innerWidth >= 768 ? 120 : (window.innerWidth >= 640 ? 96 : 80)));
        const stickyTopPosition = headerHeight + mainTabsHeight;

        // Day tabs should stick when they would scroll above the sticky position
        setIsDayTabsSticky(dayTabsRect.top <= stickyTopPosition);
      } else {
        // If main tabs aren't sticky, day tabs shouldn't be sticky either
        setIsDayTabsSticky(false);
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [scrollContainerRef, isMainTabsSticky]);

  // Check scroll position for mobile arrows
  useEffect(() => {
    const checkScroll = () => {
      if (tabsScrollRef.current) {
        const { scrollLeft } = tabsScrollRef.current;
        setShowLeftArrow(scrollLeft > 10);
      }
    };

    checkScroll();
    const scrollContainer = tabsScrollRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        scrollContainer.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [selectedDay, daysWithData]);

  // Parse Place_Details to extract location information
  const placeDetails = useMemo(() => {
    if (!guide?.Place_Details) return null;
    try {
      return typeof guide.Place_Details === "string"
        ? JSON.parse(guide.Place_Details)
        : guide.Place_Details;
    } catch {
      return null;
    }
  }, [guide?.Place_Details]);

  // Check if guide has places with coordinates for map view
  const hasPlacesForMap = useMemo(() => {
    if (!sections || sections.length === 0) return false;

    for (const section of sections) {
      if (!section.Timeline) continue;
      const timeline = parseTimeline(section.Timeline);
      const allPlaces = [
        ...(timeline.morning || []),
        ...(timeline.afternoon || []),
        ...(timeline.evening || []),
      ];

      for (const place of allPlaces) {
        if (!place || typeof place !== 'object') continue;

        let lat: number | null = null;
        let lng: number | null = null;

        if (place.geometry?.location) {
          const location = place.geometry.location;
          // Handle both function and number types for lat/lng
          if (typeof location.lat === 'function' && typeof location.lng === 'function') {
            lat = Number((location.lat as any)());
            lng = Number((location.lng as any)());
          } else if (typeof location.lat === 'number' && typeof location.lng === 'number') {
            lat = location.lat;
            lng = location.lng;
          }
        }

        if (
          typeof lat === 'number' &&
          typeof lng === 'number' &&
          !isNaN(lat) &&
          !isNaN(lng) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180
        ) {
          return true;
        }
      }
    }

    return false;
  }, [sections]);

  // Extract location names for badges
  const locationNames = useMemo(() => {
    if (!placeDetails) return [];
    const locations: string[] = [];

    if (placeDetails.isMultiCity === true) {
      const departure = placeDetails.departure || placeDetails.from || placeDetails.starting;
      if (departure?.Place_Name) {
        locations.push(departure.Place_Name);
      } else if (departure?.Place_Address) {
        locations.push(departure.Place_Address);
      }

      const intermediateCities = placeDetails.intermediateCities || [];
      intermediateCities.forEach((city: any) => {
        if (city.Place_Name) {
          locations.push(city.Place_Name);
        } else if (city.Place_Address) {
          locations.push(city.Place_Address);
        }
      });

      const arrival = placeDetails.arrival || placeDetails.to || placeDetails.ending;
      if (arrival?.Place_Name) {
        locations.push(arrival.Place_Name);
      } else if (arrival?.Place_Address) {
        locations.push(arrival.Place_Address);
      }
    } else {
      if (placeDetails.Place_Name) {
        locations.push(placeDetails.Place_Name);
      } else if (placeDetails.Place_Address) {
        locations.push(placeDetails.Place_Address);
      }
    }

    return locations.filter(loc => loc && loc.trim() !== "");
  }, [placeDetails]);

  // Determine guide format (Itinerary or Theme)
  const guideFormat = guide?.Guide_Type || "Itinerary";

  // Determine if single or multi-city (check both guide field and placeDetails)
  const isMultiCity = guide?.is_Multicity === true || placeDetails?.isMultiCity === true;

  // Get Budget Type label
  const getBudgetTypeLabel = (budgetType: string | null | undefined): string => {
    if (!budgetType) return "";
    const budgetTypeMap: Record<string, string> = {
      "Budget": "Budget",
      "Mid_Range": "Mid-Range",
      "Luxury": "Luxury",
      "Backpacker": "Backpacker",
      "Ultra_Luxury": "Ultra-Luxury"
    };
    return budgetTypeMap[budgetType] || budgetType;
  };


  // SEO data
  const seoTitle = guide
    ? `${guide.Title} | Travel Guide | explorers`
    : "Travel Guide | explorers";
  const seoDescription = guide?.Description
    ? typeof guide.Description === "string"
      ? guide.Description
      : Array.isArray(guide.Description)
        ? guide.Description
          .map((block: any) => block.children?.map((child: any) => child.text).join(" "))
          .join(" ")
        : ""
    : `Explore ${guide?.Title || "this travel guide"} on explorers. Discover curated itineraries, travel tips, and destination insights.`;

  const seoKeywords = useMemo(() => {
    const keywords = [
      "travel guide",
      "travel itinerary",
      "explorers guide",
      guide?.Title || "",
      ...locationNames,
    ];
    if (guide?.Category) {
      const categories = Array.isArray(guide.Category)
        ? guide.Category
        : typeof guide.Category === "string"
          ? [guide.Category]
          : [];
      keywords.push(...categories);
    }
    return keywords.filter(Boolean);
  }, [guide, locationNames]);

  const guideCoords = useMemo(() => {
    if (!placeDetails) return undefined;
    if (placeDetails.isMultiCity) {
      const departure = placeDetails.departure || placeDetails.from;
      if (departure?.Geometry?.lat && departure?.Geometry?.lng) {
        return { lat: Number(departure.Geometry.lat), lng: Number(departure.Geometry.lng) };
      }
    } else {
      if (placeDetails.Geometry?.lat && placeDetails.Geometry?.lng) {
        return { lat: Number(placeDetails.Geometry.lat), lng: Number(placeDetails.Geometry.lng) };
      }
    }
    return undefined;
  }, [placeDetails]);

  const geoData = useMemo(() => {
    if (!guide) return undefined;
    const categories = Array.isArray(guide.Category)
      ? guide.Category
      : typeof guide.Category === "string"
        ? [guide.Category]
        : [];
    return createLocationGEOData({
      locationName: locationNames.join(', ') || "Various Locations",
      recommenderName: username || "explorers User",
      placesCount: sections?.length || 0,
      topCategories: categories,
      locationNote: seoDescription,
      coordinates: guideCoords,
    });
  }, [guide, locationNames, username, sections, seoDescription, guideCoords]);

  if (childState === "redirect") return <PublicProfileFallbackRedirect expectedGeneration={requestGeneration} />;

  if (!guide) return null;

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        keywords={seoKeywords}
        canonical={createCanonicalUrl(`/${username}/guides/${guideSlug}`)}
        image={guide.Guide_Media?.[0]?.url || `${getBaseUrl()}/og-guide-image.jpg`}
        url={createCanonicalUrl(`/${username}/guides/${guideSlug}`)}
        type="article"
        author={username || "explorers User"}
        siteName="explorers"
        noIndex={!guide.Visibility}
        enableGEO={true}
        geoData={geoData}
      />

      {/* CSS for animated scrolling locations */}
      <style>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>

      <div ref={scrollContainerRef} className="h-full bg-black min-h-screen overflow-auto preview-scroll pb-20">
        {/* Fixed Header */}
        <div className={`fixed top-0 left-0 right-0 z-50 bg-[#2a2a2a]/90 backdrop-blur-sm border-b border-gray-700 h-14 transition-transform duration-300 ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
          }`}>
          <div className="max-w-4xl mx-auto flex items-center justify-between h-full px-6">
            <span
              className="text-white font-bold text-2xl cursor-pointer"
              onClick={() => navigate("/")}
            >
              explorers.earth
            </span>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const shareUrl = `${window.location.origin}/${username}/guides/${guideSlug}`;
                  if (navigator.share) {
                    navigator.share({
                      title: `${guide?.Title || 'Guide'}`,
                      text: "Check out this guide!",
                      url: shareUrl,
                    }).catch(() => { });
                  } else {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      toast.success("Link copied!");
                    } catch (error) {
                      console.error("Failed to copy text:", error);
                    }
                  }
                }}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center"
                aria-label="Share"
              >
                <Share2 className="h-4 w-4" style={{ color: 'white' }} />
              </button>

            </div>
          </div>
        </div>

        {/* Centered Container - Matching other public pages */}
        <div className="md:max-w-5xl md:mx-auto mt-14 px-4 sm:px-6">
          {/* Guide Header with Cover Image and Badges */}
          <div
            ref={coverImageRef}
            className="relative w-full h-64 sm:h-80 md:h-96 lg:h-[500px] bg-cover bg-center flex-shrink-0 overflow-hidden mt-4 mb-4 rounded-lg"
            style={{
              backgroundImage: guide.Guide_Media?.[0]?.url
                ? `url('${guide.Guide_Media[0].url}')`
                : "linear-gradient(135deg, hsl(var(--blue-cta)) 0%, hsl(var(--blue-final)) 100%)",
            }}
          >
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-black/30" />

            {/* Top Right Section - Close Button */}
            <div className="absolute top-3 sm:top-4 md:top-5 right-3 sm:right-4 md:right-6 lg:right-8 z-30">
              <button
                onClick={handleBack}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/30 hover:border-white/50 flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-xl"
                aria-label="Close guide"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Top Left Section - Main Badges - Enhanced Premium Design */}
            <div className="absolute top-4 sm:top-5 md:top-6 left-4 sm:left-5 md:left-6 lg:left-8 z-30">
              {/* Badges Group - Premium Layout with Enhanced Styling */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 md:gap-2.5">
                {/* Guide Type Badge - Single City / Multi City with Enhanced Styling */}
                {isMultiCity ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="group relative flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 md:px-3 md:py-2 bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 backdrop-blur-lg rounded-lg sm:rounded-xl border border-purple-300/80 shadow-xl hover:shadow-purple-500/50 transition-all duration-300 hover:scale-110 ring-2 ring-purple-400/20 hover:ring-purple-400/40 overflow-hidden"
                  >
                    {/* Animated background shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4.5 md:h-4.5 text-white relative z-10 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <span className="text-white text-[9px] sm:text-[10px] md:text-xs font-black font-poppins tracking-wider whitespace-nowrap drop-shadow-xl relative z-10 uppercase">
                      Multi City
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="group relative flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 md:px-3 md:py-2 bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 backdrop-blur-lg rounded-lg sm:rounded-xl border border-emerald-300/80 shadow-xl hover:shadow-emerald-500/50 transition-all duration-300 hover:scale-110 ring-2 ring-emerald-400/20 hover:ring-emerald-400/40 overflow-hidden"
                  >
                    {/* Animated background shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4.5 md:h-4.5 text-white relative z-10 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-white text-[9px] sm:text-[10px] md:text-xs font-black font-poppins tracking-wider whitespace-nowrap drop-shadow-xl relative z-10 uppercase">
                      Single City
                    </span>
                  </motion.div>
                )}

                {/* Guide Format Badge - Itinerary or Theme - Enhanced */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="group relative flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 md:px-3 md:py-2 bg-gradient-to-r from-[hsl(var(--blue-cta))] via-[hsl(var(--blue-cta))] to-[hsl(var(--blue-final))] backdrop-blur-lg rounded-lg sm:rounded-xl border border-[hsl(var(--blue-cta))]/70 shadow-xl hover:shadow-[hsl(var(--blue-cta))]/50 transition-all duration-300 hover:scale-110 ring-2 ring-[hsl(var(--blue-cta))]/20 hover:ring-[hsl(var(--blue-cta))]/40 overflow-hidden"
                >
                  {/* Animated background shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-4.5 md:h-4.5 text-white relative z-10 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="text-white text-[9px] sm:text-[10px] md:text-xs font-black font-poppins tracking-wider whitespace-nowrap drop-shadow-xl relative z-10">
                    {guideFormat}
                  </span>
                </motion.div>

                {/* Budget Type Badge - Enhanced */}
                {guide?.Budget_Type && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="group relative flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 md:px-4 md:py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 backdrop-blur-lg rounded-xl sm:rounded-2xl border-2 border-amber-300/80 shadow-2xl hover:shadow-amber-500/50 transition-all duration-300 hover:scale-110 ring-4 ring-amber-400/20 hover:ring-amber-400/40 overflow-hidden"
                  >
                    {/* Animated background shimmer */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 text-white relative z-10 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-white text-[10px] sm:text-xs md:text-xs font-black font-poppins tracking-wider whitespace-nowrap drop-shadow-xl relative z-10">
                      {getBudgetTypeLabel(guide.Budget_Type)}
                    </span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Content Container - Title and Location at Bottom */}
            <div className="absolute bottom-0 left-0 right-0 z-10 p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12 text-white">
              <div className="flex-1 min-w-0">
                {/* Title with Beautiful Font - Smaller and More Attractive with Days Badge */}
                <div className="mb-4 sm:mb-5 md:mb-6">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl line-clamp-3 text-white" style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                      lineHeight: '1.3',
                      textShadow: '0 3px 10px rgba(0,0,0,0.8), 0 6px 20px rgba(0,0,0,0.6), 0 10px 30px rgba(0,0,0,0.4)',
                      textRendering: 'optimizeLegibility',
                      WebkitFontSmoothing: 'antialiased',
                      MozOsxFontSmoothing: 'grayscale'
                    }}>
                      {guide.Title}
                    </h1>
                    {/* Total Days Badge - Immediately Right of Title - Smaller */}
                    {guide.Number_Of_Days && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                        className="group relative flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 md:px-3 md:py-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-500 backdrop-blur-lg rounded-lg sm:rounded-xl border-2 border-indigo-300/80 shadow-2xl hover:shadow-indigo-500/50 transition-all duration-300 hover:scale-110 ring-4 ring-indigo-400/20 hover:ring-indigo-400/40 overflow-hidden flex-shrink-0"
                      >
                        {/* Animated background shimmer */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-white relative z-10 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-white text-[9px] sm:text-[10px] md:text-xs font-black font-poppins tracking-wider whitespace-nowrap drop-shadow-xl relative z-10">
                          {guide.Number_Of_Days} {guide.Number_Of_Days === 1 ? "Day" : "Days"}
                        </span>
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Location Names - Enhanced Premium Design */}
                {locationNames.length > 0 && (
                  <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5 overflow-hidden">
                    {/* Enhanced Location Pin Icon */}
                    <div className="relative flex-shrink-0">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.5, type: "spring" }}
                        className="relative"
                      >
                        <svg className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 text-[hsl(var(--blue-cta))] drop-shadow-2xl filter" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          {/* Glowing effect */}
                          <circle cx="12" cy="10" r="6" fill="currentColor" fillOpacity="0.9" className="drop-shadow-lg">
                            <animate attributeName="opacity" values="0.9;1;0.9" dur="2s" repeatCount="indefinite" />
                          </circle>
                          <circle cx="12" cy="10" r="6" stroke="white" strokeWidth="2" />
                          <path d="M12 16 L12 22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                      </motion.div>
                    </div>
                    {/* Location Names Container - Enhanced */}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-3 md:flex-wrap md:overflow-visible">
                        {/* Desktop: Enhanced display with badges */}
                        <div className="hidden md:flex items-center gap-2.5 flex-wrap">
                          {locationNames.map((location, index) => (
                            <motion.span
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.4, delay: index * 0.1 }}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-lg border border-white/20 shadow-lg hover:bg-white/15 transition-all duration-300"
                            >
                              <span className="text-white text-sm md:text-base font-medium font-poppins whitespace-nowrap" style={{
                                textShadow: '0 2px 6px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6)',
                                letterSpacing: '0.01em',
                                textRendering: 'optimizeLegibility',
                                WebkitFontSmoothing: 'antialiased',
                                MozOsxFontSmoothing: 'grayscale'
                              }}>
                                {location}
                              </span>
                              {index < locationNames.length - 1 && (
                                <span className="text-[hsl(var(--blue-cta))]/90 font-bold text-lg opacity-90">→</span>
                              )}
                            </motion.span>
                          ))}
                        </div>
                        {/* Mobile: Enhanced animated scrolling */}
                        <div className="md:hidden flex items-center gap-3 overflow-hidden">
                          <div className="flex items-center gap-3 whitespace-nowrap">
                            {/* For single city: show once without animation, for multiple cities: show with animation */}
                            {locationNames.length === 1 ? (
                              <span className="inline-flex items-center px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-lg border border-white/20 text-white text-xs font-medium font-poppins whitespace-nowrap mx-1" style={{
                                textShadow: '0 2px 6px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6)',
                                letterSpacing: '0.01em',
                                textRendering: 'optimizeLegibility',
                                WebkitFontSmoothing: 'antialiased',
                                MozOsxFontSmoothing: 'grayscale'
                              }}>
                                {locationNames[0]}
                              </span>
                            ) : (
                              <div className="flex items-center gap-3 animate-scroll whitespace-nowrap" style={{
                                animation: 'scroll 20s linear infinite',
                              }}>
                                {[...locationNames, ...locationNames].map((location, index) => (
                                  <span key={index} className="inline-flex items-center px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-lg border border-white/20 text-white text-xs font-medium font-poppins whitespace-nowrap mx-1" style={{
                                    textShadow: '0 2px 6px rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.6)',
                                    letterSpacing: '0.01em',
                                    textRendering: 'optimizeLegibility',
                                    WebkitFontSmoothing: 'antialiased',
                                    MozOsxFontSmoothing: 'grayscale'
                                  }}>
                                    {location}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Budget */}
                {guide.Estimated_Budget &&
                  (guide.Estimated_Budget.currency ||
                    guide.Estimated_Budget.amount) && (
                    <p className="text-sm sm:text-base md:text-lg mt-2 font-semibold font-poppins">
                      Budget: {guide.Estimated_Budget.currency}{" "}
                      {guide.Estimated_Budget.amount}
                    </p>
                  )}
              </div>
            </div>
          </div>

          {/* Tabs - Sticky when scrolled - Centered - Below header */}
          <div
            ref={mainTabsRef}
            className={`z-40 bg-black border-b border-gray-700 flex-shrink-0 shadow-lg transition-all duration-200 ${isMainTabsSticky
              ? `fixed left-0 right-0 ${isHeaderVisible ? 'top-14' : 'top-0'}`
              : 'relative'
              }`}
          >
            <div className={`px-4 sm:px-6 ${isMainTabsSticky ? 'max-w-5xl mx-auto' : ''}`}>
              <div className="flex justify-center items-center gap-1 sm:gap-2 md:gap-4 lg:gap-6 xl:gap-8 py-2 sm:py-3 md:py-4 lg:py-6 overflow-x-auto scrollbar-hide">
                {availableTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const IconComponent = tab.icon;
                  return (
                    <div
                      key={tab.id}
                      className="flex flex-col items-center cursor-pointer group flex-shrink-0"
                      onClick={() => handleTabChange(tab.id)}
                    >
                      <motion.div
                        className={`
                      relative w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 xl:w-24 xl:h-24 rounded-full 
                      flex items-center justify-center
                      transition-all duration-300
                      ${isActive
                            ? "bg-blue-500 border-2 border-blue-500"
                            : "bg-gray-800 border-2 border-gray-600 group-hover:border-blue-500/60"
                          }
                    `}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        animate={{
                          scale: isActive ? 1 : 0.95,
                        }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <motion.div
                          className={`
                        transition-all duration-300
                        ${isActive ? "scale-110" : ""}
                      `}
                        >
                          <IconComponent
                            size={isActive ? "5" : "4"}
                            color={isActive ? "#ffffff" : "#9CA3AF"}
                          />
                        </motion.div>
                      </motion.div>
                      <motion.p
                        className={`
                      mt-1 sm:mt-1.5 md:mt-2 lg:mt-2.5 text-[10px] sm:text-xs md:text-sm lg:text-base font-poppins font-semibold
                      transition-all duration-300 text-center whitespace-nowrap
                      ${isActive
                            ? "text-blue-400"
                            : "text-gray-400 group-hover:text-gray-300"
                          }
                    `}
                      >
                        {tab.label}
                      </motion.p>
                      {isActive && (
                        <div className="mt-0.5 sm:mt-0.5 md:mt-1 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-blue-400" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Day Navigation Tabs - Scrollable and Centered - Sticky below main tabs */}
          {daysWithData.length > 0 && (
            <div
              ref={dayTabsRef}
              className={`z-30 py-2 sm:py-3 transition-all duration-200 ${isDayTabsSticky
                ? `fixed left-0 right-0 bg-gray-900/95 backdrop-blur-md shadow-lg border-b border-gray-800 ${isMainTabsSticky
                  ? (isHeaderVisible
                    ? 'top-[136px] sm:top-[152px] md:top-[176px] lg:top-[224px] xl:top-[240px]'
                    : 'top-[80px] sm:top-[96px] md:top-[120px] lg:top-[168px] xl:top-[184px]')
                  : (isHeaderVisible ? 'top-14' : 'top-0')
                }`
                : 'relative'
                }`}
            >
              <div className={`relative flex justify-center items-center ${isDayTabsSticky ? 'max-w-5xl mx-auto px-4 sm:px-6' : ''}`}>
                {/* Mobile Left Arrow - Only visible on mobile when scrolled */}
                <button
                  onClick={() => {
                    if (tabsScrollRef.current) {
                      tabsScrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
                    }
                  }}
                  className={`md:hidden absolute left-0 z-10 w-8 h-8 rounded-full bg-gray-800/90 backdrop-blur-md border border-gray-700/60 flex items-center justify-center transition-opacity duration-200 ${showLeftArrow ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                >
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {/* Scrollable Tabs Container - Enhanced */}
                <div
                  className="overflow-x-auto scrollbar-hide max-w-full"
                  ref={tabsScrollRef}
                  onScroll={() => {
                    if (tabsScrollRef.current) {
                      const { scrollLeft } = tabsScrollRef.current;
                      setShowLeftArrow(scrollLeft > 10);
                    }
                  }}
                >
                  <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 rounded-2xl border border-gray-700/80 backdrop-blur-md p-2 sm:p-3 shadow-xl inline-flex items-center gap-2 sm:gap-3 min-w-max mx-auto">
                    <button
                      onClick={() => setSelectedDay("overview")}
                      className={`px-3 py-1.5 sm:px-6 sm:py-3 md:px-7 md:py-3.5 rounded-lg sm:rounded-xl font-poppins font-bold text-xs sm:text-sm md:text-base whitespace-nowrap transition-all duration-300 flex-shrink-0 ${selectedDay === "overview"
                        ? "bg-gradient-to-r from-[hsl(var(--blue-cta))] to-[hsl(var(--blue-final))] text-white shadow-xl shadow-[hsl(var(--blue-cta))]/40 ring-2 ring-[hsl(var(--blue-cta))]/30 scale-105"
                        : "bg-gray-800/80 text-gray-300 hover:bg-gray-700/90 hover:text-white hover:scale-105 border border-gray-700/50"
                        }`}
                    >
                      Overview
                    </button>
                    {daysWithData.map((day: any) => {
                      const dayNum = day.Sequence || 0;
                      const dayId = `day-${dayNum}`;
                      return (
                        <button
                          key={day.documentId || dayId}
                          onClick={() => setSelectedDay(dayId)}
                          className={`px-3 py-1.5 sm:px-6 sm:py-3 md:px-7 md:py-3.5 rounded-lg sm:rounded-xl font-poppins font-bold text-xs sm:text-sm md:text-base whitespace-nowrap transition-all duration-300 flex-shrink-0 ${selectedDay === dayId
                            ? "bg-gradient-to-r from-[hsl(var(--blue-cta))] to-[hsl(var(--blue-final))] text-white shadow-xl shadow-[hsl(var(--blue-cta))]/40 ring-2 ring-[hsl(var(--blue-cta))]/30 scale-105"
                            : "bg-gray-800/80 text-blue-500 hover:bg-gray-700/90 hover:text-blue-400 hover:scale-105 border border-gray-700/50"
                            }`}
                        >
                          Day {dayNum}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content - Centered Layout */}
          <div className="bg-black flex-1">
            <div className="py-4 sm:py-6 md:py-8">
              <AnimatePresence mode="wait">
                {activeTab === "journey" && (
                  <motion.div
                    key="journey"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <DayNavigationView sections={sections} guide={guide} selectedDay={selectedDay} />
                  </motion.div>
                )}
                {activeTab === "transportation" && (
                  <motion.div
                    key="transportation"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <PublicGuideTransportView guide={guide} sections={sections} selectedDay={selectedDay} />
                  </motion.div>
                )}
                {activeTab === "stay" && (
                  <motion.div
                    key="stay"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <PublicGuideStayView guide={guide} sections={sections} selectedDay={selectedDay} />
                  </motion.div>
                )}
                {activeTab === "budget" && (
                  <motion.div
                    key="budget"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <PublicGuideBudgetView guide={guide} sections={sections} selectedDay={selectedDay} />
                  </motion.div>
                )}
                {activeTab === "tips" && (
                  <motion.div
                    key="tips"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <PublicGuideTipsView guide={guide} sections={sections} selectedDay={selectedDay} />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex justify-center pb-8">
                <PublicConnectionPaginationControl
                  hasNextPage={sectionPagination.hasNextPage}
                  isLoading={sectionPagination.isLoadingNextPage}
                  error={sectionPagination.nextPageError}
                  onLoadMore={() => void sectionPagination.loadNextPage()}
                  onRetry={() => void sectionPagination.retryNextPage()}
                  label="guide days"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Map Button - Only show if guide has places with coordinates */}
      {hasPlacesForMap && !isMapView && (
        <div className="fixed bottom-[4.2rem] md:bottom-16 left-1/2 -translate-x-1/2 z-40 bg-black/20 rounded-lg p-0.5 backdrop-blur-sm">
          <Button
            startIcon={<WhiteMap />}
            btnText="Map View"
            variant="primary"
            size="xsmall"
            onClickHandler={() => setIsMapView(true)}
            className="bg-[hsl(var(--blue-cta))] hover:bg-[hsl(var(--blue-final))] shadow-lg shadow-blue-500/20"
          />
        </div>
      )}

      {/* Map View */}
      {isMapView && (
        <div className="fixed inset-0 z-50 bg-black">
          <GuideMapView
            sections={sections}
            guide={guide}
            isMapView={isMapView}
            onCloseMap={() => {
              setIsMapView(false);
              setHighlightedPlaceId(null);
            }}
            onPlaceClick={(place) => {
              if (place?.place_id) {
                setHighlightedPlaceId(place.place_id);
              }
            }}
            highlightedPlaceId={highlightedPlaceId}
          />
        </div>
      )}

    </>
  );
});

PublicGuideDetailPage.displayName = "PublicGuideDetailPage";

export default PublicGuideDetailPage;
