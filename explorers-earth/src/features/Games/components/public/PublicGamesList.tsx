import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { ArrowLeft, Star, Share2 } from "lucide-react";
import { toast } from "sonner";
import { GAME_LIST_BY_SLUG } from "../../api/query";
import { deduplicateGames, buildCoverUrl } from "../../utils/gameHelpers";
import type { RecommendedGame, GameList } from "../../types";
import GameDetailModal from "./GameDetailModal";
import GameCoverCard from "./GameCoverCard";
import SEO from "../../../../components/SEO";
import { createCanonicalUrl } from "../../../../utils/getCurrentDomain";
import { usePublicRouteLifecycle } from "../../../../layouts/usePublicRouteLifecycle";
import { usePublicProfileBootstrapAccount } from "../../../../layouts/PublicProfileBootstrapContext";
import { PublicProfileFallbackRedirect } from "../../../../routes/PublicProfileFallbackRedirect";
import { resolvePublicChildState } from "../../../../routes/resolvePublicChildState";
import {
  mergePublicConnectionPage,
  usePublicConnectionPagination,
} from "../../../../hooks/usePublicConnectionPagination";
import { PublicConnectionPaginationControl } from "../../../../components/PublicConnectionPaginationControl";
import {
  publicLeafQueryContext,
  usePublicLeafRequestGeneration,
} from "../../../../layouts/PublicRouteReadinessContext";

const PublicGamesList = () => {
  const { username, listSlug } = useParams<{ username: string; listSlug: string }>();
  const navigate = useNavigate();
  const [modalState, setModalState] = useState<{ open: boolean; game: RecommendedGame | null }>({
    open: false,
    game: null,
  });
  const accountDocumentId = usePublicProfileBootstrapAccount().documentId;
  const requestGeneration = usePublicLeafRequestGeneration(`${accountDocumentId}:${listSlug}`);

  const { data, loading, error, refetch, fetchMore } = useQuery(GAME_LIST_BY_SLUG, {
    context: publicLeafQueryContext,
    variables: {
      slug: listSlug,
      accountDocumentId,
      pagination: { page: 1, pageSize: 200 },
    },
    skip: !listSlug || !accountDocumentId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const rawList = data?.gameLists?.[0];
  const list: GameList | null = rawList
    ? {
        ...rawList,
        recommended_games: deduplicateGames(
          data?.recommendedGames_connection?.nodes,
        ),
      }
    : null;
  const childState = resolvePublicChildState({
    loading,
    error,
    bootstrapReady: Boolean(accountDocumentId && listSlug),
    resourceKind: "child",
    entityExists: Boolean(list),
    empty: Boolean(list) && (list?.recommended_games.length ?? 0) === 0,
  });

  usePublicRouteLifecycle({
    loading,
    error,
    retry: refetch,
    hasUsableData: Boolean(data),
    empty: childState === "empty",
  });

  const loadPage = useCallback(async (page: number, request: { isCurrent: () => boolean }) => {
    await fetchMore({
      variables: { pagination: { page, pageSize: 200 } },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!request.isCurrent()) return previous;
        if (!previous.recommendedGames_connection || !fetchMoreResult?.recommendedGames_connection) return previous;
        return {
          ...previous,
          recommendedGames_connection: mergePublicConnectionPage(
            previous.recommendedGames_connection,
            fetchMoreResult.recommendedGames_connection,
          ),
        };
      },
    });
  }, [fetchMore]);
  const pagination = usePublicConnectionPagination({
    pageInfo: data?.recommendedGames_connection?.pageInfo,
    loadPage,
    resetKey: `${accountDocumentId}:${listSlug}`,
  });

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: list?.List_Name || "Game List", url }); } catch { /* ignore */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied!");
      } catch (error) {
        console.error("Failed to copy text:", error);
      }
    }
  };

  const handleGameClick = useCallback((game: RecommendedGame) => {
    setModalState({ open: true, game });
  }, []);

  if (!data) return null;
  if (childState === "redirect") return <PublicProfileFallbackRedirect expectedGeneration={requestGeneration} />;
  if (!list) return null;

  const coverUrl = buildCoverUrl(list.cover_image?.url);

  const pageTitle = `${list.List_Name} | ${username}'s Game List | explorers`;
  const metaDescription = list.list_description 
    ? list.list_description 
    : `Explore the curated game list "${list.List_Name}" containing ${list.recommended_games.length} games recommended by ${username} on explorers.`;

  const seoKeywords = [list.List_Name, `${username} games`, "game list", "explorers"];

  return (
    <>
      <SEO
        title={pageTitle}
        description={metaDescription}
        keywords={seoKeywords}
        canonical={createCanonicalUrl(`/${username}/games/${listSlug}`)}
        image={coverUrl}
        type="website"
        author={username}
        siteName="explorers"
      />
      <div className="min-h-screen bg-[#0d1117] pb-24">
        {/* Fixed Header */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-[#2a2a2a]/90 backdrop-blur-sm border-b border-gray-700 h-14">
          <div className="max-w-4xl mx-auto flex items-center justify-between h-full px-6">
            <span
              className="text-white font-bold text-2xl cursor-pointer"
              onClick={() => navigate("/")}
            >
              explorers.earth
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center cursor-pointer"
                aria-label="Share"
              >
                <Share2 size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Header Banner */}
        <div className="relative h-40 md:h-52 w-full overflow-hidden bg-white/5 mt-14">
          {coverUrl && (
            <img src={coverUrl} alt={list.List_Name} className="absolute inset-0 w-full h-full object-cover blur-sm opacity-50" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/80 to-transparent" />
          
          <div className="absolute inset-0 flex flex-col justify-end max-w-6xl mx-auto px-4 md:px-8 pb-5">
            <button
              onClick={() => navigate(`/${username}/games`)}
              className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-3 w-fit"
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
                         <Star size={10} fill="currentColor" /> {game.igdb_rating.toFixed(1)}
                       </span>
                     )}
                   </p>
                 </div>
              </div>
            ))}
          </div>
          <PublicConnectionPaginationControl
            hasNextPage={pagination.hasNextPage}
            isLoading={pagination.isLoadingNextPage}
            error={pagination.nextPageError}
            onLoadMore={() => void pagination.loadNextPage()}
            onRetry={() => void pagination.retryNextPage()}
            labelKey="sections.productCategories.categories.4.label"
          />
        </div>

        <GameDetailModal
          open={modalState.open}
          game={modalState.game}
          onClose={() => setModalState({ open: false, game: null })}
        />
      </div>
    </>
  );
};

export default PublicGamesList;
