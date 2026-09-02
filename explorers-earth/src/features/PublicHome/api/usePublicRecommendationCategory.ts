import { useCallback, useEffect, useState } from "react";
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
  const [state, setState] = useState<Omit<PublicCategoryGatewayState, "refetch">>({
    data: undefined,
    loading: enabled && Boolean(username),
    error: null,
  });
  const refetch = useCallback(async () => {
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!enabled || !username) {
      setState({ data: undefined, loading: false, error: null });
      return () => controller.abort();
    }
    setState((previous) => ({ data: previous.data, loading: previous.data === undefined, error: null }));
    publicProfileGatewayClient.category(username, category, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data: data as Record<string, unknown[]>, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState((previous) => ({ data: previous.data, loading: false, error }));
      });
    return () => controller.abort();
  }, [attempt, category, enabled, username]);

  return { ...state, refetch };
}
