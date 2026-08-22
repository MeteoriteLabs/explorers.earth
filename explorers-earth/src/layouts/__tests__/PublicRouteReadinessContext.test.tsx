import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePublicRouteReadiness } from "../PublicRouteReadinessContext";

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
