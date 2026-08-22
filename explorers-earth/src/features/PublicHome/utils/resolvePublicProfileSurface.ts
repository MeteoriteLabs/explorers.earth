import { IMAGE_CONFIG } from "../../../config";
import type { MediaItem } from "../../../components/ui/MediaViewer";

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
  onAvatarActivate: (
    item: PublicAvatarMediaItem,
    trigger: HTMLButtonElement,
  ) => void;
}

export type PublicAvatarSource = "configured" | "fallback" | "generated";

export interface PublicAvatarMediaItem extends MediaItem {
  type: "image";
  source: PublicAvatarSource;
}

export function createGeneratedPublicAvatarUrl(accountName: string): string {
  const initial = Array.from(accountName.trim())[0]?.toLocaleUpperCase() || "?";
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">',
    '<rect width="800" height="800" fill="#111827"/>',
    `<text x="400" y="430" fill="#F8FAFC" font-family="system-ui, sans-serif" font-size="320" font-weight="600" text-anchor="middle" dominant-baseline="middle">${initial.replace(/[&<>"']/g, "")}</text>`,
    "</svg>",
  ].join("");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function createPublicAvatarMediaItem({
  accountName,
  activeUrl,
  alt,
  source,
}: {
  accountName: string;
  activeUrl: string | null;
  alt: string;
  source: PublicAvatarSource;
}): PublicAvatarMediaItem {
  return {
    id: `public-profile-avatar-${source}`,
    url: activeUrl ?? createGeneratedPublicAvatarUrl(accountName),
    alt,
    type: "image",
    source,
  };
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
