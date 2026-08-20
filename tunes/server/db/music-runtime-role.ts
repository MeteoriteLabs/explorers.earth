import type { Pool } from "pg";

const capabilityRole = "music_runtime";
const safeRoleName = /^[a-z_][a-z0-9_]{1,62}$/;
const safePassword = /^[A-Za-z0-9_-]{43,256}$/;
const expectedRuntimeTables = [
  "activity_logs",
  "analytics_snapshots",
  "api_tokens",
  "email_logs",
  "email_templates",
  "guest_interactions",
  "music_credential_revocation_operations",
  "music_identity_lifecycle_operations",
  "music_identity_tombstones",
  "music_schema_migrations",
  "page_contents",
  "playback_states",
  "played_songs",
  "playlist_songs",
  "playlists",
  "seo_settings",
  "session",
  "songs",
  "system_settings",
  "team_members",
  "user_activity",
  "user_profiles",
  "user_sessions",
  "users",
  "widgets",
  "youtube_api_calls",
  "youtube_api_usage",
  "youtube_music",
  "youtube_music_playlists",
  "youtube_playlists",
  "youtube_tokens",
] as const;
const expectedRuntimeSequences = [
  "activity_logs_id_seq",
  "analytics_snapshots_id_seq",
  "api_tokens_id_seq",
  "email_logs_id_seq",
  "email_templates_id_seq",
  "guest_interactions_id_seq",
  "page_contents_id_seq",
  "playback_states_id_seq",
  "played_songs_id_seq",
  "playlist_songs_id_seq",
  "playlists_id_seq",
  "seo_settings_id_seq",
  "songs_id_seq",
  "system_settings_id_seq",
  "team_members_id_seq",
  "user_activity_id_seq",
  "user_profiles_id_seq",
  "user_sessions_id_seq",
  "users_id_seq",
  "widgets_id_seq",
  "youtube_api_calls_id_seq",
  "youtube_api_usage_id_seq",
  "youtube_music_id_seq",
  "youtube_music_playlists_id_seq",
  "youtube_playlists_id_seq",
  "youtube_tokens_id_seq",
] as const;
const expectedRuntimeFunctions = [
  "enforce_music_identity_immutability()",
  "enforce_music_identity_insert()",
  "enforce_music_lifecycle_operation_state()",
  "enforce_music_tombstone_immutability()",
  "enforce_music_tombstone_insert()",
  "finalize_music_identity_deletion(integer,text,text)",
  "lock_music_identity_pair(text,text)",
  "lock_music_numeric_user_id(integer)",
  "provision_music_runtime_login(name,text)",
  "reject_music_credential_revocation_history_mutation()",
  "reject_unauthorized_music_identity_delete()",
  "retain_music_identity_tombstone_on_delete()",
] as const;

export interface MusicRuntimeLoginInput {
  loginRole: string;
  password: string;
}

interface MusicRoleAttributes {
  canLogin: boolean;
  inherit: boolean;
  superuser: boolean;
  createRole: boolean;
  createDb: boolean;
  replication: boolean;
  bypassRls: boolean;
}

export interface MusicRuntimeRoleGraph {
  loginRole: string;
  loginAttributes?: MusicRoleAttributes;
  capabilityAttributes?: MusicRoleAttributes;
  loginClosure: string[];
  capabilityClosure: string[];
  cycleDetected: boolean;
}

export interface MusicRuntimeDatabaseConnection {
  connectionString: string;
  user: string;
}

export async function verifyMusicRuntimeDatabaseConnection(
  connection: MusicRuntimeDatabaseConnection,
  migratorRole: string,
): Promise<void> {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: connection.connectionString, max: 1 });
  try {
    const initialGraph = await readMusicRuntimeRoleGraph(pool, connection.user);
    validateMusicRuntimeRoleGraph(initialGraph);
    const result = await pool.query<{
      current_user: string;
      can_connect_database: boolean;
      can_create_database_objects: boolean;
      can_create_temporary_objects: boolean;
      can_use_schema: boolean;
      can_create_schema_objects: boolean;
    }>(`SELECT current_user,
        has_database_privilege(current_user,current_database(),'CONNECT') AS can_connect_database,
        has_database_privilege(current_user,current_database(),'CREATE') AS can_create_database_objects,
        has_database_privilege(current_user,current_database(),'TEMP') AS can_create_temporary_objects,
        has_schema_privilege(current_user,'public','USAGE') AS can_use_schema,
        has_schema_privilege(current_user,'public','CREATE') AS can_create_schema_objects`);
    const role = result.rows[0];
    if (!role || role.current_user !== connection.user
        || !role.can_connect_database || role.can_create_database_objects || role.can_create_temporary_objects
        || !role.can_use_schema || role.can_create_schema_objects) {
      throw new Error("runtime database authentication or role attestation failed");
    }
    await assertMusicRuntimeSetRoleBoundary(pool, migratorRole);
    await assertMusicRuntimeDirectPrivilegeBoundary(pool, connection.user);
    const finalGraph = await readMusicRuntimeRoleGraph(pool, connection.user);
    validateMusicRuntimeRoleGraph(finalGraph);
    if (JSON.stringify(finalGraph) !== JSON.stringify(initialGraph)) {
      throw new Error("runtime database authentication or role attestation failed");
    }
  } catch {
    throw new Error("runtime database authentication or role attestation failed");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

export async function assertMusicMigratorAuthority(
  ownerPool: Pick<Pool, "query">,
  input: { runtimeLoginRole: string },
): Promise<void> {
  if (!safeRoleName.test(input.runtimeLoginRole) || input.runtimeLoginRole === capabilityRole) {
    throw new Error("runtime database login is invalid");
  }
  const authority = (await ownerPool.query<{
    current_user: string; rolsuper: boolean; rolcreaterole: boolean;
    owns_database: boolean; can_create_database_objects: boolean; can_create_schema_objects: boolean;
  }>(`SELECT current_user,roles.rolsuper,roles.rolcreaterole,
      database.datdba=roles.oid AS owns_database,
      has_database_privilege(current_user,current_database(),'CREATE') AS can_create_database_objects,
      has_schema_privilege(current_user,'public','CREATE') AS can_create_schema_objects
    FROM pg_roles roles JOIN pg_database database ON database.datname=current_database()
    WHERE roles.rolname=current_user`)).rows[0];
  if (!authority || authority.current_user === input.runtimeLoginRole || authority.current_user === capabilityRole
      || (!authority.rolsuper && !authority.rolcreaterole)
      || (!authority.rolsuper && !authority.owns_database)
      || !authority.can_create_database_objects || !authority.can_create_schema_objects) {
    throw new Error("migration gate database role lacks distinct owner/role-bootstrap authority");
  }
}

export async function assertMusicRuntimeCapabilityPreflight(
  ownerPool: Pick<Pool, "query">,
): Promise<void> {
  const existing = (await ownerPool.query<{
    rolcanlogin: boolean; rolinherit: boolean; rolsuper: boolean; rolcreaterole: boolean;
    rolcreatedb: boolean; rolreplication: boolean; rolbypassrls: boolean; membership_count: number;
  }>(`SELECT role.rolcanlogin,role.rolinherit,role.rolsuper,role.rolcreaterole,
      role.rolcreatedb,role.rolreplication,role.rolbypassrls,
      (SELECT count(*)::int FROM pg_auth_members membership WHERE membership.member=role.oid) AS membership_count
    FROM pg_roles role WHERE role.rolname=$1`, [capabilityRole])).rows[0];
  if (!existing) return;
  if (existing.rolcanlogin || !existing.rolinherit || existing.rolsuper || existing.rolcreaterole
      || existing.rolcreatedb || existing.rolreplication || existing.rolbypassrls
      || existing.membership_count !== 0) {
    throw new Error("runtime capability role has unsafe attributes or membership");
  }
}

export async function readMusicRuntimeRoleGraph(
  pool: Pick<Pool, "query">,
  loginRole: string,
): Promise<MusicRuntimeRoleGraph> {
  if (!safeRoleName.test(loginRole) || loginRole === capabilityRole || loginRole === "postgres") {
    throw new Error("runtime database login is invalid");
  }
  const rows = (await pool.query<{
    source_role: string; rolcanlogin: boolean; rolinherit: boolean; rolsuper: boolean;
    rolcreaterole: boolean; rolcreatedb: boolean; rolreplication: boolean; rolbypassrls: boolean;
    granted_role: string | null; cycle: boolean;
  }>(`WITH RECURSIVE music_role_closure(source_oid,granted_oid,path,cycle) AS (
      SELECT source.oid,membership.roleid,ARRAY[source.oid,membership.roleid],membership.roleid=source.oid
      FROM pg_roles source
      JOIN pg_auth_members membership ON membership.member=source.oid
      WHERE source.rolname IN ($1,$2)
      UNION ALL
      SELECT closure.source_oid,membership.roleid,closure.path||membership.roleid,
        membership.roleid=ANY(closure.path)
      FROM music_role_closure closure
      JOIN pg_auth_members membership ON membership.member=closure.granted_oid
      WHERE NOT closure.cycle
    )
    SELECT source.rolname AS source_role,source.rolcanlogin,source.rolinherit,source.rolsuper,
      source.rolcreaterole,source.rolcreatedb,source.rolreplication,source.rolbypassrls,
      granted.rolname AS granted_role,COALESCE(closure.cycle,false) AS cycle
    FROM pg_roles source
    LEFT JOIN music_role_closure closure ON closure.source_oid=source.oid
    LEFT JOIN pg_roles granted ON granted.oid=closure.granted_oid
    WHERE source.rolname IN ($1,$2)
    ORDER BY source.rolname,granted.rolname`, [loginRole, capabilityRole])).rows;
  const attributes = (role: string): MusicRoleAttributes | undefined => {
    const row = rows.find((candidate) => candidate.source_role === role);
    return row ? {
      canLogin: row.rolcanlogin,
      inherit: row.rolinherit,
      superuser: row.rolsuper,
      createRole: row.rolcreaterole,
      createDb: row.rolcreatedb,
      replication: row.rolreplication,
      bypassRls: row.rolbypassrls,
    } : undefined;
  };
  const closure = (role: string) => Array.from(new Set(rows
    .filter((row) => row.source_role === role && row.granted_role)
    .map((row) => row.granted_role!))).sort();
  return {
    loginRole,
    loginAttributes: attributes(loginRole),
    capabilityAttributes: attributes(capabilityRole),
    loginClosure: closure(loginRole),
    capabilityClosure: closure(capabilityRole),
    cycleDetected: rows.some((row) => row.cycle),
  };
}

export function validateMusicRuntimeRoleGraph(graph: MusicRuntimeRoleGraph): void {
  const safeAttributes = (attributes: MusicRoleAttributes | undefined, canLogin: boolean) => Boolean(attributes
    && attributes.canLogin === canLogin && attributes.inherit
    && !attributes.superuser && !attributes.createRole && !attributes.createDb
    && !attributes.replication && !attributes.bypassRls);
  if (!graph || !safeRoleName.test(graph.loginRole) || graph.loginRole === capabilityRole
      || graph.cycleDetected || !safeAttributes(graph.loginAttributes, true)
      || !safeAttributes(graph.capabilityAttributes, false)
      || graph.loginClosure.length !== 1 || graph.loginClosure[0] !== capabilityRole
      || graph.capabilityClosure.length !== 0) {
    throw new Error("runtime database role graph has unsafe attributes, cycle, or membership");
  }
}

export async function assertMusicRuntimeSetRoleBoundary(
  runtimePool: Pick<Pool, "connect">,
  forbiddenRole: string,
): Promise<void> {
  if (!safeRoleName.test(forbiddenRole) || forbiddenRole === capabilityRole) {
    throw new Error("runtime database role boundary is invalid");
  }
  const client = await runtimePool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE music_runtime");
    const current = (await client.query<{ current_user: string }>("SELECT current_user")).rows[0]?.current_user;
    if (current !== capabilityRole) throw new Error("runtime database SET ROLE boundary failed");
    let denied = false;
    try {
      await client.query("SELECT set_config('role',$1,true)", [forbiddenRole]);
    } catch (error) {
      denied = (error as { code?: unknown }).code === "42501";
    }
    await client.query("ROLLBACK").catch(() => undefined);
    if (!denied) throw new Error("runtime database SET ROLE boundary failed");
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    throw new Error("runtime database SET ROLE boundary failed");
  } finally {
    client.release();
  }
}

export async function provisionMusicRuntimeLogin(
  ownerPool: Pick<Pool, "connect">,
  input: MusicRuntimeLoginInput,
): Promise<void> {
  validateInput(input);
  const client = await ownerPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT provision_music_runtime_login($1::name,$2::text)", [input.loginRole, input.password]);
    const authority = (await client.query<{
      current_user: string;
      current_database: string;
      database_owner: string;
    }>(`SELECT current_user,current_database(),owner.rolname AS database_owner
      FROM pg_database database JOIN pg_roles owner ON owner.oid=database.datdba
      WHERE database.datname=current_database()`)).rows[0];
    if (!authority || !authority.current_user || !authority.current_database || !authority.database_owner) {
      throw new Error("runtime database privilege provisioning failed");
    }
    const database = quoteIdentifier(authority.current_database);
    const migrator = quoteIdentifier(authority.current_user);
    const databaseOwner = quoteIdentifier(authority.database_owner);
    const login = quoteIdentifier(input.loginRole);
    const publicPrincipal = "PUBLIC";

    await client.query(`REVOKE ALL PRIVILEGES ON DATABASE ${database} FROM PUBLIC`);
    await client.query(`REVOKE ALL PRIVILEGES ON DATABASE ${database} FROM ${login}`);
    await client.query(`REVOKE ALL PRIVILEGES ON DATABASE ${database} FROM ${capabilityRole}`);
    await client.query(`GRANT CONNECT ON DATABASE ${database} TO ${capabilityRole}`);
    await client.query(`GRANT CONNECT,CREATE,TEMPORARY ON DATABASE ${database} TO ${databaseOwner}`);
    if (authority.current_user !== authority.database_owner) {
      await client.query(`GRANT CONNECT,CREATE,TEMPORARY ON DATABASE ${database} TO ${migrator}`);
    }

    for (const principal of ["PUBLIC", login, capabilityRole]) {
      await client.query(`REVOKE ALL PRIVILEGES ON SCHEMA public FROM ${principal}`);
      await client.query(`REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ${principal}`);
      await client.query(`REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ${principal}`);
      await client.query(`REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM ${principal}`);
    }
    await client.query(`GRANT USAGE ON SCHEMA public TO ${capabilityRole}`);
    await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${capabilityRole}`);
    await client.query(`GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${capabilityRole}`);
    await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${capabilityRole}`);
    await client.query(`REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER
      ON music_schema_migrations FROM ${capabilityRole}`);
    await client.query(`GRANT SELECT ON music_schema_migrations TO ${capabilityRole}`);
    await client.query(`REVOKE UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER
      ON music_credential_revocation_operations FROM ${capabilityRole}`);
    await client.query(`GRANT SELECT,INSERT ON music_credential_revocation_operations TO ${capabilityRole}`);
    await client.query(`REVOKE ALL PRIVILEGES ON FUNCTION provision_music_runtime_login(name,text) FROM ${capabilityRole}`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM ${publicPrincipal}`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyMusicRuntimeLogin(
  ownerPool: Pick<Pool, "query">,
  runtimePool: Pick<Pool, "query" | "connect">,
  input: Pick<MusicRuntimeLoginInput, "loginRole">,
): Promise<void> {
  if (!safeRoleName.test(input.loginRole) || input.loginRole === capabilityRole || input.loginRole === "postgres") {
    throw new Error("runtime database login is invalid");
  }
  const initialGraph = await readMusicRuntimeRoleGraph(ownerPool, input.loginRole);
  validateMusicRuntimeRoleGraph(initialGraph);
  const ownerRole = (await ownerPool.query<{ current_user: string }>("SELECT current_user")).rows[0]?.current_user;
  if (!ownerRole || !safeRoleName.test(ownerRole) || ownerRole === capabilityRole || ownerRole === input.loginRole) {
    throw new Error("runtime database owner role is invalid");
  }
  await assertMusicRuntimeSetRoleBoundary(runtimePool, ownerRole);
  await assertMusicRuntimeDirectPrivilegeBoundary(runtimePool, input.loginRole);
  const finalGraph = await readMusicRuntimeRoleGraph(ownerPool, input.loginRole);
  validateMusicRuntimeRoleGraph(finalGraph);
  if (JSON.stringify(finalGraph) !== JSON.stringify(initialGraph)) {
    throw new Error("runtime database role graph changed during attestation");
  }
}

async function assertMusicRuntimeDirectPrivilegeBoundary(
  runtimePool: Pick<Pool, "query" | "connect">,
  loginRole: string,
): Promise<void> {
  const runtime = (await runtimePool.query<{
    current_user: string; can_connect_database: boolean; can_create_database_objects: boolean;
    can_create_temporary_objects: boolean; can_use_schema: boolean; can_create_schema_objects: boolean;
    owns_authority_object: boolean;
  }>(`SELECT current_user,
      has_database_privilege(current_user,current_database(),'CONNECT') AS can_connect_database,
      has_database_privilege(current_user,current_database(),'CREATE') AS can_create_database_objects,
      has_database_privilege(current_user,current_database(),'TEMP') AS can_create_temporary_objects,
      has_schema_privilege(current_user,'public','USAGE') AS can_use_schema,
      has_schema_privilege(current_user,'public','CREATE') AS can_create_schema_objects,
      EXISTS (SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user))
        OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='public' AND nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user))
        OR EXISTS (SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user))
        OR EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owns_authority_object`)).rows[0];
  if (!runtime || runtime.current_user !== loginRole || !runtime.can_connect_database
      || runtime.can_create_database_objects || runtime.can_create_temporary_objects
      || !runtime.can_use_schema || runtime.can_create_schema_objects || runtime.owns_authority_object) {
    throw new Error("runtime database privilege matrix is unsafe");
  }
  await assertMusicRuntimeObjectPrivilegeMatrix(runtimePool, loginRole);
  for (const statement of [
    "SET session_replication_role='replica'",
    "CREATE TEMP TABLE music_runtime_temp_attestation(id integer)",
    "CREATE TABLE music_runtime_schema_attestation(id integer)",
    "TRUNCATE TABLE users",
    "UPDATE music_credential_revocation_operations SET reason=reason WHERE false",
    "DELETE FROM music_credential_revocation_operations WHERE false",
    "UPDATE music_schema_migrations SET checksum=checksum WHERE false",
    "DELETE FROM music_schema_migrations WHERE false",
    "INSERT INTO music_schema_migrations(id,checksum,schema_checksum) VALUES ('runtime_attestation_probe',repeat('0',64),repeat('0',64))",
    "ALTER TABLE music_credential_revocation_operations DISABLE TRIGGER music_credential_revocation_history_immutability",
    "DROP TRIGGER music_credential_revocation_history_immutability ON music_credential_revocation_operations",
    "CREATE OR REPLACE FUNCTION reject_music_credential_revocation_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN OLD; END $$",
  ]) await requirePrivilegeDenial(runtimePool, statement);
}

async function assertMusicRuntimeObjectPrivilegeMatrix(
  runtimePool: Pick<Pool, "query">,
  loginRole: string,
): Promise<void> {
  const tableRows = (await runtimePool.query<{
    object_name: string;
    can_select: boolean; can_insert: boolean; can_update: boolean; can_delete: boolean;
    can_truncate: boolean; can_references: boolean; can_trigger: boolean;
  }>(`SELECT class.relname AS object_name,
      has_table_privilege(current_user,class.oid,'SELECT') AS can_select,
      has_table_privilege(current_user,class.oid,'INSERT') AS can_insert,
      has_table_privilege(current_user,class.oid,'UPDATE') AS can_update,
      has_table_privilege(current_user,class.oid,'DELETE') AS can_delete,
      has_table_privilege(current_user,class.oid,'TRUNCATE') AS can_truncate,
      has_table_privilege(current_user,class.oid,'REFERENCES') AS can_references,
      has_table_privilege(current_user,class.oid,'TRIGGER') AS can_trigger
    FROM pg_class class JOIN pg_namespace namespace ON namespace.oid=class.relnamespace
    WHERE namespace.nspname='public' AND class.relkind IN ('r','p','v','m','f')
    ORDER BY class.relname`)).rows;
  if (!sameRuntimeInventory(tableRows.map((row) => row.object_name), expectedRuntimeTables)
      || tableRows.some((row) => {
    const expected = row.object_name === "music_schema_migrations"
      ? [true, false, false, false]
      : row.object_name === "music_credential_revocation_operations"
        ? [true, true, false, false]
        : [true, true, true, true];
    return JSON.stringify([row.can_select,row.can_insert,row.can_update,row.can_delete]) !== JSON.stringify(expected)
      || row.can_truncate || row.can_references || row.can_trigger;
  })) throw new Error("runtime database privilege matrix is unsafe");

  const sequenceRows = (await runtimePool.query<{
    object_name: string; can_usage: boolean; can_select: boolean; can_update: boolean;
  }>(`SELECT class.relname AS object_name,
      has_sequence_privilege(current_user,class.oid,'USAGE') AS can_usage,
      has_sequence_privilege(current_user,class.oid,'SELECT') AS can_select,
      has_sequence_privilege(current_user,class.oid,'UPDATE') AS can_update
    FROM pg_class class JOIN pg_namespace namespace ON namespace.oid=class.relnamespace
    WHERE namespace.nspname='public' AND class.relkind='S'
    ORDER BY class.relname`)).rows;
  if (!sameRuntimeInventory(sequenceRows.map((row) => row.object_name), expectedRuntimeSequences)
      || sequenceRows.some((row) => !row.can_usage || !row.can_select || !row.can_update)) {
    throw new Error("runtime database privilege matrix is unsafe");
  }

  const functionRows = (await runtimePool.query<{
    function_signature: string; can_execute: boolean;
  }>(`SELECT procedure.oid::regprocedure::text AS function_signature,
      has_function_privilege(current_user,procedure.oid,'EXECUTE') AS can_execute
    FROM pg_proc procedure JOIN pg_namespace namespace ON namespace.oid=procedure.pronamespace
    WHERE namespace.nspname='public' ORDER BY procedure.oid::regprocedure::text`)).rows;
  if (!sameRuntimeInventory(functionRows.map((row) => row.function_signature), expectedRuntimeFunctions)
      || functionRows.some((row) => row.can_execute
        !== (row.function_signature !== "provision_music_runtime_login(name,text)"))) {
    throw new Error("runtime database privilege matrix is unsafe");
  }

  const unexpectedSources = Number((await runtimePool.query<{ count: string }>(`WITH principals AS (
      SELECT
        (SELECT oid FROM pg_roles WHERE rolname=$1) AS login_oid,
        (SELECT oid FROM pg_roles WHERE rolname=$2) AS capability_oid
    ), grants AS (
      SELECT acl.grantee,acl.is_grantable FROM pg_database database
        CROSS JOIN LATERAL aclexplode(COALESCE(database.datacl,acldefault('d',database.datdba))) acl
        WHERE database.datname=current_database()
      UNION ALL
      SELECT acl.grantee,acl.is_grantable FROM pg_namespace namespace
        CROSS JOIN LATERAL aclexplode(COALESCE(namespace.nspacl,acldefault('n',namespace.nspowner))) acl
        WHERE namespace.nspname='public'
      UNION ALL
      SELECT acl.grantee,acl.is_grantable FROM pg_class class
        JOIN pg_namespace namespace ON namespace.oid=class.relnamespace
        CROSS JOIN LATERAL aclexplode(COALESCE(class.relacl,
          acldefault(CASE WHEN class.relkind='S' THEN 's'::\"char\" ELSE 'r'::\"char\" END,class.relowner))) acl
        WHERE namespace.nspname='public' AND class.relkind IN ('r','p','v','m','f','S')
      UNION ALL
      SELECT acl.grantee,acl.is_grantable FROM pg_proc procedure
        JOIN pg_namespace namespace ON namespace.oid=procedure.pronamespace
        CROSS JOIN LATERAL aclexplode(COALESCE(procedure.proacl,acldefault('f',procedure.proowner))) acl
        WHERE namespace.nspname='public'
    ) SELECT count(*)::text AS count FROM grants,principals
      WHERE grants.grantee=0 OR grants.grantee=principals.login_oid
        OR (grants.grantee=principals.capability_oid AND grants.is_grantable)`, [loginRole, capabilityRole])).rows[0]?.count ?? "1");
  if (unexpectedSources !== 0) throw new Error("runtime database privilege grant source is unsafe");
}

function sameRuntimeInventory(actual: string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function validateInput(input: MusicRuntimeLoginInput): void {
  if (!safeRoleName.test(input.loginRole) || input.loginRole === capabilityRole || input.loginRole === "postgres") {
    throw new Error("runtime database login is invalid");
  }
  const decoded = Buffer.from(input.password, "base64url");
  if (!safePassword.test(input.password) || decoded.length < 32 || decoded.toString("base64url") !== input.password) {
    throw new Error("runtime database credential is invalid");
  }
}

function quoteIdentifier(value: string): string {
  if (!value || value.length > 63 || value.includes("\0")) throw new Error("runtime database identifier is invalid");
  return `"${value.replaceAll('"', '""')}"`;
}

async function requirePrivilegeDenial(pool: Pick<Pool, "connect">, statement: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    try {
      await client.query(statement);
      await client.query("ROLLBACK");
      throw new Error("runtime database privilege attestation failed");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if ((error as { code?: unknown }).code !== "42501") throw error;
    }
  } finally {
    client.release();
  }
}
