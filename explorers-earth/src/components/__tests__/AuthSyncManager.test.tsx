import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "@apollo/client";
import useAuthStore from "../../store/store";
import AuthSyncManager from "../AuthSyncManager";

const setAuthority = vi.hoisted(() => vi.fn());
const reconcile = vi.hoisted(() => vi.fn(async () => undefined));
const reset = vi.hoisted(() => vi.fn());
const publish = vi.hoisted(() => vi.fn());

vi.mock("@apollo/client", () => ({ useQuery: vi.fn(), gql: () => ({}) }));
vi.mock("../../store/store", () => ({ default: vi.fn() }));
vi.mock("../../features/music/musicApi", () => ({
  musicApi: { setAuthority },
  musicIdentityCoordinator: { reconcile, reset },
}));
vi.mock("../../features/music/musicSessionBoundary", () => ({ musicSessionBoundary: { publish } }));

const complete = (documentId: string) => ({ documentId, Account_Name: "Ready", Account_Type: "Personal", mobile_number: "+10000000001" });

describe("AuthSyncManager immutable authority selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: true,
      user: { documentId: "user-document" },
    });
  });

  it("advances the client authority and broadcasts account generation before reconciling a changed selected Account", async () => {
    const query = useQuery as unknown as ReturnType<typeof vi.fn>;
    query.mockReturnValue({ data: { usersPermissionsUser: {
      documentId: "user-document", provider: "local", confirmed: true, blocked: false,
      accounts: [complete("account-a")],
    } } });
    const view = render(<AuthSyncManager />);
    await waitFor(() => expect(reconcile).toHaveBeenCalledTimes(1));
    expect(setAuthority).toHaveBeenLastCalledWith("user-document:account-a");
    expect(publish).not.toHaveBeenCalled();

    query.mockReturnValue({ data: { usersPermissionsUser: {
      documentId: "user-document", provider: "local", confirmed: true, blocked: false,
      accounts: [complete("account-b")],
    } } });
    view.rerender(<AuthSyncManager />);
    await waitFor(() => expect(setAuthority).toHaveBeenLastCalledWith("user-document:account-b"));
    expect(publish).toHaveBeenCalledWith("account-generation");
    expect(setAuthority.mock.invocationCallOrder.at(-1)).toBeLessThan(reconcile.mock.invocationCallOrder.at(-1)!);
  });

  it("does not reconcile or select index zero when two completed Accounts are authoritative", async () => {
    (useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ data: { usersPermissionsUser: {
      documentId: "user-document", provider: "local", confirmed: true, blocked: false,
      accounts: [complete("account-a"), complete("account-b")],
    } } });
    render(<AuthSyncManager />);
    await Promise.resolve();
    expect(setAuthority).not.toHaveBeenCalled();
    expect(reconcile).not.toHaveBeenCalled();
  });
});
