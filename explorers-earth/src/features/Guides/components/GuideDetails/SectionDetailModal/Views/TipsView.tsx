/**
 * TipsView Component
 * Displays place-specific tips grouped by period
 */

import React from "react";
import { DayPlace } from "../../../../types/guideSectionTypes";
import { parseTimeline } from "../../../../utils/guideDataParser";
import TipsIcon from "../../../../../../assets/icons/TipsIcon";

interface TipsViewProps {
  timeline: any;
}

const TipsView: React.FC<TipsViewProps> = ({ timeline }) => {
  if (!timeline) return null;

  const timelineData = parseTimeline(timeline);

  const morningPlaces = timelineData.morning || [];
  const afternoonPlaces = timelineData.afternoon || [];
  const eveningPlaces = timelineData.evening || [];

  const morningTips = morningPlaces.filter((p: DayPlace) => p.tips);
  const afternoonTips = afternoonPlaces.filter((p: DayPlace) => p.tips);
  const eveningTips = eveningPlaces.filter((p: DayPlace) => p.tips);

  const hasTips =
    morningTips.length > 0 ||
    afternoonTips.length > 0 ||
    eveningTips.length > 0;

  if (!hasTips) return null;

  const renderTips = (tips: DayPlace[], periodColor: string, periodLabel: string) => {
    if (tips.length === 0) return null;

    const colorConfig: Record<string, { bg: string; border: string; iconColor: string }> = {
      amber: {
        bg: "bg-amber-500/10",
        border: "border-amber-300/20",
        iconColor: "rgb(251 191 36)",
      },
      sky: {
        bg: "bg-sky-500/10",
        border: "border-sky-300/20",
        iconColor: "rgb(125 211 252)",
      },
      indigo: {
        bg: "bg-indigo-500/10",
        border: "border-indigo-300/20",
        iconColor: "rgb(165 180 252)",
      },
    };

    const colors = colorConfig[periodColor] || colorConfig.amber;

    return (
      <div>
        <h5 className="text-dashboard font-poppins font-semibold text-sm mb-3">
          {periodLabel} Tips
        </h5>
        <div className="space-y-3">
          {tips.map((place: DayPlace, idx: number) => (
            <div
              key={idx}
              className={`${colors.bg} rounded-md border ${colors.border} p-3`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">
                  <TipsIcon size="4" color={colors.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-dashboard font-poppins font-semibold text-sm mb-1">
                    {place.name}
                  </p>
                  <p className="text-dashboard-light text-xs font-poppins italic">
                    {place.tips}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h3 className="text-dashboard text-lg font-poppins font-semibold mb-4 flex items-center gap-2">
        <TipsIcon />
        Place-Specific Tips
      </h3>

      <div className="space-y-6">
        {renderTips(morningTips, "amber", "Morning")}
        {renderTips(afternoonTips, "sky", "Afternoon")}
        {renderTips(eveningTips, "indigo", "Evening")}
      </div>
    </div>
  );
};

export default TipsView;

