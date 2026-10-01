import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { clearMusicCredential } from "../lib/musicCredentialStore";

// types for authentication
interface AuthState {
  status: "loading" | "signed-out" | "active-incomplete" | "active-complete" | "recovery-only" | "terminal" | "error";
  generation: number;
  accountId: string | null;
  logoutError: boolean;
  isAuthenticated: boolean;
  user: {
    id: string;
    documentId: string;
    username: string;
    email: string;
    blocked: boolean;
  } | null;
  token: string | null;
  beginVerification: () => number;
  acceptVerified: (generation: number, account: { id: string; userId: string; username: string; email: string;
    onboardingStatus: "incomplete" | "complete"; revision: number }) => void;
  verificationFailed: (generation: number, status: "signed-out" | "recovery-only" | "terminal" | "error") => void;
  setLogoutError: (failed: boolean) => void;
  login: (data: {
    id: string;
    documentId: string;
    username: string;
    email: string;
    blocked: boolean;
    token: string;
  }) => void;
  logout: () => void;
  updateUsername: (username: string) => void;
  updateUserBlocked: (blocked: boolean) => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // initial state
      status: "loading",
      generation: 0,
      accountId: null,
      logoutError: typeof sessionStorage !== "undefined" && sessionStorage.getItem("explorers-logout-pending") === "1",
      token: null,
      isAuthenticated: false,
      user: null,

      beginVerification: () => {
        const generation = get().generation + 1;
        clearMusicCredential();
        set({ generation, status: "loading", isAuthenticated: false, accountId: null, token: null, user: null });
        return generation;
      },
      acceptVerified: (generation, account) => {
        if (get().generation !== generation || get().status !== "loading") return;
        set({ status: account.onboardingStatus === "complete" ? "active-complete" : "active-incomplete",
          accountId: account.id, isAuthenticated: true, token: null,
          user: { id: account.userId, documentId: account.id, username: account.username,
            email: account.email, blocked: false } });
      },
      verificationFailed: (generation, status) => {
        if (get().generation !== generation) return;
        clearMusicCredential();
        set({ status, accountId: null, isAuthenticated: false, token: null, user: null });
      },
      setLogoutError: (failed) => {
        if (typeof sessionStorage !== "undefined") {
          if (failed) sessionStorage.setItem("explorers-logout-pending", "1");
          else sessionStorage.removeItem("explorers-logout-pending");
        }
        set({ logoutError: failed });
      },

      login: (data) => {
        clearMusicCredential();
        set({
          generation: get().generation + 1,
          status: "active-complete",
          accountId: data.documentId,
          logoutError: false,
          isAuthenticated: true,
          user: {
            id: data.id,
            blocked: data.blocked,
            username: data.username,
            email: data.email,
            documentId: data.documentId,
          },
          token: data.token,
        });
      },

      logout: () => {
        clearMusicCredential();
        set({
          generation: get().generation + 1,
          status: "signed-out",
          accountId: null,
          logoutError: false,
          isAuthenticated: false,
          user: null,
          token: null,
        });
      },

      updateUsername: (username) =>
        set((state) => ({
          user: state.user ? { ...state.user, username } : null,
        })),

      // state for updating user status
      updateUserBlocked: (blocked) =>
        set((state) => ({
          user: state.user ? { ...state.user, blocked } : null,
        })),
    }),
    {
      name: "auth-storage", // key to store the state in localStorage
      storage: createJSONStorage(() => localStorage), // Use createJSONStorage for localStorage
      partialize: () => ({}),
      merge: (_persisted, current) => current,
    }
  )
);

export default useAuthStore;
