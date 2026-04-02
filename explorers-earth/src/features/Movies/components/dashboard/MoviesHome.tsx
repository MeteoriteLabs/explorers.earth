import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Film, Star, ChevronRight, Loader2, X } from "lucide-react";
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
import SwitchButton from "../../../../components/ui/SwitchButton";
import { getCurrentDomain } from "../../../../utils/getCurrentDomain";
import TopPicksHero from "../public/TopPicksHero";
import TopPicksMobileHero from "../public/TopPicksMobileHero";
import TopPicksManager from "./TopPicksManager";
import MovieDetailModal from "../public/MovieDetailModal";
import type { RecommendedMovie } from "../../types";
import Switch from "../../../../components/ui/Switch";

// Query to get account documentId
const MY_ACCOUNT = gql`
  query MyAccountForMovies($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      accounts {
        documentId
        Account_Name
        public_movie
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
  username,
}: {
  open: boolean;
  onClose: () => void;
  accountDocumentId: string;
  currentListCount: number;
  onCreated: () => void;
  username: string;
}) => {
  const [createMovieList, { loading }] = useMutation(CREATE_MOVIE_LIST);

  const formik = useFormik({
    initialValues: { List_Name: "", list_description: "", slug: "" },
    validationSchema: Yup.object({
      List_Name: Yup.string().required("List name is required").max(100),
      slug: Yup.string().required("List URL is required").max(100),
    }),
    onSubmit: async (values, { resetForm }) => {
      try {
        await createMovieList({
          variables: {
            List_Name: values.List_Name,
            list_description: values.list_description || null,
            slug: values.slug || generateSlug(values.List_Name),
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
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4 md:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-dashboard-sidebar rounded-xl border border-dashboard-border p-6 md:p-8 w-full max-w-2xl shadow-2xl"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-dashboard">Create New List</h2>
            <button onClick={onClose} className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-dashboard-muted hover:text-dashboard transition-colors">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={formik.handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-dashboard mb-2 block">
                List Name
              </label>
              <input
                type="text"
                name="List_Name"
                placeholder="Enter List Name (e.g. Mind-Bending Sci-Fi)"
                value={formik.values.List_Name}
                onChange={(e) => {
                  formik.handleChange(e);
                  formik.setFieldValue("slug", generateSlug(e.target.value));
                }}
                onBlur={formik.handleBlur}
                className="w-full bg-dashboard-muted border border-dashboard-border rounded-lg px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none focus:border-dashboard-accent transition-colors"
              />
              {formik.touched.List_Name && formik.errors.List_Name && (
                <p className="text-xs text-red-400 mt-1">{formik.errors.List_Name}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-dashboard mb-2 block">
                Description
              </label>
              <textarea
                name="list_description"
                placeholder="Enter a note or description for this list"
                rows={4}
                value={formik.values.list_description}
                onChange={formik.handleChange}
                className="w-full bg-dashboard-muted border border-dashboard-border rounded-lg px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none focus:border-dashboard-accent transition-colors resize-none"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-dashboard mb-2 block">
                List URL
              </label>
              <div className="flex w-full md:flex-row flex-col md:items-center">
                <label className="w-full md:w-auto text-sm font-medium text-dashboard mr-2 shrink-0 mb-2 md:mb-0">
                  {getCurrentDomain()}/{username}/
                </label>
                <input
                  type="text"
                  name="slug"
                  placeholder="Enter the name to create a shareable link"
                  value={formik.values.slug}
                  onChange={(e) => {
                    formik.handleChange(e);
                    // Ensure slug format (lowercase, no spaces)
                    formik.setFieldValue("slug", generateSlug(e.target.value));
                  }}
                  onBlur={formik.handleBlur}
                  className="w-full bg-dashboard-muted border border-dashboard-border rounded-lg px-4 py-3 text-sm text-dashboard placeholder-dashboard-muted focus:outline-none focus:border-dashboard-accent transition-colors"
                />
              </div>
              {formik.touched.slug && formik.errors.slug && (
                <p className="text-xs text-red-400 mt-1">{formik.errors.slug}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-dashboard-border">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-lg bg-[#ef4444] hover:bg-[#dc2626] text-sm text-white font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-sm text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
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
      onClick={onOpen}
      className="bg-dashboard-sidebar border border-white/5 md:border-dashboard-border/30 rounded-2xl p-5 hover:border-white/15 cursor-pointer transition-all group"
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-dashboard truncate">{list.List_Name}</h3>
          {list.list_description && (
            <p className="text-xs text-dashboard-muted mt-0.5 line-clamp-2">{list.list_description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Switch
            checked={list.Visibility}
            onChange={() => onToggleVisibility(list.documentId, list.Visibility)}
            disabled={togglingId === list.documentId || movieCount === 0}
            label={list.Visibility ? "Published" : "Draft"}
          />
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
              <span className="text-xs text-dashboard-muted">+{movieCount - 5}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="h-16 rounded-lg bg-white/3 border border-dashed border-dashboard-border flex items-center justify-center mb-4">
          <p className="text-xs text-dashboard-muted">No movies yet</p>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between text-xs text-dashboard-muted">
        <div className="flex items-center gap-3">
          <span>{movieCount} movie{movieCount !== 1 ? "s" : ""}</span>
          {pinnedCount > 0 && (
            <span className="flex items-center gap-1 text-yellow-400/60">
              <Star size={10} fill="currentColor" /> {pinnedCount} pinned
            </span>
          )}
        </div>
        <span
          className="flex items-center gap-1 text-blue-400 group-hover:text-blue-300 transition-colors font-medium"
        >
          Open <ChevronRight size={13} />
        </span>
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
  const [showManageTopPicks, setShowManageTopPicks] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<RecommendedMovie | null>(null);
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

  const [updateAccountVisibility] = useMutation(gql`
    mutation UpdateMovieVisibility($documentId: ID!, $data: AccountInput!) {
      updateAccount(documentId: $documentId, data: $data) {
        documentId
        public_recommendations
        public_movie
        public_books
        public_games
        public_music
      }
    }
  `);

  const handleVisibilityToggle = async () => {
    const acc = accountData?.usersPermissionsUser?.accounts?.[0];
    if (!acc?.documentId) return;

    const currentValue = acc.public_movie;
    const newValue = currentValue === "Yes" ? "No" : "Yes";

    try {
      await updateAccountVisibility({
        variables: {
          documentId: acc.documentId,
          data: { public_movie: newValue }
        },
        optimisticResponse: {
          updateAccount: {
            __typename: 'Account',
            documentId: acc.documentId,
            public_movie: newValue,
            // Including others to satisfy selection set if needed, though usually optimistic only needs the field being updated
            public_recommendations: acc.public_recommendations,
            public_books: acc.public_books,
            public_games: acc.public_games,
            public_music: acc.public_music
          }
        },
        refetchQueries: [{ query: MY_ACCOUNT, variables: { documentId: user?.documentId } }]
      });
      toast.success(`Movies visibility updated to ${newValue === "Yes" ? "Public" : "Private"}`);
    } catch (error) {
      console.error("Error updating visibility:", error);
      toast.error("Failed to update visibility");
    }
  };

  const lists: MovieList[] = data?.movieLists ?? [];

  const allMovies = useMemo(() => {
    if (!lists) return [];
    return lists.flatMap(l => l.recommended_movies || []);
  }, [lists]);

  const topPicks = useMemo(() => {
    return deduplicateMovies(allMovies.filter((m: any) => m.is_pinned)).sort((a: any, b: any) => (a.pin_order || 999) - (b.pin_order || 999));
  }, [allMovies]);

  const handleMovieClick = (movie: any) => {
    setSelectedMovie(movie);
  };

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
    <div className="px-2 md:px-6 pt-2 pb-24 md:pb-6 max-w-4xl mx-auto">
      {/* Action Header Row */}
      <div className="flex items-center justify-between bg-dashboard-sidebar/40 px-3 py-3 rounded-2xl mb-2">
        <div className="flex items-center gap-3 bg-dashboard-muted/50 pl-3 pr-0 md:px-4 py-2 rounded-xl">
          <div className="flex flex-col">
            <span className="text-[10px] md:text-xs font-bold text-white leading-tight">Public Visibility</span>
            <span className="text-[9px] md:text-[10px] text-white/50 leading-tight">Movies & Shows</span>
          </div>
          <SwitchButton
            isChecked={accountData?.usersPermissionsUser?.accounts?.[0]?.public_movie === "Yes"}
            onChange={handleVisibilityToggle}
            variant="blue"
          />
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium transition-all shadow-lg shadow-blue-900/30"
        >
          <Plus size={18} />
          <span>New List</span>
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
        <>
          {/* Top Picks Section explicitly requested by user */}
          {topPicks.length > 0 && (
            <div className="mb-8">
              <div className="hidden lg:block">
                <TopPicksHero 
                  movies={topPicks} 
                  onMovieClick={handleMovieClick} 
                  showManageButton={true}
                  onManageClick={() => setShowManageTopPicks(true)}
                />
              </div>
              <div className="block lg:hidden">
                <TopPicksMobileHero
                  movies={topPicks}
                  onMovieClick={handleMovieClick}
                  showManageButton={true}
                  onManageClick={() => setShowManageTopPicks(true)}
                />
              </div>
            </div>
          )}

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
            className="border-2 border-dashed border-dashboard-border rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-dashboard-muted hover:text-dashboard hover:border-dashboard-border transition-all duration-200 min-h-[160px]"
            whileHover={{ scale: 1.01 }}
          >
            <Plus size={24} />
            <span className="text-sm">Add new list</span>
          </motion.button>
        </div>
        </>
      )}

      {/* Create list modal */}
      {accountDocumentId && (
        <CreateListModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          accountDocumentId={accountDocumentId}
          currentListCount={lists.length}
          onCreated={() => refetch()}
          username={user?.username || ""}
        />
      )}

      {showManageTopPicks && (
        <TopPicksManager
          movies={topPicks}
          allMovies={deduplicateMovies(allMovies)}
          onClose={() => setShowManageTopPicks(false)}
          onRefetch={() => refetch()}
          listId=""
        />
      )}

      {selectedMovie && (
        <MovieDetailModal
          open={!!selectedMovie}
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
        />
      )}
    </div>
  );
};

export default MoviesHome;
