import { describe, expect, it, vi } from "vitest";
import { createMusicDevelopmentFetch } from "../musicDevelopmentTransport";

describe("Music development transport", () => {
  it("rewrites only the configured HTTPS Music origin through the same-origin Vite proxy", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const transport = createMusicDevelopmentFetch(fetchImpl, true, "https://localtunes.earth");

    await transport("https://localtunes.earth/api/music/identity/ensure?fresh=1", { method: "POST" });

    expect(fetchImpl).toHaveBeenCalledWith("/__localtunes/api/music/identity/ensure?fresh=1", { method: "POST" });
  });

  it("leaves production requests on their HTTPS origin", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const transport = createMusicDevelopmentFetch(fetchImpl, false, "https://localtunes.earth");

    await transport("https://localtunes.earth/api/music/dashboard");

    expect(fetchImpl).toHaveBeenCalledWith("https://localtunes.earth/api/music/dashboard", undefined);
  });

  it("refuses to proxy a different upstream origin", async () => {
    const transport = createMusicDevelopmentFetch(vi.fn(), true, "https://localtunes.earth");
    await expect(transport("https://unexpected.example/api/music/dashboard")).rejects.toThrow("origin");
  });
});
