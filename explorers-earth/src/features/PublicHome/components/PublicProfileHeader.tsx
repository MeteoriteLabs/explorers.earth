import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LogoIcon } from "../../../assets/icons/EoeLogo";
import Location from "../../../assets/icons/Location";
import { IMAGE_CONFIG } from "../../../config";
import {
  isSafeMediaUrl,
  type PublicProfileHeaderProps,
} from "../utils/resolvePublicProfileSurface";

export function PublicProfileHeader({
  surface,
  accountName,
  location,
  avatarUrl,
  socialLinks,
  onShare,
  onAvatarActivate,
}: PublicProfileHeaderProps) {
  const navigate = useNavigate();

  // Scroll sentinel state for fixed navigation treatment
  const [isScrolled, setIsScrolled] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;

    let observer: IntersectionObserver | null = null;
    try {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry) {
            setIsScrolled(!entry.isIntersecting);
          }
        },
        { threshold: 0.1 },
      );
      observer.observe(sentinel);
    } catch {
      // Environment fallback
    }

    return () => observer?.disconnect();
  }, []);

  // Wallpaper media state machine (generation-keyed)
  const [wallpaperGen, setWallpaperGen] = useState(0);
  const [wallpaperState, setWallpaperState] = useState<{
    gen: number;
    failedPrimary: boolean;
    failedFallback: boolean;
    activeUrl: string | null;
  }>({
    gen: 0,
    failedPrimary: false,
    failedFallback: false,
    activeUrl: isSafeMediaUrl(surface.wallpaperUrl) ? surface.wallpaperUrl : null,
  });

  useEffect(() => {
    const nextGen = wallpaperGen + 1;
    setWallpaperGen(nextGen);
    const initialUrl = isSafeMediaUrl(surface.wallpaperUrl) ? surface.wallpaperUrl : null;
    setWallpaperState({
      gen: nextGen,
      failedPrimary: false,
      failedFallback: false,
      activeUrl: initialUrl,
    });
  }, [surface.wallpaperUrl, surface.mode]);

  const handleWallpaperError = () => {
    setWallpaperState((prev) => {
      // Ignore stale callback
      if (prev.gen !== wallpaperGen) return prev;

      const fallbackUrl = IMAGE_CONFIG?.defaultImages?.background || "/background.jpg";

      if (!prev.failedPrimary) {
        if (
          isSafeMediaUrl(fallbackUrl) &&
          fallbackUrl !== prev.activeUrl
        ) {
          return {
            ...prev,
            failedPrimary: true,
            activeUrl: fallbackUrl,
          };
        }
      }

      return {
        ...prev,
        failedPrimary: true,
        failedFallback: true,
        activeUrl: null,
      };
    });
  };

  // Avatar media state machine (generation-keyed)
  const [avatarGen, setAvatarGen] = useState(0);
  const [avatarState, setAvatarState] = useState<{
    gen: number;
    failedPrimary: boolean;
    failedFallback: boolean;
    activeUrl: string | null;
  }>({
    gen: 0,
    failedPrimary: false,
    failedFallback: false,
    activeUrl: isSafeMediaUrl(avatarUrl)
      ? (avatarUrl as string).trim()
      : IMAGE_CONFIG?.defaultImages?.profile || "/profile.jpg",
  });

  useEffect(() => {
    const nextGen = avatarGen + 1;
    setAvatarGen(nextGen);
    const primarySafe = isSafeMediaUrl(avatarUrl);
    const initialUrl = primarySafe
      ? (avatarUrl as string).trim()
      : IMAGE_CONFIG?.defaultImages?.profile || "/profile.jpg";

    setAvatarState({
      gen: nextGen,
      failedPrimary: !primarySafe,
      failedFallback: false,
      activeUrl: initialUrl,
    });
  }, [avatarUrl]);

  const handleAvatarError = () => {
    setAvatarState((prev) => {
      if (prev.gen !== avatarGen) return prev;

      const fallbackAvatar = IMAGE_CONFIG?.defaultImages?.profile || "/profile.jpg";

      if (!prev.failedPrimary && fallbackAvatar !== prev.activeUrl && isSafeMediaUrl(fallbackAvatar)) {
        return {
          ...prev,
          failedPrimary: true,
          activeUrl: fallbackAvatar,
        };
      }

      return {
        ...prev,
        failedPrimary: true,
        failedFallback: true,
        activeUrl: null,
      };
    });
  };

  // Fixed Navigation Header styling based on scroll & surface mode
  const isComposedHero = surface.mode !== "solid-color";
  const navTransparentAtTop = isComposedHero && !isScrolled;

  const navBgClass = navTransparentAtTop
    ? "bg-transparent border-transparent text-white"
    : "bg-[var(--nav-bg)] border-[var(--border-card)] text-[var(--text-primary)] backdrop-blur-md border-b";

  return (
    <>
      {/* Fixed Header Bar */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 h-14 transition-colors duration-300 motion-reduce:transition-none ${navBgClass}`}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between h-full px-4 sm:px-6">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate("/");
            }}
            aria-label="explorers.earth"
            className="flex items-center gap-2 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent-color)] rounded-md p-1 min-w-[44px] min-h-[44px]"
          >
            <LogoIcon className="h-8 md:h-9 w-auto text-current" />
          </a>

          <button
            type="button"
            onClick={onShare}
            aria-label="Share"
            className="p-2 min-w-[44px] min-h-[44px] bg-gray-800/60 hover:bg-gray-700/80 text-white rounded-md transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent-color)]"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Adaptive Identity Hero */}
      <div
        data-testid="public-profile-hero"
        data-wallpaper-mode={surface.mode}
        className="public-profile-hero relative overflow-hidden text-center px-4 pt-20 pb-6 md:pt-24 md:pb-8"
      >
        {/* Sentinel for top-of-page scroll check */}
        <div
          ref={sentinelRef}
          data-testid="hero-sentinel"
          className="absolute top-0 left-0 w-full h-1 pointer-events-none"
        />

        {/* Banner image layer for banner-top mode */}
        {surface.mode === "banner-top" && wallpaperState.activeUrl && (
          <div className="absolute inset-0 z-0 overflow-hidden">
            <img
              data-testid="wallpaper-image"
              src={wallpaperState.activeUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={handleWallpaperError}
              className="w-full h-full object-cover object-[center_32%]"
            />
            {/* Edge-to-edge bottom gradient inside hero bounds */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/80 z-0 pointer-events-none" />
          </div>
        )}

        {/* Hero Identity Content */}
        <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
          {/* Avatar Circle */}
          <div className="mb-3">
            {onAvatarActivate ? (
              <button
                type="button"
                data-testid="profile-avatar"
                onClick={onAvatarActivate}
                aria-label="View profile photo"
                className="w-[7.5rem] h-[7.5rem] rounded-full border-2 border-[var(--border-card)] shadow-sm overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent-color)] transition-transform hover:scale-105 block"
              >
                {avatarState.activeUrl ? (
                  <img
                    src={avatarState.activeUrl}
                    alt={accountName}
                    referrerPolicy="no-referrer"
                    onError={handleAvatarError}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-secondary)]">
                    {accountName.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>
            ) : (
              <div
                data-testid="profile-avatar"
                className="w-[7.5rem] h-[7.5rem] rounded-full border-2 border-[var(--border-card)] shadow-sm overflow-hidden block"
              >
                {avatarState.activeUrl ? (
                  <img
                    src={avatarState.activeUrl}
                    alt={accountName}
                    referrerPolicy="no-referrer"
                    onError={handleAvatarError}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-secondary)]">
                    {accountName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Identity Info - Cardless on Page Surface */}
          <h1 className="text-xl md:text-2xl font-poppins font-bold tracking-tight text-[var(--text-primary)] text-center drop-shadow-sm">
            {accountName}
          </h1>

          {location && (
            <div className="flex items-center justify-center gap-1.5 text-xs md:text-sm font-poppins mt-1 text-[var(--text-secondary)] text-center drop-shadow-sm">
              <Location className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" />
              <span>{location}</span>
            </div>
          )}

          {/* Social Links */}
          {socialLinks.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-4 text-[var(--text-primary)]">
              {socialLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.ariaLabel}
                  className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--accent-color)] rounded-md"
                >
                  {link.renderIcon({ className: "w-5 h-5 fill-current" })}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
