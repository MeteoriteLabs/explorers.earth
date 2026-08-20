import { afterEach, describe, expect, it, vi } from "vitest";
import { createPublicMusicClient } from "../publicMusicClient";

describe("public Music client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads a public slug without owner authority or browser persistence", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ songs: [], playlists: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetcher);
    const localGet = vi.spyOn(localStorage, "getItem");
    const sessionGet = vi.spyOn(sessionStorage, "getItem");

    await createPublicMusicClient("https://music.example").load("public_slug-123");

    expect(fetcher).toHaveBeenCalledWith("https://music.example/api/playlist/public_slug-123", {
      headers: { Accept: "application/json" },
    });
    expect(localGet).not.toHaveBeenCalled();
    expect(sessionGet).not.toHaveBeenCalled();
  });

  it("keeps an unlisted capability out of the URL and sends no owner credential", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ songs: [], playlists: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);

    await createPublicMusicClient("https://music.example/").load("public_slug-123", "a".repeat(43));

    expect(fetcher).toHaveBeenCalledWith("https://music.example/api/playlist/public_slug-123", {
      headers: { Accept: "application/json", "X-Music-Guest-Capability": "a".repeat(43) },
    });
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain("Authorization");
  });

  it("normalizes private, missing, and invalid unlisted resources to one public 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 403 })));

    await expect(createPublicMusicClient("https://music.example").load("public_slug-123"))
      .rejects.toMatchObject({ code: "PUBLIC_NOT_FOUND" });
  });

  it.each([403, 404])("normalizes HTTP %s to the same public 404", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));
    await expect(createPublicMusicClient("https://music.example").load("public_slug-123"))
      .rejects.toMatchObject({ code: "PUBLIC_NOT_FOUND" });
  });

  it("rejects malformed slugs before the network and ignores malformed capabilities", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ songs: [], playlists: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const client = createPublicMusicClient("https://music.example");
    await expect(client.load("short")).rejects.toMatchObject({ code: "PUBLIC_NOT_FOUND" });
    await client.load("public_slug-123", "not-a-capability");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("https://music.example/api/playlist/public_slug-123", {
      headers: { Accept: "application/json" },
    });
  });

  it("contains rate limits with parsed or default retry durations", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "retry-after": "17" } }))
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "retry-after": "later" } }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }));
    vi.stubGlobal("fetch", fetcher);
    const client = createPublicMusicClient("https://music.example");
    await expect(client.load("public_slug-123")).rejects.toMatchObject({ code: "RATE_LIMITED", retryAfterSeconds: 17 });
    await expect(client.load("public_slug-123")).rejects.toMatchObject({ code: "RATE_LIMITED", retryAfterSeconds: 60 });
    await expect(client.load("public_slug-123")).rejects.toMatchObject({ code: "RATE_LIMITED", retryAfterSeconds: 60 });
  });

  it("contains other upstream failures and rejects insecure non-local service URLs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(createPublicMusicClient("http://localhost:5174/").load("public_slug-123"))
      .rejects.toMatchObject({ code: "PUBLIC_UNAVAILABLE" });
    expect(() => createPublicMusicClient("http://music.example")).toThrow("must use HTTPS");
  });

  it("keys an acquisition to its caller lifecycle and forwards the AbortSignal to fetch", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ songs: [], playlists: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    await createPublicMusicClient("https://music.example").load("public_slug-123", "a".repeat(43), controller.signal);
    expect(fetcher).toHaveBeenCalledWith("https://music.example/api/playlist/public_slug-123", {
      headers: { Accept: "application/json", "X-Music-Guest-Capability": "a".repeat(43) },
      signal: controller.signal,
    });
  });
});
