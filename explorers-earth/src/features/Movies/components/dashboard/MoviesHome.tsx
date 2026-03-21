import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Film, Eye, EyeOff, Star, ChevronRight, Loader2, X } from "lucide-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";

import useAuthStore from "../../../../store/store";
import { MOVIE_LISTS_BY_ACCOUNT } from "../../api/query";
import { CREATE_MOVIE_LIST, UPDATE_MOVIE_LIST } from "../../api/mutation";
import type { MovieList } from "../../types";
import { deduplicateMovies } from "../../utils/movieHelpers";
import { generateSlug, buildPosterUrl } from "../../utils/movieHelpers";
import { gql } from "@apollo/client";

// Query to get account documentId
const MY_ACCOUNT = gql`
  query MyAccountForMovies($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      accounts {
        documentId
        Account_Name
      }
    }
  }
`;

// Create List Modal
const CreateListModal = ({
  open,
  onClose,
  accountDocumentId,
  currentListCount,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  accountDocumentId: string;
  currentListCount: number;
  onCreated: () => void;
}) => {
  const [createMovieList, { loading }] = useMutation(CREATE_MOVIE_LIST);

  const formik = useFormik({
    initialValues: { List_Name: "", list_description: "" },
    validationSchema: Yup.object({
      List_Name: Yup.string().required("List name is required").max(100),
    }),
    onSubmit: async (values, { resetForm }) => {
      try {
        await createMovieList({
          variables: {
            List_Name: values.List_Name,
            list_description: values.list_description || null,
            slug: generateSlug(values.List_Name),
            Visibility: false,
            display_order: currentListCount,
            account: accountDocumentId,
          },
          refetchQueries: [MOVIE_LISTS_BY_ACCOUNT],
        });
        toast.success("Movie list created!");
        resetForm();
        onCreated();
        onClose();
      } catch (e) {
        toast.error("Failed to create list. Please try again.");
      }
    },
  });

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-[#161b27] rounded-2xl border border-white/10 p-6 w-full max-w-md shadow-2xl"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white">Create New List</h2>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={formik.handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">
                List Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="List_Name"
                placeholder='e.g. "Mind-Bending Sci-Fi"'
                value={formik.values.List_Name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
              {formik.touched.List_Name && formik.errors.List_Name && (
                <p className="text-xs text-red-400 mt-1">{formik.errors.List_Name}</p>
              )}
              {formik.values.List_Name && (
                <p className="text-xs text-white/30 mt-1">
                  Slug: {generateSlug(formik.values.List_Name)}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">
                Description (optional)
              </label>
              <textarea
                name="list_description"
                placeholder="What is this list about?"
                rows={3}
                value={formik.values.list_description}
                onChange={formik.handleChange}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm text-white/60 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Create List
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// List Card
const MovieListCard = ({
  list,
  onOpen,
  onToggleVisibility,
  togglingId,
}: {
  list: MovieList;
  onOpen: () => void;
  onToggleVisibility: (id: string, current: boolean) => void;
  togglingId: string | null;
}) => {
  const uniqueMovies = deduplicateMovies(list.recommended_movies);
  const movieCount = uniqueMovies.length;
  const pinnedCount = uniqueMovies.filter(m => m.is_pinned).length;
  const previewMovies = uniqueMovies.slice(0, 5);

  return (
    <motion.div
      className="bg-[#161b27] border border-white/8 rounded-2xl p-5 hover:border-blue-500/30 transition-all group"
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white truncate">{list.List_Name}</h3>
          {list.list_description && (
            <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{list.list_description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onToggleVisibility(list.documentId, list.Visibility)}
            disabled={togglingId === list.documentId || movieCount === 0}
            className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1 transition-all ${
              list.Visibility
                ? "border-green-500/40 text-green-400 bg-green-500/10"
                : "border-white/15 text-white/40"
            } disabled:opacity-40`}
          >
            {list.Visibility ? <Eye size={11} /> : <EyeOff size={11} />}
            {list.Visibility ? "Published" : "Draft"}
          </button>
        </div>
      </div>

      {/* Movie preview posters */}
      {previewMovies.length > 0 ? (
        <div className="flex gap-1.5 mb-4">
          {previewMovies.map((m) => (
            <div key={m.documentId} className="w-12 rounded-md overflow-hidden flex-shrink-0 bg-white/5">
              <div className="aspect-[2/3]">
                {m.poster_path ? (
                  <img
                    src={buildPosterUrl(m.poster_path, "w185")}
                    alt={m.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-blue-950/40 flex items-center justify-center">
                    <Film size={12} className="text-blue-600/40" />
                  </div>
                )}
              </div>
            </div>
          ))}
          {movieCount > 5 && (
            <div className="w-12 rounded-md flex items-center justify-center bg-white/5 flex-shrink-0 aspect-[2/3]">
              <span className="text-xs text-white/40">+{movieCount - 5}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="h-16 rounded-lg bg-white/3 border border-dashed border-white/10 flex items-center justify-center mb-4">
          <p className="text-xs text-white/30">No movies yet</p>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-white/40">
        <div className="flex items-center gap-3">
          <span>{movieCount} movie{movieCount !== 1 ? "s" : ""}</span>
          {pinnedCount > 0 && (
            <span className="flex items-center gap-1 text-yellow-400/60">
              <Star size={10} fill="currentColor" /> {pinnedCount} pinned
            </span>
          )}
        </div>
        <button
          onClick={onOpen}
          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors font-medium"
        >
          Open <ChevronRight size={13} />
        </button>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main MoviesHome Component
// ─────────────────────────────────────────────────────────────
const MoviesHome = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Get account documentId
  const { data: accountData } = useQuery(MY_ACCOUNT, {
    variables: { documentId: user?.documentId },
    skip: !user?.documentId,
  });
  const accountDocumentId = accountData?.usersPermissionsUser?.accounts?.[0]?.documentId;

  // Fetch movie lists
  const { data, loading, refetch } = useQuery(MOVIE_LISTS_BY_ACCOUNT, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
    fetchPolicy: "cache-and-network",
  });

  const [updateMovieList] = useMutation(UPDATE_MOVIE_LIST);

  const lists: MovieList[] = data?.movieLists ?? [];

  const handleToggleVisibility = async (documentId: string, currentVisibility: boolean) => {
    setTogglingId(documentId);
    try {
      await updateMovieList({
        variables: { documentId, Visibility: !currentVisibility },
        refetchQueries: [MOVIE_LISTS_BY_ACCOUNT],
      });
    } catch {
      toast.error("Failed to update visibility.");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-dashboard flex items-center gap-2">
            <Film size={24} className="text-blue-400" />
            Movies & Shows
          </h1>
          <p className="text-sm text-dashboard-light mt-1">
            {lists.length > 0 ? `${lists.length} list${lists.length !== 1 ? "s" : ""}` : "Start curating your movie lists"}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium transition-colors shadow-lg shadow-blue-900/30"
        >
          <Plus size={16} /> New List
        </button>
      </div>

      {/* Loading state */}
      {loading && lists.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-dashboard-muted rounded-2xl h-52 animate-pulse" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-blue-900/20 border border-blue-800/30 flex items-center justify-center mb-5">
            <Film size={36} className="text-blue-500/60" />
          </div>
          <h2 className="text-lg font-semibold text-dashboard mb-2">No movie lists yet</h2>
          <p className="text-sm text-dashboard-light max-w-sm mb-6">
            Create your first movie list to start sharing your favorite films and shows.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium transition-colors"
          >
            <Plus size={16} /> Create First List
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lists.map(list => (
            <MovieListCard
              key={list.documentId}
              list={list}
              onOpen={() => navigate(`/recommendations/movies/${list.documentId}`)}
              onToggleVisibility={handleToggleVisibility}
              togglingId={togglingId}
            />
          ))}
          {/* Add new list card */}
          <motion.button
            onClick={() => setShowCreateModal(true)}
            className="border-2 border-dashed border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-white/30 hover:text-white/60 hover:border-white/20 transition-all duration-200 min-h-[160px]"
            whileHover={{ scale: 1.01 }}
          >
            <Plus size={24} />
            <span className="text-sm">Add new list</span>
          </motion.button>
        </div>
      )}

      {/* Create list modal */}
      {accountDocumentId && (
        <CreateListModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          accountDocumentId={accountDocumentId}
          currentListCount={lists.length}
          onCreated={() => refetch()}
        />
      )}
    </div>
  );
};

export default MoviesHome;
