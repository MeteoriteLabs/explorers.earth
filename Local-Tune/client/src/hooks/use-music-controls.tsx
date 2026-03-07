import { createContext, useContext, useState, useEffect } from "react";
import { useProfile } from "@/hooks/use-profile";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface MusicControlsContextType {
  showPersistentControls: boolean;
  togglePersistentControls: () => void;
}

const MusicControlsContext = createContext<MusicControlsContextType | null>(null);

export function MusicControlsProvider({ children }: { children: React.ReactNode }) {
  const { data: profile } = useProfile();
  const [showPersistentControls, setShowPersistentControls] = useState(
    profile?.musicSettings?.showPersistentControls ?? false
  );
  const queryClient = useQueryClient();

  // Update user preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (showControls: boolean) => {
      return apiRequest("PATCH", "/api/user/preferences", {
        musicSettings: {
          showPersistentControls: showControls
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
    },
  });

  // Update state when profile changes
  useEffect(() => {
    if (profile?.musicSettings?.showPersistentControls !== undefined) {
      setShowPersistentControls(profile.musicSettings.showPersistentControls);
    }
  }, [profile?.musicSettings?.showPersistentControls]);

  const togglePersistentControls = () => {
    const newValue = !showPersistentControls;
    setShowPersistentControls(newValue);
    updatePreferencesMutation.mutate(newValue);
  };

  return (
    <MusicControlsContext.Provider value={{
      showPersistentControls,
      togglePersistentControls,
    }}>
      {children}
    </MusicControlsContext.Provider>
  );
}

export function useMusicControls() {
  const context = useContext(MusicControlsContext);
  if (!context) {
    throw new Error("useMusicControls must be used within a MusicControlsProvider");
  }
  return context;
}
