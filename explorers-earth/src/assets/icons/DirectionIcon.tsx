import { memo } from "react";

interface DirectionIconProps {
  size?: string;
  color?: string;
}

const DirectionIcon = memo(({ size = "6", color }: DirectionIconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={`size-${size}`}
      fill={color || "currentColor"}
    >
      <path d="M9 10a1 1 0 0 0-1 1v4h2v-3h3v2.5l3.5-3.5L13 7.5V10zm3.707-8.607l9.9 9.9a1 1 0 0 1 0 1.414l-9.9 9.9a1 1 0 0 1-1.414 0l-9.9-9.9a1 1 0 0 1 0-1.414l9.9-9.9a1 1 0 0 1 1.414 0" />
    </svg>
  );
});

DirectionIcon.displayName = "DirectionIcon";

export default DirectionIcon;
