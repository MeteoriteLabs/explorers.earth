import { useState, useCallback } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { useQuery, gql } from "@apollo/client";
import { Smartphone, ArrowLeft } from "lucide-react";
import { APP_LIST_BY_SLUG } from "../../api/query";
import { deduplicateApps } from "../../utils/appHelpers";
import type { RecommendedApp } from "../../types";
import AppDetailModal from "./AppDetailModal";
import AppCarouselRow from "./AppCarouselRow";

const ACCOUNT_BY_USERNAME = gql`
  query AccountByUsernameForAppList($username: String!) {
    usersPermissionsUsers(filters: { username: { eq: $username } }) {
      documentId
      username
      accounts {
        documentId
        Account_Name
      }
    }
  }
`;

const PublicAppList = () => {
  const { username, listSlug } = useParams<{ username: string; listSlug: string }>();
  const navigate = useNavigate();

  const [selectedApp, setSelectedApp] = useState<RecommendedApp | null>(null);

  const { data: userLookup } = useQuery(ACCOUNT_BY_USERNAME, {
    variables: { username },
    skip: !username,
  });

  const { data, loading } = useQuery(APP_LIST_BY_SLUG, {
    variables: { slug: listSlug, username },
    skip: !listSlug || !username,
    fetchPolicy: "cache-and-network",
  });

  const list = data?.appLists?.[0];
  const apps = deduplicateApps(list?.recommended_apps ?? []);
  const creatorName = userLookup?.usersPermissionsUsers?.[0]?.accounts?.[0]?.Account_Name || username;

  const handleAppClick = useCallback((app: RecommendedApp) => {
    setSelectedApp(app);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <p className="text-white/40 mb-4">List not found.</p>
        <button onClick={() => navigate(`/${username}/apps`)} className="text-sm text-violet-400 hover:underline">
          ← Back to Apps
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="pb-16">
        <div className="px-4 md:px-6 pt-4 pb-4 flex items-center gap-3">
          <button
            onClick={() => navigate(`/${username}/apps`)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">{list.List_Name}</h1>
            {list.list_description && (
              <p className="text-xs text-white/40 mt-0.5">{list.list_description}</p>
            )}
          </div>
        </div>

        {apps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <Smartphone size={28} className="text-white/20 mb-3" />
            <p className="text-sm text-white/40">No apps in this list.</p>
          </div>
        ) : (
          <div className="px-4 md:px-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {apps.map((app) => (
              <button
                key={app.documentId}
                onClick={() => handleAppClick(app)}
                className="rounded-2xl bg-white/[0.04] border border-white/[0.07] hover:border-violet-500/40 hover:bg-white/[0.07] p-3 text-left transition-all"
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 mb-2 shadow-md mx-auto">
                  {app.logo_url ? (
                    <img src={app.logo_url} alt={app.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Smartphone size={18} className="text-white/20" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-semibold text-white text-center line-clamp-2 leading-tight">{app.title}</p>
                {app.developer && (
                  <p className="text-[10px] text-white/40 text-center mt-0.5 truncate">{app.developer}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <AppDetailModal
        open={!!selectedApp}
        app={selectedApp}
        onClose={() => setSelectedApp(null)}
      />
    </>
  );
};

export default PublicAppList;
