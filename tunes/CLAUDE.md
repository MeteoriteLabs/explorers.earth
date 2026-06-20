# tunes

Real-time collaborative music playlist management platform for venues. Venue owners manage playlists, guests request songs and interact with music via shareable URLs/QR codes. Full-stack app with WebSocket synchronization.

## Tech Stack

**Frontend**: React 18 + TypeScript, Vite 5.4, shadcn/ui + Radix UI, TanStack Query v5, Zustand, Socket.IO client, YouTube IFrame Player, Tailwind CSS, Wouter (routing)
 
**Backend**: Express.js 4.21 + TypeScript, Socket.IO 4.8 (WebSocket), Passport.js (auth), express-session + connect-pg-simple (sessions)

**Database**: PostgreSQL + Drizzle ORM 0.39 (@neondatabase/serverless for connection)

**Integrations**: YouTube Data API v3, Spotify API (import), Razorpay (payments), AWS SES (email), Google Gemini (AI), Nodemailer, Puppeteer

## Directory Structure

```
client/src/
├── pages/              # Route pages
│   ├── auth-page.tsx           # Login/register
│   ├── dashboard-page.tsx      # Main player dashboard
│   ├── playlist-page.tsx       # Playlist management
│   ├── settings-page.tsx       # Venue settings
│   ├── AdminDashboard.tsx      # Super admin panel
│   └── tabs/                   # Dashboard tab components
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── bottom-navigation.tsx   # Mobile nav
│   └── connection-status.tsx   # WebSocket status indicator
├── hooks/
│   └── use-websocket.tsx       # Socket.IO hook (core real-time logic)
├── stores/
│   └── authStore.ts            # Auth state (Zustand + TanStack Query)
├── lib/                        # Utilities (queryClient, utils)
└── types/                      # TypeScript definitions

server/
├── index.ts            # Express app entry point, Vite middleware, server startup
├── auth.ts             # Passport.js config, session setup, login/register logic
├── jwt-auth-middleware.ts # JWT validation middleware (dual auth: session + JWT)
├── legacy-routes.ts    # Legacy playlist/user routes with multi-auth fallback
├── storage.ts          # Database access layer (all DB queries)
├── db.ts               # Drizzle + Neon connection setup
├── swagger.ts          # OpenAPI spec (served at /api-docs)
├── routes/
│   ├── index.ts                # Route registration
│   ├── authRoutes.ts           # Auth endpoints
│   ├── playlistRoutes.ts       # Playlist CRUD + WebSocket setup
│   ├── adminRoutes.ts          # Admin panel endpoints
│   ├── youtubeRoutes.ts        # YouTube search
│   ├── paymentRoutes.ts        # Razorpay webhooks
│   ├── emailRoutes.ts          # Email templates & sending
│   ├── geminiRoutes.ts         # AI recommendations
│   ├── instagramRoutes.ts      # Instagram webhooks
│   ├── strapiRoutes.ts         # Strapi CMS sync
│   ├── subscriptionRoutes.ts   # Subscription management
│   ├── pageRoutes.ts           # CMS page content
│   ├── reactivationRoutes.ts   # Account reactivation endpoints
│   └── legacyRemainingRoutes.ts # Consolidated legacy endpoints
├── controllers/                # Business logic controllers
├── services/
│   ├── email-service.ts        # AWS SES email delivery
│   ├── gemini-service.ts       # Google Gemini AI
│   ├── reactivation-service.ts # Account reactivation logic/service
│   ├── spotify-playlist-import.ts # Spotify playlist import
│   ├── strapi-service.ts       # Strapi CMS integration
│   ├── system-settings-service.ts # App-wide config
│   ├── youtube-playlist-import.ts # YouTube playlist import
│   └── user-sync-service.ts    # User data sync
└── utils/

shared/
└── schema.ts           # Drizzle ORM schema (SINGLE SOURCE OF TRUTH for DB)
```

## Database

**Schema**: `shared/schema.ts` — all tables defined with Drizzle ORM + Zod validation schemas.

**Key tables**:
- `users` — Accounts with venue settings, theme, feature toggles, admin flag
- `playlists` — User playlists with guest visibility
- `playlist_songs` — Songs in playlists (youtube ID, title, artist, position)
- `songs` — Active queue songs with play status (queued/playing/played)
- `played_songs` — Play history
- `user_sessions` — Session tracking with geolocation
- `user_profiles` — Extended profile (address, social links, phone)
- `guest_interactions` — Guest activity tracking
- `api_tokens` — API auth tokens with scopes
- `team_members` — Account managers with regional assignments
- `email_templates` / `email_logs` — Email system
- `page_contents` / `seo_settings` — CMS content
- `system_settings` — Key-value app config

**Commands**:
```bash
npm run db:push          # Push schema to database
```

## Authentication

**Dual auth system** (session-based + JWT):
- **Session auth**: Passport.js local strategy (username/password, scrypt hashing), express-session with PostgreSQL store, 7-day cookie
- **JWT auth**: `jwt-auth-middleware.ts` validates Strapi JWT tokens for cross-app SSO from explorers-earth. Maps Strapi user → Neon DB user via `X-Username` header
- Email verification with tokens + OTP support
- Self-service account reactivation via magic link email (24-hour expiration token, self-seeding template)
- Role-based: admin (isAdmin flag), venue owner, guest (via URL)
- Protected routes: `requireAuth` / `requireAnyAuth` middleware (supports both session and JWT)
- CORS: `ALLOWED_ORIGINS` env var controls allowed origins, `X-CSRF-Token` and `X-Username` headers supported

## WebSocket (Socket.IO)

- Server setup in `server/routes/playlistRoutes.ts`
- Client hook in `client/src/hooks/use-websocket.tsx`
- Rooms: one per user ID for playlist synchronization
- Key events: playlist updates, song status changes, feature toggle sync, guest activity

## API

- REST endpoints under `/api/` — see Swagger docs at `/api-docs`
- Key route groups: auth, playlists, admin, youtube, payment, email, gemini
- Pattern: routes -> (optional controller) -> storage/service layer

## Common Tasks

**Add a new API route:**
1. Create `server/routes/newRoute.ts`
2. Register in `server/routes/index.ts`
3. Add DB queries in `server/storage.ts`
4. Add Swagger docs in `server/swagger.ts`

**Add a new database table:**
1. Define table + insert schema in `shared/schema.ts`
2. Export types at bottom of schema file
3. Run `npm run db:push` to sync
4. Add storage methods in `server/storage.ts`

**Add a WebSocket event:**
1. Define event handler in `server/routes/playlistRoutes.ts` (socket.on)
2. Add client handler in `client/src/hooks/use-websocket.tsx`

## Environment Variables for tunes

See `docs/environment-variables.md`. Key variables:
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — Express session secret
- `YOUTUBE_API_KEY` — YouTube Data API
- `EMAIL_HOST/USER/PASS` — SMTP for verification emails
- `STRAPI_URL` / `STRAPI_ACCESS_TOKEN` — CMS connection

## Running

```bash
npm run dev      # Start dev server (frontend + backend on port 5000)
npm run build    # Build for production (vite build + esbuild server)
npm run start    # Run production build
npm run check    # TypeScript type check
```

## Superpower Skills

Your personal library of proven techniques, patterns, and tools is at `D:\superpowers\skills\`.
Before executing any tasks, always check for relevant skills under the `D:\superpowers\skills\` directory. For instructions on finding and executing skills, refer to `D:\superpowers\skills\using-superpowers\SKILL.md`. Always run verification commands and apply TDD/plan-writing skills where applicable.
