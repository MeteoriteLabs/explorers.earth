import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Check, ExternalLink, AlertCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { InsertSong } from "@shared/schema";
import { MusicLoader } from "@/components/ui/music-loader";
import { useToast } from "@/hooks/use-toast";
import ImportPlaylistModal from "@/components/import-playlist-modal";
import { useUserSubscriptionPlanInfo } from "@/lib/strapi-queries";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const RESULTS_PER_PAGE = 20;

/**
 * Checks if a string is a YouTube URL
 * Supports various YouTube URL formats and bare video IDs
 */
function isYouTubeUrl(str: string): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }

  const trimmed = str.trim();

  // Check for YouTube domain patterns
  const youtubePatterns = [
    /^https?:\/\/(?:www\.)?(?:youtu\.be|youtube\.com|m\.youtube\.com)/,
    /^youtu\.be\//,
    /^youtube\.com\//,
    /^m\.youtube\.com\//,
  ];

  // Check if it matches any YouTube URL pattern
  for (const pattern of youtubePatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  // Also check if it's a bare video ID (11 alphanumeric characters)
  const bareIdPattern = /^[a-zA-Z0-9_-]{11}$/;
  if (bareIdPattern.test(trimmed)) {
    return true;
  }

  return false;
}

type SearchResult = {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      default: { url: string };
    };
  };
  searchIndex?: number; // Add index for unique key generation
};

type Props = {
  guestUrl?: string;
  playlistId?: number;
  ownerUsername?: string; // Username of the playlist owner (for guest access)
};

export default function SearchSongs({ guestUrl, playlistId, ownerUsername }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Determine which username to use for subscription check
  // For guest access, use ownerUsername; otherwise use current user's username
  const usernameForCheck = ownerUsername || user?.username;

  // Check subscription plan info
  const { songRequests, songsQuota, isLoading: isLoadingSubscription, isActivePlan } = useUserSubscriptionPlanInfo(
    usernameForCheck || undefined
  );

  // Check if song request limit is reached
  const isLimitReached = songsQuota > 0 && songRequests >= songsQuota;

  // Check if plan is expired or doesn't exist
  const isPlanExpired = !isLoadingSubscription && !isActivePlan;
  const [query, setQuery] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingFromUrl, setIsAddingFromUrl] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchId, setSearchId] = useState(Date.now()); // Add unique search ID
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  const addSongMutation = useMutation({
    mutationFn: async (songData: { youtubeId: string; title: string; artist: string; thumbnailUrl: string }) => {
      // For saved playlists
      if (playlistId) {
        const url = `/api/playlists/${playlistId}/songs${user?.username ? `?username=${user.username}` : ''}`;
        return apiRequest("POST", url, {
          songs: [{
            youtubeId: songData.youtubeId,
            title: songData.title,
            artist: songData.artist,
            thumbnailUrl: songData.thumbnailUrl
          }]
        });
      }

      // For main playlist (including guest access)
      const url = guestUrl
        ? `/api/playlist/songs?guestUrl=${encodeURIComponent(guestUrl)}`
        : user?.username
          ? `/api/playlist/songs?username=${user.username}`
          : '/api/playlist/songs';
      return apiRequest("POST", url, songData);
    },
    onSuccess: () => {
      // Invalidate the appropriate queries based on context
      if (playlistId) {
        queryClient.invalidateQueries({ queryKey: ["/api/playlists", user?.id] });
      } else if (guestUrl || user?.guestUrl) {
        const playlistUrl = guestUrl || user?.guestUrl;
        queryClient.invalidateQueries({ queryKey: [`/api/playlist/${playlistUrl}`] });
      }

      toast({
        title: "Success",
        description: playlistId
          ? "Song added to playlist successfully"
          : "Song added to queue successfully",
      });
    },
    onError: (error) => {
      console.error('Failed to add song:', error);
      toast({
        title: "Failed to add song",
        description: error instanceof Error ? error.message : "Could not add song",
        variant: "destructive",
      });
    },
  });

  const fetchResults = async (searchQuery: string, pageToken?: string) => {
    if (!searchQuery.trim()) return;

    try {
      const response = await fetch('/api/youtube/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          query: searchQuery,
          pageToken,
          username: usernameForCheck
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        items: data.items || [],
        nextPageToken: data.nextPageToken || null
      };
    } catch (error) {
      console.error("Failed to search:", error);
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "Could not search for songs",
        variant: "destructive",
      });
      return null;
    }
  };

  const fetchVideoFromUrl = async (url: string): Promise<SearchResult | null> => {
    console.log('🔵 [Frontend] Starting fetchVideoFromUrl with URL:', url);
    try {
      const requestUrl = '/api/youtube/video-from-url';
      const requestBody = { url };
      console.log('🔵 [Frontend] Making request to:', requestUrl);
      console.log('🔵 [Frontend] Request body:', requestBody);

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      console.log('🔵 [Frontend] Response status:', response.status);
      console.log('🔵 [Frontend] Response statusText:', response.statusText);
      console.log('🔵 [Frontend] Response headers:', Object.fromEntries(response.headers.entries()));

      // Check if response is HTML (route not found)
      const contentType = response.headers.get('content-type');
      console.log('🔵 [Frontend] Response Content-Type:', contentType);

      if (contentType && contentType.includes('text/html')) {
        const text = await response.text();
        console.error('🔴 [Frontend] Received HTML response instead of JSON!');
        console.error('🔴 [Frontend] HTML preview:', text.substring(0, 500));
        throw new Error('Server returned HTML instead of JSON. The endpoint may not be available.');
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          const text = await response.text();
          throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}. Response: ${text.substring(0, 100)}`);
        }
        throw new Error(errorData.error || errorData.message || `Failed to fetch video: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to fetch video from URL:", error);
      toast({
        title: "Failed to fetch video",
        description: error instanceof Error ? error.message : "Could not fetch video from URL",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔍 [Frontend] Search requested:', { query, isLimitReached, isPlanExpired, songRequests, songsQuota });

    if (!query.trim()) {
      console.log('🔍 [Frontend] Search aborted: empty query');
      return;
    }
    if (isLimitReached) {
      console.log('🔍 [Frontend] Search aborted: Limit reached');
      toast({ title: "Limit Reached", description: "You have reached your song request limit.", variant: "destructive" });
      const shouldProceed = confirm("DEBUG: Limit reached. Proceed anyway?");
      if (!shouldProceed) return;
    }
    if (isPlanExpired) {
      console.log('🔍 [Frontend] Search aborted: Plan expired');
      const shouldProceed = confirm("DEBUG: Plan expired. Proceed anyway?");
      if (!shouldProceed) return;
    }

    setIsSearching(true);
    setResults([]);
    setNextPageToken(null);
    setHasMore(true);
    setSearchId(Date.now()); // Update searchId on new search

    // Regular search (no URL detection in search box)
    const result = await fetchResults(query);
    if (result) {
      setResults(result.items);
      setNextPageToken(result.nextPageToken);
      setHasMore(!!result.nextPageToken);
    }
    setIsSearching(false);
  };

  const handleAddFromUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return; // No subscription/quota checks for URL input

    // Validate it's a YouTube URL
    if (!isYouTubeUrl(urlInput.trim())) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid YouTube URL",
        variant: "destructive",
      });
      return;
    }

    setIsAddingFromUrl(true);

    // Fetch video directly from URL
    const video = await fetchVideoFromUrl(urlInput.trim());
    if (video) {
      // Add video directly to playlist
      // Note: This will still count toward song quota, but the feature is free to use
      try {
        await addSongMutation.mutateAsync({
          youtubeId: video.id.videoId,
          title: video.snippet.title,
          artist: video.snippet.channelTitle,
          thumbnailUrl: video.snippet.thumbnails.default.url
        });

        // Show success toast with video title
        toast({
          title: "Success",
          description: `Added "${video.snippet.title}" to ${playlistId ? 'playlist' : 'queue'}`,
        });

        // Clear input field
        setUrlInput("");
      } catch (error) {
        console.error('Failed to add video from URL:', error);
        // Error toast is already shown by addSongMutation.onError
      }
    }
    setIsAddingFromUrl(false);
  };

  const loadMore = async () => {
    if (!query.trim() || !nextPageToken || isLoadingMore || isPlanExpired) return;

    setIsLoadingMore(true);
    const result = await fetchResults(query, nextPageToken);
    if (result) {
      setResults(prev => [...prev, ...result.items]);
      setNextPageToken(result.nextPageToken);
      setHasMore(!!result.nextPageToken);
    }
    setIsLoadingMore(false);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isSearching) {
          loadMore();
        }
      },
      { threshold: 0.5 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isSearching, query, nextPageToken]);

  const toggleSongSelection = (videoId: string) => {
    const newSelected = new Set(selectedSongs);
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId);
    } else {
      newSelected.add(videoId);
    }
    setSelectedSongs(newSelected);
  };

  const addSelectedSongs = async () => {
    const songsToAdd = results.filter(result => selectedSongs.has(result.id.videoId));
    let addedCount = 0;
    let failedCount = 0;

    try {
      for (const song of songsToAdd) {
        try {
          await addSongMutation.mutateAsync({
            youtubeId: song.id.videoId,
            title: song.snippet.title,
            artist: song.snippet.channelTitle,
            thumbnailUrl: song.snippet.thumbnails.default.url
          });
          addedCount++;
        } catch (error) {
          console.error(`Failed to add song: ${song.snippet.title}`, error);
          failedCount++;
        }
      }

      if (addedCount > 0) {
        setSelectedSongs(new Set());
        setResults([]);
        setQuery("");
      }

      if (addedCount > 0 && failedCount === 0) {
        toast({
          title: "Success",
          description: `Added ${addedCount} song${addedCount > 1 ? 's' : ''} to playlist`,
        });
      } else if (addedCount > 0 && failedCount > 0) {
        toast({
          title: "Partial success",
          description: `Added ${addedCount} song${addedCount > 1 ? 's' : ''}, but failed to add ${failedCount} song${failedCount > 1 ? 's' : ''}`,
          variant: "default",
        });
      } else if (addedCount === 0 && failedCount > 0) {
        toast({
          title: "Failed to add songs",
          description: "Could not add any of the selected songs",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error adding selected songs:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while adding songs",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4 w-full max-w-2xl mx-auto px-4 sm:px-6">
      {/* Show plan expiry message */}
      {isPlanExpired && (
        <Alert variant="destructive" className="py-4 px-5">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="text-base leading-relaxed">
            No Active Subscription Plan - Song requests are disabled because there's no active subscription plan. Please subscribe to a plan to enable song requests. <strong>You can still add songs using the "Add by YouTube URL" feature below, which is free and unlimited.</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Show limit reached message */}
      {isLimitReached && !isLoadingSubscription && !isPlanExpired && (
        <Alert variant="destructive" className="py-4 px-5">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="text-base leading-relaxed">
            Song request limit reached ({songRequests} / {songsQuota}). Please upgrade your subscription plan to continue adding songs. <strong>You can still add songs using the "Add by YouTube URL" feature below, which is free and unlimited.</strong>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {/* YouTube URL Input - Separate from search - FREE FOR ALL, no subscription/quota restrictions */}
        <div className="space-y-4 p-6 rounded-lg border-2 border-primary/60 bg-primary/25">
          <div className="flex items-center justify-between">
            <label className="text-lg font-bold text-foreground brightness-110">Add by YouTube URL</label>
            <span className="text-sm font-semibold text-primary brightness-900">
              ✨ Free • No quota limit
            </span>
          </div>
          <form onSubmit={handleAddFromUrl} className="flex gap-3">
            <Input
              placeholder="Paste YouTube URL here (e.g., https://youtu.be/...)"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="min-w-0 flex-1 h-12 text-base bg-background border-primary/70 focus:border-primary text-foreground"
              disabled={isAddingFromUrl || isLoadingSubscription}
            />
            <Button
              type="submit"
              disabled={isAddingFromUrl || isLoadingSubscription || !urlInput.trim()}
              className="shrink-0 h-12 px-6 bg-primary hover:bg-primary/90 text-primary-foreground text-base font-semibold brightness-110"
            >
              {isAddingFromUrl ? (
                <MusicLoader size="sm" />
              ) : (
                <>
                  <Plus className="h-5 w-5 mr-2" />
                  Add
                </>
              )}
            </Button>
          </form>
          <p className="text-sm text-foreground/80 brightness-110">
            This feature is completely free and unlimited. Songs added via URL do not count toward your song quota.
          </p>
        </div>

        {/* Search Input */}
        <div className="space-y-2">
          <label className="text-base font-semibold text-foreground">Search for songs</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <form onSubmit={handleSearch} className="flex gap-3 flex-1">
              <Input
                placeholder={isPlanExpired ? "No active subscription plan" : isLimitReached ? "Song request limit reached" : "Search for songs..."}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={cn(
                  "min-w-0 flex-1 h-12 text-base",
                  (isLimitReached || isPlanExpired) && "bg-muted border-border text-foreground/70"
                )}
                disabled={isLimitReached || isPlanExpired || isLoadingSubscription}
              />
              <Button
                type="submit"
                disabled={isSearching || isLimitReached || isPlanExpired || isLoadingSubscription}
                className="shrink-0 h-12 px-6 text-base font-semibold"
              >
                {isSearching ? (
                  <MusicLoader size="sm" />
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </form>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsImportModalOpen(true)}
              className="shrink-0 w-full sm:w-auto h-12 px-6 text-base font-semibold"
              disabled={isLimitReached || isPlanExpired || isLoadingSubscription}
            >
              <ExternalLink className="h-5 w-5 mr-2" />
              <span className="hidden sm:inline">Import Playlist</span>
              <span className="sm:hidden">Import</span>
            </Button>
          </div>
        </div>
      </div>

      <ImportPlaylistModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        guestUrl={guestUrl}
        playlistId={playlistId}
      />

      <div className="relative">
        {/* Add padding to account for fixed button at bottom on mobile */}
        <div className={`space-y-2 max-h-[400px] overflow-y-auto pb-2 ${selectedSongs.size > 0 ? 'sm:pb-2 pb-20' : 'pb-2'}`}>
          {results.map((result, index) => (
            <div
              key={`search-${searchId}-${result.id.videoId}-${index}`}
              className="flex items-center justify-between p-2 sm:p-3 rounded-lg hover:bg-accent gap-2"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <img
                  src={result.snippet.thumbnails.default.url}
                  alt={result.snippet.title}
                  className="h-10 w-10 rounded object-cover shrink-0"
                />
                <div className="min-w-0">
                  <p className="font-medium truncate">{result.snippet.title}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {result.snippet.channelTitle}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant={selectedSongs.has(result.id.videoId) ? "default" : "ghost"}
                onClick={() => toggleSongSelection(result.id.videoId)}
                disabled={addSongMutation.isPending || isLimitReached || isPlanExpired}
                className="shrink-0"
              >
                {addSongMutation.isPending ? (
                  <MusicLoader size="sm" />
                ) : selectedSongs.has(result.id.videoId) ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
          {(hasMore || isLoadingMore) && (
            <div ref={observerTarget} className="flex justify-center pt-2 pb-1">
              {isLoadingMore && <MusicLoader size="sm" />}
            </div>
          )}
        </div>

        {selectedSongs.size > 0 && (
          <div className="fixed sm:absolute bottom-16 sm:bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-4 border-t shadow-md">
            <Button
              className="w-full"
              onClick={addSelectedSongs}
              disabled={addSongMutation.isPending || isLimitReached || isPlanExpired}
            >
              Add {selectedSongs.size} song{selectedSongs.size > 1 ? 's' : ''} to playlist
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}