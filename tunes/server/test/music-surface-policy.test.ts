import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  authorizationMatrixFromInventory,
  createGuestCapability,
  decisionForRoute,
  entitlementDecision,
  hashGuestCapability,
  verifyGuestCapability,
} from "../policies/musicSurfacePolicy";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

describe("Music surface authorization policy", () => {
  it.each([
    ["entitled", "2026-08-14T09:50:00.000Z", "2026-08-14T10:00:00.000Z", true],
    ["entitled", "2026-08-14T09:49:59.999Z", "2026-08-14T10:00:00.000Z", false],
    ["included", "2026-08-14T09:59:00.000Z", "2026-08-14T10:00:00.000Z", false],
    ["eligible", "2026-08-14T09:59:00.000Z", "2026-08-14T10:00:00.000Z", false],
    ["revoked", "2026-08-14T09:59:00.000Z", "2026-08-14T10:00:00.000Z", false],
    ["unknown", undefined, "2026-08-14T10:00:00.000Z", false],
    ["entitled", "2026-08-14T10:00:00.001Z", "2026-08-14T10:00:00.000Z", false],
  ] as const)("allows paid mutation only for a fresh entitled server state", (state, updatedAt, now, allowed) => {
    // Break caught: treating unknown/future/older-than-600-second state as paid authority.
    expect(entitlementDecision({ state, sourceUpdatedAt: updatedAt && new Date(updatedAt) }, new Date(now))).toEqual({
      coreRead: true,
      coreMutation: true,
      paidMutation: allowed,
    });
  });

  it("rejects entitlement states outside the canonical database contract", () => {
    // Break caught: a new/typoed repository value silently inherits universal core authority and reaches clients undocumented.
    expect(() => entitlementDecision({ state: "paused" as never }, new Date("2026-08-14T10:00:00.000Z")))
      .toThrow("Unsupported Music entitlement state.");
  });

  it("creates a 256-bit capability and verifies only its SHA-256 hash", () => {
    // Break caught: persisting a plaintext/short capability or accepting a changed capability.
    const capability = createGuestCapability();
    expect(capability).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const hash = hashGuestCapability(capability);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(capability);
    expect(verifyGuestCapability(capability, hash)).toBe(true);
    const differentCapability = `${capability.slice(0, -1)}${capability.endsWith("A") ? "B" : "A"}`;
    expect(verifyGuestCapability(differentCapability, hash)).toBe(false);
    expect(verifyGuestCapability(capability, "0".repeat(64))).toBe(false);
    expect(verifyGuestCapability("short", hash)).toBe(false);
  });

  it("generates one fail-closed role decision for every inventory route and socket event", () => {
    // Break caught: adding a runtime surface without an explicit owner/guest/public/admin/tombstone policy.
    const inventory = JSON.parse(readFileSync(
      resolve(repositoryRoot, "docs/architecture/music-runtime-surface-inventory.json"),
      "utf8",
    ));
    const matrix = authorizationMatrixFromInventory(inventory);
    expect(matrix.routes).toHaveLength(inventory.routes.length);
    expect(matrix.events).toHaveLength(inventory.events.length);
    expect(matrix.routes.every((entry) => entry.decision !== "unclassified")).toBe(true);
    expect(matrix.events.every((entry) => entry.decision !== "unclassified")).toBe(true);
    expect(matrix.routes.filter((entry) => entry.decision === "owner").every((entry) =>
      entry.allowed.owner && !entry.allowed.unauthenticated && !entry.allowed.otherUser && !entry.allowed.nativeSession,
    )).toBe(true);
    expect(matrix.routes.filter((entry) => entry.decision === "admin-tombstone").every((entry) =>
      !entry.allowed.internalAdmin,
    )).toBe(true);
  });

  it.each([
    ["/api/music/identity/ensure", "private", "strapi-identity"],
    ["/api/music/identity/current", "private", "owner"],
    ["/api/playlist/:guestUrl", "private", "guest"],
    ["/api/playlist/:guestUrl/requests", "private", "guest"],
    ["/api/music/guest/request", "tombstone", "tombstone"],
    ["/health/live", "private", "public"],
    ["/new-public", "public", "public"],
    ["/api/admin/users", "private", "admin-tombstone"],
    ["/not-a-route", "admin-tombstone", "admin-tombstone"],
    ["/graphql", "private", "tombstone"],
    ["/api/strapi/graphql", "private", "tombstone"],
    ["/api/strapi/config", "private", "tombstone"],
    ["/api/debug/strapi", "private", "tombstone"],
    ["/api/auth/legacy", "private", "tombstone"],
    ["/api/register", "private", "tombstone"],
    ["/api/connect/google", "private", "tombstone"],
    ["/api", "private", "tombstone"],
    ["/api/login", "private", "native-session"],
    ["/api/logout", "private", "native-session"],
    ["/api/check", "private", "native-session"],
    ["/api/csrf-token", "private", "native-session"],
    ["/api/payments/order", "private", "paid-owner"],
    ["/api/subscriptions/change", "private", "paid-owner"],
    ["/api/gemini/generate", "private", "paid-owner"],
    ["/api/playlist/import-youtube", "private", "paid-owner"],
    ["/api/music/paid/quota", "private", "paid-owner"],
    ["/api/playlists", "private", "owner"],
    ["/api/playlists/4", "private", "owner"],
    ["/api/playlist/", "private", "owner"],
    ["/api/playlist/song", "private", "owner"],
    ["/api/user", "private", "owner"],
    ["/api/user/profile", "private", "owner"],
    ["/api/system-settings/", "private", "owner"],
    ["/api/system-settings/app", "private", "owner"],
    ["/api/youtube/", "private", "owner"],
    ["/api/youtube/search", "private", "owner"],
    ["/api/instagram/", "private", "owner"],
    ["/api/instagram/profile", "private", "owner"],
    ["/apps/", "private", "owner"],
    ["/apps/scrape", "private", "owner"],
    ["/products/", "private", "owner"],
    ["/products/scrape", "private", "owner"],
    ["/people/", "private", "owner"],
    ["/people/scrape", "private", "owner"],
    ["/proxy-image", "private", "owner"],
    ["/proxy-image/file", "private", "owner"],
    ["/api/email/", "private", "owner"],
    ["/api/email/send", "private", "owner"],
    ["/api/seo", "private", "owner"],
    ["/api/seo/settings", "private", "owner"],
    ["/api/music/guest-capability/", "private", "tombstone"],
    ["/api/music/guest-capability/rotate", "private", "tombstone"],
    ["/api/music/publication/", "private", "tombstone"],
    ["/api/music/publication/publish", "private", "tombstone"],
    ["/api/music/publication", "private", "owner"],
    ["/new-authenticated", "authenticated", "owner"],
    ["/unknown", "private", "tombstone"],
  ] as const)("classifies %s without implicit authority", (path, classification, expected) => {
    expect(decisionForRoute({ method: "GET", path, classification })).toBe(expected);
  });

  it("honors explicit tombstones before legacy owner prefixes and recognizes live owner endpoints", () => {
    expect(decisionForRoute({ method: "ALL", path: "/api/user/*", classification: "tombstone" })).toBe("tombstone");
    expect(decisionForRoute({ method: "ALL", path: "/api/playlist/import-*", classification: "tombstone" })).toBe("tombstone");
    expect(decisionForRoute({ method: "GET", path: "/api/music/entitlement", classification: "private" })).toBe("owner");
    expect(decisionForRoute({ method: "GET", path: "/api/music/dashboard", classification: "private" })).toBe("owner");
  });

  it("exercises every socket decision branch with fail-closed role columns", () => {
    const events = [
      { direction: "receive" as const, event: "guest_request", source: "test" },
      { direction: "receive" as const, event: "connection", source: "test" },
      { direction: "receive" as const, event: "disconnect", source: "test" },
      { direction: "emit" as const, event: "queue_changed", source: "test" },
      { direction: "receive" as const, event: "player_state", source: "test" },
      { direction: "receive" as const, event: "unknown", source: "test" },
    ];
    const matrix = authorizationMatrixFromInventory({ routes: [], events });
    expect(matrix.events.map(({ decision }) => decision)).toEqual([
      "guest", "owner-or-guest", "public", "public", "owner", "tombstone",
    ]);
  });
});
