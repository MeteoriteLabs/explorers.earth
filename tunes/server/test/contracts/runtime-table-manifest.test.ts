import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inventoryRuntimeTables, validateRuntimeTableManifest } from "../../../scripts/inventory-runtime-tables.ts";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");

describe("runtime table manifest", () => {
  it("discovers the real raw-SQL deletion dependencies", () => {
    // Production break caught: clean cutover can omit unmanaged tables that are
    // referenced only by raw SQL in the user deletion transaction.
    const inventory = inventoryRuntimeTables(repositoryRoot);
    expect(inventory.rawSqlTables).toEqual(expect.arrayContaining([
      "youtube_music_playlists",
      "youtube_music",
      "youtube_tokens",
      "youtube_playlists",
      "widgets",
      "youtube_api_calls",
      "playback_states",
    ]));
    expect(inventory.rawSqlTables).not.toContain("skip");
  });

  it("validates the committed manifest against generated repository references", () => {
    const inventory = inventoryRuntimeTables(repositoryRoot);
    const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, "fixtures/db/music-runtime-table-manifest.json"), "utf8"));
    expect(() => validateRuntimeTableManifest({
      manifestTables: manifest.tables.map((entry: { name: string }) => entry.name),
      controlTables: manifest.migrationChain.controlTables,
      referencedTables: inventory.applicationTables,
      migratedTables: inventory.drizzleTables,
      unmanagedTables: manifest.tables.filter((entry: { managedBy: string }) => entry.managedBy === "unmanaged-raw-sql").map((entry: { name: string }) => entry.name),
    })).not.toThrow();
  });
});
