import { memo } from "react";

const CrossIcon = memo(
  ({
    size = "6",
    stroke = "currentColor",
  }: {
    size?: string;
    stroke?: string;
  }) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke={`${stroke ? stroke : "hsl(var(--blue-cta))"} `}
        className={`size-${size}`}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 18 18 6M6 6l12 12"
        />
      </svg>
    );
  }
);

export default CrossIcon;
