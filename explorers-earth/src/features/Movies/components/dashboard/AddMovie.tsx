import { useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "@apollo/client";
import {
  X, Search, Film, Star, Loader2, ChevronDown,
  CheckCircle2, Tv, Clock
} from "lucide-react";
import { toast } from "sonner";
import { useTMDBSearch } from "../../hooks/useTMDBSearch";
import tmdbService from "../../../../services/tmdbService";
import { CREATE_RECOMMENDED_MOVIE, UPDATE_RECOMMENDED_MOVIE } from "../../api/mutation";
import { MOVIE_CATEGORIES } from "../../api/query";
import type { RecommendedMovie, TMDBSearchResult, WatchProvider } from "../../types";
import {
  extractYear,
  buildPosterUrl,
  extractNoteText,
} from "../../utils/movieHelpers";

const FALLBACK_POSTER = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='150' viewBox='0 0 100 150'><rect width='100' height='150' fill='%23171e2e'/></svg>`;

interface AddMovieProps {
  listId: string;
  mode: "create" | "edit";
  movie?: RecommendedMovie | null;
  onClose: () => void;
  onSaved: () => void;
}

// Step 1: TMDB Search
const SearchStep = ({
  onSelect,
}: {
  onSelect: (result: TMDBSearchResult) => void;
}) => {
  const [query, setQuery] = useState("");
  const { results, loading, error } = useTMDBSearch(query);

  return (
    <div>
      <p className="text-sm text-white/60 mb-4">Search for a movie or TV show on TMDB</p>

      {/* Search input */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          autoFocus
          type="text"
          placeholder='Search "Interstellar", "Breaking Bad"...'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-all"
        />
        {loading && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 animate-spin" />
        )}
      </div>

      {/* Results */}
      {error && <p className="text-sm text-red-400 text-center py-3">{error}</p>}

      {results.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {results.map((result) => {
            const title = result.title || result.name || "Unknown";
            const year = extractYear(result.release_date || result.first_air_date);
            const posterUrl = buildPosterUrl(result.poster_path, "w185");

            return (
              <button
                key={result.id}
                onClick={() => onSelect(result)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/8 border border-white/5 hover:border-blue-500/20 transition-all text-left group"
              >
                <div className="w-10 flex-shrink-0 rounded-lg overflow-hidden bg-white/5">
                  <div className="aspect-[2/3]">
                    <img
                      src={posterUrl || FALLBACK_POSTER}
                      alt={title}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_POSTER; }}
                    />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{title}</p>
                  <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                    <span>{year}</span>
                    {result.media_type === "tv" ? (
                      <span className="flex items-center gap-0.5 text-blue-400">
                        <Tv size={10} /> TV
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5">
                        <Film size={10} /> Movie
                      </span>
                    )}
                    {result.vote_average > 0 && (
                      <span className="flex items-center gap-0.5 text-yellow-400/70">
                        <Star size={10} fill="currentColor" /> {result.vote_average.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {query.length > 2 && !loading && results.length === 0 && !error && (
        <p className="text-sm text-white/30 text-center py-6">No results found.</p>
      )}

      {query.length === 0 && (
        <div className="flex flex-col items-center py-8 text-white/20">
          <Film size={32} className="mb-2" />
          <p className="text-sm">Start typing to search movies & shows</p>
        </div>
      )}
    </div>
  );
};

// Step 2: Note & Watch Providers
const NoteStep = ({
  selectedResult,
  note,
  setNote,
  watchProviders,
  setWatchProviders,
  categoryId,
  setCategoryId,
}: {
  selectedResult: TMDBSearchResult;
  note: string;
  setNote: (v: string) => void;
  watchProviders: WatchProvider[];
  setWatchProviders: (p: WatchProvider[]) => void;
  categoryId: string;
  setCategoryId: (v: string) => void;
}) => {
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);

  const { data: categoriesData } = useQuery(MOVIE_CATEGORIES);
  const categories = categoriesData?.movieCategories ?? [];

  const title = selectedResult.title || selectedResult.name || "";
  const year = extractYear(selectedResult.release_date || selectedResult.first_air_date);
  const posterUrl = buildPosterUrl(selectedResult.poster_path, "w185");

  const fetchProviders = async () => {
    setLoadingProviders(true);
    setProviderError(null);
    try {
      const providers = await tmdbService.getWatchProviders(
        selectedResult.id,
        selectedResult.media_type as "movie" | "tv"
      );
      setWatchProviders(providers);
      if (providers.length === 0) setProviderError("No streaming providers found for this title.");
    } catch {
      setProviderError("Could not fetch providers.");
    } finally {
      setLoadingProviders(false);
    }
  };

  return (
    <div>
      {/* Selected movie preview */}
      <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 mb-5 border border-white/8">
        <div className="w-10 flex-shrink-0 rounded overflow-hidden">
          <div className="aspect-[2/3]">
            <img
              src={posterUrl || FALLBACK_POSTER}
              alt={title}
              className="w-full h-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_POSTER; }}
            />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-white/40">{year} · {selectedResult.media_type}</p>
        </div>
        <CheckCircle2 size={18} className="text-green-400 ml-auto flex-shrink-0" />
      </div>

      {/* Category selector */}
      {categories.length > 0 && (
        <div className="mb-4">
          <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Genre / Category (optional)</label>
          <div className="relative">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
            >
              <option value="">— No category —</option>
              {categories.map((c: any) => (
                <option key={c.documentId} value={c.documentId}>{c.genre_name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Note */}
      <div className="mb-4">
        <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Your Recommendation Note (optional)</label>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why do you recommend this? What makes it special?"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
        />
      </div>

      {/* Watch providers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-white/50 uppercase tracking-wider">Watch Providers</label>
          <button
            type="button"
            onClick={fetchProviders}
            disabled={loadingProviders}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 disabled:opacity-50"
          >
            {loadingProviders && <Loader2 size={11} className="animate-spin" />}
            Fetch providers
          </button>
        </div>
        {providerError && <p className="text-xs text-white/30 mb-2">{providerError}</p>}
        {watchProviders.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {watchProviders.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/70"
              >
                <Clock size={10} />
                {p.provider_name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main AddMovie Component
// ─────────────────────────────────────────────────────────────
const AddMovie = ({ listId, mode, movie, onClose, onSaved }: AddMovieProps) => {
  const [step, setStep] = useState<"search" | "note">(mode === "edit" ? "note" : "search");
  const [selectedResult, setSelectedResult] = useState<TMDBSearchResult | null>(null);
  const [note, setNote] = useState(extractNoteText(movie?.user_recommendation_note) ?? "");
  const [watchProviders, setWatchProviders] = useState<WatchProvider[]>(movie?.watch_providers ?? []);
  const [categoryId, setCategoryId] = useState(movie?.movie_categories?.[0]?.documentId ?? "");
  const [saving, setSaving] = useState(false);

  const [createMovie] = useMutation(CREATE_RECOMMENDED_MOVIE);
  const [updateMovie] = useMutation(UPDATE_RECOMMENDED_MOVIE);

  const handleSelectResult = (result: TMDBSearchResult) => {
    setSelectedResult(result);
    setStep("note");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === "edit" && movie) {
        await updateMovie({
          variables: {
            documentId: movie.documentId,
            user_recommendation_note: note ? [{ type: "paragraph", children: [{ type: "text", text: note }] }] : null,
            watch_providers: watchProviders,
            movie_categories: categoryId ? [categoryId] : [],
          },
        });
        toast.success("Movie updated!");
      } else if (selectedResult) {
        // Fetch full details first
        let title = selectedResult.title || selectedResult.name || "";
        let originalTitle = "";
        let year = extractYear(selectedResult.release_date || selectedResult.first_air_date);
        let director: string | null = null;
        let runtime: number | null = null;
        let seasonCount: number | null = null;
        let genres: { id: number; name: string }[] = [];

        try {
          if (selectedResult.media_type === "movie") {
            const details = await tmdbService.getMovieDetails(selectedResult.id);
            title = details.title;
            originalTitle = details.original_title;
            year = extractYear(details.release_date);
            director = tmdbService.extractDirector(details);
            runtime = details.runtime;
            genres = details.genres;
          } else {
            const details = await tmdbService.getTVDetails(selectedResult.id);
            title = details.name;
            originalTitle = details.original_name;
            year = extractYear(details.first_air_date);
            director = details.created_by?.[0]?.name ?? null;
            runtime = details.episode_run_time?.[0] ?? null;
            seasonCount = details.number_of_seasons;
            genres = details.genres;
          }
        } catch {
          // Fallback — use search result data without full details
        }

        await createMovie({
          variables: {
            tmdb_id: String(selectedResult.id),
            media_type: selectedResult.media_type === "tv" ? "TV" : "Movie",
            title,
            original_title: originalTitle,
            year,
            poster_path: selectedResult.poster_path,
            backdrop_path: selectedResult.backdrop_path,
            genres,
            director,
            runtime,
            tmdb_rating: selectedResult.vote_average || null,
            overview: selectedResult.overview || null,
            season_count: seasonCount,
            user_recommendation_note: note ? [{ type: "paragraph", children: [{ type: "text", text: note }] }] : null,
            watch_providers: watchProviders,
            is_pinned: false,
            display_order: 0,
            movie_list: listId,
            movie_categories: categoryId ? [categoryId] : [],
            media_details: null,
          },
        });
        toast.success("Movie added!");
      }
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-[#0d1117] rounded-t-3xl md:rounded-2xl border border-white/10 w-full max-w-lg shadow-2xl"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex items-center justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
          <div className="flex items-center gap-3">
            {step === "note" && mode !== "edit" && (
              <button onClick={() => setStep("search")} className="text-white/40 hover:text-white transition-colors">
                ←
              </button>
            )}
            <h2 className="text-base font-semibold text-white">
              {mode === "edit" ? "Edit Movie" : step === "search" ? "Add Movie or Show" : "Add Details"}
            </h2>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {step === "search" ? (
            <SearchStep onSelect={handleSelectResult} />
          ) : (
            <NoteStep
              selectedResult={selectedResult ?? ({
                id: movie?.tmdb_id ?? 0,
                title: movie?.title,
                poster_path: movie?.poster_path ?? null,
                backdrop_path: movie?.backdrop_path ?? null,
                release_date: movie?.year ?? "",
                media_type: (movie?.media_type?.toLowerCase() as "movie" | "tv") ?? "movie",
                vote_average: movie?.tmdb_rating ?? 0,
              } as TMDBSearchResult)}
              note={note}
              setNote={setNote}
              watchProviders={watchProviders}
              setWatchProviders={setWatchProviders}
              categoryId={categoryId}
              setCategoryId={setCategoryId}
            />
          )}
        </div>

        {/* Footer */}
        {step === "note" && (
          <div className="px-5 py-4 border-t border-white/8">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Film size={15} />}
              {mode === "edit" ? "Save Changes" : "Add to List"}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default AddMovie;
