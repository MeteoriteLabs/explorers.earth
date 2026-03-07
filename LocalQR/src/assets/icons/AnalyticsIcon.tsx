import React from "react";

interface AnalyticsIconProps {
  size?: string;
  fill?: string;
}

const AnalyticsIcon: React.FC<AnalyticsIconProps> = ({ 
  size = "24", 
  fill = "currentColor" 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 13H7L9 7L13 17L15 11L21 13V15H3V13Z"
        fill={fill}
        stroke={fill}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 3H21V5H3V3Z"
        fill={fill}
        stroke={fill}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 19H21V21H3V19Z"
        fill={fill}
        stroke={fill}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default AnalyticsIcon;
