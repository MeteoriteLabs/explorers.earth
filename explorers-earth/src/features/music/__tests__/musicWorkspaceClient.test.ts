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
    await expect(client.setPublication("unlisted", "unlisted-mode-1")).resolves.toEqual({ capability: "A".repeat(43) });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({
      method: "POST", path: "/api/music/publication", body: { mode: "unlisted" }, idempotencyKey: "unlisted-mode-1",
    });
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
});
