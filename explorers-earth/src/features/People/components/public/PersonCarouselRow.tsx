import { Users } from "lucide-react";
import type { PersonList, RecommendedPerson } from "../../types";
import { buildImageUrl, getPlatformBadgeClass, getPlatformLabel } from "../../utils/personHelpers";
import { deduplicatePeople } from "../../utils/personHelpers";

interface PersonCarouselRowProps {
  list: PersonList;
  onPersonClick: (person: RecommendedPerson) => void;
  onViewAll: () => void;
}

const PersonCarouselRow = ({ list, onPersonClick, onViewAll }: PersonCarouselRowProps) => {
  const people = deduplicatePeople(list.recommended_people ?? []);
  if (people.length === 0) return null;

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

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {people.map((person) => (
          <button
            key={person.documentId}
            onClick={() => onPersonClick(person)}
            className="flex-shrink-0 w-[110px] flex flex-col items-center gap-2 text-center group"
          >
            {/* Circular avatar */}
            <div className="relative w-20 h-20 rounded-full overflow-hidden bg-white/5 ring-2 ring-white/10 group-hover:ring-violet-400/50 transition-all shadow-lg group-hover:scale-105 duration-200">
              {person.avatar_url ? (
                <img src={buildImageUrl(person.avatar_url)} alt={person.full_name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Users size={24} className="text-white/20" />
                </div>
              )}
              {/* Platform badge */}
              {person.platform && (
                <div className={`absolute bottom-0 right-0 text-[8px] font-bold px-1 py-0.5 rounded-tl-lg border-t border-l ${getPlatformBadgeClass(person.platform)}`}>
                  {getPlatformLabel(person.platform).split(" ")[0]}
                </div>
              )}
            </div>
            <div className="w-full">
              <p className="text-xs font-semibold text-white line-clamp-1">{person.full_name}</p>
              {person.handle && (
                <p className="text-[10px] text-white/40 truncate">@{person.handle}</p>
              )}
              {person.headline && (
                <p className="text-[10px] text-white/30 line-clamp-1 mt-0.5">{person.headline}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default PersonCarouselRow;
