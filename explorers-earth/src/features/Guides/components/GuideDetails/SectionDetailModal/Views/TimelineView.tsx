/**
 * TimelineView Component
 * Displays the daily schedule with morning, afternoon, and evening periods
 */

import React from "react";
import { getTransportSegments } from "../../../../utils/guideHelpers";
import { parseTimeline } from "../../../../utils/guideDataParser";
import TimelinePeriodView from "../../../Shared/TimelinePeriodView";
import DistanceConnector from "../../../Shared/DistanceConnector";

interface TimelineViewProps {
  timeline: any;
  section: any;
}

const TimelineView: React.FC<TimelineViewProps> = ({ timeline, section }) => {
  if (!timeline) return null;

  const transportSegments = getTransportSegments(section);
  const timelineData = parseTimeline(timeline);

  const morningPlaces = timelineData.morning || [];
  const afternoonPlaces = timelineData.afternoon || [];
  const eveningPlaces = timelineData.evening || [];

  return (
    <div>
      <h3 className="text-dashboard text-lg font-poppins font-semibold mb-3 flex items-center gap-2">
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
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Daily Schedule
      </h3>
      <div className="relative pl-6 space-y-6">
        {/* Continuous vertical timeline bar */}
        <div className="absolute left-2 top-0 bottom-0 w-0.5 border-l-2 border-dashed border-red-500"></div>
        {morningPlaces.length > 0 && (
          <>
            <TimelinePeriodView
              period="morning"
              places={morningPlaces}
              transportSegments={transportSegments}
            />
            {/* Cross-period connector: Morning to Afternoon */}
            {afternoonPlaces.length > 0 && (() => {
              const lastMorningPlace = morningPlaces[morningPlaces.length - 1];
              const firstAfternoonPlace = afternoonPlaces[0];
              
              if (!lastMorningPlace.geometry || !firstAfternoonPlace.geometry) return null;
              
              return (
                <div className="ml-6">
                  <DistanceConnector
                    fromPlace={lastMorningPlace}
                    toPlace={firstAfternoonPlace}
                    transportSegments={transportSegments}
                    periodColor="amber"
                  />
                </div>
              );
            })()}
          </>
        )}
        {afternoonPlaces.length > 0 && (
          <>
            <TimelinePeriodView
              period="afternoon"
              places={afternoonPlaces}
              transportSegments={transportSegments}
            />
            {/* Cross-period connector: Afternoon to Evening */}
            {eveningPlaces.length > 0 && (() => {
              const lastAfternoonPlace = afternoonPlaces[afternoonPlaces.length - 1];
              const firstEveningPlace = eveningPlaces[0];
              
              if (!lastAfternoonPlace.geometry || !firstEveningPlace.geometry) return null;
              
              return (
                <div className="ml-6">
                  <DistanceConnector
                    fromPlace={lastAfternoonPlace}
                    toPlace={firstEveningPlace}
                    transportSegments={transportSegments}
                    periodColor="sky"
                  />
                </div>
              );
            })()}
          </>
        )}
        {eveningPlaces.length > 0 && (
          <TimelinePeriodView
            period="evening"
            places={eveningPlaces}
            transportSegments={transportSegments}
          />
        )}
      </div>
    </div>
  );
};

export default TimelineView;

