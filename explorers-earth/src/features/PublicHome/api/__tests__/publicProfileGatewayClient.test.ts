import { describe, expect, it, vi } from "vitest";
import { createPublicProfileGatewayClient } from "../publicProfileGatewayClient";

describe("public profile gateway client", () => {
  it("encodes usernames and uses the versioned category endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ lists: [] }), { status: 200 }));
    const client = createPublicProfileGatewayClient("https://localtunes.example", fetchImpl);
    await client.category("tk 2727", "apps");
    expect(fetchImpl).toHaveBeenCalledWith("https://localtunes.example/api/explorers/v1/profiles/tk%202727/recommendations/apps", expect.objectContaining({ headers: { Accept: "application/json" } }));
  });
});
