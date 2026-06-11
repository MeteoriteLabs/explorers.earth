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

// Category integrations
import { MOVIE_LISTS_BY_ACCOUNT } from "../features/Movies/api/query";
import { BOOK_LISTS_BY_ACCOUNT } from "../features/Books/api/query";
import { GAME_LISTS_BY_ACCOUNT } from "../features/Games/api/query";
import { useTunesDashboard } from "../hooks/useTunesDashboard";
import { GET_PUBLIC_PAGE_ANALYTICS } from "../features/Analytics/api/queries";


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
  const [showCategoryShareModal, setShowCategoryShareModal] =
    useState<boolean>(false);
  const [showRecommendationShareModals, setShowRecommendationShareModals] =
    useState<{ [key: string]: boolean }>({});
  const [showGuidesShareModal, setShowGuidesShareModal] = useState<boolean>(false);
  const [showGuideShareModals, setShowGuideShareModals] = useState<{ [key: string]: boolean }>({});
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"places" | "movies" | "books" | "games" | "music" | "guides">("places");

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

  // Fetch movie lists
  const { data: movieListsData } = useQuery(MOVIE_LISTS_BY_ACCOUNT, {
    variables: { accountDocumentId },
    skip: !accountDocumentId || !user?.username,
    fetchPolicy: "network-only",
  });
  const movieLists = movieListsData?.movieLists || [];

  // Fetch book lists
  const { data: bookListsData } = useQuery(BOOK_LISTS_BY_ACCOUNT, {
    variables: { accountDocumentId },
    skip: !accountDocumentId || !user?.username,
    fetchPolicy: "network-only",
  });
  const bookLists = bookListsData?.bookLists || [];

  // Fetch game lists
  const { data: gameListsData } = useQuery(GAME_LISTS_BY_ACCOUNT, {
    variables: { accountDocumentId },
    skip: !accountDocumentId || !user?.username,
    fetchPolicy: "network-only",
  });
  const gameLists = gameListsData?.gameLists || [];

  // Fetch music playlists
  const tunesDashboard = useTunesDashboard();
  const musicPlaylists = tunesDashboard.playlists || [];

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

  // Fetch analytics data for dynamic view count
  const { data: analyticsData } = useQuery(GET_PUBLIC_PAGE_ANALYTICS, {
    errorPolicy: "all",
    fetchPolicy: "cache-and-network",
    skip: !user?.documentId || !accountDocumentId,
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

  const activeTabShareUrl = useMemo(() => {
    let subPath = "places";
    if (activeTab === "places") subPath = "places";
    else if (activeTab === "movies") subPath = "movies";
    else if (activeTab === "books") subPath = "books";
    else if (activeTab === "games") subPath = "games";
    else if (activeTab === "music") subPath = "music";
    else if (activeTab === "guides") subPath = "guides";

    return `${url}/${user?.username}/${subPath}`;
  }, [activeTab, url, user?.username]);
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

  const totalActiveListsCount = useMemo(() => {
    const activePlaces = listNames?.filter((list: any) => list.Visibility === true)?.length || 0;
    const activeMovies = movieLists?.filter((list: any) => list.Visibility === true)?.length || 0;
    const activeBooks = bookLists?.filter((list: any) => list.visibility === true)?.length || 0;
    const activeGames = gameLists?.filter((list: any) => list.Visibility === true)?.length || 0;
    const activeMusic = musicPlaylists?.filter((list: any) => list.isVisibleToGuests === true)?.length || 0;
    return activePlaces + activeMovies + activeBooks + activeGames + activeMusic;
  }, [listNames, movieLists, bookLists, gameLists, musicPlaylists]);

  const totalRecommendationsCount = useMemo(() => {
    const placesRecs = listNames?.filter((list: any) => list.Visibility === true)?.reduce((total: number, list: any) => total + (list?.recommended_places?.length || 0), 0) || 0;
    const moviesRecs = movieLists?.filter((list: any) => list.Visibility === true)?.reduce((total: number, list: any) => total + (list?.recommended_movies?.length || 0), 0) || 0;
    const booksRecs = bookLists?.filter((list: any) => list.visibility === true)?.reduce((total: number, list: any) => total + (list?.recommended_books?.length || 0), 0) || 0;
    const gamesRecs = gameLists?.filter((list: any) => list.Visibility === true)?.reduce((total: number, list: any) => total + (list?.recommended_games?.length || 0), 0) || 0;
    const guidesRecs = allGuides?.filter((guide: any) => guide.Visibility === true)?.length || 0;
    return placesRecs + moviesRecs + booksRecs + gamesRecs + guidesRecs;
  }, [listNames, movieLists, bookLists, gameLists, allGuides]);

  const totalViewsCount = useMemo(() => {
    if (!analyticsData?.publicPageAnalytics || !accountDocumentId) return "0";
    const accountData = analyticsData.publicPageAnalytics.filter(
      (item: any) => item.Account_Id === accountDocumentId
    );
    const allEvents: any[] = accountData.flatMap((item: any) => item.Stats || []);
    const totalViews = allEvents.filter(event => event.type === 'view').length;

    if (totalViews >= 1000) {
      return (totalViews / 1000).toFixed(1) + "k";
    }
    return totalViews.toString();
  }, [analyticsData, accountDocumentId]);

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


  // Filter guides based on search query
  // Filter guides based on search query
  const filteredGuides = useMemo(() => {
    if (!searchQuery.trim()) return allGuides;
    const query = searchQuery.toLowerCase();
    return allGuides.filter((guide: Guide) =>
      guide?.Title?.toLowerCase().includes(query)
    );
  }, [allGuides, searchQuery]);

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

  // Filter movies lists based on search query
  const filteredMovieLists = useMemo(() => {
    if (!searchQuery.trim()) return movieLists;
    const query = searchQuery.toLowerCase();
    return movieLists.filter((item: any) =>
      item?.List_Name?.toLowerCase().includes(query) ||
      item?.list_description?.toLowerCase().includes(query) ||
      item?.recommended_movies?.some((movie: any) =>
        movie?.title?.toLowerCase().includes(query)
      )
    );
  }, [movieLists, searchQuery]);

  // Filter books lists based on search query
  const filteredBookLists = useMemo(() => {
    if (!searchQuery.trim()) return bookLists;
    const query = searchQuery.toLowerCase();
    return bookLists.filter((item: any) =>
      item?.List_Name?.toLowerCase().includes(query) ||
      item?.list_description?.toLowerCase().includes(query) ||
      item?.recommended_books?.some((book: any) =>
        book?.title?.toLowerCase().includes(query) ||
        book?.authors?.some((author: string) => author.toLowerCase().includes(query))
      )
    );
  }, [bookLists, searchQuery]);

  // Filter games lists based on search query
  const filteredGameLists = useMemo(() => {
    if (!searchQuery.trim()) return gameLists;
    const query = searchQuery.toLowerCase();
    return gameLists.filter((item: any) =>
      item?.List_Name?.toLowerCase().includes(query) ||
      item?.list_description?.toLowerCase().includes(query) ||
      item?.recommended_games?.some((game: any) =>
        game?.title?.toLowerCase().includes(query)
      )
    );
  }, [gameLists, searchQuery]);

  // Filter music playlists based on search query
  const filteredMusicPlaylists = useMemo(() => {
    if (!searchQuery.trim()) return musicPlaylists;
    const query = searchQuery.toLowerCase();
    return musicPlaylists.filter((item: any) =>
      item?.name?.toLowerCase().includes(query) ||
      item?.description?.toLowerCase().includes(query) ||
      item?.songs?.some((song: any) =>
        song?.title?.toLowerCase().includes(query) ||
        song?.artist?.toLowerCase().includes(query)
      )
    );
  }, [musicPlaylists, searchQuery]);

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



  const handleAddNewItem = () => {
    if (activeTab === "places") navigate("/recommendations");
    else if (activeTab === "movies") navigate("/recommendations/movies");
    else if (activeTab === "books") navigate("/recommendations/books");
    else if (activeTab === "games") navigate("/recommendations/games");
    else if (activeTab === "music") navigate("/music");
    else if (activeTab === "guides") navigate("/guides/new");
  };

  const getAddButtonStyles = (_cat?: any) => {
    return { backgroundColor: "#3B82F6", color: "white" };
  };


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

                  {/* Share Profile Button overlaid on top-right corner of map */}
                  <div
                    title="Share Profile"
                    onClick={() => setShowProfileShareModal(true)}
                    className="absolute top-2 right-2 bg-[#3B82F6] hover:bg-[#2563EB] border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-1.5 cursor-pointer z-10 transition-all shadow-md"
                  >
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider font-poppins">Share Profile</span>
                    <ShareIcon color="white" size={10} />
                  </div>
                </div>

                {/* Profile Content */}
                <div className="relative px-4 pb-4 -mt-12 md:-mt-16 pointer-events-none">
                  {/* Profile Name */}
                  <div className="text-center mb-4 pt-14 md:pt-20 pointer-events-none">
                    <h2 className="inline-block text-lg md:text-xl font-bold font-poppins text-white pointer-events-auto">
                      {account?.Account_Name}
                    </h2>
                  </div>

                  {/* Stats Badges Row */}
                  <div className="flex gap-2 sm:gap-3 justify-center px-2 sm:px-0 pointer-events-auto">
                    <div className="bg-dashboard-sidebar backdrop-blur-sm rounded-xl px-2 sm:px-3 py-2 border border-dashboard flex-1 min-w-0">
                      <div className="text-center">
                        <p className="text-base sm:text-lg md:text-xl font-bold text-white">
                          {totalActiveListsCount}
                        </p>
                        <p className="text-[hsl(var(--text-light))] font-poppins text-xs sm:text-xs truncate">
                          Active Lists
                        </p>
                      </div>
                    </div>
                    <div className="bg-dashboard-sidebar backdrop-blur-sm rounded-xl px-2 sm:px-3 py-2 border border-dashboard flex-1 min-w-0">
                      <div className="text-center">
                        <p className="text-base sm:text-lg md:text-xl font-bold text-white">
                          {totalRecommendationsCount}
                        </p>
                        <p className="text-[hsl(var(--text-light))] font-poppins text-xs sm:text-xs truncate">
                          Recommendations
                        </p>
                      </div>
                    </div>
                    <div className="bg-dashboard-sidebar backdrop-blur-sm rounded-xl px-2 sm:px-3 py-2 border border-dashboard flex-1 min-w-0">
                      <div className="text-center">
                        <p className="text-base sm:text-lg md:text-xl font-bold text-white">
                          {totalViewsCount}
                        </p>
                        <p className="text-[hsl(var(--text-light))] font-poppins text-xs sm:text-xs truncate">
                          Views
                        </p>
                      </div>
                    </div>
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
          {isAllSetupComplete && (
            <>
              <div className="w-full md:pb-6">
                {/* Category Tabs Selector */}
                <div className="home-tab-container bg-[var(--dash-tab-bg)] rounded-[28px] p-[3px] flex gap-1 mb-4 overflow-x-auto scrollbar-hide">
                  {(
                    [
                      { id: "places", label: "Places", icon: "📍" },
                      { id: "movies", label: "Movies", icon: "🎬" },
                      { id: "books", label: "Books", icon: "📚" },
                      { id: "games", label: "Games", icon: "🎮" },
                      { id: "music", label: "Music", icon: "🎵" },
                      { id: "guides", label: "Guides", icon: "📖" },
                    ] as const
                  ).map((cat) => {
                    const isActive = activeTab === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setActiveTab(cat.id)}
                        className={`flex-1 min-w-max bg-transparent border-none rounded-[24px] py-1.5 px-3 text-xs font-semibold font-poppins cursor-pointer whitespace-nowrap transition-all duration-200 ${
                          isActive
                            ? "bg-dashboard-accent text-white font-bold"
                            : "text-white/55"
                        }`}
                      >
                        {cat.icon} {cat.label}
                      </button>
                    );
                  })}
                </div>

                {/* Search bar + Add button + Share Button Row */}
                <div className="flex flex-row items-center gap-1.5 mb-4 px-2 sm:px-0 w-full">
                  <div className="flex-1 flex items-center gap-2 bg-[var(--dash-search-bg)] border border-dashboard rounded-xl px-2 sm:px-3 py-2 h-10 min-w-0">
                    <svg width="13" height="13" fill="none" stroke="rgba(255,255,255,0.4)" viewBox="0 0 24 24" className="flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                    <input
                      type="text"
                      placeholder={`Search ${activeTab === "places" ? "places" : activeTab}, lists…`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 bg-transparent text-white placeholder-white/30 text-[11px] sm:text-xs font-poppins outline-none border-none p-0 min-w-0"
                    />
                  </div>
                  <button
                    onClick={handleAddNewItem}
                    style={getAddButtonStyles(activeTab)}
                    className="flex-shrink-0 flex items-center justify-center gap-1 h-10 px-3 sm:px-4 rounded-xl text-[11px] sm:text-xs font-bold font-poppins transition-all duration-200 hover:brightness-110 whitespace-nowrap"
                  >
                    <span>+</span> Add {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                  </button>
                  <button
                    onClick={() => setShowCategoryShareModal(true)}
                    title="Share recommendations link"
                    className="w-10 h-10 rounded-xl bg-[var(--dash-search-bg)] border border-dashboard flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-dashboard-muted flex-shrink-0 text-white/70 hover:text-white"
                  >
                    <ShareIcon size={14} />
                  </button>
                </div>

                {/* Recommendation List Items Container */}
                <div className="home-list-container">
                  {/* Category Lists Rendering */}
                  {activeTab === "places" && (
                    <>
                      {listNames?.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-dashboard-sidebar/20 rounded-2xl border border-dashboard/20">
                          <div className="w-16 h-16 rounded-full bg-dashboard-muted/50 flex items-center justify-center mb-4 text-3xl">
                            📍
                          </div>
                          <h3 className="text-base font-semibold text-white mb-1">No places lists yet</h3>
                          <p className="text-xs text-white/55 max-w-xs mb-4">Create your first list to start sharing your recommendations.</p>
                          <button onClick={handleAddNewItem} style={getAddButtonStyles("places")} className="px-6 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110">
                            Create Places List
                          </button>
                        </div>
                      ) : filteredListNames?.length > 0 ? (
                        <div className="space-y-3 pb-20">
                          {filteredListNames.map((item: any, index: number) => {
                            const isPub = item.Visibility;
                            const statusColor = isPub ? "var(--status-pub)" : "var(--status-draft)";
                            const poster = item.List_Name_Details?.thumbnail;
                            return (
                              <div
                                key={item.documentId || index}
                                onClick={() => {
                                  setSelectedCity({
                                    documentId: item.documentId,
                                    List_Name: item.List_Name,
                                    Visibility: item.Visibility,
                                    List_Name_Details: item.List_Name_Details,
                                    recommended_places: item.recommended_places,
                                  });
                                  navigate('/recommendations');
                                }}
                                className="group relative bg-dashboard-sidebar border border-dashboard rounded-2xl p-4 hover:border-dashboard-accent/50 transition-all duration-300 hover:shadow-dashboard-elevated hover:shadow-dashboard-accent/10 hover:scale-[1.02] cursor-pointer flex items-center gap-4"
                              >
                                <div className="flex-shrink-0">
                                  <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-2xl bg-dashboard-muted" style={{ border: `3px solid ${statusColor}` }}>
                                    {poster ? (
                                      <ImageWithFallback src={poster} alt={item.List_Name} className="w-full h-full object-cover" />
                                    ) : (
                                      "📍"
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-base font-bold text-white truncate mb-1">{item.List_Name}</h4>
                                  <p className="text-xs text-white/45 truncate">
                                    {item.recommended_places?.length || 0} places · <span style={{ color: statusColor }}>{isPub ? "Published" : "Draft"}</span>
                                  </p>
                                </div>
                                <div className="flex-shrink-0">
                                  {isPub ? (
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
                                <ShareModal
                                  shareButtons={shareButtons}
                                  isOpen={!!showRecommendationShareModals[item.documentId]}
                                  onClose={() =>
                                    setShowRecommendationShareModals((prev) => ({
                                      ...prev,
                                      [item.documentId]: false,
                                    }))
                                  }
                                  url={`${url}/${user?.username}/places/${toUrlSlug(item.List_Name)}`}
                                  utmParams={recommendationUtmParams}
                                  backgroundImage={poster || account?.bg_picture?.url || IMAGE_CONFIG.defaultImages.background}
                                />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 pb-20">
                          <svg className="w-16 h-16 mx-auto mb-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <h3 className="text-lg font-semibold text-white mb-1">No matches found</h3>
                          <p className="text-xs text-white/55">Try searching with a different name</p>
                        </div>
                      )}
                    </>
                  )}

                  {activeTab === "movies" && (
                    <>
                      {movieLists.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-dashboard-sidebar/20 rounded-2xl border border-dashboard/20">
                          <div className="w-16 h-16 rounded-full bg-dashboard-muted/50 flex items-center justify-center mb-4 text-3xl">
                            🎬
                          </div>
                          <h3 className="text-base font-semibold text-white mb-1">No movies lists yet</h3>
                          <p className="text-xs text-white/55 max-w-xs mb-4">Create your first list to start sharing your movie recommendations.</p>
                          <button onClick={handleAddNewItem} style={getAddButtonStyles("movies")} className="px-6 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110">
                            Create Movies List
                          </button>
                        </div>
                      ) : filteredMovieLists.length > 0 ? (
                        <div className="space-y-3 pb-20">
                          {filteredMovieLists.map((item: any, index: number) => {
                            const isPub = item.Visibility;
                            const statusColor = isPub ? "var(--status-pub)" : "var(--status-draft)";
                            const firstMoviePoster = item.recommended_movies?.[0]?.poster_path;
                            const poster = item.cover_image?.url || (firstMoviePoster ? `https://image.tmdb.org/t/p/w185${firstMoviePoster}` : undefined);
                            return (
                              <div
                                key={item.documentId || index}
                                onClick={() => navigate(`/recommendations/movies/${item.documentId}`)}
                                className="group relative bg-dashboard-sidebar border border-dashboard rounded-2xl p-4 hover:border-dashboard-accent/50 transition-all duration-300 hover:shadow-dashboard-elevated hover:shadow-dashboard-accent/10 hover:scale-[1.02] cursor-pointer flex items-center gap-4"
                              >
                                <div className="flex-shrink-0">
                                  <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-2xl bg-dashboard-muted" style={{ border: `3px solid ${statusColor}` }}>
                                    {poster ? (
                                      <img src={poster} alt={item.List_Name} className="w-full h-full object-cover" />
                                    ) : (
                                      "🎬"
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-base font-bold text-white truncate mb-1">{item.List_Name}</h4>
                                  <p className="text-xs text-white/45 truncate">
                                    {item.recommended_movies?.length || 0} movies · <span style={{ color: statusColor }}>{isPub ? "Published" : "Draft"}</span>
                                  </p>
                                </div>
                                <div className="flex-shrink-0">
                                  {!isPub && (
                                    <span className="font-poppins text-[hsl(var(--blue-cta))] text-xs bg-[hsl(var(--blue-cta))]/10 border border-[hsl(var(--blue-cta))]/30 px-3 py-2 rounded-full">
                                      {t("dashboard.home.draft")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 pb-20">
                          <svg className="w-16 h-16 mx-auto mb-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <h3 className="text-lg font-semibold text-white mb-1">No matches found</h3>
                          <p className="text-xs text-white/55">Try searching with a different name</p>
                        </div>
                      )}
                    </>
                  )}

                  {activeTab === "books" && (
                    <>
                      {bookLists.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-dashboard-sidebar/20 rounded-2xl border border-dashboard/20">
                          <div className="w-16 h-16 rounded-full bg-dashboard-muted/50 flex items-center justify-center mb-4 text-3xl">
                            📚
                          </div>
                          <h3 className="text-base font-semibold text-white mb-1">No books lists yet</h3>
                          <p className="text-xs text-white/55 max-w-xs mb-4">Create your first list to start sharing your book recommendations.</p>
                          <button onClick={handleAddNewItem} style={getAddButtonStyles("books")} className="px-6 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110">
                            Create Books List
                          </button>
                        </div>
                      ) : filteredBookLists.length > 0 ? (
                        <div className="space-y-3 pb-20">
                          {filteredBookLists.map((item: any, index: number) => {
                            const isPub = item.visibility;
                            const statusColor = isPub ? "var(--status-pub)" : "var(--status-draft)";
                            const firstBookCover = item.recommended_books?.[0]?.cover_url;
                            const poster = item.cover_image?.url || firstBookCover;
                            return (
                              <div
                                key={item.documentId || index}
                                onClick={() => navigate(`/recommendations/books/${item.documentId}`)}
                                className="group relative bg-dashboard-sidebar border border-dashboard rounded-2xl p-4 hover:border-dashboard-accent/50 transition-all duration-300 hover:shadow-dashboard-elevated hover:shadow-dashboard-accent/10 hover:scale-[1.02] cursor-pointer flex items-center gap-4"
                              >
                                <div className="flex-shrink-0">
                                  <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-2xl bg-dashboard-muted" style={{ border: `3px solid ${statusColor}` }}>
                                    {poster ? (
                                      <img src={poster} alt={item.List_Name} className="w-full h-full object-cover" />
                                    ) : (
                                      "📚"
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-base font-bold text-white truncate mb-1">{item.List_Name}</h4>
                                  <p className="text-xs text-white/45 truncate">
                                    {item.recommended_books?.length || 0} books · <span style={{ color: statusColor }}>{isPub ? "Published" : "Draft"}</span>
                                  </p>
                                </div>
                                <div className="flex-shrink-0">
                                  {!isPub && (
                                    <span className="font-poppins text-[hsl(var(--blue-cta))] text-xs bg-[hsl(var(--blue-cta))]/10 border border-[hsl(var(--blue-cta))]/30 px-3 py-2 rounded-full">
                                      {t("dashboard.home.draft")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 pb-20">
                          <svg className="w-16 h-16 mx-auto mb-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <h3 className="text-lg font-semibold text-white mb-1">No matches found</h3>
                          <p className="text-xs text-white/55">Try searching with a different name</p>
                        </div>
                      )}
                    </>
                  )}

                  {activeTab === "games" && (
                    <>
                      {gameLists.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-dashboard-sidebar/20 rounded-2xl border border-dashboard/20">
                          <div className="w-16 h-16 rounded-full bg-dashboard-muted/50 flex items-center justify-center mb-4 text-3xl">
                            🎮
                          </div>
                          <h3 className="text-base font-semibold text-white mb-1">No games lists yet</h3>
                          <p className="text-xs text-white/55 max-w-xs mb-4">Create your first list to start sharing your game recommendations.</p>
                          <button onClick={handleAddNewItem} style={getAddButtonStyles("games")} className="px-6 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110">
                            Create Games List
                          </button>
                        </div>
                      ) : filteredGameLists.length > 0 ? (
                        <div className="space-y-3 pb-20">
                          {filteredGameLists.map((item: any, index: number) => {
                            const isPub = item.Visibility;
                            const statusColor = isPub ? "var(--status-pub)" : "var(--status-draft)";
                            const firstGameCover = item.recommended_games?.[0]?.cover_url;
                            const poster = item.cover_image?.url || firstGameCover;
                            return (
                              <div
                                key={item.documentId || index}
                                onClick={() => navigate(`/recommendations/games/${item.documentId}`)}
                                className="group relative bg-dashboard-sidebar border border-dashboard rounded-2xl p-4 hover:border-dashboard-accent/50 transition-all duration-300 hover:shadow-dashboard-elevated hover:shadow-dashboard-accent/10 hover:scale-[1.02] cursor-pointer flex items-center gap-4"
                              >
                                <div className="flex-shrink-0">
                                  <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-2xl bg-dashboard-muted" style={{ border: `3px solid ${statusColor}` }}>
                                    {poster ? (
                                      <img src={poster} alt={item.List_Name} className="w-full h-full object-cover" />
                                    ) : (
                                      "🎮"
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-base font-bold text-white truncate mb-1">{item.List_Name}</h4>
                                  <p className="text-xs text-white/45 truncate">
                                    {item.recommended_games?.length || 0} games · <span style={{ color: statusColor }}>{isPub ? "Published" : "Draft"}</span>
                                  </p>
                                </div>
                                <div className="flex-shrink-0">
                                  {!isPub && (
                                    <span className="font-poppins text-[hsl(var(--blue-cta))] text-xs bg-[hsl(var(--blue-cta))]/10 border border-[hsl(var(--blue-cta))]/30 px-3 py-2 rounded-full">
                                      {t("dashboard.home.draft")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 pb-20">
                          <svg className="w-16 h-16 mx-auto mb-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <h3 className="text-lg font-semibold text-white mb-1">No matches found</h3>
                          <p className="text-xs text-white/55">Try searching with a different name</p>
                        </div>
                      )}
                    </>
                  )}

                  {activeTab === "music" && (
                    <>
                      {musicPlaylists.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-dashboard-sidebar/20 rounded-2xl border border-dashboard/20">
                          <div className="w-16 h-16 rounded-full bg-dashboard-muted/50 flex items-center justify-center mb-4 text-3xl">
                            🎵
                          </div>
                          <h3 className="text-base font-semibold text-white mb-1">No music playlists yet</h3>
                          <p className="text-xs text-white/55 max-w-xs mb-4">Connect and create your first playlist to share your tunes recommendations.</p>
                          <button onClick={handleAddNewItem} style={getAddButtonStyles("music")} className="px-6 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110">
                            Create Music Playlist
                          </button>
                        </div>
                      ) : filteredMusicPlaylists.length > 0 ? (
                        <div className="space-y-3 pb-20">
                          {filteredMusicPlaylists.map((item: any, index: number) => {
                            const isPub = item.isVisibleToGuests;
                            const statusColor = isPub ? "var(--status-pub)" : "var(--status-draft)";
                            const poster = item.songs?.[0]?.thumbnailUrl;
                            return (
                              <div
                                key={item.id || index}
                                onClick={() => navigate("/music")}
                                className="group relative bg-dashboard-sidebar border border-dashboard rounded-2xl p-4 hover:border-dashboard-accent/50 transition-all duration-300 hover:shadow-dashboard-elevated hover:shadow-dashboard-accent/10 hover:scale-[1.02] cursor-pointer flex items-center gap-4"
                              >
                                <div className="flex-shrink-0">
                                  <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-2xl bg-dashboard-muted" style={{ border: `3px solid ${statusColor}` }}>
                                    {poster ? (
                                      <img src={poster} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                      "🎵"
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-base font-bold text-white truncate mb-1">{item.name}</h4>
                                  <p className="text-xs text-white/45 truncate">
                                    {item.songs?.length || 0} tracks · <span style={{ color: statusColor }}>{isPub ? "Visible" : "Hidden"}</span>
                                  </p>
                                </div>
                                <div className="flex-shrink-0">
                                  {!isPub && (
                                    <span className="font-poppins text-[hsl(var(--blue-cta))] text-xs bg-[hsl(var(--blue-cta))]/10 border border-[hsl(var(--blue-cta))]/30 px-3 py-2 rounded-full">
                                      Hidden
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 pb-20">
                          <svg className="w-16 h-16 mx-auto mb-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <h3 className="text-lg font-semibold text-white mb-1">No matches found</h3>
                          <p className="text-xs text-white/55">Try searching with a different name</p>
                        </div>
                      )}
                    </>
                  )}

                  {activeTab === "guides" && (
                    <>
                      {allGuides.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-dashboard-sidebar/20 rounded-2xl border border-dashboard/20">
                          <div className="w-16 h-16 rounded-full bg-dashboard-muted/50 flex items-center justify-center mb-4 text-3xl">
                            📖
                          </div>
                          <h3 className="text-base font-semibold text-white mb-1">No guides yet</h3>
                          <p className="text-xs text-white/55 max-w-xs mb-4">Create your first guide to start sharing your travel itineraries.</p>
                          <button onClick={handleAddNewItem} style={getAddButtonStyles("guides")} className="px-6 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110">
                            Create Guide
                          </button>
                        </div>
                      ) : filteredGuides.length > 0 ? (
                        <div className="space-y-3 pb-20">
                          {filteredGuides.map((guide: Guide, index: number) => {
                            const isPub = guide.Visibility;
                            const statusColor = isPub ? "var(--status-pub)" : "var(--status-draft)";
                            const poster = guide?.Guide_Media?.[0]?.url;
                            return (
                              <div
                                key={guide.documentId || index}
                                onClick={() => navigate(`/guides/${guide.documentId}`)}
                                className="group relative bg-dashboard-sidebar border border-dashboard rounded-2xl p-4 hover:border-dashboard-accent/50 transition-all duration-300 hover:shadow-dashboard-elevated hover:shadow-dashboard-accent/10 hover:scale-[1.02] cursor-pointer flex items-center gap-4"
                              >
                                <div className="flex-shrink-0">
                                  <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center text-2xl bg-dashboard-muted" style={{ border: `3px solid ${statusColor}` }}>
                                    {poster ? (
                                      <ImageWithFallback src={poster} alt={guide.Title} className="w-full h-full object-cover" />
                                    ) : (
                                      "📖"
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="text-base font-bold text-white truncate">{guide.Title}</h4>
                                    {guide.Number_Of_Days && (
                                      <span className="bg-white/10 text-white/70 text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 font-poppins shrink-0">
                                        {guide.Number_Of_Days} {guide.Number_Of_Days === 1 ? "Day" : "Days"}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-white/45 truncate">
                                    {guide.Guide_Type || "Itinerary"} · <span style={{ color: statusColor }}>{isPub ? "Published" : "Draft"}</span>
                                  </p>
                                </div>
                                <div className="flex-shrink-0">
                                  {isPub ? (
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
                                  backgroundImage={poster || account?.bg_picture?.url || IMAGE_CONFIG.defaultImages.background}
                                  hideQRTab={true}
                                />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-8 pb-20">
                          <svg className="w-16 h-16 mx-auto mb-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <h3 className="text-lg font-semibold text-white mb-1">No matches found</h3>
                          <p className="text-xs text-white/55">Try searching with a different name</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {listNames?.length > 3 && activeTab === "places" && <GlobeDemo arcsData={arcsData} />}
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

              <ShareModal
                shareButtons={shareButtons}
                isOpen={showCategoryShareModal}
                onClose={() => setShowCategoryShareModal(false)}
                url={activeTabShareUrl}
                utmParams={recommendationUtmParams}
                backgroundImage={account?.bg_picture?.url || IMAGE_CONFIG.defaultImages.background}
                hideQRTab={activeTab === "guides"}
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