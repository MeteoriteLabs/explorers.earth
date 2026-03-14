# explorers-earth — Integrations

## Google Maps API

The core location integration. Uses multiple Google Maps services.

### Services Used

| Service | Purpose | Library |
|---------|---------|---------|
| Maps JavaScript API | Interactive map rendering | `@vis.gl/react-google-maps`, `@react-google-maps/api` |
| Places API | Place details, photos, autocomplete | via Maps JavaScript API |
| Geocoding API | Address ↔ coordinates conversion | via Maps JavaScript API |

### Configuration

- `VITE_GOOGLE_MAPS_API_KEY` env var
- Enable Maps JavaScript API, Places API, and Geocoding API in Google Cloud Console

### Usage Patterns

**Interactive maps**: `InteractiveMap` component renders maps with custom markers and clustering for location visualization.

**Place search**: Google Places autocomplete for finding and adding new locations.

**Geocoding**: Converts addresses to coordinates for map placement, and coordinates to readable addresses for display.

**Place photos**: Fetches place photos from Google Places for recommendation displays.

## Strapi CMS

External headless CMS that serves as the backend for all data operations.

### Connection

- **GraphQL**: Primary data access via Apollo Client
  - Endpoint: `VITE_API_URL` (proxied through Netlify in production)
  - Used for: CRUD operations on users, places, lists, recommendations
- **REST**: Used for file uploads
  - Endpoint: `VITE_REST_API_URL`
  - Used for: Image uploads, media management

### Authentication with Strapi

- Strapi provides JWT tokens on login/register
- Tokens stored in localStorage
- Sent as Bearer token in Authorization header
- `VITE_PUBLIC_ACCESS_TOKEN` for public API access (unauthenticated content)

## Google OAuth

Single sign-on via Google accounts.

### Flow

1. User clicks "Sign in with Google"
2. Google OAuth consent screen opens
3. User authorizes the application
4. Google returns an auth code/token
5. Token is sent to Strapi for verification
6. Strapi creates/links the user account and returns a JWT

## Google Custom Search API

**Purpose**: Image search for enriching location recommendations.

**Configuration**:
- `VITE_GOOGLE_CUSTOM_SEARCH_API_KEY` — API key
- `VITE_GOOGLE_CUSTOM_SEARCH_ENGINE_ID` — Custom search engine ID

**Usage**: When users want to add photos to a place recommendation, they can search for images via Google Custom Search as an alternative to uploading their own.

## Google Analytics (GA4)

**Purpose**: Usage tracking and analytics.

**Library**: `react-ga4`

**Usage**: Tracks page views, user interactions, and feature engagement. Initialized in the app root and fires events throughout the application.

## Razorpay

**Purpose**: Payment processing for premium features.

**Usage**: Client-side Razorpay checkout integration for subscription payments. Payment verification is handled server-side.

## Local Tunes Integration (Cross-App SSO)

**Purpose**: Deep cross-app integration connecting explorers-earth with the tunes music platform. Users get an embedded music dashboard within explorers-earth.

**Configuration**:
- `VITE_LOCAL_TUNES_API_URL` — tunes API endpoint
- `VITE_LOCAL_TUNES_ENABLED` — Enable/disable integration
- `VITE_LOCAL_TUNES_TIMEOUT` — API timeout in ms (default 60s, 5 min for imports)
- `VITE_LOCAL_TUNES_RETRY_ATTEMPTS` — Retry count

**Key Files**:
- `src/lib/apiClient.ts` — API client with JWT auth, CSRF tokens, retry logic with exponential backoff
- `src/services/ssoService.ts` — Full SSO flow (authenticate, extract guestUrl, cross-domain auth storage)
- `src/components/AuthSyncManager.tsx` — Background SSO sync after login
- `src/components/MusicDashboard.tsx` — Embedded music player dashboard
- `src/hooks/useTunesDashboard.ts` — Data fetching hook (syncs Strapi user → tunes DB)

**SSO Flow**:
1. User logs in to explorers-earth (Strapi JWT)
2. `AuthSyncManager` triggers post-login sync (once per session, skips public pages and onboarding)
3. `ssoService.performLocalTunesSSO()` authenticates with tunes API using Strapi JWT
4. tunes server validates JWT via `jwt-auth-middleware.ts`, maps user via `X-Username` header
5. Guest URL and auth data are stored for cross-domain access
6. `MusicDashboard` renders embedded player with full playlist management

**Authentication**:
- JWT token sent in `Authorization: Bearer <token>` header
- `X-Username` header maps Strapi user to tunes Neon DB user
- CSRF token support via `X-CSRF-Token` header
- Cross-domain auth data stored in localStorage/sessionStorage

## Integration Architecture

```
explorers-earth Client
  ├── Apollo Client ────── GraphQL ──── Strapi CMS (data + auth)
  ├── Axios ────────────── REST ─────── Strapi CMS (uploads)
  ├── Google Maps SDK ──────────────── Google Cloud (maps, places, geocoding)
  ├── Google OAuth ─────────────────── Google Cloud (auth)
  ├── Google Custom Search ─────────── Google Cloud (images)
  ├── react-ga4 ────────────────────── Google Analytics
  ├── Razorpay SDK ─────────────────── Razorpay (payments)
  └── apiClient + SSO ──── JWT+REST ── tunes API (music, playlists, SSO)
```
