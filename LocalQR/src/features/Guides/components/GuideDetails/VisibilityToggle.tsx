/**
 * VisibilityToggle Component
 * Toggle switch for guide visibility (Public/Private)
 */

import EyeOnIcon from "../../../../assets/icons/EyeOnIcon";
import EyeOffIcon from "../../../../assets/icons/EyeOffIcon";

interface VisibilityToggleProps {
  isVisible: boolean;
  isToggling: boolean;
  onToggle: () => void;
}

const VisibilityToggle: React.FC<VisibilityToggleProps> = ({
  isVisible,
  isToggling,
  onToggle,
}) => {
  return (
    <div className="flex items-center gap-3">
      {/* Label with Icon */}
      <span className="text-sm font-poppins font-medium flex items-center gap-1.5 min-w-[80px]">
        {isVisible ? (
          <>
            <EyeOnIcon size="4" stroke="#3498DB" />
            <span className="text-dashboard-accent">Public</span>
          </>
        ) : (
          <>
            <EyeOffIcon size="4" stroke="#9CA3AF" />
            <span className="text-gray-400">Private</span>
          </>
        )}
      </span>

      {/* Toggle Switch */}
      <button
        onClick={onToggle}
        disabled={isToggling}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dashboard-bg
          disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg
          ${
            isVisible
              ? "bg-dashboard-accent focus:ring-dashboard-accent shadow-lg border border-blue-400"
              : "bg-gray-600/80 focus:ring-gray-500 shadow-sm"
          }`}
        aria-label="Toggle guide visibility"
        title={isVisible ? "Click to make private" : "Click to make public"}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full transition-all duration-300 
          ${
            isVisible
              ? "translate-x-6 bg-white shadow-lg"
              : "translate-x-1 bg-gray-200 shadow-md"
          }`}
        />
      </button>
    </div>
  );
};

export default VisibilityToggle;

