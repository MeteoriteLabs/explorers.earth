import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { ArrowLeft, Share2 } from "lucide-react";
import { MOVIE_LIST_BY_SLUG } from "../../api/query";
import type { RecommendedMovie } from "../../types";
import MoviePosterCard from "./MoviePosterCard";
import MovieDetailModal from "./MovieDetailModal";
import MoviePosterSkeleton from "./MoviePosterSkeleton";

const PublicMovieList = () => {
  const { username, listSlug } = useParams<{ username: string; listSlug: string }>();
  const [selectedMovie, setSelectedMovie] = useState<RecommendedMovie | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, loading, error } = useQuery(MOVIE_LIST_BY_SLUG, {
    variables: { slug: listSlug, username },
    skip: !username || !listSlug,
  });

  const list = data?.movieLists?.[0];
  const movies: RecommendedMovie[] = list?.recommended_movies ?? [];

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

  return (
    <div className="min-h-screen bg-[#0d1117] text-white">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-2">
        <Link
          to={`/${username}/movies`}
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-6"
        >
          <ArrowLeft size={14} /> {username}'s Movies
        </Link>

        {loading ? (
          <>
            <div className="h-7 w-48 bg-white/5 animate-pulse rounded mb-2" />
            <div className="h-4 w-64 bg-white/5 animate-pulse rounded" />
          </>
        ) : error ? (
          <p className="text-red-400">Failed to load list.</p>
        ) : list ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">{list.List_Name}</h1>
              {list.list_description && (
                <p className="text-white/50 text-sm mt-1 max-w-xl">{list.list_description}</p>
              )}
              <p className="text-white/30 text-xs mt-2">{movies.length} movie{movies.length !== 1 ? "s" : ""}</p>
            </div>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 px-3 py-1.5 rounded-lg hover:bg-white/8 border border-white/10 transition-all flex-shrink-0"
            >
              <Share2 size={14} /> Share
            </button>
          </div>
        ) : (
          <p className="text-white/40">List not found or not published.</p>
        )}
      </div>

      {/* Grid */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {loading ? (
            <MoviePosterSkeleton count={12} />
          ) : (
            movies.map(movie => (
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

      {/* Movie detail modal */}
      <MovieDetailModal
        movie={selectedMovie}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedMovie(null); }}
      />
    </div>
  );
};

export default PublicMovieList;
