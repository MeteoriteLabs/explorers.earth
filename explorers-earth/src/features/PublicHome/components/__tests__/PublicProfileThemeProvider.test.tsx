import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicProfileThemeProvider from "../PublicProfileThemeProvider";

const profile = vi.hoisted(() => ({ account: {
  Account_Name: "Alice", username: "alice", profile_picture: { url: "https://images.example/avatar.jpg" }, Primary_Address: { address: "Goa" }, bg_picture: { url: "https://images.example/hero.jpg" } as { url: string } | null,
  social_media: { theme_settings: { preset: "midnight", wallpaperMode: "banner-top" } },
} }));
vi.mock("../../../music/PublicMusicAvailabilityProvider", () => ({
  usePublicMusicAvailability: () => profile,
}));

describe("PublicProfileThemeProvider", () => {
  beforeEach(() => {
    profile.account.bg_picture = { url: "https://images.example/hero.jpg" };
    profile.account.social_media.theme_settings.wallpaperMode = "banner-top";
  });
  it("provides shared branded header, banner hero, and footer around friendly content", () => {
    render(<MemoryRouter initialEntries={["/alice/music"]}><PublicProfileThemeProvider><h1>Music</h1></PublicProfileThemeProvider></MemoryRouter>);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Cover" })).toHaveAttribute("src", "https://images.example/hero.jpg");
    expect(screen.getByRole("img", { name: "Alice profile photo" })).toHaveAttribute("src", "https://images.example/avatar.jpg");
    expect(screen.getByRole("heading", { name: "Alice" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Explorers.Earth" })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.queryAllByRole("main")).toHaveLength(0);
  });

  it("uses the same safe fallback hero when imagery is absent", () => {
    profile.account.bg_picture = null;
    render(<MemoryRouter initialEntries={["/alice/music"]}><PublicProfileThemeProvider><h1>Music</h1></PublicProfileThemeProvider></MemoryRouter>);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Cover" })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("uses one continuous wallpaper without duplicating a banner hero", () => {
    profile.account.social_media.theme_settings.wallpaperMode = "full-wallpaper-image";
    const view = render(<MemoryRouter initialEntries={["/alice/music"]}><PublicProfileThemeProvider><h1>Music</h1></PublicProfileThemeProvider></MemoryRouter>);
    expect(screen.queryByRole("img", { name: "Cover" })).not.toBeInTheDocument();
    expect(view.container.querySelector("[data-profile-wallpaper] img")).toHaveAttribute("src", "https://images.example/hero.jpg");
  });
});
