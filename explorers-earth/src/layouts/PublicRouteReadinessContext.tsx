import { createContext, useContext, useRef } from "react";
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
  markError: (
    generation: string,
    source: PublicRouteErrorSource,
    retry: () => Promise<unknown>,
    hasUsableContent: boolean,
  ) => void;
}

export const PublicRouteReadinessContext = createContext<PublicRouteReadinessContextValue | null>(null);

export function usePublicRouteReadiness(): PublicRouteReadinessContextValue {
  const context = useContext(PublicRouteReadinessContext);
  if (!context) {
    throw new Error("usePublicRouteReadiness must be used within a PublicRouteReadinessContext.Provider");
  }
  return context;
}

export function usePublicLeafRequestGeneration(requestKey: string): string | undefined {
  const context = useContext(PublicRouteReadinessContext);
  const request = useRef<{ key: string; generation: string | undefined } | undefined>(undefined);
  if (
    !request.current ||
    request.current.key !== requestKey ||
    request.current.generation !== context?.generation
  ) {
    request.current = { key: requestKey, generation: context?.generation };
  }
  return request.current.generation;
}
