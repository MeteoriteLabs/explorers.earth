import { useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@apollo/client";
import { Smartphone, Share2, ArrowLeft } from "lucide-react";
import { APP_LIST_BY_SLUG } from "../../api/query";
import { deduplicateApps, buildLogoUrl, getPriceTierColor } from "../../utils/appHelpers";
import type { RecommendedApp, AppList } from "../../types";
import AppDetailModal from "./AppDetailModal";
import { toast } from "sonner";
import SEO from "../../../../components/SEO";
import { createCanonicalUrl } from "../../../../utils/getCurrentDomain";
import { usePublicRouteLifecycle } from "../../../../layouts/usePublicRouteLifecycle";
import { usePublicProfileBootstrapAccount } from "../../../../layouts/PublicProfileBootstrapContext";
import { PublicProfileFallbackRedirect } from "../../../../routes/PublicProfileFallbackRedirect";
import { shouldRedirectMissingPublicResource } from "../../../../routes/publicRouteResourceState";

const PublicAppList = () => {
  const { username, listSlug } = useParams<{ username: string; listSlug: string }>();
  const navigate = useNavigate();
  const [selectedApp, setSelectedApp] = useState<RecommendedApp | null>(null);

  const account = usePublicProfileBootstrapAccount();

  const { data, loading, error, refetch } = useQuery<{ appLists: AppList[] }>(APP_LIST_BY_SLUG, {
    variables: { slug: listSlug, username },
    skip: !listSlug || !username,
    fetchPolicy: "cache-and-network",
  });

  const list = data?.appLists?.[0];
  const apps = deduplicateApps<RecommendedApp>(list?.recommended_apps ?? []);
  const creatorName = account.Account_Name || username;

  usePublicRouteLifecycle({
    loading,
    error,
    retry: refetch,
    hasUsableData: Boolean(data),
    empty: !loading && !error && !list,
  });

  const missingResource = shouldRedirectMissingPublicResource({ loading, error, resource: list });

  const handleAppClick = useCallback((app: RecommendedApp) => {
    setSelectedApp(app);
  }, []);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: list?.List_Name, url }); } catch { /* ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  const pageTitle = list ? `${list.List_Name} | ${creatorName}'s App List | explorers` : `App List | explorers`;
  const metaDescription = list?.list_description 
    ? list.list_description 
    : list 
      ? `Explore the curated app list "${list.List_Name}" containing ${apps.length} apps recommended by ${creatorName} on explorers.`
      : "Explore app recommendations on explorers.";

  const seoKeywords = list 
    ? [`${list.List_Name}`, `${creatorName} apps`, `${list.slug}`, "app list", "explorers"]
    : ["app list", "explorers"];

  const listImage = list?.cover_image?.url || (apps[0]?.logo_url ? buildLogoUrl(apps[0].logo_url) : undefined);

  if (missingResource) return <PublicProfileFallbackRedirect />;

  return (
    <>
      {list && (
        <SEO
          title={pageTitle}
          description={metaDescription}
          keywords={seoKeywords}
          canonical={createCanonicalUrl(`/${username}/apps/${listSlug}`)}
          image={listImage}
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

        {/* Header content section */}
        <div className="max-w-5xl mx-auto px-4 pt-6 pb-2 mt-14">
          <Link
            to={`/${username}/apps`}
            className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-6"
          >
            <ArrowLeft size={14} /> {creatorName}'s Apps
          </Link>

          {list ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-poppins font-bold text-white mb-1">{list.List_Name}</h1>
                {list.list_description && (
                  <p className="text-gray-400 font-poppins text-xs md:text-sm mt-1 max-w-xl">{list.list_description}</p>
                )}
                <p className="text-gray-400 font-poppins text-xs md:text-sm mt-2">{apps.length} app{apps.length !== 1 ? "s" : ""}</p>
              </div>
            </div>
          ) : (
            <p className="text-white/40">List not found or not published.</p>
          )}
        </div>

        {/* Grid */}
        <div className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {apps.map((app) => (
                <button
                  key={app.documentId}
                  onClick={() => handleAppClick(app)}
                  className="rounded-2xl bg-white/[0.04] border border-white/[0.07] hover:border-violet-500/40 hover:bg-white/[0.07] p-4 text-left transition-all flex flex-col items-center justify-center text-center w-full"
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 mb-3 shadow-md">
                    {app.logo_url ? (
                      <img src={buildLogoUrl(app.logo_url)} alt={app.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Smartphone size={18} className="text-white/20" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-white line-clamp-2 leading-tight mb-1">{app.title}</p>
                  {app.developer && (
                    <p className="text-[10px] text-white/40 truncate w-full mb-2">{app.developer}</p>
                  )}
                  {app.price_tier && (
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${getPriceTierColor(app.price_tier)}`}>
                      {app.price_tier}
                    </span>
                  )}
                </button>
              ))}
          </div>
        </div>

        <AppDetailModal
          open={!!selectedApp}
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
        />
      </div>
    </>
  );
};

export default PublicAppList;
