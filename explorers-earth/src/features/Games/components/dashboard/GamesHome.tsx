import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, gql } from "@apollo/client";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Gamepad2, Star, ChevronRight, Loader2, X, ChevronDown } from "lucide-react";
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
import { AddIcon } from "../../../../assets/icons/AddIcon";
import HeroSkeleton from "../../../../components/ui/HeroSkeleton";
import { CategoryVisibilityModal } from "../../../../components/CategoryVisibilityModal";

const MY_ACCOUNT = gql`
  query MyAccountForGames($documentId: ID!) {
    usersPermissionsUser(documentId: $documentId) {
      accounts {
        documentId
        Account_Name
        public_games
        public_recommendations
        public_movie
        public_books
        public_music
      }
    }
  }
`;

// Create List Modal
export const CreateGameListModal = ({
  open,
  onClose,
  accountDocumentId,
  currentListCount,
  onCreated,
  username,
  defaultListName,
}: {
  open: boolean;
  onClose: () => void;
  accountDocumentId: string;
  currentListCount: number;
  onCreated: (newId?: string) => void;
  username: string;
  defaultListName?: string;
}) => {
  const [createGameList, { loading }] = useMutation(CREATE_GAME_LIST);

  const formik = useFormik({
    initialValues: { 
      List_Name: defaultListName || "", 
      list_description: "", 
      slug: defaultListName ? generateSlug(defaultListName) : "" 
    },
    enableReinitialize: true,
    validationSchema: Yup.object({
      List_Name: Yup.string().required("List name is required").max(100),
      slug: Yup.string().required("List URL is required").max(100),
    }),
    onSubmit: async (values, { resetForm }) => {
      try {
        const result = await createGameList({
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
        onCreated(result?.data?.createGameList?.documentId);
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
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4 md:p-6"
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
export const GameListCard = ({
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
  const previewGames = uniqueGames.slice(0, 4);

  return (
    <motion.div
      onClick={onOpen}
      className="bg-dashboard-sidebar border border-white/5 md:border-dashboard-border/30 rounded-2xl p-5 hover:border-white/15 cursor-pointer transition-all group"
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-dashboard truncate">{list.List_Name}</h3>
            <span className={`text-[10px] font-semibold text-white px-1.5 py-0.5 rounded-md uppercase tracking-wider font-poppins shrink-0 ${
              list.Visibility ? "bg-emerald-500/90" : "bg-slate-500/90"
            }`}>
              {list.Visibility ? "Public" : "Draft"}
            </span>
          </div>
          {list.list_description && (
            <p className="text-xs text-dashboard-muted mt-0.5 line-clamp-2">{list.list_description}</p>
          )}
        </div>
        <div
          className="flex items-center gap-2 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Switch
            checked={list.Visibility}
            onChange={() => onToggleVisibility(list.documentId, list.Visibility)}
            disabled={gameCount === 0}
            loading={togglingId === list.documentId}
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
          {gameCount > 4 && (
            <div className="w-12 rounded-md flex items-center justify-center bg-white/5 flex-shrink-0 aspect-[3/4]">
              <span className="text-xs text-dashboard-muted">+{gameCount - 4}</span>
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
  const location = useLocation();
  const { user } = useAuthStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageTopGames, setShowManageTopGames] = useState(false);
  const [selectedGame, setSelectedGame] = useState<RecommendedGame | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [visibilityPrompt, setVisibilityPrompt] = useState<{
    isOpen: boolean;
    categoryName: string;
    visibilityField: string;
    defaultValue: boolean;
  } | null>(null);

  const { data: accountData } = useQuery(MY_ACCOUNT, {
    variables: { documentId: user?.documentId },
    skip: !user?.documentId,
  });
  const accountDocumentId = accountData?.usersPermissionsUser?.accounts?.[0]?.documentId;

  useEffect(() => {
    if (location.state?.justCreatedList && accountData) {
      const acc = accountData?.usersPermissionsUser?.accounts?.[0];
      const isPublic = acc?.public_games === "Yes";
      const hasNoValue = acc?.public_games !== "No" && acc?.public_games !== "Yes";
      const currentStatus = isPublic || hasNoValue;
      if (!currentStatus) {
        setVisibilityPrompt({
          isOpen: true,
          categoryName: "Games",
          visibilityField: "public_games",
          defaultValue: true,
        });
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state, accountData]);



  const { data, loading, refetch } = useQuery(GAME_LISTS_BY_ACCOUNT, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
    fetchPolicy: "cache-and-network",
  });

  useEffect(() => {
    if (!loading) {
      (window as any).__dashboardLoaded = true;
    }
  }, [loading]);

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
    const list = lists.find(l => l.documentId === documentId);
    if (!list) return;
    setTogglingId(documentId);
    try {
      await updateGameList({
        variables: { documentId, Visibility: !currentVisibility },
        optimisticResponse: {
          updateGameList: {
            __typename: "GameList",
            documentId: list.documentId,
            List_Name: list.List_Name,
            list_description: list.list_description,
            slug: list.slug,
            Visibility: !currentVisibility,
            display_order: list.display_order,
            top_picks_heading: list.top_picks_heading || null,
          }
        },
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
      {/* Desktop view header */}
      <div className="hidden md:flex justify-between items-center bg-dashboard-sidebar/40 px-4 py-3.5 rounded-2xl mb-4">
        {/* Left: Public switch */}
        <div className="flex items-center gap-2 bg-dashboard-muted/50 px-3 py-2 rounded-xl">
          <SwitchButton
            isChecked={accountData?.usersPermissionsUser?.accounts?.[0]?.public_games === "Yes"}
            onChange={handleVisibilityToggle}
            variant="blue"
          />
          <span className="text-[10px] md:text-xs text-[#4ade80] font-semibold leading-tight whitespace-nowrap">
            Public Visibility
          </span>
        </div>
        {/* Right: New list btn */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-dashboard-accent hover:opacity-90 text-sm text-white font-medium transition-all shadow-lg shadow-blue-900/30 whitespace-nowrap"
        >
          <AddIcon size="5" />
          <span>New List</span>
        </button>
      </div>

      {/* Mobile view header (split action button with visibility dropdown) */}
      <div className="md:hidden relative mb-4 w-full">
        <div className="flex w-full rounded-2xl overflow-hidden border border-white/10 shadow-lg shadow-blue-900/15">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-1 bg-dashboard-accent hover:opacity-90 text-xs font-bold text-white py-3 px-4 text-left flex items-center gap-1.5 transition-all"
          >
            <AddIcon size="4" />
            <span>New List</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen(!dropdownOpen);
            }}
            className="bg-dashboard-accent border-l border-white/20 px-3 flex items-center justify-center cursor-pointer transition-all hover:opacity-90"
          >
            <ChevronDown size={14} className={`transform transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
        {/* Dropdown panel */}
        {dropdownOpen && (
          <div className="absolute top-[calc(100%+6px)] right-0 left-0 p-3.5 z-50 border border-dashboard-accent/30 rounded-2xl bg-dashboard-sidebar/95 backdrop-blur-md shadow-xl flex justify-between items-center">
            <span className="text-[11px] text-white/90 font-semibold">Manage Public Visibility</span>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase ${accountData?.usersPermissionsUser?.accounts?.[0]?.public_games === "Yes" ? "text-[#4ade80]" : "text-[#f87171]"}`}>
                {accountData?.usersPermissionsUser?.accounts?.[0]?.public_games === "Yes" ? "Pub" : "Draft"}
              </span>
              <SwitchButton
                isChecked={accountData?.usersPermissionsUser?.accounts?.[0]?.public_games === "Yes"}
                onChange={handleVisibilityToggle}
                variant="blue"
              />
            </div>
          </div>
        )}
      </div>

      {/* Loading state */}
      {(loading || !accountDocumentId) && lists.length === 0 ? (
        <div className="space-y-6">
          {/* Hero skeleton — Desktop */}
          <div className="hidden lg:block">
            <HeroSkeleton accentColor="blue" variant="dashboard" showThumbnails />
          </div>
          {/* Hero skeleton — Mobile */}
          <div className="lg:hidden">
            <HeroSkeleton accentColor="blue" variant="dashboard" mobile />
          </div>
          {/* List card skeletons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="relative bg-dashboard-muted rounded-2xl h-[168px] overflow-hidden border border-white/4 skeleton-card">
                <div className="absolute inset-0 skeleton-shimmer" />
                {/* Card header */}
                <div className="absolute top-5 left-5 right-5 flex justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="h-4 w-36 rounded bg-white/8" />
                    <div className="h-3 w-48 rounded bg-white/5" />
                  </div>
                  <div className="h-6 w-20 rounded-full bg-white/8" />
                </div>
                {/* Preview covers */}
                <div className="absolute bottom-5 left-5 flex gap-1.5">
                  {[0,1,2,3,4].map(j => (
                    <div key={j} className="w-12 h-12 rounded bg-white/8" />
                  ))}
                </div>
              </div>
            ))}
          </div>
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
          {topPicks.length > 0 ? (
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
          ) : (
            /* Empty Placeholder banner */
            allGames.length > 0 && (
              <div
                onClick={() => setShowManageTopGames(true)}
                className="w-full flex items-center justify-between p-4 rounded-[14px] border border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10 transition-all duration-300 cursor-pointer mb-6"
              >
                <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-[#fbbf24] font-poppins">
                  <span className="text-amber-400">★</span> Manage Top Picks ({topPicks.length}/{deduplicateGames(allGames).length})
                </div>
                <div className="flex items-center text-amber-500">
                  <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            )
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
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
              className="border-[2.2px] border-dashed border-dashboard-border rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-dashboard-muted hover:text-white hover:border-dashboard-accent hover:bg-dashboard-accent/5 transition-all duration-300 min-h-[160px]"
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
        <CreateGameListModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          accountDocumentId={accountDocumentId}
          currentListCount={lists.length}
          onCreated={() => {
            refetch();
            const acc = accountData?.usersPermissionsUser?.accounts?.[0];
            const isPublic = acc?.public_games === "Yes";
            const hasNoValue = acc?.public_games !== "No" && acc?.public_games !== "Yes";
            const currentStatus = isPublic || hasNoValue;
            if (!currentStatus) {
              setVisibilityPrompt({
                isOpen: true,
                categoryName: "Games",
                visibilityField: "public_games",
                defaultValue: true,
              });
            }
          }}
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
      {visibilityPrompt && accountDocumentId && (
        <CategoryVisibilityModal
          isOpen={visibilityPrompt.isOpen}
          onClose={() => setVisibilityPrompt(null)}
          categoryName={visibilityPrompt.categoryName}
          visibilityField={visibilityPrompt.visibilityField}
          accountDocumentId={accountDocumentId}
          onSuccess={() => {
            refetch();
          }}
        />
      )}
    </div>
  );
};

export default GamesHome;
