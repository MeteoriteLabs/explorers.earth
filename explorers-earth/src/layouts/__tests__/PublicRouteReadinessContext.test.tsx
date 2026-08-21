import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePublicRouteReadiness } from "../PublicRouteReadinessContext";

describe("usePublicRouteReadiness", () => {
  it("throws when used outside a PublicRouteReadinessContext provider", () => {
    expect(() => renderHook(() => usePublicRouteReadiness())).toThrow(
      "usePublicRouteReadiness must be used within a PublicRouteReadinessContext.Provider"
    );
  });
});
