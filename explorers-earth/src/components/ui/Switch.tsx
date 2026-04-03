import React from "react";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  onColor?: string;
  offColor?: string;
}

const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  onColor = "bg-dashboard-accent",
  offColor = "bg-gray-600/80",
}) => {
  return (
    <div className="flex items-center gap-2 cursor-pointer" onClick={() => !disabled && onChange(!checked)}>
      {label && <span className="text-xs font-semibold text-dashboard">{label}</span>}
      <button
        type="button"
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
          checked ? onColor : offColor
        }`}
        aria-label={label || "Toggle"}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-md transition-all duration-300 ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
};

export default Switch;
