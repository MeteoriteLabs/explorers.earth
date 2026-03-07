import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Song, PlaylistResponse } from "../../types/music";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import PlaylistCard, { PlaylistCardContent, PlaylistCardHeader, PlaylistCardTitle, PlaylistCardDescription } from "../../components/ui/PlaylistCard";
import { EarthLoader } from "../../components/EarthLoader";
import PlaylistTable from "../../components/playlist-table";
import SearchSongs from "../../components/search-songs";
import { Music2, Volume2, History, Search, Share2, Copy, AlertCircle } from "lucide-react";
import { useToast } from "../../hooks/useToast";
import { apiRequest } from "../../lib/queryClient";
import Accordion, { AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
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
  const [accordionValue, setAccordionValue] = useState<string>("");
  const [guestUrl, setGuestUrl] = useState<string | null>(null);

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
    } catch (error) {
      console.error('Copy failed:', error);
      toast("Could not copy the music page link", { variant: "destructive" });
    }
  };


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
                aria-label="Share"
              >
                <Share2 className="h-4 w-4" style={{ color: 'white' }} />
              </button>
              <button
                onClick={handleCopyLink}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center"
                aria-label="Copy Link"
              >
                <Copy className="h-4 w-4" style={{ color: 'white' }} />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto py-8 space-y-8 pt-20 pb-28 px-6">
          {/* Now Playing Section - Enhanced UI */}
          <PlaylistCard className="border border-gray-700 bg-black text-white rounded-lg shadow-lg overflow-hidden">
            <PlaylistCardHeader className="px-6 py-4 bg-gradient-to-r from-blue-500/20 to-blue-600/30">
              <div className="flex items-center">
                <div className="bg-primary/20 p-2 rounded-full mr-3">
                  <Music2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-left text-blue-500">Now Playing</h3>
                </div>
              </div>
            </PlaylistCardHeader>
            <PlaylistCardContent className="px-0 pt-0 pb-0">
              <div className="relative w-full">
                {playlist?.currentlyPlaying && (
                  <div className="w-full flex flex-col items-center bg-black pb-6">
                    <div className="w-full max-w-xs p-6">
                      <div className="aspect-square relative rounded-lg overflow-hidden shadow-lg border-4 border-primary/10 mx-auto">
                        <img
                          src={playlist?.currentlyPlaying?.thumbnailUrl}
                          alt={playlist?.currentlyPlaying?.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                          <div className="p-3 bg-primary rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" fill="white"></polygon></svg>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="w-full text-center px-6">
                      <div className="space-y-4">
                        <div>
                          <div className="overflow-hidden w-full">
                            <h3 className="font-bold text-xl md:text-2xl leading-tight text-white whitespace-nowrap animate-scroll">
                              {playlist?.currentlyPlaying?.title}
                            </h3>
                          </div>
                          <p className="text-blue-500 font-medium mt-2">{playlist?.currentlyPlaying?.artist}</p>
                        </div>

                        <div className="flex items-center justify-center space-x-2">
                          {!playlist.allowGuestPlayOnDevice && (
                            <span className="inline-flex items-center bg-secondary text-muted-foreground text-xs px-2.5 py-1 rounded-full">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                              Host-Only Playback
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {!playlist.currentlyPlaying && (
                  <div className="w-full flex flex-col items-center justify-center bg-black rounded-lg">
                    <div className="text-center p-8">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-700 flex items-center justify-center">
                        <Music2 className="h-8 w-8 text-gray-300" />
                      </div>
                      <h3 className="font-semibold text-xl text-white">No song playing</h3>
                      <p className="mt-3 text-gray-300 text-sm max-w-md mx-auto">
                        The host hasn't started any music yet. When a song starts playing, it will appear here.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </PlaylistCardContent>
          </PlaylistCard>

          {/* Search Songs Section - Only show if song requests are allowed */}
          {playlist?.user?.allowSongRequests && (
            <Accordion
              type="single"
              collapsible
              value={accordionValue}
              onValueChange={setAccordionValue}
            >
              <AccordionItem value="search">
                <AccordionTrigger value="search" disabled={shouldDisableSearch}>
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4" style={{ color: shouldDisableSearch ? '#ef4444' : '#d1d5db' }} />
                    Search
                    {shouldDisableSearch && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded">
                        {!hasActiveNonExpiredPlan ? 'No Active Plan' : 'Limit Reached'}
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent value="search">
                  <PlaylistCard className="mt-4 border-none bg-black text-white">
                    <PlaylistCardHeader>
                      <PlaylistCardTitle className="text-white">Request a Song</PlaylistCardTitle>
                      <PlaylistCardDescription className="text-gray-300">
                        {!hasActiveNonExpiredPlan
                          ? "No active subscription plan available"
                          : isLimitReached
                            ? `Song request limit reached (${songRequestsCount}/${songsQuota})`
                            : "Search and add songs to the playlist"
                        }
                      </PlaylistCardDescription>
                    </PlaylistCardHeader>
                    <PlaylistCardContent>
                      {/* Show warning message but still allow YouTube URL feature */}
                      {!hasActiveNonExpiredPlan && (
                        <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-red-400 font-semibold mb-1">No Active Subscription Plan</h4>
                              <p className="text-gray-300 text-sm">
                                Search functionality is disabled because there's no active subscription plan.
                                However, you can still add songs using YouTube URLs (free and unlimited).
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      {isLimitReached && hasActiveNonExpiredPlan && (
                        <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg mb-4">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-red-400 font-semibold mb-1">Song Request Limit Reached</h4>
                              <p className="text-gray-300 text-sm">
                                You have reached your song request limit of {songsQuota} songs.
                                However, you can still add songs using YouTube URLs (free and unlimited).
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Always render SearchSongs - it handles its own disabled state for search, but YouTube URL is always enabled */}
                      <SearchSongs
                        guestUrl={guestUrl}
                        disabled={shouldDisableSearch}
                        onSongsAddedCallback={async () => {
                          // Refetch song limits after songs are added
                          await refetchSongLimits();
                          // Close the accordion after songs are added
                          setAccordionValue("");
                        }}
                      />
                    </PlaylistCardContent>
                  </PlaylistCard>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* Queue Section */}
          <Accordion
            type="single"
            collapsible
            value={accordionValue}
            onValueChange={setAccordionValue}
          >
            <AccordionItem value="queue">
              <AccordionTrigger value="queue">
                <div className="flex items-center gap-2">
                  <Music2 className="h-4 w-4" style={{ color: '#d1d5db' }} />
                  Queue
                </div>
              </AccordionTrigger>
              <AccordionContent value="queue">
                <PlaylistCard className="mt-4 border-none bg-black text-white">
                  <PlaylistCardHeader>
                    <PlaylistCardTitle className="text-white">Queue</PlaylistCardTitle>
                    <PlaylistCardDescription className="text-gray-300">Songs in the queue</PlaylistCardDescription>
                  </PlaylistCardHeader>
                  <PlaylistCardContent>
                    <PlaylistTable
                      songs={playlist?.songs || []}
                      showControls={false}
                      currentPlayingSong={playlist?.currentlyPlaying}
                      guestUrl={guestUrl}
                    />
                  </PlaylistCardContent>
                </PlaylistCard>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* History Section */}
          {/* Only show Recently Played section if allowRecentlyPlayedVisibility is true */}
          {(playlist?.user?.allowRecentlyPlayedVisibility !== false) && (
            <Accordion
              type="single"
              collapsible
              value={accordionValue}
              onValueChange={setAccordionValue}
            >
              <AccordionItem value="history">
                <AccordionTrigger value="history">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4" style={{ color: '#d1d5db' }} />
                    Recently Played
                  </div>
                </AccordionTrigger>
                <AccordionContent value="history">
                  <PlaylistCard className="mt-4 border-none bg-black text-white">
                    <PlaylistCardHeader>
                      <PlaylistCardTitle className="text-white">Recently Played</PlaylistCardTitle>
                      <PlaylistCardDescription className="text-gray-300">Songs that have been played</PlaylistCardDescription>
                    </PlaylistCardHeader>
                    <PlaylistCardContent>
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
                    </PlaylistCardContent>
                  </PlaylistCard>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* Add Saved Playlists Section */}
          {playlist?.user?.allowPlaylistSharing && playlist?.playlists && playlist?.playlists.length > 0 && (
            <Accordion
              type="single"
              collapsible
              value={accordionValue}
              onValueChange={setAccordionValue}
            >
              <AccordionItem value="playlists">
                <AccordionTrigger value="playlists">
                  <div className="flex items-center gap-2">
                    <Music2 className="h-4 w-4" style={{ color: '#d1d5db' }} />
                    Playlists
                  </div>
                </AccordionTrigger>
                <AccordionContent value="playlists">
                  <PlaylistCard className="mt-4 border-none bg-black text-white">
                    <PlaylistCardHeader>
                      <PlaylistCardTitle className="text-white">Saved Playlists</PlaylistCardTitle>
                      <PlaylistCardDescription className="text-gray-300">Browse {playlist?.user?.venueName}'s playlists</PlaylistCardDescription>
                    </PlaylistCardHeader>
                    <PlaylistCardContent>
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
                                      showReorderControls={false} // Hide reorder controls in the guest view
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
                    </PlaylistCardContent>
                  </PlaylistCard>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* Play on Device Section - Only visible to guests if allowed */}
          {playlist?.allowGuestPlayOnDevice && (
            <Accordion
              type="single"
              collapsible
              value={accordionValue}
              onValueChange={setAccordionValue}
            >
              <AccordionItem value="play-device">
                <AccordionTrigger value="play-device">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4" style={{ color: '#d1d5db' }} />
                    Play on Your Device
                  </div>
                </AccordionTrigger>
                <AccordionContent value="play-device">
                  <PlaylistCard className="mt-4 border-none bg-black text-white">
                    <PlaylistCardHeader>
                      <PlaylistCardTitle className="text-white">Play on Your Device</PlaylistCardTitle>
                      <PlaylistCardDescription className="text-gray-300">Control playback on your device</PlaylistCardDescription>
                    </PlaylistCardHeader>
                    <PlaylistCardContent>
                      <div className="flex flex-col gap-3">
                        <p className="text-sm text-gray-300">
                          The host has allowed playback on guest devices. You can control the music from here.
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
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                              <div className="text-center text-gray-400">
                                <Music2 className="h-12 w-12 mx-auto mb-2" />
                                <p>No Song Playing, Stay Tuned</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </PlaylistCardContent>
                  </PlaylistCard>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      </div>
    </>
  );
}