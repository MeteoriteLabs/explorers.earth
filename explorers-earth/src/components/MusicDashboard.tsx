// Embedded tunes dashboard for the explorers Music tab
import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Music2,
  Loader2,
  ListMusic,
  Search,
  Settings2,
  Library,
  ExternalLink,
  Play,
  History,
  PlayCircle,
  Shuffle,
  MoreVertical,
  Pencil,
  Trash2 as TrashIcon,
  Plus,
  Eye,
  EyeOff,
} from 'lucide-react';
import SwitchButton from './ui/SwitchButton';
import PlaylistTable from './playlist-table';
import SearchSongs from './search-songs';
import YoutubePlayer from './youtube-player';
// Note: using manual tab rendering instead of ui/tabs to match the dark dashboard theme
import { useWebSocket } from '../hooks/useWebSocket';
import { localTunesRequest } from '../lib/apiClient';
import type { TunesDashboardData } from '../hooks/useTunesDashboard';
import type { Song } from '../types/music';

interface MusicDashboardProps {
  data: TunesDashboardData;
  isPublic?: boolean;
  onVisibilityToggle?: () => void;
}

type MainTab = 'queue' | 'guest-controls' | 'recently-played' | 'playlists';

// Small confirmation modal (no shadcn Dialog needed)
function ConfirmModal({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = 'Continue',
  loading = false,
}: {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-white font-semibold mb-2">{title}</h3>
        <p className="text-gray-400 text-sm mb-5">{description}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-1.5 text-sm rounded bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-1.5 text-sm rounded bg-dashboard-accent text-white hover:opacity-90 disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MusicDashboard({ data, isPublic, onVisibilityToggle }: MusicDashboardProps) {
  const { localUser, guestUrl, playlists, playlist, isLoading, error } = data;
  const queryClient = useQueryClient();
  const hasAutoStarted = useRef(false);

  // ── Active tab state ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<MainTab>('queue');

  // ── Queue/player state ─────────────────────────────────────────────────────
  const [settings, setSettings] = useState({
    allowSongRequests: false,
    allowGuestPlayOnDevice: false,
    allowPlaylistSharing: false,
    allowRecentlyPlayedVisibility: false,
  });

  // ── Playlist UI state ──────────────────────────────────────────────────────
  const [activePlaylistTab, setActivePlaylistTab] = useState<string>('');
  // New playlist creation
  const [showNewPlaylistInput, setShowNewPlaylistInput] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('');
  // Inline edit form
  const [editingPlaylistId, setEditingPlaylistId] = useState<number | null>(null);
  const [editPlaylistName, setEditPlaylistName] = useState('');
  const [editPlaylistDescription, setEditPlaylistDescription] = useState('');
  // Confirm replace queue dialog
  const [playlistToReplace, setPlaylistToReplace] = useState<{
    id: number;
    songs: Song[];
    type: 'play' | 'shuffle';
  } | null>(null);
  const [isReplacingQueue, setIsReplacingQueue] = useState(false);
  // Dropdown menu open state (per playlist)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Sync settings when localUser loads
  useEffect(() => {
    if (localUser) {
      setSettings({
        allowSongRequests: localUser.allowSongRequests ?? false,
        allowGuestPlayOnDevice: localUser.allowGuestPlayOnDevice ?? false,
        allowPlaylistSharing: localUser.allowPlaylistSharing ?? false,
        allowRecentlyPlayedVisibility: localUser.allowRecentlyPlayedVisibility ?? false,
      });
    }
  }, [localUser?.id]);

  // Set the first playlist tab when playlists load for the first time
  useEffect(() => {
    if (playlists && playlists.length > 0 && !activePlaylistTab) {
      setActivePlaylistTab(playlists[0].id.toString());
    }
  }, [playlists]);

  const songs = (playlist?.songs ?? []) as Song[];
  const currentlyPlaying = playlist?.currentlyPlaying as Song | undefined;
  const playedSongs = (playlist?.playedSongs ?? []) as Song[];

  // Socket.io for real-time queue updates
  const handleSocketMessage = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tunes-playlist', guestUrl] });
  }, [guestUrl, queryClient]);

  useWebSocket(
    guestUrl ?? '',
    handleSocketMessage,
    { enabled: !!guestUrl }
  );

  // Auto-start first song when queue has songs but nothing is playing
  useEffect(() => {
    if (songs.length > 0 && !currentlyPlaying && localUser?.username && !hasAutoStarted.current) {
      hasAutoStarted.current = true;
      localTunesRequest('POST', '/api/playlist/currently-playing', {
        songId: songs[0].id,
        username: localUser.username,
      })
        .then(() => queryClient.invalidateQueries({ queryKey: ['tunes-playlist', guestUrl] }))
        .catch(() => { });
    }
  }, [songs, currentlyPlaying, localUser, guestUrl, queryClient]);

  // Fetch current song (used by YoutubePlayer — returns cached state, no extra network call)
  const fetchCurrentSong = useCallback(async (): Promise<Song | undefined> => {
    return currentlyPlaying as Song | undefined;
  }, [currentlyPlaying]);

  // ── Queue mutations ────────────────────────────────────────────────────────

  const handlePlaySong = useCallback(async (song: Song) => {
    try {
      await localTunesRequest('POST', '/api/playlist/currently-playing', {
        songId: song.id,
        username: localUser?.username,
      });
      queryClient.refetchQueries({ queryKey: ['tunes-playlist', guestUrl] });
    } catch {
      toast.error('Failed to play song');
    }
  }, [localUser, guestUrl, queryClient]);

  const nextSongForPlayer = songs[0] as Song | undefined;
  const handleSongFinished = useCallback(async () => {
    const next = nextSongForPlayer;
    if (next) {
      try {
        await localTunesRequest('POST', '/api/playlist/currently-playing', {
          songId: next.id,
          username: localUser?.username,
        });
      } catch {
        // ignore
      }
    }
    queryClient.invalidateQueries({ queryKey: ['tunes-playlist', guestUrl] });
  }, [nextSongForPlayer, localUser, guestUrl, queryClient]);

  const deleteSongMutation = useMutation({
    mutationFn: (songId: number) =>
      localTunesRequest('DELETE', `/api/playlist/songs/${songId}?username=${localUser?.username}`),
    onSuccess: () => {
      toast.success('Song removed from queue');
      queryClient.refetchQueries({ queryKey: ['tunes-playlist', guestUrl] });
    },
    onError: () => toast.error('Failed to remove song'),
  });

  const addToQueueMutation = useMutation({
    mutationFn: (song: Song) =>
      localTunesRequest('POST', '/api/playlist/songs', {
        youtubeId: song.youtubeId,
        title: song.title,
        artist: song.artist,
        thumbnailUrl: song.thumbnailUrl,
        username: localUser?.username,
      }),
    onSuccess: () => {
      toast.success('Added to queue');
      queryClient.invalidateQueries({ queryKey: ['tunes-playlist', guestUrl] });
    },
    onError: () => toast.error('Failed to add to queue'),
  });

  // Single-PATCH reorder: storage.updateSongPosition() rewrites the ENTIRE queue order
  // in one DB transaction, so sending one PATCH per song would compound incorrectly.
  // We detect which song moved and send exactly one PATCH with its new target index.
  const reorderMutation = useMutation({
    mutationFn: async (newOrder: number[]) => {
      const currentIds = songs.map(s => s.id);

      // Build a lookup: songId → old index
      const oldIndexMap = new Map<number, number>(currentIds.map((id, i) => [id, i]));

      // Find the song whose position in newOrder differs from its original position.
      // We prefer the song that moved the furthest (the actually-dragged song).
      let movedSongId: number | null = null;
      let newTargetIndex = -1;
      let maxDelta = 0;

      for (let i = 0; i < newOrder.length; i++) {
        const id = newOrder[i];
        const oldIdx = oldIndexMap.get(id) ?? i;
        const delta = Math.abs(oldIdx - i);
        if (delta > maxDelta) {
          maxDelta = delta;
          movedSongId = id;
          newTargetIndex = i;
        }
      }

      if (movedSongId === null || maxDelta === 0) return; // nothing changed

      await localTunesRequest('PATCH', `/api/playlist/songs/${movedSongId}/position`, {
        position: newTargetIndex,
      });
    },
    onSuccess: () => {
      toast.success('Queue reordered');
      queryClient.refetchQueries({ queryKey: ['tunes-playlist', guestUrl] });
    },
    onError: () => toast.error('Failed to reorder songs'),
  });

  // Update guest settings
  const updateSettingsMutation = useMutation({
    mutationFn: (patch: Record<string, boolean>) =>
      localTunesRequest('PATCH', '/api/user', { username: localUser?.username, ...patch }),
    onSuccess: () => toast.success('Settings saved'),
    onError: () => {
      toast.error('Failed to save settings');
      if (localUser) {
        setSettings({
          allowSongRequests: localUser.allowSongRequests ?? false,
          allowGuestPlayOnDevice: localUser.allowGuestPlayOnDevice ?? false,
          allowPlaylistSharing: localUser.allowPlaylistSharing ?? false,
          allowRecentlyPlayedVisibility: localUser.allowRecentlyPlayedVisibility ?? false,
        });
      }
    },
  });

  const handleToggle = (key: keyof typeof settings) => {
    const newVal = !settings[key];
    setSettings(prev => ({ ...prev, [key]: newVal }));
    updateSettingsMutation.mutate({ [key]: newVal });
  };

  // ── Playlist mutations ─────────────────────────────────────────────────────

  const createPlaylistMutation = useMutation({
    mutationFn: ({ name, description }: { name: string; description: string }) =>
      localTunesRequest('POST', '/api/playlists', {
        name,
        description: description || undefined,
        username: localUser?.username,
      }),
    onSuccess: (data: any) => {
      toast.success('Playlist created');
      queryClient.invalidateQueries({ queryKey: ['tunes-playlists', localUser?.username] });
      setShowNewPlaylistInput(false);
      setNewPlaylistName('');
      setNewPlaylistDescription('');
      // Switch to the new playlist tab
      if (data?.id) setActivePlaylistTab(data.id.toString());
    },
    onError: () => toast.error('Failed to create playlist'),
  });

  const deletePlaylistMutation = useMutation({
    mutationFn: (playlistId: number) =>
      localTunesRequest('DELETE', `/api/playlists/${playlistId}?username=${localUser?.username}`),
    onSuccess: () => {
      toast.success('Playlist deleted');
      queryClient.invalidateQueries({ queryKey: ['tunes-playlists', localUser?.username] });
      setActivePlaylistTab('');
    },
    onError: () => toast.error('Failed to delete playlist'),
  });

  const updatePlaylistMutation = useMutation({
    mutationFn: ({ playlistId, name, description }: { playlistId: number; name: string; description: string }) =>
      localTunesRequest('PATCH', `/api/playlists/${playlistId}`, {
        name,
        description: description || undefined,
        username: localUser?.username,
      }),
    onSuccess: () => {
      toast.success('Playlist updated');
      queryClient.invalidateQueries({ queryKey: ['tunes-playlists', localUser?.username] });
      setEditingPlaylistId(null);
      setEditPlaylistName('');
      setEditPlaylistDescription('');
    },
    onError: () => toast.error('Failed to update playlist'),
  });

  const updatePlaylistVisibilityMutation = useMutation({
    mutationFn: ({ playlistId, isVisible }: { playlistId: number; isVisible: boolean }) =>
      localTunesRequest('PATCH', `/api/playlists/${playlistId}/visibility`, {
        isVisible,
        username: localUser?.username,
      }),
    onSuccess: (_data, { isVisible }) => {
      toast.success(`Playlist ${isVisible ? 'visible to guests' : 'hidden from guests'}`);
      queryClient.invalidateQueries({ queryKey: ['tunes-playlists', localUser?.username] });
    },
    onError: () => toast.error('Failed to update visibility'),
  });

  const addSongsToPlaylistMutation = useMutation({
    mutationFn: ({ playlistId, songs }: { playlistId: number; songs: Song[] }) =>
      localTunesRequest('POST', `/api/playlists/${playlistId}/songs`, {
        songs: songs.map(s => ({
          youtubeId: s.youtubeId,
          title: s.title,
          artist: s.artist,
          thumbnailUrl: s.thumbnailUrl,
        })),
        username: localUser?.username,
      }),
    onSuccess: () => {
      toast.success('Songs added to playlist');
      queryClient.invalidateQueries({ queryKey: ['tunes-playlists', localUser?.username] });
    },
    onError: () => toast.error('Failed to add songs to playlist'),
  });

  const deletePlaylistSongMutation = useMutation({
    mutationFn: ({ playlistId, songId }: { playlistId: number; songId: number }) =>
      localTunesRequest(
        'DELETE',
        `/api/playlists/${playlistId}/songs/${songId}?username=${localUser?.username}`
      ),
    onSuccess: () => {
      toast.success('Song removed from playlist');
      queryClient.invalidateQueries({ queryKey: ['tunes-playlists', localUser?.username] });
    },
    onError: () => toast.error('Failed to remove song from playlist'),
  });

  // Add all songs from a saved playlist to the live queue (appends)
  const addPlaylistToQueueMutation = useMutation({
    mutationFn: async (playlistSongs: Song[]) => {
      for (const song of playlistSongs) {
        await localTunesRequest('POST', '/api/playlist/songs', {
          youtubeId: song.youtubeId,
          title: song.title,
          artist: song.artist,
          thumbnailUrl: song.thumbnailUrl,
          username: localUser?.username,
        });
      }
    },
    onSuccess: () => {
      toast.success('Playlist added to queue');
      queryClient.invalidateQueries({ queryKey: ['tunes-playlist', guestUrl] });
    },
    onError: () => toast.error('Failed to add playlist to queue'),
  });

  // Replace current queue with playlist songs (play or shuffle)
  const replaceQueueMutation = useMutation({
    mutationFn: async ({ songs: playlistSongs, type }: { songs: Song[]; type: 'play' | 'shuffle' }) => {
      setIsReplacingQueue(true);
      try {
        // 1. Stop current song
        await localTunesRequest('POST', '/api/playlist/currently-playing', {
          songId: null,
          username: localUser?.username,
        }).catch(() => { });

        // 2. Clear current queue
        const currentQueue = (playlist?.songs ?? []) as Song[];
        for (const song of currentQueue) {
          await localTunesRequest(
            'DELETE',
            `/api/playlist/songs/${song.id}?username=${localUser?.username}`
          ).catch(() => { });
        }

        // 3. Build ordered/shuffled list
        const orderedSongs = type === 'shuffle'
          ? [...playlistSongs].sort(() => Math.random() - 0.5)
          : [...playlistSongs];

        // 4. Add each song to queue
        for (let i = 0; i < orderedSongs.length; i++) {
          const s = orderedSongs[i];
          await localTunesRequest('POST', `/api/playlist/songs?username=${localUser?.username}`, {
            youtubeId: s.youtubeId,
            title: s.title,
            artist: s.artist,
            thumbnailUrl: s.thumbnailUrl,
            position: i,
          });
        }

        // 5. Refresh queue and start playing first song
        await queryClient.invalidateQueries({ queryKey: ['tunes-playlist', guestUrl] });
        // Short delay for DB to settle before fetching first song id
        await new Promise(r => setTimeout(r, 600));
        const refreshed = await localTunesRequest('GET', `/api/playlist/${guestUrl}`);
        const firstSong = (refreshed as any)?.songs?.[0];
        if (firstSong?.id) {
          await localTunesRequest('POST', '/api/playlist/currently-playing', {
            songId: firstSong.id,
            username: localUser?.username,
          });
        }
      } finally {
        setIsReplacingQueue(false);
      }
    },
    onSuccess: (_data, { type }) => {
      toast.success(type === 'shuffle' ? 'Playlist shuffled and started' : 'Playlist started');
      setPlaylistToReplace(null);
      queryClient.invalidateQueries({ queryKey: ['tunes-playlist', guestUrl] });
    },
    onError: () => {
      setIsReplacingQueue(false);
      toast.error('Failed to start playlist');
    },
  });

  const handleConfirmReplaceQueue = () => {
    if (playlistToReplace) {
      replaceQueueMutation.mutate({
        songs: playlistToReplace.songs,
        type: playlistToReplace.type,
      });
    }
  };

  const guestPageUrl = `${import.meta.env.VITE_LOCAL_TUNES_API_URL || 'https://localtunes.earth'}/guest/${guestUrl}`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Connecting to Local Tunes…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-yellow-400 text-sm">Could not connect to Local Tunes</p>
        <p className="text-gray-500 text-xs mt-1">{error}</p>
      </div>
    );
  }

  // Tab definitions
  const tabs: { id: MainTab; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    { id: 'queue', label: 'Queue', shortLabel: 'Queue', icon: <ListMusic className="w-3.5 h-3.5" /> },
    { id: 'guest-controls', label: 'Guest Controls', shortLabel: 'Guests', icon: <Settings2 className="w-3.5 h-3.5" /> },
    { id: 'recently-played', label: 'Recently Played', shortLabel: 'Recent', icon: <History className="w-3.5 h-3.5" /> },
    { id: 'playlists', label: 'Playlists', shortLabel: 'Playlists', icon: <Library className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* ── Top Row with Add Button and Visibility Toggle ─────────────────── */}
      <div className="flex items-center justify-between bg-dashboard-sidebar/40 px-3 py-3 rounded-xl mb-2">
        <div className="flex items-center gap-3 bg-dashboard-muted/50 pl-3 pr-0 md:px-4 py-2 rounded-xl">
          <div className="flex flex-col">
            <span className="text-[10px] md:text-xs font-bold text-white leading-tight">Public Visibility</span>
            <span className="text-[9px] md:text-[10px] text-white/50 leading-tight">Music</span>
          </div>
          <SwitchButton
            isChecked={isPublic === true}
            onChange={onVisibilityToggle || (() => {})}
            variant="blue"
          />
        </div>

        <button
          onClick={() => {
            setActiveTab('playlists');
            setShowNewPlaylistInput(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-dashboard-accent hover:opacity-90 text-sm text-white font-medium transition-all shadow-lg shadow-blue-900/30"
        >
           <Plus size={18} />
           <span>New Playlist</span>
        </button>
      </div>

      {/* ── Add Songs — always visible at top ─────────────────────────────── */}
      <div className="bg-black/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-dashboard-accent" />
          <p className="text-white text-sm font-semibold">Add Songs</p>
        </div>
        <SearchSongs
          guestUrl={guestUrl ?? undefined}
          onSongsAdded={() => { }}
          onSongsAddedCallback={async () => {
            queryClient.invalidateQueries({ queryKey: ['tunes-playlist', guestUrl] });
          }}
        />
      </div>

      {/* ── Video Player ────────────────────────────────────────────────────── */}
      {(currentlyPlaying || songs.length > 0) && (
        <div className="bg-black/20 rounded-xl p-4">
          {currentlyPlaying ? (
            <YoutubePlayer
              currentSong={currentlyPlaying}
              nextSong={nextSongForPlayer}
              fetchCurrentSong={fetchCurrentSong}
              onSongFinished={handleSongFinished}
              defaultAutoplay={true}
              showAutoplayControl={false}
            />
          ) : (
            <div className="flex items-center gap-3 p-2">
              <img
                src={songs[0].thumbnailUrl}
                className="w-14 h-14 rounded object-cover flex-shrink-0"
                alt={songs[0].title}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{songs[0].title}</p>
                <p className="text-gray-400 text-xs truncate">{songs[0].artist}</p>
              </div>
              <button
                onClick={() => handlePlaySong(songs[0])}
                className="w-10 h-10 rounded-full bg-dashboard-accent flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity"
                title="Start playing"
              >
                <Play className="w-4 h-4 text-white ml-0.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tab-based layout ─────────────────────────────────────────────────── */}
      <div className="bg-black/20 rounded-xl overflow-hidden">
        {/* Tab strip */}
        <div className="flex items-stretch border-b border-white/10">
          {/* Scrollable tab buttons */}
          <div
            className="flex overflow-x-auto flex-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          >
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-2.5 sm:px-4 py-3 text-[11px] sm:text-xs font-medium whitespace-nowrap transition-colors border-b-2 flex-shrink-0
                  ${activeTab === tab.id
                    ? 'border-dashboard-accent text-dashboard-accent bg-white/5'
                    : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                {tab.icon}
                <span>{tab.shortLabel}</span>
                {tab.id === 'queue' && (currentlyPlaying || songs.length > 0) && (
                  <span className="text-gray-500 text-[10px]">
                    {currentlyPlaying ? `${songs.length + 1}` : songs.length}
                  </span>
                )}
                {tab.id === 'recently-played' && playedSongs.length > 0 && (
                  <span className="text-gray-500 text-[10px]">{playedSongs.length}</span>
                )}
                {tab.id === 'playlists' && playlists && playlists.length > 0 && (
                  <span className="text-gray-500 text-[10px]">{playlists.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-4">

          {/* ── Queue tab ──────────────────────────────────────────────────── */}
          {activeTab === 'queue' && (
            <div>
              {!currentlyPlaying && songs.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <Music2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Queue is empty</p>
                  <p className="text-xs mt-1 opacity-60">Use Add Songs above to get started</p>
                </div>
              ) : (
                <>
                  {currentlyPlaying && (
                    <div className="flex items-center gap-3 p-3 mb-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <img
                        src={currentlyPlaying.thumbnailUrl}
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                        alt={currentlyPlaying.title}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-green-400 mb-0.5">Now Playing</p>
                        <p className="text-sm text-white font-medium truncate">{currentlyPlaying.title}</p>
                        <p className="text-xs text-gray-400 truncate">{currentlyPlaying.artist}</p>
                      </div>
                    </div>
                  )}

                  {songs.length > 0 && (
                    <PlaylistTable
                      songs={songs}
                      currentPlayingSong={currentlyPlaying}
                      showControls={false}
                      showReorderControls={true}
                      onPlaySong={handlePlaySong}
                      onDeleteSong={(id) => deleteSongMutation.mutate(id)}
                      onReorderSongs={(newOrder) => reorderMutation.mutate(newOrder)}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Guest Controls tab ─────────────────────────────────────────── */}
          {activeTab === 'guest-controls' && (
            <div>
              <div className="space-y-1">
                {([
                  { key: 'allowSongRequests' as const, label: 'Allow song requests', desc: 'Guests can add songs to your queue' },
                  { key: 'allowGuestPlayOnDevice' as const, label: 'Guest playback on device', desc: 'Guests can play music on their own device' },
                  { key: 'allowPlaylistSharing' as const, label: 'Allow playlist sharing', desc: 'Guests can see your saved playlists' },
                  { key: 'allowRecentlyPlayedVisibility' as const, label: 'Show recently played', desc: "Guests can see songs you've played" },
                ]).map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between gap-4 py-2.5 border-b border-white/5 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">{label}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
                    </div>
                    <button
                      onClick={() => handleToggle(key)}
                      disabled={updateSettingsMutation.isPending}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-50
                        ${settings[key] ? 'bg-dashboard-accent' : 'bg-gray-600'}`}
                      aria-label={`Toggle ${label}`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200
                          ${settings[key] ? 'translate-x-5' : 'translate-x-0'}`}
                      />
                    </button>
                  </div>
                ))}
              </div>

              {guestUrl && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-gray-500 text-xs mb-1">Guest page link</p>
                  <p className="text-gray-400 text-xs break-all font-mono">{guestPageUrl}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(guestPageUrl);
                      toast.success('Link copied!');
                    }}
                    className="mt-1.5 text-xs text-dashboard-accent hover:opacity-80"
                  >
                    Copy link
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Recently Played tab ────────────────────────────────────────── */}
          {activeTab === 'recently-played' && (
            <div>
              {playedSongs.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No recently played songs</p>
                </div>
              ) : (
                <PlaylistTable
                  songs={playedSongs}
                  isHistory={true}
                  showControls={false}
                  showReorderControls={false}
                  onPlaySong={handlePlaySong}
                  showAddToQueue={true}
                  onAddToQueue={(song) => addToQueueMutation.mutate(song)}
                  onDeleteSong={(id) => deleteSongMutation.mutate(id)}
                />
              )}
            </div>
          )}

          {/* ── Playlists tab ──────────────────────────────────────────────── */}
          {activeTab === 'playlists' && (
            <div>
              {/* Header: new playlist button */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500">
                  {playlists && playlists.length > 0 ? `${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}` : 'No playlists yet'}
                </span>
                {showNewPlaylistInput ? null : (
                  <button
                    onClick={() => setShowNewPlaylistInput(true)}
                    className="flex items-center gap-1 text-xs text-dashboard-accent hover:opacity-80 transition-opacity"
                  >
                    <Plus className="w-3 h-3" />
                    New Playlist
                  </button>
                )}
              </div>

              {/* Inline new-playlist form */}
              {showNewPlaylistInput && (
                <div className="mb-4 p-3 bg-black/30 rounded-lg border border-white/10 space-y-2">
                  <p className="text-xs text-white font-medium">Create Playlist</p>
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={e => setNewPlaylistName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newPlaylistName.trim()) {
                        createPlaylistMutation.mutate({ name: newPlaylistName.trim(), description: newPlaylistDescription.trim() });
                      }
                      if (e.key === 'Escape') {
                        setShowNewPlaylistInput(false);
                        setNewPlaylistName('');
                        setNewPlaylistDescription('');
                      }
                    }}
                    placeholder="Playlist name…"
                    autoFocus
                    className="w-full text-sm bg-black/30 border border-white/10 rounded px-2 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-dashboard-accent"
                  />
                  <input
                    type="text"
                    value={newPlaylistDescription}
                    onChange={e => setNewPlaylistDescription(e.target.value)}
                    placeholder="Description (optional)…"
                    className="w-full text-sm bg-black/30 border border-white/10 rounded px-2 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-dashboard-accent"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => { setShowNewPlaylistInput(false); setNewPlaylistName(''); setNewPlaylistDescription(''); }}
                      className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (newPlaylistName.trim()) {
                          createPlaylistMutation.mutate({ name: newPlaylistName.trim(), description: newPlaylistDescription.trim() });
                        }
                      }}
                      disabled={!newPlaylistName.trim() || createPlaylistMutation.isPending}
                      className="text-xs bg-dashboard-accent text-white rounded px-3 py-1 hover:opacity-90 disabled:opacity-40 flex items-center gap-1"
                    >
                      {createPlaylistMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      Create
                    </button>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {(!playlists || playlists.length === 0) && !showNewPlaylistInput && (
                <div className="text-center py-6 text-gray-400">
                  <Library className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No saved playlists yet</p>
                  <p className="text-xs mt-1 opacity-60">Create one to organise your favourite songs</p>
                </div>
              )}

              {/* Tab-based playlist view */}
              {playlists && playlists.length > 0 && (() => {
                const currentTabId = activePlaylistTab || playlists[0].id.toString();
                return (
                  <div>
                    {/* Playlist tab strip */}
                    <div className="mb-4 flex flex-wrap gap-1 p-1 bg-black/30 border border-white/10 rounded-lg overflow-x-auto">
                      {playlists.map((pl: any) => {
                        const isActive = currentTabId === pl.id.toString();
                        return (
                          <button
                            key={pl.id}
                            onClick={() => setActivePlaylistTab(pl.id.toString())}
                            className={`px-3 py-1 text-xs whitespace-nowrap rounded transition-colors ${isActive
                              ? 'bg-dashboard-accent text-white'
                              : 'text-gray-400 hover:text-white hover:bg-white/10'
                              }`}
                          >
                            {pl.name}
                            <span className="ml-1 opacity-60">({pl.songs?.length ?? 0})</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Per-playlist content — render only active tab */}
                    {playlists.map((p: any) => {
                      if (p.id.toString() !== currentTabId) return null;
                      const isEditing = editingPlaylistId === p.id;
                      return (
                        <div key={p.id}>
                          <div className="space-y-4">

                            {/* Add Songs to playlist */}
                            <div className="bg-black/10 rounded-lg p-3 border border-white/5">
                              <p className="text-xs text-gray-400 font-medium mb-2">Add Songs to "{p.name}"</p>
                              <SearchSongs
                                playlistId={p.id}
                                onAddSongs={(songs) =>
                                  addSongsToPlaylistMutation.mutate({ playlistId: p.id, songs })
                                }
                                onSongsAddedCallback={async () => {
                                  queryClient.invalidateQueries({ queryKey: ['tunes-playlists', localUser?.username] });
                                }}
                              />
                            </div>

                            {/* Playlist header: name/desc + ⋮ menu */}
                            {isEditing ? (
                              <div className="bg-black/10 rounded-lg p-3 border border-white/5 space-y-2">
                                <p className="text-xs text-gray-400 font-medium">Edit Playlist</p>
                                <input
                                  type="text"
                                  value={editPlaylistName}
                                  onChange={e => setEditPlaylistName(e.target.value)}
                                  placeholder="Playlist name…"
                                  autoFocus
                                  className="w-full text-sm bg-black/30 border border-white/10 rounded px-2 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-dashboard-accent"
                                />
                                <input
                                  type="text"
                                  value={editPlaylistDescription}
                                  onChange={e => setEditPlaylistDescription(e.target.value)}
                                  placeholder="Description (optional)…"
                                  className="w-full text-sm bg-black/30 border border-white/10 rounded px-2 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-dashboard-accent"
                                />
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={() => setEditingPlaylistId(null)}
                                    className="text-xs text-gray-400 hover:text-white px-3 py-1"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (editPlaylistName.trim()) {
                                        updatePlaylistMutation.mutate({
                                          playlistId: p.id,
                                          name: editPlaylistName.trim(),
                                          description: editPlaylistDescription.trim(),
                                        });
                                      }
                                    }}
                                    disabled={!editPlaylistName.trim() || updatePlaylistMutation.isPending}
                                    className="text-xs bg-dashboard-accent text-white rounded px-3 py-1 hover:opacity-90 disabled:opacity-40 flex items-center gap-1"
                                  >
                                    {updatePlaylistMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-white text-sm font-medium truncate">{p.name}</p>
                                  {p.description && (
                                    <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{p.description}</p>
                                  )}
                                  <p className="text-gray-500 text-xs mt-0.5">{p.songs?.length ?? 0} songs</p>
                                </div>

                                {/* ⋮ more menu */}
                                <div className="relative flex-shrink-0">
                                  <button
                                    onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                                    className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                    title="More options"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                  {openMenuId === p.id && (
                                    <>
                                      {/* Backdrop to close on outside click */}
                                      <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setOpenMenuId(null)}
                                      />
                                      <div className="absolute right-0 top-8 z-20 bg-gray-900 border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[140px]">
                                        <button
                                          onClick={() => {
                                            setOpenMenuId(null);
                                            setEditingPlaylistId(p.id);
                                            setEditPlaylistName(p.name);
                                            setEditPlaylistDescription(p.description || '');
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 w-full text-left transition-colors"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                          Edit Playlist
                                        </button>
                                        <button
                                          onClick={() => {
                                            setOpenMenuId(null);
                                            deletePlaylistMutation.mutate(p.id);
                                          }}
                                          className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-400/10 w-full text-left transition-colors"
                                        >
                                          <TrashIcon className="w-3.5 h-3.5" />
                                          Delete Playlist
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => setPlaylistToReplace({ id: p.id, songs: p.songs ?? [], type: 'play' })}
                                disabled={!p.songs?.length}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-dashboard-accent text-white hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                              >
                                <PlayCircle className="w-3.5 h-3.5" />
                                Play Playlist
                              </button>
                              <button
                                onClick={() => setPlaylistToReplace({ id: p.id, songs: p.songs ?? [], type: 'shuffle' })}
                                disabled={!p.songs?.length}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <Shuffle className="w-3.5 h-3.5" />
                                Shuffle
                              </button>
                              <button
                                onClick={() => addPlaylistToQueueMutation.mutate(p.songs ?? [])}
                                disabled={!p.songs?.length || addPlaylistToQueueMutation.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                {addPlaylistToQueueMutation.isPending
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <Plus className="w-3.5 h-3.5" />
                                }
                                Add to Queue
                              </button>
                            </div>

                            {/* Visible to guests toggle */}
                            {settings.allowPlaylistSharing && (
                              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-black/20 border border-white/5">
                                <div className="flex items-center gap-2">
                                  {p.isVisibleToGuests
                                    ? <Eye className="w-3.5 h-3.5 text-green-400" />
                                    : <EyeOff className="w-3.5 h-3.5 text-gray-500" />
                                  }
                                  <span className="text-xs text-gray-300">Visible to guests</span>
                                </div>
                                <button
                                  onClick={() =>
                                    updatePlaylistVisibilityMutation.mutate({
                                      playlistId: p.id,
                                      isVisible: !p.isVisibleToGuests,
                                    })
                                  }
                                  disabled={updatePlaylistVisibilityMutation.isPending}
                                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 disabled:opacity-50
                                  ${p.isVisibleToGuests ? 'bg-dashboard-accent' : 'bg-gray-600'}`}
                                  aria-label="Toggle guest visibility"
                                >
                                  <span
                                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200
                                    ${p.isVisibleToGuests ? 'translate-x-5' : 'translate-x-0'}`}
                                  />
                                </button>
                              </div>
                            )}

                            {/* Song list */}
                            {p.songs && p.songs.length > 0 ? (
                              <PlaylistTable
                                songs={p.songs as Song[]}
                                showControls={false}
                                showReorderControls={false}
                                showAddToQueue={true}
                                onAddToQueue={(song) => addToQueueMutation.mutate(song)}
                                onDeleteSong={(songId) =>
                                  deletePlaylistSongMutation.mutate({ playlistId: p.id, songId })
                                }
                              />
                            ) : (
                              <div className="text-center py-6 text-gray-400">
                                <Music2 className="w-6 h-6 mx-auto mb-2 opacity-30" />
                                <p className="text-xs">This playlist is empty — add songs above!</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

        </div>
      </div>

      {/* Full dashboard link */}
      <div className="text-center pt-1 pb-2">
        <a
          href={`${import.meta.env.VITE_LOCAL_TUNES_API_URL || 'https://localtunes.earth'}/auth?tab=login`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-400 inline-flex items-center gap-1"
        >
          Open full Local Tunes dashboard
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* ── Confirm replace queue dialog ────────────────────────────────── */}
      <ConfirmModal
        open={!!playlistToReplace}
        title="Replace Current Queue?"
        description={`This will remove all songs from your current queue and ${playlistToReplace?.type === 'shuffle' ? 'shuffle and play' : 'play'
          } the selected playlist instead.`}
        confirmLabel={isReplacingQueue ? 'Starting…' : 'Continue'}
        loading={isReplacingQueue}
        onConfirm={handleConfirmReplaceQueue}
        onCancel={() => {
          if (!isReplacingQueue) setPlaylistToReplace(null);
        }}
      />
    </div>
  );
}