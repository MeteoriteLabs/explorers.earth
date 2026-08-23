import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import {
  DEPLOYABLE_MUSIC_MIGRATION_MARKERS,
  EXPECTED_MUSIC_MIGRATION_ID,
  musicMigrationMarkerRank,
} from "../../../shared/music-migration-contract";
import {
  createMigrationDefinition,
  loadMusicMigrations,
  migrateMusicDatabase,
  validateDisposableDatabaseTarget,
} from "../../db/migrate";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const read = (path: string) => readFileSync(resolve(repositoryRoot, path), "utf8");
const require = createRequire(import.meta.url);
const { load: parseYaml } = require("js-yaml") as { load(source: string): any };

describe("Music migration authority contracts", () => {
  it("retains the append-only database-owned publication clock before durable reactivation and archive authority", () => {
    expect(EXPECTED_MUSIC_MIGRATION_ID).toBe("0015_publication_operation_archive");
    const migration = loadMusicMigrations().find(({ id }) => id === "0013_publication_operation_database_clock");
    expect(migration?.id).toBe("0013_publication_operation_database_clock");
    expect(migration?.sql).toMatch(/CREATE OR REPLACE FUNCTION enforce_music_publication_operation_immutability/i);
    expect(migration?.sql).toMatch(/TG_OP\s*=\s*'INSERT'/i);
    expect(migration?.sql).toMatch(/transaction_timestamp\(\)/i);
    expect(migration?.sql).toMatch(/NEW\.expires_at\s*:=\s*NEW\.completed_at\s*\+\s*interval\s*'24 hours'/i);
    expect(migration?.sql).toMatch(/BEFORE INSERT OR UPDATE OR DELETE/i);
    expect(migration?.sql).not.toMatch(/CREATE TABLE/i);
    expect(migration?.sql).not.toMatch(/capability_(?:plaintext|token|secret)/i);
  });
  it("loads one ordered, contiguous, checksummed forward-only chain", () => {
    const migrations = loadMusicMigrations(resolve(repositoryRoot, "tunes/migrations"));
    expect(migrations.map(({ id }) => id)).toEqual([
      "0001_runtime_baseline",
      "0002_identity_lifecycle",
      "0003_identity_lifecycle_hardening",
      "0004_identity_delete_saga",
      "0005_resource_bound_deletion_history",
      "0006_numeric_identity_lock",
      "0007_identity_provider_snapshot",
      "0008_credential_revocation_operations",
      "0009_credential_revocation_history_immutability",
      "0010_least_privilege_runtime_role",
      "0011_durable_publication_idempotency",
      "0012_publication_replay_expiry_guard",
      "0013_publication_operation_database_clock",
      "0014_durable_reactivation_authority",
      "0015_publication_operation_archive",
    ]);
    expect(EXPECTED_MUSIC_MIGRATION_ID).toBe(migrations.at(-1)?.id);
    expect(migrations.every(({ checksum }) => /^[a-f0-9]{64}$/.test(checksum))).toBe(true);
    expect(() => loadMusicMigrations(resolve(repositoryRoot, "tunes/server/test/fixtures/migrations-missing"))).toThrow();
  });

  it("defines one explicit ordered deployment marker authority", () => {
    expect(DEPLOYABLE_MUSIC_MIGRATION_MARKERS).toEqual([
      "containment-no-schema-change",
      "0002_identity_lifecycle",
      "0003_identity_lifecycle_hardening",
      "0004_identity_delete_saga",
      "0005_resource_bound_deletion_history",
      "0006_numeric_identity_lock",
      "0007_identity_provider_snapshot",
      "0008_credential_revocation_operations",
      "0009_credential_revocation_history_immutability",
      "0010_least_privilege_runtime_role",
      "0011_durable_publication_idempotency",
      "0012_publication_replay_expiry_guard",
      "0013_publication_operation_database_clock",
      "0014_durable_reactivation_authority",
      "0015_publication_operation_archive",
    ]);
    expect(DEPLOYABLE_MUSIC_MIGRATION_MARKERS.map(musicMigrationMarkerRank)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(musicMigrationMarkerRank("9999_unknown")).toBeUndefined();
  });

  it("declares every manifested runtime table and the durable identity tombstone", () => {
    const manifest = JSON.parse(read("fixtures/db/music-runtime-table-manifest.json")) as { tables: Array<{ name: string }> };
    expect(manifest.tables).toHaveLength(28);
    expect((JSON.parse(read("fixtures/db/music-runtime-table-manifest.json")) as { migrationChain: { controlTables: string[] } })
      .migrationChain.controlTables).toContain("music_credential_revocation_operations");
    expect((JSON.parse(read("fixtures/db/music-runtime-table-manifest.json")) as { migrationChain: { controlTables: string[] } })
      .migrationChain.controlTables).toContain("music_publication_operations");
    expect((JSON.parse(read("fixtures/db/music-runtime-table-manifest.json")) as { migrationChain: { controlTables: string[] } })
      .migrationChain.controlTables).toContain("music_publication_operation_archive");
    const sql = loadMusicMigrations(resolve(repositoryRoot, "tunes/migrations")).map((migration) => migration.sql).join("\n");
    for (const { name } of manifest.tables) expect(sql).toMatch(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? \\"?${name}\\"?`, "i"));
    expect(sql).toMatch(/CREATE TABLE music_identity_tombstones/i);
    expect(sql).toContain("strapi_user_document_id");
    expect(sql).toContain("strapi_account_document_id");
    expect(sql).toMatch(/music_identity_(?:tombstones|lifecycle_operations)[\s\S]*music_user_id/i);
    expect(sql).toMatch(/music_user_id[\s\S]*IS DISTINCT FROM[\s\S]*OLD\.music_user_id/i);
    expect(sql).toMatch(/tombstone\.music_user_id\s*=\s*p_user_id/i);
    expect(sql).toContain("guest_capability_hash");
    expect(sql).not.toMatch(/guest_capability(?:_plaintext|_token|_secret)\s+TEXT/i);
    expect(sql).toMatch(/CREATE TABLE music_credential_revocation_operations/i);
    expect(sql).toMatch(/operation_id[\s\S]*music_user_id[\s\S]*strapi_user_document_id[\s\S]*strapi_account_document_id/i);
    expect(sql).toMatch(/reason[\s\S]*expected_session_version[\s\S]*result_session_version[\s\S]*operation_state/i);
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON music_credential_revocation_operations/i);
    expect(sql).toMatch(/credential revocation history is immutable/i);
    expect(sql).toMatch(/publication operation identity is immutable/i);
    expect(sql).toMatch(/CREATE TABLE music_publication_operation_archive/i);
    expect(sql).toMatch(/CREATE (?:OR REPLACE )?FUNCTION music_lookup_publication_operation_archive/i);
    expect(sql).toMatch(/CREATE (?:OR REPLACE )?FUNCTION music_compact_publication_operations/i);
    expect(sql).toMatch(/REVOKE ALL[\s\S]*music_publication_operation_archive[\s\S]*FROM music_runtime/i);
    expect(sql).toMatch(/CREATE TABLE music_reactivation_tokens/i);
    expect(sql).toMatch(/token_hash\s+TEXT\s+PRIMARY KEY/i);
    expect(sql).toMatch(/expires_at\s+TIMESTAMPTZ/i);
    expect(sql).toMatch(/lease_owner\s+UUID/i);
    expect(sql).toMatch(/consumed_at\s+TIMESTAMPTZ/i);
    expect(sql).toMatch(/REVOKE DELETE[\s\S]*music_identity_tombstones[\s\S]*music_reactivation_tokens/i);
    expect(sql).not.toMatch(/music_reactivation_tokens[\s\S]{0,800}\bemail\b/i);
  });

  it("keeps startup schema-free and makes the same-image gate run the real chain", () => {
    const storage = read("tunes/server/storage.ts");
    const packageJson = read("tunes/package.json");
    const compose = read("docker-compose.yml");
    const gate = read("tunes/server/deployment/run-migration-gate.ts");
    expect(storage).toContain("createTableIfMissing: false");
    expect(storage).not.toContain("createTableIfMissing: true");
    expect(packageJson).not.toContain("drizzle-kit push");
    expect(compose).toContain("dist/server/deployment/run-migration-gate.js");
    expect(compose).toContain("dist/server/deployment/run-registration-compat.js");
    expect(compose).toContain("MUSIC_MIGRATION_MARKER:");
    expect(compose).toContain(EXPECTED_MUSIC_MIGRATION_ID);
    expect(gate).toContain("migrateMusicDatabase");
    expect(gate).not.toContain("containment-no-schema-change");
    expect((JSON.parse(packageJson).scripts.build as string)).toContain("server/deployment/run-registration-compat.ts");
  });

  it("has one native registration handler and tombstones it before auth route registration", () => {
    const serverRoot = resolve(repositoryRoot, "tunes/server");
    const productionSources = readdirSync(serverRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && !entry.parentPath.replaceAll("\\", "/").includes("/test"))
      .map((entry) => readFileSync(resolve(entry.parentPath, entry.name), "utf8"))
      .join("\n");
    expect(productionSources.match(/\.post\(\s*["']\/api\/register["']/g)).toHaveLength(1);
    const routeIndex = read("tunes/server/routes/index.ts");
    expect(routeIndex.indexOf("setupNativeSessionContainment(app)")).toBeLessThan(routeIndex.indexOf("setupAuthRoutes(app)"));
    expect(read("tunes/server/security-containment.ts")).toMatch(/req\.method === "POST" && isNativeRegistrationPath\(req\.path\)[\s\S]*LEGACY_IDENTITY_ROUTE_REMOVED/);
    expect(read("tunes/server/registration-route-contract.ts")).toContain("/^\\/[aA][pP][iI]\\/[rR][eE][gG][iI][sS][tT][eE][rR]\\/?$/");
  });

  it("runs the PostgreSQL 15 integration chain in authoritative image CI", () => {
    const workflow = read(".github/workflows/tunes.yml");
    expect(workflow).toMatch(/image:\s*postgres:15-alpine/);
    expect(workflow).toContain("MUSIC_C3_POSTGRES_TEST: \"1\"");
    expect(workflow).toContain("DATABASE_URL_TEST: postgresql://music_migrator:music@127.0.0.1:55432/music_fixture");
    expect(workflow).toContain("npm run test:integration");
  });

  it("permits a loopback-only Strapi host-port override for full fixture rehearsal", () => {
    const compose = read("docker-compose.music-test.yml");
    const smoke = read("tunes/scripts/music-smoke.ts");
    expect(compose).toContain("127.0.0.1:${MUSIC_STRAPI_HOST_PORT:-51337}:1337");
    expect(smoke).toContain('process.env.MUSIC_STRAPI_HOST_PORT ?? "51337"');
    expect(compose).toContain("STRAPI_URL: http://strapi:1337");
  });

  it("builds the disposable Tunes image once and runs migration from that image", () => {
    const compose = parseYaml(read("docker-compose.music-test.yml"));
    expect(compose.services.tunes.image).toBe(compose.services["tunes-migrate"].image);
    expect(compose.services.tunes.build).toBeDefined();
    expect(compose.services["tunes-migrate"].build).toBeUndefined();
    expect(compose.services["tunes-migrate"].command).toEqual([
      "node",
      "dist/server/deployment/run-migration-gate.js",
    ]);
  });

  it("rejects non-fixture, ambient, and unresolved reset/migration targets", () => {
    const valid = {
      databaseUrlTest: "postgresql://music:music@127.0.0.1:55432/music_fixture",
      composeProject: "explorers-music-fixture",
      confirmation: "RESET explorers-music-fixture/music_fixture",
    };
    expect(validateDisposableDatabaseTarget(valid)).toMatchObject({ host: "127.0.0.1", port: 55432, database: "music_fixture" });
    for (const candidate of [
      { ...valid, databaseUrlTest: "postgresql://music:music@db:5432/music_fixture" },
      { ...valid, databaseUrlTest: "postgresql://music:music@127.0.0.1:55432/production" },
      { ...valid, composeProject: "explorers-production" },
      { ...valid, confirmation: "yes" },
      { ...valid, databaseUrl: "postgresql://owner:secret@production.example/music" },
    ]) expect(() => validateDisposableDatabaseTarget(candidate)).toThrow();
  });

  it("computes the checksum from exact bytes, not a caller-supplied value", () => {
    const original = createMigrationDefinition("0003_example", "SELECT 1;\n");
    const modified = createMigrationDefinition("0003_example", "SELECT 2;\n");
    expect(original.checksum).not.toBe(modified.checksum);
  });

  it("rejects any non-production chain before opening a database connection", async () => {
    const production = loadMusicMigrations(resolve(repositoryRoot, "tunes/migrations"));
    const appended = createMigrationDefinition("0016_unapproved", "SELECT 1;\n");
    const connect = vi.fn();
    await expect(migrateMusicDatabase({ connect } as never, { migrations: [...production, appended] }))
      .rejects.toThrow(/exact production migration chain/i);
    expect(connect).not.toHaveBeenCalled();
  });
});
