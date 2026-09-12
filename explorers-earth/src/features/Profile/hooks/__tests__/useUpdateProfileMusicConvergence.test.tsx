import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdateProfile } from "../useUpdateProfile";

const harness = vi.hoisted(() => ({
  mutationIndex: 0,
  updateProfile: vi.fn(),
  createAccount: vi.fn(),
  updateUser: vi.fn(),
  updateUsername: vi.fn(),
  refreshIdentity: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@apollo/client", () => ({
  gql: () => ({}),
  useMutation: () => [[harness.updateProfile, harness.createAccount, harness.updateUser][harness.mutationIndex++]],
}));

vi.mock("sonner", () => ({ toast: { success: harness.success, error: harness.error } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../../../music/musicApi", () => ({ musicApi: { refreshIdentity: harness.refreshIdentity } }));

vi.mock("../../../../store/store", () => ({
  default: Object.assign(
    () => ({ user: { id: "user-number", documentId: "user-document", username: "alpha", email: "redacted@example.invalid", blocked: false } }),
    { getState: () => ({ updateUsername: harness.updateUsername, token: "strapi-proof" }) },
  ),
}));

const values = {
  username: "alpha",
  accountName: "Renamed account",
  accountType: "personal",
  visibility: {},
} as never;

describe("profile Music snapshot convergence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.mutationIndex = 0;
    harness.updateProfile.mockResolvedValue({ data: { updateAccount: { documentId: "account-document" } } });
    harness.createAccount.mockResolvedValue({ data: undefined });
    harness.updateUser.mockResolvedValue({ data: {} });
    harness.refreshIdentity.mockResolvedValue(undefined);
  });

  it("refreshes through the bodyless identity resource once after immutable Account success", async () => {
    const refetch = vi.fn();
    const { result } = renderHook(() => useUpdateProfile("account-document", refetch));
    await act(async () => result.current.handleSubmit(values));
    expect(harness.updateProfile).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({ documentId: "account-document" }),
    }));
    expect(harness.refreshIdentity).toHaveBeenCalledTimes(1);
    expect(harness.refreshIdentity).toHaveBeenCalledWith();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the Explorer save successful and silent when background Music refresh fails", async () => {
    harness.refreshIdentity.mockRejectedValue(new Error("contained"));
    const refetch = vi.fn();
    const { result } = renderHook(() => useUpdateProfile("account-document", refetch));
    await act(async () => result.current.handleSubmit(values));
    await Promise.resolve();
    expect(harness.success).not.toHaveBeenCalled();
    expect(harness.error).not.toHaveBeenCalled();
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
