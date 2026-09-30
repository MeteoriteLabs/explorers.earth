import { describe, expect, it } from "vitest";
import { assertCanonicalPlatformRouteGraph } from "../../config/platform-route-graph";
import { installProfileOptionalMusicIntegrations, musicCompositionPolicy } from "../../config/music-local-composition";

describe("platform fixture route parity", () => {
  it("mounts the same current optional route families in fixture and live mode", () => {
    const mounted = (mode: "fixture" | "live") => {
      const routes: string[] = [];
      assertCanonicalPlatformRouteGraph(mode, undefined);
      installProfileOptionalMusicIntegrations(undefined, {
        nativeAuth: () => routes.push("auth"),
        analyticsPublishing: () => routes.push("analytics"),
        reactivation: () => routes.push("lifecycle"),
      });
      if (musicCompositionPolicy(undefined).canonicalRest) routes.push("music");
      return routes;
    };
    expect(mounted("fixture")).toEqual(["auth", "analytics", "lifecycle", "music"]);
    expect(mounted("live")).toEqual(["auth", "analytics", "lifecycle", "music"]);
  });

  it("rejects the restricted Music profile for fixture platform runtime", () => {
    expect(() => assertCanonicalPlatformRouteGraph("fixture", { kind: "local-music" } as never)).toThrow(/route graph/i);
  });
});
