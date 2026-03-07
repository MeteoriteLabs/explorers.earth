/**
 * TransportView Component
 * Displays transportation segments grouped by period (morning/afternoon/evening)
 */

import React from "react";
import { DayPlace, TransportSegment } from "../../../../types/guideSectionTypes";
import { getTransportSegments } from "../../../../utils/guideHelpers";
import { parseTimeline } from "../../../../utils/guideDataParser";
import {
  getTravelModeConfig,
  getTravelModeLabel,
} from "../../../../utils/travelModeConfig";

interface TransportViewProps {
  transport: any;
  timeline: any;
  section: any;
}

const TransportView: React.FC<TransportViewProps> = ({
  timeline,
  section,
}) => {
  const transportSegments = getTransportSegments(section);

  if (transportSegments.length === 0) return null;

  // Parse timeline to group segments
  const timelineData = parseTimeline(timeline);
  const morningPlaces = timelineData.morning || [];
  const afternoonPlaces = timelineData.afternoon || [];
  const eveningPlaces = timelineData.evening || [];

  const renderRoute = (
    place: DayPlace,
    nextPlace: DayPlace,
    segment: TransportSegment | undefined,
    periodColor: "amber" | "sky" | "indigo"
  ) => {
    const modeConfig = getTravelModeConfig(segment?.mode || "drive");
    const colorClasses = {
      amber: {
        bg: "bg-amber-500/5",
        border: "border-amber-300/20",
        icon: "text-amber-400",
        label: "text-amber-300",
        badge: "bg-amber-500/10",
      },
      sky: {
        bg: "bg-sky-500/5",
        border: "border-sky-300/20",
        icon: "text-sky-400",
        label: "text-sky-300",
        badge: "bg-sky-500/10",
      },
      indigo: {
        bg: "bg-indigo-500/5",
        border: "border-indigo-300/20",
        icon: "text-indigo-400",
        label: "text-indigo-300",
        badge: "bg-indigo-500/10",
      },
    };

    const colors = colorClasses[periodColor];

    return (
      <div
        key={`${place.place_id}-${nextPlace.place_id}`}
        className={`flex items-center gap-3 p-3 ${colors.bg} border ${colors.border} rounded-lg`}
      >
        <div className={`flex-shrink-0 ${colors.icon}`}>
          {modeConfig?.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-dashboard-light font-poppins truncate">
            {place.name}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <svg
              className={`w-3 h-3 ${colors.icon}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-xs text-dashboard-light font-poppins truncate">
              {nextPlace.name}
            </div>
          </div>
        </div>
        <div
          className={`flex-shrink-0 px-2 py-1 ${colors.badge} rounded text-xs ${colors.label} font-poppins font-medium`}
        >
          {getTravelModeLabel(
            segment?.mode || "drive",
            segment?.estimatedMinutes || 0
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h3 className="text-dashboard text-lg font-poppins font-semibold mb-4 flex items-center gap-2">
        <svg
          className="w-5 h-5 text-dashboard-accent"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
        Getting Around
      </h3>
      <p className="text-dashboard-light text-sm font-poppins mb-4">
        Your selected transportation modes between places:
      </p>

      <div className="space-y-6">
        {/* Morning Routes */}
        {morningPlaces.length > 1 && (
          <div className="space-y-3">
            <h5 className="text-dashboard font-poppins font-semibold text-sm">
              Morning Routes
            </h5>
            {morningPlaces.slice(0, -1).map((place: DayPlace, index: number) => {
              const nextPlace = morningPlaces[index + 1];
              const segment = transportSegments.find(
                (seg: TransportSegment) =>
                  seg.fromPlaceId === place.place_id &&
                  seg.toPlaceId === nextPlace.place_id
              );
              return renderRoute(place, nextPlace, segment, "amber");
            })}
          </div>
        )}

        {/* Afternoon Routes */}
        {afternoonPlaces.length > 1 && (
          <div className="space-y-3">
            <h5 className="text-dashboard font-poppins font-semibold text-sm">
              Afternoon Routes
            </h5>
            {afternoonPlaces.slice(0, -1).map((place: DayPlace, index: number) => {
              const nextPlace = afternoonPlaces[index + 1];
              const segment = transportSegments.find(
                (seg: TransportSegment) =>
                  seg.fromPlaceId === place.place_id &&
                  seg.toPlaceId === nextPlace.place_id
              );
              return renderRoute(place, nextPlace, segment, "sky");
            })}
          </div>
        )}

        {/* Evening Routes */}
        {eveningPlaces.length > 1 && (
          <div className="space-y-3">
            <h5 className="text-dashboard font-poppins font-semibold text-sm">
              Evening Routes
            </h5>
            {eveningPlaces.slice(0, -1).map((place: DayPlace, index: number) => {
              const nextPlace = eveningPlaces[index + 1];
              const segment = transportSegments.find(
                (seg: TransportSegment) =>
                  seg.fromPlaceId === place.place_id &&
                  seg.toPlaceId === nextPlace.place_id
              );
              return renderRoute(place, nextPlace, segment, "indigo");
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransportView;

