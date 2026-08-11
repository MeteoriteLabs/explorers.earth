import { describe, it, expect } from "vitest";
import { isDisplayableNumber, toDisplayNumber } from "../rating";

describe("isDisplayableNumber", () => {
  it("accepts finite numbers, including 0", () => {
    expect(isDisplayableNumber(0)).toBe(true);
    expect(isDisplayableNumber(8.8)).toBe(true);
    expect(isDisplayableNumber(-1)).toBe(true);
  });

  it("accepts finite numeric strings", () => {
    expect(isDisplayableNumber("8.8")).toBe(true);
    expect(isDisplayableNumber("0")).toBe(true);
  });

  it("rejects nullish, blank and non-numeric strings", () => {
    expect(isDisplayableNumber(null)).toBe(false);
    expect(isDisplayableNumber(undefined)).toBe(false);
    expect(isDisplayableNumber("")).toBe(false);
    expect(isDisplayableNumber("   ")).toBe(false);
    expect(isDisplayableNumber("abc")).toBe(false);
  });

  it("rejects non-finite numbers", () => {
    expect(isDisplayableNumber(NaN)).toBe(false);
    expect(isDisplayableNumber(Infinity)).toBe(false);
  });

  it("rejects types that Number() would silently coerce (booleans, arrays)", () => {
    // Number(true) === 1, Number([8.8]) === 8.8 — these must NOT be displayable.
    expect(isDisplayableNumber(true)).toBe(false);
    expect(isDisplayableNumber(false)).toBe(false);
    expect(isDisplayableNumber([8.8])).toBe(false);
    expect(isDisplayableNumber([])).toBe(false);
    expect(isDisplayableNumber({})).toBe(false);
  });
});

describe("toDisplayNumber", () => {
  it("coerces a displayable value to a number", () => {
    expect(toDisplayNumber("8.8")).toBe(8.8);
    expect(toDisplayNumber(0)).toBe(0);
  });
});
