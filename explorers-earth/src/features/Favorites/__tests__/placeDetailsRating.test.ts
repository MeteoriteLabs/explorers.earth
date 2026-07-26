import { describe, it, expect } from "vitest";
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
