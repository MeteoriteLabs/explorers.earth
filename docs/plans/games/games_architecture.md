---
Feature: games
Doc type: architecture
Status: draft
Created: 2026-03-26
Last updated: 2026-03-26
Updated by: agent
Depends on: games_schema.md, games_api_contract.md, UI_UX_Implementation.md
---

# Games Feature Architecture

## Overview

The Games feature extends explorers.earth with creator-managed game recommendations. Creators curate custom lists, add personal notes and ratings, mark top picks, and share with visitors. Visitors browse public lists by creator, genre, or featured recommendations.

This document follows the exact same pattern established by Movies & Shows and Books features.

### UI/UX Standards
All components must adhere to the [UI/UX Implementation Guide](./UI_UX_Implementation.md). Key constraints include:
- **Blue Theme**: Always use dashboard blue accent variables (`var(--dash-accent)`).
- **Layout**: Add `pb-32` or `pb-40` to main containers to prevent content being hidden behind fixed dashboard navigation.
- **Interactive**: Use the `Switch` component for Published/Draft toggles.

### Critical Architecture Difference from Books/Movies
> [!IMPORTANT]
> IGDB API requires a **server-side Twitch OAuth secret** that cannot be exposed in the frontend. All IGDB calls go through a **Strapi proxy route** (`/api/igdb-proxy/*`), not directly from the frontend. The `igdbService.ts` module calls the Strapi proxy, not IGDB directly.

---

## 1. Feature Module Structure

```
src/features/Games/
├── api/
│   ├── query.ts              — GraphQL queries (lists, games, genres)
│   └── mutation.ts           — GraphQL mutations (CRUD operations)
├── components/
│   ├── dashboard/            — Creator dashboard (protected routes)
│   │   ├── GamesHome.tsx             — Main games dashboard view
│   │   ├── GameListView.tsx          — Single list detail + game management
│   │   ├── GameRow.tsx               — Draggable game row in list
│   │   ├── GameListManage.tsx        — Settings, QR, delete, sharing
│   │   ├── CreateGameListModal.tsx   — Create new list modal
│   │   ├── AddGamePage.tsx           — Page to add/edit game in list (IGDB search)
│   │   ├── IgdbSearch.tsx            — IGDB autocomplete search component (via proxy)
│   │   └── TopPicksManager.tsx       — Pin/feature top picks manager
│   └── public/               — Visitor-facing components
│       ├── PublicGames.tsx           — Public games landing page
│       ├── GameCarouselRow.tsx       — Horizontal scrollable cover carousel
│       ├── GameCoverCard.tsx         — Cover + metadata compact card
│       ├── GameCoverSkeleton.tsx     — Loading skeleton
│       ├── GameDetailModal.tsx       — Slide-up game detail view
│       ├── PublicGameList.tsx        — List grid page for single list
│       ├── PublicGameGenre.tsx       — Genre grid page
│       └── GenreBrowse.tsx          — Genre selection / discovery
├── hooks/
│   ├── useGameLists.ts               — Fetch creator's game lists
│   ├── useGamesByList.ts             — Fetch games in specific list
│   ├── usePinnedGames.ts             — Fetch top picks across all lists
│   ├── useGameDetail.ts              — Fetch single game details
│   ├── useIgdbSearch.ts              — IGDB search via Strapi proxy with debounce
│   └── useGameActions.ts             — Create, update, delete, pin, reorder
├── types/
│   └── index.ts              — TypeScript interfaces (GameList, Game, IGDBSearchResult*)
├── utils/
│   ├── genreUtils.ts         — Genre slug generation, slug-to-name mapping
│   └── gameHelpers.ts        — Cover URL builders, platform formatters, data transformers
└── index.ts                  — Public exports (components, hooks, types)
```

### Directory Explanations

**api/**
- `query.ts`: GraphQL queries (gameListsByAccount, gamesByList, gameDetails, pinnedGames, gamesByGenre, gameListBySlug, publicGameData)
- `mutation.ts`: GraphQL mutations (createGameList, updateGameList, deleteGameList, createRecommendedGame, updateRecommendedGame, deleteRecommendedGame)

**components/dashboard/**
- `GamesHome.tsx`: Dashboard landing showing creator's lists, top picks strip, create list button
- `GameListView.tsx`: Detailed view of single list with Recommendations and Manage tabs
- `GameRow.tsx`: Individual draggable game row with cover art, title, platforms, genres, ratings, note, action menu
- `GameListManage.tsx`: Settings panel with share URL, QR code, list settings, delete option
- `CreateGameListModal.tsx`: Form to create new list (name, description, cover)
- `AddGamePage.tsx`: Dedicated page to add/edit game (IGDB search, rich text notes, photos, user ratings)
- `IgdbSearch.tsx`: Search input with debounce, sends requests to Strapi proxy, shows autocomplete dropdown with cover art/platforms
- `TopPicksManager.tsx`: Dedicated manager page at `/recommendations/games/top-picks`.

**components/public/**
- `PublicGames.tsx`: Public landing page for a creator's games (featured lists, carousels, genre browse)
- `GameCarouselRow.tsx`: Horizontal scrollable carousel of game cover cards
- `GameCoverCard.tsx`: Compact cover card with image, title, platform chips, rating badge (tappable)
- `GameCoverSkeleton.tsx`: Placeholder skeleton for loading state
- `GameDetailModal.tsx`: Slide-up overlay showing full game details, creator notes, screenshots
- `PublicGameList.tsx`: Grid page showing all games in a published list
- `PublicGameGenre.tsx`: Grid page showing all games in a genre
- `GenreBrowse.tsx`: Genre selection interface (2x2 or 4xN grid of genre cards)

**hooks/**
- `useGameLists.ts`: Query creator's lists (useQuery with Apollo)
- `useGamesByList.ts`: Query games in a specific list ID
- `usePinnedGames.ts`: Query top picks across all of creator's lists
- `useGameDetail.ts`: Query single game details (from Strapi)
- `useIgdbSearch.ts`: Search via Strapi proxy with debounce, return formatted results
- `useGameActions.ts`: Mutations for CRUD and reorder operations

**types/index.ts**
```typescript
export interface GameList {
  documentId: string;
  List_Name: string;
  slug: string;
  list_description: string | null;
  Visibility: boolean;
  cover_image: { url: string; alternativeText: string | null } | null;
  display_order: number;
  top_picks_heading: string | null;
  recommended_games: Game[];
  account: { documentId: string; username: string };
}

export interface Game {
  documentId: string;
  igdb_id: number;
  igdb_slug: string | null;
  title: string;
  igdb_image_id: string | null;
  cover_url: string | null;
  cover_url_large: string | null;
  summary: string | null;
  storyline: string | null;
  release_date: string | null;
  release_year: string | null;
  igdb_rating: number | null;       // 0-100 scale from IGDB
  igdb_rating_count: number | null;
  genres: IGDBGenre[];
  platforms: IGDBPlatform[];
  developer: string | null;
  publisher: string | null;
  game_modes: string[];
  screenshot_ids: string[];
  igdb_url: string | null;
  user_recommendation_note: any;   // Tiptap blocks
  user_rating: number | null;       // 1-10 integer (matching Movies & Shows, Books)
  is_pinned: boolean;
  pin_order: number | null;
  display_order: number;
  game_categories: GameCategory[];
  createdAt: string;
}

export interface IGDBGenre {
  id: number;
  name: string;
}

export interface IGDBPlatform {
  id: number;
  name: string;
}

export interface GameCategory {
  documentId: string;
  genre_name: string;
}

// IGDB Search Result types (from Strapi proxy response)
export interface IGDBSearchResult {
  id: number;
  name: string;
  slug: string;
  cover?: { image_id: string };
  total_rating?: number;
  total_rating_count?: number;
  genres?: Array<{ id: number; name: string }>;
  platforms?: Array<{ id: number; name: string }>;
  first_release_date?: number;  // Unix timestamp
  summary?: string;
  storyline?: string;
  involved_companies?: Array<{
    developer: boolean;
    publisher: boolean;
    company: { name: string };
  }>;
  game_modes?: Array<{ id: number; name: string }>;
  screenshots?: Array<{ image_id: string }>;
  url?: string;
  category?: number;
}
```

**utils/genreUtils.ts**
- `genreSlugFromName(name: string): string` — Convert genre name to URL slug (e.g., "Role-playing (RPG)" → "role-playing-rpg")
- `genreNameFromSlug(slug: string): string` — Convert URL slug to display name
- `deduplicateGenres(genres: IGDBGenre[]): IGDBGenre[]` — Remove duplicates by ID
- `aggregateGenres(games: Game[]): IGDBGenre[]` — Collect all unique genres across a list of games

**utils/gameHelpers.ts**
- `getCoverUrl(imageId: string, size?: string): string` — Build IGDB cover URL at given size
- `getScreenshotUrl(imageId: string, size?: string): string` — Build IGDB screenshot URL
- `formatIgdbRating(rating: number | null): string` — Format 0-100 rating as "8.7/10"
- `formatPlatforms(platforms: IGDBPlatform[], maxDisplay?: number): string[]` — Get display-safe list of platforms
- `extractDeveloper(involvedCompanies: IGDBInvolvedCompany[]): string | null`
- `extractPublisher(involvedCompanies: IGDBInvolvedCompany[]): string | null`
- `igdbTimestampToDateString(timestamp: number): string` — Unix → "2015-05-19"
- `igdbTimestampToYear(timestamp: number): string` — Unix → "2015"
- `transformIgdbResult(item: IGDBSearchResult): Partial<Game>` — Map proxy response to Strapi-ready object

---

## 2. Shared Components — Updates

These existing shared components need to be updated to include Games:

### src/components/DashboardSidebar.tsx

**Change:** Add Games item to the category list.

```typescript
// Update type to include 'games'
interface DashboardSidebarProps {
  currentCategory: 'places' | 'movies' | 'books' | 'games';
  onCategoryChange: (category: 'places' | 'movies' | 'books' | 'games') => void;
}

// Sidebar items (updated):
const items = [
  { key: 'places',  label: 'Places',       icon: MapPinIcon,    route: '/recommendations' },
  { key: 'movies',  label: 'Movies & Shows', icon: FilmIcon,     route: '/recommendations/movies' },
  { key: 'books',   label: 'Books',         icon: BookOpenIcon,  route: '/recommendations/books' },
  { key: 'games',   label: 'Games',         icon: GamepadIcon,   route: '/recommendations/games' },
];
```

### src/components/CategoryCards.tsx

**Change:** Add Games card to the category cards grid.

```typescript
// Update type to include 'games'
interface CategoryCardsProps {
  currentCategory: 'places' | 'movies' | 'books' | 'games';
  onCategoryChange: (category: 'places' | 'movies' | 'books' | 'games') => void;
}

// Cards: Places, Movies & Shows, Books, Games
```

### src/components/DashboardLayout.tsx

**Change:** Update prop type to accept `'games'`.

---

## 3. Route Structure

### Protected Routes (Dashboard) — src/routes/ProtectedRoutes.tsx

```typescript
// NEW: Games dashboard routes (add to existing ProtectedRoute elements)

<Route path="/recommendations/games" element={<ProtectedRoute><DashboardLayout currentCategory="games"><GamesHome /></DashboardLayout></ProtectedRoute>} />

<Route path="/recommendations/games/:listId" element={<ProtectedRoute><DashboardLayout currentCategory="games"><GameListView /></DashboardLayout></ProtectedRoute>} />

<Route path="/recommendations/games/:listId/new-game" element={<ProtectedRoute><DashboardLayout currentCategory="games"><AddGamePage mode="create" /></DashboardLayout></ProtectedRoute>} />

<Route path="/recommendations/games/:listId/:gameId/edit" element={<ProtectedRoute><DashboardLayout currentCategory="games"><AddGamePage mode="edit" /></DashboardLayout></ProtectedRoute>} />

<Route path="/recommendations/games/top-picks" element={<ProtectedRoute><DashboardLayout currentCategory="games"><TopPicksManager /></DashboardLayout></ProtectedRoute>} />
```

### Public Routes — src/routes/PublicRoutes.tsx

```typescript
// NEW: Public games routes (add to existing dynamic username routes)

<Route path="/:username/games" element={<PublicGames />} />

<Route path="/:username/games/:listSlug" element={<PublicGameList />} />

<Route path="/:username/games/genre/:genreSlug" element={<PublicGameGenre />} />
```

---

## 4. State Management

Same approach as Movies & Shows and Books:

- **Apollo Client (GraphQL Cache):** Game lists and games cached by Strapi `__typename` + `id`
- **No Zustand store needed:** Apollo cache handles all shared data; form state is local; search results are ephemeral
- **Query policies:**
  - `cache-first`: Lists/games
  - `cache-and-network`: Top Picks
  - `no-cache`: IGDB search (always fresh)

---

## 5. IGDB Service Module

Location: `src/services/igdbService.ts`

> [!IMPORTANT]
> This service does NOT call IGDB directly. It calls the **Strapi proxy** which holds the Twitch credentials.

### Configuration

```typescript
const IGDB_PROXY_BASE = import.meta.env.VITE_IGDB_PROXY_URL;
// e.g., "https://your-strapi.com/api/igdb-proxy"
```

### API Functions

```typescript
// Search games (via Strapi proxy)
export async function searchGames(
  query: string,
  options?: { limit?: number }
): Promise<IGDBSearchResult[]>

// Get single game details (via Strapi proxy)
export async function getGameDetails(
  igdbId: number
): Promise<IGDBSearchResult>

// Image URL helpers (pure functions, no network calls)
export function getCoverUrl(imageId: string, size?: string): string
export function getScreenshotUrl(imageId: string, size?: string): string
export function formatIgdbRating(rating: number | null): string | null

// Data extraction helpers
export function extractDeveloper(involvedCompanies: IGDBInvolvedCompany[]): string | null
export function extractPublisher(involvedCompanies: IGDBInvolvedCompany[]): string | null
export function igdbTimestampToDateString(timestamp: number): string
export function igdbTimestampToYear(timestamp: number): string
export function transformIgdbResult(item: IGDBSearchResult): Partial<Game>
```

### Error Handling

```typescript
export class IgdbError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'IgdbError';
  }
}
```

### Debouncing Strategy

```typescript
export function useIgdbSearch(query: string) {
  const [results, setResults] = useState<IGDBSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await igdbService.searchGames(query);
        setResults(data);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce — same as TMDB and Google Books

    return () => clearTimeout(timer);
  }, [query]);

  return { results, loading };
}
```

---

## 6. Component Tree Diagrams

### Dashboard: Games Home

```
DashboardLayout (currentCategory="games")
├── DashboardSidebar (desktop, currentCategory="games")
├── CategoryCards (mobile, currentCategory="games")
└── GamesHome (creator's dashboard)
    ├── PageHeader (title, list count)
    ├── TopPicksStrip (horizontal carousel of pinned games)
    │   └── GameCoverCard[] (cover art, title, platform chips)
    ├── GameListCard[] (card per list)
    │   ├── ListHeader (name, published toggle, stats)
    │   ├── GameCoverPreview[] (3-4 covers)
    │   └── ViewButton / EditButton
    └── CreateGameListModal (button + modal)
        ├── NameInput
        ├── DescriptionInput
        └── CreateButton
```

### Dashboard: Game List View

```
GameListView
├── ListHeader
│   ├── BackButton
│   ├── ListName (editable)
│   ├── GameCount badge
│   ├── PublishedToggle
│   └── Menu (more actions)
├── Tabs (Recommendations | Manage)
│   ├── Tab: Recommendations
│   │   ├── SortDropdown (date added, rating, title)
│   │   ├── GameRow[]
│   │   │   ├── DragHandle
│   │   │   ├── Cover art thumbnail
│   │   │   ├── Title + Release Year
│   │   │   ├── Platforms (chip tags)
│   │   │   ├── Genres (chip tags)
│   │   │   ├── Rating badge (igdb_rating/10 or user_rating)
│   │   │   ├── Note preview (truncated)
│   │   │   ├── PinIcon (clickable ⭐)
│   │   │   └── Menu (edit, delete, move)
│   │   └── EmptyState + AddGameButton
│   └── Tab: Manage
│       └── GameListManage
│           ├── ShareURLField (copy button)
│           ├── QRCode display
│           ├── PublishedToggle
│           ├── ListSettings (name, description, slug, cover)
│           └── DeleteListButton (with confirmation)
└── EmptyState (if no games)
```

### Dashboard: Add/Edit Game Page

```
AddGamePage (Full page, mode: "create" | "edit")
├── BackNavigation / CloseButton
├── IgdbSearch (Inline search, via Strapi proxy)
│   ├── SearchInput (placeholder: "Search by game title...")
│   ├── LoadingSpinner (debounced)
│   └── SearchResultRow[]
│       ├── Cover art thumbnail
│       ├── Title + Release Year
│       ├── Developer
│       ├── Platforms (compact chips)
│       ├── Genres (chip tags)
│       └── SelectButton
├── SelectedGame Preview Auto-filled
│   ├── Large cover art image
│   ├── Title
│   ├── Release Year · Developer · Publisher
│   ├── Platforms (all chips)
│   ├── Genres (chip tags)
│   ├── Game Modes (chip tags)
│   ├── IGDB Rating badge
│   └── Summary (truncated, expandable)
├── Details Form
│   ├── NoteField (TiptapEditor, "Why do I recommend this?")
│   ├── UserRating (1-10 Interactive star selector)
│   └── CreatorPhotosUpload (optional, multi-upload to S3)
└── SubmitButtons (Save | Cancel)
```

### Public: Games Home

```
PublicGames (/:username/games)
├── PageHeader
│   ├── CreatorPhoto
│   ├── CreatorName
│   ├── GameCount + "Recommendations"
│   └── ShareButton
├── TopPicksCarousel (if creator has pinned games)
│   ├── CarouselHeader ("Top Picks" or custom name)
│   └── GameCarouselRow
│       └── GameCoverCard[]
├── PublishedListCarousel[] (per published list)
│   ├── ListHeader (name, count, ">" link)
│   ├── GameCarouselRow
│   │   └── GameCoverCard[] (tappable → detail modal)
│   └── ViewFullListButton
├── GenreBrowse section
│   ├── SectionHeader ("Browse by Genre")
│   └── GenreCard[]
│       ├── Cover art background
│       ├── Genre name
│       └── Game count
└── EmptyState (if creator has no published lists)
```

### Public: Detail Modal

```
GameDetailModal (slide-up overlay, fullscreen on mobile)
├── HeaderBar
│   ├── DragBar (mobile-only)
│   ├── Title
│   └── CloseButton (X)
├── Content (scrollable)
│   ├── CoverImage (large)
│   ├── MetadataSection
│   │   ├── Title (large)
│   │   ├── Release Year (secondary)
│   │   ├── Developer · Publisher
│   │   ├── Platforms (chip group)
│   │   ├── Genres (chip group)
│   │   ├── Game Modes (chip group)
│   │   ├── IGDBRating badge (x.x/10, if available)
│   │   └── Summary (expandable)
│   ├── CreatorSection
│   │   ├── UserRating (1-10 glowing stars)
│   │   └── CreatorNote (Tiptap formatted)
│   ├── ScreenshotsSection (horizontal scroll, IGDB screenshots)
│   ├── CreatorPhotosCarousel (if any uploaded)
│   └── SourceListLink → PublicGameList
├── FixedFooter
│   └── ShareButton
└── SafeAreaInsets (mobile)
```

---

## 7. Integration Points with Existing Code

All modifications are **additive only**. Existing places, movies, books, and guide features are untouched.

### src/routes/ProtectedRoutes.tsx
**Change:** Add game dashboard routes

### src/routes/PublicRoutes.tsx
**Change:** Add public game routes

### src/components/DashboardSidebar.tsx
**Change:** Add Games item to items array. Widen `currentCategory` type.

### src/components/CategoryCards.tsx
**Change:** Add Games card. Widen type.

### src/components/DashboardLayout.tsx
**Change:** Widen `currentCategory` type to `'places' | 'movies' | 'books' | 'games'`.

### .env.example
**Change:** Add new environment variable:
```
# IGDB (Games) — frontend only needs the proxy URL
VITE_IGDB_PROXY_URL=https://your-strapi-domain.com/api/igdb-proxy
```

### Strapi Backend — New Files
**New:** Custom Strapi controller at `src/api/igdb-proxy/controllers/igdb-proxy.js`
**New:** Custom Strapi routes at `src/api/igdb-proxy/routes/igdb-proxy.js`
**New:** Strapi `.env` entries: `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`

### src/config.ts
**Change:** Add IGDB configuration:
```typescript
export const IGDB_CONFIG = {
  proxyUrl: import.meta.env.VITE_IGDB_PROXY_URL,
};
```

### src/i18n/ locale files
**Change:** Add `games` namespace:
```json
{
  "dashboard": {
    "title": "Games",
    "createList": "Create New List",
    "topPicks": "Top Picks",
    "noPicks": "No top picks yet. Pin games to feature them here."
  },
  "list": {
    "name": "List Name",
    "gameCount": "{{count}} game",
    "gameCount_plural": "{{count}} games",
    "manage": "Manage",
    "recommendations": "Recommendations"
  },
  "game": {
    "addGame": "Add Game",
    "search": "Search by game title...",
    "selectGame": "Select a game",
    "myNote": "My Note",
    "topPick": "Top Pick",
    "pinAsTopPick": "Pin as top pick",
    "platforms": "Platforms",
    "developer": "Developer",
    "publisher": "Publisher"
  },
  "public": {
    "gameRecommendations": "{{creator}}'s Game Recommendations",
    "browseByGenre": "Browse by Genre",
    "viewFullList": "View full list",
    "nothingYet": "No games shared yet"
  }
}
```

---

## 8. Environment Variables

### Frontend Variables (VITE_ prefix)
```
VITE_IGDB_PROXY_URL=https://your-strapi.com/api/igdb-proxy
```

### Strapi Server Variables (no VITE_ prefix — never exposed to browser)
```
IGDB_CLIENT_ID=<your_twitch_client_id>
IGDB_CLIENT_SECRET=<your_twitch_client_secret>
```

**Notes:**
- Obtain from Twitch Developer Console: https://dev.twitch.tv/console
- Register a new application, set category to "Application Integration"
- `IGDB_CLIENT_ID` is safe to use in proxy headers but `IGDB_CLIENT_SECRET` is strictly server-side
- Token auto-refreshes before expiry in Strapi proxy controller (see `games_integration.md`)
- Never commit actual keys to repo; use `.env.local` (already in .gitignore)

---

## 9. Conventions to Follow

Same conventions as Movies & Shows and Books:
- **Strict TypeScript** — All components and hooks fully typed
- **Functional components only** — No class components
- **Apollo Client for GraphQL** — All Strapi queries/mutations go through Apollo
- **Formik + Yup** — Form state management and validation
- **Tiptap** — Rich text editor for creator notes (same instance as Movies & Books)
- **dnd-kit** — Drag-and-drop for list reordering (same as Movies & Books)
- **No inline styles** — All styling via CSS modules or Tailwind classes per project convention
