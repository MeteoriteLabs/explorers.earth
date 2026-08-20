import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MusicPageContent } from "../Music";

vi.mock("../../components/SEO", () => ({ default: () => null }));
vi.mock("../../components/MusicDashboard", () => ({ default: () => <div data-testid="music-content" /> }));

const data: any = {
  playlists: [], dashboard: null, entitlement: null, playlist: null, guestUrl: null, localUser: null,
  identityStatus: "setting_up", isLoading: true, error: null, refetch: vi.fn(), retryIdentity: vi.fn(),
};

describe("Music page state hierarchy", () => {
  it("keeps the stable Music title and exactly one polite inline setup status immediately below it", () => {
    const { container } = render(<MusicPageContent authenticated onboarding="complete" data={data} onAction={vi.fn()} />);
    const title = screen.getByRole("heading", { name: "Music", level: 1 });
    expect(title.nextElementSibling).toBe(screen.getByRole("status"));
    expect(screen.getByRole("status")).toHaveTextContent("Setting up Music…");
    expect(container.querySelectorAll("[role='status'], [role='alert']")).toHaveLength(1);
  });

  it("renders a terminal conflict once with Get help and no contradictory content", () => {
    render(<MusicPageContent authenticated onboarding="complete" data={{ ...data, identityStatus: "conflict", isLoading: false }} onAction={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn’t finish setting up Music for this account.");
    expect(screen.getByRole("button", { name: "Get help" })).toBeInTheDocument();
    expect(screen.queryByTestId("music-content")).not.toBeInTheDocument();
  });

  it("does not let an unfetched entitlement mask a retryable identity failure", () => {
    render(<MusicPageContent authenticated onboarding="complete" data={{ ...data, identityStatus: "retryable", isLoading: false }} onAction={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Music is taking longer than expected. Your Explorers account is ready.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("renders healthy content silently and preserves read-only capability", () => {
    const ready = {
      ...data,
      identityStatus: "ready",
      isLoading: false,
      dashboard: { songs: [], currentlyPlaying: null, playedSongs: [], publication: { mode: "private", publicSlug: "public-slug" } },
      entitlement: { state: "included", coreRead: true, coreMutation: true, paidMutation: false, maxAgeSeconds: 600 },
    };
    const { container } = render(<MusicPageContent authenticated onboarding="complete" data={ready} onAction={vi.fn()} />);
    expect(screen.getByTestId("music-content")).toBeInTheDocument();
    expect(container.querySelector("[role='status'], [role='alert']")).toBeNull();
  });
});
