import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface EmailState {
  email: string | null;
  setEmail: (data: { email: string }) => void;
}

const useEmailStore = create<EmailState>()(
  persist(
    (set) => ({
      email: null,

      setEmail: (data) =>
        set(() => ({
          email: data.email,
        })),
    }),
    {
      name: "email",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useEmailStore;
