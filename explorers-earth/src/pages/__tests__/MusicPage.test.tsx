import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createMusicWorkspaceClient } from "../../features/music/musicWorkspaceClient";
import { MusicPageContent } from "../Music";
import * as MusicPageModule from "../Music";

vi.mock("../../components/SEO", () => ({ default: () => null }));
vi.mock("../../components/MusicDashboard", () => ({ default: ({ complete }: { complete?: boolean }) => <div data-testid="music-content" data-complete={complete ? "true" : "false"} /> }));

const data: any = {
  playlists: [], dashboard: null, entitlement: null, playlist: null, guestUrl: null, localUser: null,
  identityStatus: "setting_up", isLoading: true, error: null, refetch: vi.fn(), retryIdentity: vi.fn(),
};

describe("Music page state hierarchy", () => {
  it("keeps the existing minimal workspace unless the runtime owner decision is true", () => {
    const ready = { ...data, identityStatus: "ready", isLoading: false, dashboard: { songs: [], currentlyPlaying: null, playedSongs: [], publication: { mode: "private", publicSlug: "slug" } }, entitlement: { state: "included", coreRead: true, coreMutation: true, paidMutation: false, maxAgeSeconds: 600 } };
    const first = render(<MusicPageContent authenticated onboarding="complete" data={ready} ownerWorkspace={false} onAction={vi.fn()} />);
    expect(screen.getByTestId("music-content")).toHaveAttribute("data-complete", "false");
    first.unmount();
    render(<MusicPageContent authenticated onboarding="complete" data={ready} ownerWorkspace onAction={vi.fn()} />);
    expect(screen.getByTestId("music-content")).toHaveAttribute("data-complete", "true");
  });
  it("treats eligibility errors and partial/cache-and-network results as unknown until authoritative recovery", () => {
    const select = (MusicPageModule as any).onboardingFromEligibility;
    expect(typeof select).toBe("function");
    const complete = { documentId: "account-ready", Account_Name: "Ready", Account_Type: "Personal", mobile_number: "+10000000001" };
    expect(select({ loading: false, error: new Error("network"), data: undefined })).toBe("unknown");
    expect(select({ loading: false, error: new Error("partial"), data: { usersPermissionsUser: { accounts: [{ ...complete, mobile_number: "" }] } } })).toBe("unknown");
    expect(select({ loading: false, error: null, data: { usersPermissionsUser: null } })).toBe("unknown");
    expect(select({ loading: false, error: null, data: { usersPermissionsUser: { accounts: [] } } })).toBe("incomplete");
    expect(select({ loading: false, error: null, data: { usersPermissionsUser: { provider: "local", confirmed: false, accounts: [complete] } } })).toBe("incomplete");
    expect(select({ loading: false, error: null, data: { usersPermissionsUser: { provider: "google", confirmed: false, accounts: [complete] } } })).toBe("complete");
    expect(select({ loading: false, error: null, data: { usersPermissionsUser: { accounts: [complete] } } })).toBe("complete");
  });

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

  it.each(["suspended", "pending_deletion"] as const)("hides cached workspace content after terminal %s authority", (identityStatus) => {
    render(<MusicPageContent
      authenticated
      onboarding="complete"
      data={{
        ...data,
        identityStatus,
        isLoading: false,
        playlists: [{ id: 7, name: "Cached private playlist", description: null, isVisibleToGuests: false, songs: [] }],
        dashboard: { songs: [], currentlyPlaying: null, playedSongs: [], publication: { mode: "private", publicSlug: "public-slug" } },
      }}
      onAction={vi.fn()}
    />);
    expect(screen.queryByText("Cached private playlist")).not.toBeInTheDocument();
    expect(screen.queryByTestId("music-content")).not.toBeInTheDocument();
  });

  it("renders healthy core content silently", () => {
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

  it.each([
    ["unknown", true],
    ["included", false],
    ["eligible", false],
    ["entitled", false],
    ["revoked", false],
  ] as const)("renders server-derived %s without inventing a core denial", async (entitlementState, checking) => {
    // Break caught: eligible/revoked is presented as upgrade/paused/read-only instead of preserving universal core Music.
    const loaded = await createMusicWorkspaceClient(async (input) => input.path === "/api/playlists"
      ? new Response("[]", { status: 200 })
      : input.path === "/api/music/dashboard"
        ? new Response(JSON.stringify({ queueRevision: 0, songs: [], currentlyPlaying: null, playedSongs: [], publication: { mode: "private", publicSlug: "public-slug" } }), { status: 200 })
        : new Response(JSON.stringify({ state: entitlementState, coreRead: true, coreMutation: true, paidMutation: entitlementState === "entitled", maxAgeSeconds: 600, ...(entitlementState === "entitled" ? { sourceUpdatedAt: "2026-08-20T17:00:00.000Z" } : {}) }), { status: 200 })).load();
    const ready = {
      ...data,
      ...loaded,
      identityStatus: "ready",
      isLoading: false,
    };
    const { unmount } = render(<MusicPageContent authenticated onboarding="complete" data={ready} onAction={vi.fn()} />);
    expect(screen.getByTestId("music-content")).toBeInTheDocument();
    if (checking) expect(screen.getByRole("status")).toHaveTextContent("Checking what’s included…");
    else expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(/temporarily paused|isn’t included|Music limit|can’t make changes/i)).not.toBeInTheDocument();
    unmount();
  });
});
