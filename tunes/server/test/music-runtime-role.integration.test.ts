import pg from "pg";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateMusicDatabase } from "../db/migrate";
import { MusicIdentityRepository } from "../repositories/musicIdentityRepository";

const ownerTarget = process.env.DATABASE_URL_TEST ?? "postgresql://music_migrator:music@127.0.0.1:55432/music_fixture";
const enabled = process.env.MUSIC_C5_POSTGRES_TEST === "1";
const describePg = enabled ? describe.sequential : describe.skip;
const databaseName = `music_runtime_role_${process.pid}`;
const runtimeUser = `music_runtime_test_${process.pid}`;
const runtimePassword = Buffer.alloc(32, 0x6d).toString("base64url");
let clusterAdmin: pg.Pool;
let owner: pg.Pool;
let runtime: pg.Pool;

async function loadAuthority(): Promise<Record<string, unknown>> {
  try {
    return await import("../db/music-runtime-role" as string) as Record<string, unknown>;
  } catch {
    return {};
  }
}

describePg("C5 least-privilege Music runtime database authority", () => {
  beforeAll(async () => {
    clusterAdmin = new pg.Pool({ connectionString: ownerTarget });
    await clusterAdmin.query(`CREATE DATABASE ${databaseName}`);
    const target = new URL(ownerTarget);
    target.pathname = `/${databaseName}`;
    owner = new pg.Pool({ connectionString: target.toString(), max: 4 });
    await migrateMusicDatabase(owner);
  });

  afterAll(async () => {
    await runtime?.end();
    await owner?.end();
    await clusterAdmin?.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()", [databaseName]);
    await clusterAdmin?.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await clusterAdmin?.query(`DROP ROLE IF EXISTS ${runtimeUser}`);
    await clusterAdmin?.end();
  });

  it("provisions a distinct restricted login and refuses every owner/migration/history bypass", async () => {
    const authority = await loadAuthority() as {
      assertMusicMigratorAuthority?: (pool: pg.Pool, input: { runtimeLoginRole: string }) => Promise<void>;
      provisionMusicRuntimeLogin?: (pool: pg.Pool, input: { loginRole: string; password: string }) => Promise<void>;
      verifyMusicRuntimeLogin?: (ownerPool: pg.Pool, runtimePool: pg.Pool, input: { loginRole: string }) => Promise<void>;
    };
    expect(authority.assertMusicMigratorAuthority).toBeTypeOf("function");
    expect(authority.provisionMusicRuntimeLogin).toBeTypeOf("function");
    expect(authority.verifyMusicRuntimeLogin).toBeTypeOf("function");
    if (!authority.assertMusicMigratorAuthority || !authority.provisionMusicRuntimeLogin || !authority.verifyMusicRuntimeLogin) return;

    await authority.assertMusicMigratorAuthority(owner, { runtimeLoginRole: runtimeUser });
    await authority.provisionMusicRuntimeLogin(owner, { loginRole: runtimeUser, password: runtimePassword });
    const target = new URL(ownerTarget);
    target.pathname = `/${databaseName}`;
    target.username = runtimeUser;
    target.password = runtimePassword;
    runtime = new pg.Pool({ connectionString: target.toString(), max: 8 });
    await authority.verifyMusicRuntimeLogin(owner, runtime, { loginRole: runtimeUser });

    const attributes = (await runtime.query(`SELECT current_user, rolsuper, rolcreaterole, rolcreatedb,
      rolreplication, rolbypassrls FROM pg_roles WHERE rolname=current_user`)).rows[0];
    expect(attributes).toEqual({
      current_user: runtimeUser,
      rolsuper: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolreplication: false,
      rolbypassrls: false,
    });
    expect((await runtime.query("SELECT pg_has_role(current_user,'music_runtime','member') AS member")).rows[0].member).toBe(true);
    expect((await owner.query(`SELECT tableowner=current_user AS owner_is_migrator
      FROM pg_tables WHERE schemaname='public' AND tablename='users'`)).rows[0].owner_is_migrator).toBe(true);
    expect((await owner.query(`SELECT tgenabled FROM pg_trigger
      WHERE tgname='music_credential_revocation_history_immutability'`)).rows[0].tgenabled).toBe("A");

    const repository = new MusicIdentityRepository(runtime);
    const identity = await repository.ensureIdentity({
      userDocumentId: "runtime-role-user",
      accountDocumentId: "runtime-role-account",
      username: "runtime-role-user",
      email: "runtime-role@example.invalid",
      provider: "local",
      accountName: "Runtime Role Venue",
      accountType: "Venue",
      accountMobile: "+15555550100",
      internalUsername: "runtime-role-user-internal",
      password: "disabled-runtime-role",
      guestUrl: "guest-runtime-role",
      guestCapabilityHash: createHash("sha256").update("runtime-role").digest("hex"),
      operationId: "provision-runtime-role",
      requestId: "request-runtime-role",
    });
    await expect(repository.revokeAllCredentials({
      operationId: "10000000-0000-4000-8000-000000000099",
      musicUserId: identity.id,
      expectedSessionVersion: 1,
      reason: "logout_all",
    })).resolves.toMatchObject({ resultSessionVersion: 2 });
    expect((await runtime.query("SELECT count(*)::int AS count FROM music_schema_migrations")).rows[0].count).toBe(10);

    for (const statement of [
      "SET session_replication_role='replica'",
      "UPDATE music_credential_revocation_operations SET reason='credential_compromise'",
      "DELETE FROM music_credential_revocation_operations",
      "UPDATE music_schema_migrations SET checksum=repeat('0',64)",
      "DELETE FROM music_schema_migrations",
      "INSERT INTO music_schema_migrations(id,checksum,schema_checksum) VALUES ('9999_forged',repeat('0',64),repeat('0',64))",
      "ALTER TABLE music_credential_revocation_operations DISABLE TRIGGER music_credential_revocation_history_immutability",
      "DROP TRIGGER music_credential_revocation_history_immutability ON music_credential_revocation_operations",
      "CREATE OR REPLACE FUNCTION reject_music_credential_revocation_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN OLD; END $$",
    ]) await expect(runtime.query(statement), statement).rejects.toThrow();

    const futureGrantTable = ["runtime", "future", "grant", "probe"].join("_");
    await owner.query(`CREATE TABLE ${futureGrantTable}(id serial PRIMARY KEY, value text NOT NULL)`);
    await expect(runtime.query(`INSERT INTO ${futureGrantTable}(value) VALUES ('works') RETURNING id`))
      .resolves.toMatchObject({ rows: [{ id: 1 }] });
    await owner.query(`DROP TABLE ${futureGrantTable}`);

    await owner.query(`ALTER SCHEMA public OWNER TO ${runtimeUser}`);
    await expect(authority.verifyMusicRuntimeLogin(owner, runtime, { loginRole: runtimeUser }))
      .rejects.toThrow(/privilege|unsafe/i);
    await owner.query("ALTER SCHEMA public OWNER TO music_migrator");
    await owner.query(`ALTER DATABASE ${databaseName} OWNER TO ${runtimeUser}`);
    await expect(authority.verifyMusicRuntimeLogin(owner, runtime, { loginRole: runtimeUser }))
      .rejects.toThrow(/privilege|unsafe/i);
    await owner.query(`ALTER DATABASE ${databaseName} OWNER TO music_migrator`);
  });
});
