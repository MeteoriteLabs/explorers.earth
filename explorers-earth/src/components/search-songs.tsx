// SearchSongs — redesigned unified search bar (explorers-earth)
// Modes: manual search | youtube url | import playlist
// Single row: [icon + input] [action button] [chevron only]
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Song, YouTubeSearchResult } from '../types/music';
import {
  Search,
  Plus,
  Loader2,
  AlertCircle,
  Check,
  Link as LinkIcon,
  Download,
  ChevronDown,
  ChevronUp,
  ListMusic,
} from 'lucide-react';
import { youtubeAPI } from '../lib/apiClient';
import { useToast } from '../hooks/useToast';
import { isYouTubeUrl, isYouTubeMusicPlaylist, isSpotifyPlaylist } from '../utils/youtubeUtils';

type SearchMode = 'search' | 'url' | 'import';

interface SearchSongsProps {
  guestUrl?: string;
  onSongsAdded?: (songs: Song[]) => void;
  onSongsAddedCallback?: () => void;
  disabled?: boolean;
  onAddSongs?: (songs: Song[]) => void;
}

const MODES: { key: SearchMode; label: string; icon: React.ReactNode; placeholder: string; hint: string }[] = [
  {
    key: 'search',
    label: 'Manual Search',
    icon: <Search className="h-3.5 w-3.5" />,
    placeholder: 'Search for songs, artists, or albums...',
    hint: 'Search YouTube for songs by title, artist, or keywords',
  },
  {
    key: 'url',
    label: 'YouTube URL',
    icon: <LinkIcon className="h-3.5 w-3.5" />,
    placeholder: 'Paste a YouTube URL or video ID...',
    hint: 'Add any YouTube video directly — free & unlimited, no quota used',
  },
  {
    key: 'import',
    label: 'Import Playlist',
    icon: <ListMusic className="h-3.5 w-3.5" />,
    placeholder: 'Paste a YouTube Music or Spotify playlist URL...',
    hint: 'Import a full YouTube Music or Spotify playlist at once',
  },
];

// Single consistent accent for explorers dark UI
const ACCENT = '#2563eb'; // blue-600

export default function SearchSongs({
  guestUrl,
  onSongsAdded,
  onSongsAddedCallback,
  disabled = false,
  onAddSongs,
}: SearchSongsProps) {
  const [mode, setMode] = useState<SearchMode>('search');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isActioning, setIsActioning] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());

  // For dropdown positioning (fixed to escape clipping)
  const chevronBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  const { toast } = useToast();
  const currentMode = MODES.find((m) => m.key === mode)!;

  // Position the dropdown at fixed coords relative to the chevron button
  useEffect(() => {
    if (dropdownOpen && chevronBtnRef.current) {
      const rect = chevronBtnRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }
  }, [dropdownOpen]);

  // Close on outside click or Escape
  useEffect(() => {
    const mouseHandler = (e: MouseEvent) => {
      if (
        chevronBtnRef.current &&
        !chevronBtnRef.current.contains(e.target as Node)
      ) {
        const dropEl = document.getElementById('search-mode-dropdown');
        if (dropEl && dropEl.contains(e.target as Node)) return;
        setDropdownOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('mousedown', mouseHandler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', mouseHandler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, []);

  // Switch mode — also refocus input
  const switchMode = (m: SearchMode) => {
    setMode(m);
    setDropdownOpen(false);
    setInputValue('');
    setSearchResults([]);
    setHasSearched(false);
    setSelectedSongs(new Set());
    setNextPageToken(undefined);
    // Autofocus the input after mode switch
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: ({ query, pageToken }: { query: string; pageToken?: string }) =>
      youtubeAPI.search(query, pageToken),
    onSuccess: (data, variables) => {
      if (data.items && data.items.length > 0) {
        const transformed = data.items.map((item: any) => ({
          id: item.id.videoId,
          title: item.snippet.title,
          artist: item.snippet.channelTitle,
          thumbnailUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
          duration: 'Unknown',
        }));
        if (variables.pageToken) {
          setSearchResults((prev) => [...prev, ...transformed]);
        } else {
          setSearchResults(transformed);
        }
        setNextPageToken(data.nextPageToken);
      } else {
        setSearchResults([]);
        setNextPageToken(undefined);
      }
      setIsSearching(false);
    },
    onError: () => {
      toast('Could not search for songs. Please try again.', { variant: 'destructive' });
      setIsSearching(false);
    },
  });

  // Add songs mutation
  const addSongsMutation = useMutation({
    mutationFn: async (songs: Song[]) => {
      if (!guestUrl) throw new Error('Guest URL is required');
      const apiBaseUrl = import.meta.env.VITE_LOCAL_TUNES_API_URL || 'https://localtunes.earth';
      return Promise.all(
        songs.map((song) =>
          fetch(`${apiBaseUrl}/api/playlist/songs?guestUrl=${guestUrl}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              youtubeId: song.youtubeId,
              title: song.title,
              artist: song.artist,
              thumbnailUrl: song.thumbnailUrl,
            }),
          })
        )
      );
    },
    onSuccess: async () => {
      toast('Songs added to playlist successfully');
      setSelectedSongs(new Set());
      setSearchResults([]);
      setInputValue('');
      setHasSearched(false);
      onSongsAdded?.([]);
      await onSongsAddedCallback?.();
    },
    onError: () => {
      toast('Could not add songs to playlist', { variant: 'destructive' });
    },
  });

  // Primary action
  const handleAction = useCallback(async () => {
    const val = inputValue.trim();

    if (mode === 'search') {
      if (!val) return;
      setIsSearching(true);
      setHasSearched(true);
      setSearchResults([]);
      setNextPageToken(undefined);
      searchMutation.mutate({ query: val });
      return;
    }

    if (mode === 'url') {
      if (!val) { toast('Please enter a YouTube URL', { variant: 'destructive' }); return; }
      if (!isYouTubeUrl(val)) { toast('Please enter a valid YouTube URL', { variant: 'destructive' }); return; }
      if (!onAddSongs && !guestUrl) { toast('Guest URL is required', { variant: 'destructive' }); return; }
      setIsActioning(true);
      try {
        const videoData = await youtubeAPI.getVideoFromUrl(val, guestUrl ?? '');
        const youtubeId = videoData?.id?.videoId || videoData?.youtubeId;
        const title = videoData?.snippet?.title || videoData?.title || 'Unknown Title';
        const artist = videoData?.snippet?.channelTitle || videoData?.artist || 'Unknown Artist';
        const thumbnailUrl =
          videoData?.snippet?.thumbnails?.medium?.url ||
          videoData?.snippet?.thumbnails?.default?.url ||
          videoData?.thumbnailUrl || '';
        if (!youtubeId) { toast('Could not get video details from URL', { variant: 'destructive' }); return; }
        const song: Song = { id: 0, youtubeId, title, artist, thumbnailUrl, position: 0, status: 'queued' };
        if (onAddSongs) {
          onAddSongs([song]);
          setInputValue('');
          toast('Song added to playlist successfully');
        } else {
          const apiBaseUrl = import.meta.env.VITE_LOCAL_TUNES_API_URL || 'https://localtunes.earth';
          const response = await fetch(`${apiBaseUrl}/api/playlist/songs?guestUrl=${guestUrl}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ youtubeId, title, artist, thumbnailUrl }),
          });
          if (!response.ok) throw new Error('Failed to add song');
          toast('Song added to playlist successfully');
          setInputValue('');
          onSongsAdded?.([]);
          await onSongsAddedCallback?.();
        }
      } catch { toast('Could not add song from URL', { variant: 'destructive' }); }
      finally { setIsActioning(false); }
      return;
    }

    if (mode === 'import') {
      if (!val) { toast('Please enter a playlist URL', { variant: 'destructive' }); return; }
      const lowerVal = val.toLowerCase();
      const isYT = lowerVal.includes('youtube.com') || lowerVal.includes('music.youtube.com');
      const isSpotify = lowerVal.includes('open.spotify.com') || lowerVal.includes('spotify.com');
      if (!isYT && !isSpotify) {
        toast('Please enter a valid YouTube Music or Spotify playlist URL', { variant: 'destructive' });
        return;
      }
      setIsActioning(true);
      try {
        const data = isYT
          ? await youtubeAPI.importYouTubePlaylist(val, guestUrl)
          : await youtubeAPI.importSpotifyPlaylist(val, guestUrl);
        const addedCount = isYT
          ? (Number((data as any)?.videosAdded) || 0)
          : (Number((data as any)?.songsAdded) || 0);
        toast(
          addedCount > 0
            ? `Added ${addedCount} song${addedCount !== 1 ? 's' : ''} from ${isYT ? 'YouTube' : 'Spotify'} playlist`
            : 'Playlist imported successfully'
        );
        setInputValue('');
        onSongsAdded?.([]);
        await onSongsAddedCallback?.();
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.toLowerCase().includes('private') || msg.toLowerCase().includes('public')) {
          toast('Spotify playlist is private — please make it public first: open the playlist → ⋯ menu → Make public.', { variant: 'destructive' });
        } else {
          toast(msg || 'Could not import playlist. Check the URL and try again.', { variant: 'destructive' });
        }

      } finally {
        setIsActioning(false);
      }
    }
  }, [mode, inputValue, guestUrl, onAddSongs, onSongsAdded, onSongsAddedCallback, searchMutation, toast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleAction();
  };

  // Song selection
  const toggleSong = (id: string) => {
    const next = new Set(selectedSongs);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedSongs(next);
  };

  const handleAddSelected = () => {
    if (disabled && !onAddSongs) {
      toast('Song request limit reached.', { variant: 'destructive' });
      return;
    }
    const songs = searchResults
      .filter((s) => selectedSongs.has(s.id))
      .map((s) => ({ id: 0, youtubeId: s.id, title: s.title, artist: s.artist, thumbnailUrl: s.thumbnailUrl, position: 0, status: 'queued' as const }));
    if (!songs.length) return;
    if (onAddSongs) {
      onAddSongs(songs);
      setSelectedSongs(new Set());
      setSearchResults([]);
      setInputValue('');
      setHasSearched(false);
    } else {
      addSongsMutation.mutate(songs);
    }
  };

  const handleLoadMore = () => {
    if (nextPageToken && inputValue) {
      setIsSearching(true);
      searchMutation.mutate({ query: inputValue.trim(), pageToken: nextPageToken });
    }
  };

  // Action button
  const isActionDisabled = isSearching || isActioning || !inputValue.trim() || (mode === 'search' && disabled);

  const actionContent = () => {
    if (isSearching || isActioning) return <Loader2 className="h-4 w-4 animate-spin" />;
    if (mode === 'search') return <><Search className="h-3.5 w-3.5" /><span className="hidden sm:inline ml-1.5">Search</span></>;
    if (mode === 'url') return <><Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline ml-1.5">Add</span></>;
    return <><Download className="h-3.5 w-3.5" /><span className="hidden sm:inline ml-1.5">Import</span></>;
  };

  return (
    <div className="w-full space-y-0">
      {/* ── Single-row control ─────────────────────────────────────────── */}
      <div
        className="flex items-stretch rounded-xl border overflow-hidden transition-all duration-200"
        style={{ borderColor: `${ACCENT}55`, background: '#0d0d0d' }}
      >
        {/* Mode icon + input */}
        <div className="relative flex-1 min-w-0">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: `${ACCENT}99` }}
          >
            {currentMode.icon}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentMode.placeholder}
            disabled={isSearching || isActioning}
            className="w-full h-11 pl-9 pr-3 bg-transparent text-white text-sm placeholder:text-gray-600 focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Divider */}
        <div className="w-px self-stretch bg-white/10" />

        {/* Action button */}
        <button
          onClick={handleAction}
          disabled={isActionDisabled}
          className="flex items-center px-4 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          style={{ background: ACCENT }}
        >
          {actionContent()}
        </button>

        {/* Divider */}
        <div className="w-px self-stretch bg-white/10" />

        {/* Chevron ICON ONLY — perfectly centered */}
        <button
          ref={chevronBtnRef}
          onClick={() => setDropdownOpen((o) => !o)}
          className="h-11 w-10 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
          title="Switch mode"
        >
          {dropdownOpen
            ? <ChevronUp className="h-4 w-4" />
            : <ChevronDown className="h-4 w-4" />
          }
        </button>
      </div>

      {/* Hint text */}
      <p className="text-xs px-0.5 pt-1.5" style={{ color: `${ACCENT}99` }}>
        {currentMode.hint}
      </p>

      {/* ── Dropdown — rendered at fixed position to escape clipping ─────── */}
      {dropdownOpen && (
        <div
          id="search-mode-dropdown"
          className="fixed z-[9999] w-48 rounded-xl shadow-2xl border overflow-hidden"
          style={{
            top: dropdownPos.top,
            right: dropdownPos.right,
            background: '#1a1a1a',
            borderColor: `${ACCENT}44`,
          }}
        >
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => switchMode(m.key)}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-left transition-colors"
              style={{
                color: m.key === mode ? ACCENT : '#9ca3af',
                background: m.key === mode ? `${ACCENT}18` : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (m.key !== mode) (e.currentTarget as HTMLElement).style.background = '#ffffff0f';
              }}
              onMouseLeave={(e) => {
                if (m.key !== mode) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <span>{m.icon}</span>
              <span className="font-medium">{m.label}</span>
              {m.key === mode && <Check className="h-3.5 w-3.5 ml-auto" style={{ color: ACCENT }} />}
            </button>
          ))}
        </div>
      )}

      {/* ── Results area — only rendered when relevant ───────────────────── */}
      <div className="relative mt-3">

        {/* Loading spinner */}
        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: ACCENT }} />
          </div>
        )}

        {/* Results — only after search has been performed */}
        {!isSearching && hasSearched && mode === 'search' && (
          <>
            {searchResults.length > 0 ? (
              <>
                <p className="text-xs text-gray-600 mb-2 px-0.5">
                  {searchResults.length} result{searchResults.length > 1 ? 's' : ''} — click to select
                </p>
                <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                  {searchResults.map((song) => {
                    const selected = selectedSongs.has(song.id);
                    return (
                      <div
                        key={song.id}
                        onClick={() => toggleSong(song.id)}
                        className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all duration-150 select-none border"
                        style={{
                          background: selected ? `${ACCENT}22` : 'transparent',
                          borderColor: selected ? `${ACCENT}55` : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!selected) (e.currentTarget as HTMLElement).style.background = '#ffffff08';
                        }}
                        onMouseLeave={(e) => {
                          if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }}
                      >
                        <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 bg-gray-800">
                          <img
                            src={song.thumbnailUrl}
                            alt={song.title}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{song.title}</p>
                          <p className="text-xs text-gray-400 truncate">{song.artist}</p>
                        </div>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                          style={{
                            background: selected ? ACCENT : 'transparent',
                            border: `1.5px solid ${selected ? ACCENT : '#ffffff25'}`,
                          }}
                        >
                          {selected && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                    );
                  })}

                  {/* Load more */}
                  {nextPageToken && (
                    <button
                      onClick={handleLoadMore}
                      disabled={isSearching}
                      className="w-full py-2 text-xs rounded-lg mt-1 transition-colors disabled:opacity-40"
                      style={{ color: ACCENT, background: `${ACCENT}15` }}
                    >
                      Load more results
                    </button>
                  )}
                </div>
              </>
            ) : (
              /* No results — only when search returned nothing */
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <AlertCircle className="h-7 w-7 text-gray-700" />
                <p className="text-sm text-gray-400">No results for "{inputValue}"</p>
                <p className="text-xs text-gray-600">Try other keywords or switch to YouTube URL mode</p>
              </div>
            )}
          </>
        )}

        {/* Floating add button — anchored to this section */}
        {selectedSongs.size > 0 && (
          <div
            className="sticky bottom-0 pt-2 mt-2 border-t"
            style={{ borderColor: `${ACCENT}33`, background: '#0d0d0d' }}
          >
            <button
              onClick={handleAddSelected}
              disabled={addSongsMutation.isPending}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              {addSongsMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Plus className="h-4 w-4" />
              }
              Add {selectedSongs.size} song{selectedSongs.size > 1 ? 's' : ''} to playlist
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
