import { useState, useMemo } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Gamepad2, Star, ChevronRight, Loader2, X } from "lucide-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";

import useAuthStore from "../../../../store/store";
import { GAME_LISTS_BY_ACCOUNT } from "../../api/query";
import { CREATE_GAME_LIST, UPDATE_GAME_LIST } from "../../api/mutation";
import type { GameList, RecommendedGame } from "../../types";
import { deduplicateGames, buildCoverUrl, generateSlug } from "../../utils/gameHelpers";
import { getCurrentDomain } from "../../../../utils/getCurrentDomain";
import TopGamesHero from "../public/TopGamesHero";
import TopGamesMobileHero from "../public/TopGamesMobileHero";
import TopGamesManager from "./TopGamesManager";
import GameDetailModal from "../public/GameDetailModal";
import Switch from "../../../../components/ui/Switch";
import SwitchButton from "../../../../components/ui/SwitchButton";

const MY_ACCOUNT = gql`
  query MyAccountForGames($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      accounts {
        documentId
        Account_Name
        public_games
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
  const [createGameList, { loading }] = useMutation(CREATE_GAME_LIST);

  const formik = useFormik({
    initialValues: { List_Name: "", list_description: "", slug: "" },
    validationSchema: Yup.object({
      List_Name: Yup.string().required("List name is required").max(100),
      slug: Yup.string().required("List URL is required").max(100),
    }),
    onSubmit: async (values, { resetForm }) => {
      try {
        await createGameList({
          variables: {
            List_Name: values.List_Name,
            list_description: values.list_description || null,
            slug: values.slug || generateSlug(values.List_Name),
            Visibility: false,
            display_order: currentListCount,
            account: accountDocumentId,
          },
          refetchQueries: [GAME_LISTS_BY_ACCOUNT],
        });
        toast.success("Game list created!");
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
                placeholder="Enter List Name (e.g. My Favorite RPGs)"
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
                  {getCurrentDomain()}/{username}/games/
                </label>
                <input
                  type="text"
                  name="slug"
                  placeholder="enter-url-name"
                  value={formik.values.slug}
                  onChange={(e) => {
                    formik.handleChange(e);
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
const GameListCard = ({
  list,
  onOpen,
  onToggleVisibility,
  togglingId,
}: {
  list: GameList;
  onOpen: () => void;
  onToggleVisibility: (id: string, current: boolean) => void;
  togglingId: string | null;
}) => {
  const uniqueGames = deduplicateGames(list.recommended_games);
  const gameCount = uniqueGames.length;
  const pinnedCount = uniqueGames.filter(g => g.is_pinned).length;
  const previewGames = uniqueGames.slice(0, 5);

  return (
    <motion.div
      onClick={onOpen}
      className="bg-dashboard-sidebar border border-white/5 md:border-dashboard-border/30 rounded-2xl p-5 hover:border-white/15 cursor-pointer transition-all group"
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
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
            disabled={togglingId === list.documentId || gameCount === 0}
            label={list.Visibility ? "Published" : "Draft"}
          />
        </div>
      </div>

      {previewGames.length > 0 ? (
        <div className="flex gap-1.5 mb-4">
          {previewGames.map((g) => (
            <div key={g.documentId} className="w-12 rounded-md overflow-hidden flex-shrink-0 bg-white/5">
              <div className="aspect-[3/4]">
                {g.cover_url ? (
                  <img
                    src={buildCoverUrl(g.cover_url)}
                    alt={g.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-blue-950/40 flex items-center justify-center">
                    <Gamepad2 size={12} className="text-blue-600/40" />
                  </div>
                )}
              </div>
            </div>
          ))}
          {gameCount > 5 && (
            <div className="w-12 rounded-md flex items-center justify-center bg-white/5 flex-shrink-0 aspect-[3/4]">
              <span className="text-xs text-dashboard-muted">+{gameCount - 5}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="h-16 rounded-lg bg-white/3 border border-dashed border-dashboard-border flex items-center justify-center mb-4">
          <p className="text-xs text-dashboard-muted">No games yet</p>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-dashboard-muted">
        <div className="flex items-center gap-3">
          <span>{uniqueGames.length} game{uniqueGames.length !== 1 ? "s" : ""}</span>
          {pinnedCount > 0 && (
            <span className="flex items-center gap-1 text-yellow-400/60 font-medium">
              <Star size={10} fill="currentColor" /> {pinnedCount} pinned
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 text-blue-400 group-hover:text-blue-300 transition-colors font-medium">
          Open <ChevronRight size={13} />
        </span>
      </div>
    </motion.div>
  );
};

const GamesHome = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageTopGames, setShowManageTopGames] = useState(false);
  const [selectedGame, setSelectedGame] = useState<RecommendedGame | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data: accountData } = useQuery(MY_ACCOUNT, {
    variables: { documentId: user?.documentId },
    skip: !user?.documentId,
  });
  const accountDocumentId = accountData?.usersPermissionsUser?.accounts?.[0]?.documentId;

  const { data, loading, refetch } = useQuery(GAME_LISTS_BY_ACCOUNT, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
    fetchPolicy: "cache-and-network",
  });

  const [updateGameList] = useMutation(UPDATE_GAME_LIST);

  const [updateAccountVisibility] = useMutation(gql`
    mutation UpdateGamesVisibility($documentId: ID!, $data: AccountInput!) {
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

    const currentValue = acc.public_games;
    const newValue = currentValue === "Yes" ? "No" : "Yes";

    try {
      await updateAccountVisibility({
        variables: {
          documentId: acc.documentId,
          data: { public_games: newValue }
        },
        optimisticResponse: {
          updateAccount: {
            __typename: 'Account',
            documentId: acc.documentId,
            public_games: newValue,
            public_recommendations: acc.public_recommendations,
            public_movie: acc.public_movie,
            public_books: acc.public_books,
            public_music: acc.public_music
          }
        },
        refetchQueries: [{ query: MY_ACCOUNT, variables: { documentId: user?.documentId } }]
      });
      toast.success(`Games visibility updated to ${newValue === "Yes" ? "Public" : "Private"}`);
    } catch (error) {
      console.error("Error updating visibility:", error);
      toast.error("Failed to update visibility");
    }
  };

  const lists: GameList[] = data?.gameLists || [];

  const allGames = useMemo(() => {
    if (!lists) return [];
    return lists.flatMap(l => l.recommended_games || []);
  }, [lists]);

  const topPicks = useMemo(() => {
    return deduplicateGames(allGames.filter((g: any) => g.is_pinned))
      .sort((a: any, b: any) => (a.pin_order || 999) - (b.pin_order || 999));
  }, [allGames]);

  const handleToggleVisibility = async (documentId: string, currentVisibility: boolean) => {
    setTogglingId(documentId);
    try {
      await updateGameList({
        variables: { documentId, Visibility: !currentVisibility },
        refetchQueries: [GAME_LISTS_BY_ACCOUNT],
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
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm text-white font-medium transition-all shadow-lg shadow-blue-900/30"
        >
          <Plus size={18} />
          <span>New List</span>
        </button>

        <div className="flex items-center gap-3 bg-dashboard-muted/50 pl-3 pr-0 md:px-4 py-2 rounded-xl">
          <div className="flex flex-col">
            <span className="text-[10px] md:text-xs font-bold text-white leading-tight">Public Visibility</span>
            <span className="text-[9px] md:text-[10px] text-white/50 leading-tight">Games</span>
          </div>
          <SwitchButton
            isChecked={accountData?.usersPermissionsUser?.accounts?.[0]?.public_games === "Yes"}
            onChange={handleVisibilityToggle}
            variant="blue"
          />
        </div>
      </div>

      {/* Loading state */}
      {loading && lists.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-dashboard-muted rounded-2xl h-52 animate-pulse" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-blue-900/20 border border-blue-800/30 flex items-center justify-center mb-5">
            <Gamepad2 size={36} className="text-blue-500/60" />
          </div>
          <h2 className="text-lg font-semibold text-dashboard mb-2">No game lists yet</h2>
          <p className="text-sm text-dashboard-light max-w-sm mb-6">
            Create your first game list to start sharing your favorite titles with the world.
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
          {/* Top Picks Hero Section */}
          {topPicks.length > 0 && (
            <div className="mb-8">
              <div className="hidden lg:block">
                <TopGamesHero 
                  games={topPicks} 
                  onGameClick={setSelectedGame} 
                  showManageButton={true}
                  onManageClick={() => setShowManageTopGames(true)}
                />
              </div>
              <div className="block lg:hidden">
                <TopGamesMobileHero
                  games={topPicks}
                  onGameClick={setSelectedGame}
                  showManageButton={true}
                  onManageClick={() => setShowManageTopGames(true)}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lists.map(list => (
              <GameListCard
                key={list.documentId}
                list={list}
                onOpen={() => navigate(`/recommendations/games/${list.documentId}`)}
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

      {/* Modals */}
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

      {showManageTopGames && (
        <TopGamesManager
          games={topPicks}
          allGames={deduplicateGames(allGames)}
          onClose={() => setShowManageTopGames(false)}
          onRefetch={() => { refetch(); }}
        />
      )}

      {selectedGame && (
        <GameDetailModal
          open={!!selectedGame}
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </div>
  );
};

export default GamesHome;
