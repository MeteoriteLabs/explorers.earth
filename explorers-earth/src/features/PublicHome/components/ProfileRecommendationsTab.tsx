import { useState, useMemo, useCallback } from "react";
import { useQuery, gql } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import {
  MapPin, Music, Film, BookOpen, Gamepad2,
  ChevronRight, ExternalLink
} from "lucide-react";

// Movie imports
import { PUBLIC_MOVIE_DATA } from "../../Movies/api/query";
import { deduplicateMovies } from "../../Movies/utils/movieHelpers";
import type { RecommendedMovie, MovieList } from "../../Movies/types";
import MovieCarouselRow from "../../Movies/components/public/MovieCarouselRow";
import MovieDetailModal from "../../Movies/components/public/MovieDetailModal";

// Book imports
import { PUBLIC_BOOK_DATA } from "../../Books/api/query";
import { deduplicateBooks } from "../../Books/utils/bookHelpers";
import type { RecommendedBook, BookList } from "../../Books/types";
import BookCarouselRow from "../../Books/components/public/BookCarouselRow";
import BookDetailModal from "../../Books/components/public/BookDetailModal";

// Game imports
import { PUBLIC_GAME_DATA } from "../../Games/api/query";
import { deduplicateGames } from "../../Games/utils/gameHelpers";
import type { RecommendedGame, GameList } from "../../Games/types";
import GameCarouselRow from "../../Games/components/public/GameCarouselRow";
import GameDetailModal from "../../Games/components/public/GameDetailModal";

import ImageWithFallback from "../../../components/ui/ImageWithFallback";
import { IMAGE_CONFIG } from "../../../config";
import { accountsDetailQuery } from "../api/query";

const ACCOUNT_BY_USERNAME = gql`
  query AccountByUsernameForProfile($username: String!) {
    usersPermissionsUsers(filters: { username: { eq: $username } }) {
      documentId
      username
      accounts {
        documentId
        Account_Name
        profile_picture { url }
      }
    }
  }
`;

type CategoryKey = "places" | "music" | "movies" | "books" | "games";

interface CategoryConfig {
  key: CategoryKey;
  label: string;
  icon: React.ReactNode;
  visibilityField: string;
}

const CATEGORIES: CategoryConfig[] = [
  { key: "places",  label: "Places",        icon: <MapPin  size={14} />, visibilityField: "public_recommendations" },
  { key: "music",   label: "Music",         icon: <Music   size={14} />, visibilityField: "public_music" },
  { key: "movies",  label: "Movies & Shows", icon: <Film    size={14} />, visibilityField: "public_movie" },
  { key: "books",   label: "Books",         icon: <BookOpen size={14} />, visibilityField: "public_books" },
  { key: "games",   label: "Games",         icon: <Gamepad2 size={14} />, visibilityField: "public_games" },
];

// ─────────────────────────────────────────────────────────────
// Places preview section
// ─────────────────────────────────────────────────────────────
const PlacesContent = ({ username }: { username: string }) => {
  const navigate = useNavigate();
  const { data, loading } = useQuery(accountsDetailQuery, {
    variables: { filters: { username: { eq: username } } },
    skip: !username,
    fetchPolicy: "cache-and-network",
  });

  const account = data?.accounts?.[0];
  const publishedLists = useMemo(() =>
    (account?.recommendation_lists || []).filter((l: any) => l.Visibility === true),
    [account]);

  if (loading) {
    return (
      <div className="space-y-3 mt-2 pb-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-white/5 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (publishedLists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <MapPin size={24} className="text-white/30" />
        </div>
        <p className="text-white/40 font-medium">No places shared yet</p>
        <p className="text-white/25 text-sm mt-1">Check back later for recommendations</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-2 pb-4">
      {/* Overview banner */}
      <div
        className="flex items-center justify-between bg-gradient-to-r from-emerald-900/40 to-emerald-800/20 border border-emerald-700/30 rounded-xl px-4 py-3 cursor-pointer hover:border-emerald-500/50 transition-all group"
        onClick={() => navigate(`/${username}/places`)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-600/20 flex items-center justify-center">
            <MapPin size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">{publishedLists.length} {publishedLists.length === 1 ? "Collection" : "Collections"}</p>
            <p className="text-white/50 text-xs">
              {publishedLists.reduce((t: number, l: any) => t + (l.recommended_places?.length || 0), 0)} places total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium group-hover:translate-x-0.5 transition-transform">
          View All <ChevronRight size={14} />
        </div>
      </div>

      {/* List cards */}
      <div className="space-y-3">
        {publishedLists.slice(0, 5).map((list: any) => {
          const coverImage = list.List_Name_Details?.thumbnail ||
            list.recommended_places?.[0]?.Media?.[0]?.url ||
            IMAGE_CONFIG.defaultImages.background;

          return (
            <div
              key={list.documentId}
              className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/15 rounded-xl p-3 cursor-pointer transition-all group"
              onClick={() => navigate(`/${username}/places`)}
            >
              <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                <ImageWithFallback
                  src={coverImage}
                  alt={list.List_Name}
                  className="w-full h-full object-cover"
                  fallbackSrc={IMAGE_CONFIG.defaultImages.background}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{list.List_Name}</p>
                <p className="text-white/50 text-xs mt-0.5">
                  {list.recommended_places?.length || 0} places
                </p>
              </div>
              <ChevronRight size={16} className="text-white/30 group-hover:text-white/60 flex-shrink-0 transition-colors" />
            </div>
          );
        })}
      </div>

      {publishedLists.length > 5 && (
        <button
          onClick={() => navigate(`/${username}/places`)}
          className="w-full py-2.5 text-sm text-emerald-400 hover:text-emerald-300 font-medium flex items-center justify-center gap-1.5 border border-emerald-700/30 hover:border-emerald-500/50 rounded-xl transition-all"
        >
          See all {publishedLists.length} collections <ExternalLink size={13} />
        </button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Music preview section
// ─────────────────────────────────────────────────────────────
const MusicContent = ({ username }: { username: string }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div
        className="flex items-center gap-3 bg-gradient-to-r from-purple-900/40 to-purple-800/20 border border-purple-700/30 rounded-xl px-6 py-4 cursor-pointer hover:border-purple-500/50 transition-all group w-full max-w-sm"
        onClick={() => navigate(`/${username}/music`)}
      >
        <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0">
          <Music size={18} className="text-purple-400" />
        </div>
        <div className="text-left flex-1">
          <p className="text-white font-semibold text-sm">Local Tunes Playlist</p>
          <p className="text-white/50 text-xs mt-0.5">Request songs, explore playlists</p>
        </div>
        <ChevronRight size={16} className="text-purple-400 group-hover:translate-x-0.5 transition-transform" />
      </div>
      <p className="text-white/30 text-xs mt-4">
        Tap to open music player
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Movies preview section
// ─────────────────────────────────────────────────────────────
const MoviesContent = ({ username, accountDocumentId }: { username: string; accountDocumentId: string }) => {
  const [selectedMovie, setSelectedMovie] = useState<RecommendedMovie | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, loading } = useQuery(PUBLIC_MOVIE_DATA, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
    fetchPolicy: "cache-and-network",
  });

  const lists: MovieList[] = data?.movieLists ?? [];

  const handleMovieClick = useCallback((movie: RecommendedMovie) => {
    setSelectedMovie(movie);
    setModalOpen(true);
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 mt-4">
        {[1, 2].map(i => (
          <section key={i}>
            <div className="h-5 w-40 bg-white/5 animate-pulse rounded mb-3 mx-4" />
            <div className="flex gap-3 overflow-hidden px-4">
              {[1, 2, 3, 4, 5].map(j => (
                <div key={j} className="w-28 flex-shrink-0">
                  <div className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
                  <div className="h-3 mt-2 bg-white/5 animate-pulse rounded w-4/5" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Film size={40} className="text-white/20 mb-3" />
        <p className="text-white/40 font-medium">No movies shared yet</p>
        <p className="text-white/25 text-sm mt-1">Check back later for recommendations</p>
      </div>
    );
  }

  return (
    <div className="mt-4 pb-4">
      {lists.map(list =>
        list.recommended_movies && list.recommended_movies.length > 0 && (
          <MovieCarouselRow
            key={list.documentId}
            title={list.List_Name}
            description={list.list_description ?? undefined}
            movies={deduplicateMovies(list.recommended_movies)}
            onMovieClick={handleMovieClick}
            seeAllLink={`/${username}/movies/${list.slug}`}
          />
        )
      )}
      <MovieDetailModal
        movie={selectedMovie}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedMovie(null); }}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Books preview section
// ─────────────────────────────────────────────────────────────
const BooksContent = ({ username, accountDocumentId }: { username: string; accountDocumentId: string }) => {
  const [modalState, setModalState] = useState<{ open: boolean; book: RecommendedBook | null }>({ open: false, book: null });

  const { data, loading } = useQuery(PUBLIC_BOOK_DATA, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
    fetchPolicy: "cache-and-network",
  });

  const lists: BookList[] = (data?.bookLists ?? []).map((l: BookList) => ({
    ...l,
    recommended_books: deduplicateBooks(l.recommended_books),
  }));

  const handleBookClick = useCallback((book: RecommendedBook) => {
    setModalState({ open: true, book });
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 mt-4">
        {[1, 2].map(i => (
          <section key={i}>
            <div className="h-5 w-40 bg-white/5 animate-pulse rounded mb-3 mx-4" />
            <div className="flex gap-3 overflow-hidden px-4">
              {[1, 2, 3, 4, 5].map(j => (
                <div key={j} className="w-28 flex-shrink-0">
                  <div className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
                  <div className="h-3 mt-2 bg-white/5 animate-pulse rounded w-4/5" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BookOpen size={40} className="text-white/20 mb-3" />
        <p className="text-white/40 font-medium">No books shared yet</p>
        <p className="text-white/25 text-sm mt-1">Check back later for recommendations</p>
      </div>
    );
  }

  return (
    <div className="mt-4 pb-4">
      {lists.map(list => (
        <BookCarouselRow
          key={list.documentId}
          title={list.List_Name}
          description={list.list_description}
          books={list.recommended_books}
          seeAllLink={`/${username}/books/${list.slug}`}
          onBookClick={handleBookClick}
        />
      ))}
      <BookDetailModal
        book={modalState.book}
        open={modalState.open}
        onClose={() => setModalState({ open: false, book: null })}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Games preview section
// ─────────────────────────────────────────────────────────────
const GamesContent = ({ username, accountDocumentId }: { username: string; accountDocumentId: string }) => {
  const [modalState, setModalState] = useState<{ open: boolean; game: RecommendedGame | null }>({ open: false, game: null });

  const { data, loading } = useQuery(PUBLIC_GAME_DATA, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
    fetchPolicy: "cache-and-network",
  });

  const lists: GameList[] = data?.gameLists ?? [];

  const handleGameClick = useCallback((game: RecommendedGame) => {
    setModalState({ open: true, game });
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 mt-4">
        {[1, 2].map(i => (
          <section key={i}>
            <div className="h-5 w-40 bg-white/5 animate-pulse rounded mb-3 mx-4" />
            <div className="flex gap-3 overflow-hidden px-4">
              {[1, 2, 3, 4, 5].map(j => (
                <div key={j} className="w-32 flex-shrink-0">
                  <div className="aspect-[3/4] rounded-xl bg-white/5 animate-pulse" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Gamepad2 size={40} className="text-white/20 mb-3" />
        <p className="text-white/40 font-medium">No games shared yet</p>
        <p className="text-white/25 text-sm mt-1">Check back later for recommendations</p>
      </div>
    );
  }

  return (
    <div className="mt-4 pb-4">
      {lists.map(list =>
        list.recommended_games && list.recommended_games.length > 0 && (
          <GameCarouselRow
            key={list.documentId}
            title={list.List_Name}
            description={list.list_description ?? undefined}
            games={deduplicateGames(list.recommended_games)}
            onGameClick={handleGameClick}
            seeAllLink={`/${username}/games/${list.slug}`}
          />
        )
      )}
      <GameDetailModal
        open={modalState.open}
        game={modalState.game}
        onClose={() => setModalState({ open: false, game: null })}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main ProfileRecommendationsTab
// ─────────────────────────────────────────────────────────────
interface ProfileRecommendationsTabProps {
  accountData: {
    documentId?: string;
    public_recommendations?: string;
    public_music?: string;
    public_movie?: string;
    public_books?: string;
    public_games?: string;
  };
  username: string;
}

const ProfileRecommendationsTab = ({ accountData, username }: ProfileRecommendationsTabProps) => {
  // Determine which categories are visible
  const visibleCategories = useMemo(() => {
    return CATEGORIES.filter(cat => {
      const field = cat.visibilityField as keyof typeof accountData;
      const value = accountData[field];
      // Default visible if not set (for places/recommendations)
      if (cat.key === "places") {
        return value === "Yes" || value === undefined || value === null;
      }
      return value === "Yes";
    });
  }, [accountData]);

  const [activeCategory, setActiveCategory] = useState<CategoryKey>(
    visibleCategories[0]?.key ?? "places"
  );

  // Resolve account documentId from username for movie/book/game queries
  const { data: userLookup } = useQuery(ACCOUNT_BY_USERNAME, {
    variables: { username },
    skip: !username,
    fetchPolicy: "cache-and-network",
  });

  const accountDocumentId = userLookup?.usersPermissionsUsers?.[0]?.accounts?.[0]?.documentId
    || accountData?.documentId
    || "";

  // Ensure active category is always valid
  const currentCategory = visibleCategories.find(c => c.key === activeCategory)
    ?? visibleCategories[0];

  if (visibleCategories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-white/30" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </div>
        <p className="text-white/40 font-medium">No recommendations visible</p>
        <p className="text-white/25 text-sm mt-1">The user hasn't enabled any recommendation categories</p>
      </div>
    );
  }

  return (
    <div className="pt-4">
      {/* Sub-category switcher — only if more than 1 visible */}
      {visibleCategories.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-3 px-1"
             style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {visibleCategories.map(cat => {
            const isActive = cat.key === (currentCategory?.key);
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`
                  flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium
                  whitespace-nowrap transition-all duration-200 flex-shrink-0
                  ${isActive
                    ? "bg-[hsl(var(--blue-cta))] text-white shadow-sm shadow-blue-500/20"
                    : "bg-white/8 text-white/60 hover:bg-white/12 hover:text-white/80 border border-white/10"
                  }
                `}
                aria-selected={isActive}
              >
                <span className={isActive ? "text-white" : "text-white/50"}>
                  {cat.icon}
                </span>
                {cat.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-white/8 mb-4" />

      {/* Content panel */}
      <div className="min-h-48">
        {currentCategory?.key === "places" && (
          <PlacesContent username={username} />
        )}
        {currentCategory?.key === "music" && (
          <MusicContent username={username} />
        )}
        {currentCategory?.key === "movies" && (
          <MoviesContent username={username} accountDocumentId={accountDocumentId} />
        )}
        {currentCategory?.key === "books" && (
          <BooksContent username={username} accountDocumentId={accountDocumentId} />
        )}
        {currentCategory?.key === "games" && (
          <GamesContent username={username} accountDocumentId={accountDocumentId} />
        )}
      </div>
    </div>
  );
};

export default ProfileRecommendationsTab;
