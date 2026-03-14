# tunes — WebSocket Protocol

## Overview

tunes uses Socket.IO for real-time communication between the server and connected clients. WebSocket connections enable live playlist updates, player state synchronization, and guest activity tracking without polling.

## Connection Setup

**Server**: WebSocket handling is initialized in `server/routes/playlistRoutes.ts` alongside the playlist REST routes.

**Client**: The `client/src/hooks/use-websocket.tsx` hook manages the Socket.IO connection, event listeners, and reconnection logic.

### Connection Flow

1. Client authenticates via REST API (login/session)
2. Client establishes Socket.IO connection to the server
3. Server authenticates the WebSocket connection using the session
4. Client joins a "room" keyed by the user's ID
5. All events for that user are broadcast to their room
6. Guests connect to the host's room via the guest URL

## Rooms

Each authenticated user has a Socket.IO room identified by their user ID. This ensures:
- All of a host's connected devices receive updates
- Guest connections join the host's room
- Events are scoped — no cross-user leakage

## Client → Server Events

### Playlist Management

```typescript
// Update playlist state (add, remove, move, play, skip songs)
{
  type: 'PLAYLIST_UPDATE',
  payload: {
    playlistId: number,
    songId: number,
    action: 'add' | 'remove' | 'move' | 'play' | 'skip',
    position?: number       // For 'move' action
  }
}
```

### Feature Toggles

```typescript
// Toggle venue features on/off
{
  type: 'FEATURE_TOGGLE',
  payload: {
    feature: 'songRequests' | 'guestPlay' | 'playlistSharing' | 'recentlyPlayedVisibility',
    enabled: boolean
  }
}
```

### Player State

```typescript
// Sync player state across devices
{
  type: 'PLAYER_STATE',
  payload: {
    action: 'play' | 'pause' | 'seek' | 'stop',
    position?: number,       // Seek position in seconds
    youtubeId?: string       // Currently playing song
  }
}
```

### Guest Actions

```typescript
// Guest interactions (join, leave, request songs)
{
  type: 'GUEST_ACTION',
  payload: {
    action: 'request_song' | 'join' | 'leave',
    songData?: {             // For 'request_song'
      youtubeId: string,
      title: string,
      artist: string,
      thumbnailUrl: string,
      duration: number
    },
    guestInfo?: {            // For 'join'
      name: string,
      deviceInfo: string
    }
  }
}
```

## Server → Client Events

### Playlist State (Full Sync)

```typescript
// Complete playlist state broadcast
{
  type: 'PLAYLIST_STATE',
  payload: {
    playlists: Array<{
      id: number,
      name: string,
      isDefault: boolean,
      isVisibleToGuests: boolean,
      songs: Array<{
        id: number,
        youtubeId: string,
        title: string,
        artist: string,
        thumbnailUrl: string,
        duration: number,
        position: number,
        addedBy: string
      }>
    }>,
    currentlyPlaying: {
      playlistId: number,
      songId: number,
      youtubeId: string,
      title: string,
      artist: string,
      position: number,
      currentTime: number
    } | null,
    playHistory: Array<{
      youtubeId: string,
      title: string,
      artist: string,
      playedAt: string
    }>
  }
}
```

### Player Updates

```typescript
// Player state changes
{
  type: 'PLAYER_UPDATE',
  payload: {
    status: 'playing' | 'paused' | 'ended' | 'buffering' | 'error',
    currentTime: number,
    duration: number,
    youtubeId: string | null,
    playlistId: number | null,
    songId: number | null
  }
}
```

### Feature State

```typescript
// Current feature toggle states
{
  type: 'FEATURE_STATE',
  payload: {
    songRequests: boolean,
    guestPlay: boolean,
    playlistSharing: boolean,
    recentlyPlayedVisibility: boolean
  }
}
```

### Guest Activity

```typescript
// Guest presence and activity updates
{
  type: 'GUEST_ACTIVITY',
  payload: {
    guestCount: number,
    recentActivity: Array<{
      action: 'join' | 'leave' | 'request_song',
      guestName: string | null,
      timestamp: string,
      details?: string
    }>
  }
}
```

## Reconnection

Socket.IO handles reconnection automatically with exponential backoff. The client hook (`use-websocket.tsx`) manages:

- Connection status display via `connection-status.tsx` component
- Re-joining the user's room after reconnection
- Re-fetching playlist state on reconnect to ensure consistency

## Key Files

| File | Purpose |
|------|---------|
| `server/routes/playlistRoutes.ts` | Server-side Socket.IO event handlers and room management |
| `client/src/hooks/use-websocket.tsx` | Client-side Socket.IO hook with event handling |
| `client/src/components/connection-status.tsx` | WebSocket connection status UI indicator |
