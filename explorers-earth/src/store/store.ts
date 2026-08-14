import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { clearMusicCredential } from "../lib/musicCredentialStore";

// types for authentication
interface AuthState {
  isAuthenticated: boolean;
  user: {
    id: string;
    documentId: string;
    username: string;
    email: string;
    blocked: boolean;
  } | null;
  token: string | null;
  login: (data: {
    id: string;
    documentId: string;
    username: string;
    email: string;
    blocked: boolean;
    token: string;
  }) => void;
  logout: () => void;
  updateUserBlocked: (blocked: boolean) => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // initial state
      token: null,
      isAuthenticated: false,
      user: null,

      login: (data) => {
        clearMusicCredential();
        set({
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
          isAuthenticated: false,
          user: null,
          token: null,
        });
      },

      // state for updating user status
      updateUserBlocked: (blocked) =>
        set((state) => ({
          user: state.user ? { ...state.user, blocked } : null,
        })),
    }),
    {
      name: "auth-storage", // key to store the state in localStorage
      storage: createJSONStorage(() => localStorage), // Use createJSONStorage for localStorage
    }
  )
);

export default useAuthStore;
