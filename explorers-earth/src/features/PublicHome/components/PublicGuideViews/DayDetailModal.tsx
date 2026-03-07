import { memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { parseTimeline } from "../../../Guides/utils/guideDataParser";
import ClockIcon from "../../../../assets/icons/ClockIcon";
import Location from "../../../../assets/icons/Location";
import CrossIcon from "../../../../assets/icons/CrossIcon";

interface DayDetailModalProps {
  day: any;
  isOpen: boolean;
  onClose: () => void;
}

const DayDetailModal = memo(({ day, isOpen, onClose }: DayDetailModalProps) => {
  const timeline = useMemo(() => parseTimeline(day.Timeline), [day.Timeline]);
  const dayNum = day.Sequence || 1;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal Container */}
          <div className="fixed inset-x-0 bottom-0 top-12 md:top-12 z-[9999] md:max-w-4xl md:mx-auto pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative bg-black rounded-t-2xl border border-gray-700 w-full h-full overflow-y-auto scrollbar-hide flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-black border-b border-gray-700 p-4 sm:p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-white font-poppins font-bold text-xl sm:text-2xl">
                    {day.Title || `Day ${dayNum}`}
                  </h2>
                  {day.Description && (
                    <p className="text-gray-400 text-sm font-poppins mt-1">
                      {typeof day.Description === "string" ? day.Description : ""}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full border border-gray-600 hover:border-gray-400 transition-colors bg-gray-800 hover:bg-gray-700"
                >
                  <CrossIcon stroke="#ffffff" size="5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Morning */}
                {timeline.morning && timeline.morning.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ClockIcon size="4" />
                      <span className="text-gray-300 text-sm font-poppins font-semibold">
                        Morning
                      </span>
                    </div>
                    <div className="space-y-2 ml-6">
                      {timeline.morning.map((place: any, placeIdx: number) => (
                        <div
                          key={placeIdx}
                          className="flex items-start gap-2 text-gray-300 text-sm bg-gray-900 rounded-lg p-3 border border-gray-800"
                        >
                          <div className="text-gray-300 mt-0.5 flex-shrink-0">
                            <Location size="4" fill="currentColor" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{place.name}</p>
                            {place.formatted_address && (
                              <p className="text-gray-500 text-xs mt-1">
                                {place.formatted_address}
                              </p>
                            )}
                            {place.tips && (
                              <p className="text-gray-400 text-xs mt-1 italic">
                                💡 {place.tips}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Afternoon */}
                {timeline.afternoon && timeline.afternoon.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ClockIcon size="4" />
                      <span className="text-gray-300 text-sm font-poppins font-semibold">
                        Afternoon
                      </span>
                    </div>
                    <div className="space-y-2 ml-6">
                      {timeline.afternoon.map((place: any, placeIdx: number) => (
                        <div
                          key={placeIdx}
                          className="flex items-start gap-2 text-gray-300 text-sm bg-gray-900 rounded-lg p-3 border border-gray-800"
                        >
                          <div className="text-gray-300 mt-0.5 flex-shrink-0">
                            <Location size="4" fill="currentColor" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{place.name}</p>
                            {place.formatted_address && (
                              <p className="text-gray-500 text-xs mt-1">
                                {place.formatted_address}
                              </p>
                            )}
                            {place.tips && (
                              <p className="text-gray-400 text-xs mt-1 italic">
                                💡 {place.tips}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evening */}
                {timeline.evening && timeline.evening.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ClockIcon size="4" />
                      <span className="text-gray-300 text-sm font-poppins font-semibold">
                        Evening
                      </span>
                    </div>
                    <div className="space-y-2 ml-6">
                      {timeline.evening.map((place: any, placeIdx: number) => (
                        <div
                          key={placeIdx}
                          className="flex items-start gap-2 text-gray-300 text-sm bg-gray-900 rounded-lg p-3 border border-gray-800"
                        >
                          <div className="text-gray-300 mt-0.5 flex-shrink-0">
                            <Location size="4" fill="currentColor" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{place.name}</p>
                            {place.formatted_address && (
                              <p className="text-gray-500 text-xs mt-1">
                                {place.formatted_address}
                              </p>
                            )}
                            {place.tips && (
                              <p className="text-gray-400 text-xs mt-1 italic">
                                💡 {place.tips}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {timeline.morning?.length === 0 &&
                  timeline.afternoon?.length === 0 &&
                  timeline.evening?.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-400 text-sm font-poppins">
                        No places added for this day yet.
                      </p>
                    </div>
                  )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
});

DayDetailModal.displayName = "DayDetailModal";

export default DayDetailModal;
