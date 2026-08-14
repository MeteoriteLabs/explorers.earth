import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./csrf", () => ({ getCsrfToken: () => "native-csrf" }));
vi.mock("./musicCredential", () => ({
  isMusicOwnerRequest: (url: string) => url.startsWith("/api/playlists") || url.startsWith("/api/playlist/songs"),
  musicCredentialForRequest: async () => "c5-token",
  getGuestMusicCapability: () => "S".repeat(43),
  clearGuestMusicCapability: vi.fn(),
  acquireGuestMusicCapability: () => "G".repeat(43),
}));

import { apiRequest, getQueryFn } from "./queryClient";

describe("apiRequest Music authority serialization", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => null) });
  });

  it("does not mix native CSRF state into a canonical C5 owner body", async () => {
    await apiRequest("POST", "/api/playlists", { name: "owner playlist" });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({ name: "owner playlist" });
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer c5-token");
  });

  it("retains the native CSRF body contract outside Music owner routes", async () => {
    await apiRequest("POST", "/api/login", { username: "native" });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({ username: "native", _csrf: "native-csrf" });
  });

  it("replaces a stale capability and retries an unlisted read without putting either secret in the URL", async () => {
    vi.stubGlobal("window", { location: { pathname: "/playlist/unlisted" } });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ songs: [] }), { status: 200 })));
    const query = getQueryFn<{ songs: unknown[] }>({ on401: "throw" });
    await expect(query({ queryKey: ["/api/playlist/unlisted"] } as never)).resolves.toEqual({ songs: [] });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).get("X-Music-Guest-Capability")).toBe("S".repeat(43));
    expect(new Headers(vi.mocked(fetch).mock.calls[1][1]?.headers).get("X-Music-Guest-Capability")).toBe("G".repeat(43));
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe("/api/playlist/unlisted");
  });
});
