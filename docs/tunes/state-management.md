# tunes — State Management

## Overview

tunes uses three complementary state management approaches:

| Layer | Tool | Purpose |
|-------|------|---------|
| Server state | TanStack Query v5 | API data fetching, caching, mutations |
| Client state | Zustand | Auth state, UI state |
| Real-time state | Socket.IO | Live playlist sync, player state |

## TanStack Query v5

Primary tool for all REST API data fetching and mutations.

**Setup**: Query client configured in `client/src/lib/queryClient.ts`

### Patterns

**Fetching data**:
```typescript
// Fetch playlists with automatic caching and refetching
const { data, isLoading } = useQuery({
  queryKey: ['playlists'],
  queryFn: () => fetch('/api/playlists').then(r => r.json())
});
```

**Mutations with cache invalidation**:
```typescript
const mutation = useMutation({
  mutationFn: (newSong) => fetch(`/api/playlists/${id}/songs`, {
    method: 'POST',
    body: JSON.stringify(newSong)
  }),
  onSuccess: () => {
    // Invalidate and refetch playlists after adding a song
    queryClient.invalidateQueries({ queryKey: ['playlists'] });
  }
});
```

### Key Query Keys

| Key | Data |
|-----|------|
| `['user']` | Current authenticated user |
| `['playlists']` | All user playlists |
| `['playlist', id]` | Single playlist with songs |
| `['history']` | Play history |
| `['admin', 'users']` | Admin user list |
| `['admin', 'statistics']` | Platform statistics |

## Zustand

Used for client-only state that doesn't come from the server.

### Auth Store (`client/src/stores/authStore.ts`)

```typescript
// Manages authentication state
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}
```

The auth store works alongside TanStack Query — Zustand holds the immediate auth state while TanStack Query manages the user data fetching.

## Socket.IO (Real-time State)

Real-time state is managed through the WebSocket hook (`client/src/hooks/use-websocket.tsx`).

### How Real-time State Stays in Sync

1. **Initial load**: Client fetches data via REST API (TanStack Query)
2. **WebSocket connection**: Client connects and joins user's room
3. **Server events**: When playlist/player changes occur, server broadcasts to the room
4. **Client updates**: WebSocket event handlers invalidate TanStack Query caches or update local state directly
5. **Optimistic updates**: Some actions update the UI immediately before the server confirms

### Event → State Flow

```
Server broadcasts event
    ↓
use-websocket.tsx receives event
    ↓
Event handler either:
  ├── Invalidates TanStack Query cache → triggers refetch → UI updates
  └── Updates local state directly → UI updates immediately
```

### Key Socket Events and Their State Effects

| Event | State Effect |
|-------|-------------|
| `PLAYLIST_STATE` | Replaces playlist cache in TanStack Query |
| `PLAYER_UPDATE` | Updates player status (local state) |
| `FEATURE_STATE` | Updates feature toggle state |
| `GUEST_ACTIVITY` | Updates guest count and activity feed |

## Data Flow Summary

```
REST API ──→ TanStack Query (cache) ──→ React Components
                ↑ invalidation
Socket.IO ──────┘

User Actions ──→ Zustand Store ──→ React Components
                     │
                     └──→ REST API / Socket.IO emit
```

## Key Files

| File | Purpose |
|------|---------|
| `client/src/lib/queryClient.ts` | TanStack Query configuration |
| `client/src/stores/authStore.ts` | Zustand auth store |
| `client/src/hooks/use-websocket.tsx` | Socket.IO state management |
