import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./queryClient", () => ({ apiRequest: vi.fn() }));

import { apiRequest } from "./queryClient";
import { requestUnlistedShareCapability } from "./musicPublicationClient";

describe("Music publication client", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-2222-4333-8444-555555555555" });
  });

  it("uses one owner-derived unlisted command with an idempotency key", async () => {
    vi.mocked(apiRequest).mockResolvedValue(new Response(JSON.stringify({
      version: "music-publication/v1",
      publication: { mode: "unlisted", publicSlug: "owner-slug" },
      capability: "C".repeat(43),
    }), { status: 200 }));

    await expect(requestUnlistedShareCapability()).resolves.toBe("C".repeat(43));
    expect(apiRequest).toHaveBeenCalledWith("POST", "/api/music/publication", { mode: "unlisted" }, 0, 3, {
      "Idempotency-Key": "tunes-share-11111111-2222-4333-8444-555555555555",
    });
  });

  it.each([
    { version: "wrong", capability: "C".repeat(43) },
    { version: "music-publication/v1", capability: "short" },
    { version: "music-publication/v1" },
  ])("rejects an invalid publication response without returning capability material %#", async (body) => {
    vi.mocked(apiRequest).mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    await expect(requestUnlistedShareCapability()).rejects.toThrow("Music sharing returned an invalid response.");
  });
});
