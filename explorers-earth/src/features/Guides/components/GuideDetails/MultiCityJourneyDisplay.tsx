/**
 * MultiCityJourneyDisplay Component
 * Displays the complete journey flow for multi-city guides
 * Shows: Starting Point → Intermediate Cities → Ending Point
 */

import React, { useState } from "react";
import EditIcon from "../../../../assets/icons/EditIcon";
import EditJourneyRouteModal from "./EditJourneyRouteModal";
import type { Guide } from "../../types";

interface MultiCityJourneyDisplayProps {
  guide: Guide;
  onUpdate?: () => void;
}

const MultiCityJourneyDisplay: React.FC<MultiCityJourneyDisplayProps> = ({
  guide,
  onUpdate,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Parse Place_Details to extract multi-city information
  const getMultiCityData = () => {
    if (!guide.Place_Details) return null;

    try {
      let placeDetails: any = guide.Place_Details;
      if (typeof guide.Place_Details === "string") {
        placeDetails = JSON.parse(guide.Place_Details);
      }

      // Check if it's a multi-city format
      if (
        placeDetails?.isMultiCity === true &&
        ((placeDetails.ending || placeDetails.starting) ||
         (placeDetails.arrival || placeDetails.to) ||
         (placeDetails.departure || placeDetails.from))
      ) {
        // Support new (starting/ending) and legacy (departure/arrival, from/to) keys
        const ending = placeDetails.ending || placeDetails.arrival || placeDetails.to;
        const starting = placeDetails.starting || placeDetails.departure || placeDetails.from;
        const intermediateCities =
          placeDetails.intermediateCities || [];

        return {
          ending: {
            name: ending?.Place_Name || ending?.Place_Address || "Ending Point",
            address: ending?.Place_Address || "",
          },
          starting: {
            name: starting?.Place_Name || starting?.Place_Address || "Starting Point",
            address: starting?.Place_Address || "",
          },
          intermediateCities: intermediateCities.map((city: any) => ({
            name: city.Place_Name || city.Place_Address || "City",
            address: city.Place_Address || "",
            hasDate: city.hasDate || false,
            date: city.date || undefined,
          })),
        };
      }
    } catch (error) {
      console.error("Error parsing Place_Details for multi-city display:", error);
    }

    return null;
  };

  const journeyData = getMultiCityData();

  if (!journeyData) {
    return null;
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <>
      <div className="mb-6 p-3 sm:p-4 bg-dashboard-bg/50 rounded-lg backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-dashboard-accent flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <h3 className="text-dashboard font-poppins font-semibold text-sm sm:text-base">
              Your Journey Route
            </h3>
          </div>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-dashboard-accent hover:bg-dashboard-accent/90 text-white shadow-md hover:scale-110 transition-all duration-200 focus:ring-2 focus:ring-dashboard-accent focus:ring-offset-2"
            title="Edit Journey Route"
            aria-label="Edit Journey Route"
          >
            <EditIcon color="white" />
          </button>
        </div>

      {/* Journey Flow - Horizontal Scrollable on Mobile */}
      <div className="overflow-x-auto scrollbar-hide -mx-3 sm:mx-0 px-3 sm:px-0">
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 min-w-max sm:min-w-0 sm:flex-wrap">
          {/* Starting Point */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <div className="px-2 py-1.5 sm:px-3 sm:py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg whitespace-nowrap min-w-[120px] sm:min-w-0 sm:max-w-[140px]">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-400 flex-shrink-0"></div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-poppins font-medium text-blue-400 truncate">
                    Start
                  </p>
                  <p className="text-[10px] sm:text-xs font-poppins text-blue-300/90 mt-0.5 truncate">
                    {journeyData.starting.name}
                  </p>
                </div>
              </div>
            </div>
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-white/60 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </div>

          {/* Intermediate Cities */}
          {journeyData.intermediateCities.map((city: any, index: number) => (
            <div key={index} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <div className="px-2 py-1.5 sm:px-3 sm:py-2 bg-dashboard-accent/20 border border-dashboard-accent/30 rounded-lg whitespace-nowrap min-w-[120px] sm:min-w-0 sm:max-w-[140px]">
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-dashboard-accent text-white flex items-center justify-center text-[10px] sm:text-xs font-poppins font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs font-poppins font-medium text-dashboard-accent truncate">
                      {city.name}
                    </p>
                    {city.hasDate && city.date && (
                      <p className="text-[10px] sm:text-xs font-poppins text-dashboard-accent/80 mt-0.5 truncate">
                        {formatDate(city.date)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-white/60 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </div>
          ))}

          {/* Ending Point */}
          <div className="px-2 py-1.5 sm:px-3 sm:py-2 bg-green-500/20 border border-green-500/30 rounded-lg whitespace-nowrap min-w-[120px] sm:min-w-0 sm:max-w-[140px] flex-shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-400 flex-shrink-0"></div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-poppins font-medium text-green-400 truncate">
                  End
                </p>
                <p className="text-[10px] sm:text-xs font-poppins text-green-300/90 mt-0.5 truncate">
                  {journeyData.ending.name}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Edit Modal */}
      <EditJourneyRouteModal
        guide={guide}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          onUpdate?.();
        }}
      />
    </>
  );
};

export default MultiCityJourneyDisplay;

