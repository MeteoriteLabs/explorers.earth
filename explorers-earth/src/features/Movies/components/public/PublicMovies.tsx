import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { deduplicateMovies } from "../../utils/movieHelpers";
import { Film, Share2 } from "lucide-react";
import { PUBLIC_MOVIE_DATA } from "../../api/query";
import { toast } from "sonner";
import type { RecommendedMovie, MovieList } from "../../types";
import MovieCarouselRow from "./MovieCarouselRow";
import TopPicksHero from "./TopPicksHero";
import TopPicksMobileHero from "./TopPicksMobileHero";
import MovieDetailModal from "./MovieDetailModal";
import GenreBrowse from "./GenreBrowse";
import { useTrackAnalytics, createAnalyticsOptions } from "../../../../services/analyticsService";

// We need account documentId from username — reuse existing user query pattern
import { gql } from "@apollo/client";

const ACCOUNT_BY_USERNAME = gql`
  query AccountByUsername($username: String!) {
    usersPermissionsUsers(filters: { username: { eq: $username } }) {
      documentId
      username
      accounts {
        documentId
        Account_Name
        profile_picture {
          url
        }
      }
    }
  }
`;

const PublicMovies = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [selectedMovie, setSelectedMovie] = useState<RecommendedMovie | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Step 1: Resolve account documentId from username
  const { data: userLookup, loading: userLoading } = useQuery(ACCOUNT_BY_USERNAME, {
    variables: { username },
    skip: !username,
  });

  const accountDocumentId = userLookup?.usersPermissionsUsers?.[0]?.accounts?.[0]?.documentId;
  const creatorName = userLookup?.usersPermissionsUsers?.[0]?.accounts?.[0]?.Account_Name || username;

  // Step 2: Fetch movie data
  const { data: movieData, loading: moviesLoading } = useQuery(PUBLIC_MOVIE_DATA, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
  });

  const loading = userLoading || moviesLoading;
  const lists: MovieList[] = movieData?.movieLists ?? [];

  // Step 3: Initialize analytics — auto-tracks the page view once accountId resolves
  const analytics = useTrackAnalytics(
    createAnalyticsOptions.movies(accountDocumentId || '', username)
  );

  // Collect all movies across all published lists
  const allMovies = useMemo(() => {
    return deduplicateMovies(lists.flatMap(list => list.recommended_movies ?? []));
  }, [lists]);

  // Pinned movies (Top Picks)
  const topPicks = useMemo(() => {
    return allMovies
      .filter(m => m.is_pinned)
      .sort((a, b) => (a.pin_order ?? 999) - (b.pin_order ?? 999));
  }, [allMovies]);

  const handleMovieClick = useCallback((movie: RecommendedMovie) => {
    setSelectedMovie(movie);
    setModalOpen(true);
    // Track which movie was clicked — sends Recommendation_Id to Strapi
    analytics.trackClick('movie-card', {
      id: movie.documentId,
      title: movie.title,
      mediaType: movie.media_type || 'movie',
      listName: movie.movie_list?.List_Name,
    });
  }, [analytics]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `${creatorName}'s Movies`, url }); } catch { /* ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
    }
    analytics.trackClick('share-button', { context: 'movies-header' });
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#2a2a2a]/90 backdrop-blur-sm border-b border-gray-700 h-14">
        <div className="max-w-4xl mx-auto flex items-center justify-between h-full px-6">
          <span
            className="text-white font-bold text-2xl cursor-pointer"
            onClick={() => navigate("/")}
          >
            explorers.earth
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center"
              aria-label="Share"
            >
              <Share2 size={16} />
            </button>
            <button
              onClick={async () => {
                const shareUrl = window.location.href;
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  toast.success("Link copied!");
                } catch (error) {
                  console.error("Failed to copy text:", error);
                }
                analytics.trackClick('copy-link', { context: 'movies-header' });
              }}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center"
              aria-label="Copy Link"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 pb-16 pt-20">
        {loading ? (
          <div className="space-y-10 mt-4">
            {[1, 2, 3].map(i => (
              <section key={i}>
                <div className="h-5 w-40 bg-white/5 animate-pulse rounded mb-4" />
                <div className="flex gap-3 overflow-hidden">
                  {[1, 2, 3, 4, 5].map(j => (
                    <div key={j} className="w-36 flex-shrink-0">
                      <div className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
                      <div className="h-3 mt-2 bg-white/5 animate-pulse rounded w-4/5" />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <>
            {/* Empty state */}
            {lists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Film size={48} className="text-white/20 mb-4" />
                <p className="text-white/40 text-lg font-medium">No movies shared yet</p>
                <p className="text-white/25 text-sm mt-1">Check back later for recommendations</p>
              </div>
            ) : (
              <>
                {/* Top Picks Hero (Large Screens) & Carousel (Mobile) */}
                {topPicks.length > 0 && (
                  <div className="mt-4">
                    <div className="hidden lg:block">
                      <TopPicksHero 
                        movies={topPicks} 
                        onMovieClick={handleMovieClick} 
                      />
                    </div>
                    <div className="block lg:hidden">
                      <TopPicksMobileHero
                        movies={topPicks}
                        onMovieClick={handleMovieClick}
                      />
                    </div>
                  </div>
                )}

                {/* Per-list carousels */}
                <div className="mt-4">
                  {lists.map(list => (
                    list.recommended_movies && list.recommended_movies.length > 0 && (
                      <MovieCarouselRow
                        key={list.documentId}
                        title={list.List_Name}
                        description={list.list_description ?? undefined}
                        movies={deduplicateMovies(list.recommended_movies)}
                        onMovieClick={handleMovieClick}
                        seeAllLink={`/${username}/movies/${list.slug.replace(/^movies-/, "")}`}
                      />
                    )
                  ))}
                </div>

                {/* Genre browse */}
                {allMovies.length > 0 && username && (
                  <GenreBrowse movies={allMovies} username={username} />
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Movie detail modal */}
      <MovieDetailModal
        movie={selectedMovie}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedMovie(null); }}
      />
    </div>
  );
};

export default PublicMovies;
