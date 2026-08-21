import { describe, it, expect } from "vitest";
import {
  resolvePublicProfileSurface,
  isSafeMediaUrl,
} from "../resolvePublicProfileSurface";

describe("isSafeMediaUrl", () => {
  it("accepts valid relative and HTTP(S) URLs", () => {
    expect(isSafeMediaUrl("/images/bg.jpg")).toBe(true);
    expect(isSafeMediaUrl("./assets/avatar.png")).toBe(true);
    expect(isSafeMediaUrl("https://example.com/banner.png")).toBe(true);
    expect(isSafeMediaUrl("http://example.com/photo.jpg")).toBe(true);
  });

  it("rejects empty, whitespace, control characters, and unsafe schemes", () => {
    expect(isSafeMediaUrl(null)).toBe(false);
    expect(isSafeMediaUrl(undefined)).toBe(false);
    expect(isSafeMediaUrl("   ")).toBe(false);
    expect(isSafeMediaUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeMediaUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeMediaUrl("/image.png\0.jpg")).toBe(false);
    expect(isSafeMediaUrl("https://example.com/image.png\n")).toBe(false);
  });
});

describe("resolvePublicProfileSurface", () => {
  it("resolves solid-color mode with null wallpaperUrl", () => {
    const result = resolvePublicProfileSurface({
      wallpaperMode: "solid-color",
      wallpaperUrl: "https://example.com/wall.jpg",
    });
    expect(result).toEqual({
      mode: "solid-color",
      wallpaperUrl: null,
      fallbackToPresetSurface: false,
    });
  });

  it("resolves ambient-gradient mode with null wallpaperUrl", () => {
    const result = resolvePublicProfileSurface({
      wallpaperMode: "ambient-gradient",
      wallpaperUrl: "https://example.com/wall.jpg",
    });
    expect(result).toEqual({
      mode: "ambient-gradient",
      wallpaperUrl: null,
      fallbackToPresetSurface: false,
    });
  });

  it("resolves banner-top precedence: custom wallpaperUrl -> bgPictureUrl -> defaultWallpaperUrl", () => {
    // 1. Custom wallpaperUrl present
    expect(
      resolvePublicProfileSurface({
        wallpaperMode: "banner-top",
        wallpaperUrl: "  https://example.com/custom.jpg  ",
        bgPictureUrl: "https://example.com/bg.jpg",
        defaultWallpaperUrl: "/default-bg.jpg",
      }),
    ).toEqual({
      mode: "banner-top",
      wallpaperUrl: "https://example.com/custom.jpg",
      fallbackToPresetSurface: false,
    });

    // 2. Custom wallpaperUrl invalid, falls back to bgPictureUrl
    expect(
      resolvePublicProfileSurface({
        wallpaperMode: "banner-top",
        wallpaperUrl: "javascript:alert(1)",
        bgPictureUrl: "https://example.com/bg.jpg",
        defaultWallpaperUrl: "/default-bg.jpg",
      }),
    ).toEqual({
      mode: "banner-top",
      wallpaperUrl: "https://example.com/bg.jpg",
      fallbackToPresetSurface: false,
    });

    // 3. Custom and bgPictureUrl invalid/missing, falls back to defaultWallpaperUrl
    expect(
      resolvePublicProfileSurface({
        wallpaperMode: "banner-top",
        wallpaperUrl: "",
        bgPictureUrl: "   ",
        defaultWallpaperUrl: "/default-bg.jpg",
      }),
    ).toEqual({
      mode: "banner-top",
      wallpaperUrl: "/default-bg.jpg",
      fallbackToPresetSurface: false,
    });
  });

  it("resolves full-wallpaper-image mode precedence", () => {
    expect(
      resolvePublicProfileSurface({
        wallpaperMode: "full-wallpaper-image",
        wallpaperUrl: "https://example.com/full.jpg",
      }),
    ).toEqual({
      mode: "full-wallpaper-image",
      wallpaperUrl: "https://example.com/full.jpg",
      fallbackToPresetSurface: false,
    });
  });

  it("returns fallbackToPresetSurface: true when all image candidates are invalid for image modes", () => {
    expect(
      resolvePublicProfileSurface({
        wallpaperMode: "banner-top",
        wallpaperUrl: "javascript:void(0)",
        bgPictureUrl: null,
        defaultWallpaperUrl: null,
      }),
    ).toEqual({
      mode: "banner-top",
      wallpaperUrl: null,
      fallbackToPresetSurface: true,
    });
  });

  it("defaults unprovided or invalid wallpaperMode to banner-top", () => {
    expect(
      resolvePublicProfileSurface({
        wallpaperMode: "invalid-mode",
        wallpaperUrl: "https://example.com/bg.jpg",
      }),
    ).toEqual({
      mode: "banner-top",
      wallpaperUrl: "https://example.com/bg.jpg",
      fallbackToPresetSurface: false,
    });
  });
});
