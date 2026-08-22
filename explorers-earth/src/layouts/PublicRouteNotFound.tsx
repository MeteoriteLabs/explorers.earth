import { useContext, useEffect } from "react";

import { PublicRouteReadinessContext } from "./PublicRouteReadinessContext";

export function PublicRouteNotFound() {
  const context = useContext(PublicRouteReadinessContext);
  const generation = context?.generation ?? "";
  const markNotFound = context?.markNotFound;

  useEffect(() => {
    markNotFound?.(generation);
  }, [generation, markNotFound]);

  return null;
}
