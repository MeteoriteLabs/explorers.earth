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
      expect.objectContaining({ method: "POST", path: "/api/auth/sync", ownerSource: "request.body.strapiUser", classification: "owner-handler-review-required" }),
      expect.objectContaining({ method: "POST", path: "/api/music/identity/ensure", ownerSource: "authoritative-strapi-user+selected-account", classification: "strapi-identity-boundary" }),
      expect.objectContaining({ method: "GET", path: "/api/playlist/:guestUrl", classification: "public", ownerSource: "path.guestUrl" }),
      expect.objectContaining({ method: "POST", path: "/graphql", classification: "service-token-proxy" }),
      expect.objectContaining({ method: "GET", path: "/api/admin/team", classification: "admin-handler-review-required", ownerSource: "authenticated-admin-principal" }),
    ]));
    expect(inventory.routes.filter((route) => route.policy === "none").every((route) => route.classification !== "public")).toBe(true);
    expect(inventory.events).toEqual(expect.arrayContaining([expect.objectContaining({ direction: "receive", event: "player_state" })]));
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
