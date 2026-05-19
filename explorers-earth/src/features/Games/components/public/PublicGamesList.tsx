import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { Gamepad2, ArrowLeft, Star } from "lucide-react";
import { GAME_LIST_BY_SLUG } from "../../api/query";
import { deduplicateGames, buildCoverUrl } from "../../utils/gameHelpers";
import type { RecommendedGame, GameList } from "../../types";
import GameDetailModal from "./GameDetailModal";
import GameCoverCard from "./GameCoverCard";

const PublicGamesList = () => {
  const { username, listSlug } = useParams<{ username: string; listSlug: string }>();
  const navigate = useNavigate();

  const [modalState, setModalState] = useState<{ open: boolean; game: RecommendedGame | null }>({
    open: false,
    game: null,
  });

  // Stored slugs are prefixed with 'games-' for global uniqueness.
  // The URL only contains the short form (e.g. 'favorites'), so we prepend the prefix here.
  const dbSlug = listSlug ? (listSlug.startsWith("games-") ? listSlug : `games-${listSlug}`) : "";
  const { data, loading } = useQuery(GAME_LIST_BY_SLUG, {
    variables: { slug: dbSlug, username },
    skip: !listSlug || !username,
  });

  const rawList = data?.gameLists?.[0];
  const list: GameList | null = rawList
    ? { ...rawList, recommended_games: deduplicateGames(rawList.recommended_games) }
    : null;

  const handleGameClick = useCallback((game: RecommendedGame) => {
    setModalState({ open: true, game });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex flex-col items-center justify-center px-4 text-center">
        <Gamepad2 size={64} className="text-white/10 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">List not found</h2>
        <p className="text-white/50 mb-6">This game list doesn't exist or is private.</p>
        <button onClick={() => navigate(`/${username}/games`)} className="text-amber-500 font-semibold hover:underline">
          Back to Games
        </button>
      </div>
    );
  }

  const coverUrl = buildCoverUrl(list.cover_image?.url);

  return (
    <div className="min-h-screen bg-[#0d1117] pb-24">
      {/* Header Banner */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden bg-white/5">
        {coverUrl && (
          <img src={coverUrl} alt={list.List_Name} className="absolute inset-0 w-full h-full object-cover blur-sm opacity-50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/80 to-transparent" />
        
        <div className="absolute inset-0 flex flex-col justify-end max-w-6xl mx-auto px-4 md:px-8 pb-8">
          <button
            onClick={() => navigate(`/${username}/games`)}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-6 w-fit"
          >
            <ArrowLeft size={16} /> Back to Games
          </button>
          
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 tracking-tight">
            {list.List_Name}
          </h1>
          {list.list_description && (
            <p className="text-white/70 max-w-2xl text-lg">{list.list_description}</p>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 -mt-4 relative z-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {list.recommended_games.map((game) => (
            <div key={game.documentId} className="flex flex-col">
               <GameCoverCard coverUrl={game.cover_url} title={game.title} onClick={() => handleGameClick(game)} />
               <div className="mt-3 px-1 text-center">
                 <h4 className="text-sm font-semibold text-white/90 line-clamp-1 truncate">{game.title}</h4>
                 <p className="text-[11px] text-white/40 mt-0.5 flex flex-wrap items-center justify-center gap-1.5 opacity-80">
                   {game.release_year && <span>{game.release_year}</span>}
                   {game.release_year && game.igdb_rating && <span>·</span>}
                   {game.igdb_rating && (
                     <span className="flex items-center justify-center gap-0.5 text-amber-500">
                       <Star size={10} fill="currentColor" /> {(game.igdb_rating / 10).toFixed(1)}
                     </span>
                   )}
                 </p>
               </div>
            </div>
          ))}
        </div>
      </div>

      <GameDetailModal
        open={modalState.open}
        game={modalState.game}
        onClose={() => setModalState({ open: false, game: null })}
      />
    </div>
  );
};

export default PublicGamesList;
