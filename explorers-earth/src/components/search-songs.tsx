// SearchSongs component for YouTube search and song selection
import React, { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Song, YouTubeSearchResult } from '../types/music';
import { Input } from './ui/input';
import PlaylistCard, { PlaylistCardContent } from './ui/PlaylistCard';
import Modal from './ui/Modal';
import { 
  Search, 
  Plus,
  Music2, 
  Loader2,
  AlertCircle,
  Clock,
  Check,
  Link as LinkIcon,
  Download,
  X
} from 'lucide-react';
import { youtubeAPI } from '../lib/apiClient';
import { useToast } from '../hooks/useToast';
import { isYouTubeUrl, isYouTubeMusicPlaylist, isSpotifyPlaylist } from '../utils/youtubeUtils';

interface SearchSongsProps {
  guestUrl?: string;
  onSongsAdded?: (songs: Song[]) => void;
  onSongsAddedCallback?: () => void;
  disabled?: boolean;
  /** When provided, overrides queue-add behaviour — songs are passed to this callback instead */
  onAddSongs?: (songs: Song[]) => void;
}

export default function SearchSongs({ guestUrl, onSongsAdded, onSongsAddedCallback, disabled = false, onAddSongs }: SearchSongsProps) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [urlInput, setUrlInput] = useState('');
  const [isAddingFromUrl, setIsAddingFromUrl] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: ({ query, pageToken }: { query: string; pageToken?: string }) =>
      youtubeAPI.search(query, pageToken),
    onSuccess: (data, variables) => {
      console.log('Search API response:', data); // Debug log
      
      if (data.items && data.items.length > 0) {
        // Transform YouTube API response to our expected format
        const transformedResults = data.items.map((item: any) => ({
          id: item.id.videoId,
          title: item.snippet.title,
          artist: item.snippet.channelTitle,
          thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
          duration: 'Unknown', // YouTube search API doesn't provide duration
        }));

        if (variables.pageToken) {
          setSearchResults(prev => [...prev, ...transformedResults]);
        } else {
          setSearchResults(transformedResults);
        }
        setNextPageToken(data.nextPageToken);
      } else {
        // No results found
        setSearchResults([]);
        setNextPageToken(undefined);
      }
      setIsSearching(false);
    },
    onError: (error) => {
      console.error('Search failed:', error);
      toast("Could not search for songs. Please try again.", { variant: "destructive" });
      setIsSearching(false);
    },
  });

  // Add multiple songs mutation
  const addSongsMutation = useMutation({
    mutationFn: async (songs: Song[]) => {
      if (!guestUrl) {
        throw new Error('Guest URL is required');
      }

      try {
        // Use the correct API URL format with environment variable
        const apiBaseUrl = import.meta.env.VITE_LOCAL_TUNES_API_URL || 'https://localtunes.earth';
        const addPromises = songs.map(song => {
          const songData = {
            youtubeId: song.youtubeId,
            title: song.title,
            artist: song.artist,
            thumbnailUrl: song.thumbnailUrl,
          };

          return fetch(`${apiBaseUrl}/api/playlist/songs?guestUrl=${guestUrl}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(songData),
          });
        });

        const results = await Promise.all(addPromises);
        return results;
      } catch (error) {
        console.error('Add songs request failed:', error);
        throw error;
      }
    },
    onSuccess: async () => {
      toast("Songs added to playlist successfully");
      setSelectedSongs(new Set());
      setSearchResults([]);
      setQuery('');
      setHasSearched(false);
      onSongsAdded?.([]);
      // Call callback which will refetch limits
      await onSongsAddedCallback?.();
    },
    onError: (error) => {
      console.error('Failed to add songs:', error);
      toast("Could not add songs to playlist", { variant: "destructive" });
    },
  });

  // Manual search function
  const handleSearch = useCallback(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    searchMutation.mutate({ query: query.trim() });
  }, [query, searchMutation]);

  // Handle input change (no auto-search)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };


  // Handle load more
  const handleLoadMore = () => {
    if (nextPageToken && query) {
      setIsSearching(true);
      searchMutation.mutate({ query, pageToken: nextPageToken });
    }
  };

  // Handle song selection
  const handleSongSelect = (songId: string) => {
    const newSelectedSongs = new Set(selectedSongs);
    if (newSelectedSongs.has(songId)) {
      newSelectedSongs.delete(songId);
    } else {
      newSelectedSongs.add(songId);
    }
    setSelectedSongs(newSelectedSongs);
  };

  // Handle adding selected songs
  const handleAddSelectedSongs = () => {
    // Prevent adding songs if disabled (limit reached) — only applies to queue mode
    if (disabled && !onAddSongs) {
      toast("Song request limit has been reached. Cannot add more songs.", { variant: "destructive" });
      return;
    }

    const songsToAdd = searchResults
      .filter(song => selectedSongs.has(song.id))
      .map(song => ({
        id: 0,
        youtubeId: song.id,
        title: song.title,
        artist: song.artist,
        thumbnailUrl: song.thumbnailUrl,
        position: 0,
        status: 'queued' as const,
      }));

    if (songsToAdd.length > 0) {
      if (onAddSongs) {
        // Playlist mode — delegate to parent, reset selection
        onAddSongs(songsToAdd);
        setSelectedSongs(new Set());
        setSearchResults([]);
        setQuery('');
        setHasSearched(false);
      } else {
        addSongsMutation.mutate(songsToAdd);
      }
    }
  };

  // Format duration
  const formatDuration = (duration: string) => {
    // Simple duration formatting - you might want to improve this
    return duration;
  };

  // Handle adding song from YouTube URL
  const handleAddFromUrl = useCallback(async () => {
    if (!urlInput.trim()) {
      toast("Please enter a YouTube URL", { variant: "destructive" });
      return;
    }

    if (!isYouTubeUrl(urlInput.trim())) {
      toast("Please enter a valid YouTube URL", { variant: "destructive" });
      return;
    }

    if (!onAddSongs && !guestUrl) {
      toast("Guest URL is required", { variant: "destructive" });
      return;
    }

    // Note: YouTube URL feature is free and unlimited, so we don't check disabled here
    setIsAddingFromUrl(true);
    try {
      // Get video details from URL
      const videoData = await youtubeAPI.getVideoFromUrl(urlInput.trim(), guestUrl ?? '');

      // Parse YouTube API response format
      const youtubeId = videoData?.id?.videoId || videoData?.youtubeId;
      const title = videoData?.snippet?.title || videoData?.title || 'Unknown Title';
      const artist = videoData?.snippet?.channelTitle || videoData?.artist || 'Unknown Artist';
      const thumbnailUrl = videoData?.snippet?.thumbnails?.medium?.url ||
                          videoData?.snippet?.thumbnails?.default?.url ||
                          videoData?.thumbnailUrl || '';

      if (!videoData || !youtubeId) {
        toast("Could not get video details from URL", { variant: "destructive" });
        return;
      }

      if (onAddSongs) {
        // Playlist mode — pass song to parent callback
        onAddSongs([{
          id: 0,
          youtubeId,
          title,
          artist,
          thumbnailUrl,
          position: 0,
          status: 'queued' as const,
        }]);
        setUrlInput('');
        toast("Song added to playlist successfully");
      } else {
        // Queue mode — add via guest URL endpoint
        const apiBaseUrl = import.meta.env.VITE_LOCAL_TUNES_API_URL || 'https://localtunes.earth';
        const response = await fetch(`${apiBaseUrl}/api/playlist/songs?guestUrl=${guestUrl}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ youtubeId, title, artist, thumbnailUrl }),
        });

        if (!response.ok) {
          throw new Error('Failed to add song');
        }

        toast("Song added to playlist successfully");
        setUrlInput('');
        onSongsAdded?.([]);
        await onSongsAddedCallback?.();
      }
    } catch (error) {
      console.error('Error adding song from URL:', error);
      toast("Could not add song from URL", { variant: "destructive" });
    } finally {
      setIsAddingFromUrl(false);
    }
  }, [urlInput, guestUrl, onAddSongs, disabled, toast, onSongsAdded, onSongsAddedCallback]);

  // Handle importing playlist
  const handleImportPlaylist = useCallback(async () => {
    if (!importUrl.trim()) {
      toast("Please enter a playlist URL", { variant: "destructive" });
      return;
    }

    if (!guestUrl) {
      toast("Guest URL is required", { variant: "destructive" });
      return;
    }

    const trimmedUrl = importUrl.trim();
    let importPromise;

    if (isYouTubeMusicPlaylist(trimmedUrl) || /youtube\.com\/playlist/.test(trimmedUrl)) {
      importPromise = youtubeAPI.importYouTubePlaylist(trimmedUrl, guestUrl);
    } else if (isSpotifyPlaylist(trimmedUrl)) {
      importPromise = youtubeAPI.importSpotifyPlaylist(trimmedUrl, guestUrl);
    } else {
      toast("Please enter a valid YouTube Music or Spotify playlist URL", { variant: "destructive" });
      return;
    }

    setIsImporting(true);
    try {
      await importPromise;
      toast("Playlist imported successfully");
      setImportUrl('');
      setIsImportModalOpen(false);
      onSongsAdded?.([]);
      await onSongsAddedCallback?.();
    } catch (error) {
      console.error('Error importing playlist:', error);
      toast("Could not import playlist", { variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  }, [importUrl, guestUrl, toast, onSongsAdded, onSongsAddedCallback]);


  return (
    <>
      {/* Floating Add to Playlist Button - Fixed to viewport */}
      {selectedSongs.size > 0 && (
        <div className="fixed bottom-[72px] left-0 right-0 z-40">
          <div className="max-w-4xl mx-auto px-6">
            <div className="bg-[#1a1a1a] rounded-lg shadow-2xl border border-gray-700 p-3">
              <div className="text-center">
                <button
                  onClick={handleAddSelectedSongs}
                  disabled={addSongsMutation.isPending}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg"
                  style={{ backgroundColor: '#2563eb' }}
                >
                  {addSongsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" style={{ color: 'white' }} />
                  ) : null}
                  Add {selectedSongs.size} song{selectedSongs.size > 1 ? 's' : ''} to playlist
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    <div className="space-y-4">
      {/* YouTube URL Input Section */}
      <PlaylistCard className="border-none bg-black text-white">
        <PlaylistCardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <LinkIcon className="h-4 w-4 text-gray-300" />
              <h3 className="text-sm font-semibold text-white">Add from YouTube URL</h3>
            </div>
            <p className="text-xs text-gray-400">
              This feature is completely free and unlimited
            </p>
            <div className="flex gap-2">
               <Input
                 placeholder="Paste YouTube URL or video ID..."
                 value={urlInput}
                 onChange={(e) => setUrlInput(e.target.value)}
                 onKeyPress={(e) => {
                   if (e.key === 'Enter') {
                     handleAddFromUrl();
                   }
                 }}
                 disabled={isAddingFromUrl}
                 className="flex-1 bg-black border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
               />
               <button
                 onClick={handleAddFromUrl}
                 disabled={isAddingFromUrl || !urlInput.trim()}
                 className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                 style={{ backgroundColor: '#2563eb' }}
               >
                {isAddingFromUrl ? (
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'white' }} />
                ) : (
                  <Plus className="h-4 w-4" style={{ color: 'white' }} />
                )}
              </button>
            </div>
          </div>
        </PlaylistCardContent>
      </PlaylistCard>
      {/* Search input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: '#9ca3af' }} />
          <Input
            placeholder="Search for songs..."
            value={query}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={disabled}
            className="pl-10 bg-black border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isSearching || !query.trim() || disabled}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          style={{ backgroundColor: '#2563eb' }}
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'white' }} />
          ) : (
            <Search className="h-4 w-4" style={{ color: 'white' }} />
          )}
        </button>
        <button
          onClick={() => setIsImportModalOpen(true)}
          disabled={disabled}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ backgroundColor: '#4b5563' }}
        >
          <Download className="h-4 w-4" style={{ color: 'white' }} />
          <span className="hidden sm:inline">Import Playlist</span>
        </button>
      </div>

      {/* Search results */}
      {hasSearched && (
        <div className="space-y-4">
          {/* Results header */}
          {searchResults.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">
                {searchResults.length} result{searchResults.length > 1 ? 's' : ''} found
              </span>
            </div>
          )}

          {/* Results list */}
          <div className={`space-y-2 max-h-96 overflow-y-auto ${selectedSongs.size > 0 ? 'pb-20' : ''}`}>
            {searchResults.map((song) => (
              <PlaylistCard key={song.id} className="hover:shadow-md transition-shadow border-none bg-black text-white">
                <PlaylistCardContent className="p-4">
                  <div className="flex items-center space-x-4">
                    {/* Thumbnail */}
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={song.thumbnailUrl}
                        alt={song.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
                        }}
                      />
                    </div>

                    {/* Song info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate text-white">{song.title}</h4>
                      <p className="text-xs text-gray-300 truncate">{song.artist}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center text-xs text-gray-400">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDuration(song.duration)}
                        </div>
                      </div>
                    </div>

                    {/* Select button */}
                    <button
                      onClick={() => handleSongSelect(song.id)}
                      className={`px-3 py-1.5 rounded-md transition-all duration-300 flex items-center justify-center ${
                        selectedSongs.has(song.id)
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-gray-600 hover:bg-gray-700'
                      }`}
                      style={{ 
                        backgroundColor: selectedSongs.has(song.id) ? '#2563eb' : '#4b5563'
                      }}
                    >
                      {selectedSongs.has(song.id) ? (
                        <Check className="h-4 w-4" style={{ color: 'white' }} />
                      ) : (
                        <Plus className="h-4 w-4" style={{ color: 'white' }} />
                      )}
                    </button>
                  </div>
                </PlaylistCardContent>
              </PlaylistCard>
            ))}
          </div>

          {/* Load more button */}
          {nextPageToken && (
            <div className="text-center">
              <button
                onClick={handleLoadMore}
                disabled={isSearching}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                style={{ backgroundColor: '#4b5563' }}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" style={{ color: 'white' }} />
                ) : null}
                Load More
              </button>
            </div>
          )}

          {/* No results */}
          {searchResults.length === 0 && !isSearching && (
            <PlaylistCard className="border-none bg-black text-white">
              <PlaylistCardContent className="p-8 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-300">No songs found for "{query}"</p>
                <p className="text-xs text-gray-400 mt-2">
                  Try different keywords or check your spelling
                </p>
              </PlaylistCardContent>
            </PlaylistCard>
          )}
        </div>
      )}

      {/* Initial state */}
      {!hasSearched && (
        <PlaylistCard className="border-none bg-black text-white">
          <PlaylistCardContent className="p-8 text-center">
            <Music2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-300">Search for songs to add to the playlist</p>
            <p className="text-xs text-gray-400 mt-2">
              Enter a song title, artist name, or any music-related keywords
            </p>
          </PlaylistCardContent>
        </PlaylistCard>
      )}
    </div>

    {/* Import Playlist Modal */}
    <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)}>
      <div className="p-6 bg-black text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Import Playlist</h2>
          <button
            onClick={() => setIsImportModalOpen(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Playlist URL
            </label>
            <Input
              placeholder="Paste YouTube Music or Spotify playlist URL..."
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleImportPlaylist();
                }
              }}
              disabled={isImporting}
              className="w-full bg-black border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-2">
              Supports YouTube Music and Spotify playlists
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleImportPlaylist}
              disabled={isImporting || !importUrl.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ backgroundColor: '#2563eb' }}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'white' }} />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" style={{ color: 'white' }} />
                  <span>Import Playlist</span>
                </>
              )}
            </button>
            <button
              onClick={() => setIsImportModalOpen(false)}
              disabled={isImporting}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#4b5563' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Modal>
    </>
  );
}
