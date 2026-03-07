import React, { memo } from "react";
import { EarthLoader } from "./EarthLoader";
import type { LoaderContext } from "./EarthLoader";

interface LoaderProps {
  isLoading: boolean;
  children: React.ReactNode;
  /** Context determines which supporting texts to show */
  context?: LoaderContext;
}

const Loader: React.FC<LoaderProps> = memo(
  ({ isLoading, children, context = "general" }) => {
    return isLoading ? (
      <div className="bg-dashboard-bg">
        <EarthLoader context={context} />
      </div>
    ) : (
      <>{children}</>
    );
  }
);

export default Loader;
