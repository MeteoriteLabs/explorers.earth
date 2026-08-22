import { useCallback, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { Share2, ArrowLeft } from "lucide-react";
import { MOVIE_LIST_BY_SLUG } from "../../api/query";
import type { RecommendedMovie } from "../../types";
import { deduplicateMovies } from "../../utils/movieHelpers";
import MoviePosterCard from "./MoviePosterCard";
import MovieDetailModal from "./MovieDetailModal";
import SEO from "../../../../components/SEO";
import { createCanonicalUrl } from "../../../../utils/getCurrentDomain";
import { usePublicRouteLifecycle } from "../../../../layouts/usePublicRouteLifecycle";
import { usePublicProfileBootstrapAccount } from "../../../../layouts/PublicProfileBootstrapContext";
import { PublicProfileFallbackRedirect } from "../../../../routes/PublicProfileFallbackRedirect";
import { resolvePublicChildState } from "../../../../routes/resolvePublicChildState";
import {
  mergePublicConnectionPage,
  usePublicConnectionPagination,
} from "../../../../hooks/usePublicConnectionPagination";
import { PublicConnectionPaginationControl } from "../../../../components/PublicConnectionPaginationControl";
import { usePublicLeafRequestGeneration } from "../../../../layouts/PublicRouteReadinessContext";

const PublicMovieList = () => {
  const { username, listSlug } = useParams<{ username: string; listSlug: string }>();
  const navigate = useNavigate();
  const [selectedMovie, setSelectedMovie] = useState<RecommendedMovie | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const accountDocumentId = usePublicProfileBootstrapAccount().documentId;
  const requestGeneration = usePublicLeafRequestGeneration(`${accountDocumentId}:${listSlug}`);

  const { data, loading, error, refetch, fetchMore } = useQuery(MOVIE_LIST_BY_SLUG, {
    variables: {
      slug: listSlug,
      accountDocumentId,
      pagination: { page: 1, pageSize: 200 },
    },
    skip: !accountDocumentId || !listSlug,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const list = data?.movieLists?.[0];
  const movies: RecommendedMovie[] = deduplicateMovies(
    data?.recommendedMovies_connection?.nodes ?? [],
  );
  const childState = resolvePublicChildState({
    loading,
    error,
    bootstrapReady: Boolean(accountDocumentId && listSlug),
    resourceKind: "child",
    entityExists: Boolean(list),
    empty: Boolean(list) && movies.length === 0,
  });

  usePublicRouteLifecycle({
    loading,
    error,
    retry: refetch,
    hasUsableData: Boolean(data),
    empty: childState === "empty",
  });

  const loadPage = useCallback(async (page: number, request: { isCurrent: () => boolean }) => {
    await fetchMore({
      variables: { pagination: { page, pageSize: 200 } },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!request.isCurrent()) return previous;
        if (!previous.recommendedMovies_connection || !fetchMoreResult?.recommendedMovies_connection) {
          return previous;
        }
        return {
          ...previous,
          recommendedMovies_connection: mergePublicConnectionPage(
            previous.recommendedMovies_connection,
            fetchMoreResult.recommendedMovies_connection,
          ),
        };
      },
    });
  }, [fetchMore]);
  const pagination = usePublicConnectionPagination({
    pageInfo: data?.recommendedMovies_connection?.pageInfo,
    loadPage,
    resetKey: `${accountDocumentId}:${listSlug}`,
  });

  if (childState === "redirect") {
    return <PublicProfileFallbackRedirect expectedGeneration={requestGeneration} />;
  }

  const handleMovieClick = (movie: RecommendedMovie) => {
    setSelectedMovie(movie);
    setModalOpen(true);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: list?.List_Name, url }); } catch { /* ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  const pageTitle = list ? `${list.List_Name} | ${username}'s Movie List | explorers` : `Movie List | explorers`;
  const metaDescription = list?.list_description 
    ? list.list_description 
    : list 
      ? `Explore the curated list "${list.List_Name}" containing ${movies.length} movies recommended by ${username} on explorers.`
      : "Explore movie recommendations on explorers.";

  const seoKeywords = list 
    ? [`${list.List_Name}`, `${username} movies`, `${list.slug}`, "movie list", "explorers"]
    : ["movie list", "explorers"];

  const listImage = list?.cover_image?.url || (movies[0]?.poster_path ? `https://image.tmdb.org/t/p/w500${movies[0].poster_path}` : undefined);

  if (!data) return null;

  return (
    <>
      {!loading && list && (
        <SEO
          title={pageTitle}
          description={metaDescription}
          keywords={seoKeywords}
          canonical={createCanonicalUrl(`/${username}/movies/${listSlug}`)}
          image={listImage}
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
              onClick={handleShare}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center"
              aria-label="Share"
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-2 mt-14">
        <Link
          to={`/${username}/movies`}
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-6"
        >
          <ArrowLeft size={14} /> {username}'s Movies
        </Link>

        {list ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-poppins font-bold text-white mb-1">{list.List_Name}</h1>
              {list.list_description && (
                <p className="text-gray-400 font-poppins text-xs md:text-sm mt-1 max-w-xl">{list.list_description}</p>
              )}
              <p className="text-gray-400 font-poppins text-xs md:text-sm mt-2">{movies.length} movie{movies.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        ) : (
          <p className="text-white/40">List not found or not published.</p>
        )}
      </div>

      {/* Grid */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-6">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {movies.map(movie => (
              <MoviePosterCard
                key={movie.documentId}
                movie={movie}
                onClick={handleMovieClick}
                size="sm"
              />
            ))}
        </div>
        <PublicConnectionPaginationControl
          hasNextPage={pagination.hasNextPage}
          isLoading={pagination.isLoadingNextPage}
          error={pagination.nextPageError}
          onLoadMore={() => void pagination.loadNextPage()}
          onRetry={() => void pagination.retryNextPage()}
          label="movies"
        />
      </div>

      {/* Movie detail modal */}
      <MovieDetailModal
        movie={selectedMovie}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedMovie(null); }}
      />
      </div>
    </>
  );
};

export default PublicMovieList;
