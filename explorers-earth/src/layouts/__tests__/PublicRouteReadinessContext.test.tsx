import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePublicRouteReadiness } from "../PublicRouteReadinessContext";

describe("usePublicRouteReadiness", () => {
  const suppressExpectedWindowError = (event: ErrorEvent) => {
    if (event.message.includes("usePublicRouteReadiness must be used within")) {
      event.preventDefault();
    }
  };

  afterEach(() => {
    window.removeEventListener("error", suppressExpectedWindowError);
    vi.restoreAllMocks();
  });

  it("throws when used outside a PublicRouteReadinessContext provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    window.addEventListener("error", suppressExpectedWindowError);
    expect(() => renderHook(() => usePublicRouteReadiness())).toThrow(
      "usePublicRouteReadiness must be used within a PublicRouteReadinessContext.Provider"
    );
  });
});
