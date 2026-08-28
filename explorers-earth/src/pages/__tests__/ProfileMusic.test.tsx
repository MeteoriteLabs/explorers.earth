import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfileMusic from "../public/ProfileMusic";

const load = vi.hoisted(() => vi.fn());
const retry = vi.hoisted(() => vi.fn());
const subscribe = vi.hoisted(() => vi.fn(() => ({ unsubscribe: vi.fn() })));
const availability = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const trackMusic = vi.hoisted(() => vi.fn());
vi.mock("../../components/SEO", () => ({ default: () => null }));
vi.mock("../../features/music/publicMusicClient", async (importOriginal) => ({
  ...(await importOriginal<object>()), publicMusicClient: { load },
}));
vi.mock("../../features/music/PublicMusicAvailabilityProvider", () => ({
  usePublicMusicAvailability: () => availability.current,
}));
vi.mock("../../features/music/publicMusicAnalytics", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  usePublicMusicProductAnalytics: (input: unknown) => { trackMusic(input); return trackMusic; },
}));
vi.mock("../../features/music/publicMusicLiveClient", () => ({ subscribeToPublicMusic: subscribe }));

const emptyResource = {
  version: "music-public-resource/v1", revision: 3, user: { username: "Alice", venueName: null },
  permissions: { allowSongRequests: false, allowGuestPlayOnDevice: false, allowPlaylistSharing: false, allowRecentlyPlayedVisibility: false, allowQueueVisibility: false },
  currentlyPlaying: null,
  queue: { items: [], total: 0, truncated: false },
  recentlyPlayed: { items: [], total: 0, truncated: false },
  playlists: { items: [], total: 0, truncated: false },
};

describe("ProfileMusic", () => {
  beforeEach(() => {
    load.mockReset(); retry.mockReset(); subscribe.mockClear(); trackMusic.mockClear();
    availability.current = {
      state: "available", account: { documentId: "account-friendly-1" },
      descriptor: { version: "music-public-descriptor/v1", publication: { mode: "public", publicSlug: "stable-public-slug", revision: 3 } }, retry,
    };
  });

  it.each(["not-public", "unavailable"] as const)("attributes friendly %s acknowledgement through account authority", async (state) => {
    availability.current = { state, account: { documentId: "account-friendly-1" }, retry };
    render(<MemoryRouter initialEntries={["/alice/music"]}><Routes>
      <Route path=":username" element={<Outlet />}><Route path="music" element={<ProfileMusic />} /></Route>
    </Routes></MemoryRouter>);
    await screen.findByRole("heading", { name: state === "not-public" ? "Music page unavailable" : "Music is temporarily unavailable." });
    expect(trackMusic).toHaveBeenCalledWith({ accountDocumentId: "account-friendly-1", route: "friendly" });
    expect(trackMusic).toHaveBeenCalledWith({ name: "unavailable", reason: state === "not-public" ? "not_public" : "service_unavailable" }, expect.any(String));
  });

  it("loads by descriptor slug and settles profile-shell readiness exactly once", async () => {
    load.mockResolvedValue(emptyResource);
    const settle = vi.fn();
    render(<MemoryRouter initialEntries={["/alice/music"]}><Routes>
      <Route path=":username" element={<Outlet context={{ setIsPageLoaded: settle }} />}>
        <Route path="music" element={<ProfileMusic />} />
      </Route>
    </Routes></MemoryRouter>);

    await screen.findByRole("heading", { name: "Music" });
    expect(load).toHaveBeenCalledWith("stable-public-slug", undefined, expect.any(AbortSignal));
    await waitFor(() => expect(settle).toHaveBeenCalledTimes(1));
    expect(settle).toHaveBeenCalledWith(true);
  });

  it("uses the shared live controller for canonical updates and revocation cleanup", async () => {
    // Break caught: friendly Music remains a one-shot fetch while direct share updates live.
    load.mockResolvedValueOnce(emptyResource).mockResolvedValueOnce({ ...emptyResource, revision: 4 });
    render(<MemoryRouter initialEntries={["/alice/music"]}><Routes>
      <Route path=":username" element={<Outlet />}><Route path="music" element={<ProfileMusic />} /></Route>
    </Routes></MemoryRouter>);
    await waitFor(() => expect(subscribe).toHaveBeenCalledOnce());
    expect(subscribe.mock.calls[0][0]).toMatchObject({ publicSlug: "stable-public-slug", initialRevision: 3 });
    const result = await subscribe.mock.calls[0][0].onInvalidate(new AbortController().signal);
    expect(result.revision).toBe(4);
    result.apply();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    subscribe.mock.calls[0][0].onError(new (await import("../../features/music/publicMusicClient")).PublicMusicError("PUBLIC_NOT_FOUND"));
    await screen.findByRole("heading", { name: "Music page unavailable" });
  });

  it("retains the ready friendly resource through transient and rate-limited live failures", async () => {
    load.mockResolvedValue(emptyResource);
    render(<MemoryRouter initialEntries={["/alice/music"]}><Routes>
      <Route path=":username" element={<Outlet />}><Route path="music" element={<ProfileMusic />} /></Route>
    </Routes></MemoryRouter>);
    await screen.findByRole("heading", { name: "Music" });
    const options = subscribe.mock.calls[0][0];
    options.onError(new (await import("../../features/music/publicMusicClient")).PublicMusicError("PUBLIC_UNAVAILABLE"));
    expect(screen.getByRole("heading", { name: "Music" })).toBeInTheDocument();
    options.onError(new (await import("../../features/music/publicMusicClient")).PublicMusicError("RATE_LIMITED", 90));
    expect(screen.getByRole("heading", { name: "Music" })).toBeInTheDocument();
    expect(subscribe).toHaveBeenCalledTimes(1);
  });
});
