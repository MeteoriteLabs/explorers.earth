import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toNumberOrNull } from "../hooks/useAddRecommendation";

describe("toNumberOrNull", () => {
  it("keeps finite numbers, including 0", () => {
    expect(toNumberOrNull(4.2)).toBe(4.2);
    expect(toNumberOrNull(0)).toBe(0);
  });

  it("maps undefined/null/empty-string/numeric-string to null (never persist strings)", () => {
    expect(toNumberOrNull(undefined)).toBeNull();
    expect(toNumberOrNull(null)).toBeNull();
    expect(toNumberOrNull("")).toBeNull();
    expect(toNumberOrNull("8.8")).toBeNull();
  });

  it("maps non-finite numbers to null", () => {
    expect(toNumberOrNull(NaN)).toBeNull();
    expect(toNumberOrNull(Infinity)).toBeNull();
  });
});

describe("useAddRecommendation persists Rating/Rating_Count via toNumberOrNull", () => {
  const src = readFileSync(
    join(__dirname, "../hooks/useAddRecommendation.ts"),
    "utf8"
  );

  it("wraps Rating and Rating_Count with toNumberOrNull at both the create and edit sites", () => {
    // Two Place_Details blocks (create + edit), each wrapping rating + count.
    const ratingUses = src.match(/Rating:\s*toNumberOrNull\(/g) ?? [];
    const countUses = src.match(/Rating_Count:\s*toNumberOrNull\(/g) ?? [];
    expect(ratingUses.length).toBe(2);
    expect(countUses.length).toBe(2);
    // And never falls back to the old string default that caused the crash.
    expect(src).not.toMatch(/Rating:\s*placeDetails\?\.data\?\.rating\s*\|\|\s*""/);
    expect(src).not.toMatch(/Rating_Count:\s*placeDetails\?\.data\?\.userRatingCount\s*\|\|\s*""/);
  });
});
