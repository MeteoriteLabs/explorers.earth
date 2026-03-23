import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { deduplicateMovies } from "../../utils/movieHelpers";
import { Film, Share2, ArrowLeft } from "lucide-react";
import { PUBLIC_MOVIE_DATA } from "../../api/query";
import { toast } from "sonner";
import type { RecommendedMovie, MovieList } from "../../types";
import MovieCarouselRow from "./MovieCarouselRow";
import MovieDetailModal from "./MovieDetailModal";
import GenreBrowse from "./GenreBrowse";

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

  const handleMovieClick = (movie: RecommendedMovie) => {
    setSelectedMovie(movie);
    setModalOpen(true);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `${creatorName}'s Movies`, url }); } catch { /* ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  const totalMovies = allMovies.length;

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

      {/* Header */}
      <div className="relative mt-14">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/40 to-[#0d1117] pointer-events-none h-48" />

        <div className="relative max-w-5xl mx-auto px-4 pt-6 pb-4">
          <Link
            to={`/${username}`}
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-6"
          >
            <ArrowLeft size={14} /> {creatorName}
          </Link>

          {/* Creator info */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 relative">
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-poppins font-bold text-white mb-1">
                {creatorName}'s Movies
              </h1>
              {!loading ? (
                <p className="text-gray-400 font-poppins text-xs md:text-sm">
                  {totalMovies} movie{totalMovies !== 1 ? "s" : ""} · {lists.length} list{lists.length !== 1 ? "s" : ""}
                </p>
              ) : (
                <div className="h-3 w-32 bg-white/5 animate-pulse rounded" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 pb-16">
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
                {/* Top Picks carousel */}
                {topPicks.length > 0 && (
                  <div className="mt-4">
                    <MovieCarouselRow
                      title="⭐ Top Picks"
                      movies={topPicks}
                      onMovieClick={handleMovieClick}
                    />
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
                        seeAllLink={`/${username}/movies/${list.slug}`}
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
