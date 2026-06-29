import { FC, ReactNode } from "react";

interface PlaceCardGridProps {
  children: ReactNode;
  className?: string;
}

/**
 * Consistent grid layout for place cards across the application.
 * Uses a 2-column layout on mobile and 3-column on desktop.
 */
const PlaceCardGrid: FC<PlaceCardGridProps> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 ${className}`}
    >
      {children}
    </div>
  );
};

export default PlaceCardGrid;
