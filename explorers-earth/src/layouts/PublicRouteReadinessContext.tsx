import { createContext, useContext } from "react";

export type PublicRouteReadiness =
  | { status: "validating-username" }
  | { status: "loading-route" }
  | { status: "ready" }
  | { status: "not-found" }
  | { status: "route-error"; source: "username" | "profile"; retrying: boolean; retry: () => Promise<void> };

export interface PublicRouteReadinessContextValue {
  generation: string;
  readiness: PublicRouteReadiness;
  markLoading: (generation: string) => void;
  markReady: (generation: string) => void;
  markNotFound: (generation: string) => void;
  markError: (generation: string, source: "username" | "profile", retry: () => Promise<unknown>) => void;
  setIsPageLoaded: (loaded: boolean) => void;
}

export const PublicRouteReadinessContext = createContext<PublicRouteReadinessContextValue | null>(null);

export function usePublicRouteReadiness(): PublicRouteReadinessContextValue {
  const context = useContext(PublicRouteReadinessContext);
  if (!context) {
    throw new Error("usePublicRouteReadiness must be used within a PublicRouteReadinessContext.Provider");
  }
  return context;
}
