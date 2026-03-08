import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '../store/store';
import { syncLocalTunesUser } from '../services/localTunesService';
import { localTunesRequest } from '../lib/apiClient';

export interface TunesLocalUser {
  id: number;
  username: string;
  email: string;
  guestUrl: string;
  venueName?: string;
  allowSongRequests?: boolean;
  allowGuestPlayOnDevice?: boolean;
  allowPlaylistSharing?: boolean;
  allowRecentlyPlayedVisibility?: boolean;
  subscriptionPlan?: string;
}

export interface TunesDashboardData {
  localUser: TunesLocalUser | null;
  guestUrl: string | null;
  playlists: any[] | null;
  playlist: { songs: any[]; currentlyPlaying?: any; playedSongs: any[] } | null;
  isLoading: boolean;
  error: string | null;
}

export function useTunesDashboard(): TunesDashboardData {
  const { user } = useAuthStore();
  const [localUser, setLocalUser] = useState<TunesLocalUser | null>(null);
  const [guestUrl, setGuestUrl] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setIsSyncing(true);
    setSyncError(null);
    syncLocalTunesUser({ id: user.id, username: user.username, email: user.email })
      .then((result) => {
        if (result.success && result.user) {
          setLocalUser(result.user as TunesLocalUser);
          setGuestUrl(result.user.guestUrl);
        } else {
          setSyncError(result.message || 'Failed to sync with Local Tunes');
        }
      })
      .catch((err: any) => setSyncError(err.message || 'Connection failed'))
      .finally(() => setIsSyncing(false));
  }, [user?.id]);

  const { data: playlists = null } = useQuery<any[]>({
    queryKey: ['tunes-playlists', user?.username],
    queryFn: () => localTunesRequest('GET', `/api/playlists?username=${user?.username}`),
    enabled: !!user?.username && !!localUser,
  });

  const { data: playlist = null } = useQuery<{ songs: any[]; currentlyPlaying?: any; playedSongs: any[] }>({
    queryKey: ['tunes-playlist', guestUrl],
    queryFn: () => localTunesRequest('GET', `/api/playlist/${guestUrl}`),
    enabled: !!guestUrl,
    refetchInterval: 5000,
    staleTime: 2000,
    refetchOnWindowFocus: false,
  });

  return {
    localUser,
    guestUrl,
    playlists,
    playlist,
    isLoading: isSyncing,
    error: syncError,
  };
}
