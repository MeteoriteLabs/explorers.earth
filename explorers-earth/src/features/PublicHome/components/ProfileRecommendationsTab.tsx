import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin, Music, Film, BookOpen, Gamepad2,
  ChevronRight
} from "lucide-react";

type CategoryKey = "places" | "music" | "movies" | "books" | "games";

interface CategoryConfig {
  key: CategoryKey;
  label: string;
  icon: React.ReactNode;
  visibilityField: string;
  description: string;
  color: string;
}

const CATEGORIES: CategoryConfig[] = [
  { 
    key: "places",  
    label: "Places",        
    icon: <MapPin  size={22} />, 
    visibilityField: "public_recommendations",
    description: "Explore curated locations and favorite spots",
    color: "emerald"
  },
  { 
    key: "music",   
    label: "Music",         
    icon: <Music   size={22} />, 
    visibilityField: "public_music",
    description: "Discover shared playlists and local tunes",
    color: "purple"
  },
  { 
    key: "movies",  
    label: "Movies & Shows", 
    icon: <Film    size={22} />, 
    visibilityField: "public_movie",
    description: "Watch lists and cinematic recommendations",
    color: "blue"
  },
  { 
    key: "books",   
    label: "Books",         
    icon: <BookOpen size={22} />, 
    visibilityField: "public_books",
    description: "Literary picks and reading collections",
    color: "orange"
  },
  { 
    key: "games",   
    label: "Games",         
    icon: <Gamepad2 size={22} />, 
    visibilityField: "public_games",
    description: "Gaming favorites and latest discoveries",
    color: "pink"
  },
];

interface ProfileRecommendationsTabProps {
  accountData: {
    documentId?: string;
    public_recommendations?: string;
    public_music?: string;
    public_movie?: string;
    public_books?: string;
    public_games?: string;
  };
  username: string;
}

const ProfileRecommendationsTab = ({ accountData, username }: ProfileRecommendationsTabProps) => {
  const navigate = useNavigate();

  // Determine which categories are visible
  const visibleCategories = useMemo(() => {
    return CATEGORIES.filter(cat => {
      const field = cat.visibilityField as keyof typeof accountData;
      const value = accountData[field];
      // Default visible if not set (for places/recommendations)
      if (cat.key === "places") {
        return value === "Yes" || value === undefined || value === null;
      }
      return value === "Yes";
    });
  }, [accountData]);

  if (visibleCategories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-white/30" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </div>
        <p className="text-white/40 font-medium">No recommendations visible</p>
        <p className="text-white/25 text-sm mt-1">The user hasn't enabled any recommendation categories</p>
      </div>
    );
  }

  const getColorStyles = (color: string) => {
    switch (color) {
      case "emerald": return "group-hover:text-emerald-400 group-hover:bg-emerald-400/10 border-emerald-500/0 group-hover:border-emerald-500/20";
      case "purple":  return "group-hover:text-purple-400 group-hover:bg-purple-400/10 border-purple-500/0 group-hover:border-purple-500/20";
      case "blue":    return "group-hover:text-blue-400 group-hover:bg-blue-400/10 border-blue-500/0 group-hover:border-blue-500/20";
      case "orange":  return "group-hover:text-orange-400 group-hover:bg-orange-400/10 border-orange-500/0 group-hover:border-orange-500/20";
      case "pink":    return "group-hover:text-pink-400 group-hover:bg-pink-400/10 border-pink-500/0 group-hover:border-pink-500/20";
      default:        return "group-hover:text-white group-hover:bg-white/10 border-white/0 group-hover:border-white/20";
    }
  };

  return (
    <div className="pt-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-10">
        {visibleCategories.map(cat => (
          <div
            key={cat.key}
            onClick={() => navigate(`/${username}/${cat.key}`)}
            className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/5 rounded-2xl hover:bg-white/[0.06] hover:border-white/10 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-white/5 text-white/40 transition-all duration-300 ${getColorStyles(cat.color)}`}>
                {cat.icon}
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm group-hover:text-white transition-colors">{cat.label}</h3>
                <p className="text-white/30 text-[11px] mt-0.5 group-hover:text-white/50 transition-colors">
                  {cat.description}
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white/10 group-hover:text-white/30 group-hover:bg-white/5 transition-all">
              <ChevronRight size={18} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfileRecommendationsTab;
