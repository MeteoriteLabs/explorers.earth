import type { Pool } from "pg";

const capabilityRole = "music_runtime";
const safeRoleName = /^[a-z_][a-z0-9_]{1,62}$/;
const safePassword = /^[A-Za-z0-9_-]{43,256}$/;

export interface MusicRuntimeLoginInput {
  loginRole: string;
  password: string;
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
  const role = (await ownerPool.query<{
    rolcanlogin: boolean; rolsuper: boolean; rolcreaterole: boolean; rolcreatedb: boolean;
    rolreplication: boolean; rolbypassrls: boolean; memberships: string[];
  }>(`SELECT login.rolcanlogin,login.rolsuper,login.rolcreaterole,login.rolcreatedb,
      login.rolreplication,login.rolbypassrls,
      COALESCE(array_agg(granted.rolname::text ORDER BY granted.rolname::text) FILTER (WHERE granted.rolname IS NOT NULL),'{}'::text[]) AS memberships
    FROM pg_roles login
    LEFT JOIN pg_auth_members membership ON membership.member=login.oid
    LEFT JOIN pg_roles granted ON granted.oid=membership.roleid
    WHERE login.rolname=$1
    GROUP BY login.rolcanlogin,login.rolsuper,login.rolcreaterole,login.rolcreatedb,login.rolreplication,login.rolbypassrls`,
  [input.loginRole])).rows[0];
  if (!role || !role.rolcanlogin || role.rolsuper || role.rolcreaterole || role.rolcreatedb
      || role.rolreplication || role.rolbypassrls
      || role.memberships.length !== 1 || role.memberships[0] !== capabilityRole) {
    throw new Error("runtime database login has unsafe attributes or membership");
  }

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
