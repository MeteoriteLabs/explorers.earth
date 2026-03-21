import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Clock, User, ExternalLink, Share2, Tv, ChevronLeft, ChevronRight } from "lucide-react";
import type { RecommendedMovie, TMDBCastMember } from "../../types";
import tmdbService from "../../../../services/tmdbService";
import { buildPosterUrl, buildBackdropUrl, buildLogoUrl, formatRating, formatRuntime, getGenreNames, extractNoteText } from "../../utils/movieHelpers";

interface MovieDetailModalProps {
  movie: RecommendedMovie | null;
  open: boolean;
  onClose: () => void;
}

const FALLBACK_POSTER = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='450' viewBox='0 0 300 450'><rect width='300' height='450' fill='%23171e2e'/></svg>`;

const MovieDetailModal = ({ movie, open, onClose }: MovieDetailModalProps) => {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [cast, setCast] = useState<TMDBCastMember[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setPhotoIndex(0);
      setCast([]);
      return;
    }
    if (movie) {
      const fetchCast = async () => {
        try {
          if (movie.media_type === "Movie") {
            const data = await tmdbService.getMovieDetails(Number(movie.tmdb_id));
            setCast(data.credits?.cast?.slice(0, 10) || []);
          } else {
            const data = await tmdbService.getTVDetails(Number(movie.tmdb_id));
            setCast(data.credits?.cast?.slice(0, 10) || []);
          }
        } catch (e) {
          console.error("Failed to fetch cast:", e);
        }
      };
      fetchCast();
    }
  }, [open, movie]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Swipe to dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartY(e.touches[0].clientY);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartY === null) return;
    const delta = e.changedTouches[0].clientY - dragStartY;
    if (delta > 100) onClose();
    setDragStartY(null);
  };

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: movie?.title, url }); } catch { /* ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
    }
  }, [movie?.title]);

  if (!movie) return null;

  const genres = getGenreNames(movie.genres);
  const rating = formatRating(movie.tmdb_rating);
  const runtime = formatRuntime(movie.runtime);
  const posterUrl = buildPosterUrl(movie.poster_path, "w500");
  const backdropUrl = buildBackdropUrl(movie.backdrop_path, "w1280");
  const photos = movie.Media?.filter(m => m.url) ?? [];
  const watchProviders = movie.watch_providers ?? [];
  const noteText = extractNoteText(movie.user_recommendation_note);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal panel */}
          <motion.div
            className="fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center z-50 md:p-6"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="relative bg-[#0d1117] md:rounded-2xl w-full max-w-2xl max-h-[92vh] md:max-h-[85vh] overflow-hidden flex flex-col shadow-2xl ring-1 ring-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Backdrop hero */}
              <div className="relative h-48 md:h-56 flex-shrink-0 overflow-hidden">
                {backdropUrl ? (
                  <img src={backdropUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#1a2332] to-[#0d1117]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/40 to-transparent" />

                {/* Drag handle (mobile) */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/30 md:hidden" />

                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/80 hover:text-white transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content area */}
              <div ref={contentRef} className="flex-1 overflow-y-auto">
                <div className="flex gap-4 px-5 -mt-16 relative z-10">
                  {/* Poster */}
                  <div className="flex-shrink-0 w-28 rounded-xl overflow-hidden ring-2 ring-white/10 shadow-2xl">
                    <img
                      src={posterUrl || FALLBACK_POSTER}
                      alt={movie.title}
                      className="w-full aspect-[2/3] object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_POSTER; }}
                    />
                  </div>

                  {/* Title */}
                  <div className="flex-1 pt-16 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      {movie.media_type === "TV" && (
                        <span className="flex items-center gap-1 text-xs bg-blue-600/80 text-white px-2 py-0.5 rounded-full">
                          <Tv size={10} /> Series
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-white mt-1 leading-tight">{movie.title}</h2>
                    {movie.original_title && movie.original_title !== movie.title && (
                      <p className="text-xs text-white/40 mt-0.5">{movie.original_title}</p>
                    )}
                  </div>
                </div>

                <div className="px-5 mt-4 space-y-5 pb-6">
                  {/* Metadata pills */}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {movie.year && (
                      <span className="text-white/60">{movie.year}</span>
                    )}
                    {rating && (
                      <span className="flex items-center gap-1 text-yellow-400 font-semibold">
                        <Star size={13} fill="currentColor" /> {rating}
                      </span>
                    )}
                    {runtime && (
                      <span className="flex items-center gap-1 text-white/50">
                        <Clock size={13} /> {runtime}
                      </span>
                    )}
                    {movie.director && (
                      <span className="flex items-center gap-1 text-white/50">
                        <User size={13} /> {movie.director}
                      </span>
                    )}
                    {movie.season_count && (
                      <span className="text-white/50">{movie.season_count} season{movie.season_count > 1 ? "s" : ""}</span>
                    )}
                  </div>

                  {/* Genres */}
                  {genres.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {genres.map((g) => (
                        <span key={g} className="text-xs bg-white/8 text-white/60 px-2.5 py-1 rounded-full border border-white/10">
                          {g}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Overview */}
                  {movie.overview && (
                    <p className="text-sm text-white/60 leading-relaxed">{movie.overview}</p>
                  )}

                  {/* Creator note */}
                  {noteText && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                      <p className="text-xs font-semibold text-blue-400 mb-1.5 uppercase tracking-wider">Creator's Note</p>
                      <p className="text-sm text-white/80 leading-relaxed">{noteText}</p>
                    </div>
                  )}

                  {/* Cast */}
                  {cast.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Cast</p>
                      <div className="flex overflow-x-auto pb-4 -mx-5 px-5 gap-3 hide-scrollbar">
                        {cast.map(c => (
                          <div key={c.id} className="flex flex-col flex-shrink-0 w-20 gap-1 rounded-xl">
                            <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border border-white/10 bg-[#1a2332]">
                              {c.profile_path ? (
                                <img src={`https://image.tmdb.org/t/p/w185${c.profile_path}`} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-white/20">
                                  <User size={24} />
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-center leading-tight mt-1 text-white/90">{c.name}</span>
                            <span className="text-[10px] text-center text-white/40 leading-tight">{c.character}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Watch providers */}
                  {watchProviders.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Where to Watch</p>
                      <div className="flex flex-wrap gap-2">
                        {watchProviders.map((p, i) => (
                          p.link ? (
                            <a
                              key={i}
                              href={p.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 bg-white/8 hover:bg-white/12 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 transition-colors"
                            >
                              {p.logo_path && (
                                <img src={buildLogoUrl(p.logo_path)} alt="" className="w-5 h-5 rounded" />
                              )}
                              {p.provider_name}
                              <ExternalLink size={11} className="text-white/30" />
                            </a>
                          ) : (
                            <span
                              key={i}
                              className="flex items-center gap-2 bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80"
                            >
                              {p.logo_path && (
                                <img src={buildLogoUrl(p.logo_path)} alt="" className="w-5 h-5 rounded" />
                              )}
                              {p.provider_name}
                            </span>
                          )
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Creator photos */}
                  {photos.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Photos</p>
                      <div className="relative">
                        <div className="aspect-video rounded-xl overflow-hidden bg-white/5">
                          <img src={photos[photoIndex]?.url} alt="" className="w-full h-full object-cover" />
                        </div>
                        {photos.length > 1 && (
                          <div className="flex items-center justify-between mt-2">
                            <button
                              onClick={() => setPhotoIndex(i => Math.max(0, i - 1))}
                              disabled={photoIndex === 0}
                              className="p-1 text-white/50 hover:text-white disabled:opacity-30"
                            >
                              <ChevronLeft size={20} />
                            </button>
                            <span className="text-xs text-white/40">{photoIndex + 1} / {photos.length}</span>
                            <button
                              onClick={() => setPhotoIndex(i => Math.min(photos.length - 1, i + 1))}
                              disabled={photoIndex === photos.length - 1}
                              className="p-1 text-white/50 hover:text-white disabled:opacity-30"
                            >
                              <ChevronRight size={20} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Source list */}
                  {movie.movie_list && (
                    <p className="text-xs text-white/30">
                      From the list: <span className="text-blue-400">{movie.movie_list.List_Name}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Footer actions */}
              <div className="flex-shrink-0 border-t border-white/8 px-5 py-3 flex items-center justify-end gap-2 bg-[#0d1117]">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/8 transition-all"
                >
                  <Share2 size={14} /> Share
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MovieDetailModal;
