import React from "react";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  onColor?: string;
  offColor?: string;
}

const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  loading = false,
  label,
  onColor = "bg-dashboard-accent",
  offColor = "bg-gray-600/80",
}) => {
  const isInteractionDisabled = disabled || loading;
  return (
    <div 
      className={`flex items-center gap-2 ${isInteractionDisabled ? "cursor-not-allowed" : "cursor-pointer"}`} 
      onClick={() => !isInteractionDisabled && onChange(!checked)}
    >
      {label && <span className="text-xs font-semibold text-dashboard">{label}</span>}
      <button
        type="button"
        disabled={isInteractionDisabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none ${
          checked ? onColor : offColor
        } ${disabled && !loading ? "opacity-50" : ""}`}
        aria-label={label || "Toggle"}
      >
        <div
          className={`flex items-center justify-center h-4 w-4 rounded-full bg-white shadow-md transition-all duration-300 ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        >
          {loading && (
            <div className="h-2.5 w-2.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </button>
    </div>
  );
};

export default Switch;
