import { describe, expect, it } from "vitest";
import { createReplatformViteConfig } from "../../../../vite.replatform.config";
import { isAllowedLocalFixtureUrl } from "../../../../e2e/setup/deny-hosted-egress";

describe("replatform local Vite", () => {
  it("routes every API proxy to a loopback fixture", () => {
    const config = createReplatformViteConfig();
    const proxy = config.server?.proxy ?? {};
    expect(Object.keys(proxy)).toEqual(expect.arrayContaining(["/__localtunes", "/api", "/graphql"]));
    for (const entry of Object.values(proxy)) {
      const target = typeof entry === "string" ? entry : entry.target;
      expect(new URL(target).hostname).toBe("127.0.0.1");
    }
    expect((proxy["/__localtunes"] as { target: string }).target).toBe("http://127.0.0.1:51474");
    expect((proxy["/graphql"] as { target: string }).target).toBe("http://127.0.0.1:51474");
  });
  it("allows the platform gateway and Vite origins while denying hosted destinations", () => {
    expect(isAllowedLocalFixtureUrl(new URL("http://127.0.0.1:51474/api/music"))).toBe(true);
    expect(isAllowedLocalFixtureUrl(new URL("http://127.0.0.1:5175/"))).toBe(true);
    expect(isAllowedLocalFixtureUrl(new URL("http://localhost:55173/"))).toBe(true);
    expect(isAllowedLocalFixtureUrl(new URL("https://example.com/api/music"))).toBe(false);
    expect(isAllowedLocalFixtureUrl(new URL("http://127.0.0.1.example.com/"))).toBe(false);
  });
});
