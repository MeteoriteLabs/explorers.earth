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
});
