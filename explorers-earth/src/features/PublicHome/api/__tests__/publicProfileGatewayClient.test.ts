import { describe, expect, it, vi } from "vitest";
import { createPublicProfileGatewayClient, resolvePublicProfileGatewayOrigin } from "../publicProfileGatewayClient";

describe("public profile gateway client", () => {
  it("uses a dedicated public-profile gateway origin before the Music origin", () => {
    expect(resolvePublicProfileGatewayOrigin({
      VITE_PUBLIC_PROFILE_GATEWAY_URL: "http://127.0.0.1:5001",
      VITE_LOCAL_TUNES_API_URL: "https://music.localhost",
    })).toBe("http://127.0.0.1:5001");
  });

  it("keeps the existing Music origin as the fallback when no dedicated profile gateway is configured", () => {
    expect(resolvePublicProfileGatewayOrigin({ VITE_LOCAL_TUNES_API_URL: "https://music.localhost" })).toBe("https://music.localhost");
  });

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
    expect(fetchImpl).toHaveBeenCalledWith("https://localtunes.example/api/explorers/v1/profiles/tk2727", { cache: "no-cache", headers: { Accept: "application/json" }, signal: undefined });
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

  it("retains a successful category response for warm rendering even when the gateway has no ETag", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ appLists: [] }), { status: 200 }));
    const client = createPublicProfileGatewayClient("https://localtunes.example", fetchImpl);

    await client.category("tk2727", "apps");

    expect(client.peekCategory("tk2727", "apps")).toEqual({ appLists: [] });
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

  it("rejects an HTML fallback from a misrouted gateway instead of treating it as profile JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<!doctype html><html></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }));
    const client = createPublicProfileGatewayClient("https://localtunes.example", fetchImpl);

    await expect(client.shell("tk2727")).rejects.toThrow("PUBLIC_PROFILE_INVALID_RESPONSE");
  });

  it("uses the safe category detail endpoint for a public list slug", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ appLists: [] }), { status: 200 }));
    const client = createPublicProfileGatewayClient("https://localtunes.example", fetchImpl);
    await client.detail("tk2727", "apps", "useful-apps");
    expect(fetchImpl).toHaveBeenCalledWith("https://localtunes.example/api/explorers/v1/profiles/tk2727/recommendations/apps/useful-apps", expect.any(Object));
  });

  it("encodes bounded page requests as gateway query parameters rather than Strapi filters", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ appLists: [] }), { status: 200 }));
    const client = createPublicProfileGatewayClient("https://localtunes.example", fetchImpl);
    await client.detailPage("tk2727", "apps", "useful-apps", { limit: 12, cursor: "o24" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://localtunes.example/api/explorers/v1/profiles/tk2727/recommendations/apps/useful-apps?limit=12&cursor=o24",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it.each(["places", "movies", "books", "games", "guides", "apps", "products", "people"] as const)(
    "routes %s through the versioned gateway instead of a direct CMS endpoint",
    async (category) => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const client = createPublicProfileGatewayClient("https://localtunes.example", fetchImpl);

      await client.category("tk2727", category);

      expect(fetchImpl).toHaveBeenCalledWith(
        `https://localtunes.example/api/explorers/v1/profiles/tk2727/recommendations/${category}`,
        expect.objectContaining({ headers: { Accept: "application/json" } }),
      );
    },
  );
});
