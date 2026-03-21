import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { deduplicateMovies } from "../../utils/movieHelpers";
import { Film, Share2, ArrowLeft } from "lucide-react";
import { PUBLIC_MOVIE_DATA } from "../../api/query";
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
  const [selectedMovie, setSelectedMovie] = useState<RecommendedMovie | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Step 1: Resolve account documentId from username
  const { data: userLookup, loading: userLoading } = useQuery(ACCOUNT_BY_USERNAME, {
    variables: { username },
    skip: !username,
  });

  const accountDocumentId = userLookup?.usersPermissionsUsers?.[0]?.accounts?.[0]?.documentId;
  const creatorName = userLookup?.usersPermissionsUsers?.[0]?.accounts?.[0]?.Account_Name || username;
  const creatorPhoto = userLookup?.usersPermissionsUsers?.[0]?.accounts?.[0]?.profile_picture?.url;

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
      {/* Header */}
      <div className="relative">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/40 to-[#0d1117] pointer-events-none h-48" />

        <div className="relative max-w-5xl mx-auto px-4 pt-6 pb-4">
          {/* Back link */}
          <Link
            to={`/${username}`}
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-6"
          >
            <ArrowLeft size={14} /> {creatorName}
          </Link>

          {/* Creator info */}
          <div className="flex items-center gap-4">
            {creatorPhoto ? (
              <img src={creatorPhoto} alt={creatorName} className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-500/30" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-blue-900/40 flex items-center justify-center ring-2 ring-blue-500/30">
                <Film size={24} className="text-blue-400" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">{creatorName}'s Movies</h1>
              {!loading && (
                <p className="text-sm text-white/40 mt-0.5">
                  {totalMovies} movie{totalMovies !== 1 ? "s" : ""} · {lists.length} list{lists.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <button
              onClick={handleShare}
              className="ml-auto flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 px-3 py-1.5 rounded-lg hover:bg-white/8 border border-white/10 transition-all"
            >
              <Share2 size={14} /> Share
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
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
