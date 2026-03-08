import { memo } from "react";

type KebabIconProps = {
  size: string;
  variant?: "solid" | "bold" | "normal"; // Optional prop
};

const KebabIcon = memo(({ size, variant }: KebabIconProps) => {
  const baseClasses = `size-${size}`;
  let variantClasses = "";

  if (variant === "solid") {
    variantClasses = "bg-red text-white rounded-full p-1"; // Solid black
  } else if (variant === "bold") {
    variantClasses = "bg-gray-800 text-white rounded-full p-2"; // Slightly lighter
  } else if (variant === "normal") {
    variantClasses = "bg-gray-300 text-black rounded-full p-2"; // Light gray
  }

  return (
    <div className={`inline-flex ${variant ? variantClasses : ""}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        className={baseClasses}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
        />
      </svg>
    </div>
  );
});

export default KebabIcon;
