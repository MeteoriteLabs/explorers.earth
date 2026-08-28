import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublicProfileThemeProvider from "../PublicProfileThemeProvider";

const profile = vi.hoisted(() => ({ account: {
  Account_Name: "Alice", bg_picture: { url: "https://images.example/hero.jpg" } as { url: string } | null,
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
    expect(screen.getByRole("img", { name: "Alice profile banner" })).toHaveAttribute("src", "https://images.example/hero.jpg");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.queryAllByRole("main")).toHaveLength(0);
  });

  it("keeps branded chrome without reserving a broken hero when imagery is absent", () => {
    profile.account.bg_picture = null;
    render(<MemoryRouter initialEntries={["/alice/music"]}><PublicProfileThemeProvider><h1>Music</h1></PublicProfileThemeProvider></MemoryRouter>);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /profile banner/ })).not.toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("uses one continuous wallpaper without duplicating a banner hero", () => {
    profile.account.social_media.theme_settings.wallpaperMode = "full-wallpaper-image";
    const view = render(<MemoryRouter initialEntries={["/alice/music"]}><PublicProfileThemeProvider><h1>Music</h1></PublicProfileThemeProvider></MemoryRouter>);
    expect(screen.queryByRole("img", { name: /profile banner/ })).not.toBeInTheDocument();
    expect(view.container.querySelector("[data-public-profile-chrome]")).toHaveStyle({ backgroundImage: "url(https://images.example/hero.jpg)" });
  });
});
