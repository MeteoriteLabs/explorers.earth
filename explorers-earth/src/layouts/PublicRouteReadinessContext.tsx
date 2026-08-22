import { createContext, useContext } from "react";
import type {
  PublicRouteErrorSource,
  PublicRouteReadinessState,
} from "./publicRouteReadiness";

export type PublicRouteReadiness = PublicRouteReadinessState;

export interface PublicRouteReadinessContextValue {
  generation: string;
  readiness: PublicRouteReadiness;
  markLoading: (generation: string) => void;
  markReady: (generation: string) => void;
  markRefreshing: (generation: string) => void;
  markEmpty: (generation: string) => void;
  markNotFound: (generation: string) => void;
  markError: (generation: string, source: PublicRouteErrorSource, retry: () => Promise<unknown>) => void;
}

export const PublicRouteReadinessContext = createContext<PublicRouteReadinessContextValue | null>(null);

export function usePublicRouteReadiness(): PublicRouteReadinessContextValue {
  const context = useContext(PublicRouteReadinessContext);
  if (!context) {
    throw new Error("usePublicRouteReadiness must be used within a PublicRouteReadinessContext.Provider");
  }
  return context;
}
