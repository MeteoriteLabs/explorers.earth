import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertNoUnclassifiedSensitiveSurfaces, inventoryRuntimeSurfaces } from "../../../scripts/inventory-runtime-surfaces.ts";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");

describe("runtime route/event/job inventory", () => {
  it("generates classifications and ownership for registered surfaces", () => {
    // Production break caught: an authorization migration misses a route,
    // Socket event, or scheduled lifecycle job that was hand-summarized only.
    const inventory = inventoryRuntimeSurfaces(repositoryRoot);
    expect(inventory.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: "POST", path: "/api/music/identity/ensure", ownerSource: "authoritative-strapi-user+selected-account", classification: "strapi-identity-boundary" }),
      expect.objectContaining({ method: "GET", path: "/api/music/identity/current", ownerSource: "req.musicPrincipal.musicUserId", classification: "local-music-owner" }),
      expect.objectContaining({ method: "GET", path: "/api/playlists", ownerSource: "req.musicPrincipal.musicUserId", classification: "local-music-owner" }),
      expect.objectContaining({ method: "GET", path: "/api/playlist/:guestUrl", classification: "guest-capability", ownerSource: "hashed-guest-capability-or-explicit-publication" }),
    ]));
    expect(inventory.retiredSurfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ family: "legacy-browser-identity", disposition: "typed-410-boundary" }),
      expect.objectContaining({ family: "graphql-service-proxy", disposition: "typed-410-boundary" }),
      expect.objectContaining({ family: "legacy-admin", disposition: "typed-410-boundary" }),
      expect.objectContaining({ family: "legacy-mixed-auth-owner-handlers", disposition: "canonical-replacement-or-typed-410" }),
    ]));
    expect(inventory.retiredSurfaces.map(({ family }) => family)).toEqual(expect.arrayContaining([
      "request", "queue", "playlist", "settings", "device", "analytics", "subscription",
      "youtube", "playback", "venue", "public", "admin", "payment", "scrape", "instagram", "gemini",
    ]));
    expect(inventory.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: "ALL", path: "/{*musicRetiredPath}", classification: "tombstone", policy: "normalized-executable-retirement-matcher" }),
      expect.objectContaining({ method: "GET", path: "/api/music/entitlement", classification: "local-music-owner" }),
      expect.objectContaining({ method: "GET", path: "/api/music/dashboard", classification: "local-music-owner" }),
    ]));
    expect(inventory.routes.filter((route) => route.method === "ALL")).toHaveLength(1);
    expect(inventory.routes.every((route) => route.line > 0)).toBe(true);
    expect(inventory.routes.filter((route) => route.policy === "none").every((route) => route.classification !== "public")).toBe(true);
    expect(inventory.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "receive", event: "player_state", policy: "sender-event-time-recheck+role-allowlist" }),
      expect.objectContaining({ direction: "emit", event: "player_state", policy: "recipient-lifecycle+capability-recheck-before-delivery" }),
      expect.objectContaining({ direction: "emit", event: "guest_request", policy: "recipient-lifecycle+capability-recheck-before-delivery" }),
    ]));
    expect(inventory.routes.some((route) => [
      "handler-authorization-unknown", "owner-handler-review-required", "admin-handler-review-required", "service-token-proxy",
    ].includes(route.classification))).toBe(false);
    expect(inventory.events.every((event) => event.classification !== "unclassified")).toBe(true);
    expect(inventory.jobs).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "setInterval", lifecycle: "reactivation-token-cleanup" })]));
  });

  it("fails closed on an unclassified admin or owner surface", () => {
    // Production break caught: absent route middleware was called public even
    // when an admin check lived in or was missing from the handler.
    expect(() => assertNoUnclassifiedSensitiveSurfaces([{
      method: "DELETE",
      path: "/api/admin/users/:userId",
      classification: "handler-authorization-unknown",
      ownerSource: "handler-derived-or-none",
      policy: "handler-level-unverified",
      lifecycle: "delete",
      source: "server/example.ts",
      line: 1,
    }])).toThrow("unclassified sensitive surface");
  });

  it("matches the committed generated matrix", () => {
    const generated = inventoryRuntimeSurfaces(repositoryRoot);
    const committed = JSON.parse(readFileSync(resolve(repositoryRoot, "docs/architecture/music-runtime-surface-inventory.json"), "utf8"));
    expect(generated).toEqual(committed);
  });
});
