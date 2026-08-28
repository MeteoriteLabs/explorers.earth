import { useMemo, type ReactNode } from "react";
import { getThemeTokenStyles } from "../../Profile/constants/themePresets";
import { normalizeThemeSettings } from "../../Profile/constants/recommendationsPresentation";
import { usePublicMusicAvailability } from "../../music/PublicMusicAvailabilityProvider";

/** Shared normalized token owner for every friendly public-profile destination. */
export default function PublicProfileThemeProvider({ children }: { children: ReactNode }) {
  const { account } = usePublicMusicAvailability();
  const theme = useMemo(() => normalizeThemeSettings(account?.social_media?.theme_settings), [account?.social_media?.theme_settings]);
  const style = useMemo(() => getThemeTokenStyles(theme), [theme]);
  return <div data-public-profile-chrome data-theme-preset={theme.preset} data-wallpaper-mode={theme.wallpaperMode} style={style}>{children}</div>;
}
