import { memo } from "react";

interface AnalyticsProps {
  size?: string;
  fill?: string;
  variant?: string;
}

const Analytics = memo(({ size = "24", fill = "currentColor", variant }: AnalyticsProps) => {
  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
      >
        <defs>
          <linearGradient id="gradient-fill" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7c29d8" />
            <stop offset="50%" stopColor="#5039da" />
            <stop offset="100%" stopColor="#204adc" />
          </linearGradient>
        </defs>
        <path
          fill={variant === "gradient" ? "url(#gradient-fill)" : fill}
          d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z"
        />
        <path
          fill={variant === "gradient" ? "url(#gradient-fill)" : fill}
          d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z"
        />
      </svg>
    </>
  );
});

export default Analytics;
