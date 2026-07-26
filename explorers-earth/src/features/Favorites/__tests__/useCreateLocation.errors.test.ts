import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { toastError, axiosGet, createMutation, setSelectedCity } = vi.hoisted(
  () => ({
    toastError: vi.fn(),
    axiosGet: vi.fn().mockRejectedValue(new Error("boom")),
    createMutation: vi.fn(),
    setSelectedCity: vi.fn(),
  })
);

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: toastError, success: vi.fn() }),
}));

// The very first network call in the flow rejects.
vi.mock("axios", () => ({
  default: { get: axiosGet, post: vi.fn() },
}));

// Preserve gql (mutation/query modules call it at import time); stub the hooks.
vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useMutation: () => [createMutation, { loading: false }],
    useQuery: () => ({ data: undefined, loading: false }),
  };
});

vi.mock("../../../store/store", () => ({
  default: () => ({ user: { documentId: "u1", username: "qa" }, token: "t" }),
}));

vi.mock("../../../store/useCityStore", () => ({
  useCityStore: () => ({ setSelectedCity }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

import { useCreateLocation } from "../hooks/useCreateLocation";

describe("useCreateLocation error handling (BUG-5)", () => {
  beforeEach(() => {
    toastError.mockClear();
    axiosGet.mockClear();
    createMutation.mockClear();
  });

  it("surfaces a create error, resets loading, and returns false", async () => {
    const setIsLoading = vi.fn();
    const refetchCities = vi.fn();

    const { result } = renderHook(() =>
      useCreateLocation({
        setIsLocationModalOpen: vi.fn(),
        refetchCities,
        setIsLoading,
        cities: { recommendationLists: [] },
        onCreated: vi.fn(),
      })
    );

    const ok = await result.current.handleLocationSubmit({
      placeId: "x",
      listName: "Y",
    } as never);

    expect(ok).toBe(false);
    expect(toastError).toHaveBeenCalledTimes(1);
    // Loading turned on then off (finally).
    expect(setIsLoading).toHaveBeenCalledWith(true);
    expect(setIsLoading).toHaveBeenLastCalledWith(false);
    // The mutation must not run when the pre-flight fetch fails.
    expect(createMutation).not.toHaveBeenCalled();
  });
});
