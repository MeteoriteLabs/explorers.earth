// Music-related TypeScript interfaces for playlist management

export interface Song {
  id: number;
  youtubeId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  position: number;
  status: 'queued' | 'playing' | 'played';
  playedAt?: Date;
}

export interface User {
  id: number;
  venueName: string;
  theme: { primary: string };
  allowSongRequests: boolean;
  allowGuestPlayOnDevice: boolean;
  allowPlaylistSharing: boolean;
  allowRecentlyPlayedVisibility: boolean;
}

export interface Playlist {
  id: number;
  name: string;
  description?: string;
  isVisibleToGuests: boolean;
  songs: Song[];
}

export interface PlaylistResponse {
  songs: Song[];
  user: User;
  currentlyPlaying?: Song;
  playedSongs: Song[];
  allowGuestPlayOnDevice: boolean;
  playlists?: Playlist[];
}

export interface YouTubeSearchResult {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: string;
}

export interface YouTubeSearchResponse {
  results: YouTubeSearchResult[];
  nextPageToken?: string;
}

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  isRepeating: boolean;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
  duration?: number;
}
