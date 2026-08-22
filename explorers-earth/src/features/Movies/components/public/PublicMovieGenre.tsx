import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { gql } from "@apollo/client";
import { Share2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { RecommendedMovie } from "../../types";
import { slugToGenreName, getGenreNames, deduplicateMovies, genreToSlug } from "../../utils/movieHelpers";
import MoviePosterCard from "./MoviePosterCard";
import MovieDetailModal from "./MovieDetailModal";
import MoviePosterSkeleton from "./MoviePosterSkeleton";
import { PUBLIC_MOVIE_DATA } from "../../api/query";
import SEO from "../../../../components/SEO";
import { createCanonicalUrl } from "../../../../utils/getCurrentDomain";
import { usePublicRouteLifecycle } from "../../../../layouts/usePublicRouteLifecycle";

const ACCOUNT_BY_USERNAME = gql`
  query AccountByUsernameForGenre($username: String!) {
    usersPermissionsUsers(filters: { username: { eq: $username } }) {
      accounts {
        documentId
      }
    }
  }
`;



const PublicMovieGenre = () => {
  const { username, genreSlug } = useParams<{ username: string; genreSlug: string }>();
  const navigate = useNavigate();
  const [selectedMovie, setSelectedMovie] = useState<RecommendedMovie | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const genreName = slugToGenreName(genreSlug ?? "");

  const { data: userLookup, loading: userLoading, error: userError, refetch: refetchUser } = useQuery(ACCOUNT_BY_USERNAME, {
    variables: { username },
    skip: !username,
  });
  const accountDocumentId = userLookup?.usersPermissionsUsers?.[0]?.accounts?.[0]?.documentId;

  const { data: moviesData, loading: moviesLoading, error: moviesError, refetch: refetchMovies } = useQuery(PUBLIC_MOVIE_DATA, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
  });

  const loading = userLoading || moviesLoading;

  const allMovies: RecommendedMovie[] = useMemo(() => {
    return deduplicateMovies((moviesData?.movieLists ?? []).flatMap((l: any) => l.recommended_movies ?? []));
  }, [moviesData]);

  const filteredMovies = useMemo(() => {
    return allMovies.filter(movie => {
      const slugs = getGenreNames(movie.genres).map(g => genreToSlug(g));
      return slugs.includes(genreSlug ?? "");
    });
  }, [allMovies, genreSlug]);

  const retry = useCallback(async () => {
    await refetchUser();
    if (accountDocumentId) await refetchMovies();
  }, [accountDocumentId, refetchMovies, refetchUser]);

  usePublicRouteLifecycle({
    loading,
    error: userError ?? moviesError,
    retry,
    hasUsableData: Boolean(userLookup && moviesData),
    empty: !loading && !userError && !moviesError && filteredMovies.length === 0,
  });

  const handleMovieClick = (movie: RecommendedMovie) => {
    setSelectedMovie(movie);
    setModalOpen(true);
  };

  const pageTitle = `${genreName} Movies | ${username}'s Movie List | explorers`;
  const metaDescription = `Explore ${filteredMovies.length} ${genreName} movie${filteredMovies.length !== 1 ? "s" : ""} recommended by ${username} on explorers.`;
  const seoKeywords = [genreName, "movies", `${username} movies`, "explorers"];

  return (
    <>
      {!loading && (
        <SEO
          title={pageTitle}
          description={metaDescription}
          keywords={seoKeywords}
          canonical={createCanonicalUrl(`/${username}/movies/genre/${genreSlug}`)}
          type="website"
          author={username}
          siteName="explorers"
        />
      )}
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
              onClick={async () => {
                const shareUrl = window.location.href;
                if (navigator.share) {
                  try { await navigator.share({ title: genreName, url: shareUrl }); } catch { /* ignore */ }
                } else {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    toast.success("Link copied!");
                  } catch (error) {
                    console.error("Failed to copy text:", error);
                  }
                }
              }}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center"
              aria-label="Share"
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="relative mt-14">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/40 to-[#0d1117] pointer-events-none h-48" />

        <div className="relative max-w-5xl mx-auto px-4 pt-6 pb-4">
          <Link
            to={`/${username}/movies`}
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-6"
          >
            <ArrowLeft size={14} /> {username}'s Movies
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 relative">
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-poppins font-bold text-white mb-1">{genreName}</h1>
              {!loading ? (
                <p className="text-gray-400 font-poppins text-xs md:text-sm mt-1">
                  {filteredMovies.length} movie{filteredMovies.length !== 1 ? "s" : ""}
                </p>
              ) : (
                <div className="h-3 w-32 bg-white/5 animate-pulse rounded mt-2" />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-6">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {loading ? (
            <MoviePosterSkeleton count={12} />
          ) : filteredMovies.length === 0 ? (
            <p className="col-span-full text-white/40 text-sm py-8 text-center">
              No movies found in this genre.
            </p>
          ) : (
            filteredMovies.map(movie => (
              <MoviePosterCard
                key={movie.documentId}
                movie={movie}
                onClick={handleMovieClick}
                size="sm"
              />
            ))
          )}
        </div>
      </div>

      <MovieDetailModal
        movie={selectedMovie}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedMovie(null); }}
      />
      </div>
    </>
  );
};

export default PublicMovieGenre;
