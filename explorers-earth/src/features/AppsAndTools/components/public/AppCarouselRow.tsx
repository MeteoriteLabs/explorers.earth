import { Smartphone } from "lucide-react";
import type { AppList, RecommendedApp } from "../../types";
import { buildLogoUrl, getPriceTierColor } from "../../utils/appHelpers";
import { deduplicateApps } from "../../utils/appHelpers";

interface AppCarouselRowProps {
  list: AppList;
  onAppClick: (app: RecommendedApp) => void;
  onViewAll: () => void;
}

const AppCarouselRow = ({ list, onAppClick, onViewAll }: AppCarouselRowProps) => {
  const apps = deduplicateApps(list.recommended_apps ?? []);
  if (apps.length === 0) return null;

  return (
    <div className="px-4 md:px-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold text-white">{list.List_Name}</h2>
          {list.list_description && (
            <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{list.list_description}</p>
          )}
        </div>
        <button
          onClick={onViewAll}
          className="text-xs text-violet-400/70 hover:text-violet-400 font-medium transition-colors whitespace-nowrap"
        >
          View all →
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {apps.map((app) => (
          <button
            key={app.documentId}
            onClick={() => onAppClick(app)}
            className="flex-shrink-0 w-[130px] rounded-2xl bg-white/[0.04] border border-white/[0.07] hover:border-violet-500/40 hover:bg-white/[0.07] p-3 text-left transition-all"
          >
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 mb-2 shadow-md">
              {app.logo_url ? (
                <img src={buildLogoUrl(app.logo_url)} alt={app.title} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Smartphone size={18} className="text-white/20" />
                </div>
              )}
            </div>
            <p className="text-xs font-semibold text-white line-clamp-2 leading-tight mb-1.5">{app.title}</p>
            {app.price_tier && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getPriceTierColor(app.price_tier)}`}>
                {app.price_tier}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AppCarouselRow;
