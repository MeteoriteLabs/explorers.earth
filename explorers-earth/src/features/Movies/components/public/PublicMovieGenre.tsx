import { useState, useMemo, useEffect } from "react";
import { useParams, Link, useOutletContext, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import type { RecommendedMovie } from "../../types";
import { slugToGenreName, getGenreNames, deduplicateMovies, genreToSlug } from "../../utils/movieHelpers";
import MoviePosterCard from "./MoviePosterCard";
import MovieDetailModal from "./MovieDetailModal";
import MoviePosterSkeleton from "./MoviePosterSkeleton";
import SEO from "../../../../components/SEO";
import { createCanonicalUrl } from "../../../../utils/getCurrentDomain";
import { usePublicHeaderDescriptor } from "../../../PublicHome/components/PublicHeaderDescriptorContext";
import { isNonNullObject, PublicRouteErrorState, PublicRoutePartialNotice, settlePublicRouteRetries } from "../../../PublicHome/components/PublicRouteContentState";
import { usePublicProfileShell } from "../../../PublicHome/api/usePublicProfileShell";
import { usePublicRecommendationCategory } from "../../../PublicHome/api/usePublicRecommendationCategory";

type RenderableMovieList = { recommended_movies: RecommendedMovie[] };
const isRenderableMovieList = (value: unknown): value is RenderableMovieList =>
  isNonNullObject(value) && Array.isArray(value.recommended_movies);

const PublicMovieGenre = () => {
  const { username, genreSlug } = useParams<{ username: string; genreSlug: string }>();
  const location = useLocation();
  const outletContext = useOutletContext<{ setIsPageLoaded?: (val: boolean) => void } | null>();
  const [selectedMovie, setSelectedMovie] = useState<RecommendedMovie | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const genreName = slugToGenreName(genreSlug ?? "");
  usePublicHeaderDescriptor(genreSlug ? {
    navigationKey: location.key,
    title: genreName,
    url: window.location.href,
    analyticsContext: "movies-genre-header",
    analyticsMetadata: { genre: genreSlug },
  } : undefined);

  const { data: accountData, loading: userLoading, error: userError, refetch: refetchUser } = usePublicProfileShell(username);
  const accountDocumentId = typeof accountData?.documentId === "string" ? accountData.documentId : undefined;
  const { data: moviesData, loading: moviesLoading, error: moviesError, refetch: refetchMovies } = usePublicRecommendationCategory(username, "movies", accountData?.public_movie === "Yes");

  const loading = userLoading || moviesLoading;
  const queryError = userError || moviesError;
  const rawLists = moviesData?.movieLists;
  const lists = (Array.isArray(rawLists) ? rawLists : []).filter(isRenderableMovieList);
  const completeCollection = Array.isArray(rawLists) && rawLists.every(isRenderableMovieList);
  const hasUsableData = queryError ? lists.length > 0 : completeCollection;

  useEffect(() => {
    if (!loading || hasUsableData) {
      outletContext?.setIsPageLoaded?.(true);
    }
  }, [hasUsableData, loading, outletContext]);

  const handleRetry = async () => {
    await settlePublicRouteRetries(refetchUser, accountDocumentId ? refetchMovies : undefined);
  };

  const allMovies: RecommendedMovie[] = useMemo(() => {
    return deduplicateMovies(lists.flatMap((list) => list.recommended_movies.filter(isNonNullObject) as RecommendedMovie[]));
  }, [lists]);

  const filteredMovies = useMemo(() => {
    return allMovies.filter(movie => {
      const slugs = getGenreNames(movie.genres).map(g => genreToSlug(g));
      return slugs.includes(genreSlug ?? "");
    });
  }, [allMovies, genreSlug]);

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
      <div className="min-h-screen bg-[#0d1117] text-white" aria-busy={loading || undefined}>
      {/* Header */}
      <div className="relative">
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
              {!loading || hasUsableData ? (
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

      {Boolean(queryError) && hasUsableData && <PublicRoutePartialNotice message="Some movie data is unavailable." />}

      <div className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-6">
        {queryError && !hasUsableData ? (
          <PublicRouteErrorState title="Movie genre unavailable" error={queryError} onRetry={handleRetry} />
        ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {loading && !hasUsableData ? (
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
        )}
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
