import { describe, it, expect } from "vitest";
import {
  MAX_NAV_SLOTS,
  getVisibleNavTabIds,
  resolveAutoPinning,
  normalizePinnedTabs,
  computePinnedNavTabIds,
} from "../navPinning";

const ZERO_COUNTS: Record<string, number> = {};

describe("getVisibleNavTabIds", () => {
  it("applies PublicNav per-category defaults for a fresh (null) account", () => {
    const visible = getVisibleNavTabIds(null);
    // profile always, places + games default visible, music default hidden, rest hidden
    expect([...visible].sort()).toEqual(
      ["public_games", "public_profile", "public_recommendations"].sort()
    );
  });

  it('respects explicit "Yes"/"No" over defaults', () => {
    const visible = getVisibleNavTabIds({
      public_recommendations: "No", // override default-true
      public_games: "No", // override default-true
      public_music: "Yes", // override default-false
      public_movie: "Yes",
    });
    expect(visible.has("public_recommendations")).toBe(false);
    expect(visible.has("public_games")).toBe(false);
    expect(visible.has("public_music")).toBe(true);
    expect(visible.has("public_movie")).toBe(true);
    expect(visible.has("public_profile")).toBe(true);
  });
});

describe("resolveAutoPinning", () => {
  it("defaults to true when unset", () => {
    expect(resolveAutoPinning(null)).toBe(true);
    expect(resolveAutoPinning({})).toBe(true);
    expect(resolveAutoPinning({ auto_pinning: null })).toBe(true);
  });
  it("honors an explicit false", () => {
    expect(resolveAutoPinning({ auto_pinning: false })).toBe(false);
  });
});

describe("normalizePinnedTabs", () => {
  it("falls back to just the profile tab for a fresh account (not a 5-item default)", () => {
    // This is the core of the data-corruption blocker: the old code fabricated
    // a 5-item list here, which blocked pinning and persisted phantom pins.
    expect(normalizePinnedTabs(null)).toEqual(["public_profile"]);
    expect(normalizePinnedTabs({ pinned_nav_tabs: null })).toEqual(["public_profile"]);
  });
  it("prepends public_profile when the stored array omits it", () => {
    expect(normalizePinnedTabs({ pinned_nav_tabs: ["public_movie"] })).toEqual([
      "public_profile",
      "public_movie",
    ]);
  });
  it("leaves an array that already includes public_profile as-is", () => {
    expect(
      normalizePinnedTabs({ pinned_nav_tabs: ["public_profile", "public_books"] })
    ).toEqual(["public_profile", "public_books"]);
  });
});

describe("computePinnedNavTabIds — auto-pinning mode (default)", () => {
  it("fresh account ranks visible categories by count, profile first, capped at 5", () => {
    const pinned = computePinnedNavTabIds(null, ZERO_COUNTS);
    // fresh visible = profile, places, games; all counts 0 -> NAV_TAB_ORDER tie-break
    expect(pinned).toEqual(["public_profile", "public_recommendations", "public_games"]);
    expect(pinned.length).toBeLessThanOrEqual(MAX_NAV_SLOTS);
  });

  it("ranks by list count descending", () => {
    const account = {
      public_recommendations: "Yes",
      public_movie: "Yes",
      public_books: "Yes",
      public_games: "No", // exclude the default-visible games tab to isolate ranking
    };
    const counts = { public_movie: 10, public_books: 5, public_recommendations: 1 };
    const pinned = computePinnedNavTabIds(account, counts);
    expect(pinned).toEqual([
      "public_profile",
      "public_movie",
      "public_books",
      "public_recommendations",
    ]);
  });

  it("never exceeds 5 slots even with many visible categories", () => {
    const account = {
      public_recommendations: "Yes",
      public_music: "Yes",
      public_guides: "Yes",
      public_movie: "Yes",
      public_books: "Yes",
      public_games: "Yes",
      public_apps: "Yes",
      public_products: "Yes",
      public_people: "Yes",
    };
    const pinned = computePinnedNavTabIds(account, ZERO_COUNTS);
    expect(pinned.length).toBe(MAX_NAV_SLOTS);
    expect(pinned[0]).toBe("public_profile");
  });
});

describe("computePinnedNavTabIds — manual mode", () => {
  const manual = {
    auto_pinning: false,
    pinned_nav_tabs: ["public_profile", "public_movie", "public_books"],
    public_movie: "Yes",
    public_books: "Yes",
  };

  it("returns the manually pinned, currently-visible tabs in pinned order", () => {
    expect(computePinnedNavTabIds(manual, ZERO_COUNTS)).toEqual([
      "public_profile",
      "public_movie",
      "public_books",
    ]);
  });

  it("drops a manually pinned tab that is no longer visible", () => {
    const hiddenBooks = { ...manual, public_books: "No" };
    expect(computePinnedNavTabIds(hiddenBooks, ZERO_COUNTS)).toEqual([
      "public_profile",
      "public_movie",
    ]);
  });

  it("a fresh manual account (empty pins) shows only the profile — pinning is NOT blocked", () => {
    const fresh = { auto_pinning: false, pinned_nav_tabs: null };
    const pinned = computePinnedNavTabIds(fresh, ZERO_COUNTS);
    expect(pinned).toEqual(["public_profile"]);
    // length 1 < MAX_NAV_SLOTS, so a pin action would be allowed (regression guard
    // for the blocker where a fabricated 5-item list falsely tripped the max check)
    expect(pinned.length).toBeLessThan(MAX_NAV_SLOTS);
  });
});
