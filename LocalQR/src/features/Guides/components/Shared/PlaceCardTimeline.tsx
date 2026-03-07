/**
 * PlaceCardTimeline Component
 * Place card for timeline views with icon, name, and direction link
 */

import React from "react";
import { DayPlace } from "../../types/guideSectionTypes";
import { getPlaceIcon } from "../../utils/placeIconMapper";
import DirectionIcon from "../../../../assets/icons/DirectionIcon";

interface PlaceCardTimelineProps {
  place: DayPlace;
  periodColor?: string; // Tailwind color class for the period (amber, sky, indigo)
}

const PlaceCardTimeline: React.FC<PlaceCardTimelineProps> = ({
  place,
  periodColor = "amber",
}) => {
  const placeIcon = getPlaceIcon(place.types || [], "5", "white");

  // Color mapping for period dots
  const dotColors: Record<string, string> = {
    amber: "bg-amber-400",
    sky: "bg-sky-400",
    indigo: "bg-indigo-400",
  };

  // Border classes - must use full class names for Tailwind
  const borderClasses: Record<string, { border: string; borderHover: string }> = {
    amber: {
      border: "border-amber-200/20",
      borderHover: "hover:border-amber-400/40",
    },
    sky: {
      border: "border-sky-200/20",
      borderHover: "hover:border-sky-400/40",
    },
    indigo: {
      border: "border-indigo-200/20",
      borderHover: "hover:border-indigo-400/40",
    },
  };

  const dotColor = dotColors[periodColor] || dotColors.amber;
  const borderClass = borderClasses[periodColor] || borderClasses.amber;

  return (
    <div className="relative">
      {/* Place Card */}
      <div
        className={`relative flex items-center gap-3 p-3 bg-dashboard-bg rounded-lg border ${borderClass.border} ${borderClass.borderHover} transition-all shadow-sm mb-3`}
      >
        {/* Timeline Dot */}
        <div
          className={`absolute -left-[22px] top-3 w-3 h-3 rounded-full ${dotColor} border-2 border-dashboard-sidebar shadow-md`}
        ></div>

        {/* Place Icon */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-dashboard-bg flex items-center justify-center">
          {placeIcon}
        </div>

        {/* Place Details */}
        <div className="flex-1 min-w-0">
          <h5 className="text-dashboard font-poppins font-semibold text-sm truncate">
            {place.name}
          </h5>
        </div>

        {/* Direction Icon */}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            place.name
          )}&query_place_id=${place.place_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400 hover:text-blue-500 transition-all"
          title="Open in Google Maps"
        >
          <DirectionIcon size="4" />
        </a>
      </div>
    </div>
  );
};

export default PlaceCardTimeline;

