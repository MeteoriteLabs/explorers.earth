import { memo, useMemo } from "react";
import { parseTimeline } from "../../../Guides/utils/guideDataParser";
import ClockIcon from "../../../../assets/icons/ClockIcon";
import Location from "../../../../assets/icons/Location";

interface PublicGuideJourneyViewProps {
  guide: any;
  sections: any[];
}

const PublicGuideJourneyView = memo(({ sections }: PublicGuideJourneyViewProps) => {
  const sectionsWithData = useMemo(() => {
    return sections.filter((section) => {
      const timeline = parseTimeline(section.Timeline);
      const hasPlaces =
        (timeline.morning?.length || 0) +
        (timeline.afternoon?.length || 0) +
        (timeline.evening?.length || 0) >
        0;
      return hasPlaces || section.Description;
    });
  }, [sections]);

  if (sectionsWithData.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-3 sm:p-4 md:p-6 border border-gray-700">
        <h2 className="text-white text-base sm:text-lg md:text-xl font-poppins font-bold mb-1 sm:mb-2">
          Journey
        </h2>
        <p className="text-gray-400 text-xs sm:text-sm font-poppins">
          No journey information available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      <h2 className="text-white text-base sm:text-lg md:text-xl font-poppins font-bold">Journey</h2>
      
      <div className="space-y-3 sm:space-y-4 md:space-y-6">
        {sectionsWithData.map((section, idx) => {
          const timeline = parseTimeline(section.Timeline);
          const allPlaces = [
            ...(timeline.morning || []),
            ...(timeline.afternoon || []),
            ...(timeline.evening || []),
          ];

          return (
            <div
              key={section.documentId || idx}
              className="bg-gray-900 rounded-lg p-2.5 sm:p-3 md:p-4 lg:p-6 border border-gray-700"
            >
              {/* Section Header */}
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 md:mb-4">
                <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0">
                  {section.Sequence || idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-white font-poppins font-bold text-sm sm:text-base md:text-lg line-clamp-2">
                    {section.Title || `Day ${section.Sequence || idx + 1}`}
                  </h3>
                  {section.Description && (
                    <p className="text-gray-400 text-xs sm:text-sm mt-0.5 sm:mt-1 line-clamp-3">
                      {typeof section.Description === "string"
                        ? section.Description
                        : ""}
                    </p>
                  )}
                </div>
              </div>

              {/* Places by Time Period */}
              {allPlaces.length > 0 && (
                <div className="space-y-2 sm:space-y-3 md:space-y-4">
                  {timeline.morning && timeline.morning.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                        <div className="text-gray-300">
                          <ClockIcon size="4" />
                        </div>
                        <span className="text-gray-300 text-xs sm:text-sm font-poppins font-medium">
                          Morning
                        </span>
                      </div>
                      <div className="space-y-1.5 sm:space-y-2 ml-4 sm:ml-5 md:ml-6">
                        {timeline.morning.map((place: any, placeIdx: number) => (
                          <div
                            key={placeIdx}
                            className="flex items-start gap-1.5 sm:gap-2 text-gray-300 text-xs sm:text-sm"
                          >
                            <div className="text-gray-300 mt-0.5 sm:mt-1 flex-shrink-0">
                              <Location size="4" fill="currentColor" />
                            </div>
                            <span className="line-clamp-2">{place.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {timeline.afternoon && timeline.afternoon.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                        <div className="text-gray-300">
                          <ClockIcon size="4" />
                        </div>
                        <span className="text-gray-300 text-xs sm:text-sm font-poppins font-medium">
                          Afternoon
                        </span>
                      </div>
                      <div className="space-y-1.5 sm:space-y-2 ml-4 sm:ml-5 md:ml-6">
                        {timeline.afternoon.map((place: any, placeIdx: number) => (
                          <div
                            key={placeIdx}
                            className="flex items-start gap-1.5 sm:gap-2 text-gray-300 text-xs sm:text-sm"
                          >
                            <div className="text-gray-300 mt-0.5 sm:mt-1 flex-shrink-0">
                              <Location size="4" fill="currentColor" />
                            </div>
                            <span className="line-clamp-2">{place.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {timeline.evening && timeline.evening.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                        <div className="text-gray-300">
                          <ClockIcon size="4" />
                        </div>
                        <span className="text-gray-300 text-xs sm:text-sm font-poppins font-medium">
                          Evening
                        </span>
                      </div>
                      <div className="space-y-1.5 sm:space-y-2 ml-4 sm:ml-5 md:ml-6">
                        {timeline.evening.map((place: any, placeIdx: number) => (
                          <div
                            key={placeIdx}
                            className="flex items-start gap-1.5 sm:gap-2 text-gray-300 text-xs sm:text-sm"
                          >
                            <div className="text-gray-300 mt-0.5 sm:mt-1 flex-shrink-0">
                              <Location size="4" fill="currentColor" />
                            </div>
                            <span className="line-clamp-2">{place.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

PublicGuideJourneyView.displayName = "PublicGuideJourneyView";

export default PublicGuideJourneyView;

