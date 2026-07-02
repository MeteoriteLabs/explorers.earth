import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { useQuery, gql } from "@apollo/client";
import { Smartphone, Share2 } from "lucide-react";
import { PUBLIC_APP_DATA } from "../../api/query";
import { deduplicateApps, extractUniqueCategories } from "../../utils/appHelpers";
import { toast } from "sonner";
import type { RecommendedApp, AppList } from "../../types";
import AppCarouselRow from "./AppCarouselRow";
import AppDetailModal from "./AppDetailModal";
import SEO from "../../../../components/SEO";
import { createCanonicalUrl } from "../../../../utils/getCurrentDomain";

const ACCOUNT_BY_USERNAME = gql`
  query AccountByUsernameApps($username: String!) {
    usersPermissionsUsers(filters: { username: { eq: $username } }) {
      documentId
      username
      accounts {
        documentId
        Account_Name
        profile_picture {
          url
        }
      }
    }
  }
`;

const PublicApps = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const outletContext = useOutletContext<{ setIsPageLoaded?: (val: boolean) => void } | null>();

  const [modalState, setModalState] = useState<{ open: boolean; app: RecommendedApp | null }>({
    open: false,
    app: null,
  });

  const { data: userLookup, loading: userLoading } = useQuery(ACCOUNT_BY_USERNAME, {
    variables: { username },
    skip: !username,
  });

  const accountDocumentId = userLookup?.usersPermissionsUsers?.[0]?.accounts?.[0]?.documentId;
  const creatorName = userLookup?.usersPermissionsUsers?.[0]?.accounts?.[0]?.Account_Name || username;

  const { data, loading: appsLoading } = useQuery(PUBLIC_APP_DATA, {
    variables: { accountDocumentId },
    skip: !accountDocumentId,
    fetchPolicy: "cache-and-network",
  });

  const loading = userLoading || appsLoading;

  useEffect(() => {
    if (!loading) {
      (window as any).__publicProfileLoaded = true;
      outletContext?.setIsPageLoaded?.(true);
    }
  }, [loading, outletContext]);

  const lists: AppList[] = data?.appLists ?? [];

  const allApps = useMemo(() => {
    return deduplicateApps(lists.flatMap((l) => l.recommended_apps ?? []));
  }, [lists]);

  const topPicks = useMemo(() => {
    return allApps
      .filter((a) => a.is_pinned)
      .sort((a, b) => (a.pin_order ?? 999) - (b.pin_order ?? 999));
  }, [allApps]);

  const allCategories = useMemo(() => {
    return extractUniqueCategories(allApps.map((a) => a.app_category ? [a.app_category] : []));
  }, [allApps]);

  const handleAppClick = useCallback((app: RecommendedApp) => {
    setModalState({ open: true, app });
  }, []);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `${creatorName}'s Apps`, url }); } catch { /* ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-violet-900/20 border border-violet-800/30 flex items-center justify-center mb-5">
          <Smartphone size={32} className="text-violet-500/50" />
        </div>
        <h2 className="text-lg font-semibold text-white/80 mb-2">No apps shared yet</h2>
        <p className="text-sm text-white/40 max-w-sm">
          {creatorName} hasn't published any app lists yet.
        </p>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={`${creatorName}'s Apps & Tools`}
        description={`Discover the best apps and tools recommended by ${creatorName}.`}
        canonicalUrl={createCanonicalUrl(`/${username}/apps`)}
      />

      <div className="pb-16">
        {/* Header */}
        <div className="px-4 md:px-6 pt-4 pb-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Apps & Tools</h1>
            <p className="text-xs text-white/40 mt-0.5">{allApps.length} apps curated by {creatorName}</p>
          </div>
          <button
            onClick={handleShare}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"
          >
            <Share2 size={16} />
          </button>
        </div>

        {/* Top Picks */}
        {topPicks.length > 0 && (
          <div className="mt-2 mb-4 px-4 md:px-6">
            <p className="text-xs text-violet-400/70 font-semibold uppercase tracking-wider mb-3">⭐ Top Picks</p>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {topPicks.map((app) => (
                <button
                  key={app.documentId}
                  onClick={() => handleAppClick(app)}
                  className="flex-shrink-0 flex flex-col items-center gap-2 w-16 group"
                >
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-violet-500/40 transition-all shadow-lg">
                    {app.logo_url ? (
                      <img src={app.logo_url} alt={app.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Smartphone size={18} className="text-white/20" />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-white/50 text-center line-clamp-2 leading-tight">{app.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Lists as carousel rows */}
        <div className="space-y-8 mt-4">
          {lists.map((list) => (
            <AppCarouselRow
              key={list.documentId}
              list={list}
              onAppClick={handleAppClick}
              onViewAll={() => navigate(`/${username}/apps/${list.slug}`)}
            />
          ))}
        </div>

        {/* Category browse */}
        {allCategories.length > 0 && (
          <div className="px-4 md:px-6 mt-10">
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
      </div>

      <AppDetailModal
        open={modalState.open}
        app={modalState.app}
        onClose={() => setModalState({ open: false, app: null })}
      />
    </>
  );
};

export default PublicApps;
