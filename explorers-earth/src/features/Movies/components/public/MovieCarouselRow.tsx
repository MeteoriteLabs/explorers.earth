import { useRef, memo } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { RecommendedMovie } from "../../types";
import MoviePosterCard from "./MoviePosterCard";
import MoviePosterSkeleton from "./MoviePosterSkeleton";

interface MovieCarouselRowProps {
  title: string;
  movies: RecommendedMovie[];
  loading?: boolean;
  seeAllLink?: string;
  onMovieClick: (movie: RecommendedMovie) => void;
  emptyMessage?: string;
}

const MovieCarouselRow = memo(({
  title,
  movies,
  loading = false,
  seeAllLink,
  onMovieClick,
  emptyMessage = "No movies yet",
}: MovieCarouselRowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!loading && movies.length === 0) return null;

  return (
    <section className="mb-8">
      {/* Row header */}
      <div className="flex items-center justify-between mb-4 px-4 md:px-0">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/40">{!loading ? `${movies.length} movie${movies.length !== 1 ? "s" : ""}` : ""}</span>
          {seeAllLink && !loading && movies.length > 0 && (
            <Link
              to={seeAllLink}
              className="flex items-center gap-0.5 text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              See all <ChevronRight size={14} />
            </Link>
          )}
        </div>
      </div>

      {/* Horizontal scroll */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 md:px-0 pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
        style={{ scrollbarWidth: "thin" }}
      >
        {loading ? (
          <MoviePosterSkeleton count={6} />
        ) : movies.length === 0 ? (
          <p className="text-white/40 text-sm py-4">{emptyMessage}</p>
        ) : (
          movies.map((movie) => (
            <MoviePosterCard
              key={movie.documentId}
              movie={movie}
              onClick={onMovieClick}
            />
          ))
        )}
      </div>
    </section>
  );
});

MovieCarouselRow.displayName = "MovieCarouselRow";

export default MovieCarouselRow;
