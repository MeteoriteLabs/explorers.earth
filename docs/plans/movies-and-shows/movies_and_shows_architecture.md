---
Feature: movies-and-shows
Doc type: architecture
Status: draft
Created: 2026-03-20
Last updated: 2026-03-25
Updated by: agent
Depends on: movies_and_shows_schema.md, movies_and_shows_api_contract.md
---

# Movies & Shows Feature Architecture

## Overview

The Movies & Shows feature extends explorers.earth with creator-managed movie and TV show recommendations. Creators can curate custom lists, add personal notes, mark top picks, and share with visitors. Visitors browse public lists by creator, genre, or featured recommendations.

This document defines the technical architecture, component hierarchy, state management, and integration points.

## 1. Feature Module Structure

The Movies feature follows the existing feature-based module pattern:

```
src/features/Movies/
├── api/
│   ├── query.ts              — GraphQL queries (lists, movies, genres)
│   └── mutation.ts           — GraphQL mutations (CRUD operations)
├── components/
│   ├── dashboard/            — Creator dashboard (protected routes)
│   │   ├── MoviesHome.tsx            — Main movies dashboard view (includes inline CreateListModal)
│   │   ├── MovieListView.tsx         — Single list detail + all tabs (Recommendations + Manage)
│   │   ├── AddMoviePage.tsx          — Page to add/edit movie in list (includes inline TMDB search)
│   │   └── TopPicksManager.tsx       — Pin/feature top picks manager (slide-up modal)
│   └── public/               — Visitor-facing components
│       ├── PublicMovies.tsx          — Public movies landing page
│       ├── MovieCarouselRow.tsx      — Horizontal scrollable poster carousel
│       ├── MoviePosterCard.tsx       — Poster + metadata compact card
│       ├── MoviePosterSkeleton.tsx   — Loading skeleton
│       ├── TopPicksHero.tsx          — Desktop cinematic backdrop hero (auto-cycling slideshow)
│       ├── TopPicksMobileHero.tsx    — Mobile swipe poster stack carousel
│       ├── MovieDetailModal.tsx      — Slide-up movie detail view
│       ├── PublicMovieList.tsx       — List grid page for single list
│       ├── PublicMovieGenre.tsx      — Genre grid page
│       └── GenreBrowse.tsx           — Genre selection / discovery
├── hooks/
│   ├── useMovieLists.ts              — Fetch creator's movie lists
│   ├── useMoviesByList.ts            — Fetch movies in specific list
│   ├── usePinnedMovies.ts            — Fetch top picks across all lists
│   ├── useMovieDetail.ts             — Fetch single movie details
│   ├── useTMDBSearch.ts              — TMDB search with debounce
│   └── useMovieActions.ts            — Create, update, delete, pin, reorder
├── types/
│   └── index.ts              — TypeScript interfaces (MovieList, Movie, TMDB*)
├── utils/
│   ├── genreUtils.ts         — Genre slug generation, slug-to-ID mapping
│   └── movieHelpers.ts       — Image URL builders, data transformers
└── index.ts                  — Public exports (components, hooks, types)
```

### Directory Explanations

**api/**
- `query.ts`: GraphQL queries using Apollo Client (getMovieLists, getMoviesByList, getMovieDetail, getPublicMovies, getTopPicks, getPublishedLists, getMoviesByGenre)
- `mutation.ts`: GraphQL mutations (createMovieList, updateMovieList, deleteMovieList, createMovie, updateMovie, deleteMovie, pinMovie, reorderMovies, publishList)

**components/dashboard/**
- `MoviesHome.tsx`: Dashboard landing showing creator's lists, cinematic Top Picks Hero (desktop) / swipe carousel (mobile) for pinned movies, create list button, `MovieListCard` sub-component (inline), `CreateListModal` sub-component (inline). The hero shows a "Manage Top Picks" button that opens `TopPicksManager`.
- `MovieListView.tsx`: Detailed view of single list. Contains two tabs — **Recommendations** (movie rows with pin toggle, ⋮ menu: Edit/Delete, movie row click opens `MovieDetailModal`) and **Manage** (accordion-based layout: `Manage` accordion with Delete/Edit/Publish controls; `My QR` accordion with branded QR card + Share/Copy/Download buttons). All logic is inline — no separate `MovieRow.tsx` or `MovieListManage.tsx` files.
- `AddMoviePage.tsx`: Full-page add/edit flow. **Inline `InlineSearch` sub-component** handles TMDB search (no separate `TMDBSearch.tsx` file). After selection, shows: backdrop+poster strip, form fields (title, year, director, runtime, TMDB rating, genres, overview, cast preview), watch providers (auto-fetched, displayed as chips — no separate `WatchProviders.tsx` file), Tiptap editor for note, 1-10 star rating selector, snapshot upload.
- `TopPicksManager.tsx`: Slide-up bottom-sheet modal (not a route page). Shows pinned movies list (ordered, minus to unpin) and unpinned movies list (tap to add). Save button batches mutations.

**components/public/**
- `PublicMovies.tsx`: Public landing page for a creator's movies (featured lists, carousels, genre browse)
- `MovieCarouselRow.tsx`: Horizontal scrollable carousel of movie poster cards with title/year
- `TopPicksHero.tsx`: **Desktop-only** (`hidden lg:block`) cinematic backdrop hero. Full `60vh` backdrop image with Framer Motion cross-fade. Auto-cycles through pinned movies every 5s. Left side: title, metadata, genres, "See Details" button. Right side: scrollable thumbnail filmstrip (16:9 aspect, active one highlighted). Optional "Manage Top Picks" button in top-right corner.
- `TopPicksMobileHero.tsx`: **Mobile-only** (`block lg:hidden`) swipe carousel. Full-height poster card stack \u2014 active card fills screen, next 2 fanned behind it with perspective depth. Auto-cycles every 4s. Drag-to-swipe with `PanInfo` velocity detection. "See Details" full-width button at bottom. Optional "Manage" pill button at top-right of active card.
- `MovieCarouselRow.tsx`: Horizontal scrollable carousel of movie poster cards with title/year
- `MoviePosterCard.tsx`: Compact poster card with image, title, year, rating badge (tappable)
- `MoviePosterSkeleton.tsx`: Placeholder skeleton for loading state
- `MovieDetailModal.tsx`: Slide-up overlay showing full movie details, creator notes, watch providers, photos
- `PublicMovieList.tsx`: Grid page showing all movies in a published list
- `PublicMovieGenre.tsx`: Grid page showing all movies in a genre
- `GenreBrowse.tsx`: Genre selection interface (2x2 or 4xN grid of genre cards)

**hooks/**
- `useMovieLists.ts`: Query creator's lists (useQuery with Apollo)
- `useMoviesByList.ts`: Query movies in a specific list ID
- `usePinnedMovies.ts`: Query top picks across all of creator's lists
- `useMovieDetail.ts`: Query single movie details (from Strapi)
- `useTMDBSearch.ts`: Search TMDB with debounce, return formatted results
- `useMovieActions.ts`: Mutations for CRUD and reorder operations

**types/index.ts**
```typescript
// GraphQL types (from Strapi schema)
export interface MovieList {
  id: string;
  name: string;
  slug: string;
  description: string;
  published: boolean;
  creatorId: string;
  movies: Movie[];
  topPickCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Movie {
  id: string;
  listId: string;
  title: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  year: number;
  genres: string[];
  rating: number;
  posterUrl: string;
  backdropUrl: string;
  runtime?: number;
  director?: string;
  user_recommendation_note?: any;
  user_rating?: number | null;
  watchProviders: WatchProvider[];
  isPinned: boolean;
  order: number;
  cast_details?: any;
  movie_categories?: any[];
  createdAt: string;
}

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

// TMDB API response types (only relevant fields)
export interface TMDBSearchResult {
  id: number;
  title?: string;
  name?: string;
  media_type: 'movie' | 'tv';
  release_date?: string;
  first_air_date?: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
}

export interface TMDBMovieDetail {
  id: number;
  title: string;
  release_date: string;
  runtime: number;
  genres: { id: number; name: string }[];
  vote_average: number;
  director?: string;
  backdrop_path: string;
  poster_path: string;
}

export interface TMDBGenre {
  id: number;
  name: string;
  slug?: string;
}
```

**utils/genreUtils.ts**
- `genreSlugFromId(id: number): string` — Convert TMDB genre ID to URL slug
- `genreIdFromSlug(slug: string): number` — Convert URL slug to TMDB genre ID
- `deduplicateGenres(genres: string[]): string[]` — Remove duplicates and sort

**utils/movieHelpers.ts**
- `buildImageUrl(path: string, size: string): string` — TMDB image CDN URL builder
- `buildPosterUrl(path: string): string` — Poster image (w500)
- `buildBackdropUrl(path: string): string` — Backdrop image (w1280)
- `formatYear(dateString: string): number` — Extract year from ISO date
- `transformTMDBResponse(data: unknown): TMDBSearchResult` — Type-safe response mapping

## 2. New Shared Components

These components live in `src/components/` (outside the Movies feature) because they're shared across multiple features:

### src/components/DashboardSidebar.tsx

Desktop navigation sidebar for creator dashboard. Displays category tabs (Places, Movies & Shows).

```typescript
interface DashboardSidebarProps {
  currentCategory: 'places' | 'movies';
  onCategoryChange: (category: 'places' | 'movies') => void;
}
```

Features:
- Category icon + label (Places, Movies & Shows)
- Active state indicator
- Responsive: hidden on mobile (< md breakpoint)
- Uses Tailwind for styling, Radix UI for accessibility

### src/components/CategoryCards.tsx

Mobile-optimized category selection grid (2x1 or 2x2 layout).

```typescript
interface CategoryCardsProps {
  currentCategory: 'places' | 'movies';
  onCategoryChange: (category: 'places' | 'movies') => void;
}
```

Features:
- Grid of category cards (icon, label, badge with count)
- Visible only on mobile (< md breakpoint)
- Touch-friendly tap targets
- Framer Motion micro-interactions on selection

### src/components/DashboardLayout.tsx

Layout wrapper for creator dashboards. Renders:
- Desktop: `DashboardSidebar` on left + content area on right
- Mobile: `CategoryCards` stacked above content area

```typescript
interface DashboardLayoutProps {
  currentCategory: 'places' | 'movies';
  onCategoryChange: (category: 'places' | 'movies') => void;
  children: React.ReactNode;
}
```

Integration with existing code:
- Wraps the content of `/recommendations` (Places dashboard) and `/recommendations/movies` (Movies dashboard)
- No changes to existing Favorites components
- Sidebar/cards handle navigation, content area is swappable

## 3. Route Structure

Routes are added to existing routing files without modifying other routes:

### Protected Routes (Dashboard) — src/routes/ProtectedRoutes.tsx

```typescript
// NEW: Movies dashboard routes (add to existing ProtectedRoute elements)

<Route path="/recommendations" element={<ProtectedRoute><DashboardLayout currentCategory="places"><Favorites /></DashboardLayout></ProtectedRoute>} />

<Route path="/recommendations/movies" element={<ProtectedRoute><DashboardLayout currentCategory="movies"><MoviesHome /></DashboardLayout></ProtectedRoute>} />

<Route path="/recommendations/movies/:listId" element={<ProtectedRoute><DashboardLayout currentCategory="movies"><MovieListView /></DashboardLayout></ProtectedRoute>} />

<Route path="/recommendations/movies/:listId/new-movie" element={<ProtectedRoute><DashboardLayout currentCategory="movies"><AddMoviePage mode="create" /></DashboardLayout></ProtectedRoute>} />

<Route path="/recommendations/movies/:listId/:movieId/edit" element={<ProtectedRoute><DashboardLayout currentCategory="movies"><AddMoviePage mode="edit" /></DashboardLayout></ProtectedRoute>} />

<Route path="/recommendations/movies/top-picks" element={<ProtectedRoute><DashboardLayout currentCategory="movies"><TopPicksManager /></DashboardLayout></ProtectedRoute>} />
```

Routing notes:
- Add/edit movie routes use modal overlays (not full-page navigation)
- `listId` and `movieId` are UUID or slug from Strapi
- Existing `/recommendations` (Places) route is unchanged; wraps with `DashboardLayout` for sidebar visibility

### Public Routes — src/routes/PublicRoutes.tsx

```typescript
// NEW: Public movies routes (add to existing dynamic username routes)

<Route path="/:username/movies" element={<PublicMovies />} />

<Route path="/:username/movies/:listSlug" element={<PublicMovieList />} />

<Route path="/:username/movies/genre/:genreSlug" element={<PublicMovieGenre />} />
```

Routing notes:
- Follows existing pattern of `/:username/*` for public profiles
- `listSlug` is SEO-friendly slug (auto-generated from list name)
- `genreSlug` is URL-safe genre slug (e.g., `sci-fi`, `action-adventure`)
- No changes to existing public routes (Places, Guides, etc.)

## 4. State Management

### Apollo Client (GraphQL Cache)

Movie lists and movies are cached in Apollo Client:

- **Cache keys**: Strapi uses `__typename` and `id` for cache keys
- **Query policies**:
  - `cache-first`: Lists/movies (user edits rarely conflict)
  - `cache-and-network`: Top picks (freshen in background)
  - `no-cache`: TMDB search (external, always fresh)
- **Mutations**:
  - `createMovie`: Use `refetchQueries: ['GetMoviesByList']` or update cache manually
  - `deleteMovie`: Update cache by filtering out deleted movie
  - `reorderMovies`: Optimistic update on local cache, refetch on error
  - `publishList`: Update `MovieList.published` in cache

Example cache update pattern:
```typescript
useMutation(CREATE_MOVIE, {
  update(cache, { data: { createMovie } }) {
    const existing = cache.readQuery({ query: GET_MOVIES_BY_LIST });
    cache.writeQuery({
      query: GET_MOVIES_BY_LIST,
      data: { ...existing, movies: [...existing.movies, createMovie] }
    });
  }
});
```

### Zustand Stores

**Decision**: No global Zustand store needed for Movies feature. Reasons:
- Apollo cache handles movie list and movie data (shared globally)
- Form state is local to components (Formik manages)
- TMDB search results are ephemeral (local hook state)
- Drag-and-drop reorder state is local to component

If needed in future, create `src/store/useMovieStore.ts`:
```typescript
interface MovieStore {
  // Current list being viewed
  currentListId: string | null;
  setCurrentListId: (id: string | null) => void;

  // Search/filter state
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Drag-and-drop reorder (local)
  reorderingMovies: Movie[];
  startReorder: (movies: Movie[]) => void;
  resetReorder: () => void;
}

export const useMovieStore = create<MovieStore>((set) => ({...}));
```

### Local Component State

- **TMDB search results**: State in `useTMDBSearch` hook (ephemeral, cleared on blur)
- **Form state**: Local state managed dynamically in `AddMoviePage`
- **Drag-and-drop reorder**: Local state in `MovieListView`, saved via mutation on drop
- **Modal open/close**: Local `useState` in parent component

## 5. TMDB Service Module

Location: `src/services/tmdbService.ts`

### Configuration

```typescript
const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

export const POSTER_SIZES = {
  small: 'w342',
  medium: 'w500',
  large: 'w780'
};

export const BACKDROP_SIZES = {
  small: 'w780',
  medium: 'w1280',
  large: 'w1920'
};
```

### API Functions

```typescript
// Search multi (movies + TV shows)
export async function searchMulti(query: string): Promise<TMDBSearchResult[]>

// Get movie details
export async function getMovieDetails(tmdbId: number): Promise<TMDBMovieDetail>

// Get TV show details
export async function getTVDetails(tmdbId: number): Promise<TMDBShowDetail>

// Get watch providers for movie/show
export async function getWatchProviders(
  tmdbId: number,
  mediaType: 'movie' | 'tv'
): Promise<WatchProvider[]>

// Get all movie genres
export async function getMovieGenres(): Promise<TMDBGenre[]>

// Get all TV genres
export async function getTVGenres(): Promise<TMDBGenre[]>

// Image URL builders
export function buildImageUrl(path: string, size: string): string
export function buildPosterUrl(path: string, size?: 'small' | 'medium' | 'large'): string
export function buildBackdropUrl(path: string, size?: 'small' | 'medium' | 'large'): string
```

### Error Handling

```typescript
export class TMDBError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'TMDBError';
  }
}

// In all functions:
try {
  const response = await fetch(`${TMDB_API_BASE}...`);
  if (!response.ok) {
    throw new TMDBError(`TMDB API error: ${response.statusText}`, response.status);
  }
  return response.json();
} catch (error) {
  if (error instanceof TMDBError) throw error;
  throw new TMDBError('Failed to fetch from TMDB', undefined, error);
}
```

### Debouncing Strategy

Debouncing is handled in the `useTMDBSearch` hook, not in the service:

```typescript
export function useTMDBSearch(query: string) {
  const [results, setResults] = useState<TMDBSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await tmdbService.searchMulti(query);
        setResults(data);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  return { results, loading };
}
```

## 6. Component Tree Diagrams

### Dashboard: Movies Home

```
DashboardLayout (currentCategory="movies")
├── DashboardSidebar (desktop, currentCategory="movies", onCategoryChange)
├── CategoryCards (mobile, currentCategory="movies", onCategoryChange)
└── MoviesHome (creator's dashboard)
    ├── PageHeader (title, list count, search)
    ├── TopPicksStrip (horizontal carousel of pinned movies)
    │   └── MoviePosterCard[] (image, title, year)
    ├── MovieListCard[] (card per list)
    │   ├── ListHeader (name, published toggle, stats)
    │   ├── MoviePreviewRow[] (3-4 posters)
    │   └── ViewButton / EditButton
    └── CreateMovieListModal (button + modal)
        ├── NameInput
        ├── DescriptionInput
        └── CreateButton
```

### Dashboard: Movie List View

```
MovieListView
├── ListHeader
│   ├── BackButton
│   ├── ListName (editable)
│   ├── MovieCount badge
│   ├── PublishedToggle
│   └── Menu (more actions)
├── Tabs (Recommendations | Manage)
│   ├── Tab: Recommendations
│   │   ├── SortDropdown (date added, rating, title, pinned first)
│   │   ├── MovieRow[]
│   │   │   ├── DragHandle
│   │   │   ├── Poster image
│   │   │   ├── Title + Year
│   │   │   ├── Genres (comma-separated)
│   │   │   ├── Rating badge
│   │   │   ├── Note preview (truncated)
│   │   │   ├── PinIcon (clickable)
│   │   │   └── Menu (edit, delete)
│   │   └── SuggestionsRow (trending TMDB movies)
│   │       └── MoviePosterCard[] (trending movies to add)
│   └── Tab: Manage
│       └── MovieListManage
│           ├── ShareURLField (copy button)
│           ├── QRCode display
│           ├── PublishedToggle (with warning if no movies)
│           ├── ListSettings (genre tags, description)
│           └── DeleteListButton (with confirmation)
└── EmptyState (if no movies)
    ├── Icon + message
    └── AddMovieButton
```

### Dashboard: Add/Edit Movie Page

```
AddMoviePage (Full page, mode: "create" | "edit")
├── BackNavigation / CloseButton
├── TMDBSearch (Inline search)
│   ├── SearchInput
│   ├── LoadingSpinner (debounced)
│   └── SearchResultRow[]
│       ├── Poster thumbnail
│       ├── Title + Year + MediaType
│       ├── Rating badge
│       └── SelectButton
├── SelectedMovie Preview Auto-filled
│   ├── Large poster / Backdrop strip
│   ├── Title + Year
│   ├── Genres
│   ├── Rating + Runtime + Director
│   └── Synopsis / Cast Overview
├── Details Form
│   ├── NoteField (TiptapEditor, "Why do I love this?")
│   ├── UserRating (1-5 Interactive star selector)
│   ├── WatchProviders (chip group)
│   └── CreatorPhotosUpload (optional, multi-upload snapshots directly to S3)
└── SubmitButtons (Save | Cancel)
```

### Public: Movies Home

```
PublicMovies (/:username/movies)
├── PageHeader
│   ├── CreatorPhoto
│   ├── CreatorName
│   ├── MovieCount + "Recommendations"
│   └── ShareButton (copy profile link)
├── TopPicksCarousel (if creator has pinned movies)
│   ├── CarouselHeader ("Top Picks")
│   └── MovieCarouselRow
│       └── MoviePosterCard[]
├── PublishedListCarousel[] (per published list)
│   ├── ListHeader (name, count)
│   ├── MovieCarouselRow
│   │   └── MoviePosterCard[] (tappable to open detail modal)
│   └── ViewFullListButton
├── GenreBrowse section (if applicable)
│   ├── SectionHeader ("Browse by Genre")
│   └── GenreCard[]
│       ├── Genre name
│       ├── Movie count
│       └── Link to genre page
└── EmptyState (if creator has no published lists)
    ├── Icon + message
    └── CreatorLink (to profile)
```

### Public: List Grid Page

```
PublicMovieList (/:username/movies/:listSlug)
├── PageHeader
│   ├── BackButton
│   ├── ListName
│   ├── MovieCount
│   └── ShareButton
├── MovieGrid (responsive 2x, 3x, or 4x columns)
│   └── MoviePosterCard[]
│       ├── Image (tappable)
│       ├── Title
│       ├── Year
│       ├── Rating badge
│       └── OnClick → MovieDetailModal
├── MovieDetailModal (slide-up overlay)
│   ├── MovieDetailContent
│   └── CloseButton (click overlay or X)
└── EmptyState (if no published movies)
```

### Public: Detail Modal

```
MovieDetailModal (slide-up overlay, fullscreen on mobile)
├── HeaderBar
│   ├── DragBar (mobile-only)
│   ├── Title + Year
│   └── CloseButton (X)
├── Content (scrollable)
│   ├── PosterImage
│   ├── MetadataSection
│   │   ├── Title (large)
│   │   ├── Year (secondary)
│   │   ├── Rating badge
│   │   ├── Genres (chip group)
│   │   ├── Director + Runtime
│   │   └── Synopsis
│   ├── CreatorNoteSection (if exists)
│   │   ├── CreatorPhoto + Name
│   │   └── Note text
│   ├── WatchProvidersSection (if exists)
│   │   ├── "Where to Watch"
│   │   └── ProviderChip[] (tappable, links to external)
│   ├── CreatorPhotosCarousel (if exists)
│   │   ├── SectionHeader
│   │   └── PhotoCarousel (horizontal scroll)
│   └── SourceListLink
│       └── "View full list" → PublicMovieList
├── FixedFooter
│   └── ShareButton (social + copy link)
└── SafeAreaInsets (mobile)
```

### Public: Genre Page

```
PublicMovieGenre (/:username/movies/genre/:genreSlug)
├── PageHeader
│   ├── BackButton
│   ├── GenreName (e.g., "Sci-Fi")
│   ├── MovieCount
│   └── ShareButton
├── MovieGrid (responsive 2x, 3x, or 4x columns)
│   └── MoviePosterCard[] (filtered by genre)
│       └── OnClick → MovieDetailModal
└── EmptyState (if no movies in genre)
```

## 7. Integration Points with Existing Code

All modifications are **additive only**. Existing Favorites, Places, and Guide features are untouched.

### src/routes/ProtectedRoutes.tsx

**Change**: Add movie dashboard routes to existing route config

```typescript
// NEW routes:
<Route path="/recommendations/movies" element={<ProtectedRoute>...</ProtectedRoute>} />
<Route path="/recommendations/movies/:listId" element={<ProtectedRoute>...</ProtectedRoute>} />
<Route path="/recommendations/movies/:listId/new-movie" element={<ProtectedRoute>...</ProtectedRoute>} />
<Route path="/recommendations/movies/:listId/:movieId/edit" element={<ProtectedRoute>...</ProtectedRoute>} />
<Route path="/recommendations/movies/top-picks" element={<ProtectedRoute>...</ProtectedRoute>} />

// MODIFIED (wrap with DashboardLayout):
<Route path="/recommendations" element={
  <ProtectedRoute>
    <DashboardLayout currentCategory="places" onCategoryChange={handleCategoryChange}>
      <Favorites />
    </DashboardLayout>
  </ProtectedRoute>
} />
```

### src/routes/PublicRoutes.tsx

**Change**: Add public movie routes to existing route config

```typescript
// NEW routes (within the :username/* dynamic route):
<Route path="/:username/movies" element={<PublicMovies />} />
<Route path="/:username/movies/:listSlug" element={<PublicMovieList />} />
<Route path="/:username/movies/genre/:genreSlug" element={<PublicMovieGenre />} />

// No changes to existing routes
```

### src/pages/Favorites.tsx

**Change**: Minimal or none. Component is wrapped by DashboardLayout in routing layer.

- If Favorites page includes "Recommendations" title, consider moving to DashboardLayout
- No structural changes to Places-related code

### src/components/Navbar.tsx

**Change**: Add active state logic for movie routes

```typescript
const isMoviesActive = location.pathname.startsWith('/recommendations/movies');
const isFavoritesActive = location.pathname === '/recommendations';

// Update className logic:
<NavLink to="/recommendations" className={isFavoritesActive && !isMoviesActive ? 'active' : ''}>
  Favorites
</NavLink>
```

### .env.example

**Change**: Add new environment variable

```
# TMDB API
VITE_TMDB_API_KEY=your_tmdb_api_v3_key_here
```

### src/config.ts

**Change**: Add TMDB configuration

```typescript
export const TMDB_CONFIG = {
  apiKey: import.meta.env.VITE_TMDB_API_KEY,
  apiBase: 'https://api.themoviedb.org/3',
  imageBase: 'https://image.tmdb.org/t/p',
  imageBaseUrl: (path: string, size: string) =>
    `${TMDB_CONFIG.imageBase}/${size}${path}`
};
```

### src/i18n/ locale files

**Change**: Add namespace and keys for Movies feature

Example (`src/i18n/en/movies.json`):
```json
{
  "dashboard": {
    "title": "Movies & Shows",
    "createList": "Create New List",
    "topPicks": "Top Picks",
    "noPicks": "No top picks yet. Pin movies to feature them here."
  },
  "list": {
    "name": "List Name",
    "description": "Description",
    "publish": "Publish",
    "unpublish": "Unpublish",
    "movieCount": "{{count}} movie",
    "movieCount_plural": "{{count}} movies",
    "manage": "Manage",
    "recommendations": "Recommendations"
  },
  "movie": {
    "addMovie": "Add Movie",
    "search": "Search movies and shows...",
    "selectMovie": "Select a movie or show",
    "myNote": "My Note",
    "whereToWatch": "Where to Watch",
    "topPick": "Top Pick",
    "pinAsTopPick": "Pin as top pick"
  },
  "public": {
    "movieRecommendations": "{{creator}}'s Movie Recommendations",
    "browseByGenre": "Browse by Genre",
    "viewFullList": "View full list",
    "nothingYet": "No movies shared yet"
  }
}
```

Existing i18n files (authentication, profile, guides, etc.) are unchanged.

## 8. Environment Variables

### New Variable

```
VITE_TMDB_API_KEY=<your_tmdb_api_v3_or_v4_key>
```

**Notes:**
- Obtain from https://www.themoviedb.org/settings/api
- API v3 (simpler, uses API key in URL): Recommended for this phase
- API v4 (requires bearer token): Can upgrade later for read-only user sessions
- Key is public (exposed in frontend); restrict in TMDB dashboard to domain if using v3
- Never commit actual keys to repo; use `.env.local` (already in .gitignore)

## 9. Conventions to Follow

### TypeScript
- **Strict mode enabled** (tsconfig.json)
- **Functional components only** (no class components)
- **Explicit return types** on all functions and components
- **Type inference** where obvious (e.g., useState, useQuery)
- **Discriminated unions** for state with multiple branches (e.g., loading | error | success)

### React & Hooks
- **Functional components** with hooks
- **Apollo Client** for GraphQL (useQuery, useMutation from @apollo/client)
- **Formik + Yup** for forms (matching explorers-earth pattern)
- **Zustand** for global state (if needed; default to Apollo cache)
- **React Router** (useNavigate, useParams, useLocation)
- **Custom hooks** for reusable logic (fetch, actions, form state)

### Styling
- **Tailwind CSS** for utility classes
- **Radix UI** for accessible components (dialog, dropdown, tabs, toast)
- **Framer Motion** for micro-animations (entrance, transitions, drag)
- **CSS-in-JS** avoided; use Tailwind classes only

### Code Organization
- **Feature-based structure** (features/ subdirectory with self-contained modules)
- **Separation of concerns**: api/, components/, hooks/, types/, utils/
- **Index files** (index.ts) export public API from each module
- **No circular imports** (use TypeScript module resolution)
- **Shared components** in `src/components/` (not in feature folder)

### API Integration
- **Apollo Client** caching for Strapi queries/mutations
- **tmdbService** for external TMDB API calls (isolated, reusable)
- **Error boundaries** around async operations (error states in UI)
- **Loading states** with skeleton/spinner components
- **Refetch/optimistic updates** for mutation feedback

### Internationalization (i18n)
- **react-i18next** integration (existing in explorers-earth)
- **Namespace per feature** (e.g., `movies`, `guides`, `authentication`)
- **Translations in JSON** under `src/i18n/{language}/{feature}.json`
- **Keys are namespaced** in components: `t('movies:dashboard.title')`
- **Pluralization support** (use `_plural` suffix for plural forms)

### Forms
- **Formik** for state management
- **Yup** for validation schemas
- **Radix UI components** for inputs (Text Field, Select, Checkbox)
- **Error messages** displayed inline below field
- **Submit button disabled** if form invalid or submitting

### Accessibility
- **ARIA labels** on all interactive elements
- **Keyboard navigation** (tab order, enter to submit)
- **Focus states** visible (Tailwind `focus:ring`)
- **Color contrast** meets WCAG AA
- **Alt text** on all images
- **Semantic HTML** (use Radix components which provide it)

## 10. Data Flow Summary

### Creator Flow (Dashboard)

1. Creator navigates to `/recommendations/movies`
2. `MoviesHome` mounts, fetches `GetMovieLists` via Apollo query
3. Creator clicks "Create List" → `CreateMovieListModal` appears
4. Form submitted → `CreateMovieList` mutation → Apollo cache updated
5. Creator clicks list → navigates to `/recommendations/movies/:listId`
6. `MovieListView` mounts, fetches `GetMoviesByList` via Apollo query
7. Creator clicks "Add Movie" → `AddMovie` modal appears
8. Creator types in search → debounced `useTMDBSearch` hook calls `tmdbService.searchMulti()`
9. Creator selects movie → auto-fills form with TMDB data
10. Creator fills note, selects watch providers, optionally pins
11. Form submitted → `CreateMovie` mutation → Apollo cache updated
12. Movie appears in list; if pinned, also in TopPicksStrip
13. Creator can drag-to-reorder → `ReorderMovies` mutation on drop
14. Creator can publish list → `UpdateMovieList` mutation sets `published: true`

### Visitor Flow (Public)

1. Visitor navigates to `/:username/movies`
2. `PublicMovies` mounts, fetches `GetPublishedLists` and `GetTopPicks` via Apollo
3. Page renders TopPicksCarousel (pinned movies), then list carousels, then genre browse
4. Visitor clicks movie poster → `MovieDetailModal` slides up
5. Modal fetches `GetMovieDetail` if needed (or uses cached data)
6. Visitor clicks "View full list" or genre → navigates to `/:username/movies/:listSlug` or `/genre/:genreSlug`
7. Grid page renders all movies in list/genre
8. Visitor can click poster to open detail modal again
9. Visitor can share via ShareButton (copy link or social)

## 11. Security Considerations

- **TMDB API key**: Public but restricted in TMDB dashboard by domain
- **Creator data**: Protected by `ProtectedRoute` component (auth check)
- **Published lists**: Visible to all users (no sensitive data)
- **User input**: Sanitized by Strapi before storing (XSS prevention)
- **GraphQL queries**: Validated by Strapi schema (no unauthorized fields)

## 12. Performance Considerations

- **Apollo caching**: Reduces refetches, improves perceived performance
- **Debounced search**: Reduces TMDB API calls (300ms debounce)
- **Image lazy-loading**: Use Intersection Observer or native `loading="lazy"`
- **Virtual scrolling**: For large movie grids (consider react-window if >50 movies)
- **Code splitting**: Movies feature lazily loaded via React.lazy() and Suspense
- **Bundle size**: TMDB service is minimal (no external SDK, fetch-based)

## 13. Testing Strategy

Unit tests for:
- `tmdbService.ts` functions (mock fetch, error cases)
- `genreUtils.ts` functions (slug generation, mapping)
- `movieHelpers.ts` functions (URL builders, formatters)
- Custom hooks (`useTMDBSearch`, `useMovieActions`)

Integration tests for:
- Apollo queries/mutations (mock Apollo Client)
- Component rendering with mocked data
- Form validation (Formik + Yup)

E2E tests for:
- Full creator flow (create list → add movie → publish)
- Full visitor flow (browse → open detail → share)

Existing test patterns in explorers-earth should be reused (Jest + React Testing Library).

