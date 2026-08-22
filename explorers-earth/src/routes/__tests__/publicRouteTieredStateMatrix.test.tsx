import { describe, expect, it, vi } from "vitest";

import {
  createGenerationBoundRouteActions,
  createInitialPublicRouteState,
  publicRouteReadinessReducer,
} from "../../layouts/publicRouteReadiness";
import { publicRouteContract } from "../publicRouteContract";
import { publicRouteLeafComponents } from "../publicRouteLeaves";
import { assertPublicRouteLeafAssembly } from "../publicRouteLeafIdentity";
import { resolvePublicChildState } from "../resolvePublicChildState";

describe("public route state machine", () => {
  it("covers loading, content, empty, background refresh, Retry and stale suppression once", async () => {
    const generation = "state-machine:current";
    const initial = createInitialPublicRouteState(generation);
    const loading = publicRouteReadinessReducer(initial, { type: "begin-route", generation });
    expect(loading.status).toBe("initial-loading");
    expect(publicRouteReadinessReducer(loading, { type: "ready", generation }).status).toBe("ready");
    expect(publicRouteReadinessReducer(loading, { type: "empty", generation }).status).toBe("empty");
    const refreshing = publicRouteReadinessReducer(
      { generation, status: "ready" },
      { type: "refreshing", generation },
    );
    expect(refreshing).toEqual({ generation, status: "refreshing", hasUsableContent: true });
    expect(publicRouteReadinessReducer(refreshing, {
      type: "ready",
      generation: "state-machine:stale",
    })).toBe(refreshing);

    const dispatch = vi.fn();
    const actions = createGenerationBoundRouteActions({ generation, isCurrent: () => true, dispatch });
    await actions.retry(async () => undefined);
    expect(dispatch.mock.calls.map(([event]) => event.type)).toEqual(["retry-started", "retry-finished"]);
  });
});

describe.each(publicRouteContract)("$id actual route assembly and settled resource semantics", (route) => {
  it("uses its independently identified real route leaf", () => {
    const Leaf = publicRouteLeafComponents[route.id];
    const element = <Leaf />;
    expect(assertPublicRouteLeafAssembly(route.marker, element)).toBe(element);
  });

  it("derives hidden/missing behavior from the application route manifest", () => {
    if (route.visibility === "guarded") {
      expect("visibilityField" in route && route.visibilityField).toBeTruthy();
    } else {
      expect(route.visibility).toBe("always-visible");
    }

    expect(resolvePublicChildState({
      loading: true,
      error: undefined,
      bootstrapReady: true,
      resourceKind: route.resourceKind,
      entityExists: false,
      empty: true,
    })).toBe("loading");
    expect(resolvePublicChildState({
      loading: false,
      error: new Error("fixture"),
      bootstrapReady: true,
      resourceKind: route.resourceKind,
      entityExists: false,
      empty: true,
    })).toBe("error");
    expect(resolvePublicChildState({
      loading: false,
      error: undefined,
      bootstrapReady: true,
      resourceKind: route.resourceKind,
      entityExists: false,
      empty: route.resourceKind === "collection",
    })).toBe(route.resourceKind === "child" ? "redirect" : "empty");
  });
});
