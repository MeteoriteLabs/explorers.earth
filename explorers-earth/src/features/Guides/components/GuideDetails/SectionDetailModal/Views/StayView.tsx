/**
 * StayView Component
 * Displays accommodation information
 */

import React from "react";
import { getPlaceIcon } from "../../../../utils/placeIconMapper";
import DirectionIcon from "../../../../../../assets/icons/DirectionIcon";
import StayIcon from "../../../../../../assets/icons/StayIcon";

interface StayViewProps {
  stay: any;
}

const StayView: React.FC<StayViewProps> = ({ stay }) => {
  if (!stay) return null;

  try {
    const stayData =
      typeof stay === "string" ? JSON.parse(stay) : stay;

    if (!stayData.accommodations || stayData.accommodations.length === 0) {
      return null;
    }

    return (
      <div>
        <h3 className="text-dashboard text-lg font-poppins font-semibold mb-3 flex items-center gap-2">
          <StayIcon />
          Accommodations
        </h3>
        <div className="space-y-3">
          {stayData.accommodations.map((place: any, idx: number) => {
            const placeIcon = getPlaceIcon(place.types || [], "5", "white");

            return (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 bg-dashboard-bg rounded-lg border border-dashboard-muted hover:border-dashboard-accent/40 transition-all shadow-sm"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-dashboard-sidebar flex items-center justify-center">
                  {placeIcon}
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="text-dashboard font-poppins font-semibold text-sm truncate">
                    {place.name}
                  </h5>
                </div>
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
            );
          })}
        </div>
      </div>
    );
  } catch {
    return null;
  }
};

export default StayView;

