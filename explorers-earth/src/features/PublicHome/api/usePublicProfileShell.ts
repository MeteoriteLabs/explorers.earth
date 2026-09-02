import { useCallback, useEffect, useState } from "react";
import { publicProfileGatewayClient } from "./publicProfileGatewayClient";

export type PublicProfileShellState = {
  data: Record<string, unknown> | undefined;
  loading: boolean;
  error: unknown | null;
  refetch: () => Promise<void>;
};

export function usePublicProfileShell(username: string | undefined): PublicProfileShellState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Omit<PublicProfileShellState, "refetch">>({ data: undefined, loading: Boolean(username), error: null });
  const refetch = useCallback(async () => { setAttempt((value) => value + 1); }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (!username) {
      setState({ data: undefined, loading: false, error: null });
      return () => controller.abort();
    }
    setState((previous) => ({ data: previous.data, loading: previous.data === undefined, error: null }));
    publicProfileGatewayClient.shell(username, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState({ data: data as Record<string, unknown>, loading: false, error: null }); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setState((previous) => ({ data: previous.data, loading: false, error })); });
    return () => controller.abort();
  }, [attempt, username]);
  return { ...state, refetch };
}
