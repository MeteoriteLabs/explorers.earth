import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { authorizationMatrixFromInventory } from "../../policies/musicSurfacePolicy";
import { inventoryRuntimeSurfaces } from "../../../scripts/inventory-runtime-surfaces";
import { sanitizeQualificationText } from "../../../scripts/music-qualification";

const root = resolve(import.meta.dirname, "../../../..");

describe("complete C10 REST, GraphQL, and socket security qualification", () => {
  it("gives every discovered surface a fail-closed hostile-role decision", () => {
    const inventory = inventoryRuntimeSurfaces(root);
    const matrix = authorizationMatrixFromInventory(inventory);
    expect(matrix.routes.length).toBeGreaterThanOrEqual(50);
    expect(matrix.events.length).toBeGreaterThanOrEqual(10);
    expect(matrix.jobs.length).toBeGreaterThanOrEqual(11);

    const expectedRoles = [
      "guestInvalid", "guestRevoked", "guestValid", "internalAdmin", "nativeSession", "otherUser",
      "owner", "pendingDeletion", "staleEntitlement", "suspended", "unauthenticated",
    ].sort();
    for (const surface of [...matrix.routes, ...matrix.events, ...matrix.retirementMatchers]) {
      expect(Object.keys(surface.allowed).sort()).toEqual(expectedRoles);
      expect(surface.decision).not.toBe("unclassified");
      expect(surface.allowed.otherUser).toBe(false);
      expect(surface.allowed.suspended).toBe(false);
      expect(surface.allowed.pendingDeletion).toBe(false);
      expect(surface.allowed.internalAdmin).toBe(false);
    }
  });

  it("pins GraphQL retirement, REST ownership, guest capability, and socket authority", () => {
    const matrix = authorizationMatrixFromInventory(inventoryRuntimeSurfaces(root));
    expect(matrix.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: "GET", path: "/api/playlists", decision: "owner" }),
      expect.objectContaining({ method: "POST", path: "/api/music/identity/ensure", decision: "strapi-identity" }),
      expect.objectContaining({ method: "GET", path: "/api/playlist/:guestUrl", decision: "guest" }),
    ]));
    expect(matrix.retirementMatchers).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "/graphql", match: "exact", decision: "tombstone" }),
    ]));
    expect(matrix.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ direction: "receive", event: "connection", decision: "owner-or-guest" }),
      expect.objectContaining({ direction: "receive", event: "guest_request", decision: "guest" }),
      expect.objectContaining({ direction: "receive", event: "player_state", decision: "owner" }),
    ]));
  });

  it("redacts forbidden authority from bounded security evidence", () => {
    const evidence = sanitizeQualificationText(
      "authorization=private Bearer header.payload.signature postgresql://owner:private@localhost/music",
    );
    expect(evidence).not.toContain("private");
    expect(evidence).not.toContain("header.payload.signature");
    expect(evidence).toContain("[REDACTED]");
  });
});
