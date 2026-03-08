import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface SetupState {
  isProfileComplete: boolean;
  isRecommendationsComplete: boolean;
  setSetupStatus: (profileComplete: boolean, recommendationsComplete: boolean) => void;
}

const useSetupStore = create<SetupState>()(
  persist(
    (set) => ({
      isProfileComplete: false,
      isRecommendationsComplete: false,
      setSetupStatus: (profileComplete, recommendationsComplete) =>
        set({
          isProfileComplete: profileComplete,
          isRecommendationsComplete: recommendationsComplete,
        }),
    }),
    {
      name: "setup-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useSetupStore;

