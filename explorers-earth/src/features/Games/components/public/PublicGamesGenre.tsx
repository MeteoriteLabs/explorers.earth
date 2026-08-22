import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { Share2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { RecommendedGame } from "../../types";
import { slugToGenreName, deduplicateGames, genreToSlug } from "../../utils/gameHelpers";
import GameCoverCard from "./GameCoverCard";
import GameDetailModal from "./GameDetailModal";
import { GAME_CATEGORIES, PUBLIC_GAME_DATA } from "../../api/query";
import SEO from "../../../../components/SEO";
import { createCanonicalUrl } from "../../../../utils/getCurrentDomain";
import { usePublicRouteLifecycle } from "../../../../layouts/usePublicRouteLifecycle";
import { usePublicProfileBootstrapAccount } from "../../../../layouts/PublicProfileBootstrapContext";
import { PublicProfileFallbackRedirect } from "../../../../routes/PublicProfileFallbackRedirect";
import { shouldRedirectMissingPublicResource } from "../../../../routes/publicRouteResourceState";

const PublicGamesGenre = () => {
  const { username, genreSlug } = useParams<{ username: string; genreSlug: string }>();
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState<RecommendedGame | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const genreName = slugToGenreName(genreSlug ?? "");

  const accountDocumentId = usePublicProfileBootstrapAccount().documentId;

  const { data: gamesData, loading: gamesLoading, error: gamesError, refetch: refetchGames } = useQuery(PUBLIC_GAME_DATA, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
  });
  const { data: categoriesData, loading: categoriesLoading, error: categoriesError, refetch: refetchCategories } = useQuery(GAME_CATEGORIES, {
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const loading = gamesLoading || categoriesLoading;
  const error = gamesError ?? categoriesError;
  const genre = categoriesData?.gameCategories?.find(
    (category: { genre_name?: string | null }) => genreToSlug(category.genre_name ?? "") === genreSlug,
  );

  const allGames: RecommendedGame[] = useMemo(() => {
    return deduplicateGames((gamesData?.gameLists ?? []).flatMap((l: any) => l.recommended_games ?? []));
  }, [gamesData]);

  const filteredGames = useMemo(() => {
    return allGames.filter(game => {
      const slugs = (game.genres || []).map(g => genreToSlug(g));
      return slugs.includes(genreSlug ?? "");
    });
  }, [allGames, genreSlug]);

  const retry = useCallback(async () => {
    await Promise.all([refetchGames(), refetchCategories()]);
  }, [refetchCategories, refetchGames]);

  usePublicRouteLifecycle({
    loading,
    error,
    retry,
    hasUsableData: Boolean(gamesData && categoriesData),
    empty: !loading && !error && Boolean(genre) && filteredGames.length === 0,
  });

  if (shouldRedirectMissingPublicResource({
    loading,
    error,
    resource: genre,
  })) {
    return <PublicProfileFallbackRedirect />;
  }

  const handleGameClick = (game: RecommendedGame) => {
    setSelectedGame(game);
    setModalOpen(true);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `${genreName} Games`, url }); } catch { /* ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  const pageTitle = `${genreName} Games | ${username}'s Game List | explorers`;
  const metaDescription = `Explore ${filteredGames.length} ${genreName} game${filteredGames.length !== 1 ? "s" : ""} recommended by ${username} on explorers.`;
  const seoKeywords = [genreName, "games", `${username} games`, "explorers"];

  if (!gamesData || !categoriesData) return null;

  return (
    <>
      {!loading && (
        <SEO
          title={pageTitle}
          description={metaDescription}
          keywords={seoKeywords}
          canonical={createCanonicalUrl(`/${username}/games/genre/${genreSlug}`)}
          type="website"
          author={username}
          siteName="explorers"
        />
      )}
      <div className="min-h-screen bg-[#0d1117] text-white">
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
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-all duration-300 flex items-center justify-center"
              aria-label="Share"
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Hero Header */}
      <div className="relative mt-14">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/40 to-[#0d1117] pointer-events-none h-48" />

        <div className="relative max-w-5xl mx-auto px-4 pt-6 pb-4">
          <Link
            to={`/${username}/games`}
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-6"
          >
            <ArrowLeft size={14} /> {username}'s Games
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 relative">
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-poppins font-bold text-white mb-1">{genreName}</h1>
              <p className="text-gray-400 font-poppins text-xs md:text-sm mt-1 uppercase tracking-wider">
                {filteredGames.length} game{filteredGames.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-6">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 md:gap-6">
          {filteredGames.length === 0 ? (
            <p className="col-span-full text-white/40 text-sm py-8 text-center font-poppins">
              No games found in this genre.
            </p>
          ) : (
            filteredGames.map(game => (
              <div key={game.documentId} className="flex flex-col gap-2">
                <GameCoverCard
                  coverUrl={game.cover_url}
                  title={game.title}
                  onClick={() => handleGameClick(game)}
                />
                <div className="px-1">
                  <h4 className="text-xs font-semibold text-white/90 line-clamp-1 truncate">{game.title}</h4>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
                    {game.release_year || ""}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <GameDetailModal
        game={selectedGame}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedGame(null); }}
      />
    </div>
    </>
  );
};

export default PublicGamesGenre;
