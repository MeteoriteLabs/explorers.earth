import { useCallback, useEffect, useRef, useState } from "react";
import {
  publicProfileGatewayClient,
  type PublicCategory,
} from "./publicProfileGatewayClient";

export type PublicCategoryGatewayState = {
  data: Record<string, unknown[]> | undefined;
  loading: boolean;
  error: unknown | null;
  refetch: () => Promise<void>;
};

export function usePublicRecommendationCategory(
  username: string | undefined,
  category: PublicCategory,
  enabled: boolean,
): PublicCategoryGatewayState {
  const [attempt, setAttempt] = useState(0);
  const bypassCacheRef = useRef(false);
  const [state, setState] = useState<Omit<PublicCategoryGatewayState, "refetch">>({
    data: undefined,
    loading: enabled && Boolean(username),
    error: null,
  });
  const retryResolvers = useRef<Array<() => void>>([]);
  const settleRetries = useCallback(() => {
    retryResolvers.current.splice(0).forEach((resolve) => resolve());
  }, []);
  const refetch = useCallback(async () => {
    if (!enabled || !username) return;
    bypassCacheRef.current = true;
    const settled = new Promise<void>((resolve) => retryResolvers.current.push(resolve));
    setAttempt((value) => value + 1);
    await settled;
  }, [enabled, username]);

  useEffect(() => {
    const controller = new AbortController();
    if (!enabled || !username) {
      setState({ data: undefined, loading: false, error: null });
      return () => controller.abort();
    }
    setState((previous) => ({ data: previous.data, loading: previous.data === undefined, error: null }));
    const bypassCache = bypassCacheRef.current;
    bypassCacheRef.current = false;
    publicProfileGatewayClient.category(username, category, controller.signal, bypassCache)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data: data as Record<string, unknown[]>, loading: false, error: null });
          settleRetries();
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState((previous) => ({ data: previous.data, loading: false, error }));
          settleRetries();
        }
      });
    return () => controller.abort();
  }, [attempt, category, enabled, settleRetries, username]);

  return { ...state, refetch };
}
