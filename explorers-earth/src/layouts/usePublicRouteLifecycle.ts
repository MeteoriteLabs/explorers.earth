import { useContext, useEffect } from "react";

import { PublicRouteReadinessContext } from "./PublicRouteReadinessContext";

const resolvedRetry = () => Promise.resolve();

interface PublicRouteLifecycleOptions {
  loading: boolean;
  error?: unknown;
  retry?: () => Promise<unknown>;
  hasUsableData?: boolean;
  empty?: boolean;
}

export function usePublicRouteLifecycle({
  loading,
  error,
  retry = resolvedRetry,
  hasUsableData = false,
  empty = false,
}: PublicRouteLifecycleOptions): void {
  const context = useContext(PublicRouteReadinessContext);
  const generation = context?.generation ?? "";
  const markLoading = context?.markLoading;
  const markReady = context?.markReady;
  const markRefreshing = context?.markRefreshing;
  const markEmpty = context?.markEmpty;
  const markError = context?.markError;
  const hasContext = context !== null;

  useEffect(() => {
    if (!hasContext) return;

    if (error) {
      markError?.(generation, "route", retry, hasUsableData);
      return;
    }

    if (loading) {
      if (hasUsableData) markRefreshing?.(generation);
      else markLoading?.(generation);
      return;
    }

    if (empty) {
      markEmpty?.(generation);
      return;
    }

    markReady?.(generation);
  }, [empty, error, generation, hasContext, hasUsableData, loading, markEmpty, markError, markLoading, markReady, markRefreshing, retry]);
}
