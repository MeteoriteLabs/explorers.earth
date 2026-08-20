import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./csrf", () => ({ getCsrfToken: () => "native-csrf" }));
vi.mock("./musicCredential", () => ({
  isMusicOwnerRequest: (url: string) => url.startsWith("/api/playlists") || url.startsWith("/api/playlist/songs") || url === "/api/music/publication",
  musicCredentialForRequest: async () => "c5-token",
  getGuestMusicCapability: vi.fn(() => "S".repeat(43)),
  clearGuestMusicCapability: vi.fn(),
}));

import { apiRequest, getQueryFn } from "./queryClient";
import { clearGuestMusicCapability, getGuestMusicCapability } from "./musicCredential";

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

  it("sends the one-command publication idempotency header without leaking it into the body", async () => {
    await apiRequest("POST", "/api/music/publication", { mode: "unlisted" }, 0, 3, {
      "Idempotency-Key": "publication-command-1",
    });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({ mode: "unlisted" });
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer c5-token");
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("publication-command-1");
  });

  it("retains the native CSRF body contract outside Music owner routes", async () => {
    await apiRequest("POST", "/api/login", { username: "native" });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({ username: "native", _csrf: "native-csrf" });
  });

  it("clears a rejected slug capability and waits for the visible import flow instead of prompting or retrying", async () => {
    vi.stubGlobal("window", { location: { pathname: "/playlist/unlisted" } });
    vi.mocked(getGuestMusicCapability).mockReturnValueOnce("S".repeat(43));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("{}", { status: 404 })));
    const query = getQueryFn<{ songs: unknown[] }>({ on401: "throw" });
    await expect(query({ queryKey: ["/api/playlist/unlisted"] } as never)).rejects.toMatchObject({ status: 404 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).get("X-Music-Guest-Capability")).toBe("S".repeat(43));
    expect(clearGuestMusicCapability).toHaveBeenCalledWith("unlisted");
  });
});
