// Embedded tunes dashboard for the explorers Music tab
import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Music2,
  Wifi,
  WifiOff,
  Loader2,
  ListMusic,
  Search,
  Settings2,
  Library,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import PlaylistTable from './playlist-table';
import SearchSongs from './search-songs';
import YoutubePlayer from './youtube-player';
import { useWebSocket } from '../hooks/useWebSocket';
import { localTunesRequest } from '../lib/apiClient';
import type { TunesDashboardData } from '../hooks/useTunesDashboard';
import type { Song } from '../types/music';

interface MusicDashboardProps {
  data: TunesDashboardData;
}

// Collapsible section component
function Section({
  icon,
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-black/20 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-dashboard-accent flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold">{title}</p>
          {subtitle && <p className="text-gray-400 text-xs mt-0.5">{subtitle}</p>}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function MusicDashboard({ data }: MusicDashboardProps) {
  const { localUser, guestUrl, playlists, playlist, isLoading, error } = data;
  const queryClient = useQueryClient();
  const hasAutoStarted = useRef(false);

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [showNewPlaylistInput, setShowNewPlaylistInput] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [settings, setSettings] = useState({
    allowSongRequests: false,
    allowGuestPlayOnDevice: false,
    allowPlaylistSharing: false,
    allowRecentlyPlayedVisibility: false,
  });

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

  const songs = (playlist?.songs ?? []) as Song[];
  const currentlyPlaying = playlist?.currentlyPlaying as Song | undefined;
  const selectedPlaylist = playlists?.find((p: any) => p.id === selectedPlaylistId);

  // Socket.io for real-time queue updates
  const handleSocketMessage = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tunes-playlist', guestUrl] });
  }, [guestUrl, queryClient]);

  const { isConnected: wsConnected } = useWebSocket(
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
        .catch(() => {});
    }
  }, [songs, currentlyPlaying, localUser, guestUrl, queryClient]);

  // Fetch current song (used by YoutubePlayer for 2s polling to detect song changes)
  const fetchCurrentSong = useCallback(async (): Promise<Song | undefined> => {
    if (!guestUrl) return undefined;
    try {
      const data: any = await localTunesRequest('GET', `/api/playlist/${guestUrl}`);
      return data?.currentlyPlaying as Song | undefined;
    } catch {
      return undefined;
    }
  }, [guestUrl]);

  // Click a song in queue to play it immediately
  const handlePlaySong = useCallback(async (song: Song) => {
    try {
      await localTunesRequest('POST', '/api/playlist/currently-playing', {
        songId: song.id,
        username: localUser?.username,
      });
      queryClient.invalidateQueries({ queryKey: ['tunes-playlist', guestUrl] });
    } catch {
      toast.error('Failed to play song');
    }
  }, [localUser, guestUrl, queryClient]);

  // Advance to next song when current song finishes
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
        // ignore — queue may be empty
      }
    }
    queryClient.invalidateQueries({ queryKey: ['tunes-playlist', guestUrl] });
  }, [nextSongForPlayer, localUser, guestUrl, queryClient]);

  // Delete song from queue
  const deleteSongMutation = useMutation({
    mutationFn: (songId: number) =>
      localTunesRequest('DELETE', `/api/playlist/songs/${songId}?username=${localUser?.username}`),
    onSuccess: () => {
      toast.success('Song removed from queue');
      queryClient.invalidateQueries({ queryKey: ['tunes-playlist', guestUrl] });
    },
    onError: () => toast.error('Failed to remove song'),
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

  // Create playlist
  const createPlaylistMutation = useMutation({
    mutationFn: (name: string) =>
      localTunesRequest('POST', '/api/playlists', { name, username: localUser?.username }),
    onSuccess: () => {
      toast.success('Playlist created');
      queryClient.invalidateQueries({ queryKey: ['tunes-playlists', localUser?.username] });
      setShowNewPlaylistInput(false);
      setNewPlaylistName('');
    },
    onError: () => toast.error('Failed to create playlist'),
  });

  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      createPlaylistMutation.mutate(newPlaylistName.trim());
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

  return (
    <div className="space-y-3">
      {/* Connection status */}
      <div className="flex items-center justify-between text-xs text-gray-500 px-1">
        <span>Local Tunes connected</span>
        <div className="flex items-center gap-1.5">
          {wsConnected
            ? <><Wifi className="w-3 h-3 text-green-400" /><span className="text-green-400">Live</span></>
            : <><WifiOff className="w-3 h-3" /><span>Polling</span></>
          }
        </div>
      </div>

      {/* Player section — shown when something is playing or about to auto-start */}
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
            /* Songs queued but auto-start in progress */
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
                <div className="flex items-center gap-1.5 mt-1 text-dashboard-accent text-xs">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Starting playback…
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Queue section */}
      <Section
        icon={<ListMusic className="w-4 h-4" />}
        title="Queue"
        subtitle={
          currentlyPlaying
            ? `Now playing + ${songs.length} up next`
            : songs.length > 0
              ? `${songs.length} song${songs.length !== 1 ? 's' : ''}`
              : undefined
        }
      >
        {!currentlyPlaying && songs.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Music2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Queue is empty</p>
            <p className="text-xs mt-1 opacity-60">Use Add Songs to get started</p>
          </div>
        ) : (
          <>
            {/* Currently playing row */}
            {currentlyPlaying && (
              <div className="flex items-center gap-3 p-3 mb-2 bg-green-500/10 border border-green-500/20 rounded-lg">
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

            {/* Queued songs */}
            {songs.length > 0 && (
              <PlaylistTable
                songs={songs}
                currentPlayingSong={currentlyPlaying}
                showControls={true}
                showReorderControls={false}
                onPlaySong={handlePlaySong}
                onDeleteSong={(id) => deleteSongMutation.mutate(id)}
              />
            )}
          </>
        )}
      </Section>

      {/* Add Songs section */}
      <Section
        icon={<Search className="w-4 h-4" />}
        title="Add Songs"
        defaultOpen={songs.length === 0 && !currentlyPlaying}
      >
        <SearchSongs
          guestUrl={guestUrl ?? undefined}
          onSongsAdded={() => {}}
          onSongsAddedCallback={async () => {
            queryClient.invalidateQueries({ queryKey: ['tunes-playlist', guestUrl] });
          }}
        />
      </Section>

      {/* Guest Controls section */}
      <Section
        icon={<Settings2 className="w-4 h-4" />}
        title="Guest Controls"
        subtitle="Manage what guests can do"
        defaultOpen={false}
      >
        <div className="space-y-1">
          {([
            { key: 'allowSongRequests' as const, label: 'Allow song requests', desc: 'Guests can add songs to your queue' },
            { key: 'allowGuestPlayOnDevice' as const, label: 'Guest playback on device', desc: 'Guests can play music on their own device' },
            { key: 'allowPlaylistSharing' as const, label: 'Allow playlist sharing', desc: 'Guests can share your playlist link' },
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
          <div className="mt-3 pt-3 border-t border-white/5">
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
      </Section>

      {/* Playlists section */}
      <Section
        icon={<Library className="w-4 h-4" />}
        title="Playlists"
        subtitle={playlists ? `${playlists.length} saved` : undefined}
        defaultOpen={false}
      >
        {selectedPlaylistId === null ? (
          <>
            <div className="flex items-center justify-between mb-3">
              {showNewPlaylistInput ? (
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={e => setNewPlaylistName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleCreatePlaylist();
                      if (e.key === 'Escape') { setShowNewPlaylistInput(false); setNewPlaylistName(''); }
                    }}
                    placeholder="Playlist name…"
                    autoFocus
                    className="flex-1 text-sm bg-black/30 border border-white/10 rounded px-2 py-1 text-white placeholder-gray-500 focus:outline-none focus:border-dashboard-accent"
                  />
                  <button
                    onClick={handleCreatePlaylist}
                    disabled={!newPlaylistName.trim() || createPlaylistMutation.isPending}
                    className="text-sm text-dashboard-accent hover:opacity-80 disabled:opacity-40"
                  >
                    {createPlaylistMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                  </button>
                  <button
                    onClick={() => { setShowNewPlaylistInput(false); setNewPlaylistName(''); }}
                    className="text-gray-500 text-sm hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewPlaylistInput(true)}
                  className="text-sm text-dashboard-accent hover:opacity-80"
                >
                  + New Playlist
                </button>
              )}
            </div>

            {playlists && playlists.length > 0 ? (
              <div className="space-y-2">
                {playlists.map((pl: any) => (
                  <button
                    key={pl.id}
                    onClick={() => setSelectedPlaylistId(pl.id)}
                    className="w-full flex items-center gap-3 p-3 bg-black/20 rounded-lg hover:bg-black/40 transition-colors text-left"
                  >
                    <div className="w-8 h-8 bg-dashboard-accent/20 rounded flex items-center justify-center flex-shrink-0">
                      <Music2 className="w-4 h-4 text-dashboard-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{pl.name}</p>
                      <p className="text-gray-400 text-xs">{pl.songs?.length ?? 0} songs</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0 -rotate-90" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-400">
                <p className="text-sm">No saved playlists yet</p>
              </div>
            )}
          </>
        ) : (
          <>
            <button
              onClick={() => setSelectedPlaylistId(null)}
              className="text-sm text-dashboard-accent hover:opacity-80 flex items-center gap-1 mb-3"
            >
              <ChevronDown className="w-4 h-4 rotate-90" />
              Back to playlists
            </button>
            <p className="text-white font-medium mb-3">{selectedPlaylist?.name}</p>
            <PlaylistTable
              songs={(selectedPlaylist?.songs ?? []) as Song[]}
              showControls={false}
              showReorderControls={false}
            />
          </>
        )}
      </Section>

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
    </div>
  );
}
