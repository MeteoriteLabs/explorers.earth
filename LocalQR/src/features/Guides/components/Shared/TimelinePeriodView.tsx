/**
 * TimelinePeriodView Component
 * Renders a time period (morning/afternoon/evening) with places and distance connectors
 */

import React from "react";
import { DayPlace, TransportSegment } from "../../types/guideSectionTypes";
import PlaceCardTimeline from "./PlaceCardTimeline";
import DistanceConnector from "./DistanceConnector";
import TipsIcon from "../../../../assets/icons/TipsIcon";
import BudgetIcon from "../../../../assets/icons/BudgetIcon";

interface TimelinePeriodViewProps {
  period: "morning" | "afternoon" | "evening";
  places: DayPlace[] | string;
  transportSegments?: TransportSegment[];
}

const TimelinePeriodView: React.FC<TimelinePeriodViewProps> = ({
  period,
  places,
  transportSegments = [],
}) => {
  if (!places || (Array.isArray(places) && places.length === 0)) return null;

  // Color mapping for periods
  const colorConfig: Record<string, { color: string; label: string; borderClass: string }> = {
    morning: { color: "amber", label: "Morning", borderClass: "border-amber-300/40" },
    afternoon: { color: "sky", label: "Afternoon", borderClass: "border-sky-300/40" },
    evening: { color: "indigo", label: "Evening", borderClass: "border-indigo-300/40" },
  };

  const config = colorConfig[period] || colorConfig.morning;
  const periodColorClass = config.color;

  return (
    <div>
      <div className="mb-4 ml-2">
        <h4 className="text-dashboard font-poppins font-bold text-base">
          {config.label}
        </h4>
      </div>
      {Array.isArray(places) ? (
        <div className="relative">
          <div className="space-y-0">
            {places.map((place: DayPlace, idx: number) => (
              <div key={idx}>
                {/* Place Card */}
                <PlaceCardTimeline
                  place={place}
                  periodColor={periodColorClass}
                />

                {/* Transport badge - First after place */}
                {idx < places.length - 1 && (
                  <DistanceConnector
                    fromPlace={place}
                    toPlace={places[idx + 1]}
                    transportSegments={transportSegments}
                    periodColor={periodColorClass}
                  />
                )}

                {/* Tips badge - Second */}
                {place.tips && (
                  <div className={`mb-3 ml-6 p-2 ${periodColorClass === 'amber' ? 'bg-amber-500/10 border-amber-300/20' : periodColorClass === 'sky' ? 'bg-sky-500/10 border-sky-300/20' : 'bg-indigo-500/10 border-indigo-300/20'} rounded-md border`}>
                    <div className="flex items-start gap-2">
                      <TipsIcon size="4" color={periodColorClass === 'amber' ? 'rgb(251 191 36)' : periodColorClass === 'sky' ? 'rgb(125 211 252)' : 'rgb(165 180 252)'} />
                      <p className="text-dashboard-light text-xs font-poppins italic flex-1">
                        {place.tips}
                      </p>
                    </div>
                  </div>
                )}

                {/* Budget badge - Third */}
                {place.customBudget && (
                  <div className="mb-3 ml-6 p-2 bg-green-500/10 rounded-md border border-green-300/20">
                    <div className="flex items-center gap-2">
                      <BudgetIcon size="4" />
                      <p className="text-dashboard-light text-xs font-poppins flex-1">
                        {place.customBudget}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-dashboard-light leading-relaxed font-poppins whitespace-pre-wrap">
          {places}
        </p>
      )}
    </div>
  );
};

export default TimelinePeriodView;
