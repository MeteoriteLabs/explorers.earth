import { describe, expect, it, vi } from "vitest";

import {
  createGenerationBoundRouteActions,
  createInitialPublicRouteState,
  publicRouteReadinessReducer,
  type PublicRouteReadinessEvent,
} from "../publicRouteReadiness";

describe("publicRouteReadinessReducer", () => {
  it("starts a new leaf generation without restarting bootstrap", () => {
    const readyRoute = publicRouteReadinessReducer(
      createInitialPublicRouteState("alice:key-a"),
      { type: "ready", generation: "alice:key-a" },
    );

    expect(
      publicRouteReadinessReducer(readyRoute, {
        type: "begin-route",
        generation: "alice:key-b",
      }),
    ).toEqual({ generation: "alice:key-b", status: "initial-loading" });
  });

  it("ignores completion from the route that was replaced", () => {
    const routeA = createInitialPublicRouteState("alice:key-a");
    const routeB = publicRouteReadinessReducer(routeA, {
      type: "begin-bootstrap",
      generation: "bob:key-b",
    });

    expect(
      publicRouteReadinessReducer(routeB, {
        type: "ready",
        generation: "alice:key-a",
      }),
    ).toEqual(routeB);
  });

  it("distinguishes a deliberate empty result from loading", () => {
    const loading = publicRouteReadinessReducer(
      createInitialPublicRouteState("alice:key-a"),
      { type: "begin-route", generation: "alice:key-a" },
    );

    expect(
      publicRouteReadinessReducer(loading, {
        type: "empty",
        generation: "alice:key-a",
      }),
    ).toEqual({ generation: "alice:key-a", status: "empty" });
  });

  it("keeps usable content available while a route refreshes", () => {
    const ready = publicRouteReadinessReducer(
      createInitialPublicRouteState("alice:key-a"),
      { type: "ready", generation: "alice:key-a" },
    );

    expect(
      publicRouteReadinessReducer(ready, {
        type: "refreshing",
        generation: "alice:key-a",
      }),
    ).toEqual({
      generation: "alice:key-a",
      status: "refreshing",
      hasUsableContent: true,
    });
  });

  it("retains usable content when a background refresh fails", () => {
    const refreshing = publicRouteReadinessReducer(
      { generation: "alice:key-a", status: "ready" },
      { type: "refreshing", generation: "alice:key-a" },
    );

    expect(
      publicRouteReadinessReducer(refreshing, {
        type: "failed",
        generation: "alice:key-a",
        source: "route",
        hasUsableContent: true,
      }),
    ).toEqual({
      generation: "alice:key-a",
      status: "error",
      source: "route",
      hasUsableContent: true,
      retrying: false,
    });
  });

  it("records that an initial route failure has no usable content", () => {
    expect(
      publicRouteReadinessReducer(
        { generation: "alice:key-a", status: "initial-loading" },
        {
          type: "failed",
          generation: "alice:key-a",
          source: "route",
          hasUsableContent: false,
        },
      ),
    ).toEqual({
      generation: "alice:key-a",
      status: "error",
      source: "route",
      hasUsableContent: false,
      retrying: false,
    });
  });

  it("does not replace ready content with initial loading in one generation", () => {
    const ready = publicRouteReadinessReducer(
      createInitialPublicRouteState("alice:key-a"),
      { type: "ready", generation: "alice:key-a" },
    );

    expect(
      publicRouteReadinessReducer(ready, {
        type: "begin-route",
        generation: "alice:key-a",
      }),
    ).toEqual(ready);
  });

  it("does not replace a route error when bootstrap completion arrives afterward", () => {
    const failed = publicRouteReadinessReducer(
      createInitialPublicRouteState("alice:key-a"),
      {
        type: "failed",
        generation: "alice:key-a",
        source: "profile",
        hasUsableContent: false,
      },
    );

    expect(
      publicRouteReadinessReducer(failed, {
        type: "begin-route",
        generation: "alice:key-a",
      }),
    ).toBe(failed);
  });

  it("keeps repeated initial-loading signals referentially stable", () => {
    const loading = publicRouteReadinessReducer(
      createInitialPublicRouteState("alice:key-a"),
      { type: "begin-route", generation: "alice:key-a" },
    );

    expect(
      publicRouteReadinessReducer(loading, {
        type: "begin-route",
        generation: "alice:key-a",
      }),
    ).toBe(loading);
  });

  it.each([
    [{ type: "ready", generation: "alice:key-a" } as const],
    [{ type: "empty", generation: "alice:key-a" } as const],
    [{ type: "refreshing", generation: "alice:key-a" } as const],
    [{ type: "not-found", generation: "alice:key-a" } as const],
    [{ type: "failed", generation: "alice:key-a", source: "profile", hasUsableContent: false } as const],
  ])("keeps a repeated %s signal referentially stable", (event) => {
    const current = publicRouteReadinessReducer(
      createInitialPublicRouteState("alice:key-a"),
      event,
    );

    expect(publicRouteReadinessReducer(current, event)).toBe(current);
  });
});

describe("createGenerationBoundRouteActions", () => {
  it("runs one retry at a time and leaves the error retryable after rejection", async () => {
    let rejectRetry: ((error: Error) => void) | undefined;
    const retryOperation = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectRetry = reject;
        }),
    );
    const events: PublicRouteReadinessEvent[] = [];
    const actions = createGenerationBoundRouteActions({
      generation: "alice:key-a",
      isCurrent: () => true,
      dispatch: (event) => events.push(event),
    });

    const first = actions.retry(retryOperation);
    const second = actions.retry(retryOperation);

    expect(retryOperation).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      { type: "retry-started", generation: "alice:key-a" },
    ]);

    rejectRetry?.(new Error("offline"));
    await expect(first).rejects.toThrow("offline");
    await expect(second).resolves.toBeUndefined();
    expect(events.at(-1)).toEqual({
      type: "retry-finished",
      generation: "alice:key-a",
    });
  });

  it("does not dispatch after its generation becomes stale", () => {
    const dispatch = vi.fn();
    const actions = createGenerationBoundRouteActions({
      generation: "alice:key-a",
      isCurrent: () => false,
      dispatch,
    });

    actions.ready();
    actions.empty();
    actions.refreshing();
    actions.fail("profile", false);

    expect(dispatch).not.toHaveBeenCalled();
  });
});
