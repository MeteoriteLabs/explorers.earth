import pg from "pg";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateMusicDatabase } from "../db/migrate";
import { MusicIdentityRepository } from "../repositories/musicIdentityRepository";
import { startMusicServer } from "../config/music-startup";

const ownerTarget = process.env.DATABASE_URL_TEST ?? "postgresql://music_migrator:music@127.0.0.1:55432/music_fixture";
const enabled = process.env.MUSIC_C5_POSTGRES_TEST === "1";
const describePg = enabled ? describe.sequential : describe.skip;
const databaseName = `music_runtime_role_${process.pid}`;
const runtimeUser = `music_runtime_test_${process.pid}`;
const escalationRole = `music_runtime_escalation_${process.pid}`;
const bridgeRole = `music_runtime_bridge_${process.pid}`;
const gateOwnerRole = `music_gate_owner_${process.pid}`;
const runtimeCapabilityRole = ["music", "runtime"].join("_");
const gateOwnerPassword = Buffer.alloc(32, 0x6f).toString("base64url");
const runtimePassword = Buffer.alloc(32, 0x6d).toString("base64url");
const runtimeSecretRoot = mkdtempSync(join(tmpdir(), "music-runtime-role-secret-"));
const runtimePasswordPath = join(runtimeSecretRoot, "database-runtime");
const signingPath = join(runtimeSecretRoot, "music-token");
const gateOwnerPasswordPath = join(runtimeSecretRoot, "database-migrator");
writeFileSync(runtimePasswordPath, runtimePassword, { mode: 0o600 });
writeFileSync(signingPath, Buffer.alloc(32, 0x6e).toString("base64url"), { mode: 0o600 });
writeFileSync(gateOwnerPasswordPath, gateOwnerPassword, { mode: 0o600 });
chmodSync(runtimePasswordPath, 0o600);
chmodSync(signingPath, 0o600);
chmodSync(gateOwnerPasswordPath, 0o600);
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

function startupEnvironment(): Record<string, string> {
  const repositoryRoot = resolve(import.meta.dirname, "../../..");
  const values = Object.fromEntries(readFileSync(join(repositoryRoot, ".env.music.test.example"), "utf8")
    .split(/\r?\n/).filter((line) => line && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]));
  return {
    ...values,
    MUSIC_MODE: "live",
    STRAPI_URL: "https://cms.example.invalid",
    MUSIC_STRAPI_ALLOWED_ORIGINS: "https://cms.example.invalid",
    TRUST_PROXY_HOPS: "1",
    MUSIC_TRUSTED_PROXY_IP: "127.0.0.1",
    MUSIC_DATABASE_HOST: "127.0.0.1",
    MUSIC_DATABASE_PORT: "55432",
    MUSIC_DATABASE_NAME: databaseName,
    MUSIC_DATABASE_USER: runtimeUser,
    MUSIC_DATABASE_MIGRATOR_USER: "music_migrator",
    MUSIC_DATABASE_PASSWORD_FILE: runtimePasswordPath,
    MUSIC_TOKEN_CURRENT_SECRET_FILE: signingPath,
  };
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
    await clusterAdmin?.query(`REVOKE ${escalationRole} FROM ${runtimeCapabilityRole}`).catch(() => undefined);
    await clusterAdmin?.query(`REVOKE ${bridgeRole} FROM ${runtimeCapabilityRole}`).catch(() => undefined);
    await clusterAdmin?.query(`REVOKE ${escalationRole} FROM ${bridgeRole}`).catch(() => undefined);
    await clusterAdmin?.query(`REVOKE ${escalationRole} FROM ${runtimeUser}`).catch(() => undefined);
    await clusterAdmin?.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()", [databaseName]);
    await clusterAdmin?.query(`DROP DATABASE IF EXISTS ${databaseName}`);
    await clusterAdmin?.query(`DROP ROLE IF EXISTS ${runtimeUser}`);
    await clusterAdmin?.query(`DROP ROLE IF EXISTS ${bridgeRole}`);
    await clusterAdmin?.query(`DROP ROLE IF EXISTS ${escalationRole}`);
    await clusterAdmin?.query(`DROP ROLE IF EXISTS ${gateOwnerRole}`);
    await clusterAdmin?.end();
    rmSync(runtimeSecretRoot, { recursive: true, force: true });
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

  it("rejects every direct and transitive authority inherited through the fixed capability role", async () => {
    // Production break caught: login direct membership is clean while
    // music_runtime itself inherits a CREATEDB/admin-equivalent role.
    const authority = await loadAuthority() as {
      verifyMusicRuntimeLogin?: (ownerPool: pg.Pool, runtimePool: pg.Pool, input: { loginRole: string }) => Promise<void>;
      assertMusicRuntimeCapabilityPreflight?: (ownerPool: pg.Pool) => Promise<void>;
    };
    expect(authority.assertMusicRuntimeCapabilityPreflight).toBeTypeOf("function");
    expect(authority.verifyMusicRuntimeLogin).toBeTypeOf("function");
    if (!authority.assertMusicRuntimeCapabilityPreflight || !authority.verifyMusicRuntimeLogin) return;
    await owner.query(`CREATE ROLE ${escalationRole} NOLOGIN CREATEDB`);
    await owner.query(`CREATE ROLE ${bridgeRole} NOLOGIN`);

    await owner.query(`GRANT ${escalationRole} TO ${runtimeCapabilityRole}`);
    await expect(authority.assertMusicRuntimeCapabilityPreflight(owner)).rejects.toThrow(/capability|membership|authority/i);
    await expect(authority.verifyMusicRuntimeLogin(owner, runtime, { loginRole: runtimeUser }))
      .rejects.toThrow(/capability|membership|authority/i);
    await owner.query(`REVOKE ${escalationRole} FROM ${runtimeCapabilityRole}`);

    await owner.query(`GRANT ${escalationRole} TO ${bridgeRole}`);
    await owner.query(`GRANT ${bridgeRole} TO ${runtimeCapabilityRole}`);
    await expect(authority.verifyMusicRuntimeLogin(owner, runtime, { loginRole: runtimeUser }))
      .rejects.toThrow(/capability|membership|authority/i);
    await owner.query(`REVOKE ${bridgeRole} FROM ${runtimeCapabilityRole}`);
    await owner.query(`REVOKE ${escalationRole} FROM ${bridgeRole}`);

    await owner.query(`GRANT ${escalationRole} TO ${runtimeUser}`);
    await expect(authority.verifyMusicRuntimeLogin(owner, runtime, { loginRole: runtimeUser }))
      .rejects.toThrow(/capability|membership|authority/i);
    await owner.query(`REVOKE ${escalationRole} FROM ${runtimeUser}`);
    await expect(authority.verifyMusicRuntimeLogin(owner, runtime, { loginRole: runtimeUser })).resolves.toBeUndefined();
  });

  it("detects a newly granted transitive role between its two complete-graph snapshots", async () => {
    // Production break caught: a role membership added after the first query
    // can survive until promotion because attestation never rechecks closure.
    const authority = await loadAuthority() as {
      verifyMusicRuntimeLogin?: (ownerPool: pg.Pool, runtimePool: pg.Pool, input: { loginRole: string }) => Promise<void>;
    };
    expect(authority.verifyMusicRuntimeLogin).toBeTypeOf("function");
    if (!authority.verifyMusicRuntimeLogin) return;
    await owner.query(`CREATE ROLE ${escalationRole} NOLOGIN CREATEDB`).catch(() => undefined);
    let graphReads = 0;
    let injected = false;
    const racingOwner = {
      query: async (...args: Parameters<pg.Pool["query"]>) => {
        const result = await (owner.query as (...queryArgs: Parameters<pg.Pool["query"]>) => ReturnType<pg.Pool["query"]>)(...args);
        if (String(args[0]).includes("WITH RECURSIVE music_role_closure")) {
          graphReads += 1;
          if (graphReads === 1) {
            await owner.query(`GRANT ${escalationRole} TO ${runtimeCapabilityRole}`);
            injected = true;
          }
        }
        return result;
      },
    };
    await expect(authority.verifyMusicRuntimeLogin(racingOwner as never, runtime, { loginRole: runtimeUser }))
      .rejects.toThrow(/capability|membership|changed|authority/i);
    expect(injected).toBe(true);
    await owner.query(`REVOKE ${escalationRole} FROM ${runtimeCapabilityRole}`).catch(() => undefined);
  });

  it("rejects an unsafe transitive role before startup imports routes or binds a listener", async () => {
    // Production break caught: the gate checks closure but startup repeats
    // only direct login membership and then imports the application.
    await owner.query(`CREATE ROLE ${escalationRole} NOLOGIN CREATEDB`).catch(() => undefined);
    await owner.query(`GRANT ${escalationRole} TO ${runtimeCapabilityRole}`);
    let imported = false;
    await expect(startMusicServer(startupEnvironment(), {
      resolveAddresses: async () => ["8.8.8.8"],
      loadRuntime: async () => {
        imported = true;
        throw new Error("route import must not occur");
      },
    })).rejects.toThrow(/database authentication|role attestation|membership|authority/i);
    expect(imported).toBe(false);
    await owner.query(`REVOKE ${escalationRole} FROM ${runtimeCapabilityRole}`);
  });

  it("runs the exact gate preflight before migration and writes no attestation for a hostile capability graph", async () => {
    // Production break caught: the helper is correct but the process gate
    // migrates and writes promotion authority without invoking it.
    await owner.query(`CREATE ROLE ${gateOwnerRole} LOGIN SUPERUSER PASSWORD '${gateOwnerPassword}'`);
    await owner.query(`CREATE ROLE ${escalationRole} NOLOGIN CREATEDB`).catch(() => undefined);
    await owner.query(`GRANT ${escalationRole} TO ${runtimeCapabilityRole}`);
    const attestation = join(runtimeSecretRoot, "hostile-gate-attestation.json");
    const journalBefore = (await owner.query("SELECT id,checksum,schema_checksum FROM music_schema_migrations ORDER BY id")).rows;
    const tunesRoot = resolve(import.meta.dirname, "../..");
    const tsxCli = join(tunesRoot, "node_modules", "tsx", "dist", "cli.mjs");
    let failure: { status?: number; stdout?: string; stderr?: string } | undefined;
    try {
      execFileSync(process.execPath, [tsxCli, "server/deployment/run-migration-gate.ts"], {
        cwd: tunesRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          MUSIC_MODE: "fixture",
          MUSIC_DATABASE_HOST: "127.0.0.1",
          MUSIC_DATABASE_PORT: "55432",
          MUSIC_DATABASE_NAME: databaseName,
          MUSIC_DATABASE_USER: gateOwnerRole,
          MUSIC_DATABASE_PASSWORD_FILE: gateOwnerPasswordPath,
          MUSIC_RUNTIME_DATABASE_USER: runtimeUser,
          MUSIC_RUNTIME_DATABASE_PASSWORD_FILE: runtimePasswordPath,
          MUSIC_IMAGE_DIGEST: `sha256:${"a".repeat(64)}`,
          MUSIC_IMAGE_COMMIT: "a".repeat(40),
          MUSIC_MIGRATION_MARKER: "0010_least_privilege_runtime_role",
          MUSIC_GATE_ATTESTATION_KEY: "hostile-gate-key-at-least-32-characters",
          MUSIC_GATE_ATTESTATION_PATH: attestation,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      failure = error as typeof failure;
    }
    expect(failure?.status).toBe(1);
    expect(existsSync(attestation)).toBe(false);
    expect((await owner.query("SELECT id,checksum,schema_checksum FROM music_schema_migrations ORDER BY id")).rows)
      .toEqual(journalBefore);
    const output = `${failure?.stdout ?? ""}${failure?.stderr ?? ""}`;
    for (const forbidden of [gateOwnerPassword, runtimePassword, gateOwnerRole, runtimeUser]) {
      expect(output).not.toContain(forbidden);
    }
    await owner.query(`REVOKE ${escalationRole} FROM ${runtimeCapabilityRole}`);
    await owner.query(`DROP ROLE ${gateOwnerRole}`);
  });

  it("fails closed on a malformed or cyclic role-graph result", async () => {
    // Production break caught: graph rows are accepted without proving one
    // acyclic login -> music_runtime edge and zero capability edges.
    const authority = await loadAuthority() as {
      validateMusicRuntimeRoleGraph?: (input: unknown) => void;
    };
    expect(authority.validateMusicRuntimeRoleGraph).toBeTypeOf("function");
    if (!authority.validateMusicRuntimeRoleGraph) return;
    expect(() => authority.validateMusicRuntimeRoleGraph!({
      loginRole: runtimeUser,
      loginAttributes: { canLogin: true, inherit: true, superuser: false, createRole: false, createDb: false, replication: false, bypassRls: false },
      capabilityAttributes: { canLogin: false, inherit: true, superuser: false, createRole: false, createDb: false, replication: false, bypassRls: false },
      loginClosure: ["music_runtime", bridgeRole, "music_runtime"],
      capabilityClosure: [bridgeRole, "music_runtime"],
      cycleDetected: true,
    })).toThrow(/cycle|membership|authority/i);
  });
});
