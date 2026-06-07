import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Star, MoreVertical, Trash2,
  Loader2, Gamepad2, Pencil, Copy, Check, ChevronRight
} from "lucide-react";
import { AddIcon } from "../../../../assets/icons/AddIcon";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import Accordion from "../../../../components/ui/Accordian";
import useAuthStore from "../../../../store/store";
import { GAMES_BY_LIST } from "../../api/query";
import {
  UPDATE_GAME_LIST, DELETE_GAME_LIST,
  TOGGLE_GAME_PIN, DELETE_RECOMMENDED_GAME,
} from "../../api/mutation";
import { deduplicateGames, buildCoverUrl, extractNoteText } from "../../utils/gameHelpers";
import type { RecommendedGame, GameList } from "../../types";
import TopGamesManager from "./TopGamesManager";
import Switch from "../../../../components/ui/Switch";
import GameDetailModal from "../public/GameDetailModal";

const VITE_BASE_URL = import.meta.env.VITE_BASE_URL || window.location.origin;

interface GameRowProps {
  game: RecommendedGame;
  onPinToggle: (game: RecommendedGame) => void;
  onEdit: (game: RecommendedGame) => void;
  onDelete: (game: RecommendedGame) => void;
  onClick: (game: RecommendedGame) => void;
  isPinning: boolean;
}

const GameRow = ({ game, onPinToggle, onEdit, onDelete, onClick, isPinning }: GameRowProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const notePreview = extractNoteText(game.user_recommendation_note);
  const coverUrl = buildCoverUrl(game.cover_url_large || game.cover_url);

  return (
    <div
      className="group flex items-center gap-3 py-3 border-b border-dashboard-border last:border-0 hover:bg-white/5 cursor-pointer rounded-lg px-2 -mx-2 transition-colors"
      onClick={() => onClick(game)}
    >
      <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-white/5 shadow-sm">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gamepad2 size={14} className="text-white/20" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{game.title}</p>
        <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5 flex-wrap">
          {game.developer && <span className="truncate max-w-[150px]">{game.developer}</span>}
          {game.release_year && (
             <>
               <span className="text-white/20">·</span>
               <span>{game.release_year}</span>
             </>
          )}
          {game.user_rating && (
            <>
              <span className="text-white/20">·</span>
              <span className="flex items-center gap-0.5 text-amber-400/80">
                <Star size={10} fill="currentColor" /> {game.user_rating}
              </span>
            </>
          )}
        </div>
        {notePreview && (
          <p className="text-[11px] text-white/30 truncate mt-1 italic line-clamp-1">
            {notePreview.replace(/<[^>]+>/g, '')}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onPinToggle(game); }}
          disabled={isPinning}
          title={game.is_pinned ? "Unpin from Top Picks" : "Pin to Top Picks"}
          className={`p-1.5 rounded-lg transition-all ${
            game.is_pinned
              ? "text-amber-400 bg-amber-400/10"
              : "text-white/30 hover:text-amber-400 hover:bg-amber-400/10"
          } disabled:opacity-50`}
        >
          <Star size={14} fill={game.is_pinned ? "currentColor" : "none"} />
        </button>

        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all"
          >
            <MoreVertical size={14} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                className="absolute right-0 top-full mt-1 bg-[#1a2332] border border-white/10 rounded-xl shadow-xl z-20 min-w-[120px] overflow-hidden"
                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button onClick={() => { setMenuOpen(false); onEdit(game); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/80 hover:bg-white/8 transition-colors">
                  <Pencil size={13} /> Edit
                </button>
                <button onClick={() => { setMenuOpen(false); onDelete(game); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 size={13} /> Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const ManageTab = ({ list, onRefetch }: { list: GameList; onRefetch: () => void }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [updateGameList, { loading: isUpdating }] = useMutation(UPDATE_GAME_LIST);
  const [deleteGameList] = useMutation(DELETE_GAME_LIST);

  const shareUrl = `${VITE_BASE_URL}/${list.account?.username ?? "user"}/games/${list.slug}`;

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleVisibility = async () => {
    try {
      if (!list.Visibility && list.recommended_games?.length === 0) {
        toast.error("Add at least one game before publishing.");
        return;
      }
      await updateGameList({
        variables: { documentId: list.documentId, Visibility: !list.Visibility },
        optimisticResponse: {
          updateGameList: {
            __typename: "GameList",
            documentId: list.documentId,
            List_Name: list.List_Name,
            list_description: list.list_description,
            slug: list.slug,
            Visibility: !list.Visibility,
            display_order: list.display_order,
            top_picks_heading: list.top_picks_heading || null,
          }
        }
      });
      toast.success(list.Visibility ? "List set to Draft." : "List published!");
      onRefetch();
    } catch {
      toast.error("Failed to update visibility.");
    }
  };

  const handleDeleteList = async () => {
    if (!window.confirm(`Delete "${list.List_Name}"? This cannot be undone.`)) return;
    try {
      await deleteGameList({ variables: { documentId: list.documentId } });
      toast.success("List deleted.");
      navigate("/recommendations/games");
    } catch {
      toast.error("Failed to delete list.");
    }
  };

  return (
    <div className="mb-0 md:mt-2 md:w-[90%] md:mx-auto space-y-4">
      <div className="bg-transparent rounded-lg space-y-4 border border-white/10 p-6">
        <Accordion heading="Manage" defaultOpen={true}>
          <div className="flex flex-col gap-3">
            <button
              onClick={handleDeleteList}
              className="flex flex-row text-center gap-2 items-center rounded-md font-poppins w-full text-sm border border-white px-4 py-3 hover:border-gray-500 text-white hover:text-gray-500 justify-center font-medium transition-all duration-300"
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>

            {isEditing ? (
              <div className="bg-dashboard-sidebar border border-white/10 rounded-lg p-5 space-y-4 mt-2 mb-2 text-left">
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block uppercase tracking-wider font-semibold">List Name</label>
                  <input
                    defaultValue={list.List_Name}
                    onBlur={async (e) => {
                      if (e.target.value && e.target.value !== list.List_Name) {
                        await updateGameList({ variables: { documentId: list.documentId, List_Name: e.target.value } });
                        toast.success("List name updated.");
                        onRefetch();
                      }
                    }}
                    className="w-full bg-dashboard-muted border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block uppercase tracking-wider font-semibold">Description</label>
                  <textarea
                    defaultValue={list.list_description || ""}
                    rows={3}
                    onBlur={async (e) => {
                      if (e.target.value !== (list.list_description || "")) {
                        await updateGameList({ variables: { documentId: list.documentId, list_description: e.target.value } });
                        toast.success("Description updated.");
                        onRefetch();
                      }
                    }}
                    className="w-full bg-dashboard-muted border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-white/30 transition-colors"
                  />
                </div>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl flex justify-center text-sm mt-3 transition-all font-semibold"
                >
                  Done Editing
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex flex-row text-center gap-2 items-center rounded-md font-poppins w-full text-sm border border-white px-4 py-3 hover:border-gray-500 text-white hover:text-gray-500 justify-center font-medium transition-all duration-300"
              >
                <Pencil size={16} />
                <span>Edit</span>
              </button>
            )}

            <div className={`p-4 rounded-xl border transition-all mt-2 ${list.Visibility ? "border-green-500/30 bg-green-500/5" : "border-white/10"} flex justify-center items-center`}>
              <Switch
                checked={list.Visibility}
                onChange={handleToggleVisibility}
                loading={isUpdating}
                label={list.Visibility ? "Published (Visible to public)" : "Draft (Private)"}
              />
            </div>
          </div>
        </Accordion>

        <Accordion heading="My QR" defaultOpen={true}>
          <div className={`relative pb-2 ${!list.Visibility ? "blur-sm pointer-events-none" : ""}`}>
            {!list.Visibility && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-auto">
                <span className="bg-[#1a2332] px-4 py-2 rounded-lg text-sm text-white/90 shadow-2xl border border-white/10 backdrop-blur-md">
                  Publish list to share QR
                </span>
              </div>
            )}
            
            <div className="flex justify-center items-center my-6">
              <div className="flex relative flex-col justify-between items-center h-[16rem] w-[14rem] p-6 bg-black border border-white text-white rounded-lg">
                <div className="absolute bottom-0 left-0 w-full h-1/2 rounded-b-lg bg-gradient-to-t from-amber-600/20 to-transparent pointer-events-none" />
                <p className="text-sm tracking-wide font-medium z-10 text-center leading-snug">My Games</p>
                <div className="z-10 items-center flex flex-col pt-1">
                  <div className="p-2 bg-white rounded-lg shadow-md mb-3">
                    <QRCodeSVG id="game-qr" value={shareUrl} size={90} />
                  </div>
                  <p className="bg-amber-100 text-amber-900 px-4 py-1.5 font-poppins rounded-full text-[11px] font-semibold whitespace-nowrap">
                    Travel like a local
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-8 mt-5 mb-1 pt-4 border-t border-white/5">
              <div className="flex flex-col items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={handleCopyUrl}>
                <div className="p-2 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                  {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} className="text-white" />}
                </div>
                <span className="text-[11px] text-white/60 font-medium">{copied ? "Copied" : "Link"}</span>
              </div>
            </div>
          </div>
        </Accordion>
      </div>
    </div>
  );
};

const GameListView = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"recommendations" | "manage">("recommendations");
  const [deleteTarget, setDeleteTarget] = useState<RecommendedGame | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [showTopGamesManager, setShowTopGamesManager] = useState(false);
  const [modalState, setModalState] = useState<{ open: boolean; game: RecommendedGame | null }>({
    open: false,
    game: null,
  });
  const { user } = useAuthStore();

  const handleOpenModal = (game: RecommendedGame) => {
    console.log("Opening modal for game:", game.title);
    setModalState({ open: true, game });
  };

  const { data, loading, refetch } = useQuery(GAMES_BY_LIST, {
    variables: { gameListDocumentId: listId, page: 0, pageSize: 200 },
    skip: !listId,
    fetchPolicy: "cache-and-network",
  });

  const [toggleGamePin] = useMutation(TOGGLE_GAME_PIN);
  const [deleteRecommendedGame] = useMutation(DELETE_RECOMMENDED_GAME);
  const [updateGameList, { loading: isUpdating }] = useMutation(UPDATE_GAME_LIST);

  const rawList = data?.gameLists?.[0];
  const games: RecommendedGame[] = deduplicateGames(rawList?.recommended_games);
  const pinnedGames = games.filter((b) => b.is_pinned);
  const pinnedCount = pinnedGames.length;

  const list: GameList | null = rawList
    ? {
      ...rawList,
      recommended_games: games,
      account: rawList.account ?? { documentId: (user as any)?.accountDocumentId ?? "", username: (user as any)?.username ?? "" },
    }
    : null;

  const handlePinToggle = async (game: RecommendedGame) => {
    const willPin = !game.is_pinned;
    if (willPin && pinnedCount >= 15) {
      toast.error("Max 15 top picks allowed.");
      return;
    }
    setPinningId(game.documentId);
    try {
      await toggleGamePin({
        variables: {
          documentId: game.documentId,
          is_pinned: willPin,
          pin_order: willPin ? pinnedCount : null,
        },
      });
      refetch();
    } catch {
      toast.error("Failed to update pin.");
    } finally {
      setPinningId(null);
    }
  };

  const handleToggleVisibility = async () => {
    if (!list) return;
    if (!list.Visibility && games.length === 0) {
      toast.error("Add at least one game before publishing.");
      return;
    }
    try {
      await updateGameList({
        variables: { documentId: list.documentId, Visibility: !list.Visibility },
        optimisticResponse: {
          updateGameList: {
            __typename: "GameList",
            documentId: list.documentId,
            List_Name: list.List_Name,
            list_description: list.list_description,
            slug: list.slug,
            Visibility: !list.Visibility,
            display_order: list.display_order,
            top_picks_heading: list.top_picks_heading || null,
          }
        }
      });
      toast.success(list.Visibility ? "List set to Draft." : "List published!");
      refetch();
    } catch {
      toast.error("Failed to update visibility.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteRecommendedGame({ variables: { documentId: deleteTarget.documentId } });
      toast.success("Game removed.");
      setDeleteTarget(null);
      refetch();
    } catch {
      toast.error("Failed to delete game.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !list) {
    return (
      <div className="p-6 space-y-4 max-w-3xl mx-auto">
        <div className="h-6 w-40 bg-white/5 animate-pulse rounded" />
        <div className="h-4 w-24 bg-white/5 animate-pulse rounded" />
        {[1,2,3,4].map(i => <div key={i} className="h-14 bg-white/5 animate-pulse rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="px-4 pt-8 pb-24 md:p-6 md:pb-6 max-w-3xl mx-auto">
      <div className="flex items-start gap-3 mb-6">
        <button onClick={() => navigate("/recommendations/games")} className="text-white/50 hover:text-white mt-0.5 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">{list?.List_Name}</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-white/40">
            <span>{games.length} game{games.length !== 1 ? "s" : ""}</span>
            {pinnedCount > 0 && (
              <span className="flex items-center gap-1 text-amber-400/80 font-medium">
                <Star size={10} fill="currentColor" /> {pinnedCount}/15 pinned
              </span>
            )}
          </div>
        </div>
        <Switch
          checked={list?.Visibility ?? false}
          onChange={handleToggleVisibility}
          loading={isUpdating}
          label={list?.Visibility ? "Published" : "Draft"}
        />
      </div>

      <div className="flex mb-6 bg-white rounded-full max-w-[320px] mx-auto shadow-sm">
        {(["recommendations", "manage"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-4 text-sm font-semibold rounded-full capitalize transition-all duration-300 ${
              activeTab === tab ? "bg-[#60A5FA] text-white shadow" : "text-blue-900 bg-transparent hover:bg-blue-50/50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "recommendations" ? (
        <div>
          {pinnedCount > 0 && (
            <button
               onClick={() => setShowTopGamesManager(true)}
               className="w-full mb-4 flex items-center justify-between px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm hover:bg-amber-500/15 transition-colors"
             >
               <span className="flex items-center gap-2 text-amber-400">
                 <Star size={14} fill="currentColor" /> Manage Top Picks ({pinnedCount}/15)
               </span>
               <ChevronRight size={14} className="text-amber-400/60" />
             </button>
          )}

          {/* Add Game button - highlighted CTA */}
          <button
            onClick={() => navigate(`/recommendations/games/${listId}/add`)}
            className="w-full mb-6 flex items-center justify-center gap-3 py-4 bg-dashboard-accent hover:opacity-90 text-white rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-900/40 border border-white/10"
          >
            <AddIcon size="5" /> Add Game
          </button>

          {games.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Gamepad2 size={40} className="text-white/15 mb-3" />
              <p className="text-white/40 text-sm">No games in this list yet.</p>
            </div>
          ) : (
            <div className="space-y-0">
              {games.map((game) => (
                <GameRow
                  key={game.documentId}
                  game={game}
                  onPinToggle={handlePinToggle}
                  onEdit={(g) => navigate(`/recommendations/games/${listId}/edit/${g.documentId}`)}
                  onDelete={(g) => setDeleteTarget(g)}
                  onClick={() => handleOpenModal(game)}
                  isPinning={pinningId === game.documentId}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        list && <ManageTab list={list} onRefetch={refetch} />
      )}

        <GameDetailModal
          game={modalState.game}
          open={modalState.open}
          onClose={() => setModalState({ open: false, game: null })}
        />

      <AnimatePresence>
        {showTopGamesManager && (
          <TopGamesManager
            games={pinnedGames}
            allGames={games}
            onClose={() => setShowTopGamesManager(false)}
            onRefetch={refetch}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              className="bg-[#0d1117] rounded-2xl border border-white/10 p-6 max-w-sm w-full"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-white mb-2">Remove "{deleteTarget.title}"?</h3>
              <p className="text-sm text-white/50 mb-5">This game will be removed from the list.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl bg-white/8 text-sm text-white/70">Cancel</button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-sm text-white font-medium flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GameListView;
