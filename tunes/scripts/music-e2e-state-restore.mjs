import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dockerExecutable = process.platform === "win32" ? "docker.exe" : "docker";
export const MUSIC_FIXTURE_DATA_DUMP_MAX_BYTES = 128 * 1024 * 1024;
const fixtureContainerLabels = Object.freeze({
  "com.explorers.music.fixture": "true",
  "com.explorers.music.project": "explorers-music-fixture",
  "com.docker.compose.project": "explorers-music-fixture",
  "com.docker.compose.service": "postgres",
  "com.docker.compose.container-number": "1",
  "com.docker.compose.oneoff": "False",
});

function checkedRuntimeInventory() {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(resolve(
      import.meta.dirname, "../../fixtures/db/music-runtime-table-manifest.json",
    ), "utf8"));
  } catch { throw new Error("frozen fixture restore inventory is invalid"); }
  const chain = manifest?.migrationChain;
  const baseTables = Array.isArray(manifest?.tables) ? manifest.tables.map((entry) => entry?.name) : [];
  const controlTables = Array.isArray(chain?.controlTables) ? chain.controlTables : [];
  const files = Array.isArray(chain?.files) ? chain.files : [];
  const validIdentifier = (value) => typeof value === "string" && /^[a-z][a-z0-9_]{0,62}$/.test(value);
  const validMigrationId = (value) => typeof value === "string" && /^\d{4}_[a-z0-9_]+$/.test(value);
  const migrationIds = files.map((file) => (
    typeof file === "string" ? /^(\d{4}_[a-z0-9_]+)\.sql$/.exec(file)?.[1] : undefined
  ));
  if (manifest?.schemaVersion !== "music-runtime-table-manifest/v1"
      || chain?.engine !== "postgresql-15" || !validMigrationId(chain?.expectedId)
      || baseTables.length === 0 || controlTables.length === 0 || migrationIds.length === 0
      || !baseTables.every(validIdentifier) || !controlTables.every(validIdentifier)
      || !migrationIds.every(validMigrationId)
      || new Set(baseTables).size !== baseTables.length
      || new Set(controlTables).size !== controlTables.length
      || new Set(migrationIds).size !== migrationIds.length
      || migrationIds.at(-1) !== chain.expectedId
      || [...migrationIds].sort().join("\0") !== migrationIds.join("\0")) {
    throw new Error("frozen fixture restore inventory is invalid");
  }
  return {
    tables: [...new Set([...baseTables, ...controlTables])].sort(),
    migrationIds,
  };
}

const runtimeInventory = checkedRuntimeInventory();
export const MUSIC_FIXTURE_TABLES = Object.freeze(runtimeInventory.tables);
export const MUSIC_FIXTURE_MIGRATION_IDS = Object.freeze(runtimeInventory.migrationIds);

export const MUSIC_FIXTURE_TRIGGER_FINGERPRINTS = Object.freeze([
  Object.freeze({ table: "account_music_identity", name: "account_music_identity_immutable", enabled: "O", type: 19 }),
  Object.freeze({ table: "auth_session", name: "auth_session_version_before_insert", enabled: "O", type: 7 }),
  Object.freeze({ table: "media_assets", name: "media_asset_reference_guard", enabled: "O", type: 17 }),
  Object.freeze({ table: "music_credential_revocation_operations", name: "music_credential_revocation_history_immutability", enabled: "A", type: 27 }),
  Object.freeze({ table: "music_identity_lifecycle_operations", name: "music_lifecycle_operation_state", enabled: "O", type: 19 }),
  Object.freeze({ table: "music_identity_tombstones", name: "music_identity_tombstone_immutability", enabled: "O", type: 19 }),
  Object.freeze({ table: "music_identity_tombstones", name: "music_identity_tombstone_insert", enabled: "O", type: 7 }),
  Object.freeze({ table: "music_publication_operation_archive", name: "music_publication_operation_archive_immutability", enabled: "A", type: 27 }),
  Object.freeze({ table: "music_publication_operations", name: "music_publication_operation_immutability", enabled: "A", type: 31 }),
  Object.freeze({ table: "music_reactivation_tokens", name: "music_reactivation_token_identity_immutability", enabled: "O", type: 19 }),
  Object.freeze({ table: "profile_feed_items", name: "profile_feed_ready_guard", enabled: "O", type: 21 }),
  Object.freeze({ table: "profile_media", name: "profile_media_ready_guard", enabled: "O", type: 21 }),
  Object.freeze({ table: "users", name: "users_music_identity_immutability", enabled: "O", type: 19 }),
  Object.freeze({ table: "users", name: "users_music_identity_insert", enabled: "O", type: 7 }),
  Object.freeze({ table: "users", name: "users_reject_unauthorized_music_identity_delete", enabled: "O", type: 11 }),
  Object.freeze({ table: "users", name: "users_retain_music_identity_tombstone", enabled: "O", type: 9 }),
]);

const replayTriggers = Object.freeze([
  Object.freeze({ table: "users", name: "users_music_identity_insert", mode: "ENABLE" }),
  Object.freeze({ table: "music_identity_tombstones", name: "music_identity_tombstone_insert", mode: "ENABLE" }),
  Object.freeze({ table: "music_publication_operations", name: "music_publication_operation_immutability", mode: "ENABLE ALWAYS" }),
]);

function exactIdentifier(value) {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_]{0,62}$/.test(value)) {
    throw new Error("frozen fixture restore identifier is invalid");
  }
  return value;
}

function quotedIdentifier(value) {
  return `"${exactIdentifier(value)}"`;
}

function sqlLiteral(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_|:-]{1,256}$/.test(value)) {
    throw new Error("frozen fixture restore literal is invalid");
  }
  return `'${value}'`;
}

function expectedMigrationFingerprint() {
  return MUSIC_FIXTURE_MIGRATION_IDS.map((id) => {
    const sql = readFileSync(resolve(import.meta.dirname, `../migrations/${id}.sql`));
    return `${id}:${createHash("sha256").update(sql).digest("hex")}`;
  });
}

function textArray(values) {
  return `ARRAY[${values.map(sqlLiteral).join(",")}]::text[]`;
}

const expectedTablesSql = textArray(MUSIC_FIXTURE_TABLES);
const expectedTriggersSql = textArray(MUSIC_FIXTURE_TRIGGER_FINGERPRINTS.map(
  ({ table, name, enabled, type }) => `${table}|${name}|${enabled}|${type}`,
));
const expectedMigrationsSql = textArray(expectedMigrationFingerprint());

const authoritySql = `DO $music_restore_authority$
DECLARE
  actual_tables text[];
  actual_triggers text[];
  actual_migrations text[];
BEGIN
  IF current_database() IS DISTINCT FROM 'music_fixture' OR current_user IS DISTINCT FROM 'music_migrator' THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='fixture restore database authority mismatch';
  END IF;
  SELECT array_agg(tablename::text ORDER BY tablename) INTO actual_tables
    FROM pg_catalog.pg_tables WHERE schemaname='public';
  IF actual_tables IS DISTINCT FROM ${expectedTablesSql} THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='fixture restore table authority mismatch';
  END IF;
  SELECT array_agg(format('%s|%s|%s|%s',class.relname,trigger.tgname,trigger.tgenabled,trigger.tgtype) ORDER BY class.relname,trigger.tgname)
    INTO actual_triggers
    FROM pg_catalog.pg_trigger trigger
    JOIN pg_catalog.pg_class class ON class.oid=trigger.tgrelid
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid=class.relnamespace
    WHERE namespace.nspname='public' AND NOT trigger.tgisinternal;
  IF actual_triggers IS DISTINCT FROM ${expectedTriggersSql} THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='fixture restore trigger authority mismatch';
  END IF;
  SELECT array_agg(id || ':' || checksum ORDER BY id) INTO actual_migrations
    FROM public.music_schema_migrations;
  IF actual_migrations IS DISTINCT FROM ${expectedMigrationsSql} THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='fixture restore migration authority mismatch';
  END IF;
END
$music_restore_authority$;`;

export function buildMusicFixtureSchemaInventoryOperation({ containerId } = {}) {
  if (typeof containerId !== "string" || !/^[a-f0-9]{64}$/.test(containerId)) {
    throw new Error("fixture schema inventory authority is invalid");
  }
  return Object.freeze({
    file: dockerExecutable,
    args: Object.freeze([
      "exec", "-i", containerId,
      "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "music_migrator", "-d", "music_fixture",
    ]),
    input: Buffer.from(`${authoritySql}\n`, "utf8"),
  });
}

const disableReplayTriggersSql = replayTriggers.map(
  ({ table, name }) => `ALTER TABLE public.${quotedIdentifier(table)} DISABLE TRIGGER ${exactIdentifier(name)};`,
).join("\n");
const enableReplayTriggersSql = replayTriggers.map(
  ({ table, name, mode }) => `ALTER TABLE public.${quotedIdentifier(table)} ${mode} TRIGGER ${exactIdentifier(name)};`,
).join("\n");
const truncateSql = `TRUNCATE TABLE ${MUSIC_FIXTURE_TABLES.map(
  (table) => `public.${quotedIdentifier(table)}`,
).join(", ")} RESTART IDENTITY CASCADE;`;

export function attestMusicFixtureRestoreContainer(value) {
  const labels = value?.Config?.Labels;
  const bindings = value?.HostConfig?.PortBindings?.["5432/tcp"];
  const mounts = Array.isArray(value?.Mounts)
    ? [...value.Mounts].sort((left, right) => String(left?.Destination).localeCompare(String(right?.Destination)))
    : [];
  const labelAuthority = labels && Object.entries(fixtureContainerLabels)
    .every(([key, expected]) => labels[key] === expected);
  const exactMounts = mounts.length === 2
    && mounts[0]?.Type === "bind" && mounts[0]?.Destination === "/run/secrets/music-db-migrator"
    && mounts[0]?.RW === false
    && mounts[1]?.Type === "volume"
    && mounts[1]?.Name === "explorers-music-fixture_music-fixture-postgres"
    && mounts[1]?.Destination === "/var/lib/postgresql/data" && mounts[1]?.RW === true;
  if (!value || typeof value !== "object" || !/^[a-f0-9]{64}$/.test(value.Id ?? "")
      || value.Name !== "/explorers-music-fixture-postgres-1"
      || value.Config?.Image !== "postgres:15-alpine" || !labelAuthority
      || value.State?.Running !== true || value.State?.Health?.Status !== "healthy"
      || !Array.isArray(bindings) || bindings.length !== 1
      || Object.keys(bindings[0] ?? {}).sort().join("\0") !== ["HostIp", "HostPort"].join("\0")
      || bindings[0]?.HostIp !== "127.0.0.1" || bindings[0]?.HostPort !== "55432"
      || Object.keys(value.HostConfig?.PortBindings ?? {}).length !== 1 || !exactMounts) {
    throw new Error("fixture restore container authority is invalid");
  }
  return Object.freeze({ containerId: value.Id });
}

export function buildMusicFixtureRestoreOperation({ containerId, dataDump }) {
  if (typeof containerId !== "string" || !/^[a-f0-9]{64}$/.test(containerId)
      || !Buffer.isBuffer(dataDump) || dataDump.length === 0
      || dataDump.length > MUSIC_FIXTURE_DATA_DUMP_MAX_BYTES) {
    throw new Error("fixture restore authority is invalid");
  }
  const normalizedDump = dataDump.at(-1) === 0x0a ? dataDump : Buffer.concat([dataDump, Buffer.from("\n")]);
  const input = Buffer.concat([
    Buffer.from(`${authoritySql}\n${disableReplayTriggersSql}\n${truncateSql}\n`),
    normalizedDump,
    Buffer.from(`${enableReplayTriggersSql}\n${authoritySql}\n`),
  ]);
  return {
    file: dockerExecutable,
    args: [
      "exec", "-i", containerId,
      "psql", "-X", "-v", "ON_ERROR_STOP=1", "--single-transaction",
      "-U", "music_migrator", "-d", "music_fixture",
    ],
    input,
  };
}

function exactHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}

export function runMusicFixtureRestoreTransaction({
  containerId,
  dataDump,
  snapshotHash,
  captureHash,
  execute,
}) {
  if (!exactHash(snapshotHash) || typeof captureHash !== "function" || typeof execute !== "function") {
    return { ok: false, stage: "restore-preflight", code: "target-invalid" };
  }
  let beforeAttempt;
  try { beforeAttempt = exactHash(captureHash()); } catch { beforeAttempt = undefined; }
  if (!beforeAttempt) return { ok: false, stage: "restore-preflight", code: "target-invalid" };
  let status = null;
  try {
    const result = execute(buildMusicFixtureRestoreOperation({ containerId, dataDump }));
    status = result?.status;
  } catch { status = null; }
  let afterAttempt;
  try { afterAttempt = exactHash(captureHash()); } catch { afterAttempt = undefined; }
  if (status !== 0) {
    return beforeAttempt === afterAttempt
      ? { ok: false, stage: "database-restore", code: "replay-failed-rolled-back" }
      : { ok: false, stage: "database-restore", code: "rollback-unverified" };
  }
  if (afterAttempt !== snapshotHash) {
    return { ok: false, stage: "verification", code: "restore-mismatch" };
  }
  return { ok: true, beforeHash: snapshotHash, afterHash: afterAttempt };
}
