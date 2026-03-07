import React from "react";
import { TravelMode } from "../types/guideSectionTypes";
import {
  TRAVEL_MODES,
  calculateTravelTime,
  formatTravelTime,
} from "../utils/travelModeConfig";

interface TravelModeSelectorProps {
  /** Distance between two places in kilometers */
  distanceKm: number;
  /** Currently selected travel mode */
  selectedMode?: TravelMode;
  /** Callback when a travel mode is selected */
  onSelectMode: (mode: TravelMode) => void;
  /** Callback to close the selector */
  onClose: () => void;
  /** Color theme for the selector (matches time period) */
  colorTheme?: "amber" | "sky" | "indigo";
  /** Position above the trigger element */
  openUpward?: boolean;
}

/**
 * Dropdown selector for choosing travel mode between two places
 */
export const TravelModeSelector: React.FC<TravelModeSelectorProps> = ({
  distanceKm,
  selectedMode,
  onSelectMode,
  onClose,
  colorTheme = "amber",
  openUpward = false,
}) => {
  // Color classes based on theme
  const themeClasses = {
    amber: {
      bg: "bg-amber-950/95",
      border: "border-amber-300/30",
      hover: "hover:bg-amber-900/50",
      selected: "bg-amber-800/60 border-amber-400/50",
      text: "text-amber-100",
      textMuted: "text-amber-300/70",
      highlight: "text-amber-300",
    },
    sky: {
      bg: "bg-sky-950/95",
      border: "border-sky-300/30",
      hover: "hover:bg-sky-900/50",
      selected: "bg-sky-800/60 border-sky-400/50",
      text: "text-sky-100",
      textMuted: "text-sky-300/70",
      highlight: "text-sky-300",
    },
    indigo: {
      bg: "bg-indigo-950/95",
      border: "border-indigo-300/30",
      hover: "hover:bg-indigo-900/50",
      selected: "bg-indigo-800/60 border-indigo-400/50",
      text: "text-indigo-100",
      textMuted: "text-indigo-300/70",
      highlight: "text-indigo-300",
    },
  };

  const theme = themeClasses[colorTheme];

  // Handle click outside to close
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".travel-mode-selector")) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleModeSelect = (mode: TravelMode) => {
    onSelectMode(mode);
    onClose();
  };

  return (
    <div
      className={`travel-mode-selector absolute z-[5] ${
        openUpward ? "bottom-full mb-2" : "top-full mt-2"
      } w-[240px] ${theme.bg} backdrop-blur-sm border ${
        theme.border
      } rounded-lg shadow-xl overflow-hidden`}
    >
      {/* Header */}
      <div className={`px-3 py-2 border-b ${theme.border}`}>
        <div className="flex items-center justify-between">
          <h3 className={`text-xs font-poppins font-semibold ${theme.text}`}>
            Travel Mode
          </h3>
          <button
            onClick={onClose}
            className={`${theme.textMuted} hover:${theme.text} transition-colors`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-3.5 h-3.5"
            >
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
        <p className={`text-[10px] ${theme.textMuted} mt-0.5 font-poppins`}>
          {distanceKm.toFixed(1)} km
        </p>
      </div>

      {/* Mode Options */}
      <div className="max-h-[200px] overflow-y-auto scrollbar-hide">
        {TRAVEL_MODES.map((mode) => {
          const travelTime = calculateTravelTime(distanceKm, mode.mode);
          const isSelected = selectedMode === mode.mode;

          return (
            <button
              key={mode.mode}
              onClick={() => handleModeSelect(mode.mode)}
              className={`w-full px-3 py-2 flex items-center gap-2 transition-all border-b ${
                theme.border
              } ${
                isSelected
                  ? `${theme.selected} border-l-2`
                  : `${theme.hover} border-l-2 border-transparent`
              }`}
            >
              {/* Icon */}
              <div
                className={`flex-shrink-0 ${
                  isSelected ? theme.highlight : theme.textMuted
                }`}
              >
                {mode.icon}
              </div>

              {/* Mode Info */}
              <div className="flex-1 text-left">
                <div
                  className={`text-xs font-poppins font-medium ${theme.text}`}
                >
                  {mode.label}
                </div>
              </div>

              {/* Travel Time */}
              <div
                className={`text-right flex-shrink-0 ${
                  isSelected ? theme.highlight : theme.textMuted
                }`}
              >
                <div className="text-xs font-poppins font-semibold">
                  {formatTravelTime(travelTime)}
                </div>
              </div>

              {/* Selected Indicator */}
              {isSelected && (
                <div className={theme.highlight}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
