import { describe, expect, it, vi } from "vitest";
import { createMusicWorkspaceClient } from "../musicWorkspaceClient";
import { MusicClientError } from "../../../lib/localTunesApiClient";

describe("canonical Music workspace client", () => {
  it("uses only owner-derived canonical routes and exact DTO bodies", async () => {
    const request = vi.fn(async (input: { path: string }) => input.path === "/api/playlists"
      ? new Response("[]", { status: 200 })
      : input.path === "/api/music/dashboard"
        ? new Response(JSON.stringify({ songs: [], playedSongs: [], currentlyPlaying: null, publication: { mode: "private", publicSlug: "public-slug" } }), { status: 200 })
        : input.path === "/api/music/entitlement"
          ? new Response(JSON.stringify({ state: "included", coreRead: true, coreMutation: true, paidMutation: false, maxAgeSeconds: 600 }), { status: 200 })
          : input.path === "/api/music/publication"
            ? new Response(JSON.stringify({
              version: "music-publication/v1",
              publication: { mode: (input as { body?: { mode?: string } }).body?.mode, publicSlug: "public-slug" },
            }), { status: 200 })
          : (input.path === "/api/playlists" || input.path === "/api/playlists/7")
            ? new Response(JSON.stringify({ id: 7, name: "Road songs", description: null, isVisibleToGuests: false, songs: [] }), { status: 200 })
            : new Response(null, { status: 204 }));
    const client = createMusicWorkspaceClient(request);
    await client.load();
    await client.createPlaylist("Road songs", "For later", "create-playlist-1");
    await client.renamePlaylist(7, "Renamed", null, "rename-playlist-1");
    await client.setPlaylistVisibility(7, true, "visibility-playlist-1");
    await client.reorderPlaylistSong(7, 9, 2, "reorder-playlist-1");
    await client.setPublication("public", "publication-mode-1");
    await client.setPublication("private", "publication-mode-2");

    expect(request.mock.calls).toEqual([
      [{ method: "GET", path: "/api/playlists" }],
      [{ method: "GET", path: "/api/music/dashboard" }],
      [{ method: "GET", path: "/api/music/entitlement" }],
      [{ method: "POST", path: "/api/playlists", body: { name: "Road songs", description: "For later" }, idempotencyKey: "create-playlist-1" }],
      [{ method: "PATCH", path: "/api/playlists/7", body: { name: "Renamed", description: null }, idempotencyKey: "rename-playlist-1" }],
      [{ method: "PATCH", path: "/api/playlists/7/visibility", body: { isVisibleToGuests: true }, idempotencyKey: "visibility-playlist-1" }],
      [{ method: "PATCH", path: "/api/playlists/7/reorder", body: { songId: 9, position: 2 }, idempotencyKey: "reorder-playlist-1" }],
      [{ method: "POST", path: "/api/music/publication", body: { mode: "public" }, idempotencyKey: "publication-mode-1" }],
      [{ method: "POST", path: "/api/music/publication", body: { mode: "private" }, idempotencyKey: "publication-mode-2" }],
    ]);
    expect(JSON.stringify(request.mock.calls)).not.toMatch(/username|email|ownerId|accountId|documentId|X-Username/i);
  });

  it("changes to unlisted with one atomic owner-derived command and returns only the new in-memory capability", async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      version: "music-publication/v1", publication: { mode: "unlisted", publicSlug: "public-slug" }, capability: "A".repeat(43),
    }), { status: 200 }));
    const client = createMusicWorkspaceClient(request);
    await expect(client.setPublication("unlisted", "unlisted-mode-1")).resolves.toEqual({
      version: "music-publication/v1",
      publication: { mode: "unlisted", publicSlug: "public-slug" },
      capability: "A".repeat(43),
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({
      method: "POST", path: "/api/music/publication", body: { mode: "unlisted" }, idempotencyKey: "unlisted-mode-1",
    });
  });

  it.each([
    ["unlisted", { version: "music-publication/v1", publication: { mode: "unlisted", publicSlug: "public-slug" } }],
    ["unlisted", { version: "music-publication/v1", publication: { mode: "public", publicSlug: "public-slug" }, capability: "A".repeat(43) }],
    ["unlisted", { version: "music-publication/v1", publication: { mode: "unlisted", publicSlug: "public-slug" }, capability: "A".repeat(43), extra: true }],
    ["public", { version: "music-publication/v1", publication: { mode: "public", publicSlug: "public-slug" }, capability: "A".repeat(43) }],
    ["private", { version: "music-publication/v1", publication: { mode: "private", publicSlug: null } }],
    ["private", { version: "music-publication/v1", publication: { mode: "private", publicSlug: "short" } }],
  ] as const)("rejects a successful but non-canonical %s publication response %#", async (mode, body) => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    await expect(createMusicWorkspaceClient(request).setPublication(mode, "publication-contract-1"))
      .rejects.toThrow("Music sharing returned an invalid response.");
  });

  it("deletes an owner playlist through the canonical route", async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await createMusicWorkspaceClient(request).deletePlaylist(11, "delete-playlist-1");
    expect(request).toHaveBeenCalledWith({ method: "DELETE", path: "/api/playlists/11", idempotencyKey: "delete-playlist-1" });
  });

  it("contains unsuccessful JSON and empty responses", async () => {
    const failed = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    const client = createMusicWorkspaceClient(failed);
    await expect(client.createPlaylist("Road songs", null, "create-1")).rejects.toMatchObject({ status: 503, code: "SERVICE_UNAVAILABLE" });
    await expect(client.deletePlaylist(11, "delete-1")).rejects.toMatchObject({ status: 503, code: "SERVICE_UNAVAILABLE" });
  });

  it("preserves the canonical status, upstream code, retryability, and retry delay from failed workspace responses", async () => {
    const failed = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      version: "music-error/v1",
      error: { code: "IDENTITY_SUSPENDED", message: "sensitive", retryable: false, requestId: "request-1" },
    }), { status: 403, headers: { "content-type": "application/json", "retry-after": "19" } }));

    const error = await createMusicWorkspaceClient(failed).load().catch((cause) => cause);
    expect(error).toBeInstanceOf(MusicClientError);
    expect(error).toMatchObject({ status: 403, upstreamCode: "IDENTITY_SUSPENDED", retryable: false, retryAfterSeconds: 19 });
    expect(error.message).not.toContain("sensitive");
  });

  it.each([
    {
      status: 401,
      body: JSON.stringify({ error: { code: "AUTH_INVALID", retryable: true } }),
      retryAfter: "7",
      expected: { code: "AUTH_REQUIRED", upstreamCode: "AUTH_INVALID", retryable: true, retryAfterSeconds: 7 },
      message: "Music authorization is required.",
    },
    {
      status: 400,
      body: JSON.stringify({ error: { code: 42, retryable: "yes" } }),
      retryAfter: "0",
      expected: { code: "REQUEST_INVALID", upstreamCode: undefined, retryable: false, retryAfterSeconds: undefined },
      message: "Music is temporarily unavailable.",
    },
    {
      status: 409,
      body: "not-json",
      retryAfter: "invalid",
      expected: { code: "AUTH_UNAVAILABLE", upstreamCode: undefined, retryable: false, retryAfterSeconds: undefined },
      message: "Music is temporarily unavailable.",
    },
    {
      status: 500,
      body: JSON.stringify({}),
      retryAfter: undefined,
      expected: { code: "SERVICE_UNAVAILABLE", upstreamCode: undefined, retryable: false, retryAfterSeconds: undefined },
      message: "Music is temporarily unavailable.",
    },
  ])("contains a $status workspace failure without reflecting its body", async ({ status, body, retryAfter, expected, message }) => {
    const response = new Response(body, {
      status,
      headers: retryAfter === undefined ? undefined : { "retry-after": retryAfter },
    });
    const error = await createMusicWorkspaceClient(vi.fn().mockResolvedValue(response))
      .createPlaylist("Safe", null, "safe-command")
      .catch((cause) => cause);
    expect(error).toBeInstanceOf(MusicClientError);
    expect(error).toMatchObject({ status, ...expected });
    expect(error.message).toBe(message);
    expect(error.message).not.toContain(body);
  });

  it("contains an unsuccessful publication response before parsing any payload", async () => {
    const response = new Response(JSON.stringify({ error: { code: "PUBLICATION_CONFLICT", retryable: true } }), {
      status: 409,
      headers: { "retry-after": "3" },
    });
    await expect(createMusicWorkspaceClient(vi.fn().mockResolvedValue(response))
      .setPublication("public", "publication-failure"))
      .rejects.toMatchObject({
        code: "AUTH_UNAVAILABLE",
        status: 409,
        upstreamCode: "PUBLICATION_CONFLICT",
        retryable: true,
        retryAfterSeconds: 3,
      });
  });

  it.each([
    ["unknown", false],
    ["included", false],
    ["eligible", false],
    ["entitled", true],
    ["revoked", false],
  ] as const)("accepts the exact %s entitlement DTO", async (state, paidMutation) => {
    // Break caught: a supported server state is renamed or discarded before the page can apply the approved policy.
    const request = vi.fn(async (input: { path: string }) => input.path === "/api/playlists"
      ? new Response("[]", { status: 200 })
      : input.path === "/api/music/dashboard"
        ? new Response(JSON.stringify({ songs: [], playedSongs: [], currentlyPlaying: null, publication: { mode: "private", publicSlug: "public-slug" } }), { status: 200 })
        : new Response(JSON.stringify({ state, coreRead: true, coreMutation: true, paidMutation, maxAgeSeconds: 600, ...(paidMutation ? { sourceUpdatedAt: "2026-08-20T17:00:00.000Z" } : {}) }), { status: 200 }));
    await expect(createMusicWorkspaceClient(request).load()).resolves.toMatchObject({
      entitlement: { state, coreRead: true, coreMutation: true, paidMutation, maxAgeSeconds: 600 },
    });
  });

  it.each([
    [{ state: "paused", coreRead: true, coreMutation: true, paidMutation: false, maxAgeSeconds: 600 }, "unsupported state"],
    [{ state: "included", coreRead: true, coreMutation: true, paidMutation: true, maxAgeSeconds: 600 }, "impossible premium grant"],
    [{ state: "revoked", coreRead: true, coreMutation: false, paidMutation: false, maxAgeSeconds: 600 }, "core denial"],
  ])("rejects an %s entitlement DTO (%s)", async (entitlement) => {
    // Break caught: unvalidated successful JSON drives unreachable or contradictory whole-page UX.
    const request = vi.fn(async (input: { path: string }) => input.path === "/api/playlists"
      ? new Response("[]", { status: 200 })
      : input.path === "/api/music/dashboard"
        ? new Response(JSON.stringify({ songs: [], playedSongs: [], currentlyPlaying: null, publication: { mode: "private", publicSlug: "public-slug" } }), { status: 200 })
        : new Response(JSON.stringify(entitlement), { status: 200 }));
    await expect(createMusicWorkspaceClient(request).load()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      status: 502,
    });
  });
});
