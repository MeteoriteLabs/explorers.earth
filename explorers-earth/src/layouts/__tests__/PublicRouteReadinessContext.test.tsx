import { render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PublicRouteReadinessContext,
  usePublicLeafRequestGeneration,
  usePublicRouteReadiness,
  type PublicRouteReadinessContextValue,
} from "../PublicRouteReadinessContext";

const originalConsoleError = console.error;
const expectedProviderError = "usePublicRouteReadiness must be used within";

function suppressExpectedProviderConsoleError(
  original: (...args: unknown[]) => void,
) {
  return (...args: unknown[]) => {
    const message = args.map((value) => value instanceof Error ? value.message : String(value)).join(" ");
    if (message.includes(expectedProviderError)) return;
    original(...args);
  };
}

describe("usePublicRouteReadiness", () => {
  const suppressExpectedWindowError = (event: ErrorEvent) => {
    if (event.message.includes(expectedProviderError)) {
      event.preventDefault();
    }
  };

  afterEach(() => {
    window.removeEventListener("error", suppressExpectedWindowError);
    vi.restoreAllMocks();
  });

  it("throws when used outside a PublicRouteReadinessContext provider", () => {
    vi.spyOn(console, "error").mockImplementation(
      suppressExpectedProviderConsoleError(originalConsoleError),
    );
    window.addEventListener("error", suppressExpectedWindowError);

    expect(() => renderHook(() => usePublicRouteReadiness())).toThrow(
      "usePublicRouteReadiness must be used within a PublicRouteReadinessContext.Provider"
    );
  });

  it("forwards unexpected console errors and suppresses only the expected provider exception", () => {
    const forward = vi.fn();
    const interceptedConsoleError = suppressExpectedProviderConsoleError(forward);

    interceptedConsoleError("unexpected readiness diagnostic", { route: "apps" });
    expect(forward).toHaveBeenCalledTimes(1);
    expect(forward).toHaveBeenCalledWith("unexpected readiness diagnostic", { route: "apps" });

    interceptedConsoleError(new Error(
      "usePublicRouteReadiness must be used within a PublicRouteReadinessContext.Provider",
    ));
    expect(forward).toHaveBeenCalledTimes(1);
  });
});

function readinessValue(generation: string): PublicRouteReadinessContextValue {
  return {
    generation,
    readiness: { generation, status: "initial-loading" },
    markLoading: () => {}, markReady: () => {}, markRefreshing: () => {},
    markEmpty: () => {}, markNotFound: () => {}, markError: () => {},
  };
}

function LeafGenerationProbe({ requestKey }: { requestKey: string }) {
  const generation = usePublicLeafRequestGeneration(requestKey);
  return <output aria-label="leaf request generation">{generation}</output>;
}

function ReadinessProvider({ generation, children }: { generation: string; children: ReactNode }) {
  return (
    <PublicRouteReadinessContext.Provider value={readinessValue(generation)}>
      {children}
    </PublicRouteReadinessContext.Provider>
  );
}

describe("usePublicLeafRequestGeneration", () => {
  it("does not relabel a mounted query execution when the provider generation advances", () => {
    const view = render(
      <ReadinessProvider generation="alice:key-before-begin-route">
        <LeafGenerationProbe requestKey="account-1:same-list" />
      </ReadinessProvider>,
    );
    expect(screen.getByLabelText("leaf request generation")).toHaveTextContent("alice:key-before-begin-route");

    view.rerender(
      <ReadinessProvider generation="alice:key-after-begin-route">
        <LeafGenerationProbe requestKey="account-1:same-list" />
      </ReadinessProvider>,
    );

    expect(screen.getByLabelText("leaf request generation")).toHaveTextContent("alice:key-before-begin-route");
  });

  it("captures the advanced generation when the same resource starts a new query execution", () => {
    const view = render(
      <ReadinessProvider generation="alice:location-key-a">
        <LeafGenerationProbe key="execution-a" requestKey="account-1:same-list" />
      </ReadinessProvider>,
    );
    view.rerender(
      <ReadinessProvider generation="alice:location-key-b">
        <LeafGenerationProbe key="execution-b" requestKey="account-1:same-list" />
      </ReadinessProvider>,
    );

    expect(screen.getByLabelText("leaf request generation")).toHaveTextContent("alice:location-key-b");
  });
});
