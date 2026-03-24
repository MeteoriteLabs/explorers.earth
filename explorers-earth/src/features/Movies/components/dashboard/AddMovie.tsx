import { useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "@apollo/client";
import {
  X, Search, Film, Star, Loader2,
  CheckCircle2, Tv, Clock, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useTMDBSearch } from "../../hooks/useTMDBSearch";
import tmdbService from "../../../../services/tmdbService";
import { CREATE_RECOMMENDED_MOVIE, UPDATE_RECOMMENDED_MOVIE } from "../../api/mutation";
import { MOVIE_CATEGORIES } from "../../api/query";
import type { RecommendedMovie, TMDBSearchResult, WatchProvider, TMDBCastMember } from "../../types";
import {
  extractYear,
  buildPosterUrl,
  buildBackdropUrl,
  extractNoteText,
} from "../../utils/movieHelpers";
import axios from "axios";
import useAuthStore from "../../../../store/store";
import {
  generateMovieUploadPath,
  generateRandomFileName,
  sanitizeUsername,
} from "../../../../utils/uploadPathGenerator";

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
  existingSnapshots,
  setExistingSnapshots,
  newSnapshots,
  setNewSnapshots,
  userRating,
  setUserRating,
}: {
  selectedResult: TMDBSearchResult | any;
  note: string;
  setNote: (v: string) => void;
  watchProviders: WatchProvider[];
  setWatchProviders: (p: WatchProvider[]) => void;
  existingSnapshots: { id: string; url: string }[];
  setExistingSnapshots: (fn: (prev: { id: string; url: string }[]) => { id: string; url: string }[]) => void;
  newSnapshots: File[];
  setNewSnapshots: (fn: (prev: File[]) => File[]) => void;
  userRating: number | null;
  setUserRating: (v: number | null) => void;
}) => {
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);



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



      {/* Note */}
      <div className="mb-4">
        <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Your Recommendation Note (optional)</label>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why do you recommend this? What makes it special?"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-colors resize-none mb-3"
        />

        {/* User Rating */}
        <div className="mt-4">
          <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">Your Rating</label>
          <div className="flex gap-1.5 flex-wrap">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setUserRating(star)}
                className={`p-1 transition-all hover:scale-110 active:scale-95 ${userRating && userRating >= star ? "text-yellow-400" : "text-white/20 hover:text-white/40"}`}
              >
                <Star size={24} fill={userRating && userRating >= star ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
        </div>
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

      {/* Manual Snapshots Upload */}
      <div className="mt-4">
        <label className="text-xs text-white/50 uppercase tracking-wider mb-2 block">
          Manual Snapshots (Optional)
        </label>
        <div className="flex flex-col gap-3">
          {existingSnapshots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {existingSnapshots.map((snap) => (
                <div key={snap.id} className="relative w-16 h-16 rounded-xl overflow-hidden shadow-sm group">
                  <img src={snap.url.startsWith('http') ? snap.url : (snap.url.startsWith('/') ? `${import.meta.env.VITE_REST_API_URL?.replace('/api', '') || 'http://localhost:1337'}${snap.url}` : snap.url)} className="w-full h-full object-cover" alt="Snapshot" />
                  <button
                    type="button"
                    onClick={() => setExistingSnapshots(prev => prev.filter(s => s.id !== snap.id))}
                    className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {newSnapshots.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {newSnapshots.map((file, i) => (
                <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden shadow-sm group border border-white/20">
                  <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="New Preview" />
                  <button
                    type="button"
                    onClick={() => setNewSnapshots(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="cursor-pointer flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 border-dashed rounded-xl px-4 py-2.5 text-xs text-white/70 transition-colors self-start">
            <Upload size={14} className="text-white/50" />
            <span>Upload Images</span>
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  const filesArr = Array.from(e.target.files);
                  setNewSnapshots(prev => [...prev, ...filesArr]);
                }
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main AddMovie Component
// ─────────────────────────────────────────────────────────────
const AddMovie = ({ listId, mode, movie, onClose, onSaved }: AddMovieProps) => {
  const { user, token } = useAuthStore();
  const [step, setStep] = useState<"search" | "note">(mode === "edit" ? "note" : "search");
  const [selectedResult, setSelectedResult] = useState<TMDBSearchResult | null>(mode === "edit" ? movie as any : null);
  const [note, setNote] = useState(extractNoteText(movie?.user_recommendation_note) ?? "");
  const [userRating, setUserRating] = useState<number | null>(movie?.user_rating ?? null);
  const [watchProviders, setWatchProviders] = useState<WatchProvider[]>(movie?.watch_providers ?? []);
  const [existingSnapshots, setExistingSnapshots] = useState<{ id: string; url: string }[]>(movie?.media_details?.imageDetails || []);
  const [newSnapshots, setNewSnapshots] = useState<File[]>([]);
  const [categoryIds] = useState<string[]>(movie?.movie_categories?.map((c: any) => c.documentId) ?? []);
  const [saving, setSaving] = useState(false);

  const { data: categoriesData } = useQuery(MOVIE_CATEGORIES);
  const categories = categoriesData?.movieCategories ?? [];

  const [createMovie] = useMutation(CREATE_RECOMMENDED_MOVIE);
  const [updateMovie] = useMutation(UPDATE_RECOMMENDED_MOVIE);

  const handleSelectResult = (result: TMDBSearchResult) => {
    setSelectedResult(result);
    setStep("note");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let uploadedImageDetails = [...existingSnapshots];

      if (newSnapshots.length > 0) {
        toast.loading("Uploading snapshots...", { id: "upload-snapshots" });
        try {
          const manualUploads = await Promise.all(
            newSnapshots.map(async (file, idx) => {
              const usernameStr = sanitizeUsername(user?.username || "user");
              const tmdbIdStr = mode === "edit" ? String(movie?.tmdb_id || "unknown") : String(selectedResult?.id || "unknown");
              const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
              const randomFileName = generateRandomFileName(safeName);
              const fullS3Path = generateMovieUploadPath(usernameStr, listId, tmdbIdStr, randomFileName);
              const directoryPath = fullS3Path.substring(0, fullS3Path.lastIndexOf('/'));
              
              const formData = new FormData();
              formData.append("files", file, randomFileName);
              formData.append("path", directoryPath);

              const uploadRes = await axios.post(
                `${import.meta.env.VITE_REST_API_URL}/upload`,
                formData,
                {
                  headers: {
                    "Content-Type": "multipart/form-data",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                }
              );
              
              if (uploadRes.data?.[0]?.url) {
                return { id: `snap_${Date.now()}_${idx}`, url: uploadRes.data[0].url };
              }
              return null;
            })
          );
          
          uploadedImageDetails = [...uploadedImageDetails, ...manualUploads.filter(Boolean) as { id: string; url: string }[]];
          toast.success("Snapshots uploaded successfully!", { id: "upload-snapshots" });
        } catch (err: any) {
           toast.error("Failed to upload some manual snapshots.", { id: "upload-snapshots" });
           throw new Error("Snapshot upload failed"); 
        }
      }

      const finalMediaDetails = uploadedImageDetails.length > 0 ? { imageDetails: uploadedImageDetails } : null;

      if (mode === "edit" && movie) {
        await updateMovie({
          variables: {
            documentId: movie.documentId,
            user_recommendation_note: note ? [{ type: "paragraph", children: [{ type: "text", text: note }] }] : null,
            user_rating: userRating,
            watch_providers: watchProviders,
            movie_categories: categoryIds,
            media_details: finalMediaDetails,
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
        let castMembers: TMDBCastMember[] = [];

        try {
          if (selectedResult.media_type === "movie") {
            const details = await tmdbService.getMovieDetails(selectedResult.id);
            title = details.title;
            originalTitle = details.original_title;
            year = extractYear(details.release_date);
            director = tmdbService.extractDirector(details);
            runtime = details.runtime;
            genres = details.genres;
            castMembers = details.credits?.cast?.slice(0, 10) || [];
          } else {
            const details = await tmdbService.getTVDetails(selectedResult.id);
            title = details.name;
            originalTitle = details.original_name;
            year = extractYear(details.first_air_date);
            director = details.created_by?.[0]?.name ?? null;
            runtime = details.episode_run_time?.[0] ?? null;
            seasonCount = details.number_of_seasons;
            genres = details.genres;
            castMembers = details.credits?.cast?.slice(0, 10) || [];
          }
        } catch {
          // Fallback — use search result data without full details
        }

        let finalPosterPath = selectedResult.poster_path;
        let finalBackdropPath = selectedResult.backdrop_path;

        const uploadImageToS3 = async (urlPath: string, type: string) => {
          console.log(`[uploadImageToS3] TRIGGERED for ${type} with urlPath:`, urlPath);
          if (!urlPath) {
             console.log(`[uploadImageToS3] urlPath is empty. Returning early.`);
             return urlPath;
          }
          let fullUrl = "";
          if (type === 'poster') {
             fullUrl = buildPosterUrl(urlPath, "original");
          } else if (type === 'backdrop') {
             fullUrl = buildBackdropUrl(urlPath, "original");
          } else {
             // For cast profiles
             fullUrl = buildPosterUrl(urlPath, "w185");
          }
          console.log(`[uploadImageToS3] fullUrl for ${type}:`, fullUrl);

          try {
            toast.loading(`Downloading ${type} from TMDB...`, { id: `upload-${type}` });
            const tmdbRes = await axios.get(fullUrl, { responseType: 'blob' });
            const blob = tmdbRes.data;
            const fileType = blob.type || "image/jpeg";
            
            console.log(`[uploadImageToS3] TMDB blob obtained. Type: ${fileType}, Size: ${blob.size}`);
            toast.loading(`Uploading ${type} to S3...`, { id: `upload-${type}` });

            const username = sanitizeUsername(user?.username || "user");
            const tmdbIdStr = String(selectedResult.id);
            const randomFileName = generateRandomFileName(`${type}.jpg`);
            const fullS3Path = generateMovieUploadPath(username, listId, tmdbIdStr, randomFileName);
            const directoryPath = fullS3Path.substring(0, fullS3Path.lastIndexOf('/'));

            console.log(`[uploadImageToS3] Generated directoryPath for S3:`, directoryPath);

            const formData = new FormData();
            formData.append("files", new File([blob], randomFileName, { type: fileType }));
            formData.append("path", directoryPath);

            const uploadRes = await axios.post(
              `${import.meta.env.VITE_REST_API_URL}/upload`,
              formData,
              {
                headers: {
                  "Content-Type": "multipart/form-data",
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
              }
            );

            console.log(`[uploadImageToS3] Strapi upload response:`, uploadRes.data);
            toast.success(`${type} uploaded successfully!`, { id: `upload-${type}` });

            if (uploadRes.data?.[0]?.url) {
              return uploadRes.data[0].url;
            } else {
              throw new Error("Strapi upload returned 200 OK but no valid URL was found in response payload.");
            }
          } catch (err: any) {
            console.error(`[uploadImageToS3] CATCH ERROR while uploading ${type}:`, err);
            toast.error(`Error uploading ${type} to S3. Check console!`, { id: `upload-${type}` });
            alert(`CRITICAL UPLOAD ERROR: ${err.message}. Please check browser console.`);
            throw new Error(`Failed to upload ${type} to S3: ` + err.message);
          }
        };

        if (finalPosterPath) {
          finalPosterPath = await uploadImageToS3(finalPosterPath, 'poster');
        }
        if (finalBackdropPath) {
          finalBackdropPath = await uploadImageToS3(finalBackdropPath, 'backdrop');
        }

        const castDetailsJSON = await Promise.all(
          castMembers.map(async (member) => {
            let uploadedUrl = member.profile_path;
            if (uploadedUrl) {
              uploadedUrl = await uploadImageToS3(uploadedUrl, `cast_${member.id}`);
            }
            return {
              original_name: member.name,
              character: member.character,
              profile_url: uploadedUrl
            };
          })
        );

        await createMovie({
          variables: {
            tmdb_id: String(selectedResult.id),
            media_type: selectedResult.media_type === "tv" ? "TV" : "Movie",
            title,
            original_title: originalTitle,
            year,
            poster_path: finalPosterPath,
            backdrop_path: finalBackdropPath,
            genres,
            director,
            runtime,
            tmdb_rating: selectedResult.vote_average || null,
            overview: selectedResult.overview || null,
            season_count: seasonCount,
            user_recommendation_note: note ? [{ type: "paragraph", children: [{ type: "text", text: note }] }] : null,
            user_rating: userRating,
            watch_providers: watchProviders,
            is_pinned: false,
            display_order: 0,
            movie_list: listId,
            movie_categories: genres.map(tmdbGenre => {
              const matchedCategory = categories.find((c: any) => c.genre_name.toLowerCase() === tmdbGenre.name.toLowerCase());
              return matchedCategory ? matchedCategory.documentId : null;
            }).filter(Boolean),
            media_details: finalMediaDetails,
            cast_details: castDetailsJSON.length > 0 ? castDetailsJSON : null,
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
              existingSnapshots={existingSnapshots}
              setExistingSnapshots={setExistingSnapshots as any}
              newSnapshots={newSnapshots}
              setNewSnapshots={setNewSnapshots as any}
              userRating={userRating}
              setUserRating={setUserRating}
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
