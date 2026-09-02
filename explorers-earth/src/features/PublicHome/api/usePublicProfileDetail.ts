import { useCallback, useEffect, useState } from "react";
import { publicProfileGatewayClient, type PublicCategory } from "./publicProfileGatewayClient";

export function usePublicProfileDetail(username: string | undefined, category: PublicCategory, slug: string | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ data: Record<string, unknown[]> | undefined; loading: boolean; error: unknown | null }>({ data: undefined, loading: Boolean(username && slug), error: null });
  const refetch = useCallback(async () => { setAttempt((value) => value + 1); }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (!username || !slug) {
      setState({ data: undefined, loading: false, error: null });
      return () => controller.abort();
    }
    setState((previous) => ({ data: previous.data, loading: previous.data === undefined, error: null }));
    publicProfileGatewayClient.detail(username, category, slug, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState({ data: data as Record<string, unknown[]>, loading: false, error: null }); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState((previous) => ({ data: previous.data, loading: false, error })); });
    return () => controller.abort();
  }, [attempt, category, slug, username]);
  return { ...state, refetch };
}
