export type PublicRouteErrorSource = "username" | "profile" | "visibility" | "route";

export type PublicRouteReadinessState =
  | { generation: string; status: "validating-bootstrap" }
  | { generation: string; status: "initial-loading" }
  | { generation: string; status: "ready" }
  | { generation: string; status: "empty" }
  | { generation: string; status: "refreshing"; hasUsableContent: true }
  | { generation: string; status: "not-found" }
  | {
      generation: string;
      status: "error";
      source: PublicRouteErrorSource;
      retrying: boolean;
    };

export type PublicRouteReadinessEvent =
  | { type: "begin-bootstrap"; generation: string }
  | { type: "begin-route"; generation: string }
  | { type: "ready"; generation: string }
  | { type: "empty"; generation: string }
  | { type: "refreshing"; generation: string }
  | { type: "not-found"; generation: string }
  | { type: "failed"; generation: string; source: PublicRouteErrorSource }
  | { type: "retry-started"; generation: string }
  | { type: "retry-finished"; generation: string };

export function createInitialPublicRouteState(
  generation: string,
): PublicRouteReadinessState {
  return { generation, status: "validating-bootstrap" };
}

export function publicRouteReadinessReducer(
  state: PublicRouteReadinessState,
  event: PublicRouteReadinessEvent,
): PublicRouteReadinessState {
  if (event.type === "begin-bootstrap") {
    return createInitialPublicRouteState(event.generation);
  }

  if (event.generation !== state.generation) {
    return state;
  }

  switch (event.type) {
    case "begin-route":
      return state.status === "ready" || state.status === "refreshing"
        ? state
        : { generation: event.generation, status: "initial-loading" };
    case "ready":
      return { generation: event.generation, status: "ready" };
    case "empty":
      return { generation: event.generation, status: "empty" };
    case "refreshing":
      return { generation: event.generation, status: "refreshing", hasUsableContent: true };
    case "not-found":
      return { generation: event.generation, status: "not-found" };
    case "failed":
      return {
        generation: event.generation,
        status: "error",
        source: event.source,
        retrying: false,
      };
    case "retry-started":
      return state.status === "error" ? { ...state, retrying: true } : state;
    case "retry-finished":
      return state.status === "error" ? { ...state, retrying: false } : state;
  }
}

interface GenerationBoundRouteActionsOptions {
  generation: string;
  isCurrent: () => boolean;
  dispatch: (event: PublicRouteReadinessEvent) => void;
}

export function createGenerationBoundRouteActions({
  generation,
  isCurrent,
  dispatch,
}: GenerationBoundRouteActionsOptions) {
  let retryInFlight = false;

  const emit = (event: PublicRouteReadinessEvent) => {
    if (isCurrent()) dispatch(event);
  };

  return {
    initialLoading: () => emit({ type: "begin-route", generation }),
    ready: () => emit({ type: "ready", generation }),
    empty: () => emit({ type: "empty", generation }),
    refreshing: () => emit({ type: "refreshing", generation }),
    notFound: () => emit({ type: "not-found", generation }),
    fail: (source: PublicRouteErrorSource) =>
      emit({ type: "failed", generation, source }),
    retry: async (operation: () => Promise<unknown>) => {
      if (retryInFlight || !isCurrent()) return;

      retryInFlight = true;
      emit({ type: "retry-started", generation });
      try {
        await operation();
      } finally {
        retryInFlight = false;
        emit({ type: "retry-finished", generation });
      }
    },
  };
}
