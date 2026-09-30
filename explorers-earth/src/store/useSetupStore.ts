import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface SetupState {
  accountScope: string | null;
  isProfileComplete: boolean;
  isRecommendationsComplete: boolean;
  bindAccount: (accountId: string, onboardingStatus: "incomplete" | "complete") => void;
  setSetupStatus: (profileComplete: boolean, recommendationsComplete: boolean, accountId?: string) => void;
}

const useSetupStore = create<SetupState>()(
  persist(
    (set) => ({
      accountScope: null,
      isProfileComplete: false,
      isRecommendationsComplete: false,
      bindAccount: (accountId, onboardingStatus) => set((state) => ({
        accountScope: accountId,
        isProfileComplete: onboardingStatus === "complete",
        isRecommendationsComplete: state.accountScope === accountId ? state.isRecommendationsComplete : false,
      })),
      setSetupStatus: (profileComplete, recommendationsComplete, accountId) =>
        set((state) => accountId && accountId !== state.accountScope ? state : ({
          isProfileComplete: profileComplete,
          isRecommendationsComplete: recommendationsComplete,
        })),
    }),
    {
      name: "setup-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useSetupStore;

