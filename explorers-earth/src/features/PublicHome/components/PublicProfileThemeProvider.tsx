import { useMemo, type ReactNode } from "react";
import { getThemeTokenStyles } from "../../Profile/constants/themePresets";
import { normalizeThemeSettings } from "../../Profile/constants/recommendationsPresentation";
import { usePublicMusicAvailability } from "../../music/PublicMusicAvailabilityProvider";
import { useLocation } from "react-router-dom";
import { PublicProfileBrandingFooter, PublicProfileFixedHeader, PublicProfileHero, PublicProfileWallpaper } from "./PublicProfileChromePrimitives";
import { createAnalyticsOptions, useTrackAnalytics } from "../../../services/analyticsService";

/** Shared normalized token owner for every friendly public-profile destination. */
export default function PublicProfileThemeProvider({ children }: { children: ReactNode }) {
  const { account } = usePublicMusicAvailability();
  const location = useLocation();
  const showSharedChrome = /\/music\/?$/.test(location.pathname);
  const theme = useMemo(() => normalizeThemeSettings(account?.social_media?.theme_settings), [account?.social_media?.theme_settings]);
  const analytics = useTrackAnalytics({ ...createAnalyticsOptions.profile(account?.documentId || "", account?.username), autoTrackView: false });
  const style = useMemo(() => getThemeTokenStyles(theme), [theme]);
  return <div data-public-profile-chrome data-theme-preset={theme.preset} data-wallpaper-mode={theme.wallpaperMode} style={{
    ...style,
    backgroundColor: "var(--bg-page)",
    color: "var(--text-primary)",
  }}>
    {showSharedChrome && <><PublicProfileFixedHeader shareUrl={window.location.href} profileName={account?.Account_Name || account?.username || "Explorer"} onTrackClick={analytics.trackClick} /><PublicProfileWallpaper account={account} theme={theme} /><PublicProfileHero account={account} theme={theme} /></>}
    <div className="relative z-10">{children}</div>
    {showSharedChrome && <PublicProfileBrandingFooter theme={theme} />}
  </div>;
}
