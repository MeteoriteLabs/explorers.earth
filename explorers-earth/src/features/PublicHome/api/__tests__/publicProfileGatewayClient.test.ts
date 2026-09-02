import { describe, expect, it, vi } from "vitest";
import { createPublicProfileGatewayClient } from "../publicProfileGatewayClient";

describe("public profile gateway client", () => {
  it("encodes usernames and uses the versioned category endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ lists: [] }), { status: 200 }));
    const client = createPublicProfileGatewayClient("https://localtunes.example", fetchImpl);
    await client.category("tk 2727", "apps");
    expect(fetchImpl).toHaveBeenCalledWith("https://localtunes.example/api/explorers/v1/profiles/tk%202727/recommendations/apps", expect.objectContaining({ headers: { Accept: "application/json" } }));
  });

  it("loads the public shell without an authorization header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ username: "tk2727" }), { status: 200 }));
    const client = createPublicProfileGatewayClient("https://localtunes.example", fetchImpl);
    await client.shell("tk2727");
    expect(fetchImpl).toHaveBeenCalledWith("https://localtunes.example/api/explorers/v1/profiles/tk2727", { headers: { Accept: "application/json" }, signal: undefined });
  });

  it("uses a cached ETag and returns its cached body for a 304 response", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ appLists: [] }), { status: 200, headers: { ETag: '"apps-v1"' } }))
      .mockResolvedValueOnce(new Response(null, { status: 304 }));
    const client = createPublicProfileGatewayClient("https://localtunes.example", fetchImpl);
    await client.category("tk2727", "apps");
    await expect(client.category("tk2727", "apps")).resolves.toEqual({ appLists: [] });
    expect(fetchImpl.mock.calls[1][1].headers).toEqual({ Accept: "application/json", "If-None-Match": '"apps-v1"' });
  });

  it("asks the gateway to bypass its cache for creator revalidation", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ username: "tk2727" }), { status: 200 }));
    const client = createPublicProfileGatewayClient("https://localtunes.example", fetchImpl);
    await client.shell("tk2727", undefined, true);
    expect(fetchImpl.mock.calls[0][1].headers).toEqual({ Accept: "application/json", "Cache-Control": "no-cache" });
  });

  it("does not parse an uncacheable 304 response as JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 304 }));
    const client = createPublicProfileGatewayClient("https://localtunes.example", fetchImpl);
    await expect(client.shell("tk2727")).rejects.toThrow("PUBLIC_PROFILE_304");
  });

  it("uses the safe category detail endpoint for a public list slug", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ appLists: [] }), { status: 200 }));
    const client = createPublicProfileGatewayClient("https://localtunes.example", fetchImpl);
    await client.detail("tk2727", "apps", "useful-apps");
    expect(fetchImpl).toHaveBeenCalledWith("https://localtunes.example/api/explorers/v1/profiles/tk2727/recommendations/apps/useful-apps", expect.any(Object));
  });
});
