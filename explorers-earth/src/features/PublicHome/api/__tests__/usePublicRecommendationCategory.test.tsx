import { act, renderHook, waitFor } from "@testing-library/react";
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
    expect(category).toHaveBeenCalledWith("tk2727", "apps", expect.any(AbortSignal), false);
    expect(result.current.data).toEqual({ appLists: [] });
  });

  it("does not request disabled categories", async () => {
    renderHook(() => usePublicRecommendationCategory("tk2727", "apps", false));
    await Promise.resolve();
    expect(category).not.toHaveBeenCalled();
  });

  it("resolves refetch only after the replacement request settles", async () => {
    let completeRetry: ((value: { appLists: never[] }) => void) | undefined;
    category
      .mockResolvedValueOnce({ appLists: [] })
      .mockImplementationOnce(() => new Promise((resolve) => { completeRetry = resolve; }));
    const { result } = renderHook(() => usePublicRecommendationCategory("tk2727", "apps", true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let settled = false;
    let retry: Promise<void> = Promise.resolve();
    act(() => { retry = result.current.refetch().then(() => { settled = true; }); });
    await waitFor(() => expect(category).toHaveBeenCalledTimes(2));
    expect(settled).toBe(false);

    await act(async () => { completeRetry?.({ appLists: [] }); await retry; });
    expect(settled).toBe(true);
    expect(category).toHaveBeenLastCalledWith("tk2727", "apps", expect.any(AbortSignal), true);
  });
});
