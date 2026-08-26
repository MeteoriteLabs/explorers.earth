import { describe, expect, it, vi } from "vitest";
import { createMusicGuestSettingsClient } from "../musicGuestSettingsClient";

const settings = { allowSongRequests: false, allowGuestLocalPlayback: false, allowPlaylistSharing: false, allowRecentlyPlayedVisibility: false };

describe("credential-aware Music guest settings client", () => {
  it("loads and partially updates the canonical owner-derived settings", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify(settings)));
    const client = createMusicGuestSettingsClient(request);
    await expect(client.loadSettings()).resolves.toEqual(settings);
    await expect(client.updateSettings({ allowSongRequests: true }, "settings-change-1")).resolves.toEqual(settings);
    expect(request.mock.calls.map(([input]) => input)).toEqual([
      { method: "GET", path: "/api/music/settings" },
      { method: "PATCH", path: "/api/music/settings", body: { allowSongRequests: true }, idempotencyKey: "settings-change-1" },
    ]);
    expect(JSON.stringify(request.mock.calls)).not.toMatch(/username|email|ownerId|accountId|documentId|musicUserId/i);
  });

  it("contains unsuccessful settings responses", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "UPSTREAM_UNAVAILABLE", retryable: true } }), { status: 503, headers: { "x-request-id": "settings-request" } }));
    await expect(createMusicGuestSettingsClient(request).loadSettings()).rejects.toMatchObject({ status: 503, upstreamCode: "UPSTREAM_UNAVAILABLE", retryable: true, requestId: "settings-request" });
  });
});
