import { memo, useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import useAuthStore from "../store/store";
import Button from "../components/ui/Button";
import ShareIcon from "../assets/icons/ShareIcon";
import { useQuery } from "@apollo/client";
import { getCurrentDomain } from "../utils/getCurrentDomain";
import { EarthLoader } from "../components/EarthLoader";
import MobileIcon from "../assets/icons/MobileIcon";
import WhatsappIcon from "../assets/icons/WhatsappIcon";
import TwitterIcon from "../assets/icons/TwitterIcon";
import InstagramIcon from "../assets/icons/InstagramIcon";
import ShareModal from "../components/ShareModal";
import { GlobeDemo } from "../components/ui/GlobeDemo";
import ThemedIcon from "../components/ui/ThemedIcon";
import { recommendationListQuery } from "../features/Favorites/api/query";
import { accountsDetailQuery } from "../features/PublicHome/api/query";
import { useNavigate, useLocation } from "react-router-dom";
import { toUrlSlug } from "../utils/formatAddress";
import SEO from "../components/SEO";
import ImageWithFallback from "../components/ui/ImageWithFallback";
import { createCanonicalUrl } from "../utils/getCurrentDomain";
import { createUtmParams } from "../utils/urlHelpers";
import { IMAGE_CONFIG } from "../config";
import { useCityStore } from "../store/useCityStore";
import useSetupStore from "../store/useSetupStore";
import AccountSetupCard from "../components/AccountSetupCard";
import { DASHBOARD_STATUS_QUERY } from "../features/Profile/api/UserStatus";
import { GET_GUIDES_QUERY, GET_USER_ACCOUNT_QUERY } from "../features/Guides/api/queries";
import type { Guide } from "../features/Guides/types";
import { getAllUserLocations } from "../utils/geoHelpers";
import InteractiveMap from "../components/InteractiveMap";
import { calculateIsProfileComplete, calculateIsRecommendationsComplete } from "../utils/setupStatusCalculations";


const Home = memo(() => {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const { setSelectedCity } = useCityStore();
  const { setSetupStatus } = useSetupStore();
  const location = useLocation();
  const [showProfileShareModal, setShowProfileShareModal] =
    useState<boolean>(false);
  const [showRecommendationsShareModal, setShowRecommendationsShareModal] =
    useState<boolean>(false);
  const [showRecommendationShareModals, setShowRecommendationShareModals] =
    useState<{ [key: string]: boolean }>({});
  const [showGuidesShareModal, setShowGuidesShareModal] = useState<boolean>(false);
  const [showGuideShareModals, setShowGuideShareModals] = useState<{ [key: string]: boolean }>({});
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [guidesSearchQuery, setGuidesSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"recommendations" | "guides">("recommendations");

  // Create UTM parameters for sharing
  const profileUtmParams = createUtmParams.directShare();
  const recommendationUtmParams = createUtmParams.directShare();
  const guidesUtmParams = createUtmParams.directShare();

  // Query for dashboard status to check completion (includes published status)
  const { data: dashboardStatusData, loading: dashboardStatusLoading } = useQuery(DASHBOARD_STATUS_QUERY, {
    variables: {
      documentId: user?.documentId,
    },
    fetchPolicy: "cache-and-network",
    skip: !user?.username || !user?.documentId,
  });

  const { data, loading, error } = useQuery(accountsDetailQuery, {
    variables: {
      filters: {
        username: {
          eq: user?.username,
        },
      },
    },
    fetchPolicy: "network-only",
    skip: !user?.username, // Skip query if user is not authenticated
  });

  const { data: userLists } = useQuery(recommendationListQuery, {
    variables: {
      filters: {
        account: {
          username: {
            eq: user?.username,
          },
        },
      },
    },
    fetchPolicy: "network-only",
    skip: !user?.username, // Skip query if user is not authenticated
  });

  // Get account documentId for guides query (reuse existing query pattern)
  const { data: accountDataForGuides } = useQuery(GET_USER_ACCOUNT_QUERY, {
    variables: { documentId: user?.documentId },
    skip: !user?.documentId,
    fetchPolicy: "cache-first", // Reuse cache if available
  });

  const accountDocumentId = accountDataForGuides?.usersPermissionsUser?.accounts?.[0]?.documentId;

  // Fetch guides with network-only policy to match Recommendations behavior
  // Fetch all guides (not just published) so cache gets updated when drafts are created/updated
  const { data: guidesData, refetch: refetchGuides } = useQuery(GET_GUIDES_QUERY, {
    variables: {
      filters: {
        account: {
          documentId: {
            eq: accountDocumentId,
          },
        },
      },
      pagination: {
        limit: 100,
      },
    },
    fetchPolicy: "network-only", // Always fetch fresh data, matching Recommendations
    skip: !accountDocumentId || !user?.username,
  });

  // Refetch guides when navigating back from guide creation/editing (matching Recommendations pattern)
  useEffect(() => {
    if (location.state?.refetchGuides) {
      refetchGuides();
      // Clear the state to prevent refetch on re-render
      window.history.replaceState({}, document.title);
    }
  }, [location.state, refetchGuides]);

  // Refetch guides on window focus to ensure real-time sync (matching Recommendations pattern)
  useEffect(() => {
    const handleFocus = () => {
      if (accountDocumentId && user?.username) {
        refetchGuides();
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [accountDocumentId, user?.username, refetchGuides]);

  const account = data?.accounts[0];
  const url = getCurrentDomain();
  const listNames = userLists?.recommendationLists;
  const allGuides: Guide[] = guidesData?.guides || [];
  // Show all guides (drafts and published) on Home Dashboard, matching Recommendations behavior

  // Extract all unique coordinates from Guides and Recommendations for globe visualization
  const allUserLocations = useMemo(() => {
    return getAllUserLocations(allGuides, listNames || []);
  }, [allGuides, listNames]);

  // Calculate completion flags - Enhanced profile completion check
  const isProfileComplete = useMemo(() => {
    const dashboardAccount = dashboardStatusData?.me?.accounts?.[0];
    const accountData = dashboardAccount || account;
    return calculateIsProfileComplete(accountData);
  }, [dashboardStatusData, account]);

  const isRecommendationsComplete = useMemo(() => {
    // Try dashboardStatusData first, then fallback to listNames
    const dashboardAccount = dashboardStatusData?.me?.accounts?.[0];
    const lists = dashboardAccount?.recommendation_lists || listNames;

    const isComplete = calculateIsRecommendationsComplete(lists);

    if (process.env.NODE_ENV === 'development') {
      console.log('Recommendations Complete Check:', {
        isComplete,
        dashboardLists: dashboardAccount?.recommendation_lists?.length || 0,
        listNamesCount: listNames?.length || 0
      });
    }

    return isComplete;
  }, [dashboardStatusData, listNames]);

  // Extensible: Check if ALL setup points are complete
  // Add new setup points here as the app grows
  // IMPORTANT: Only show account setup card when setup is INCOMPLETE
  // Show recommendations section when ALL setup points are complete
  const isAllSetupComplete = useMemo(() => {
    // Wait for critical data to load before making a decision
    // Don't show setup card during loading - show loading spinner instead
    if (dashboardStatusLoading || loading) {
      return false; // Wait for data to load - loading state handles this
    }

    // If we have account data (from either source), proceed with checks
    const hasAccountData = dashboardStatusData?.me?.accounts?.[0] || account;
    if (!hasAccountData) {
      return false; // No account data available yet - show setup card
    }

    // CRITICAL: Visibility logic:
    // Show Profile Setup when: setup is incomplete
    // Show My Recommendations when: both steps are complete
    const bothComplete = isProfileComplete && isRecommendationsComplete;

    // Debug logging (can be removed in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('Setup Status:', {
        isProfileComplete,
        isRecommendationsComplete,
        bothComplete,
        hasAccountData: !!hasAccountData,
        dashboardStatusLoading,
        loading
      });
    }

    // If both steps are complete, hide the setup card immediately
    return bothComplete;
  }, [isProfileComplete, isRecommendationsComplete, dashboardStatusLoading, loading, dashboardStatusData, account]);

  // Update setup store when status changes
  useEffect(() => {
    // Update store whenever completion flags change
    // Only update if we have data loaded (not during initial loading)
    if (!loading) {
      setSetupStatus(isProfileComplete, isRecommendationsComplete);
    }
  }, [loading, isProfileComplete, isRecommendationsComplete, setSetupStatus]);

  // Clear walkthrough session storage when setup is complete
  // This prevents the walkthrough from auto-starting when users add places after completing setup
  useEffect(() => {
    if (isAllSetupComplete) {
      // Both profile and recommendations setup are complete
      // Clear any lingering walkthrough state to prevent auto-start
      sessionStorage.removeItem('recommendationStep');
      sessionStorage.removeItem('recommendationCompletedSteps');
      sessionStorage.removeItem('profileStep');  // Also clear profile walkthrough
      sessionStorage.removeItem('profileCompletedSteps');

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Setup complete - cleared walkthrough session storage');
      }
    }
  }, [isAllSetupComplete]);

  // Helper function to extract location names from guides (reused from GuidesPage)
  const extractLocationNames = (guide: Guide): string[] => {
    const locations: string[] = [];

    if (!guide.Place_Details) return locations;

    try {
      let placeDetails: any = guide.Place_Details;
      if (typeof guide.Place_Details === "string") {
        placeDetails = JSON.parse(guide.Place_Details);
      }

      // Check if it's multi-city format
      if (placeDetails.isMultiCity === true) {
        // Multi-city: extract all cities
        const departure = placeDetails.departure || placeDetails.from;
        if (departure?.Place_Name) {
          locations.push(departure.Place_Name);
        } else if (departure?.Place_Address) {
          locations.push(departure.Place_Address);
        }

        // Intermediate cities
        const intermediateCities = placeDetails.intermediateCities || [];
        intermediateCities.forEach((city: any) => {
          if (city.Place_Name) {
            locations.push(city.Place_Name);
          } else if (city.Place_Address) {
            locations.push(city.Place_Address);
          }
        });

        // Arrival city
        const arrival = placeDetails.arrival || placeDetails.to;
        if (arrival?.Place_Name) {
          locations.push(arrival.Place_Name);
        } else if (arrival?.Place_Address) {
          locations.push(arrival.Place_Address);
        }
      } else {
        // Single city format
        if (placeDetails.Place_Name) {
          locations.push(placeDetails.Place_Name);
        } else if (placeDetails.Place_Address) {
          locations.push(placeDetails.Place_Address);
        }
      }
    } catch (error) {
      // Silently handle parsing errors
    }

    return locations.filter(loc => loc && loc.trim() !== "");
  };

  // Filter guides based on search query
  const filteredGuides = useMemo(() => {
    if (!guidesSearchQuery.trim()) return allGuides;
    const query = guidesSearchQuery.toLowerCase();
    return allGuides.filter((guide: Guide) =>
      guide?.Title?.toLowerCase().includes(query)
    );
  }, [allGuides, guidesSearchQuery]);

  // Filter places based on search query
  const filteredListNames = listNames?.filter((item: any) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item?.List_Name?.toLowerCase().includes(query) ||
      item?.recommended_places?.some((place: any) =>
        place?.Place_Details?.Place_Name?.toLowerCase().includes(query) ||
        place?.Place_Details?.Title?.toLowerCase().includes(query) ||
        place?.Place_Details?.Place_Address?.toLowerCase().includes(query)
      )
    );
  });

  const navigate = useNavigate();

  const shareButtons = [
    {
      name: t("dashboard.home.shareButtons.instagram"),
      icon: <InstagramIcon color="white" />,
      url: `https://www.instagram.com/`,
    },
    {
      name: t("dashboard.home.shareButtons.twitter"),
      icon: <TwitterIcon color="white" />,
      url: `https://twitter.com/`,
    },
    {
      name: t("dashboard.home.shareButtons.whatsapp"),
      icon: <WhatsappIcon fill="white" />,
      url: `https://www.whatsapp.com/`,
    },
    {
      name: t("dashboard.home.mobile"),
      icon: (
        <ThemedIcon variant="primary">
          <MobileIcon />
        </ThemedIcon>
      ),
      url: `www.gmail.com`,
    },
  ];

  // Show loading state if any critical query is loading
  if (loading || dashboardStatusLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dashboard-bg">
        <EarthLoader context="general" size="small" />
      </div>
    );
  }

  if (error) {
    console.error('GraphQL Error:', error);
    return (
      <div className="flex bg-dashboard-bg items-center justify-center min-h-screen">
        <div className="text-dashboard text-center">
          <h2 className="text-lg font-poppins font-semibold mb-2">
            {t("dashboard.home.error.title")}
          </h2>
          <p className="text-dashboard-light text-sm mb-4">
            {error.message}
          </p>
          <Button
            btnText={t("dashboard.home.error.retry")}
            variant="primary"
            size="small"
            onClickHandler={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('No user found - redirecting to login');
    return (
      <div className="flex bg-dashboard-bg items-center justify-center min-h-screen">
        <div className="text-dashboard text-center">
          <h2 className="text-lg font-poppins font-semibold mb-2">
            {t("dashboard.home.loginRequired.title")}
          </h2>
          <p className="text-dashboard-light text-sm">
            {t("dashboard.home.loginRequired.message")}
          </p>
        </div>
      </div>
    );
  }

  const locations = listNames?.map(
    (list: {
      List_Name: string;
      List_Name_Details: { location: { latitude: string; longitude: string } };
    }) => ({
      name: list.List_Name,
      lat: list.List_Name_Details?.location?.latitude,
      lng: list.List_Name_Details?.location?.longitude,
    })
  );

  const arcsData = locations
    ?.map(
      (
        location: { lat: string; lng: string },
        index: number,
        array: { lat: string; lng: string }[]
      ) => {
        if (index === array.length - 1) return null;
        return {
          startLat: location.lat,
          startLng: location.lng,
          endLat: array[index + 1].lat,
          endLng: array[index + 1].lng,
          color: "white",
        };
      }
    )
    .filter(Boolean);

  return (
    <>
      <SEO
        title={t("dashboard.home.seo.title", { username: user?.username || "" })}
        description={t("dashboard.home.seo.description", { username: user?.username || "" })}
        keywords={[
          t("dashboard.home.seo.keywords.explorersDashboard"),
          t("dashboard.home.seo.keywords.qrCodeManagement"),
          t("dashboard.home.seo.keywords.userDashboard"),
          t("dashboard.home.seo.keywords.personalizedRecommendationsDashboard"),
          t("dashboard.home.seo.keywords.userProfileManagement"),
          t("dashboard.home.seo.keywords.explorersHome"),
          t("dashboard.home.seo.keywords.locationSharingDashboard"),
          t("dashboard.home.seo.keywords.curatedPlacesManagement"),
          t("dashboard.home.seo.keywords.travelGuideDashboard"),
          t("dashboard.home.seo.keywords.personalDashboard"),
          t("dashboard.home.seo.keywords.qrRecommendations"),
          t("dashboard.home.seo.keywords.recommendationManagement"),
          t("dashboard.home.seo.keywords.qrCodeSharingPlatform"),
        ]}
        canonical={createCanonicalUrl("/home")}
        type="website"
        noIndex={true}
      />

      <div className="bg-dashboard-bg">
        <div className="bg-dashboard-bg w-full h-full mx-auto max-w-3xl min-h-screen px-4 md:px-6 pt-2 md:pt-2 pb-4 md:pb-6">
          <div
            className={`flex flex-col gap-4 items-center justify-center ${!account?.Account_Name && "min-h-80"
              } w-full mt-4`}
          >

            <h1 className="text-2xl md:text-3xl font-bold font-poppins text-white leading-tight md:leading-normal py-2 px-4 text-center">
              {t("dashboard.home.welcomeBack")}, {user?.username}
            </h1>
            {!account?.Account_Name && (
              <Button
                btnText={t("dashboard.home.setupProfile")}
                variant="primary"
                size="xsmall"
                onClickHandler={() => navigate("/profile")}
              />
            )}
          </div>

          {/* Enhanced Profile Card */}
          {account?.Account_Name && (
            <div className="w-full mb-6">
              {/* Profile Card with Border and Professional Layout - Matching Profile Page */}
              <div className="relative bg-dashboard-sidebar backdrop-blur-sm border border-dashboard rounded-3xl overflow-hidden shadow-dashboard-elevated">
                {/* Profile Banner - Interactive Globe with Overlapping Profile Picture */}
                <div
                  className="relative flex flex-col justify-center items-center md:h-48 h-32 w-full p-3 sm:p-4 overflow-hidden"
                >
                  {/* Interactive Map - Absolute positioned to fill container */}
                  <div className="absolute inset-0 z-0 pointer-events-auto overflow-hidden">
                    <InteractiveMap locations={allUserLocations} defaultMapTypeId="satellite" />
                  </div>

                  {/* Gradient Overlay - Matching Profile Page */}
                  <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-black/5 to-black/20 z-0 rounded-t-3xl pointer-events-none"></div>
                </div>

                {/* Profile Content */}
                <div className="relative px-4 pb-4 -mt-12 md:-mt-16">
                  {/* Profile Name */}
                  <div className="text-center mb-4 pt-14 md:pt-20">
                    <h2 className="text-lg md:text-xl font-bold font-poppins text-white">
                      {account?.Account_Name}
                    </h2>
                  </div>

                  {/* Stats Badges Row */}
                  <div className="flex gap-2 sm:gap-3 justify-center px-2 sm:px-0">
                    <div className="bg-dashboard-sidebar backdrop-blur-sm rounded-xl px-2 sm:px-3 py-2 border border-dashboard flex-1 min-w-0">
                      <div className="text-center">
                        <p className="text-base sm:text-lg md:text-xl font-bold text-white">
                          {listNames?.filter((list: any) => list.Visibility === true)?.length || 0}
                        </p>
                        <p className="text-[hsl(var(--text-light))] font-poppins text-xs sm:text-xs truncate">
                          {t("dashboard.home.activePlaces")}
                        </p>
                      </div>
                    </div>
                    <div className="bg-dashboard-sidebar backdrop-blur-sm rounded-xl px-2 sm:px-3 py-2 border border-dashboard flex-1 min-w-0">
                      <div className="text-center">
                        <p className="text-base sm:text-lg md:text-xl font-bold text-white">
                          {listNames?.filter((list: any) => list.Visibility === true)?.reduce((total: number, list: any) =>
                            total + (list?.recommended_places?.length || 0), 0
                          ) || 0}
                        </p>
                        <p className="text-[hsl(var(--text-light))] font-poppins text-xs sm:text-xs truncate">
                          {t("dashboard.recommendations.recommendationsTab")}
                        </p>
                      </div>
                    </div>
                    <div className="bg-dashboard-sidebar backdrop-blur-sm rounded-xl px-2 sm:px-3 py-2 border border-dashboard flex-1 min-w-0">
                      <div className="text-center">
                        <p className="text-base sm:text-lg md:text-xl font-bold text-white">
                          {allGuides?.length || 0}
                        </p>
                        <p className="text-[hsl(var(--text-light))] font-poppins text-xs sm:text-xs truncate">
                          Guides
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Share Profile - Outside Card */}
              <div className="mt-4 px-2 sm:px-0">
                <div
                  className="bg-[hsl(var(--blue-cta))] backdrop-blur-sm border-2 border-[hsl(var(--blue-cta))]/50 rounded-xl p-3 cursor-pointer hover:bg-[hsl(var(--blue-final))] hover:border-[hsl(var(--blue-final))]/50 transition-all duration-200 hover:shadow-dashboard-elevated hover:shadow-dashboard-accent/10"
                  onClick={() => setShowProfileShareModal(true)}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-white font-poppins text-sm font-semibold">
                      Share Profile
                    </span>
                    <ShareIcon color="white" />
                  </div>
                </div>
              </div>

              <ShareModal
                shareButtons={shareButtons}
                isOpen={showProfileShareModal}
                onClose={() => setShowProfileShareModal(false)}
                url={`${url}/${user?.username}`}
                utmParams={profileUtmParams}
                backgroundImage={account?.bg_picture?.url || IMAGE_CONFIG.defaultImages.background}
              />

              <ShareModal
                shareButtons={shareButtons}
                isOpen={showRecommendationsShareModal}
                onClose={() => setShowRecommendationsShareModal(false)}
                url={`${url}/${user?.username}/places`}
                utmParams={recommendationUtmParams}
                backgroundImage={account?.bg_picture?.url || IMAGE_CONFIG.defaultImages.background}
              />
            </div>
          )}

          {/* Recommendations & Guides Section - Show when setup is complete AND acknowledged */}
          {isAllSetupComplete && (
            <>
              <div className="w-full md:pb-6">
                {/* Tabs UI */}
                <div className="mb-6 px-2 sm:px-0">
                  <div className="flex items-center justify-center mx-auto mb-4">
                    <div className="flex items-center justify-center mx-auto bg-white font-poppins rounded-3xl">
                      <button
                        onClick={() => setActiveTab("recommendations")}
                        className={`px-4 py-2 text-xs font-medium transition-all duration-300 whitespace-nowrap ${activeTab === "recommendations"
                          ? "bg-gradient-to-r bg-dashboard-accent rounded-2xl text-dashboard"
                          : "bg-white rounded-2xl text-black"
                          }`}
                      >
                        {t("dashboard.home.myRecommendations")}
                      </button>
                      <button
                        onClick={() => setActiveTab("guides")}
                        className={`px-4 py-2 text-xs font-medium transition-all duration-300 whitespace-nowrap ${activeTab === "guides"
                          ? "bg-gradient-to-r bg-dashboard-accent rounded-2xl text-dashboard"
                          : "bg-white rounded-2xl text-black"
                          }`}
                      >
                        My Guides
                      </button>
                    </div>
                  </div>

                  {/* Share URL Bars Below Tabs */}
                  {activeTab === "recommendations" && (
                    <div className="mb-4 px-2 sm:px-0">
                      <div className="relative flex items-center bg-dashboard-sidebar border border-dashboard rounded-xl px-3 sm:px-4 py-2 sm:py-3 transition-all duration-200">
                        {/* URL Display */}
                        <div className="flex-1 min-w-0 pr-2">
                          <input
                            type="text"
                            readOnly
                            value={`${url}/${user?.username}/recommendations`}
                            className="w-full bg-transparent text-dashboard font-poppins outline-none cursor-text text-sm sm:text-base truncate"
                          />
                        </div>
                        {/* Icon Buttons */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Copy Button */}
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(`${url}/${user?.username}/recommendations`);
                              } catch (err) {
                                console.error("Failed to copy:", err);
                              }
                            }}
                            className="bg-[hsl(var(--blue-cta))] hover:bg-[hsl(var(--blue-final))] text-white rounded-lg transition-all duration-200 flex items-center justify-center h-9 w-9"
                            aria-label="Copy URL"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          {/* Open Button */}
                          <button
                            onClick={() => {
                              window.open(`${url}/${user?.username}/recommendations`, "_blank");
                            }}
                            className="bg-[hsl(var(--blue-cta))] hover:bg-[hsl(var(--blue-final))] text-white rounded-lg transition-all duration-200 flex items-center justify-center h-9 w-9"
                            aria-label="Open URL"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                          {/* Share Button */}
                          <button
                            onClick={() => setShowRecommendationsShareModal(true)}
                            className="bg-[hsl(var(--blue-cta))] hover:bg-[hsl(var(--blue-final))] text-white rounded-lg transition-all duration-200 flex items-center justify-center h-9 w-9"
                            aria-label="Share"
                          >
                            <ShareIcon color="white" size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "guides" && (
                    <div className="mb-4 px-2 sm:px-0">
                      <div className="relative flex items-center bg-dashboard-sidebar border border-dashboard rounded-xl px-3 sm:px-4 py-2 sm:py-3 transition-all duration-200">
                        {/* URL Display */}
                        <div className="flex-1 min-w-0 pr-2">
                          <input
                            type="text"
                            readOnly
                            value={`${url}/${user?.username}/guides`}
                            className="w-full bg-transparent text-dashboard font-poppins outline-none cursor-text text-sm sm:text-base truncate"
                          />
                        </div>
                        {/* Icon Buttons */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Copy Button */}
                          <button
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(`${url}/${user?.username}/guides`);
                              } catch (err) {
                                console.error("Failed to copy:", err);
                              }
                            }}
                            className="bg-[hsl(var(--blue-cta))] hover:bg-[hsl(var(--blue-final))] text-white rounded-lg transition-all duration-200 flex items-center justify-center h-9 w-9"
                            aria-label="Copy URL"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          {/* Open Button */}
                          <button
                            onClick={() => {
                              window.open(`${url}/${user?.username}/guides`, "_blank");
                            }}
                            className="bg-[hsl(var(--blue-cta))] hover:bg-[hsl(var(--blue-final))] text-white rounded-lg transition-all duration-200 flex items-center justify-center h-9 w-9"
                            aria-label="Open URL"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                          {/* Share Button */}
                          <button
                            onClick={() => setShowGuidesShareModal(true)}
                            className="bg-[hsl(var(--blue-cta))] hover:bg-[hsl(var(--blue-final))] text-white rounded-lg transition-all duration-200 flex items-center justify-center h-9 w-9"
                            aria-label="Share"
                          >
                            <ShareIcon color="white" size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tab Content */}
                {activeTab === "recommendations" && (
                  <>
                    {listNames?.length === 0 ? (
                      // Show true empty state only when user has zero recommendations total
                      <div className="flex flex-col items-center w-full gap-4 pt-10 pb-20 font-poppins md:text-lg text-white ">
                        <h2 className="md:w-1/2 w-3/4 text-center dt-heading">
                          {t("dashboard.home.startCurating")}
                        </h2>

                        <Button
                          btnText={t("dashboard.home.addRecommendations")}
                          size="xsmall"
                          variant="primary"
                          onClickHandler={() => navigate("/recommendations")}
                          className="w-auto px-16"
                        />
                      </div>
                    ) : (
                      <div className="w-full">
                        {/* Search Bar - Full Width */}
                        <div className="w-full mb-6 px-2 sm:px-0">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder={t("dashboard.recommendations.locationForm.labels.searchLocation")}
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full px-3 sm:px-4 py-2 sm:py-3 pl-8 sm:pl-10 pr-3 sm:pr-4 bg-dashboard-sidebar border border-dashboard rounded-xl text-dashboard placeholder-dashboard-light focus:outline-none focus:ring-2 focus:ring-dashboard-accent/50 focus:border-dashboard-accent/50 transition-all duration-200 text-sm sm:text-base"
                            />
                            <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none">
                              <svg className="h-4 w-4 sm:h-5 sm:w-5 text-[hsl(var(--muted-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        {filteredListNames?.length > 0 ? (
                          // Show filtered cards when there are matching results
                          <div className="space-y-3 pb-20">
                            {filteredListNames?.map(
                              (
                                item: {
                                  documentId: string;
                                  List_Name: string;
                                  Visibility: boolean;
                                  recommended_places: any[];
                                  List_Name_Details?: {
                                    thumbnail?: string;
                                    location?: {
                                      latitude: string;
                                      longitude: string;
                                    };
                                  };
                                },
                                index: number
                              ) => (
                                <div
                                  className="group relative bg-dashboard-sidebar backdrop-blur-sm border border-dashboard rounded-2xl p-4 hover:border-dashboard-accent/50 transition-all duration-300 hover:shadow-dashboard-elevated hover:shadow-dashboard-accent/10 hover:scale-105 cursor-pointer"
                                  key={item?.documentId ?? index}
                                  onClick={() => {
                                    // Set the selected city in the store
                                    setSelectedCity({
                                      documentId: item.documentId,
                                      List_Name: item.List_Name,
                                      Visibility: item.Visibility,
                                      List_Name_Details: item.List_Name_Details,
                                      recommended_places: item.recommended_places,
                                    });
                                    // Navigate to recommendations page
                                    navigate('/recommendations');
                                  }}
                                >
                                  <div className="flex items-center gap-4">
                                    {/* City Thumbnail */}
                                    <div className="flex-shrink-0">
                                      <div className={`w-16 h-16 rounded-full overflow-hidden border-[3px] ${item.Visibility ? "border-[hsl(var(--status-published))]" : "border-[hsl(var(--status-draft))]"
                                        }`}>
                                        <ImageWithFallback
                                          src={
                                            item?.List_Name_Details?.thumbnail ||
                                            "https://images.unsplash.com/photo-1506905925346-14b1e3d7e6b9?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80"
                                          }
                                          alt={item?.List_Name}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    </div>

                                    {/* City Details - Simplified */}
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-lg font-bold font-poppins text-white mb-1 truncate">
                                        {item?.List_Name}
                                      </h4>

                                      <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[hsl(var(--text-light))] font-poppins text-sm">
                                            {item?.recommended_places?.length || 0} {t("dashboard.recommendations.recommendationsTab")}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Share Icon or Draft Status */}
                                    <div className="flex-shrink-0">
                                      {item.Visibility ? (
                                        <Button
                                          startIcon={<ShareIcon color="white" />}
                                          size="xsmall"
                                          variant="ghost"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowRecommendationShareModals((prev) => ({
                                              ...prev,
                                              [item.documentId]: true,
                                            }));
                                          }}
                                          className="opacity-100 p-0 bg-transparent border-0 hover:bg-transparent"
                                        />
                                      ) : (
                                        <span className="font-poppins text-[hsl(var(--blue-cta))] text-xs bg-[hsl(var(--blue-cta))]/10 border border-[hsl(var(--blue-cta))]/30 px-3 py-2 rounded-full">
                                          {t("dashboard.home.draft")}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <ShareModal
                                    shareButtons={shareButtons}
                                    isOpen={
                                      !!showRecommendationShareModals[item.documentId]
                                    }
                                    onClose={() =>
                                      setShowRecommendationShareModals((prev) => ({
                                        ...prev,
                                        [item.documentId]: false,
                                      }))
                                    }
                                    url={`${url}/${user?.username}/places/${toUrlSlug(
                                      item.List_Name
                                    )}`}
                                    utmParams={recommendationUtmParams}
                                    backgroundImage={item?.List_Name_Details?.thumbnail || account?.bg_picture?.url || IMAGE_CONFIG.defaultImages.background}
                                  />
                                </div>
                              )
                            )}
                          </div>
                        ) : (
                          // Show search empty result when search exists but no matches
                          <div className="text-center py-8 pb-20">
                            <div className="text-[hsl(var(--muted-foreground))] mb-4">
                              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              <h3 className="text-lg font-poppins font-semibold text-white mb-2">
                                No recommendations found
                              </h3>
                              <p className="text-[hsl(var(--muted-foreground))] font-poppins text-sm">
                                Try searching with a different name
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {activeTab === "guides" && (
                  <>
                    {/* Search Bar - Full Width */}
                    <div className="w-full mb-6 px-2 sm:px-0">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search Guide"
                          value={guidesSearchQuery}
                          onChange={(e) => setGuidesSearchQuery(e.target.value)}
                          className="w-full px-3 sm:px-4 py-2 sm:py-3 pl-8 sm:pl-10 pr-3 sm:pr-4 bg-dashboard-sidebar border border-dashboard rounded-xl text-dashboard placeholder-dashboard-light focus:outline-none focus:ring-2 focus:ring-dashboard-accent/50 focus:border-dashboard-accent/50 transition-all duration-200 text-sm sm:text-base"
                        />
                        <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none">
                          <svg className="h-4 w-4 sm:h-5 sm:w-5 text-[hsl(var(--muted-foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {allGuides.length === 0 ? (
                      // Show "No Guides Yet" only when user has zero guides total
                      <div className="text-center py-8 pb-20">
                        <div className="text-[hsl(var(--muted-foreground))] mb-4">
                          <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <h3 className="text-lg font-poppins font-semibold text-white mb-2">
                            No Guides Yet
                          </h3>
                          <p className="text-[hsl(var(--muted-foreground))] font-poppins text-sm mb-4">
                            Create your first travel guide to get started
                          </p>
                          <Button
                            btnText="Create Guide"
                            size="xsmall"
                            variant="primary"
                            onClickHandler={() => navigate("/guides/new")}
                            className="w-auto px-8"
                          />
                        </div>
                      </div>
                    ) : filteredGuides.length > 0 ? (
                      // Show guide cards when there are matching results
                      <div className="space-y-3 pb-20">
                        {filteredGuides.map((guide: Guide, index: number) => {
                          return (
                            <div
                              key={guide.documentId || index}
                              className="group relative w-full bg-dashboard-sidebar backdrop-blur-sm border border-dashboard rounded-2xl py-5 px-4 hover:border-dashboard-accent/50 transition-all duration-300 hover:shadow-dashboard-elevated hover:shadow-dashboard-accent/10 hover:scale-105 cursor-pointer"
                              onClick={() => {
                                navigate(`/guides/${guide.documentId}`);
                              }}
                            >
                              <div className="flex items-center gap-4">
                                {/* Guide Cover Image */}
                                <div className="flex-shrink-0">
                                  <div className={`w-16 h-16 rounded-full overflow-hidden border-[3px] ${guide.Visibility ? "border-[hsl(var(--status-published))]" : "border-[hsl(var(--status-draft))]"
                                    }`}>
                                    <ImageWithFallback
                                      src={
                                        guide?.Guide_Media?.[0]?.url ||
                                        "https://images.unsplash.com/photo-1506905925346-14b1e3d7e6b9?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&q=80"
                                      }
                                      alt={guide?.Title}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                </div>

                                {/* Guide Details */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    {/* Guide Icon */}
                                    <svg
                                      className="w-4 h-4 text-[hsl(var(--text-light))] flex-shrink-0"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                                      />
                                    </svg>
                                    <h4 className="text-lg font-bold font-poppins text-white truncate">
                                      {guide?.Title}
                                    </h4>
                                    {/* Days Badge with Calendar Icon */}
                                    {guide?.Number_Of_Days && (
                                      <span className="bg-[hsl(var(--muted-foreground))]/20 text-[hsl(var(--text-light))] text-xs font-poppins font-medium px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        {guide.Number_Of_Days} {guide.Number_Of_Days === 1 ? "Day" : "Days"}
                                      </span>
                                    )}
                                    {/* Guide Type Badge */}
                                    {guide?.Guide_Type && (
                                      <span className="bg-[hsl(var(--muted-foreground))]/10 text-[hsl(var(--text-light))] text-xs font-poppins font-medium px-2 py-0.5 rounded-full flex-shrink-0 border border-[hsl(var(--muted-foreground))]/20">
                                        {guide.Guide_Type}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {(() => {
                                      const locationNames = extractLocationNames(guide);
                                      // Normalize and deduplicate
                                      const uniqueNames = new Set<string>();
                                      locationNames.forEach((name: string) => {
                                        if (name && typeof name === "string") {
                                          const normalized = name.trim().toLowerCase();
                                          if (normalized.length > 0) {
                                            uniqueNames.add(normalized);
                                          }
                                        }
                                      });
                                      const uniqueArray = Array.from(uniqueNames);
                                      const displayNames = uniqueArray.slice(0, 3);
                                      const remainingCount = uniqueArray.length - 3;

                                      if (displayNames.length === 0) {
                                        return null;
                                      }

                                      return (
                                        <>
                                          {displayNames.map((name, idx) => {
                                            // Find original name (preserve case)
                                            const originalName = locationNames.find(
                                              (n: string) => n.trim().toLowerCase() === name
                                            ) || name;
                                            return (
                                              <span key={idx} className="text-[hsl(var(--text-light))] font-poppins text-sm">
                                                {originalName}{idx < displayNames.length - 1 ? "," : ""}
                                              </span>
                                            );
                                          })}
                                          {remainingCount > 0 && (
                                            <span className="text-[hsl(var(--text-light))] font-poppins text-sm">
                                              +{remainingCount} more
                                            </span>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>

                                {/* Share Icon or Draft Status */}
                                <div className="flex-shrink-0">
                                  {guide.Visibility ? (
                                    <Button
                                      startIcon={<ShareIcon color="white" />}
                                      size="xsmall"
                                      variant="ghost"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowGuideShareModals((prev) => ({
                                          ...prev,
                                          [guide.documentId]: true,
                                        }));
                                      }}
                                      className="opacity-100 p-0 bg-transparent border-0 hover:bg-transparent"
                                    />
                                  ) : (
                                    <span className="font-poppins text-[hsl(var(--blue-cta))] text-xs bg-[hsl(var(--blue-cta))]/10 border border-[hsl(var(--blue-cta))]/30 px-3 py-2 rounded-full">
                                      {t("dashboard.home.draft")}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <ShareModal
                                shareButtons={shareButtons}
                                isOpen={!!showGuideShareModals[guide.documentId]}
                                onClose={() =>
                                  setShowGuideShareModals((prev) => ({
                                    ...prev,
                                    [guide.documentId]: false,
                                  }))
                                }
                                url={`${url}/${user?.username}/guides`}
                                utmParams={guidesUtmParams}
                                backgroundImage={guide?.Guide_Media?.[0]?.url || account?.bg_picture?.url || IMAGE_CONFIG.defaultImages.background}
                                hideQRTab={true}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      // Show search empty result when search exists but no matches
                      <div className="text-center py-8 pb-20">
                        <div className="text-[hsl(var(--muted-foreground))] mb-4">
                          <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <h3 className="text-lg font-poppins font-semibold text-white mb-2">
                            No guides found
                          </h3>
                          <p className="text-[hsl(var(--muted-foreground))] font-poppins text-sm">
                            Try searching with a different name
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {listNames?.length > 3 && activeTab === "recommendations" && <GlobeDemo arcsData={arcsData} />}
              </div>

              {/* Share Modals */}
              <ShareModal
                shareButtons={shareButtons}
                isOpen={showRecommendationsShareModal}
                onClose={() => setShowRecommendationsShareModal(false)}
                url={`${url}/${user?.username}/places`}
                utmParams={recommendationUtmParams}
                backgroundImage={account?.bg_picture?.url || IMAGE_CONFIG.defaultImages.background}
              />

              <ShareModal
                shareButtons={shareButtons}
                isOpen={showGuidesShareModal}
                onClose={() => setShowGuidesShareModal(false)}
                url={`${url}/${user?.username}/guides`}
                utmParams={guidesUtmParams}
                backgroundImage={account?.bg_picture?.url || IMAGE_CONFIG.defaultImages.background}
                hideQRTab={true}
              />
            </>
          )}

          {/* Profile Setup Card - Show when setup is incomplete OR when complete but not yet acknowledged */}
          {!isAllSetupComplete && (
            <AccountSetupCard
              isProfileComplete={isProfileComplete}
              isRecommendationsComplete={isRecommendationsComplete}
            />
          )}
        </div>
      </div>
    </>
  );
});

export default Home;