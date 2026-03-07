/**
 * DistanceConnector Component
 * Displays distance and travel time between two places
 */

import React from "react";
import { TransportSegment } from "../../types/guideSectionTypes";
import {
  getTravelModeConfig,
  getTravelModeLabel,
} from "../../utils/travelModeConfig";
import { calculateDistance } from "../../utils/distanceCalculator";
import TransportationIcon from "../../../../assets/icons/TransportationIcon";

interface DistanceConnectorProps {
  fromPlace: {
    place_id: string;
    geometry?: {
      location: { lat: number; lng: number };
    };
  };
  toPlace: {
    place_id: string;
    geometry?: {
      location: { lat: number; lng: number };
    };
  };
  transportSegments?: TransportSegment[];
  periodColor?: string; // Tailwind color class for the period (amber, sky, indigo)
}

const DistanceConnector: React.FC<DistanceConnectorProps> = ({
  fromPlace,
  toPlace,
  transportSegments = [],
  periodColor = "amber",
}) => {
  if (!fromPlace.geometry || !toPlace.geometry) return null;

  const distanceKm = calculateDistance(
    fromPlace.geometry.location.lat,
    fromPlace.geometry.location.lng,
    toPlace.geometry.location.lat,
    toPlace.geometry.location.lng
  );

  if (!distanceKm) return null;

  // Find matching transport segment
  const segment = transportSegments.find(
    (seg: TransportSegment) =>
      seg.fromPlaceId === fromPlace.place_id &&
      seg.toPlaceId === toPlace.place_id
  );

  const mode = segment?.mode || "drive";
  const modeConfig = getTravelModeConfig(mode);
  const travelMinutes = segment?.estimatedMinutes || 0;
  const travelLabel =
    travelMinutes > 0
      ? getTravelModeLabel(mode, travelMinutes)
      : `${(distanceKm * 2).toFixed(0)} min ${mode}`;

  const distanceStr =
    distanceKm < 1
      ? `${Math.round(distanceKm * 1000)} m`
      : `${distanceKm.toFixed(1)} km`;

  // Color mapping for periods - must use full class names for Tailwind
  const colorClasses: Record<string, any> = {
    amber: {
      dot: "bg-amber-400",
      border: "border-amber-300/40",
      text: "text-amber-300",
      textMuted: "text-amber-300/60",
      textStrong: "text-amber-300/80",
      bg: "bg-amber-500/10",
      borderCard: "border-amber-300/20",
    },
    sky: {
      dot: "bg-sky-400",
      border: "border-sky-300/40",
      text: "text-sky-300",
      textMuted: "text-sky-300/60",
      textStrong: "text-sky-300/80",
      bg: "bg-sky-500/10",
      borderCard: "border-sky-300/20",
    },
    indigo: {
      dot: "bg-indigo-400",
      border: "border-indigo-300/40",
      text: "text-indigo-300",
      textMuted: "text-indigo-300/60",
      textStrong: "text-indigo-300/80",
      bg: "bg-indigo-500/10",
      borderCard: "border-indigo-300/20",
    },
  };

  const colors = colorClasses[periodColor] || colorClasses.amber;

  return (
    <div className="relative py-2 mb-3">
      <div
        className={`flex items-center gap-2 px-2 py-1 ${colors.bg} rounded-md border ${colors.borderCard} ml-6`}
      >
        <span className="w-4 h-4 flex items-center justify-center">
          {modeConfig?.icon || (
            <TransportationIcon
              size="4"
              color={
                periodColor === "amber"
                  ? "rgb(252 211 77 / 0.6)"
                  : periodColor === "sky"
                  ? "rgb(125 211 252 / 0.6)"
                  : "rgb(165 180 252 / 0.6)"
              }
            />
          )}
        </span>
        <span className={`${colors.text} text-xs font-poppins font-medium`}>
          {distanceStr}
        </span>
        <span className={`${colors.textMuted} text-xs font-poppins`}>•</span>
        <span className={`${colors.textStrong} text-xs font-poppins`}>
          {travelLabel}
        </span>
      </div>
    </div>
  );
};

export default DistanceConnector;

