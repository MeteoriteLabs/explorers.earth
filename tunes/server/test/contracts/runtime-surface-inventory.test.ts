import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inventoryRuntimeSurfaces } from "../../../scripts/inventory-runtime-surfaces.ts";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");

describe("runtime route/event/job inventory", () => {
  it("generates classifications and ownership for registered surfaces", () => {
    // Production break caught: an authorization migration misses a route,
    // Socket event, or scheduled lifecycle job that was hand-summarized only.
    const inventory = inventoryRuntimeSurfaces(repositoryRoot);
    expect(inventory.routes).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: "POST", path: "/api/auth/sync", ownerSource: "request.body.strapiUser", policy: "none" }),
      expect.objectContaining({ method: "GET", path: "/api/playlist/:guestUrl", classification: "public", ownerSource: "path.guestUrl" }),
      expect.objectContaining({ method: "POST", path: "/graphql", classification: "service-token-proxy" }),
    ]));
    expect(inventory.events).toEqual(expect.arrayContaining([expect.objectContaining({ direction: "receive", event: "player_state" })]));
    expect(inventory.jobs).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "setInterval", lifecycle: "reactivation-token-cleanup" })]));
  });

  it("matches the committed generated matrix", () => {
    const generated = inventoryRuntimeSurfaces(repositoryRoot);
    const committed = JSON.parse(readFileSync(resolve(repositoryRoot, "docs/architecture/music-runtime-surface-inventory.json"), "utf8"));
    expect(generated).toEqual(committed);
  });
});
