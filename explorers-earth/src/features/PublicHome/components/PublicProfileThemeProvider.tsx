import { useMemo, type ReactNode } from "react";
import { getThemeTokenStyles } from "../../Profile/constants/themePresets";
import { normalizeThemeSettings } from "../../Profile/constants/recommendationsPresentation";
import { usePublicMusicAvailability } from "../../music/PublicMusicAvailabilityProvider";
import { Link, useLocation } from "react-router-dom";

/** Shared normalized token owner for every friendly public-profile destination. */
export default function PublicProfileThemeProvider({ children }: { children: ReactNode }) {
  const { account } = usePublicMusicAvailability();
  const location = useLocation();
  const showSharedChrome = /\/music\/?$/.test(location.pathname);
  const theme = useMemo(() => normalizeThemeSettings(account?.social_media?.theme_settings), [account?.social_media?.theme_settings]);
  const style = useMemo(() => getThemeTokenStyles(theme), [theme]);
  const name = typeof account?.Account_Name === "string" && account.Account_Name.trim() ? account.Account_Name : "Explorers";
  const bannerUrl = theme.wallpaperMode === "banner-top" && typeof account?.bg_picture?.url === "string" ? account.bg_picture.url : undefined;
  const wallpaperUrl = theme.wallpaperMode === "full-wallpaper-image" && typeof account?.bg_picture?.url === "string" ? account.bg_picture.url : undefined;
  return <div data-public-profile-chrome data-theme-preset={theme.preset} data-wallpaper-mode={theme.wallpaperMode} style={{
    ...style,
    backgroundColor: "var(--bg-page)",
    backgroundImage: wallpaperUrl ? `url(${wallpaperUrl})` : undefined,
    backgroundPosition: wallpaperUrl ? "center" : undefined,
    backgroundSize: wallpaperUrl ? "cover" : undefined,
    color: "var(--text-primary)",
  }}>
    {showSharedChrome ? <header className="min-h-14 border-b" style={{ backgroundColor: "var(--nav-bg)", borderColor: "var(--border-card)" }}>
      <div className="mx-auto flex min-h-14 max-w-4xl items-center justify-between px-6">
        <Link to="/" aria-label="Explorers.Earth home"><img src="/eoe-icon.svg" alt="" className="h-8" /></Link>
        <span className="font-semibold">{name}</span>
      </div>
    </header> : null}
    {showSharedChrome && bannerUrl ? <img className="h-48 w-full object-cover md:h-64" src={bannerUrl} alt={`${name} profile banner`} /> : null}
    {children}
    {showSharedChrome && theme.footerBranding !== "disabled" ? <footer className="border-t px-6 py-6 text-center text-sm" style={{ borderColor: "var(--border-card)", color: "var(--text-secondary)" }}>Powered by Explorers.Earth</footer> : null}
  </div>;
}
