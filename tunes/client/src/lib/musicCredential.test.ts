import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMusicCredential,
  clearGuestMusicCapability,
  acquireGuestMusicCapability,
  getGuestMusicCapability,
  guestMusicRequest,
  isMusicOwnerRequest,
  musicCredentialForRequest,
  musicPrincipalForRequest,
  setGuestMusicCapability,
} from "./musicCredential";

const validToken = `${"a".repeat(30)}.${"b".repeat(30)}.${"c".repeat(30)}`;
const credentialResponse = () => new Response(JSON.stringify({
  version: "music-identity/v1",
  identity: { musicUserId: 17, status: "active" },
  credential: { token: validToken, expiresAt: Date.now() + 600_000 },
}), { status: 200, headers: { "Content-Type": "application/json" } });

describe("C5 browser credential adapter", () => {
  beforeEach(() => {
    clearMusicCredential();
    vi.stubGlobal("localStorage", { getItem: vi.fn((key: string) => key === "qrtoken" ? "authoritative-explorer-proof" : null) });
    const values = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
    });
  });

  it("uses a bodyless Explorer proof once and returns only the minted Music credential", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      version: "music-identity/v1",
      identity: { musicUserId: 17, status: "active" },
      credential: { token: validToken, expiresAt: Date.now() + 600_000 },
    }), { status: 200, headers: { "Content-Type": "application/json", "X-Request-Id": "c5-client-test" } }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await musicCredentialForRequest();
    const second = await musicCredentialForRequest();
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/music/identity/ensure", expect.objectContaining({
      method: "POST",
      body: undefined,
      headers: { Accept: "application/json", Authorization: "Bearer authoritative-explorer-proof" },
    }));
  });

  it("deduplicates concurrent minting and remints a credential inside its safety window", async () => {
    const fetchMock = vi.fn(async () => {
      await Promise.resolve();
      return credentialResponse();
    });
    vi.stubGlobal("fetch", fetchMock);
    const [first, second] = await Promise.all([musicCredentialForRequest(), musicCredentialForRequest()]);
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await musicCredentialForRequest(Date.now() + 600_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails closed when no authoritative Explorer proof exists", async () => {
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => null) });
    vi.stubGlobal("fetch", vi.fn());
    await expect(musicCredentialForRequest()).rejects.toThrow("Explorer authentication is required");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [401, { error: { message: "authoritative denial" } }, "authoritative denial"],
    [401, {}, "Music authentication failed"],
  ] as const)("fails closed on Music mint HTTP %s", async (status, body, message) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
    await expect(musicCredentialForRequest()).rejects.toThrow(message);
  });

  it.each([
    [{}, "missing version"],
    [{ version: "music-identity/v1", credential: { token: 3, expiresAt: Date.now() + 10_000 } }, "non-string token"],
    [{ version: "music-identity/v1", credential: { token: "a", expiresAt: Date.now() + 10_000 } }, "short token"],
    [{ version: "music-identity/v1", credential: { token: `${"a".repeat(4097)}.b.c`, expiresAt: Date.now() + 10_000 } }, "long token"],
    [{ version: "music-identity/v1", credential: { token: "a".repeat(64), expiresAt: Date.now() + 10_000 } }, "non-JWT token"],
    [{ version: "music-identity/v1", credential: { token: validToken, expiresAt: 1.5 } }, "unsafe expiry"],
    [{ version: "music-identity/v1", credential: { token: validToken, expiresAt: Date.now() - 1 } }, "expired token"],
  ])("rejects an invalid minted credential: %s", async (body) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
    await expect(musicCredentialForRequest()).rejects.toThrow("invalid credential");
  });

  it("resolves the current principal with only the minted C5 credential", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(credentialResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify({
        version: "music-principal/v1",
        identity: { musicUserId: 17, status: "active" },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(musicPrincipalForRequest()).resolves.toEqual({ musicUserId: 17, status: "active" });
    expect(fetchMock).toHaveBeenLastCalledWith("/api/music/identity/current", expect.objectContaining({
      headers: { Accept: "application/json", Authorization: `Bearer ${validToken}` },
    }));
  });

  it.each([
    [403, { error: { message: "lifecycle denied" } }, "lifecycle denied"],
    [200, { version: "wrong", identity: { musicUserId: 17, status: "active" } }, "Music principal resolution failed"],
    [200, { version: "music-principal/v1", identity: { musicUserId: 1.5, status: "active" } }, "Music principal resolution failed"],
    [200, { version: "music-principal/v1", identity: { musicUserId: 0, status: "active" } }, "Music principal resolution failed"],
    [200, { version: "music-principal/v1", identity: { musicUserId: 17, status: "suspended" } }, "Music principal resolution failed"],
  ] as const)("fails closed on invalid principal response %#", async (status, body, message) => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(credentialResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify(body), { status })));
    await expect(musicPrincipalForRequest()).rejects.toThrow(message);
  });

  it.each([
    "/api/music/identity/current?ignored=1",
    "/api/playlists", "/api/playlist/songs/2", "/api/playlist/currently-playing",
    "/api/playlist/history", "/api/playlist/import-youtube", "/api/music/guest-capability/rotate",
    "/api/music/publication/publish", "/api/music/paid/quota", "/api/music/entitlement", "/api/user/profile",
    "/api/system-settings/app", "/api/youtube/search", "/api/instagram/profile",
    "/api/payments/order", "/api/subscriptions/change", "/api/gemini/generate",
    "/api/email/send", "/api/seo#fragment",
  ])("recognizes the C5-only owner route %s", (url) => {
    expect(isMusicOwnerRequest(url)).toBe(true);
  });

  it("does not attach owner authority to public or retired unknown routes", () => {
    expect(isMusicOwnerRequest("/api/playlist/public-slug")).toBe(false);
    expect(isMusicOwnerRequest("/api/unknown")).toBe(false);
  });

  it("sends a guest capability only in the dedicated header, never the URL or body", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const capability = "G".repeat(43);
    await guestMusicRequest(capability, { youtubeId: "yt", title: "t", artist: "a", thumbnailUrl: "https://img" });
    expect(fetchMock).toHaveBeenCalledWith("/api/music/guest/request", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "X-Music-Guest-Capability": capability }),
    }));
    expect(JSON.stringify(fetchMock.mock.calls[0][1]?.body)).not.toContain(capability);
  });

  it("accepts, reads, and clears only an explicit out-of-band guest capability", () => {
    const capability = "C".repeat(43);
    setGuestMusicCapability(capability);
    expect(getGuestMusicCapability()).toBe(capability);
    clearGuestMusicCapability();
    expect(getGuestMusicCapability()).toBeUndefined();
    expect(() => setGuestMusicCapability("public-slug")).toThrow("valid guest capability");
  });

  it("acquires a capability only from an explicit out-of-band browser prompt", () => {
    const capability = "P".repeat(43);
    vi.stubGlobal("prompt", vi.fn(() => capability));
    expect(acquireGuestMusicCapability()).toBe(capability);
    expect(sessionStorage.setItem).toHaveBeenCalledWith("musicGuestCapability", capability);
  });

  it("reuses an already stored capability without prompting", () => {
    const capability = "R".repeat(43);
    setGuestMusicCapability(capability);
    vi.stubGlobal("prompt", vi.fn());
    expect(acquireGuestMusicCapability()).toBe(capability);
    expect(globalThis.prompt).not.toHaveBeenCalled();
  });

  it("does not store an empty or cancelled capability prompt", () => {
    vi.stubGlobal("prompt", vi.fn(() => null));
    expect(acquireGuestMusicCapability()).toBeUndefined();
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
  });

  it("removes malformed stored guest authority", () => {
    vi.mocked(sessionStorage.getItem).mockReturnValueOnce("malformed");
    expect(getGuestMusicCapability()).toBeUndefined();
    expect(sessionStorage.removeItem).toHaveBeenCalledWith("musicGuestCapability");
  });

  it("rejects malformed guest capability before fetch", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(guestMusicRequest("short", { youtubeId: "yt", title: "t", artist: "a", thumbnailUrl: "https://img" }))
      .rejects.toThrow("valid guest capability");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [new Response(JSON.stringify({ error: { message: "guest denied" } }), { status: 403 }), "guest denied"],
    [new Response("{}", { status: 403 }), "Guest Music request failed"],
    [new Response("not-json", { status: 403 }), "Guest Music request failed"],
  ])("fails closed on guest request denial %#", async (denial, message) => {
    vi.stubGlobal("fetch", vi.fn(async () => denial));
    await expect(guestMusicRequest("G".repeat(43), { youtubeId: "yt", title: "t", artist: "a", thumbnailUrl: "https://img" }))
      .rejects.toThrow(message);
  });
});
