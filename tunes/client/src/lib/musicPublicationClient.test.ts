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

  it("reuses the same in-memory key after an ambiguous lost response and retires it after success", async () => {
    let uuid = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `11111111-2222-4333-8444-${String(++uuid).padStart(12, "0")}` });
    vi.mocked(apiRequest)
      .mockRejectedValueOnce(new TypeError("fetch failed after server commit"))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        version: "music-publication/v1", publication: { mode: "unlisted", publicSlug: "owner-slug" }, capability: "D".repeat(43),
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        version: "music-publication/v1", publication: { mode: "unlisted", publicSlug: "owner-slug" }, capability: "E".repeat(43),
      }), { status: 200 }));

    await expect(requestUnlistedShareCapability()).rejects.toThrow(/fetch failed/);
    await expect(requestUnlistedShareCapability()).resolves.toBe("D".repeat(43));
    await expect(requestUnlistedShareCapability()).resolves.toBe("E".repeat(43));
    const keys = vi.mocked(apiRequest).mock.calls.map((call) => call[5]["Idempotency-Key"]);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
  });

  it.each([
    { version: "wrong", capability: "C".repeat(43) },
    { version: "music-publication/v1", capability: "short" },
    { version: "music-publication/v1" },
  ])("rejects an invalid publication response without returning capability material %#", async (body) => {
    vi.mocked(apiRequest).mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
    await expect(requestUnlistedShareCapability()).rejects.toThrow("Music sharing returned an invalid response.");
  });

  it.each([
    [399, true],
    [401, true],
    [429, true],
    [500, true],
    [409, false],
    [undefined, true],
  ] as const)("%s response status retains the pending key: %s", async (status, retained) => {
    let uuid = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `11111111-2222-4333-8444-${String(++uuid).padStart(12, "0")}` });
    vi.mocked(apiRequest)
      .mockRejectedValueOnce({ status })
      .mockResolvedValueOnce(new Response(JSON.stringify({
        version: "music-publication/v1", capability: "F".repeat(43),
      }), { status: 200 }));
    await requestUnlistedShareCapability().catch(() => undefined);
    await expect(requestUnlistedShareCapability()).resolves.toBe("F".repeat(43));
    const keys = vi.mocked(apiRequest).mock.calls.map((call) => call[5]["Idempotency-Key"]);
    expect(keys[1] === keys[0]).toBe(retained);
  });

  it.each(["offline", null])("retains the pending key for primitive ambiguous failure %#", async (error) => {
    let uuid = 0;
    vi.stubGlobal("crypto", { randomUUID: () => `11111111-2222-4333-8444-${String(++uuid).padStart(12, "0")}` });
    vi.mocked(apiRequest)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        version: "music-publication/v1", capability: "G".repeat(43),
      }), { status: 200 }));
    await requestUnlistedShareCapability().catch(() => undefined);
    await requestUnlistedShareCapability();
    const keys = vi.mocked(apiRequest).mock.calls.map((call) => call[5]["Idempotency-Key"]);
    expect(keys[1]).toBe(keys[0]);
  });
});
