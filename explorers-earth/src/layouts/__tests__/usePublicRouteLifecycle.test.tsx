import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  PublicRouteReadinessContext,
  type PublicRouteReadinessContextValue,
} from "../PublicRouteReadinessContext";
import { usePublicRouteLifecycle } from "../usePublicRouteLifecycle";

const makeContext = (): PublicRouteReadinessContextValue => ({
  generation: "alice:key-a",
  readiness: { generation: "alice:key-a", status: "initial-loading" },
  markLoading: vi.fn(),
  markReady: vi.fn(),
  markRefreshing: vi.fn(),
  markEmpty: vi.fn(),
  markNotFound: vi.fn(),
  markError: vi.fn(),
});

const wrapperFor = (value: PublicRouteReadinessContextValue) =>
  function ReadinessWrapper({ children }: { children: ReactNode }) {
    return (
      <PublicRouteReadinessContext.Provider value={value}>
        {children}
      </PublicRouteReadinessContext.Provider>
    );
  };

describe("usePublicRouteLifecycle", () => {
  it("reports initial loading when no usable route data exists", () => {
    const context = makeContext();
    renderHook(() => usePublicRouteLifecycle({ loading: true }), {
      wrapper: wrapperFor(context),
    });

    expect(context.markLoading).toHaveBeenCalledWith("alice:key-a");
    expect(context.markRefreshing).not.toHaveBeenCalled();
  });

  it("retains usable content while a query revalidates", () => {
    const context = makeContext();
    renderHook(
      () => usePublicRouteLifecycle({ loading: true, hasUsableData: true }),
      { wrapper: wrapperFor(context) },
    );

    expect(context.markRefreshing).toHaveBeenCalledWith("alice:key-a");
    expect(context.markLoading).not.toHaveBeenCalled();
  });

  it("reports ready and deliberate empty results separately", () => {
    const readyContext = makeContext();
    renderHook(() => usePublicRouteLifecycle({ loading: false }), {
      wrapper: wrapperFor(readyContext),
    });
    expect(readyContext.markReady).toHaveBeenCalledWith("alice:key-a");

    const emptyContext = makeContext();
    renderHook(
      () => usePublicRouteLifecycle({ loading: false, empty: true }),
      { wrapper: wrapperFor(emptyContext) },
    );
    expect(emptyContext.markEmpty).toHaveBeenCalledWith("alice:key-a");
  });

  it("reports an unusable query failure with its retry operation", () => {
    const context = makeContext();
    const retry = vi.fn().mockResolvedValue(undefined);
    const error = new Error("offline");

    renderHook(
      () => usePublicRouteLifecycle({ loading: false, error, retry }),
      { wrapper: wrapperFor(context) },
    );

    expect(context.markError).toHaveBeenCalledWith(
      "alice:key-a",
      "route",
      retry,
    );
    expect(context.markReady).not.toHaveBeenCalled();
  });
});
