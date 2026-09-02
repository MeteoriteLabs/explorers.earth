import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { category } = vi.hoisted(() => ({ category: vi.fn() }));

vi.mock("../publicProfileGatewayClient", () => ({
  publicProfileGatewayClient: { category },
}));

import { usePublicRecommendationCategory } from "../usePublicRecommendationCategory";

describe("usePublicRecommendationCategory", () => {
  beforeEach(() => category.mockReset());

  it("uses the server gateway only for an enabled public category", async () => {
    category.mockResolvedValueOnce({ appLists: [] });
    const { result } = renderHook(() => usePublicRecommendationCategory("tk2727", "apps", true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(category).toHaveBeenCalledWith("tk2727", "apps", expect.any(AbortSignal));
    expect(result.current.data).toEqual({ appLists: [] });
  });

  it("does not request disabled categories", async () => {
    renderHook(() => usePublicRecommendationCategory("tk2727", "apps", false));
    await Promise.resolve();
    expect(category).not.toHaveBeenCalled();
  });
});
