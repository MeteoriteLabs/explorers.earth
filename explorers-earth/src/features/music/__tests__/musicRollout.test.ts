import { describe, expect, it, vi } from "vitest";
import { createMusicRolloutClient } from "../musicRollout";

const scopeA = { userDocumentId: "user-a", accountDocumentId: "account-a" };
const closed = { ownerWorkspace: false, guestWorkspace: false, playlistImports: false, exposureId: "closed", expiresAt: "2026-08-26T00:01:00.000Z" };

describe("music runtime rollout", () => {
  it("parses the strict runtime exposure and caches it only until its bounded expiry", async () => {
    let now = Date.parse("2026-08-26T00:00:00.000Z");
    const request = vi.fn(async () => new Response(JSON.stringify({ ...closed, ownerWorkspace: true }), { status: 200 }));
    const rollout = createMusicRolloutClient(request, () => now);
    expect((await rollout.get(scopeA)).ownerWorkspace).toBe(true);
    await rollout.get(scopeA);
    expect(request).toHaveBeenCalledTimes(1);
    now += 60_001;
    await rollout.get(scopeA);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("fails malformed and unavailable decisions closed", async () => {
    const malformed = createMusicRolloutClient(async () => new Response(JSON.stringify({ ownerWorkspace: true }), { status: 200 }));
    const unavailable = createMusicRolloutClient(async () => { throw new Error("offline"); });
    expect(await malformed.get(scopeA)).toMatchObject({ ownerWorkspace: false, guestWorkspace: false, playlistImports: false });
    expect(await unavailable.get(scopeA)).toMatchObject({ ownerWorkspace: false, guestWorkspace: false, playlistImports: false });
  });

  it("clears account-scoped decisions during an account switch", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify(closed), { status: 200 }));
    const rollout = createMusicRolloutClient(request);
    await rollout.get(scopeA);
    rollout.clear(scopeA);
    await rollout.get(scopeA);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
