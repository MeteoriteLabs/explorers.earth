# explorers-earth — State Management

## Overview

explorers-earth uses multiple state management layers, each for a specific purpose:

| Layer | Tool | Purpose |
|-------|------|---------|
| Server state | Apollo Client | GraphQL data fetching, caching, mutations |
| Server state | React Query | Additional async operations |
| Client state | Zustand | Global app state (auth, UI) |
| Local state | React Context | Scoped feature state |

## Zustand Stores

Zustand manages lightweight global state that doesn't come from the server.

### Main Store (`src/store/store.ts`)
Core app state including authentication status, current user data, and global UI state.

### City Store (`src/store/useCityStore.ts`)
Tracks the currently selected city for location filtering and organization.

```typescript
// Manages city selection state
interface CityStore {
  selectedCity: City | null;
  setSelectedCity: (city: City) => void;
  clearCity: () => void;
}
```

### Email Store (`src/store/useEmailStore.ts`)
Manages email composition state for sharing recommendations.

### Setup Store (`src/store/useSetupStore.ts`)
Tracks onboarding wizard progress for new users.

## Apollo Client (GraphQL)

Primary data layer for all Strapi CMS communication.

### Configuration

Apollo Client is configured with:
- GraphQL endpoint from `VITE_API_URL`
- Authorization header with JWT from localStorage
- In-memory cache for query result caching

### Patterns

**Queries**: Fetch data from Strapi with automatic caching.
```typescript
const { data, loading } = useQuery(GET_PLACES, {
  variables: { userId, city }
});
```

**Mutations**: Create/update/delete data with cache updates.
```typescript
const [addPlace] = useMutation(ADD_PLACE, {
  refetchQueries: [{ query: GET_PLACES }]
});
```

**Cache management**: Apollo automatically caches query results by query + variables. Cache is updated on mutations via:
- `refetchQueries` — Re-runs specified queries after mutation
- `update` function — Directly modifies cache entries
- Cache policies — Controls how cached data is used vs refetched

## React Query

Used alongside Apollo Client for non-GraphQL async operations (REST endpoints, external APIs).

### When to Use Which

| Data Source | Tool | Why |
|-------------|------|-----|
| Strapi CMS (GraphQL) | Apollo Client | Native GraphQL support, normalized cache |
| REST APIs (uploads, external services) | React Query | Better for REST, simpler API |
| tunes API integration | React Query | REST-based cross-app calls |

## React Context

Used for scoped state shared between related components without global reach.

### QR Actions Context
Manages QR code generation, download, and sharing actions. Provides methods to components within the QR feature flow.

### Media Viewer Context
Controls the image/media viewer modal state — which media is displayed, zoom level, navigation between images.

## Data Flow

```
Strapi CMS
    │ GraphQL
    ▼
Apollo Client Cache ──→ React Components
    ↑
    └── Mutations (with cache invalidation)

REST APIs
    │
    ▼
React Query Cache ──→ React Components

User Interactions
    │
    ▼
Zustand Stores ──→ React Components
    │
    └── Persist across routes (no refetch needed)

Feature-scoped State
    │
    ▼
React Context ──→ Descendant Components
```

## Key Files

| File | Purpose |
|------|---------|
| `src/store/store.ts` | Main Zustand store |
| `src/store/useCityStore.ts` | City selection state |
| `src/store/useEmailStore.ts` | Email composition state |
| `src/store/useSetupStore.ts` | Onboarding wizard state |
| `src/contexts/` | React Context providers |
| Apollo Client setup | In app initialization code |
