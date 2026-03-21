import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import { AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Star, MoreHorizontal, Trash2, Edit,
  Eye, EyeOff, Film, Copy, Loader2, Check, Clock, ChevronRight, Tv
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

import { MOVIES_BY_LIST } from "../../api/query";
import {
  DELETE_RECOMMENDED_MOVIE,
  TOGGLE_MOVIE_PIN,
  UPDATE_MOVIE_LIST,
  DELETE_MOVIE_LIST,
} from "../../api/mutation";
import type { RecommendedMovie } from "../../types";
import {
  buildPosterUrl,
  formatRating,
  formatRuntime,
  getGenreNames,
  extractNoteText,
  deduplicateMovies,
} from "../../utils/movieHelpers";
import AddMovie from "./AddMovie";
import TopPicksManager from "./TopPicksManager";
import MovieDetailModal from "../public/MovieDetailModal";

const VITE_BASE_URL = import.meta.env.VITE_BASE_URL || "https://explorers.earth";

// Movie Row Component
const MovieRow = ({
  movie,
  onEdit,
  onDelete,
  onPinToggle,
  onRowClick,
  isPinning,
}: {
  movie: RecommendedMovie;
  onEdit: () => void;
  onDelete: () => void;
  onPinToggle: () => void;
  onRowClick: () => void;
  isPinning: boolean;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const posterUrl = buildPosterUrl(movie.poster_path, "w185");
  const genres = getGenreNames(movie.genres);

  return (
    <div 
      onClick={onRowClick}
      className="group flex items-center gap-3 py-3 border-b border-dashboard-border last:border-0 hover:bg-white/5 cursor-pointer rounded-lg px-2 -mx-2 transition-colors"
    >
      {/* Poster */}
      <div className="w-10 flex-shrink-0 rounded overflow-hidden bg-white/5">
        <div className="aspect-[2/3]">
          {posterUrl ? (
            <img src={posterUrl} alt={movie.title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full bg-blue-950/30 flex items-center justify-center">
              <Film size={12} className="text-blue-600/40" />
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-dashboard truncate">{movie.title}</span>
          {movie.media_type === "TV" && <Tv size={11} className="text-blue-400 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-2 text-xs text-dashboard-light mt-0.5 flex-wrap">
          {movie.year && <span>{movie.year}</span>}
          {genres[0] && <span className="text-dashboard-muted">·</span>}
          {genres.slice(0, 2).map(g => <span key={g}>{g}</span>)}
          {movie.tmdb_rating != null && (
            <>
              <span className="text-dashboard-muted">·</span>
              <span className="flex items-center gap-0.5 text-yellow-400/70">
                <Star size={9} fill="currentColor" /> {formatRating(movie.tmdb_rating)}
              </span>
            </>
          )}
          {movie.runtime && (
            <>
              <span className="text-dashboard-muted">·</span>
              <span className="flex items-center gap-0.5">
                <Clock size={9} /> {formatRuntime(movie.runtime)}
              </span>
            </>
          )}
        </div>
        {extractNoteText(movie.user_recommendation_note) && (
          <p className="text-xs text-dashboard-light/60 mt-0.5 line-clamp-1">
            {extractNoteText(movie.user_recommendation_note)}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Pin button */}
        <button
          onClick={(e) => { e.stopPropagation(); onPinToggle(); }}
          disabled={isPinning}
          title={movie.is_pinned ? "Unpin from Top Picks" : "Pin to Top Picks"}
          className={`p-1.5 rounded-lg transition-all ${
            movie.is_pinned
              ? "text-yellow-400 bg-yellow-400/10"
              : "text-white/30 hover:text-yellow-400 hover:bg-yellow-400/10"
          } disabled:opacity-50`}
        >
          <Star size={14} fill={movie.is_pinned ? "currentColor" : "none"} />
        </button>

        {/* Three-dot menu */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-[#1a2332] border border-white/10 rounded-xl shadow-xl z-20 min-w-[130px] overflow-hidden">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-dashboard hover:bg-white/8 transition-colors"
              >
                <Edit size={13} /> Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main MovieListView Component
// ─────────────────────────────────────────────────────────────
const MovieListView = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"recommendations" | "manage">("recommendations");
  const [showAddMovie, setShowAddMovie] = useState(false);
  const [editingMovie, setEditingMovie] = useState<RecommendedMovie | null>(null);
  const [showTopPicks, setShowTopPicks] = useState(false);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [showDeleteListModal, setShowDeleteListModal] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<RecommendedMovie | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data, loading, refetch } = useQuery(MOVIES_BY_LIST, {
    variables: { movieListDocumentId: listId, page: 0, pageSize: 100 },
    skip: !listId,
    fetchPolicy: "cache-and-network",
  });

  const [togglePin] = useMutation(TOGGLE_MOVIE_PIN);
  const [deleteMovie] = useMutation(DELETE_RECOMMENDED_MOVIE);
  const [updateList] = useMutation(UPDATE_MOVIE_LIST);
  const [deleteList, { loading: deletingList }] = useMutation(DELETE_MOVIE_LIST);

  const list = data?.movieLists?.[0];
  const movies = deduplicateMovies(list?.recommended_movies as RecommendedMovie[]);
  const pinnedCount = movies.filter(m => m.is_pinned).length;

  // Public share URL
  const shareUrl = list ? `${VITE_BASE_URL}/${list.account?.username || ""}/movies/${list.slug}` : "";

  const handleToggleVisibility = async () => {
    if (!list) return;
    if (!list.Visibility && movies.length === 0) {
      toast.error("Add at least one movie before publishing.");
      return;
    }
    await updateList({
      variables: { documentId: list.documentId, Visibility: !list.Visibility },
      refetchQueries: [MOVIES_BY_LIST],
    });
    toast.success(list.Visibility ? "List set to draft." : "List published!");
  };

  const handlePinToggle = async (movie: RecommendedMovie) => {
    if (!movie.is_pinned && pinnedCount >= 15) {
      toast.error("Max 15 pinned movies allowed.");
      return;
    }
    setPinningId(movie.documentId);
    try {
      await togglePin({
        variables: {
          documentId: movie.documentId,
          is_pinned: !movie.is_pinned,
          pin_order: !movie.is_pinned ? pinnedCount : null,
        },
        refetchQueries: [MOVIES_BY_LIST],
      });
    } catch {
      toast.error("Failed to update pin.");
    } finally {
      setPinningId(null);
    }
  };

  const handleDeleteMovie = async (documentId: string) => {
    if (!window.confirm("Remove this movie from the list?")) return;
    try {
      await deleteMovie({ variables: { documentId }, refetchQueries: [MOVIES_BY_LIST] });
      toast.success("Movie removed.");
    } catch {
      toast.error("Failed to remove movie.");
    }
  };

  const handleDeleteList = async () => {
    if (!list) return;
    try {
      await deleteList({ variables: { documentId: list.documentId } });
      toast.success("List deleted.");
      navigate("/recommendations/movies");
    } catch {
      toast.error("Failed to delete list.");
    }
  };

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !list) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <div className="h-6 w-40 bg-white/5 animate-pulse rounded" />
        <div className="h-4 w-24 bg-white/5 animate-pulse rounded" />
        {[1,2,3,4,5].map(i => (
          <div key={i} className="h-14 bg-white/5 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!loading && !list) {
    return (
      <div className="p-6">
        <p className="text-red-400">List not found. <Link to="/recommendations/movies" className="text-blue-400 underline">Go back</Link></p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => navigate("/recommendations/movies")} className="text-white/50 hover:text-white mt-0.5 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-dashboard truncate">{list?.List_Name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-dashboard-light">
            <span>{movies.length} movie{movies.length !== 1 ? "s" : ""}</span>
            {pinnedCount > 0 && (
              <span className="flex items-center gap-1 text-yellow-400/70">
                <Star size={10} fill="currentColor" /> {pinnedCount}/15 pinned
              </span>
            )}
          </div>
        </div>
        {/* Publish toggle */}
        <button
          onClick={handleToggleVisibility}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all flex-shrink-0 ${
            list?.Visibility
              ? "border-green-500/40 text-green-400 bg-green-500/10"
              : "border-white/15 text-white/40 hover:border-white/25"
          }`}
        >
          {list?.Visibility ? <Eye size={11} /> : <EyeOff size={11} />}
          {list?.Visibility ? "Published" : "Draft"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-dashboard-muted p-1 rounded-xl">
        {(["recommendations", "manage"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg capitalize transition-all ${
              activeTab === tab
                ? "bg-dashboard-sidebar text-dashboard shadow-sm"
                : "text-dashboard-light hover:text-dashboard"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab: Recommendations */}
      {activeTab === "recommendations" && (
        <div>
          {/* Top picks button */}
          {pinnedCount > 0 && (
            <button
              onClick={() => setShowTopPicks(true)}
              className="w-full mb-4 flex items-center justify-between px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm hover:bg-yellow-500/15 transition-colors"
            >
              <span className="flex items-center gap-2 text-yellow-400">
                <Star size={14} fill="currentColor" /> Manage Top Picks ({pinnedCount}/15)
              </span>
              <ChevronRight size={14} className="text-yellow-400/60" />
            </button>
          )}

          {/* Add movie button */}
          <button
            onClick={() => { setEditingMovie(null); setShowAddMovie(true); }}
            className="w-full mb-4 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-white/10 rounded-xl text-sm text-white/40 hover:text-white/70 hover:border-blue-500/30 transition-all"
          >
            <Plus size={16} /> Add Movie or Show
          </button>

          {/* Movie list */}
          {movies.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Film size={40} className="text-white/15 mb-3" />
              <p className="text-dashboard-light text-sm">No movies added yet.</p>
              <p className="text-xs text-white/25 mt-1">Search TMDB to add your first recommendation.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {movies.map(movie => (
                <MovieRow
                  key={movie.documentId}
                  movie={movie}
                  onEdit={() => { setEditingMovie(movie); setShowAddMovie(true); }}
                  onDelete={() => handleDeleteMovie(movie.documentId)}
                  onPinToggle={() => handlePinToggle(movie)}
                  onRowClick={() => { setSelectedMovie(movie); setModalOpen(true); }}
                  isPinning={pinningId === movie.documentId}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Manage */}
      {activeTab === "manage" && (
        <div className="space-y-5">
          {/* Share URL */}
          <div className="bg-dashboard-muted rounded-xl p-4">
            <p className="text-xs text-dashboard-light uppercase tracking-wider mb-2">Share URL</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 bg-dashboard-sidebar px-3 py-2 rounded-lg text-sm text-dashboard truncate border border-dashboard-border"
              />
              <button
                onClick={handleCopyUrl}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-all ${
                  copied
                    ? "border-green-500/40 text-green-400 bg-green-500/10"
                    : "border-dashboard-border text-dashboard hover:bg-white/5"
                }`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* QR Code */}
          {list?.Visibility && shareUrl && (
            <div className="bg-dashboard-muted rounded-xl p-4 flex flex-col items-center">
              <p className="text-xs text-dashboard-light uppercase tracking-wider mb-3 self-start">QR Code</p>
              <div className="bg-white p-3 rounded-xl">
                <QRCodeSVG value={shareUrl} size={140} />
              </div>
            </div>
          )}

          {/* List settings */}
          <div className="bg-dashboard-muted rounded-xl p-4 space-y-3">
            <p className="text-xs text-dashboard-light uppercase tracking-wider">List Settings</p>
            <div>
              <label className="text-xs text-white/50 mb-1 block">List Name</label>
              <input
                defaultValue={list?.List_Name}
                onBlur={async (e) => {
                  if (e.target.value && e.target.value !== list?.List_Name) {
                    await updateList({ variables: { documentId: list?.documentId, List_Name: e.target.value }, refetchQueries: [MOVIES_BY_LIST] });
                    toast.success("List name updated.");
                  }
                }}
                className="w-full bg-dashboard-sidebar border border-dashboard-border rounded-lg px-3 py-2 text-sm text-dashboard"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Description</label>
              <textarea
                defaultValue={list?.list_description ?? ""}
                rows={3}
                onBlur={async (e) => {
                  if (e.target.value !== (list?.list_description ?? "")) {
                    await updateList({ variables: { documentId: list?.documentId, list_description: e.target.value }, refetchQueries: [MOVIES_BY_LIST] });
                    toast.success("Description updated.");
                  }
                }}
                className="w-full bg-dashboard-sidebar border border-dashboard-border rounded-lg px-3 py-2 text-sm text-dashboard resize-none"
              />
            </div>
          </div>

          {/* Danger zone */}
          <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-4">
            <p className="text-xs text-red-400/70 uppercase tracking-wider mb-2">Danger Zone</p>
            <button
              onClick={() => setShowDeleteListModal(true)}
              className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 size={14} /> Delete this list
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Movie overlay */}
      <AnimatePresence>
        {showAddMovie && listId && (
          <AddMovie
            listId={listId}
            mode={editingMovie ? "edit" : "create"}
            movie={editingMovie}
            onClose={() => { setShowAddMovie(false); setEditingMovie(null); }}
            onSaved={() => { refetch(); setShowAddMovie(false); setEditingMovie(null); }}
          />
        )}
      </AnimatePresence>

      {/* Top Picks Manager */}
      <AnimatePresence>
        {showTopPicks && listId && (
          <TopPicksManager
            movies={movies.filter(m => m.is_pinned)}
            allMovies={movies}
            onClose={() => setShowTopPicks(false)}
            onRefetch={() => refetch()}
            listId={listId}
          />
        )}
      </AnimatePresence>

      {/* Delete list confirm modal */}
      {showDeleteListModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#161b27] rounded-2xl border border-white/10 p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-white mb-2">Delete List?</h3>
            <p className="text-sm text-white/50 mb-5">
              This will permanently delete "{list?.List_Name}" and all its movies. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteListModal(false)} className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm text-white/60">
                Cancel
              </button>
              <button
                onClick={handleDeleteList}
                disabled={deletingList}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-sm text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {deletingList ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Movie detail modal */}
      <MovieDetailModal
        movie={selectedMovie}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedMovie(null); }}
      />
    </div>
  );
};

export default MovieListView;
