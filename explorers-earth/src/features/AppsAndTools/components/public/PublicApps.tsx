import { useState, useMemo, useCallback } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { Smartphone, Share2 } from "lucide-react";
import { PUBLIC_APP_DATA } from "../../api/query";
import { deduplicateApps } from "../../utils/appHelpers";
import { toast } from "sonner";
import type { RecommendedApp, AppList } from "../../types";
import AppCarouselRow from "./AppCarouselRow";
import AppDetailModal from "./AppDetailModal";
import SEO from "../../../../components/SEO";
import { createCanonicalUrl } from "../../../../utils/getCurrentDomain";
import AppTopPicksHero from "./AppTopPicksHero";
import AppTopPicksMobileHero from "./AppTopPicksMobileHero";
import { usePublicRouteLifecycle } from "../../../../layouts/usePublicRouteLifecycle";
import { usePublicProfileBootstrapAccount } from "../../../../layouts/PublicProfileBootstrapContext";
import { createAnalyticsOptions, useTrackAnalytics } from "../../../../services/analyticsService";

const PublicApps = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [modalState, setModalState] = useState<{ open: boolean; app: RecommendedApp | null }>({
    open: false,
    app: null,
  });

  const account = usePublicProfileBootstrapAccount();
  const accountDocumentId = account.documentId;
  const creatorName = account.Account_Name || username;
  const analytics = useTrackAnalytics(createAnalyticsOptions.apps(
    accountDocumentId || "",
    username,
    undefined,
    undefined,
    { variant: "index", path: location.pathname },
  ));

  const { data, loading: appsLoading, error: appsError, refetch: refetchApps } = useQuery(PUBLIC_APP_DATA, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
    fetchPolicy: "cache-and-network",
  });

  const loading = appsLoading;

  const lists: AppList[] = data?.appLists ?? [];

  const retry = useCallback(async () => {
    await refetchApps();
  }, [refetchApps]);

  usePublicRouteLifecycle({
    loading,
    error: appsError,
    retry,
    hasUsableData: Boolean(data),
    empty: !loading && !appsError && lists.length === 0,
  });

  const allApps = useMemo(() => {
    return deduplicateApps(lists.flatMap((l) => l.recommended_apps ?? []));
  }, [lists]);

  const topPicks = useMemo(() => {
    return allApps
      .filter((a) => a.is_pinned)
      .sort((a, b) => (a.pin_order ?? 999) - (b.pin_order ?? 999));
  }, [allApps]);

  // const allCategories = useMemo(() => {
  //   return extractUniqueCategories(allApps.map((a) => a.app_category ? [a.app_category] : []));
  // }, [allApps]);

  const handleAppClick = useCallback((app: RecommendedApp) => {
    analytics.trackClick("app-card", {
      id: app.documentId,
      title: app.title,
      developer: app.developer,
      listId: app.app_list?.documentId,
      listName: app.app_list?.List_Name,
    });
    setModalState({ open: true, app });
  }, [analytics]);

  const handleShare = async () => {
    analytics.trackClick("share-button", { context: "apps-index" });
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `${creatorName}'s Apps`, url }); } catch { /* ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  const appCount = allApps.length;
  const listCount = lists.length;
  const pageTitle = `${creatorName} | Favorite Apps & Tools | explorers`;
  const metaDescription = appCount > 0
    ? `Browse curated app lists and recommended tools shared by ${creatorName} on explorers. Explore ${listCount} app list${listCount !== 1 ? 's' : ''} containing ${appCount} favorite app${appCount !== 1 ? 's' : ''}.`
    : `Explore app and tool recommendations shared by ${creatorName} on explorers.`;

  const seoKeywords = [
    `${creatorName} apps`,
    `${username} apps`,
    "explorers apps",
    "favorite apps list",
    "app recommendations",
    "curated app lists",
    ...lists.map(l => l.List_Name)
  ];

  if (!data) return null;

  return (
    <>
      {!loading && (
        <SEO
          title={pageTitle}
          description={metaDescription}
          keywords={seoKeywords}
          canonical={createCanonicalUrl(`/${username}/apps`)}
          type="website"
          author={creatorName}
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

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 pb-16 pt-20">
          <>
              {/* Empty state */}
              {lists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <Smartphone size={48} className="text-white/20 mb-4" />
                  <p className="text-white/40 text-lg font-medium">No apps shared yet</p>
                  <p className="text-white/25 text-sm mt-1">Check back later for recommendations</p>
                </div>
              ) : (
                <>
                  {/* Top Picks Hero (Large Screens) & Carousel (Mobile) */}
                  {topPicks.length > 0 && (
                    <div className="mt-4">
                      <div className="hidden lg:block">
                        <AppTopPicksHero 
                          apps={topPicks} 
                          onAppClick={handleAppClick} 
                        />
                      </div>
                      <div className="block lg:hidden">
                        <AppTopPicksMobileHero
                          apps={topPicks}
                          onAppClick={handleAppClick}
                        />
                      </div>
                    </div>
                  )}

                  {/* Lists as carousel rows */}
                  <div className="mt-4 space-y-8">
                    {lists.map((list) => (
                      <AppCarouselRow
                        key={list.documentId}
                        list={list}
                        onAppClick={handleAppClick}
                        onViewAll={() => navigate(`/${username}/apps/${list.slug}`)}
                      />
                    ))}
                  </div>

                  {/* Category browse - hidden for now as category pages are not registered/implemented
                  {allCategories.length > 0 && (
                    <div className="mt-10">
                      <p className="text-sm font-semibold text-white/60 mb-3">Browse by Category</p>
                      <div className="flex flex-wrap gap-2">
                        {allCategories.map((cat) => (
                          <button
                            key={cat.slug}
                            onClick={() => navigate(`/${username}/apps/category/${cat.slug}`)}
                            className="text-xs text-violet-400/80 bg-violet-900/20 hover:bg-violet-900/40 border border-violet-800/20 px-3 py-1.5 rounded-full transition-all"
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  */}
                </>
              )}
          </>
        </div>

        <AppDetailModal
          open={modalState.open}
          app={modalState.app}
          onClose={() => setModalState({ open: false, app: null })}
          onShare={(id) => analytics.trackClick("share-button", { context: "apps-index-detail", id })}
        />
      </div>
    </>
  );
};

export default PublicApps;
