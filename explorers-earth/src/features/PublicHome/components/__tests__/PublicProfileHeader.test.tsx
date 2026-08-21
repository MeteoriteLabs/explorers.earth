import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { PublicProfileHeader } from "../PublicProfileHeader";
import type {
  PublicProfileHeaderProps,
  PublicProfileSocialLinkViewModel,
} from "../../utils/resolvePublicProfileSurface";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockSocialLinks: PublicProfileSocialLinkViewModel[] = [
  {
    id: "instagram",
    href: "https://instagram.com/testuser",
    ariaLabel: "Instagram",
    renderIcon: ({ className }) => <svg data-testid="instagram-icon" className={className} />,
    analyticsPlatform: "instagram",
  },
  {
    id: "whatsapp",
    href: "https://wa.me/1234567890",
    ariaLabel: "WhatsApp",
    renderIcon: ({ className }) => <svg data-testid="whatsapp-icon" className={className} />,
    analyticsPlatform: "whatsapp",
  },
];

const fixtureProps: PublicProfileHeaderProps = {
  surface: {
    mode: "solid-color",
    wallpaperUrl: null,
    fallbackToPresetSurface: false,
  },
  accountName: "Jane Explorer",
  location: "Reykjavik, Iceland",
  avatarUrl: "https://example.com/avatar.jpg",
  socialLinks: mockSocialLinks,
  onShare: vi.fn(),
  onAvatarActivate: vi.fn(),
};

const renderHeader = (props: Partial<PublicProfileHeaderProps> = {}) => {
  return render(
    <BrowserRouter>
      <PublicProfileHeader {...fixtureProps} {...props} />
    </BrowserRouter>,
  );
};

let intersectionObserverCallback: ((entries: Partial<IntersectionObserverEntry>[]) => void) | null = null;

describe("PublicProfileHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    intersectionObserverCallback = null;
    class MockIntersectionObserver {
      constructor(callback: (entries: Partial<IntersectionObserverEntry>[]) => void) {
        intersectionObserverCallback = callback;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    window.IntersectionObserver = MockIntersectionObserver as any;
  });

  it.each(["solid-color", "banner-top", "ambient-gradient", "full-wallpaper-image"] as const)(
    "renders %s without a metadata card or accent avatar ring",
    (mode) => {
      renderHeader({
        surface: { mode, wallpaperUrl: mode === "banner-top" ? "https://example.com/bg.jpg" : null, fallbackToPresetSurface: false },
      });
      expect(screen.getByTestId("public-profile-hero")).toHaveAttribute("data-wallpaper-mode", mode);
      expect(screen.queryByTestId("profile-metadata-card")).not.toBeInTheDocument();
      expect(screen.getByTestId("profile-avatar")).not.toHaveStyle({ borderColor: "var(--accent-color)" });
      expect(screen.getByRole("link", { name: "explorers.earth" })).toBeVisible();
    },
  );

  it("renders account name, location, and social links with 44px min targets", () => {
    renderHeader();
    expect(screen.getByText("Jane Explorer")).toBeVisible();
    expect(screen.getByText("Reykjavik, Iceland")).toBeVisible();

    const instagram = screen.getByRole("link", { name: "Instagram" });
    expect(instagram).toHaveAttribute("href", "https://instagram.com/testuser");
    expect(instagram.className).toContain("min-w-[44px]");
    expect(instagram.className).toContain("min-h-[44px]");
  });

  it("renders avatar as a semantic button when onAvatarActivate is provided", async () => {
    const user = userEvent.setup();
    const onAvatarActivate = vi.fn();
    renderHeader({ onAvatarActivate });

    const avatarBtn = screen.getByRole("button", { name: "View profile photo" });
    expect(avatarBtn).toBeVisible();
    await user.click(avatarBtn);
    expect(onAvatarActivate).toHaveBeenCalledTimes(1);
  });

  it("renders non-interactive avatar wrapper when onAvatarActivate is absent", () => {
    renderHeader({ onAvatarActivate: undefined });
    expect(screen.queryByRole("button", { name: "View profile photo" })).not.toBeInTheDocument();
    expect(screen.getByTestId("profile-avatar")).toBeVisible();
  });

  it("sets referrerPolicy='no-referrer' and decorative wallpaper alt='' on images", () => {
    renderHeader({
      surface: {
        mode: "banner-top",
        wallpaperUrl: "https://example.com/wallpaper.jpg",
        fallbackToPresetSurface: false,
      },
    });

    const wallpaperImg = screen.getByTestId("public-profile-hero").querySelector("img");
    expect(wallpaperImg).toHaveAttribute("alt", "");
    expect(wallpaperImg).toHaveAttribute("referrerpolicy", "no-referrer");

    const avatarImg = screen.getByAltText("Jane Explorer");
    expect(avatarImg).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  describe("Scroll sentinel state transitions", () => {
    it("transitions top navbar from transparent when at top to scrolled style when scrolled past sentinel", async () => {
      renderHeader({
        surface: {
          mode: "banner-top",
          wallpaperUrl: "https://example.com/bg.jpg",
          fallbackToPresetSurface: false,
        },
      });

      const headerElement = screen.getByRole("banner");

      // Initially at top of page (intersecting sentinel) -> transparent header
      act(() => {
        intersectionObserverCallback?.([{ isIntersecting: true }]);
      });
      expect(headerElement.className).toContain("bg-transparent");
      expect(headerElement.className).toContain("text-white");

      // Scroll down past sentinel (isIntersecting: false) -> scrolled navbar style
      act(() => {
        intersectionObserverCallback?.([{ isIntersecting: false }]);
      });
      expect(headerElement.className).toContain("bg-[var(--nav-bg)]");
      expect(headerElement.className).toContain("border-[var(--border-card)]");
    });
  });

  describe("Reduced motion styling", () => {
    it("applies motion-reduce:transition-none to header and hero elements", () => {
      renderHeader({
        surface: {
          mode: "banner-top",
          wallpaperUrl: "https://example.com/banner.jpg",
          fallbackToPresetSurface: false,
        },
      });

      const header = screen.getByRole("banner");
      const hero = screen.getByTestId("public-profile-hero");

      expect(header.className).toContain("motion-reduce:transition-none");
      expect(hero.className).toContain("motion-reduce:transition-none");
    });
  });

  describe("Full-wallpaper-image surface mode", () => {
    it("renders full-wallpaper-image mode with cardless identity block and top nav", () => {
      renderHeader({
        surface: {
          mode: "full-wallpaper-image",
          wallpaperUrl: "https://example.com/wallpaper.jpg",
          fallbackToPresetSurface: false,
        },
      });

      const hero = screen.getByTestId("public-profile-hero");
      expect(hero).toHaveAttribute("data-wallpaper-mode", "full-wallpaper-image");
      expect(screen.queryByTestId("profile-metadata-card")).not.toBeInTheDocument();
      expect(screen.getByRole("banner")).toBeInTheDocument();
      expect(screen.getByText("Jane Explorer")).toBeInTheDocument();
    });
  });

  describe("Media state machine & fallbacks", () => {
    it("falls back banner media once when primary fails, then hides image on secondary failure", async () => {
      renderHeader({
        surface: {
          mode: "banner-top",
          wallpaperUrl: "https://example.com/broken-banner.jpg",
          fallbackToPresetSurface: false,
        },
      });

      let wallpaperImg = screen.getByTestId("wallpaper-image");
      expect(wallpaperImg).toHaveAttribute("src", "https://example.com/broken-banner.jpg");

      // First failure -> tries fallback image
      fireEvent.error(wallpaperImg);

      await waitFor(() => {
        const updatedImg = screen.getByTestId("wallpaper-image");
        expect(updatedImg).not.toHaveAttribute("src", "https://example.com/broken-banner.jpg");
      });

      // Second failure on fallback image -> hides wallpaper media completely
      const fallbackImg = screen.getByTestId("wallpaper-image");
      fireEvent.error(fallbackImg);

      await waitFor(() => {
        expect(screen.queryByTestId("wallpaper-image")).toBeNull();
      });
    });

    it("falls back avatar once when primary avatar fails", async () => {
      renderHeader({ avatarUrl: "https://example.com/broken-avatar.jpg" });

      const avatarContainer = screen.getByTestId("profile-avatar");
      const avatarImg = avatarContainer.querySelector("img");
      expect(avatarImg).toHaveAttribute("src", "https://example.com/broken-avatar.jpg");

      fireEvent.error(avatarImg!);

      await waitFor(() => {
        const fallbackImg = avatarContainer.querySelector("img");
        expect(fallbackImg).not.toBeNull();
        expect(fallbackImg).not.toHaveAttribute("src", "https://example.com/broken-avatar.jpg");
      });
    });

    it("resets failure state when surface wallpaperUrl changes (generation keying)", async () => {
      const { rerender } = render(
        <BrowserRouter>
          <PublicProfileHeader
            {...fixtureProps}
            surface={{
              mode: "banner-top",
              wallpaperUrl: "https://example.com/broken1.jpg",
              fallbackToPresetSurface: false,
            }}
          />
        </BrowserRouter>,
      );

      const hero = screen.getByTestId("public-profile-hero");
      const img1 = hero.querySelector("img");
      fireEvent.error(img1!);

      // Change surface URL to new URL
      rerender(
        <BrowserRouter>
          <PublicProfileHeader
            {...fixtureProps}
            surface={{
              mode: "banner-top",
              wallpaperUrl: "https://example.com/valid2.jpg",
              fallbackToPresetSurface: false,
            }}
          />
        </BrowserRouter>,
      );

      const newImg = hero.querySelector("img");
      expect(newImg).toHaveAttribute("src", "https://example.com/valid2.jpg");
    });
  });

  describe("Share button behavior", () => {
    it("calls onShare when provided", async () => {
      const user = userEvent.setup();
      const onShare = vi.fn();
      renderHeader({ onShare });

      const shareBtn = screen.getByRole("button", { name: "Share" });
      await user.click(shareBtn);
      expect(onShare).toHaveBeenCalledTimes(1);
    });
  });
});
