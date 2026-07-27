import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// A newly-created Places list returned by the create mutation.
const CREATED = {
  documentId: "new_1",
  List_Name: "My Cafe List",
  slug: "my-cafe-list",
  Visibility: false,
  recommended_places: [],
};

const { axiosGet, createMutation, setSelectedCity } = vi.hoisted(() => ({
  axiosGet: vi.fn(),
  createMutation: vi.fn(),
  setSelectedCity: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock("axios", () => ({
  default: { get: axiosGet, post: vi.fn() },
}));

// Preserve gql (mutation/query modules call it at import time); stub the hooks.
vi.mock("@apollo/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@apollo/client")>();
  return {
    ...actual,
    useMutation: () => [createMutation, { loading: false }],
    useQuery: () => ({
      data: { usersPermissionsUser: { accounts: [{ documentId: "acc_1" }] } },
      loading: false,
    }),
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

describe("useCreateLocation — Places create focuses the new list (BUG-3 parity)", () => {
  beforeEach(() => {
    axiosGet.mockReset();
    createMutation.mockReset();
    setSelectedCity.mockReset();
  });

  it("selects the created list so Favorites can open into it, and calls onCreated with its id", async () => {
    // Place lookup succeeds with no photos → skip the S3 upload branch.
    axiosGet.mockResolvedValueOnce({
      data: { photos: [], location: { lat: 1, lng: 2 } },
    });
    createMutation.mockResolvedValueOnce({
      data: { createRecommendationList: CREATED },
    });
    const refetchCities = vi
      .fn()
      .mockResolvedValue({ data: { recommendationLists: [CREATED] } });
    const onCreated = vi.fn();

    const { result } = renderHook(() =>
      useCreateLocation({
        setIsLocationModalOpen: vi.fn(),
        refetchCities,
        setIsLoading: vi.fn(),
        cities: { recommendationLists: [] },
        onCreated,
      })
    );

    const ok = await result.current.handleLocationSubmit({
      placeId: "place_123",
      listName: "My Cafe List",
    } as never);

    expect(ok).toBe(true);
    // The new list must become the selected city — the precondition Favorites'
    // step-2 focus (setStep(2)) relies on to render the new list's detail view.
    expect(setSelectedCity).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: "new_1" })
    );
    // onCreated fires with the new id (Favorites uses this to switch to step 2).
    expect(onCreated).toHaveBeenCalledWith("new_1");
  });
});
