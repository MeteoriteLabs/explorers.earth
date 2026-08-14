import { describe, expect, it } from "vitest";
import {
  matchRetiredMusicSurface,
  normalizeMusicRoutePath,
  RETIRED_MUSIC_ROUTE_RULES,
} from "../policies/musicRetirementPolicy";

describe("executable Music retirement matcher", () => {
  it.each(RETIRED_MUSIC_ROUTE_RULES)("matches the normalized root for $family $path", (rule) => {
    expect(matchRetiredMusicSurface(`${rule.path.toUpperCase()}/?probe=1`)).toEqual(rule);
    if (rule.match === "prefix") expect(matchRetiredMusicSurface(`${rule.path}/child`)).toEqual(rule);
    else expect(matchRetiredMusicSurface(`${rule.path}/child`)).not.toEqual(rule);
  });

  it("normalizes encoded, slash, dot, parent, query, and fragment aliases", () => {
    expect(normalizeMusicRoutePath("\\API//admin/./users/../stats#secret")).toBe("/api/admin/stats");
    expect(normalizeMusicRoutePath("/%61pi/%61dmin?capability=never-read")).toBe("/api/admin");
    expect(normalizeMusicRoutePath("/%E0%A4%A")).toBeUndefined();
    expect(matchRetiredMusicSurface("/%E0%A4%A")).toBeUndefined();
    expect(matchRetiredMusicSurface("/definitely-live")).toBeUndefined();
  });
});
