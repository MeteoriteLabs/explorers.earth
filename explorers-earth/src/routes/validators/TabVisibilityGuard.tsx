import { memo, type ReactNode } from "react";

import { usePublicProfileBootstrap } from "../../layouts/PublicProfileBootstrapContext";
import { PublicProfileFallbackRedirect } from "../PublicProfileFallbackRedirect";
import type { PublicRouteVisibilityField } from "../publicRouteContract";

interface TabVisibilityGuardProps {
  tabField: PublicRouteVisibilityField;
  defaultVisible?: boolean;
  children: ReactNode;
}

const TabVisibilityGuard = memo(
  ({ tabField, defaultVisible = false, children }: TabVisibilityGuardProps) => {
    const bootstrap = usePublicProfileBootstrap();

    if (bootstrap.status !== "ready") return null;

    const fieldValue =
      tabField === "public_profile" ? "Yes" : bootstrap.account[tabField];
    const isTabEnabled =
      fieldValue === "Yes"
        ? true
        : fieldValue === "No"
          ? false
          : defaultVisible;

    if (!isTabEnabled) return <PublicProfileFallbackRedirect />;

    return <>{children}</>;
  },
);

TabVisibilityGuard.displayName = "TabVisibilityGuard";

export default TabVisibilityGuard;
