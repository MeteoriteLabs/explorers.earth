import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useApolloClient } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../../store/store";
import { useLogout } from "../useLogout";
import { getMusicCredential, setMusicCredential } from "../../lib/musicCredentialStore";

const mockNavigate = vi.fn();
const mockClearStore = vi.fn();

vi.mock("@apollo/client", () => ({ useApolloClient: vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock("sonner", () => ({ toast: vi.fn() }));
describe("useLogout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClearStore.mockResolvedValue(undefined);
    (useApolloClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ clearStore: mockClearStore });
    (useNavigate as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockNavigate);
    useAuthStore.getState().logout();
  });

  it("clears the Apollo cache, clears storage, and redirects to /login", async () => {
    localStorage.setItem("qrtoken", "jwt");
    const { result } = renderHook(() => useLogout());

    await result.current();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(mockClearStore).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("qrtoken")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("clears the Music credential synchronously before async cache clearing or navigation", async () => {
    let finishClear!: () => void;
    mockClearStore.mockImplementationOnce(() => new Promise<void>((resolve) => { finishClear = resolve; }));
    setMusicCredential({ token: "account-a.music.credential", expiresAt: Date.now() + 60_000 });
    const { result } = renderHook(() => useLogout());

    const logout = result.current();
    expect(getMusicCredential()).toBeUndefined();
    expect(mockNavigate).not.toHaveBeenCalled();
    finishClear();
    await logout;
  });

  it("still redirects even if clearing the cache rejects", async () => {
    mockClearStore.mockRejectedValueOnce(new Error("cache boom"));
    const { result } = renderHook(() => useLogout());

    await result.current();

    expect(mockClearStore).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});
