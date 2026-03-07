import { memo } from "react";

export const AddIcon = memo(({ size }: { size?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="hsl(var(--blue-cta))"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="white"
      className={`size-${size ? size : "7"} rounded-full`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
});
