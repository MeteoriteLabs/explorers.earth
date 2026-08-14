import type { Pool } from "pg";

const capabilityRole = "music_runtime";
const safeRoleName = /^[a-z_][a-z0-9_]{1,62}$/;
const safePassword = /^[A-Za-z0-9_-]{43,256}$/;

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

export async function assertMusicMigratorAuthority(
  ownerPool: Pick<Pool, "query">,
  input: { runtimeLoginRole: string },
): Promise<void> {
  if (!safeRoleName.test(input.runtimeLoginRole) || input.runtimeLoginRole === capabilityRole) {
    throw new Error("runtime database login is invalid");
  }
  const authority = (await ownerPool.query<{
    current_user: string; rolsuper: boolean; rolcreaterole: boolean;
    can_create_database_objects: boolean; can_create_schema_objects: boolean;
  }>(`SELECT current_user,roles.rolsuper,roles.rolcreaterole,
      has_database_privilege(current_user,current_database(),'CREATE') AS can_create_database_objects,
      has_schema_privilege(current_user,'public','CREATE') AS can_create_schema_objects
    FROM pg_roles roles WHERE roles.rolname=current_user`)).rows[0];
  if (!authority || authority.current_user === input.runtimeLoginRole || authority.current_user === capabilityRole
      || (!authority.rolsuper && !authority.rolcreaterole)
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
  ownerPool: Pick<Pool, "query">,
  input: MusicRuntimeLoginInput,
): Promise<void> {
  validateInput(input);
  await ownerPool.query("SELECT provision_music_runtime_login($1::name,$2::text)", [input.loginRole, input.password]);
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

  const runtime = (await runtimePool.query<{
    current_user: string; can_read_journal: boolean; can_write_journal: boolean;
    can_insert_history: boolean; can_update_history: boolean; can_delete_history: boolean;
    can_provision_login: boolean; owns_authority_object: boolean;
  }>(`SELECT current_user,
      has_table_privilege(current_user,'music_schema_migrations','SELECT') AS can_read_journal,
      has_table_privilege(current_user,'music_schema_migrations','INSERT,UPDATE,DELETE') AS can_write_journal,
      has_table_privilege(current_user,'music_credential_revocation_operations','INSERT') AS can_insert_history,
      has_table_privilege(current_user,'music_credential_revocation_operations','UPDATE') AS can_update_history,
      has_table_privilege(current_user,'music_credential_revocation_operations','DELETE') AS can_delete_history,
      has_function_privilege(current_user,'provision_music_runtime_login(name,text)','EXECUTE') AS can_provision_login,
      EXISTS (SELECT 1 FROM pg_database WHERE datname=current_database() AND datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user))
        OR EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='public' AND nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user))
        OR EXISTS (SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user))
        OR EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owns_authority_object`)).rows[0];
  if (!runtime || runtime.current_user !== input.loginRole || !runtime.can_read_journal || runtime.can_write_journal
      || !runtime.can_insert_history || runtime.can_update_history || runtime.can_delete_history
      || runtime.can_provision_login || runtime.owns_authority_object) {
    throw new Error("runtime database privilege matrix is unsafe");
  }
  for (const statement of [
    "SET session_replication_role='replica'",
    "UPDATE music_credential_revocation_operations SET reason=reason WHERE false",
    "DELETE FROM music_credential_revocation_operations WHERE false",
    "UPDATE music_schema_migrations SET checksum=checksum WHERE false",
    "DELETE FROM music_schema_migrations WHERE false",
    "INSERT INTO music_schema_migrations(id,checksum,schema_checksum) VALUES ('runtime_attestation_probe',repeat('0',64),repeat('0',64))",
    "ALTER TABLE music_credential_revocation_operations DISABLE TRIGGER music_credential_revocation_history_immutability",
    "DROP TRIGGER music_credential_revocation_history_immutability ON music_credential_revocation_operations",
    "CREATE OR REPLACE FUNCTION reject_music_credential_revocation_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN OLD; END $$",
  ]) await requirePrivilegeDenial(runtimePool, statement);
  const finalGraph = await readMusicRuntimeRoleGraph(ownerPool, input.loginRole);
  validateMusicRuntimeRoleGraph(finalGraph);
  if (JSON.stringify(finalGraph) !== JSON.stringify(initialGraph)) {
    throw new Error("runtime database role graph changed during attestation");
  }
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
