import { describe, expect, it } from "vitest";
import { validateRuntimeTableManifest } from "../../../scripts/inventory-runtime-tables.ts";

describe("runtime table manifest", () => {
  it("rejects a runtime table reference absent from the manifest", () => {
    // Production break caught: a route/storage query can reach a table that a
    // clean migration or cutover manifest never provisions.
    expect(() =>
      validateRuntimeTableManifest({
        manifestTables: ["users"],
        referencedTables: ["users", "playlists"],
        migratedTables: ["users", "playlists"],
      }),
    ).toThrow("playlists is referenced at runtime but missing from the manifest");
  });
});
