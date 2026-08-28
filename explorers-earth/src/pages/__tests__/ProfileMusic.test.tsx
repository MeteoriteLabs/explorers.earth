import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfileMusic from "../public/ProfileMusic";

const load = vi.hoisted(() => vi.fn());
const retry = vi.hoisted(() => vi.fn());
vi.mock("../../components/SEO", () => ({ default: () => null }));
vi.mock("../../features/music/publicMusicClient", async (importOriginal) => ({
  ...(await importOriginal<object>()), publicMusicClient: { load },
}));
vi.mock("../../features/music/PublicMusicAvailabilityProvider", () => ({
  usePublicMusicAvailability: () => ({
    state: "available",
    descriptor: { version: "music-public-descriptor/v1", publication: { mode: "public", publicSlug: "stable-public-slug", revision: 3 } },
    retry,
  }),
}));

const emptyResource = {
  version: "music-public-resource/v1", revision: 3, user: { username: "Alice", venueName: null },
  permissions: { allowSongRequests: false, allowGuestPlayOnDevice: false, allowPlaylistSharing: false, allowRecentlyPlayedVisibility: false, allowQueueVisibility: false },
  currentlyPlaying: null,
  queue: { items: [], total: 0, truncated: false },
  recentlyPlayed: { items: [], total: 0, truncated: false },
  playlists: { items: [], total: 0, truncated: false },
};

describe("ProfileMusic", () => {
  beforeEach(() => { load.mockReset(); retry.mockReset(); });

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
});
