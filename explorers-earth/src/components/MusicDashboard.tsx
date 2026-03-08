// Embedded tunes dashboard for the explorers Music tab
import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Music2, Wifi, WifiOff, Loader2 } from 'lucide-react';
import PlaylistTable from './playlist-table';
import SearchSongs from './search-songs';
import { useWebSocket } from '../hooks/useWebSocket';
import { localTunesRequest } from '../lib/apiClient';
import type { TunesDashboardData } from '../hooks/useTunesDashboard';
import type { Song } from '../types/music';

interface MusicDashboardProps {
  data: TunesDashboardData;
}

type Tab = 'queue' | 'playlists' | 'search' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'queue', label: 'Queue' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'search', label: 'Search' },
  { id: 'settings', label: 'Settings' },
];

export default function MusicDashboard({ data }: MusicDashboardProps) {
  const { localUser, guestUrl, playlists, playlist, isLoading, error } = data;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('queue');
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

  // Socket.io for real-time queue updates
  const handleSocketMessage = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['tunes-playlist', guestUrl] });
  }, [guestUrl, queryClient]);

  const { isConnected: wsConnected } = useWebSocket(
    guestUrl ?? '',
    handleSocketMessage,
    { enabled: !!guestUrl }
  );

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
      // Revert optimistic update on error
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

  const songs = (playlist?.songs ?? []) as Song[];
  const currentlyPlaying = playlist?.currentlyPlaying as Song | undefined;
  const selectedPlaylist = playlists?.find((p: any) => p.id === selectedPlaylistId);

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
    <div className="space-y-4">
      {/* Now Playing Bar */}
      {currentlyPlaying && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
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
          <div
            title={wsConnected ? 'Live updates active' : 'Updates via polling'}
            className="flex-shrink-0"
          >
            {wsConnected
              ? <Wifi className="w-4 h-4 text-green-400" />
              : <WifiOff className="w-4 h-4 text-gray-500" />
            }
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 bg-black/30 rounded-lg p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors
              ${activeTab === tab.id
                ? 'bg-dashboard-accent text-white'
                : 'text-gray-400 hover:text-white'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Queue Tab */}
      {activeTab === 'queue' && (
        songs.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <Music2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Queue is empty</p>
            <p className="text-xs mt-1 opacity-60">Go to Search to add songs</p>
          </div>
        ) : (
          <PlaylistTable
            songs={songs}
            currentPlayingSong={currentlyPlaying}
            showControls={true}
            showReorderControls={false}
            onDeleteSong={(id) => deleteSongMutation.mutate(id)}
          />
        )
      )}

      {/* Playlists Tab */}
      {activeTab === 'playlists' && (
        <div className="space-y-3">
          {selectedPlaylistId === null ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">
                  {playlists?.length ?? 0} playlists
                </span>
                {showNewPlaylistInput ? (
                  <div className="flex items-center gap-2">
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
                      className="text-sm bg-black/30 border border-white/10 rounded px-2 py-1 text-white placeholder-gray-500 focus:outline-none focus:border-dashboard-accent w-36"
                    />
                    <button
                      onClick={handleCreatePlaylist}
                      disabled={!newPlaylistName.trim() || createPlaylistMutation.isPending}
                      className="text-sm text-dashboard-accent hover:opacity-80 disabled:opacity-40"
                    >
                      {createPlaylistMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
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
                      <div className="w-10 h-10 bg-dashboard-accent/20 rounded flex items-center justify-center flex-shrink-0">
                        <Music2 className="w-5 h-5 text-dashboard-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{pl.name}</p>
                        <p className="text-gray-400 text-xs">{pl.songs?.length ?? 0} songs</p>
                      </div>
                      <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Music2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No saved playlists yet</p>
                  <p className="text-xs mt-1 opacity-60">Create one to organise your songs</p>
                </div>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => setSelectedPlaylistId(null)}
                className="text-sm text-dashboard-accent hover:opacity-80 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to playlists
              </button>
              <p className="text-white font-medium">{selectedPlaylist?.name}</p>
              <PlaylistTable
                songs={(selectedPlaylist?.songs ?? []) as Song[]}
                showControls={false}
                showReorderControls={false}
              />
            </>
          )}
        </div>
      )}

      {/* Search Tab */}
      {activeTab === 'search' && (
        <SearchSongs
          guestUrl={guestUrl ?? undefined}
          onSongsAdded={() => {}}
          onSongsAddedCallback={async () => {
            queryClient.invalidateQueries({ queryKey: ['tunes-playlist', guestUrl] });
          }}
        />
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-white font-medium mb-1">Guest Controls</h3>
            <p className="text-gray-400 text-sm">Manage what guests can do on your page.</p>
          </div>

          <div className="space-y-2">
            {([
              { key: 'allowSongRequests' as const, label: 'Allow song requests', desc: 'Guests can add songs to your queue' },
              { key: 'allowGuestPlayOnDevice' as const, label: 'Guest playback on device', desc: 'Guests can play music on their own device' },
              { key: 'allowPlaylistSharing' as const, label: 'Allow playlist sharing', desc: 'Guests can share your playlist link' },
              { key: 'allowRecentlyPlayedVisibility' as const, label: 'Show recently played', desc: "Guests can see songs you've played" },
            ]).map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between gap-4 p-3 bg-black/20 rounded-lg">
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

          {/* Guest link */}
          {guestUrl && (
            <div className="mt-2 p-4 bg-black/20 rounded-lg">
              <p className="text-white text-sm font-medium mb-2">Guest page link</p>
              <p className="text-gray-400 text-xs break-all font-mono">{guestPageUrl}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(guestPageUrl);
                  toast.success('Link copied!');
                }}
                className="mt-2 text-xs text-dashboard-accent hover:opacity-80"
              >
                Copy link
              </button>
            </div>
          )}

          <div className="pt-1">
            <a
              href={`${import.meta.env.VITE_LOCAL_TUNES_API_URL || 'https://localtunes.earth'}/auth?tab=login`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-400"
            >
              Open full Local Tunes dashboard →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
