import { describe, expect, it, vi } from "vitest";

import {
  createGenerationBoundRouteActions,
  createInitialPublicRouteState,
  publicRouteReadinessReducer,
  type PublicRouteReadinessState,
} from "../../layouts/publicRouteReadiness";
import { publicRouteContract } from "../publicRouteContract";
import { resolvePublicChildState } from "../resolvePublicChildState";

const childRouteIds = new Set([
  "places-detail",
  "places-map-detail",
  "guides-detail",
  "movies-genre",
  "movies-list",
  "books-subject",
  "books-list",
  "games-genre",
  "games-list",
  "apps-list",
  "products-list",
  "people-sector",
  "people-list",
]);

describe.each(publicRouteContract)("$id tiered state contract", (route) => {
  const generation = `direct:${route.id}`;
  const reduce = (state: PublicRouteReadinessState, event: Parameters<typeof publicRouteReadinessReducer>[1]) =>
    publicRouteReadinessReducer(state, event);

  it("covers direct initialization, content, empty, loading, refresh, failure, Retry and stale suppression", async () => {
    const direct = createInitialPublicRouteState(generation);
    expect(direct).toEqual({ generation, status: "validating-bootstrap" });
    const loading = reduce(direct, { type: "begin-route", generation });
    expect(loading).toEqual({ generation, status: "initial-loading" });
    expect(reduce(loading, { type: "ready", generation })).toEqual({ generation, status: "ready" });
    expect(reduce(loading, { type: "empty", generation })).toEqual({ generation, status: "empty" });
    const refreshing = reduce({ generation, status: "ready" }, { type: "refreshing", generation });
    expect(refreshing).toEqual({ generation, status: "refreshing", hasUsableContent: true });
    const failed = reduce(loading, {
      type: "failed",
      generation,
      source: "route",
      hasUsableContent: false,
    });
    expect(failed).toEqual({
      generation,
      status: "error",
      source: "route",
      hasUsableContent: false,
      retrying: false,
    });

    const dispatch = vi.fn();
    const actions = createGenerationBoundRouteActions({
      generation,
      isCurrent: () => true,
      dispatch,
    });
    await actions.retry(async () => undefined);
    expect(dispatch.mock.calls.map(([event]) => event.type)).toEqual([
      "retry-started",
      "retry-finished",
    ]);

    expect(reduce(refreshing, { type: "ready", generation: `${generation}:stale` })).toBe(refreshing);
  });

  it("applies hidden and missing semantics only after a settled successful lookup", () => {
    if (route.visibility === "guarded") {
      expect("visibilityField" in route && route.visibilityField).toBeTruthy();
    } else {
      expect(route.visibility).toBe("always-visible");
    }

    const isChild = childRouteIds.has(route.id);
    expect(resolvePublicChildState({
      loading: false,
      error: undefined,
      bootstrapReady: true,
      resourceKind: isChild ? "child" : "collection",
      entityExists: false,
      empty: !isChild,
    })).toBe(isChild ? "redirect" : "empty");
    expect(resolvePublicChildState({
      loading: true,
      error: undefined,
      bootstrapReady: true,
      resourceKind: isChild ? "child" : "collection",
      entityExists: false,
      empty: true,
    })).toBe("loading");
    expect(resolvePublicChildState({
      loading: false,
      error: new Error("fixture"),
      bootstrapReady: true,
      resourceKind: isChild ? "child" : "collection",
      entityExists: false,
      empty: true,
    })).toBe("error");
  });
});
