import { memo, useState, useRef, useMemo, useEffect } from "react";
import InstagramIcon from "../../../assets/icons/InstagramIcon";
import Button from "../../../components/ui/Button";
import { useQuery } from "@apollo/client";
import { accountsDetailQuery } from "../api/query";
import { recommendedPlacesQuery } from "../../Favorites/api/query";
import { useTrackAnalytics } from "../../../services/analyticsService";
import { EarthLoader } from "../../../components/EarthLoader";
import RecommendationCardSkeleton from "../../../components/ui/RecommendationCardSkeleton";
import WhiteMap from "../../../assets/icons/WhiteMap";
import Card from "../../../components/ui/Card";
import { useNavigate, useParams, useLocation } from "react-router-dom";

import { getCurrentDomain } from "../../../utils/getCurrentDomain";
import PlaceOverview from "./PlaceDetails/PlaceOverview";
import PersonOverview from "./PlaceDetails/PersonOverview";
import WhatsappIcon from "../../../assets/icons/WhatsappIcon";
import MobileIcon from "../../../assets/icons/MobileIcon";
import ShareModal from "../../../components/ShareModal";
import TwitterIcon from "../../../assets/icons/TwitterIcon";

import QRModal from "../../../components/ui/QRModal";
import { useQRActions } from "../../../hooks/useQRActions";
import { generateUserPlacesQRUrl } from "../../../utils/qrCodeService";
import { motion } from "framer-motion";
import CircularPlacesModal from "../../../components/CircularPlacesModal";
import ImageWithFallback from "../../../components/ui/ImageWithFallback";
import { IMAGE_CONFIG } from "../../../config";
import { toUrlSlug } from "../../../utils/formatAddress";
import SEO from "../../../components/SEO";
import { createLocationGEOData } from "../../../utils/geoHelpers";
import { getBaseUrl } from "../../../utils/getCurrentDomain";
import {
  extractUtmParamsFromCurrentUrl,
  createUtmParams,
} from "../../../utils/urlHelpers";
import Location from "../../../assets/icons/Location";
import { Share2, Copy } from "lucide-react";
import { AdvancedMarker, Map, Pin, useMap } from "@vis.gl/react-google-maps";
import { getPlaceCoordinatesQuery } from "../api/query";
import { toast } from "sonner";

type CardDataItem = {
  Media: {
    url: string;
  }[];
  media_details?: {
    scalarId?: string;
    thumbnail?: {
      id?: string;
      url?: string;
    };
    imageDetails?: {
      id: string;
      url: string;
    }[];
  };
  Place_Details: {
    Photos: string[];
    Place_Address: string;
    Place_Id: string;
    Place_Name: string;
    Rating: number;
    Rating_Count: number;
    Title: string;
  };
  Recommendation_Type?: "place" | "person";
  Contact_Name?: string;
  recommendation_category: { Category_Name: string };
  documentId: string;
};

interface City {
  List_Name?: string;
  recommended_places?: CardDataItem[];
  imageUrl?: string;
  documentId?: string;
  Visibility?: boolean;
  List_Name_Details?: {
    thumbnail?: string;
  };
  Social_URL?: string;
  recommendation_link?: string;
  Instagram_Media_URL?: string;
  Note?: string;
  description?: string;
}

// Helper function to get person image with avatar fallback
const getPersonImageUrl = (data: CardDataItem): string => {
  const imageUrl = data?.media_details?.thumbnail?.url || data?.media_details?.imageDetails?.[0]?.url || data?.Media?.[0]?.url;
  if (imageUrl) return imageUrl;

  // Return data URL for inline SVG avatar
  const svgString = `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="400" fill="#1a1a1a"/><circle cx="200" cy="160" r="70" fill="#2a2a2a"/><circle cx="200" cy="160" r="50" fill="#3a3a3a"/><ellipse cx="200" cy="320" rx="100" ry="80" fill="#3a3a3a"/><circle cx="200" cy="200" r="120" fill="none" stroke="#2a2a2a" stroke-width="2" opacity="0.3"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svgString)}`;
};

// Smooth map controller for preview - only sets initial position once
const MapPreviewController = ({ targetCoords, targetZoom }: { targetCoords: { lat: number; lng: number }; targetZoom: number }) => {
  const map = useMap();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (map && targetCoords && !hasInitialized.current) {
      map.moveCamera({
        center: targetCoords,
        zoom: targetZoom,
      });
      hasInitialized.current = true;
    }
  }, [map, targetCoords, targetZoom]);

  return null;
};

const PublicHome = memo(() => {
  const { username, placeSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const cityRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [showAllPlaces, setShowAllPlaces] = useState<boolean>(false);
  const mobileObserverTarget = useRef<HTMLDivElement>(null);
  const desktopObserverTarget = useRef<HTMLDivElement>(null);
  const mobileScrollContainerRef = useRef<HTMLDivElement>(null);
  const desktopScrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasMoreData, setHasMoreData] = useState<boolean>(true);
  const animationTriggeredRef = useRef<boolean>(false);
  const previousPathnameRef = useRef<string>('');

  // Extract UTM parameters from current URL, or create default ones for QR codes
  const utmParams = useMemo(() => {
    const currentUtmParams = extractUtmParamsFromCurrentUrl();
    // If no UTM parameters in current URL, create default ones for QR code sharing
    if (Object.keys(currentUtmParams).length === 0) {
      return createUtmParams.qrCode();
    }
    return currentUtmParams;
  }, []);



  // local state for handle catgeories
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const { data, loading } = useQuery(accountsDetailQuery, {
    variables: {
      filters: {
        username: {
          eq: username,
        },
      },
    },
    skip: !username,
    fetchPolicy: "cache-and-network", // Ensure fresh data is fetched
  });

  const [showQR, setShowQR] = useState(false);
  const [_isQRVisible, setIsQRVisible] = useState(false);
  const accountData = data?.accounts[0];

  const [selectedCity, setSelectedCity] = useState<City | undefined>(undefined);

  // Memoize expensive calculations to prevent unnecessary re-renders
  const PublishedCities = useMemo(() => {
    return (
      accountData?.recommendation_lists?.filter(
        (list: {
          List_Name: string;
          Visibility: boolean;
          recommended_places: string[];
        }) => list.Visibility === true
      ) || []
    );
  }, [accountData?.recommendation_lists]);

  // Analytics tracking - initialize after first city is selected
  const analytics = useTrackAnalytics({
    accountId: accountData?.documentId || "",
    locationId: selectedCity?.documentId || undefined,
    recommendationId: undefined,
    pageName: "public-home",
    pageUsername: username, // Pass the username from URL params
    autoTrackView: true,
    waitForLocation: true, // Wait for location to be set before auto-tracking view
    cityName: selectedCity?.List_Name, // Pass city name for analytics metadata
  });

  // QR URL generation for PublicHome page
  // Always redirect to host/{username}/places regardless of selected city
  // This ensures consistent QR behavior in the public profile view
  const qrContext = "places";
  const qrValue = useMemo(() => {
    if (!username) return "";

    // Always generate places overview URL: host/{username}/places
    // This ensures QR code always redirects to places overview, not specific recommendations
    return generateUserPlacesQRUrl(username, undefined, utmParams);
  }, [username, utmParams]);

  const { handleCopyLink } = useQRActions({
    username: username,
    context: qrContext,
    recommendationListName: undefined, // Always undefined for places overview
    utmParams: utmParams, // Include UTM parameters for tracking
  });

  // Separate query for paginated places
  // CRITICAL: Only query places for published cities
  const {
    data: placesData,
    loading: placesQueryLoading,
    fetchMore,
  } = useQuery(recommendedPlacesQuery, {
    variables: {
      pagination: {
        page: 1,
        pageSize: 10,
      },
      filters: {
        recommendation_list: {
          documentId: {
            eq: selectedCity?.documentId,
          },
        },
      },
    },
    fetchPolicy: "cache-and-network",
    // Skip query if no selectedCity, no documentId, or city is not published
    skip: !selectedCity?.documentId || selectedCity?.Visibility !== true,
  });
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<{
    visible: boolean;
    documentId: string | null;
  }>({
    visible: false,
    documentId: null,
  });

  // Track recommendation engagement views when card is opened
  useEffect(() => {
    if (isExpanded.visible && isExpanded.documentId && accountData?.documentId && selectedCity?.documentId) {
      // Find the clicked item to get its details from current places data
      const currentPlaces = placesData?.recommendedPlaces || [];
      const clickedItem = currentPlaces.find(
        (item: any) => item.documentId === isExpanded.documentId
      );

      if (clickedItem) {
        const isPersonType = clickedItem?.Recommendation_Type === "person";
        console.log('Tracking recommendation engagement view:', {
          recommendationId: isExpanded.documentId,
          locationId: selectedCity.documentId,
          accountId: accountData.documentId
        });
        analytics.trackEvent({
          type: 'click',
          element: `place-card-${isExpanded.documentId}`,
          metadata: {
            recommendationId: isExpanded.documentId,
            placeId: isExpanded.documentId,
            placeName: isPersonType ? clickedItem.Contact_Name : clickedItem.Place_Details?.Title,
            category: clickedItem.recommendation_category?.Category_Name,
            recommendationType: isPersonType ? 'person' : 'place',
            url: window.location.href,
            originalElement: 'recommendation-engagement'
          }
        });
      }
    }
  }, [isExpanded.visible, isExpanded.documentId, accountData?.documentId, selectedCity?.documentId, placesData?.recommendedPlaces, analytics.trackEvent]);

  // CRITICAL FIX: Auto-select first PUBLISHED city only, not drafts
  useEffect(() => {
    if (PublishedCities?.length) {
      if (placeSlug) {
        // Find the city that matches the placeSlug from PUBLISHED cities only
        const city = PublishedCities.find(
          (list: City) =>
            toUrlSlug(list.List_Name || "") === placeSlug.toLowerCase()
        );
        // If found city exists in published list, select it, otherwise select first published city
        // Additional validation: ensure city is published before selecting
        const cityToSelect = city || PublishedCities[0];
        if (cityToSelect && cityToSelect.Visibility === true) {
          setSelectedCity(cityToSelect);
        } else if (PublishedCities[0]?.Visibility === true) {
          setSelectedCity(PublishedCities[0]);
        }
      } else {
        // Auto-select the first PUBLISHED city when no placeSlug is provided
        // Additional validation: ensure city is published
        if (PublishedCities[0]?.Visibility === true) {
          setSelectedCity(PublishedCities[0]);
        }
      }
    } else {
      // If no published cities, clear selection
      setSelectedCity(undefined);
    }
  }, [PublishedCities, placeSlug]);

  // Handle case when currently selected city becomes unpublished or is a draft
  useEffect(() => {
    if (selectedCity && PublishedCities?.length) {
      // Check if currently selected city is still published
      const isStillPublished = PublishedCities.some(
        (city: City) => city.documentId === selectedCity.documentId
      );

      // Additional check: ensure selectedCity has Visibility === true
      const isSelectedCityPublished = selectedCity.Visibility === true;

      // If selected city is not published anymore or is a draft, select the first published city
      if (!isStillPublished || !isSelectedCityPublished) {
        const firstPublishedCity = PublishedCities.find(
          (city: City) => city.Visibility === true
        );
        if (firstPublishedCity) {
          setSelectedCity(firstPublishedCity);
          // Update URL to reflect the new selection
          navigate(
            `/${username}/places/${toUrlSlug(
              firstPublishedCity.List_Name || ""
            )}`
          );
        } else {
          // No published cities available, clear selection
          setSelectedCity(undefined);
        }
      }
    } else if (selectedCity && PublishedCities?.length === 0) {
      // No published cities available, clear selection
      setSelectedCity(undefined);
    }
  }, [selectedCity, PublishedCities, username, navigate]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !placesQueryLoading &&
          hasMoreData &&
          placesData?.recommendedPlaces?.length > 0
        ) {
          fetchMore({
            variables: {
              pagination: {
                page:
                  Math.ceil((placesData?.recommendedPlaces?.length || 0) / 10) +
                  1,
                pageSize: 10,
              },
              filters: {
                recommendation_list: {
                  documentId: {
                    eq: selectedCity?.documentId,
                  },
                },
              },
            },
            updateQuery: (prev, { fetchMoreResult }) => {
              if (!fetchMoreResult?.recommendedPlaces?.length) {
                setHasMoreData(false);
                return prev;
              }
              // If we get less than the page size, we've reached the end
              if (fetchMoreResult.recommendedPlaces.length < 10) {
                setHasMoreData(false);
              }
              return {
                recommendedPlaces: [
                  ...prev.recommendedPlaces,
                  ...fetchMoreResult.recommendedPlaces,
                ],
              };
            },
          }).catch(() => {
            setHasMoreData(false);
          });
        }
      },
      { threshold: 1.0 }
    );

    // Observe both mobile and desktop targets
    if (mobileObserverTarget.current && hasMoreData) {
      observer.observe(mobileObserverTarget.current);
    }
    if (desktopObserverTarget.current && hasMoreData) {
      observer.observe(desktopObserverTarget.current);
    }

    return () => observer.disconnect();
  }, [
    placesQueryLoading,
    hasMoreData,
    placesData,
    fetchMore,
    selectedCity?.documentId,
  ]);

  // Reset hasMoreData when selectedCity changes
  useEffect(() => {
    setHasMoreData(true);
  }, [selectedCity?.documentId]);

  // Scroll animation (mobile and desktop) only when visiting base places route
  useEffect(() => {
    // Only trigger on base places route (no placeSlug in URL)
    const isBasePlacesRoute = !placeSlug && location.pathname.endsWith('/places');

    // Reset trigger only when navigating TO base places route (pathname changed)
    const pathnameChanged = previousPathnameRef.current !== location.pathname;
    if (isBasePlacesRoute && pathnameChanged) {
      animationTriggeredRef.current = false;
    }
    previousPathnameRef.current = location.pathname;

    // Skip if not on base places route
    if (
      !isBasePlacesRoute ||
      !PublishedCities?.length ||
      PublishedCities.length <= 1 ||
      animationTriggeredRef.current
    ) {
      return;
    }

    // Determine which container to use based on viewport
    const isMobile = window.innerWidth < 768;
    const scrollContainer = isMobile
      ? mobileScrollContainerRef.current
      : desktopScrollContainerRef.current;

    if (!scrollContainer) return;

    const container = scrollContainer;
    if (container.scrollWidth <= container.clientWidth) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Mark as triggered to prevent re-animation when selectedCity changes
    animationTriggeredRef.current = true;

    let animationTimeout: ReturnType<typeof setTimeout>;
    let scrollBackTimeout: ReturnType<typeof setTimeout>;

    animationTimeout = setTimeout(() => {
      const currentContainer = isMobile
        ? mobileScrollContainerRef.current
        : desktopScrollContainerRef.current;

      if (!currentContainer) return;

      const scrollAmount = Math.min(200, container.scrollWidth * 0.3);
      const originalScrollLeft = container.scrollLeft;

      currentContainer.scrollTo({
        left: originalScrollLeft + scrollAmount,
        behavior: 'smooth',
      });

      scrollBackTimeout = setTimeout(() => {
        const finalContainer = isMobile
          ? mobileScrollContainerRef.current
          : desktopScrollContainerRef.current;

        if (!finalContainer) return;
        finalContainer.scrollTo({
          left: originalScrollLeft,
          behavior: 'smooth',
        });
      }, 1100);
    }, 400);

    return () => {
      if (animationTimeout) clearTimeout(animationTimeout);
      if (scrollBackTimeout) clearTimeout(scrollBackTimeout);
    };
  }, [PublishedCities, location.pathname, placeSlug]);

  const handleCitySelect = (city: City) => {
    // CRITICAL: Only allow selection of published cities
    if (city.Visibility === true) {
      setSelectedCity(city);
      // Update URL with the new place slug using the /places/ structure
      navigate(`/${username}/places/${toUrlSlug(city.List_Name || "")}`);
      analytics.trackClick("city-select", {
        cityName: city.List_Name,
        cityId: city.documentId,
      });
    } else {
      // If somehow a draft city is clicked, find and select the first published city instead
      const firstPublishedCity = PublishedCities.find(
        (c: City) => c.Visibility === true
      );
      if (firstPublishedCity) {
        setSelectedCity(firstPublishedCity);
        navigate(
          `/${username}/places/${toUrlSlug(firstPublishedCity.List_Name || "")}`
        );
      }
    }
  };

  // Helper function to handle map navigation based on current placeSlug
  const handleMapNavigation = () => {
    if (placeSlug) {
      // If a specific place is selected, navigate to its map view
      navigate(`/${username}/places/${placeSlug}/map`);
    } else {
      // If no specific place is selected, navigate to the general map view
      navigate(`/${username}/places/map`);
    }
    analytics.trackClick("map-view-button", {
      placeSlug: placeSlug || "all",
      selectedCity: selectedCity?.List_Name,
    });
  };

  useEffect(() => {
    if (!showQR) {
      const timer = setInterval(() => {
        setIsQRVisible((prev) => !prev);
      }, 5000);

      return () => clearInterval(timer);
    }
  }, [showQR]);

  const url = getCurrentDomain();



  // Calculate total recommendations count across all published cities
  const totalRecommendations = useMemo(() => {
    return (
      PublishedCities?.reduce((total: number, city: any) => {
        return total + (city.recommended_places?.length || 0);
      }, 0) || 0
    );
  }, [PublishedCities]);



  // Fetch map data for preview (same as MapView)
  const { data: mapData, loading: mapLoading } = useQuery(getPlaceCoordinatesQuery, {
    variables: {
      filters: {
        username: {
          eq: username,
        },
      },
    },
    skip: !username,
  });

  // Calculate map preview coordinates and bounds
  const mapPreviewData = useMemo(() => {
    if (!mapData?.accounts?.[0]?.recommendation_lists) {
      return { coordinates: [], center: { lat: 20.5937, lng: 78.9629 }, zoom: 2 };
    }

    const recommendationLists = mapData.accounts[0].recommendation_lists;
    const placeDataWithRegion = recommendationLists.flatMap(
      (list: any) =>
        list?.recommended_places?.map((place: any) => ({
          ...place.Place_Details,
          Media: place.Media,
          category: place.recommendation_category?.Category_Name,
          region: list.List_Name || 'Unknown Region',
          documentId: place.documentId,
        })) || []
    );

    const coordinates = placeDataWithRegion
      .map((place: any) => place.Geometry)
      .filter((geometry: any) => geometry !== undefined && geometry.lat && geometry.lng);

    if (coordinates.length === 0) {
      return { coordinates: [], center: { lat: 20.5937, lng: 78.9629 }, zoom: 2 };
    }

    // Calculate bounds and zoom
    const lats = coordinates.map((coord: any) => coord.lat);
    const lngs = coordinates.map((coord: any) => coord.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);

    // Zoom out more for preview to ensure all markers are visible
    // Reduce zoom level by 2-3 levels compared to full map view
    let zoom = 11; // Default zoom (reduced from 13)
    if (maxDiff > 50) zoom = 3;      // Very large spread (country level) - zoom out more
    else if (maxDiff > 20) zoom = 4; // Large spread (state level)
    else if (maxDiff > 10) zoom = 5; // Medium-large spread
    else if (maxDiff > 5) zoom = 6;  // Medium spread
    else if (maxDiff > 2) zoom = 7;  // Medium-small spread
    else if (maxDiff > 1) zoom = 8;  // Small-medium spread
    else if (maxDiff > 0.5) zoom = 9; // Small spread
    else if (maxDiff > 0.2) zoom = 10; // Very small spread
    else if (maxDiff > 0.1) zoom = 11; // Tiny spread
    else if (maxDiff > 0.05) zoom = 12; // Micro spread
    else if (maxDiff > 0.01) zoom = 13; // Very micro spread
    else zoom = 14; // Single point or very close points (reduced from 15)

    // Reduce zoom by 2 more levels for preview to ensure all markers fit
    const previewZoom = Math.max(zoom - 2, 2); // Minimum zoom 2

    return {
      coordinates,
      center: {
        lat: (minLat + maxLat) / 2,
        lng: (minLng + maxLng) / 2,
      },
      zoom: previewZoom
    };
  }, [mapData]);

  const shareButtons = [
    {
      name: "Instagram",
      icon: <InstagramIcon color="white" />,
      url: `https://www.instagram.com/`,
    },
    {
      name: "Twitter",
      icon: <TwitterIcon color="white" />,
      url: `https://twitter.com/`,
    },
    {
      name: "WhatsApp",
      icon: <WhatsappIcon fill="white" />,
      url: `https://www.whatsapp.com/`,
    },
    {
      name: "Mobile",
      icon: <MobileIcon color="black" />,
      url: `www.gmail.com`,
    },
  ];

  // Use paginated places data instead of nested data from accountsDetailQuery
  const currentPlaces = placesData?.recommendedPlaces || [];

  // fetching categories for the recommendation list
  const categories: string[] = useMemo(() => {
    return Array.from(
      new Set(
        currentPlaces?.map(
          (place: CardDataItem) => place?.recommendation_category?.Category_Name
        )
      )
    );
  }, [currentPlaces]);

  // Filter the recommended places by the selected category
  const filteredPlaces = useMemo(() => {
    return selectedCategory
      ? currentPlaces?.filter(
        (place: CardDataItem) =>
          place?.recommendation_category?.Category_Name === selectedCategory
      )
      : currentPlaces;
  }, [selectedCategory, currentPlaces]);

  // Dynamic SEO data preparation
  const profileName = accountData?.Account_Name || username || "User";
  const profileLocation = accountData?.Primary_Address?.address || "";

  // Extract city names for SEO
  const cityNames = useMemo(() => {
    return (
      PublishedCities?.map((city: City) => city.List_Name).filter(Boolean) || []
    );
  }, [PublishedCities]);

  // Enhanced dynamic meta description with recommendation link and note data
  const selectedCityName = selectedCity?.List_Name || cityNames[0] || "";
  const placesCount = filteredPlaces?.length || 0;

  // ENHANCEMENT: Extract recommendation link for location/list
  const locationRecommendationLink = useMemo(() => {
    return (
      selectedCity?.Social_URL ||
      selectedCity?.recommendation_link ||
      selectedCity?.Instagram_Media_URL ||
      ""
    );
  }, [selectedCity]);

  // ENHANCEMENT: Extract note content from list details
  const locationNote = useMemo(() => {
    // First try direct string fields
    if (selectedCity?.Note && typeof selectedCity.Note === "string") {
      return selectedCity.Note.replace(/<[^>]*>/g, "").substring(0, 150);
    }
    if (
      selectedCity?.description &&
      typeof selectedCity.description === "string"
    ) {
      return selectedCity.description.replace(/<[^>]*>/g, "").substring(0, 150);
    }

    // Then try object fields
    const noteSource = selectedCity?.List_Name_Details;
    if (
      typeof noteSource === "object" &&
      noteSource &&
      (noteSource as any)?.note
    ) {
      return (noteSource as any).note.replace(/<[^>]*>/g, "").substring(0, 150);
    }

    return "";
  }, [selectedCity]);

  const featuredPlacesDetails = useMemo(() => {
    if (
      !selectedCity?.recommended_places ||
      selectedCity.recommended_places.length === 0
    )
      return [];

    return selectedCity.recommended_places
      .slice(0, 3)
      .map((place: any) => {
        const placeDetails = place?.Place_Details;
        return {
          name: placeDetails?.Place_Name || placeDetails?.Title || "",
          category: place?.recommendation_category?.Category_Name || "",
          rating: placeDetails?.Rating || null,
          address: placeDetails?.Place_Address || "",
        };
      })
      .filter((place) => place.name);
  }, [selectedCity]);

  const featuredPlacesText =
    featuredPlacesDetails.length > 0
      ? featuredPlacesDetails
        .map((place) => {
          let description = place.name;
          if (place.category) description += ` (${place.category})`;
          if (place.rating) description += ` ⭐${place.rating}`;
          return description;
        })
        .join(", ")
      : "";

  // ENHANCED meta description with recommendation link and note
  const metaDescription =
    selectedCityName && placesCount > 0
      ? `Discover top places and recommendations by ${profileName} in ${selectedCityName} with explorers. Explore hidden gems, local favorites, and must-visit spots. ${locationNote
        ? `${locationNote.substring(0, 100)}${locationNote.length > 100 ? "..." : ""
        } `
        : ""
      }${featuredPlacesText
        ? `Featured: ${featuredPlacesText}${placesCount > 3 ? " and more" : ""
        }. `
        : ""
      }${locationRecommendationLink
        ? `Connect via ${locationRecommendationLink}.`
        : ""
      }`
      : selectedCityName
        ? `Browse ${profileName}'s curated recommendations in ${selectedCityName} on explorers. Find local favorites, hidden gems, and authentic suggestions. ${locationNote ? `${locationNote} ` : ""
        }${locationRecommendationLink
          ? `Connect via ${locationRecommendationLink}.`
          : ""
        }`
        : `Explore curated recommendations and favorite places by ${profileName} on explorers. Discover hidden gems, top spots, and user insights.`;

  const pageTitle = selectedCityName
    ? `${profileName} | ${selectedCityName} Recommendations | explorers`
    : `${profileName} | Recommendations | explorers`;

  const allPlaceNamesInLocation = useMemo(() => {
    if (!selectedCity?.recommended_places) return [];
    return selectedCity.recommended_places
      .map((place: any) => {
        const placeDetails = place?.Place_Details;
        return placeDetails?.Place_Name || placeDetails?.Title || "";
      })
      .filter(Boolean);
  }, [selectedCity]);

  const noteKeywords = useMemo(() => {
    if (!locationNote) return [];
    return locationNote
      .split(/\s+/)
      .filter((word: string) => word.length > 3)
      .slice(0, 5);
  }, [locationNote]);

  const dynamicKeywords = [
    `${profileName} explorers recommendations`,
    `${username} explorers recommendations`,
    "explorers local recommendations",
    "explorers curated recommendations",
    "explorers travel guide",
    "explorers hidden gems",
    "explorers favorite places",
    "explorers place lists",
    "explorers user insights",
    "explorers city guide",
    `${profileName} recommendations`,
    `${username} recommendations`,
    "local recommendations",
    "curated recommendations",
    "travel recommendations",
    "hidden gems",
    "local favorites",
    "travel guide",
    "local insights",
    "favorite spots",
    ...cityNames.map((city: string) => `${city} explorers recommendations`),
    ...cityNames.map((city: string) => `${city} explorers places`),
    ...(profileLocation ? [`${profileLocation} explorers recommendations`] : []),
    ...categories.map(
      (category: string) => `${category} explorers recommendations`
    ),
    ...allPlaceNamesInLocation,
    ...noteKeywords,
    ...(locationRecommendationLink
      ? [
        "explorers recommendation link",
        "explorers connect",
        "explorers social media",
        "follow",
      ]
      : []),
    ...(selectedCityName
      ? [
        `${selectedCityName} guide`,
        `visit ${selectedCityName} explorers`,
        `${selectedCityName} travel`,
      ]
      : []),
  ].filter(Boolean);

  // Profile image for social sharing
  const profileImage =
    accountData?.profile_picture?.url || accountData?.bg_picture?.url;

  // Create URL for current selection
  const currentUrl = selectedCityName
    ? `${getBaseUrl()}/${username}/places/${toUrlSlug(selectedCityName)}`
    : `${getBaseUrl()}/${username}/places`;

  // Generate GEO data for enhanced structured data
  const geoData = createLocationGEOData({
    locationName: selectedCityName || "All Recommendations",
    recommenderName: profileName,
    placesCount: placesCount,
    topCategories: Array.from(new Set(categories)).slice(0, 3),
    locationNote: selectedCityName
      ? `Explore ${placesCount} curated places in ${selectedCityName} recommended by ${profileName}`
      : `Browse all ${totalRecommendations} recommendations by ${profileName} across ${cityNames.length} locations`,
  });

  return (
    <>
      <SEO
        key={`${selectedCity?.documentId || "default"}-home`}
        title={pageTitle}
        description={metaDescription}
        keywords={dynamicKeywords}
        canonical={currentUrl}
        image={profileImage}
        url={currentUrl}
        type="website"
        author={profileName}
        siteName="explorers"
        enableGEO={true}
        geoData={geoData}
      />

      <div className="relative bg-black min-h-screen pb-14 flex flex-col overflow-x-hidden">
        {/* Fixed Header */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#2a2a2a]/90 backdrop-blur-sm border-b border-gray-700 h-14">
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
                  const shareUrl = selectedCity?.List_Name
                    ? `${window.location.origin}/${username}/places/${toUrlSlug(selectedCity.List_Name)}`
                    : `${window.location.origin}/${username}/places`;
                  if (navigator.share) {
                    navigator.share({
                      title: `${accountData?.Account_Name || username}'s Places`,
                      text: "Check out these recommendations!",
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
                  analytics.trackClick('share-button', { context: 'places-header' });
                }}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center"
                aria-label="Share"
              >
                <Share2 className="h-4 w-4" style={{ color: 'white' }} />
              </button>
              <button
                onClick={async () => {
                  const shareUrl = selectedCity?.List_Name
                    ? `${window.location.origin}/${username}/places/${toUrlSlug(selectedCity.List_Name)}`
                    : `${window.location.origin}/${username}/places`;
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    toast.success("Link copied!");
                  } catch (error) {
                    console.error("Failed to copy text:", error);
                  }
                  analytics.trackClick('copy-link-button', { context: 'places-header' });
                }}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center"
                aria-label="Copy Link"
              >
                <Copy className="h-4 w-4" style={{ color: 'white' }} />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-black min-h-screen">
            <EarthLoader context="recommendations" />
          </div>
        ) : accountData ? (
          <>
            {/* Profile Section with Google Maps - Desktop Layout */}
            <div className="hidden md:block w-full mb-2 mt-14 px-4">
              <div className="relative bg-dashboard-sidebar backdrop-blur-sm border rounded-[2rem] overflow-hidden shadow-dashboard-elevated max-w-4xl mx-auto" style={{ borderColor: '#3C4E40' }}>
                {/* Google Maps Banner - Map Preview */}
                <div
                  className="relative flex flex-col justify-center items-center h-48 w-full overflow-hidden rounded-t-[2rem]"
                >
                  {/* Map Preview */}
                  <div className="absolute inset-0 z-0 pointer-events-auto overflow-hidden rounded-t-[2rem]">
                    {!mapLoading && mapPreviewData.coordinates.length > 0 ? (
                      <Map
                        defaultCenter={mapPreviewData.center}
                        defaultZoom={mapPreviewData.zoom}
                        mapId={"mapPreviewDesktop"}
                        style={{ height: "100%", width: "100%" }}
                        scrollwheel={true}
                        gestureHandling={"greedy"}
                        disableDefaultUI={false}
                        mapTypeId="satellite"
                      >
                        <MapPreviewController targetCoords={mapPreviewData.center} targetZoom={mapPreviewData.zoom} />
                        {mapPreviewData.coordinates.map(
                          (coords: { lat: number; lng: number }, index: number) => (
                            <AdvancedMarker key={`marker-${index}-${coords.lat}-${coords.lng}`} position={coords}>
                              <Pin
                                background="red"
                                borderColor="red"
                                glyphColor="white"
                              />
                            </AdvancedMarker>
                          )
                        )}
                      </Map>
                    ) : mapLoading ? (
                      <div className="w-full h-full bg-dashboard-sidebar flex items-center justify-center">
                        <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-dashboard-sidebar flex items-center justify-center">
                        <span className="text-white text-sm">No locations available</span>
                      </div>
                    )}
                  </div>

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-black/5 to-black/20 z-0 rounded-t-[2rem] pointer-events-none"></div>

                  {/* Expand Button */}
                  <button
                    onClick={handleMapNavigation}
                    className="absolute top-2 right-2 z-50 bg-black/70 hover:bg-black/90 backdrop-blur-sm text-white p-2 rounded-lg shadow-lg transition-all duration-200 pointer-events-auto"
                    aria-label="Expand map"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
                </div>

                {/* Stats Row */}
                <div className="relative px-4 pb-4 -mt-12 md:-mt-16">
                  <div className="flex gap-16 sm:gap-20 md:gap-24 justify-center items-center px-2 sm:px-0 pt-14 md:pt-20">
                    <div className="text-center">
                      <p className="text-base sm:text-lg md:text-xl font-bold text-white mb-1">
                        {PublishedCities?.length || 0}
                      </p>
                      <p className="text-[hsl(var(--text-light))] font-poppins text-xs sm:text-sm truncate">
                        Places
                      </p>
                    </div>
                    <div className="w-px h-12 bg-dashboard/50"></div>
                    <div className="text-center">
                      <p className="text-base sm:text-lg md:text-xl font-bold text-white mb-1">
                        {totalRecommendations || 0}
                      </p>
                      <p className="text-[hsl(var(--text-light))] font-poppins text-xs sm:text-sm truncate">
                        Recommendations
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Section with Google Maps - Mobile Layout */}
            <div className="md:hidden w-full mb-2 mt-14 px-3">
              <div className="relative bg-dashboard-sidebar backdrop-blur-sm border rounded-[2rem] overflow-hidden shadow-dashboard-elevated" style={{ borderColor: '#3C4E40' }}>
                {/* Google Maps Banner - Map Preview */}
                <div
                  className="relative flex flex-col justify-center items-center h-36 w-full overflow-hidden rounded-t-[2rem]"
                >
                  {/* Map Preview */}
                  <div className="absolute inset-0 z-0 pointer-events-auto overflow-hidden rounded-t-[2rem]">
                    {!mapLoading && mapPreviewData.coordinates.length > 0 ? (
                      <Map
                        defaultCenter={mapPreviewData.center}
                        defaultZoom={mapPreviewData.zoom}
                        mapId={"mapPreviewMobile"}
                        style={{ height: "100%", width: "100%" }}
                        scrollwheel={true}
                        gestureHandling={"greedy"}
                        disableDefaultUI={false}
                        mapTypeId="satellite"
                      >
                        <MapPreviewController targetCoords={mapPreviewData.center} targetZoom={mapPreviewData.zoom} />
                        {mapPreviewData.coordinates.map(
                          (coords: { lat: number; lng: number }, index: number) => (
                            <AdvancedMarker key={`marker-${index}-${coords.lat}-${coords.lng}`} position={coords}>
                              <Pin
                                background="red"
                                borderColor="red"
                                glyphColor="white"
                              />
                            </AdvancedMarker>
                          )
                        )}
                      </Map>
                    ) : mapLoading ? (
                      <div className="w-full h-full bg-dashboard-sidebar flex items-center justify-center">
                        <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="w-full h-full bg-dashboard-sidebar flex items-center justify-center">
                        <span className="text-white text-xs">No locations available</span>
                      </div>
                    )}
                  </div>

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-black/5 to-black/20 z-0 rounded-t-[2rem] pointer-events-none"></div>

                  {/* Expand Button */}
                  <button
                    onClick={handleMapNavigation}
                    className="absolute top-2 right-2 z-50 bg-black/70 hover:bg-black/90 backdrop-blur-sm text-white p-2 rounded-lg shadow-lg transition-all duration-200 pointer-events-auto"
                    aria-label="Expand map"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </button>
                </div>

                {/* Stats Row */}
                <div className="relative px-3 pb-4 -mt-12">
                  <div className="flex gap-12 sm:gap-16 justify-center items-center px-2 sm:px-0 pt-14">
                    <div className="text-center">
                      <p className="text-base sm:text-lg font-bold text-white mb-1">
                        {PublishedCities?.length || 0}
                      </p>
                      <p className="text-[hsl(var(--text-light))] font-poppins text-xs truncate">
                        Places
                      </p>
                    </div>
                    <div className="w-px h-10 bg-dashboard/50"></div>
                    <div className="text-center">
                      <p className="text-base sm:text-lg font-bold text-white mb-1">
                        {totalRecommendations || 0}
                      </p>
                      <p className="text-[hsl(var(--text-light))] font-poppins text-xs truncate">
                        Recommendations
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Check if user has any visible recommendation lists */}
            {PublishedCities && PublishedCities.length > 0 ? (
              <>
                <ShareModal
                  shareButtons={shareButtons}
                  isOpen={showShareModal}
                  onClose={() => setShowShareModal(false)}
                  url={
                    selectedCity?.List_Name
                      ? `${url}/${username}/places/${toUrlSlug(
                        selectedCity.List_Name
                      )}`
                      : `${url}/${username}/places`
                  }
                  utmParams={utmParams}
                  backgroundImage={
                    selectedCity?.List_Name_Details?.thumbnail ||
                    accountData?.bg_picture?.url ||
                    IMAGE_CONFIG.defaultImages.background
                  }
                />

                {/* City Selection and Places - Desktop */}
                <div className="hidden md:block">
                  {/* Section 2: Recommendation List - Becomes sticky at top */}
                  <div className="sticky top-0  bg-black">
                    <div className="bg-black rounded-lg pt-4 pb-2 px-4 mx-4 mt-2">
                      <div
                        ref={desktopScrollContainerRef}
                        className="overflow-visible whitespace-nowrap flex gap-8 w-full mx-auto max-w-3xl items-start pt-6 px-4"
                        style={{ scrollbarWidth: "none", overflowX: "auto" }}
                      >
                        {PublishedCities?.map(
                          (
                            city: {
                              List_Name?: string;
                              List_Name_Details?: {
                                thumbnail?: string;
                              };
                              Visibility: boolean;
                              imageUrl: string;
                              documentId?: string;
                            },
                            index: number
                          ) => (
                            <motion.div
                              key={city.documentId || index}
                              ref={(el) =>
                                (cityRefs.current[city.List_Name || ""] = el)
                              }
                              className="flex flex-col flex-shrink-0 items-center justify-center cursor-pointer "
                              onClick={() => handleCitySelect(city)}
                              whileHover={{ scale: 1.1 }}
                              animate={{
                                y:
                                  selectedCity?.List_Name === city.List_Name
                                    ? -20
                                    : 0,
                              }}
                              transition={{ type: "spring", stiffness: 200 }}
                            >
                              <ImageWithFallback
                                referrerPolicy="no-referrer"
                                src={city?.List_Name_Details?.thumbnail}
                                alt={city.List_Name || ""}
                                className={`w-16 p-[0.1rem] h-16 rounded-full aspect-square object-cover ${selectedCity?.List_Name === city.List_Name
                                  ? city.Visibility
                                    ? "border-[hsl(var(--status-published))] border-[3px] z-50"
                                    : "border-[hsl(var(--status-draft))] border-[3px]"
                                  : ""
                                  }`}
                              />
                              <p
                                className={`text-sm text-white font-poppins mt-1 ${selectedCity?.List_Name === city.List_Name
                                  ? "text-center"
                                  : "truncate w-20 text-center"
                                  }`}
                              >
                                {city.List_Name}
                              </p>

                            </motion.div>
                          )
                        )}
                      </div>
                    </div>
                    {PublishedCities && PublishedCities.length > 6 && (
                      <div className="flex items-center justify-end w-full mx-auto max-w-3xl pr-4 pb-2 relative z-40">
                        <button
                          className="text-[hsl(var(--blue-cta))] font-poppins text-xs transition-all duration-300 flex items-center justify-center gap-2 font-medium hover:text-[hsl(var(--blue-final))] px-1 relative z-50 pointer-events-auto"
                          onClick={() => {
                            setShowAllPlaces(true);
                            analytics.trackClick("view-all-button", {
                              totalCities: PublishedCities?.length || 0,
                            });
                          }}
                        >
                          View All
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Section 3: Recommended Places - Scrolls normally */}
                  <div className="md:max-w-5xl md:mx-auto">
                    <div className="bg-black rounded-lg p-4 mx-4">
                      <div className="overflow-x-auto scrollbar-hide whitespace-nowrap">
                        {categories && categories.length >= 1 && (
                          <div className="flex gap-3">
                            <Button
                              btnText={"All"}
                              type="button"
                              variant={
                                selectedCategory === "" ? "tagSelected" : "tag"
                              }
                              onClickHandler={() => setSelectedCategory("")}
                              size="xsmall"
                            />
                            {categories?.map((tag: string, index: number) => (
                              <Button
                                key={index}
                                btnText={tag}
                                type="button"
                                variant={
                                  selectedCategory === tag
                                    ? "tagSelected"
                                    : "tag"
                                }
                                onClickHandler={() => setSelectedCategory(tag)}
                                size="xsmall"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-grow overflow-y-auto">
                      <div className="fixed bottom-[3.8rem] md:bottom-16 left-1/2 -translate-x-1/2 z-40 bg-black/20 rounded-lg p-0.5 backdrop-blur-sm">
                        <Button
                          startIcon={<WhiteMap />}
                          btnText="Map View"
                          variant="primary"
                          size="xsmall"
                          onClickHandler={handleMapNavigation}
                          className="bg-[hsl(var(--blue-cta))] hover:bg-[hsl(var(--blue-final))] shadow-lg shadow-blue-500/20"
                        />
                      </div>
                      <div className="p-4 mb-14">
                        <div className="bg-black rounded-lg p-6">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 overflow-visible">
                            {placesQueryLoading && !filteredPlaces?.length ? (
                              // Show skeleton cards when initially loading and no data yet
                              <RecommendationCardSkeleton count={6} />
                            ) : filteredPlaces?.length ? (
                              <>
                                {filteredPlaces?.map((place: CardDataItem) => {
                                  const isPersonType = place?.Recommendation_Type === "person";

                                  return (
                                    <Card
                                      key={place.documentId}
                                      cardType="default"
                                      recommendationType={isPersonType ? "person" : "place"}
                                      onClickhandler={() =>
                                        setIsExpanded({
                                          visible: true,
                                          documentId: place.documentId,
                                        })
                                      }
                                      image={
                                        isPersonType
                                          ? getPersonImageUrl(place)
                                          : (place?.media_details?.thumbnail?.url ||
                                            place?.Media?.[0]?.url ||
                                            place?.Place_Details?.Photos?.[0] ||
                                            IMAGE_CONFIG.defaultImages.place)
                                      }
                                      title={isPersonType ? place.Contact_Name : place.Place_Details?.Title}
                                      rating={!isPersonType ? place.Place_Details?.Rating : undefined}
                                      reviews={!isPersonType ? place.Place_Details?.Rating_Count : undefined}
                                    />
                                  );
                                })}
                                {/* Observer target for infinite scroll */}
                                <div
                                  ref={mobileObserverTarget}
                                  className="h-10 w-full col-span-2"
                                />

                              </>
                            ) : (
                              <h1 className="flex text-white items-center justify-center font-poppins font-semibold col-span-2">
                                No Recommendation Available.
                              </h1>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* City Selection and Places - Mobile */}
                <div className="md:hidden">
                  {/* Section 2: Recommendation List - Becomes sticky at top */}
                  <div className="sticky top-0 z-30 bg-black overflow-visible">
                    <div className="bg-black rounded-lg pt-4 pb-2 px-2 mx-4 overflow-visible">
                      <div
                        ref={mobileScrollContainerRef}
                        className="overflow-visible whitespace-nowrap flex gap-6 w-full mx-auto max-w-3xl items-start pt-6 pl-4 pr-2"
                        style={{ scrollbarWidth: "none", overflowX: "auto", overflowY: "visible" }}
                      >
                        {PublishedCities?.map(
                          (
                            city: {
                              List_Name?: string;
                              List_Name_Details?: {
                                thumbnail?: string;
                              };
                              Visibility: boolean;
                              imageUrl: string;
                              documentId?: string;
                            },
                            index: number
                          ) => (
                            <motion.div
                              key={city.documentId || index}
                              ref={(el) =>
                                (cityRefs.current[city.List_Name || ""] = el)
                              }
                              className="flex flex-col flex-shrink-0 items-center justify-center cursor-pointer px-1 py-3 relative z-40"
                              onClick={() => handleCitySelect(city)}
                              whileHover={{ scale: 1.05 }}
                              animate={{
                                y:
                                  selectedCity?.List_Name === city.List_Name
                                    ? -20
                                    : 0,
                              }}
                              transition={{ type: "spring", stiffness: 200 }}
                            >
                              <ImageWithFallback
                                referrerPolicy="no-referrer"
                                src={city?.List_Name_Details?.thumbnail}
                                alt={city.List_Name || ""}
                                className={`w-16 p-[0.1rem] h-16 md:w-20 md:h-20 rounded-full aspect-square object-cover ${selectedCity?.List_Name === city.List_Name
                                  ? city.Visibility
                                    ? "border-[hsl(var(--status-published))] border-[3px]"
                                    : "border-[hsl(var(--status-draft))] border-[3px]"
                                  : ""
                                  }`}
                              />
                              <p
                                className={`text-sm text-white font-poppins mt-1 ${selectedCity?.List_Name === city.List_Name
                                  ? "text-center"
                                  : "truncate w-20 text-center"
                                  }`}
                              >
                                {city.List_Name}
                              </p>

                            </motion.div>
                          )
                        )}
                      </div>
                    </div>
                    {PublishedCities && PublishedCities.length > 6 && (
                      <div className="flex items-center justify-end w-full mx-auto max-w-3xl pr-4 md:pr-0">
                        <button
                          className="text-[hsl(var(--blue-cta))] font-poppins text-xs md:text-sm transition-all duration-300 flex items-center justify-center gap-2 font-medium hover:text-[hsl(var(--blue-final))] px-1"
                          onClick={() => setShowAllPlaces(true)}
                        >
                          View All
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Section 3: Recommended Places - Scrolls normally */}
                  <div className="md:max-w-5xl md:mx-auto">
                    <div className="overflow-x-auto scrollbar-hide whitespace-nowrap px-4 pt-2 pb-4 md:pb-2">
                      {categories && categories.length >= 1 && (
                        <div className="flex gap-3">
                          <Button
                            btnText={"All"}
                            type="button"
                            variant={
                              selectedCategory === "" ? "tagSelected" : "tag"
                            }
                            onClickHandler={() => {
                              setSelectedCategory("");
                              analytics.trackClick("category-filter", {
                                category: "all",
                              });
                            }}
                            size="xsmall"
                          />
                          {categories?.map((tag: string, index: number) => (
                            <Button
                              key={index}
                              btnText={tag}
                              type="button"
                              variant={
                                selectedCategory === tag ? "tagSelected" : "tag"
                              }
                              onClickHandler={() => {
                                setSelectedCategory(tag);
                                analytics.trackClick("category-filter", {
                                  category: tag,
                                });
                              }}
                              size="xsmall"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex-grow overflow-y-auto">
                      <div className="fixed bottom-[3.8rem] md:bottom-16 left-1/2 -translate-x-1/2 z-40 bg-black/20 rounded-lg p-0.5 backdrop-blur-sm">
                        <Button
                          startIcon={<WhiteMap />}
                          btnText="Map View"
                          variant="primary"
                          size="xsmall"
                          onClickHandler={handleMapNavigation}
                          className="bg-[hsl(var(--blue-cta))] hover:bg-[hsl(var(--blue-final))] shadow-lg shadow-blue-500/20"
                        />
                      </div>
                      <div className="px-4 pt-4 md:pt-2 mb-14 grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 overflow-x-hidden">
                        {placesQueryLoading && !filteredPlaces?.length ? (
                          // Show skeleton cards when initially loading on mobile
                          <RecommendationCardSkeleton count={6} />
                        ) : filteredPlaces?.length ? (
                          <>
                            {filteredPlaces?.map((place: CardDataItem) => {
                              const isPersonType = place?.Recommendation_Type === "person";

                              return (
                                <Card
                                  key={place.documentId}
                                  cardType="default"
                                  recommendationType={isPersonType ? "person" : "place"}
                                  onClickhandler={() => {
                                    setIsExpanded({
                                      visible: true,
                                      documentId: place.documentId,
                                    });
                                    analytics.trackClick("place-card", {
                                      placeId: place.documentId,
                                      placeName: isPersonType ? place.Contact_Name : place.Place_Details?.Title,
                                      category:
                                        place.recommendation_category
                                          ?.Category_Name,
                                      id: place.documentId, // Add unique ID for each place
                                    });
                                  }}
                                  image={
                                    isPersonType
                                      ? getPersonImageUrl(place)
                                      : (place?.media_details?.thumbnail?.url ||
                                        place?.Media?.[0]?.url ||
                                        place?.Place_Details?.Photos?.[0] ||
                                        IMAGE_CONFIG.defaultImages.place)
                                  }
                                  title={isPersonType ? place.Contact_Name : place.Place_Details?.Title}
                                  rating={!isPersonType ? place.Place_Details?.Rating : undefined}
                                  reviews={!isPersonType ? place.Place_Details?.Rating_Count : undefined}
                                />
                              );
                            })}
                            {/* Observer target for infinite scroll */}
                            <div
                              ref={desktopObserverTarget}
                              className="h-10 w-full md:col-span-3 col-span-2"
                            />

                          </>
                        ) : (
                          <h1 className="flex text-white items-center justify-center font-poppins font-semibold">
                            No Recommendation Available.
                          </h1>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {showQR && (
                  <QRModal
                    isOpen={showQR}
                    onClose={() => {
                      setShowQR(false);
                      setIsQRVisible(false);
                    }}
                    qrValue={qrValue}
                    onCopyLink={handleCopyLink}
                    title="Profile QR Code"
                    qrSize="medium"
                  />
                )}

                {isExpanded.visible && (
                  <div className="fixed inset-0 bg-black md:bg-opacity-40 md:backdrop-blur-md z-[60]"></div>
                )}
                <div
                  className={`fixed md:max-w-4xl md:mx-auto inset-x-0 bottom-0 top-0 z-[60] transition-transform duration-300 ease-in-out overflow-x-hidden ${isExpanded.visible ? "translate-y-0" : "translate-y-full"
                    }`}
                >
                  {isExpanded.visible && (() => {
                    // Find the clicked item to determine its type
                    const clickedItem = filteredPlaces?.find(
                      (item: any) => item.documentId === isExpanded.documentId
                    );
                    const isPersonType = clickedItem?.Recommendation_Type === "person";

                    return isPersonType ? (
                      <PersonOverview
                        personId={isExpanded.documentId}
                        onClose={() =>
                          setIsExpanded({ visible: false, documentId: null })
                        }
                        isPublicProfile={true}
                      />
                    ) : (
                      <PlaceOverview
                        placeId={isExpanded.documentId}
                        onClose={() =>
                          setIsExpanded({ visible: false, documentId: null })
                        }
                        isPublicProfile={true}
                      />
                    );
                  })()}
                </div>
              </>
            ) : (
              /* Empty State - Show consistent profile with 0 places and 0 contributions */
              <>
                <ShareModal
                  shareButtons={shareButtons}
                  isOpen={showShareModal}
                  onClose={() => setShowShareModal(false)}
                  url={`${url}/${username}/places`}
                  backgroundImage={
                    accountData?.bg_picture?.url ||
                    IMAGE_CONFIG.defaultImages.background
                  }
                />

                {/* Empty State Content */}
                <div className="flex-grow flex flex-col items-center justify-center px-4 py-16">
                  <div className="text-center max-w-md">
                    <h3 className="text-xl font-poppins font-semibold text-white mb-4">
                      No Places Yet
                    </h3>
                    <p className="text-gray-400 text-sm mb-8">
                      {accountData?.Account_Name} hasn't shared any
                      recommendations yet. Check back later for amazing places
                      to discover!
                    </p>

                    <div className="flex justify-center items-center">
                      <Location
                        size={64}
                        fill="#9FDAFF"
                        className="w-16 h-16"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          /* Profile not found */
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-white text-center">
              <h2 className="text-lg font-poppins font-semibold mb-2">
                Profile not found
              </h2>
              <p className="text-gray-400 text-sm">
                This user profile is not available.
              </p>
            </div>
          </div>
        )}

        {/* CircularPlacesModal */}
        {showAllPlaces && (
          <CircularPlacesModal
            isOpen={showAllPlaces}
            onClose={() => setShowAllPlaces(false)}
            places={PublishedCities || []}
            handleCitySelect={handleCitySelect}
          />
        )}
      </div>
    </>
  );
});

export default PublicHome;
