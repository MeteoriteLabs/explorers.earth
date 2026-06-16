import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Song, PlaylistResponse } from "../../types/music";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import PlaylistCard, { PlaylistCardContent } from "../../components/ui/PlaylistCard";
import { EarthLoader } from "../../components/EarthLoader";
import PlaylistTable from "../../components/playlist-table";
import SearchSongs from "../../components/search-songs";
import { Music2, Volume2, History, Search, Share2, Copy } from "lucide-react";
import { useToast } from "../../hooks/useToast";
import { apiRequest } from "../../lib/queryClient";
import Tabs, { TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useTheme } from "../../components/theme-provider";
import { extractGuestUrlFromLocalTunesLink } from "../../utils/localTunesUtils";
import { useQuery as useApolloQuery, gql } from "@apollo/client";
import { useQuery as useReactQuery } from "@tanstack/react-query";
import { getPublicAccountBasicQuery } from "../../features/PublicHome/api/query";
import { getSongLimits, getUserSubscriptionPlans, getSubscriptionPlanById } from "../../services/subscriptionService";
import SEO from "../../components/SEO";
import { createCanonicalUrl } from "../../utils/getCurrentDomain";
import { useTrackAnalytics, createAnalyticsOptions } from "../../services/analyticsService";
import { motion, PanInfo } from "framer-motion";
import "./PublicMusic.css";

const POLLING_INTERVAL = 1000;


const GET_USER_BY_USERNAME_QUERY = gql`
  query UsersPermissionsUser($filters: UsersPermissionsUserFiltersInput) {
    usersPermissionsUsers(filters: $filters) {
      documentId
      username
    }
  }
`;

export default function PublicMusic() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { updateTheme } = useTheme();
  const [themeUpdated, setThemeUpdated] = useState(false);
  const [guestUrl, setGuestUrl] = useState<string | null>(null);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [accordionsOpen, setAccordionsOpen] = useState({
    queue: true,
    history: false,
    playlists: false,
    device: false
  });

  // First, fetch account data to get Local Tunes link
  const { data: accountData, loading: accountLoading } = useApolloQuery(getPublicAccountBasicQuery, {
    variables: {
      filters: {
        username: { eq: username }
      }
    },
    skip: !username,
    onCompleted: (data) => {
      console.log('Account data received:', data);
      const localTunesPublicLink = data?.accounts?.[0]?.localtunes_public;

      if (localTunesPublicLink) {
        console.log('LocalTunes public link:', localTunesPublicLink);
        const extractedGuestUrl = extractGuestUrlFromLocalTunesLink(localTunesPublicLink);
        console.log('Extracted guestUrl:', extractedGuestUrl);
        if (extractedGuestUrl) {
          setGuestUrl(extractedGuestUrl);
        } else {
          toast("Invalid Local Tunes playlist link for this user", { variant: "destructive" });
        }
      } else {
        toast("No Local Tunes playlist found for this user", { variant: "destructive" });
      }
    },
    onError: (error) => {
      console.error("Error fetching account data:", error);
      toast("Error loading user data", { variant: "destructive" });
    }
  });

  // Fetch user by username to get user documentId
  const { data: userData } = useApolloQuery(GET_USER_BY_USERNAME_QUERY, {
    variables: {
      filters: {
        username: {
          eq: username
        }
      }
    },
    skip: !username,
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all'
  });

  const userDocumentId = userData?.usersPermissionsUsers?.[0]?.documentId;
  // Resolve account documentId for analytics (account != user)
  const accountDocumentId = accountData?.accounts?.[0]?.documentId;

  // Fetch user subscription plans to get plan_id from backend API
  const { data: subscriptionData } = useReactQuery({
    queryKey: ['userSubscriptionPlans', userDocumentId],
    queryFn: () => getUserSubscriptionPlans(userDocumentId!),
    enabled: !!userDocumentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Get latest subscription plan (by start_date)
  const activeSubscription = subscriptionData && subscriptionData.length > 0
    ? [...subscriptionData].sort((a: any, b: any) => {
      const dateA = new Date(a.start_date).getTime();
      const dateB = new Date(b.start_date).getTime();
      return dateB - dateA;
    })[0]
    : null;

  // Fetch subscription plan details to get songs_quota from backend API
  const { data: planDetailsData } = useReactQuery({
    queryKey: ['subscriptionPlan', activeSubscription?.plan_id],
    queryFn: () => getSubscriptionPlanById(activeSubscription!.plan_id),
    enabled: !!activeSubscription?.plan_id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch song limits with refetch capability from backend API
  const { data: songLimitsData, refetch: refetchSongLimits } = useReactQuery({
    queryKey: ['songLimits', username],
    queryFn: () => getSongLimits(username!),
    enabled: !!username,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Calculate if limit is reached - recalculate whenever data changes
  const songRequestsCount = songLimitsData?.[0]?.song_requests || 0;
  const songsQuota = planDetailsData?.songs_quota || 0;
  const isLimitReached = Number(songsQuota) > 0 && Number(songRequestsCount) >= Number(songsQuota);

  // Initialize analytics — auto-tracks the page view once accountId resolves
  const analytics = useTrackAnalytics(
    createAnalyticsOptions.music(accountDocumentId || '', username)
  );

  // Check if there's an active non-expired subscription plan
  const checkActiveSubscription = () => {
    if (!activeSubscription?.end_date) return false;
    const today = new Date();
    const endDate = new Date(activeSubscription.end_date);
    return endDate >= today; // Plan is active if end_date is today or in the future
  };

  const hasActiveNonExpiredPlan = checkActiveSubscription();
  const shouldDisableSearch = !hasActiveNonExpiredPlan || isLimitReached;

  // Query for playlist data (only when we have guestUrl)
  const { data: playlist, isLoading, error } = useQuery<PlaylistResponse>({
    queryKey: [`/api/playlist/${guestUrl}`],
    queryFn: () => apiRequest("GET", `/api/playlist/${guestUrl}`),
    refetchInterval: POLLING_INTERVAL,
    staleTime: 0,
    retry: true,
    retryDelay: 1000,
    enabled: !!guestUrl, // Only run when we have guestUrl
  });

  // Log playlist data when it changes
  useEffect(() => {
    if (playlist) {
      console.log('Guest page received playlist data:', {
        allowPlaylistSharing: playlist?.user?.allowPlaylistSharing,
        playlistsReceived: playlist?.playlists?.length ?? 0,
        visiblePlaylists: playlist?.playlists?.filter((p: any) => p.isVisibleToGuests).length ?? 0
      });
    }
  }, [playlist]);

  // Initial theme setup from playlist data
  useEffect(() => {
    if (playlist?.user?.theme?.primary && updateTheme && !themeUpdated) {
      console.log('Setting initial theme from playlist data:', playlist?.user?.theme?.primary);
      updateTheme(playlist?.user?.theme?.primary);
      setThemeUpdated(true);
    }
  }, [playlist?.user?.theme?.primary, updateTheme, themeUpdated]);

  // Reset active card to the "Now Playing" card (index 0) when the currently playing song changes
  useEffect(() => {
    setActiveHeroIndex(0);
  }, [playlist?.currentlyPlaying?.youtubeId]);

  // Adjust activeHeroIndex in case it goes out of bounds when the queue or currently playing song changes
  useEffect(() => {
    const totalCardsCount = (playlist?.currentlyPlaying ? 1 : 0) + Math.min((playlist?.songs || []).length, 4);
    if (activeHeroIndex >= totalCardsCount && totalCardsCount > 0) {
      setActiveHeroIndex(0);
    }
  }, [playlist?.currentlyPlaying, playlist?.songs, activeHeroIndex]);


  // Handle WebSocket messages
  const handleMessage = (message: { type: string; payload: any }) => {
    console.log('Received WebSocket message:', message);

    if (message.type === 'THEME_UPDATE' && message.payload?.theme?.primary) {
      console.log('Updating theme from WebSocket:', message.payload.theme.primary);

      // Force immediate theme update
      if (updateTheme) {
        updateTheme(message.payload.theme.primary);
      }

      // Update playlist cache with new theme
      queryClient.setQueryData([`/api/playlist/${guestUrl}`], (oldData: PlaylistResponse | undefined) => {
        if (!oldData) return oldData;

        // Create new object to trigger state update
        const newData = {
          ...oldData,
          user: {
            ...oldData.user,
            theme: {
              ...oldData.user?.theme,
              ...message.payload.theme
            }
          }
        };

        return newData;
      });
    }

    // Handle song requests toggle
    if (message.type === 'SONG_REQUESTS_TOGGLE') {
      console.log('Updating song requests setting from WebSocket:', message.payload);
      // Update the local state immediately 
      queryClient.setQueryData([`/api/playlist/${guestUrl}`], (oldData: PlaylistResponse | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          user: {
            ...oldData.user,
            allowSongRequests: message.payload
          }
        };
      });
    }

    // Handle guest play on device toggle
    if (message.type === 'GUEST_PLAY_TOGGLE') {
      console.log('Updating guest play setting from WebSocket:', message.payload);
      // Update the local state immediately
      queryClient.setQueryData([`/api/playlist/${guestUrl}`], (oldData: PlaylistResponse | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          allowGuestPlayOnDevice: message.payload
        };
      });
    }

    // Handle playlist sharing toggle
    if (message.type === 'PLAYLIST_SHARING_TOGGLE') {
      console.log('Updating playlist sharing setting from WebSocket:', message.payload);
      // Update the local state immediately
      queryClient.setQueryData([`/api/playlist/${guestUrl}`], (oldData: PlaylistResponse | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          user: {
            ...oldData.user,
            allowPlaylistSharing: message.payload
          }
        };
      });
    }

    // Handle recently played visibility toggle
    if (message.type === 'RECENTLY_PLAYED_TOGGLE') {
      console.log('Updating recently played visibility setting from WebSocket:', message.payload);
      // Update the local state immediately
      queryClient.setQueryData([`/api/playlist/${guestUrl}`], (oldData: PlaylistResponse | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          user: {
            ...oldData.user,
            allowRecentlyPlayedVisibility: message.payload.enabled
          },
          allowRecentlyPlayedVisibility: message.payload.enabled
        };
      });
    }

    // For general playlist updates, refresh the data
    if (message.type === 'PLAYLIST_UPDATE') {
      console.log('Refreshing playlist data from WebSocket');
      queryClient.invalidateQueries({ queryKey: [`/api/playlist/${guestUrl}`] });
    }
  };

  // Initialize WebSocket
  useWebSocket(guestUrl || '', handleMessage, {
    enabled: true,
    showConnectionToasts: false
  });

  // Add new mutation for adding songs to queue
  const addSongToQueueMutation = useMutation({
    mutationFn: async (song: Song) => {
      const params = new URLSearchParams();
      if (guestUrl) {
        params.append('guestUrl', guestUrl);
      }
      return apiRequest("POST", `/api/playlist/songs?${params}`, {
        youtubeId: song.youtubeId,
        title: song.title,
        artist: song.artist,
        thumbnailUrl: song.thumbnailUrl,
      });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: [`/api/playlist/${guestUrl}`] });
      toast("Song added to playlist");
      // Refetch song limits after adding song
      await refetchSongLimits();
    },
    onError: (error) => {
      console.error('Error adding song to queue:', error);
      toast("Failed to add song to playlist", { variant: "destructive" });
    },
  });

  // Add handler for adding song to queue
  const handleAddToQueue = async (song: Song) => {
    // Check limit before adding
    if (isLimitReached) {
      toast("Song request limit has been reached. Cannot add more songs.", { variant: "destructive" });
      return;
    }

    try {
      await addSongToQueueMutation.mutateAsync(song);
      // Track successful song request — key engagement metric
      analytics.trackClick('song-request', {
        title: song.title,
        artist: song.artist,
        youtubeId: song.youtubeId,
      });
      // Refetch song limits after adding song
      await refetchSongLimits();
    } catch (error) {
      console.error('Error in handleAddToQueue:', error);
    }
  };


  const handleShare = async () => {
    console.log('Share button clicked, username:', username);
    if (!username) {
      console.error('No username available');
      toast("Could not share the music page - missing username", { variant: "destructive" });
      return;
    }

    const shareUrl = `${window.location.origin}/${username}/music`;
    console.log('Attempting to share URL:', shareUrl);

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${playlist?.user?.venueName || username}'s Music Page`,
          text: "Check out this music page and request songs!",
          url: shareUrl,
        });
        console.log('Share successful');
      } catch (error) {
        console.error('Share failed:', error);
        if ((error as Error).name !== 'AbortError') {
          toast("Could not share the music page", { variant: "destructive" });
        }
      }
    } else {
      console.log('Share API not available, falling back to copy');
      handleCopyLink();
    }
    analytics.trackClick('share-button', { context: 'music-header' });
  };

  const handleCopyLink = async () => {
    console.log('Copy button clicked, username:', username);
    if (!username) {
      console.error('No username available');
      toast("Could not copy the music page link - missing username", { variant: "destructive" });
      return;
    }

    const shareUrl = `${window.location.origin}/${username}/music`;
    console.log('Attempting to copy URL:', shareUrl);

    try {
      await navigator.clipboard.writeText(shareUrl);
      console.log('Copy successful');
      toast("Music page link copied to clipboard");
      analytics.trackClick('copy-link', { context: 'music-header' });
    } catch (error) {
      console.error('Copy failed:', error);
      toast("Could not copy the music page link", { variant: "destructive" });
    }
  };


  const queueSongs = playlist?.songs || [];

  // Show loader during the full chain:
  // 1. Account data is still fetching
  // 2. Account loaded but onCompleted hasn't set guestUrl yet (brief async gap)
  // 3. guestUrl is set and playlist is being fetched
  const isPageLoading = accountLoading || (!accountLoading && !guestUrl && !error) || isLoading;

  if (isPageLoading) {
    return (
      <div className="bg-black min-h-screen">
        <EarthLoader context="profile" />
      </div>
    );
  }

  if (error || !playlist || !guestUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <PlaylistCard className="w-full max-w-md mx-4 border-none bg-black text-white">
          <PlaylistCardContent className="pt-6">
            <h1 className="text-2xl font-bold text-red-400 mb-2">
              Playlist Not Found
            </h1>
            <p className="text-gray-300">
              {!guestUrl
                ? "This user doesn't have a Local Tunes playlist configured."
                : "The playlist you're looking for doesn't exist or has been removed."
              }
            </p>
          </PlaylistCardContent>
        </PlaylistCard>
      </div>
    );
  }

  // SEO data - use account name to match other public pages
  const accountName = accountData?.accounts?.[0]?.Account_Name || playlist?.user?.venueName || username || "User";
  const visiblePlaylistsCount = playlist?.playlists?.filter((p: any) => p.isVisibleToGuests).length || 0;
  const totalSongs = playlist?.playlists?.reduce((sum: number, p: any) => sum + (p.songs?.length || 0), 0) || 0;

  // Build the list of hero cards (Now Playing + next 4 queue items)
  const heroCards = [];
  if (playlist?.currentlyPlaying) {
    heroCards.push({
      type: 'now-playing',
      title: playlist.currentlyPlaying.title,
      artist: playlist.currentlyPlaying.artist,
      thumbnailUrl: playlist.currentlyPlaying.thumbnailUrl,
      badge: 'Now Playing',
    });
  }

  const nextQueueItems = queueSongs.slice(0, 4);
  nextQueueItems.forEach((song, idx) => {
    heroCards.push({
      type: 'queue',
      title: song.title,
      artist: song.artist,
      thumbnailUrl: song.thumbnailUrl,
      badge: idx === 0 ? 'Up Next' : `#${idx + 1} in Queue`,
    });
  });

  const totalCards = heroCards.length;
  const activeCard = heroCards[activeHeroIndex] || heroCards[0];


  const desktopQueueSlots = [
    { label: 'Up Next', song: queueSongs?.[0] },
    { label: '#2', song: queueSongs?.[1] },
    { label: '#3', song: queueSongs?.[2] },
    { label: '#4', song: queueSongs?.[3] }
  ];

  return (
    <>
      <SEO
        title={`${accountName} | Local Music & Playlists | explorers`}
        description={`Discover ${accountName}'s local music collection and playlists on explorers. ${visiblePlaylistsCount > 0 ? `Explore ${visiblePlaylistsCount} playlist${visiblePlaylistsCount > 1 ? 's' : ''} with ${totalSongs} song${totalSongs > 1 ? 's' : ''} featuring city-based music, cultural sounds, and local tunes. ` : 'Experience curated music playlists featuring local sounds and cultural music discovery.'} Connect with regional music, explore city soundtracks, and discover authentic local music experiences.`}
        keywords={[
          `${accountName} music`,
          `${accountName} playlists`,
          "local music",
          "city-based music",
          "cultural music",
          "local sounds",
          "music playlists",
          "regional music",
          "city soundtracks",
          "cultural soundtracks",
          "local music discovery",
          "music exploration",
          "explorers music",
          "public music playlists",
          "local tunes",
          "cultural music discovery",
          "music sharing",
          "playlist discovery"
        ]}
        canonical={createCanonicalUrl(`/${username}/music`)}
        type="website"
        noIndex={false}
        siteName="explorers"
        author={accountName}
      />
      <div className="h-full bg-black min-h-screen overflow-auto preview-scroll pb-20">
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
                onClick={handleShare}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center"
                title="Share"
                aria-label="Share"
              >
                <Share2 className="h-4 w-4" style={{ color: 'white' }} />
              </button>
              <button
                onClick={handleCopyLink}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center"
                title="Copy Link"
                aria-label="Copy Link"
              >
                <Copy className="h-4 w-4" style={{ color: 'white' }} />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto pt-20 pb-28 px-4 md:px-6">
          <div className="page-content">
            {/* Search Songs Section - Only show if song requests are allowed */}
            {playlist?.user?.allowSongRequests && (
              <div className="search-panel">
                <div className="search-panel-label">
                  <Search className="h-3.5 w-3.5" style={{ color: 'var(--primary)' }} />
                  Add a Song to the Queue
                </div>
                <SearchSongs
                  guestUrl={guestUrl}
                  disabled={shouldDisableSearch}
                  onSongsAddedCallback={async () => {
                    await refetchSongLimits();
                  }}
                />
                <div className="search-limit">
                  <span className="live-dot"></span>
                  {isLimitReached ? (
                    "Song requests limit reached"
                  ) : (
                    `Song requests open · ${songRequestsCount} of ${songsQuota} used`
                  )}
                </div>
              </div>
            )}

            {/* Now Playing Section */}
            <div>
              <div className="now-playing-label">
                <span className={`live-dot ${playlist?.currentlyPlaying ? '' : 'bg-gray-600 shadow-none animate-none'}`}></span>
                Now Playing
              </div>

              {playlist?.currentlyPlaying ? (
                <>
                  {/* MOBILE VIEW (stacked swiper) */}
                  <div className="hero-mobile">
                    <div className="relative w-full h-[65vh] min-h-[480px] max-h-[650px] overflow-x-hidden flex items-center justify-start py-8">
                      <div className="absolute inset-y-4 left-0 right-8">
                        {heroCards.map((card, i) => {
                          const diff = (i - activeHeroIndex + totalCards) % totalCards;

                          let position = "hiddenRight";
                          if (diff === 0) position = "active";
                          else if (diff === 1) position = "next";
                          else if (diff === 2) position = "nextNext";
                          else if (diff === totalCards - 1) position = "hiddenLeft";

                          const variants = {
                            active: { x: 0, scale: 1, zIndex: 10, opacity: 1 },
                            next: { x: "12%", scale: 0.9, zIndex: 5, opacity: 1 },
                            nextNext: { x: "24%", scale: 0.8, zIndex: 4, opacity: 1 },
                            hiddenRight: { x: "40%", scale: 0.7, zIndex: 1, opacity: 0 },
                            hiddenLeft: { x: "-110%", scale: 1, zIndex: 11, opacity: 0 }
                          };

                          const handleDragEnd = (_e: any, { offset, velocity }: PanInfo) => {
                            if (offset.x < -50 || velocity.x < -300) {
                              setActiveHeroIndex((prev) => (prev + 1) % totalCards);
                            } else if (offset.x > 50 || velocity.x > 300) {
                              setActiveHeroIndex((prev) => (prev - 1 + totalCards) % totalCards);
                            }
                          };

                          const hasThumbnail = !!card.thumbnailUrl;

                          return (
                            <motion.div
                              key={i}
                              variants={variants}
                              initial={false}
                              animate={position}
                              transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                              drag={diff === 0 ? "x" : false}
                              dragConstraints={{ left: 0, right: 0 }}
                              dragElastic={0.8}
                              onDragEnd={handleDragEnd}
                              className={`absolute inset-0 h-full rounded-2xl overflow-hidden shadow-2xl bg-[#1a2332] border border-white/10 ${
                                diff === 0 ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'
                              }`}
                              style={{
                                backgroundImage: hasThumbnail ? `url('${card.thumbnailUrl}')` : 'none',
                                backgroundColor: hasThumbnail ? 'transparent' : '#111',
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                              }}
                            >
                              {/* Shading overlay */}
                              <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/90 z-10 pointer-events-none" />

                              {/* Top left status/action badge */}
                              <div className="relative z-20 flex justify-between items-start p-5 w-full">
                                <div className="px-2.5 py-0.5 rounded-full bg-[#0f1624]/65 backdrop-blur-[3px] border border-white/20 flex items-center justify-center text-[10px] text-white font-bold tracking-wide uppercase font-poppins">
                                  {card.type === 'now-playing' ? (
                                    <svg className="mr-1 h-2.5 w-2.5 inline animate-pulse text-[var(--primary)]" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                                    </svg>
                                  ) : null}
                                  {card.badge}
                                </div>
                              </div>

                              {/* Bottom song info or placeholder */}
                              <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col gap-1.5 pointer-events-none z-20">
                                <h2 className="text-3xl font-poppins font-black text-white leading-tight drop-shadow-xl select-none truncate">
                                  {card.title}
                                </h2>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--primary)] font-semibold tracking-wide mt-1">
                                  <span>{card.artist}</span>
                                </div>
                                {card.type === 'now-playing' && (
                                  <div className="eq-bars mt-2">
                                    <div className="eq-bar"></div>
                                    <div className="eq-bar"></div>
                                    <div className="eq-bar"></div>
                                    <div className="eq-bar"></div>
                                    <div className="eq-bar"></div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                    {totalCards > 1 && (
                      <div className="mobile-swipe-dots" style={{ marginTop: '0.1rem' }}>
                        {heroCards.map((_, i) => (
                          <div
                            key={i}
                            className={`swipe-dot ${i === activeHeroIndex ? 'active' : ''}`}
                            onClick={() => setActiveHeroIndex(i)}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* DESKTOP VIEW (banner + strip) */}
                  <div className="hero-desktop">
                    <div
                      className="desktop-np-card place-rec-card relative w-full h-[400px] rounded-[16px] overflow-hidden flex flex-col justify-between p-6 border border-white/[0.08] shadow-[0_6px_16px_rgba(0,0,0,0.35)] transition-all duration-300 hover:border-white/25 select-none"
                      style={{
                        backgroundImage: `url('${activeCard?.thumbnailUrl || ''}')`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                      onClick={() => setActiveHeroIndex(0)}
                    >
                      {/* Shading overlay */}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/85 z-10 pointer-events-none" />

                      {/* Top left badge */}
                      <div className="relative z-20 flex justify-between items-center w-full">
                        <div className="px-3 py-1 rounded-full bg-[#0f1624]/65 backdrop-blur-[3px] border border-white/20 flex items-center justify-center text-[11px] text-white font-semibold tracking-wide uppercase font-poppins">
                          {activeCard?.type === 'now-playing' ? (
                            <svg className="mr-1.5 h-3 w-3 inline animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                            </svg>
                          ) : null}
                          {activeCard?.badge}
                        </div>
                      </div>

                      {/* Bottom row containing song content & desktop queue cards */}
                      <div className="relative z-20 flex justify-between items-end w-full">
                        <div className="flex flex-col gap-0.5 max-w-[50%]">
                          <h4 className="text-xl md:text-2xl font-bold text-white tracking-wide truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] font-poppins">
                            {activeCard?.title}
                          </h4>
                          <p className="text-sm font-semibold text-[var(--primary)] font-poppins truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                            {activeCard?.artist}
                          </p>
                          {activeCard?.type === 'now-playing' && (
                            <div className="eq-bars mt-2">
                              <div className="eq-bar"></div>
                              <div className="eq-bar"></div>
                              <div className="eq-bar"></div>
                              <div className="eq-bar"></div>
                              <div className="eq-bar"></div>
                            </div>
                          )}
                        </div>

                        {/* Desktop Queue Cards (w-32 aspect-video rounded-md) */}
                        <div className="desktop-queue-strip flex gap-3.5 z-20">
                          {desktopQueueSlots.map((slot, idx) => {
                            const song = slot.song;
                            const hasSong = !!song;
                            const bgImage = song?.thumbnailUrl || '';
                            const isSelected = activeHeroIndex === idx + 1;
                            return (
                              <div
                                className="queue-thumb-wrapper relative w-32 aspect-video flex-shrink-0"
                                key={idx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (hasSong) {
                                    setActiveHeroIndex(idx + 1);
                                  }
                                }}
                              >
                                <span className="queue-thumb-label absolute font-semibold text-[10px] text-white bg-black/60 px-1.5 py-0.5 rounded top-1.5 left-1.5 z-10">
                                  {slot.label}
                                </span>
                                <button
                                  className={`relative w-full h-full rounded-md overflow-hidden transition-all duration-300 border cursor-pointer ${
                                    hasSong
                                      ? (isSelected
                                        ? 'border-white ring-2 ring-white scale-110 shadow-2xl z-10'
                                        : 'border-white/10 opacity-70 hover:opacity-100 hover:scale-105')
                                      : 'border-white/5 opacity-30 cursor-default'
                                  }`}
                                >
                                  {hasSong ? (
                                    <>
                                      <img
                                        src={bgImage}
                                        alt={song.title}
                                        className="w-full h-full object-cover"
                                      />
                                      <div className="absolute inset-0 bg-black/20" />
                                    </>
                                  ) : (
                                    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                                      <Music2 className="h-5 w-5 text-gray-600" />
                                    </div>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* No Song Playing State */
                <div className="desktop-np-card" style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="empty-state">
                    <div className="empty-state__icon">
                      <Music2 className="h-6 w-6 text-gray-500" />
                    </div>
                    <div className="empty-state__title" style={{ fontSize: '0.85rem', color: 'white', fontWeight: 600 }}>No song playing</div>
                    <div className="empty-state__desc" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Music will appear here when the host starts playing</div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion Group */}
            <div className="accordion-group">
              {/* A. Queue Accordion */}
              <div className="accordion">
                <button
                  className="accordion-trigger"
                  onClick={() => setAccordionsOpen(prev => ({ ...prev, queue: !prev.queue }))}
                >
                  <div className="acc-left">
                    <div className="acc-icon">
                      <Music2 className="h-4 w-4" />
                    </div>
                    Queue
                    <span className="acc-count">{(playlist?.songs || []).length} songs</span>
                  </div>
                  <svg className={`acc-chevron ${accordionsOpen.queue ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {accordionsOpen.queue && (
                  <div className="accordion-content">
                    <PlaylistTable
                      songs={playlist?.songs || []}
                      showControls={false}
                      currentPlayingSong={playlist?.currentlyPlaying}
                      guestUrl={guestUrl}
                    />
                  </div>
                )}
              </div>

              {/* B. Recently Played Accordion */}
              {playlist?.user?.allowRecentlyPlayedVisibility !== false && (
                <div className="accordion">
                  <button
                    className="accordion-trigger"
                    onClick={() => setAccordionsOpen(prev => ({ ...prev, history: !prev.history }))}
                  >
                    <div className="acc-left">
                      <div className="acc-icon">
                        <History className="h-4 w-4" />
                      </div>
                      Recently Played
                      <span className="acc-count">{(playlist?.playedSongs || []).length} songs</span>
                    </div>
                    <svg className={`acc-chevron ${accordionsOpen.history ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {accordionsOpen.history && (
                    <div className="accordion-content">
                      {(playlist?.playedSongs?.length ?? 0) > 0 ? (
                        <PlaylistTable
                          songs={playlist?.playedSongs ?? []}
                          showControls={false}
                          showAddToQueue={true}
                          isHistory={true}
                          currentPlayingSong={playlist?.currentlyPlaying}
                          guestUrl={guestUrl}
                          onAddToQueue={handleAddToQueue}
                        />
                      ) : (
                        <p className="text-sm text-gray-300">No songs have been played yet</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* C. Playlists Accordion */}
              {playlist?.user?.allowPlaylistSharing && playlist?.playlists && playlist?.playlists.length > 0 && (
                <div className="accordion">
                  <button
                    className="accordion-trigger"
                    onClick={() => setAccordionsOpen(prev => ({ ...prev, playlists: !prev.playlists }))}
                  >
                    <div className="acc-left">
                      <div className="acc-icon">
                        <Music2 className="h-4 w-4" />
                      </div>
                      Playlists
                      <span className="acc-count">{playlist.playlists.filter(p => p.isVisibleToGuests).length} playlists</span>
                    </div>
                    <svg className={`acc-chevron ${accordionsOpen.playlists ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {accordionsOpen.playlists && (
                    <div className="accordion-content">
                      {playlist?.playlists?.some(p => p.isVisibleToGuests) ? (
                        <Tabs defaultValue={playlist?.playlists?.find(p => p.isVisibleToGuests)?.id.toString()}>
                          <TabsList className="mb-4">
                            {playlist?.playlists
                              ?.filter((p: any) => p.isVisibleToGuests)
                              ?.map((p: any) => (
                                <TabsTrigger key={p.id} value={p.id.toString()}>
                                  {p.name}
                                </TabsTrigger>
                              ))}
                          </TabsList>

                          {playlist?.playlists
                            .filter((p: any) => p.isVisibleToGuests)
                            .map((p: any) => (
                              <TabsContent key={p.id} value={p.id.toString()}>
                                <div className="space-y-4">
                                  {p.description && (
                                    <p className="text-sm text-gray-300">{p.description}</p>
                                  )}
                                  <div className="flex justify-between items-center">
                                    <div className="text-sm text-gray-300">
                                      {p.songs.length} songs
                                    </div>
                                  </div>
                                  {p.songs.length > 0 ? (
                                    <PlaylistTable
                                      songs={p.songs}
                                      showControls={true}
                                      currentPlayingSong={playlist?.currentlyPlaying}
                                      onAddToQueue={handleAddToQueue}
                                      showAddToQueue={true}
                                      guestUrl={guestUrl}
                                      showReorderControls={false}
                                      isPlaylist={true}
                                    />
                                  ) : (
                                    <p className="text-center py-8 text-gray-300">
                                      This playlist is empty
                                    </p>
                                  )}
                                </div>
                              </TabsContent>
                            ))}
                        </Tabs>
                      ) : (
                        <p className="text-center py-8 text-gray-300">
                          No playlists are currently shared
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* D. Play on Device Accordion */}
              {playlist?.allowGuestPlayOnDevice && (
                <div className="accordion">
                  <button
                    className="accordion-trigger"
                    onClick={() => setAccordionsOpen(prev => ({ ...prev, device: !prev.device }))}
                  >
                    <div className="acc-left">
                      <div className="acc-icon">
                        <Volume2 className="h-4 w-4" />
                      </div>
                      Play on Your Device
                    </div>
                    <svg className={`acc-chevron ${accordionsOpen.device ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {accordionsOpen.device && (
                    <div className="accordion-content">
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '0.75rem' }}>
                        The host has allowed playback on guest devices. You can listen to the current song right here.
                      </p>
                      <div className="relative w-full aspect-video mb-4">
                        {playlist?.currentlyPlaying?.youtubeId ? (
                          <iframe
                            src={`https://www.youtube.com/embed/${playlist.currentlyPlaying.youtubeId}?autoplay=1&controls=1&modestbranding=1&rel=0`}
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title={playlist.currentlyPlaying.title}
                          />
                        ) : (
                          <div className="yt-placeholder">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
                            </svg>
                            No Song Playing, Stay Tuned
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}