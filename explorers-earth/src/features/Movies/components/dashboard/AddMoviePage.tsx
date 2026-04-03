import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@apollo/client";
import {
  ArrowLeft, Film, Star, Tv, Clock,
  Loader2, Check, Search, X, CheckCircle2, User, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useTMDBSearch } from "../../hooks/useTMDBSearch";
import tmdbService from "../../../../services/tmdbService";
import { CREATE_RECOMMENDED_MOVIE, UPDATE_RECOMMENDED_MOVIE } from "../../api/mutation";
import { MOVIE_CATEGORIES, MOVIES_BY_LIST } from "../../api/query";
import type { TMDBSearchResult, WatchProvider, TMDBCastMember } from "../../types";
import {
  buildPosterUrl, buildBackdropUrl, extractYear, extractNoteText, getGenreNames,
} from "../../utils/movieHelpers";
import axios from "axios";
import useAuthStore from "../../../../store/store";
import {
  generateMovieUploadPath,
  generateRandomFileName,
  sanitizeUsername,
} from "../../../../utils/uploadPathGenerator";
import TiptapEditor from "../../../Favorites/components/TiptapEditor";

const FALLBACK_POSTER = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='150' viewBox='0 0 100 150'><rect width='100' height='150' fill='%230d1117'/></svg>`;

// ──────────────────────────────────────────────
// Inline Search (only in create mode)
// ──────────────────────────────────────────────
const InlineSearch = ({
  onSelect,
  onClear,
  selectedTitle,
}: {
  onSelect: (r: TMDBSearchResult) => void;
  onClear: () => void;
  selectedTitle?: string;
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(!selectedTitle);
  const { results, loading } = useTMDBSearch(query);

  if (selectedTitle && !open) {
    return (
      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-6">
        <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
        <span className="text-sm text-white flex-1 truncate">{selectedTitle}</span>
        <button
          onClick={() => { onClear(); setOpen(true); setQuery(""); }}
          className="text-white/30 hover:text-white transition-colors"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <label className="text-sm font-semibold text-white/90 mb-2 block">Search TMDB</label>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          autoFocus
          type="text"
          placeholder='Search "Interstellar", "Breaking Bad"...'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-dashboard-muted border border-dashboard-border rounded-xl pl-9 pr-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none focus:border-dashboard-accent transition-all"
        />
        {loading && (
          <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 animate-spin" />
        )}
      </div>

      {results.length > 0 && (
        <div className="mt-2 bg-dashboard-sidebar border border-dashboard-border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
          {results.map((result) => {
            const title = result.title || result.name || "Unknown";
            const year = extractYear(result.release_date || result.first_air_date);
            const posterUrl = buildPosterUrl(result.poster_path, "w185");
            return (
              <button
                key={result.id}
                onClick={() => { onSelect(result); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dashboard-muted border-b border-dashboard-border last:border-b-0 transition-colors text-left"
              >
                <div className="w-8 flex-shrink-0 rounded overflow-hidden bg-dashboard-muted">
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
                  <div className="flex items-center gap-2 text-xs text-white/40">
                    <span>{year}</span>
                    {result.media_type === "tv"
                      ? <span className="flex items-center gap-0.5 text-blue-400"><Tv size={10} /> TV</span>
                      : <span className="flex items-center gap-0.5"><Film size={10} /> Movie</span>}
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

      {query.length > 2 && !loading && results.length === 0 && (
        <p className="text-sm text-white/30 text-center py-4">No results found.</p>
      )}
      {query.length === 0 && (
        <p className="text-xs text-white/30 mt-2">Start typing to search movies & TV shows on TMDB</p>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────
// Form state interface
// ──────────────────────────────────────────────
interface FormState {
  title: string;
  originalTitle: string;
  year: string;
  director: string;
  runtime: string;
  seasonCount: string;
  rating: string;
  overview: string;
  genres: string;
  note: string;
  userRating: number | null;
  categoryIds: string[];
}

// ──────────────────────────────────────────────
// Main Page — handles both create & edit
// ──────────────────────────────────────────────
const AddMoviePage = () => {
  const { user, token } = useAuthStore();
  // listId is always present; movieId only in edit mode
  const { listId, movieId } = useParams<{ listId: string; movieId?: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(movieId);

  const [selected, setSelected] = useState<TMDBSearchResult | null>(null);
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [posterPath, setPosterPath] = useState<string | null>(null);
  const [backdropPath, setBackdropPath] = useState<string | null>(null);
  const [watchProviders, setWatchProviders] = useState<WatchProvider[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rawGenres, setRawGenres] = useState<{ id: number; name: string }[]>([]);
  const [castMembers, setCastMembers] = useState<TMDBCastMember[]>([]);
  const [existingSnapshots, setExistingSnapshots] = useState<{ id: string; url: string }[]>([]);
  const [newSnapshots, setNewSnapshots] = useState<File[]>([]);
  const [formReady, setFormReady] = useState(!isEdit); // in create mode form is ready immediately

  const [form, setForm] = useState<FormState>({
    title: "", originalTitle: "", year: "", director: "",
    runtime: "", seasonCount: "", rating: "", overview: "",
    genres: "", note: "", userRating: null, categoryIds: [],
  });

  const { data: categoriesData } = useQuery(MOVIE_CATEGORIES, {
    fetchPolicy: 'network-only'
  });
  const categories = categoriesData?.movieCategories ?? [];

  // For edit mode: load existing movie data from the list query
  const { data: listData } = useQuery(MOVIES_BY_LIST, {
    variables: { movieListDocumentId: listId, page: 0, pageSize: 100 },
    skip: !isEdit || !listId,
    fetchPolicy: "cache-and-network",
  });

  // Populate form from existing movie when in edit mode
  useEffect(() => {
    if (!isEdit || !movieId || !listData) return;
    const movies = listData?.movieLists?.[0]?.recommended_movies ?? [];
    const movie = movies.find((m: any) => m.documentId === movieId);
    if (!movie) return;

    setPosterPath(movie.poster_path ?? null);
    setBackdropPath(movie.backdrop_path ?? null);
    setMediaType((movie.media_type?.toLowerCase() as "movie" | "tv") ?? "movie");
    setWatchProviders(movie.watch_providers ?? []);

    const genreNames = getGenreNames(movie.genres);

    if (movie.cast_details && Array.isArray(movie.cast_details)) {
      setCastMembers(movie.cast_details.map((c: any, index: number) => ({
        id: index,
        name: c.original_name,
        character: c.character,
        profile_path: c.profile_url
      })));
    } else {
      setCastMembers([]);
    }

    if (movie.media_details?.imageDetails) {
      setExistingSnapshots(movie.media_details.imageDetails);
    } else {
      setExistingSnapshots([]);
    }

    setForm({
      title: movie.title ?? "",
      originalTitle: movie.original_title ?? "",
      year: movie.year ?? "",
      director: movie.director ?? "",
      runtime: movie.runtime ? String(movie.runtime) : "",
      seasonCount: movie.season_count ? String(movie.season_count) : "",
      rating: movie.tmdb_rating ? String(movie.tmdb_rating) : "",
      overview: movie.overview ?? "",
      genres: genreNames.join(", "),
      note: extractNoteText(movie.user_recommendation_note) ?? "",
      userRating: movie.user_rating ?? null,
      categoryIds: movie.movie_categories?.map((c: any) => c.documentId) || [],
    });
    setFormReady(true);
    if (!movie.watch_providers || movie.watch_providers.length === 0) {
      void fetchProviders(movie.tmdb_id, movie.media_type?.toLowerCase() as "movie" | "tv", true);
    }
  }, [isEdit, movieId, listData]);

  const [createMovie] = useMutation(CREATE_RECOMMENDED_MOVIE);
  const [updateMovie] = useMutation(UPDATE_RECOMMENDED_MOVIE);

  const setField = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  // ── TMDB select (create mode only) ──
  const handleSelect = async (result: TMDBSearchResult) => {
    setSelected(result);
    setMediaType(result.media_type as "movie" | "tv");
    setLoadingDetails(true);
    setWatchProviders([]);
    try {
      if (result.media_type === "movie") {
        const d = await tmdbService.getMovieDetails(result.id);
        setPosterPath(d.poster_path);
        setBackdropPath(d.backdrop_path);
        setRawGenres(d.genres);
        setCastMembers(d.credits?.cast?.slice(0, 10) || []);
        setForm({
          title: d.title,
          originalTitle: d.original_title,
          year: extractYear(d.release_date),
          director: tmdbService.extractDirector(d) || "",
          runtime: d.runtime ? String(d.runtime) : "",
          seasonCount: "",
          rating: d.vote_average ? d.vote_average.toFixed(1) : "",
          overview: d.overview || "",
          genres: d.genres.map((g) => g.name).join(", "),
          note: "",
          userRating: null,
          categoryIds: [],
        });
      } else {
        const d = await tmdbService.getTVDetails(result.id);
        setPosterPath(d.poster_path);
        setBackdropPath(d.backdrop_path);
        setRawGenres(d.genres);
        setCastMembers(d.credits?.cast?.slice(0, 10) || []);
        setForm({
          title: d.name,
          originalTitle: d.original_name,
          year: extractYear(d.first_air_date),
          director: d.created_by?.[0]?.name || "",
          runtime: d.episode_run_time?.[0] ? String(d.episode_run_time[0]) : "",
          seasonCount: d.number_of_seasons ? String(d.number_of_seasons) : "",
          rating: d.vote_average ? d.vote_average.toFixed(1) : "",
          overview: d.overview || "",
          genres: d.genres.map((g) => g.name).join(", "),
          note: "",
          userRating: null,
          categoryIds: [],
        });
      }
    } catch {
      setPosterPath(result.poster_path);
      setBackdropPath(result.backdrop_path);
      setRawGenres([]);
      setCastMembers([]);
      setForm({
        title: result.title || result.name || "",
        originalTitle: "",
        year: extractYear(result.release_date || result.first_air_date),
        director: "",
        runtime: "",
        seasonCount: "",
        rating: result.vote_average ? result.vote_average.toFixed(1) : "",
        overview: result.overview || "",
        genres: "",
        note: "",
        userRating: null,
        categoryIds: [],
      });
    } finally {
      setLoadingDetails(false);
      void fetchProviders(result.id, result.media_type as "movie" | "tv", true);
    }
  };

  const handleClear = () => {
    setSelected(null);
    setPosterPath(null);
    setBackdropPath(null);
    setRawGenres([]);
    setCastMembers([]);
    setWatchProviders([]);
    setExistingSnapshots([]);
    setNewSnapshots([]);
    setForm({ title: "", originalTitle: "", year: "", director: "", runtime: "", seasonCount: "", rating: "", overview: "", genres: "", note: "", userRating: null, categoryIds: [] });
  };

  const fetchProviders = async (id?: number, type?: "movie" | "tv", silent = false) => {
    // If called directly via onClick, the arguments might accidentally be React event objects. Guard by checking typeof.
    const tmdbId = typeof id === "number" ? id : (selected?.id ?? null);
    const mType = typeof type === "string" ? type : mediaType;
    
    if (!tmdbId) return;
    setLoadingProviders(true);
    try {
      const providers = await tmdbService.getWatchProviders(tmdbId, mType);
      setWatchProviders(providers);
      if (providers.length === 0 && !silent) toast.info("No streaming providers found for this title.");
    } catch {
      if (!silent) toast.error("Could not fetch providers.");
    } finally {
      setLoadingProviders(false);
    }
  };

  const handleSave = async () => {
    if (!listId) return;
    if (!form.title.trim()) { toast.error("Title is required."); return; }
    setSaving(true);
    try {
      let uploadedImageDetails = [...existingSnapshots];

      if (newSnapshots.length > 0) {
        toast.loading("Uploading snapshots...", { id: "upload-snapshots" });
        try {
          const manualUploads = await Promise.all(
            newSnapshots.map(async (file, idx) => {
              const usernameStr = sanitizeUsername(user?.username || "user");
              // Safely extract TMDB id
              const tmdbIdStr = isEdit && movieId 
                ? (listData?.movieLists?.[0]?.recommended_movies?.find((m: any) => m.documentId === movieId)?.tmdb_id || "unknown")
                : String(selected?.id || "unknown");
              
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

      if (isEdit && movieId) {
        // Edit mode — update only editable fields
        await updateMovie({
          variables: {
            documentId: movieId,
            user_recommendation_note: form.note
              ? [{ type: "paragraph", children: [{ type: "text", text: form.note }] }]
              : null,
            user_rating: form.userRating,
            watch_providers: watchProviders,
            movie_categories: form.categoryIds,
            media_details: finalMediaDetails,
          },
          refetchQueries: [MOVIES_BY_LIST],
        });
        toast.success("Movie updated!");
      } else {
        if (!selected) return;

        let finalPosterPath = posterPath;
        let finalBackdropPath = backdropPath;

        const uploadImageToS3 = async (urlPath: string, type: string) => {
          if (!urlPath) return urlPath;
          
          let fullUrl = "";
          if (type === 'poster') {
             fullUrl = buildPosterUrl(urlPath, "original");
          } else if (type === 'backdrop') {
             fullUrl = buildBackdropUrl(urlPath, "original");
          } else {
             // For cast profiles
             fullUrl = buildPosterUrl(urlPath, "w185");
          }

          try {
            toast.loading(`Uploading ${type}...`, { id: `upload-${type}` });
            const tmdbRes = await axios.get(fullUrl, { responseType: 'blob' });
            const blob = tmdbRes.data;
            const fileType = blob.type || "image/jpeg";
            
            const usernameStr = sanitizeUsername(user?.username || "user");
            const tmdbIdStr = String(selected.id);
            const randomFileName = generateRandomFileName(`${type}.jpg`);
            const fullS3Path = generateMovieUploadPath(usernameStr, listId, tmdbIdStr, randomFileName);
            const directoryPath = fullS3Path.substring(0, fullS3Path.lastIndexOf('/'));

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

            toast.success(`${type} uploaded successfully!`, { id: `upload-${type}` });
            if (uploadRes.data?.[0]?.url) {
              return uploadRes.data[0].url;
            }
          } catch (err: any) {
            console.error(`CATCH ERROR while uploading ${type}:`, err);
            toast.error(`Error uploading ${type} to S3.`, { id: `upload-${type}` });
            throw new Error(`Failed to upload ${type} to S3: ` + err.message);
          }
          return urlPath; // fallback
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
            tmdb_id: String(selected.id),
            media_type: mediaType === "tv" ? "TV" : "Movie",
            title: form.title,
            original_title: form.originalTitle || null,
            year: form.year || null,
            poster_path: finalPosterPath,
            backdrop_path: finalBackdropPath,
            genres: rawGenres.length > 0 ? rawGenres : [],
            director: form.director || null,
            runtime: form.runtime ? parseInt(form.runtime) : null,
            tmdb_rating: form.rating ? parseFloat(form.rating) : null,
            overview: form.overview || null,
            season_count: form.seasonCount ? parseInt(form.seasonCount) : null,
            user_recommendation_note: form.note
              ? [{ type: "paragraph", children: [{ type: "text", text: form.note }] }]
              : null,
            user_rating: form.userRating,
            watch_providers: watchProviders,
            is_pinned: false,
            display_order: 0,
            movie_list: listId,
            movie_categories: rawGenres.map(tmdbGenre => {
              const matchedCategory = categories.find((c: any) => c.genre_name.toLowerCase() === tmdbGenre.name.toLowerCase());
              return matchedCategory ? matchedCategory.documentId : null;
            }).filter(Boolean),
            media_details: finalMediaDetails,
            cast_details: castDetailsJSON.length > 0 ? castDetailsJSON : null,
          },
          refetchQueries: [MOVIES_BY_LIST],
        });
        toast.success("Movie added!");
      }
      navigate(`/recommendations/movies/${listId}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const posterUrl = buildPosterUrl(posterPath, "w342");
  const backdropUrl = buildBackdropUrl(backdropPath, "w780");
  const showForm = isEdit ? formReady : Boolean(selected);

  return (
    <div className="min-h-screen text-dashboard">
      {/* Sticky header */}
      <div className="border-b border-dashboard-border px-6 py-4 flex items-center gap-3 sticky top-0 bg-dashboard-bg z-10">
        <button
          onClick={() => navigate(`/recommendations/movies/${listId}`)}
          className="text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-dashboard">
            {isEdit ? "Edit Movie" : "Add Movie or Show"}
          </h1>
          <p className="text-xs text-dashboard-muted mt-0.5">
            {isEdit
              ? "Update the details and save your changes"
              : selected
                ? "Edit the details below before saving"
                : "Search and select a title from TMDB"}
          </p>
        </div>
        {loadingDetails && (
          <div className="flex items-center gap-2 text-xs text-blue-400">
            <Loader2 size={14} className="animate-spin" />
            Loading details…
          </div>
        )}
      </div>

      {/* Single-column form */}
      <div className="max-w-2xl mx-auto px-6 pt-8 pb-40 md:pb-8 space-y-5">

        {/* Search — only in create mode */}
        {!isEdit && (
          <InlineSearch
            onSelect={handleSelect}
            onClear={handleClear}
            selectedTitle={selected ? (selected.title || selected.name) : undefined}
          />
        )}

        {/* Form — shown when movie selected (create) or data loaded (edit) */}
        {showForm && (
          <>
            {/* Backdrop + poster strip */}
            {(backdropUrl || posterUrl) && (
              <div className="relative rounded-xl overflow-hidden bg-white/5 mb-2">
                {backdropUrl ? (
                  <img src={backdropUrl} alt="" className="w-full h-32 object-cover opacity-25" />
                ) : (
                  <div className="w-full h-32 bg-gradient-to-r from-blue-900/20 to-purple-900/20" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-dashboard-bg via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4 flex items-end gap-3">
                  {posterUrl && (
                    <div className="w-12 rounded-lg overflow-hidden shadow-xl border border-white/10 flex-shrink-0">
                      <div className="aspect-[2/3]">
                        <img
                          src={posterUrl}
                          alt={form.title}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = FALLBACK_POSTER; }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="pb-0.5 flex items-center gap-2 text-xs text-dashboard-muted">
                    {mediaType === "tv"
                      ? <span className="flex items-center gap-0.5 text-blue-400"><Tv size={10} /> TV Show</span>
                      : <span className="flex items-center gap-0.5"><Film size={10} /> Movie</span>}
                    {form.rating && (
                      <span className="flex items-center gap-0.5 text-yellow-400/70">
                        <Star size={10} fill="currentColor" /> {form.rating}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-5">

              {/* Title */}
              <div>
                <label className="text-sm font-semibold text-white/90 mb-2 block">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={setField("title")}
                  readOnly={isEdit}
                  className={`w-full bg-dashboard-muted border border-dashboard-border rounded-xl px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none transition-colors ${isEdit ? "opacity-60 cursor-not-allowed" : "focus:border-dashboard-accent"}`}
                />
              </div>

              {/* Original Title */}
              {form.originalTitle && (
                <div>
                  <label className="text-sm font-semibold text-dashboard mb-2 block">Original Title</label>
                  <input
                    type="text"
                    value={form.originalTitle}
                    onChange={setField("originalTitle")}
                    readOnly={isEdit}
                    className={`w-full bg-dashboard-muted border border-dashboard-border rounded-xl px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none transition-colors ${isEdit ? "opacity-60 cursor-not-allowed" : "focus:border-dashboard-accent"}`}
                  />
                </div>
              )}

              {/* Year + Director */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-dashboard mb-2 block">Year</label>
                  <input
                    type="text"
                    value={form.year}
                    onChange={setField("year")}
                    readOnly={isEdit}
                    placeholder="e.g. 2008"
                    className={`w-full bg-dashboard-muted border border-dashboard-border rounded-xl px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none transition-colors ${isEdit ? "opacity-60 cursor-not-allowed" : "focus:border-dashboard-accent"}`}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-dashboard mb-2 block">
                    {mediaType === "tv" ? "Created By" : "Director"}
                  </label>
                  <input
                    type="text"
                    value={form.director}
                    onChange={setField("director")}
                    readOnly={isEdit}
                    placeholder="e.g. Vince Gilligan"
                    className={`w-full bg-dashboard-muted border border-dashboard-border rounded-xl px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none transition-colors ${isEdit ? "opacity-60 cursor-not-allowed" : "focus:border-dashboard-accent"}`}
                  />
                </div>
              </div>

              {/* Runtime + Rating */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-dashboard mb-2 block">
                    {mediaType === "tv" ? "Seasons" : "Runtime (minutes)"}
                  </label>
                  <div className="relative">
                    <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dashboard-muted" />
                    <input
                      type="number"
                      value={mediaType === "tv" ? form.seasonCount : form.runtime}
                      onChange={setField(mediaType === "tv" ? "seasonCount" : "runtime")}
                      readOnly={isEdit}
                      placeholder={mediaType === "tv" ? "e.g. 5" : "e.g. 62"}
                      className={`w-full bg-dashboard-muted border border-dashboard-border rounded-xl pl-9 pr-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none transition-colors ${isEdit ? "opacity-60 cursor-not-allowed" : "focus:border-dashboard-accent"}`}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-semibold text-dashboard mb-2 block">TMDB Rating</label>
                  <div className="relative">
                    <Star size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-400/60" fill="currentColor" />
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={form.rating}
                      onChange={setField("rating")}
                      readOnly={isEdit}
                      placeholder="e.g. 9.5"
                      className={`w-full bg-dashboard-muted border border-dashboard-border rounded-xl pl-9 pr-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none transition-colors ${isEdit ? "opacity-60 cursor-not-allowed" : "focus:border-dashboard-accent"}`}
                    />
                  </div>
                </div>
              </div>

              {/* Genres */}
              <div>
                <label className="text-sm font-semibold text-white/90 mb-2 block">Genres</label>
                <input
                  type="text"
                  value={form.genres}
                  onChange={setField("genres")}
                  readOnly={isEdit}
                  placeholder="e.g. Drama, Crime, Thriller"
                  className={`w-full bg-dashboard-muted border border-dashboard-border rounded-xl px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none transition-colors ${isEdit ? "opacity-60 cursor-not-allowed" : "focus:border-dashboard-accent"}`}
                />
              </div>

              {/* Cast Members Preview */}
              {castMembers.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-white/90 mb-2 block">Top Cast</p>
                  <div className="flex overflow-x-auto pb-4 gap-3 hide-scrollbar scrollbar-hide">
                    {castMembers.map(c => (
                      <div key={c.id} className="flex flex-col flex-shrink-0 w-20 gap-1 rounded-xl">
                        <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border border-dashboard-border bg-dashboard-muted">
                          {c.profile_path ? (
                            <img 
                              src={c.profile_path.startsWith('http') ? c.profile_path : (c.profile_path.startsWith('/') ? `${import.meta.env.VITE_REST_API_URL?.replace('/api', '') || 'http://localhost:1337'}${c.profile_path}` : `https://image.tmdb.org/t/p/w185${c.profile_path}`)} 
                              className="w-full h-full object-cover" 
                              alt="" 
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/20">
                              <User size={24} />
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-center leading-tight mt-1 text-white truncate">{c.name}</span>
                        <span className="text-[10px] text-center text-white/40 leading-tight truncate">{c.character}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Overview */}
              <div>
                <label className="text-sm font-semibold text-white/90 mb-2 block">Overview</label>
                <textarea
                  rows={4}
                  value={form.overview}
                  onChange={setField("overview")}
                  readOnly={isEdit}
                  placeholder="Brief description..."
                  className={`w-full bg-dashboard-muted border border-dashboard-border rounded-xl px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none transition-colors resize-none ${isEdit ? "opacity-60 cursor-not-allowed" : "focus:border-dashboard-accent"}`}
                />
              </div>

              {/* Watch Providers */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-dashboard">Watch Providers</label>
                  {loadingProviders && (
                    <span className="text-xs text-dashboard-muted flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" /> Fetching...
                    </span>
                  )}
                </div>
                {watchProviders.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {watchProviders.map((p, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-dashboard-muted">
                        <Clock size={10} /> {p.provider_name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-dashboard-muted">
                    {loadingProviders ? "Checking streaming platforms..." : "No provider data available."}
                  </p>
                )}
              </div>

              <div className="border-t border-dashboard-border pt-1">
                <p className="text-xs text-dashboard-muted uppercase tracking-wider mb-4 font-medium">Your Details</p>
              </div>



              {/* Recommendation note */}
              <div>
                <label className="text-sm font-semibold text-dashboard mb-2 block">Your Recommendation Note (optional)</label>
                <div className="focus-within:border-dashboard-accent transition-colors">
                  <TiptapEditor
                    value={form.note}
                    initalValue={form.note}
                    onChange={(val) => setForm((f) => ({ ...f, note: val }))}
                    placeholder="Why do you recommend this? What makes it special?"
                  />
                </div>
              </div>

              {/* User Rating */}
              <div className="mt-4">
                <label className="text-sm font-semibold text-dashboard mb-2 block">Your Rating</label>
                <div className="flex gap-1.5 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, userRating: star }))}
                      className={`p-1 transition-all hover:scale-110 active:scale-95 ${form.userRating && form.userRating >= star ? "text-yellow-400" : "text-white/20 hover:text-white/40"}`}
                    >
                      <Star size={24} fill={form.userRating && form.userRating >= star ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Snapshots Upload */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-semibold text-dashboard">Manual Snapshots from {mediaType === "tv" ? "Show" : "Movie"} (Optional)</label>
                </div>
                <div className="flex flex-col gap-3">
                  {/* Existing Snapshots */}
                  {existingSnapshots.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-2">
                      {existingSnapshots.map((snap) => (
                        <div key={snap.id} className="relative w-24 h-24 rounded-xl overflow-hidden shadow-sm group">
                          <img src={snap.url.startsWith('http') ? snap.url : (snap.url.startsWith('/') ? `${import.meta.env.VITE_REST_API_URL?.replace('/api', '') || 'http://localhost:1337'}${snap.url}` : snap.url)} className="w-full h-full object-cover" alt="Snapshot" />
                          <button
                            type="button"
                            onClick={() => setExistingSnapshots(prev => prev.filter(s => s.id !== snap.id))}
                            className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* New Snapshots Preview */}
                  {newSnapshots.length > 0 && (
                    <div className="flex flex-wrap gap-3 mb-2">
                      {newSnapshots.map((file, i) => (
                        <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden shadow-sm group border border-white/10">
                          <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="New Snapshot preview" />
                          <button
                            type="button"
                            onClick={() => setNewSnapshots(prev => prev.filter((_, idx) => idx !== i))}
                            className="absolute top-1 right-1 bg-black/60 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Button */}
                  <label className="w-full md:w-auto self-start cursor-pointer flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 border-dashed rounded-xl px-5 py-3 text-sm text-white/70 transition-colors">
                    <Upload size={16} className="text-white/50" />
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



              {/* Actions */}
              <div className="pt-4 border-t border-dashboard-border">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/recommendations/movies/${listId}`)}
                    className="px-6 py-3 rounded-xl bg-dashboard-muted hover:bg-white/10 text-sm text-white font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.title.trim()}
                    className="flex-1 py-3 rounded-xl bg-dashboard-accent hover:opacity-90 text-sm text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                    {isEdit ? "Save Changes" : "Add to List"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AddMoviePage;
