import { IMAGE_CONFIG } from "../../../config";

export type PublicProfileHeroMode =
  | "solid-color"
  | "banner-top"
  | "ambient-gradient"
  | "full-wallpaper-image";

export interface PublicProfileSocialLinkViewModel {
  id: string;
  href: string;
  ariaLabel: string;
  renderIcon: (props: { className?: string }) => React.ReactNode;
  analyticsPlatform: string;
}

export interface PublicProfileSurface {
  mode: PublicProfileHeroMode;
  wallpaperUrl: string | null;
  fallbackToPresetSurface: boolean;
}

export interface PublicProfileHeaderProps {
  surface: PublicProfileSurface;
  accountName: string;
  location?: string;
  avatarUrl?: string;
  socialLinks: PublicProfileSocialLinkViewModel[];
  onShare: () => void;
  onAvatarActivate?: () => void;
}

export interface ResolvePublicProfileSurfaceOptions {
  wallpaperMode?: unknown;
  wallpaperUrl?: string | null;
  bgPictureUrl?: string | null;
  defaultWallpaperUrl?: string | null;
}

export function isSafeMediaUrl(url: unknown): boolean {
  if (typeof url !== "string") return false;
  // Reject control characters before trimming
  if ([...url].some((character) => {
    const codePoint = character.charCodeAt(0);
    return codePoint <= 31 || codePoint === 127;
  })) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../")) {
    return true;
  }
  try {
    const parsed = new URL(trimmed, "http://localhost");
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function resolvePublicProfileSurface(
  options?: ResolvePublicProfileSurfaceOptions,
): PublicProfileSurface {
  const rawMode = options?.wallpaperMode;
  const validModes: PublicProfileHeroMode[] = [
    "solid-color",
    "banner-top",
    "ambient-gradient",
    "full-wallpaper-image",
  ];

  const mode: PublicProfileHeroMode =
    typeof rawMode === "string" && (validModes as string[]).includes(rawMode)
      ? (rawMode as PublicProfileHeroMode)
      : "banner-top";

  if (mode === "solid-color" || mode === "ambient-gradient") {
    return {
      mode,
      wallpaperUrl: null,
      fallbackToPresetSurface: false,
    };
  }

  const defaultBg =
    options?.defaultWallpaperUrl !== undefined
      ? options.defaultWallpaperUrl
      : IMAGE_CONFIG?.defaultImages?.background || "/background.jpg";

  const candidates = [options?.wallpaperUrl, options?.bgPictureUrl, defaultBg];

  for (const candidate of candidates) {
    if (isSafeMediaUrl(candidate)) {
      return {
        mode,
        wallpaperUrl: (candidate as string).trim(),
        fallbackToPresetSurface: false,
      };
    }
  }

  return {
    mode,
    wallpaperUrl: null,
    fallbackToPresetSurface: true,
  };
}
