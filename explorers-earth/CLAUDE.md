# explorers-earth

Multi-media recommendation and QR code sharing platform. Users create curated lists of favorite places, movies, books, and games, generate QR codes, and share them socially.

## Tech Stack

- React 18 + TypeScript + Vite 6.4
- Tailwind CSS + Radix UI + Framer Motion
- Apollo Client 3.12 (GraphQL) + React Query + Zustand
- React Router DOM 7.12
- Google Maps API (@react-google-maps/api, @vis.gl/react-google-maps)
- i18n (react-i18next)
- Formik/React Hook Form + Yup/Zod (forms)
- Cloudflare Turnstile (@marsidev/react-turnstile) for bot protection
- qrcode.react (QR generation)

## Backend

External Strapi CMS accessed via GraphQL. No backend code in this project.
- GraphQL endpoint configured via `VITE_API_URL`
- REST endpoint for uploads via `VITE_REST_API_URL`
- Auth: JWT tokens stored in localStorage, Google OAuth

## Directory Structure

```
src/
├── features/           # Feature-based modules (main app logic)
│   ├── Authentication/ # Login, register, password reset, Google OAuth, onboarding
│   ├── Profile/        # User profiles, photos, bio, social links
│   ├── Favorites/      # Location recommendations, ratings, notes
│   ├── Movies/         # Curated lists of favorite movies
│   ├── Books/          # Curated lists of favorite books
│   ├── Games/          # Curated lists of favorite games
│   ├── Guides/         # AI-powered guide generation
│   ├── Analytics/      # Usage tracking and dashboards
│   ├── Settings/       # User preferences and account settings
│   ├── LandingPage/    # Marketing/home page
│   └── PublicHome/     # Public-facing recommendation pages
├── components/         # Shared UI components
│   ├── MusicDashboard.tsx      # Embedded tunes player dashboard (major component)
│   ├── AuthSyncManager.tsx     # Background SSO sync with Local Tunes
│   ├── Header.tsx / Navbar.tsx # Navigation
│   ├── InteractiveMap.tsx      # Google Maps component
│   ├── ImageCropper.tsx        # Image crop utility
│   └── ui/             # Radix UI primitive wrappers
├── pages/              # Route-level page components
│   ├── Music.tsx       # Music page (renders MusicDashboard)
│   ├── ReactivateAccount.tsx # Request account reactivation magic link page
│   ├── ReactivateConfirm.tsx # Confirm account reactivation page
│   └── public/         # Public (unauthenticated) pages
├── hooks/              # Custom hooks
│   ├── useTunesDashboard.ts    # Local Tunes data fetching + user sync
│   ├── useProfileWalkthrough.ts
│   ├── useRecommendationsWalkthrough.ts
│   ├── useQRActions.tsx
│   ├── useAIGuideQuota.ts
│   └── useToast.ts
├── lib/
│   └── apiClient.ts    # Local Tunes API client (JWT auth, CSRF, retry logic)
├── store/              # Zustand global state
│   ├── store.ts        # Main app store (auth, user data)
│   ├── useCityStore.ts # Selected city state
│   ├── useEmailStore.ts# Email composition state
│   └── useSetupStore.ts# Onboarding setup state
├── services/           # API service functions
│   ├── ssoService.ts           # Cross-app SSO with Local Tunes
│   ├── aiGuideService.ts       # AI guide generation
│   ├── analyticsService.ts     # Analytics tracking
│   ├── geminiService.ts        # Google Gemini AI integration
│   ├── instagramService.ts     # Instagram integration
│   ├── localTunesService.ts    # Local Tunes API communication
│   ├── paymentService.ts       # Payment processing
│   ├── requestTrackingService.ts # Request tracking
│   └── subscriptionService.ts  # Subscription management
├── utils/              # Utility functions
├── types/              # TypeScript type definitions
├── routes/             # React Router configuration
├── layouts/            # Page layout wrappers
├── contexts/           # React Context providers
├── config/             # App configuration
├── i18n/               # Internationalization files
└── assets/             # Static assets (icons, images)
```

## State Management

- **Zustand**: Global app state (auth, cities, email, setup wizard)
- **Apollo Client**: Server state via GraphQL. Handles caching, optimistic updates
- **React Query**: Additional async operations
- **React Context**: QR actions, media viewer

## Key Patterns

- Feature modules are self-contained with their own components, hooks, and logic
- Protected routes via `ProtectedRoute` component checking JWT validity
- Image handling: multi-source (uploads, Google Places, custom search) with cropping/compression
- QR codes generated dynamically with qrcode.react, exportable as PNG
- Maps: Google Maps with custom markers, clustering, geocoding

## Cross-App SSO (Local Tunes Integration)

explorers-earth has deep integration with tunes via SSO:
- `AuthSyncManager.tsx` runs background sync after login (skips public pages and onboarding, fires once per session)
- `ssoService.ts` handles the full SSO flow: authenticate with tunes API, extract guestUrl, store cross-domain auth data
- `apiClient.ts` sends JWT + `X-Username` header for Strapi → Neon DB user mapping
- `useTunesDashboard.ts` syncs Strapi user with tunes DB and fetches playlist data
- `MusicDashboard.tsx` renders embedded music player with queue, playlists, guest controls
- **Account Reactivation Flow**: `ReactivateAccount.tsx` and `ReactivateConfirm.tsx` pages handle unblocking deactivated Strapi accounts by calling tunes endpoints (`/api/user/request-reactivation` and `/api/user/reactivate`).

## Common Tasks

**Add a new feature module:**
1. Create folder under `src/features/NewFeature/`
2. Add components, hooks, and logic inside
3. Add route in `src/routes/`
4. Add navigation link in `src/components/Navbar.tsx`

**Add a new Zustand store:**
1. Create `src/store/useNewStore.ts`
2. Export typed hooks using `create()` from zustand

**Add a GraphQL query/mutation:**
1. Define in the component using `gql` tag
2. Use `useQuery` or `useMutation` from Apollo Client

## Environment Variables

See `docs/environment-variables.md` for the complete list. Key variables:
- `VITE_API_URL` — GraphQL API endpoint (Strapi)
- `VITE_REST_API_URL` — REST API endpoint
- `VITE_GOOGLE_MAPS_API_KEY` — Google Maps
- `VITE_LOCAL_TUNES_API_URL` — Local Tunes integration endpoint

## Deployment strategy

Netlify. Config in `netlify.toml`. Build: `npm run build` (runs generate-static + tsc + vite build)
