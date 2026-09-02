import { describe, expect, it, vi } from "vitest";
import { StrapiPublicProfileGateway } from "../../publicProfile/strapiPublicProfileGateway";

describe("StrapiPublicProfileGateway", () => {
  it("uses a fixed server-owned query and authorization header", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { appLists: [] } }), { status: 200 }));
    const gateway = new StrapiPublicProfileGateway({ origin: "https://cms.example", token: "server-only-token", fetchImpl });
    await gateway.resolveCategory("tk2727", "apps", 12);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://cms.example/graphql");
    expect(init.headers.authorization).toBe("Bearer server-only-token");
    expect(JSON.parse(init.body)).toMatchObject({ variables: { username: "tk2727", limit: 12 } });
  });
});
