import type { Express } from "express";
import type { Server } from "node:http";
import { parseMusicRuntimeFixtureEnvironment } from "./music-environment";
import {
  resolveMusicIdentityRuntimeConfig,
  type MusicIdentityConfigDependencies,
  type MusicIdentityRuntimeConfig,
} from "./music-identity-config";
import { resolveMusicDatabaseConnection } from "./music-database-config";
import type { MusicDatabaseConnection } from "./music-database-config";

type Environment = Record<string, string | undefined>;

export interface MusicServerRuntime {
  createApp: (config: MusicIdentityRuntimeConfig) => Promise<{ app: Express; server: Server }>;
  setupVite: (app: Express, server: Server) => Promise<void>;
  serveStatic: (app: Express) => void;
}

export interface MusicStartupDependencies extends MusicIdentityConfigDependencies {
  loadRuntime?: () => Promise<MusicServerRuntime>;
  verifyDatabaseConnection?: (connection: MusicDatabaseConnection) => Promise<void>;
  host?: string;
  port?: number;
}

async function loadProductionRuntime(): Promise<MusicServerRuntime> {
  const [{ createApp }, { setupVite, serveStatic }] = await Promise.all([
    import("../app"),
    import("../vite"),
  ]);
  return { createApp, setupVite, serveStatic };
}

async function verifyProductionDatabaseConnection(connection: MusicDatabaseConnection): Promise<void> {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: connection.connectionString, max: 1 });
  try {
    const result = await pool.query<{
      current_user: string;
      rolcanlogin: boolean;
      rolsuper: boolean;
      rolcreaterole: boolean;
      rolcreatedb: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
      memberships: string[];
      can_create_database_objects: boolean;
      can_create_schema_objects: boolean;
    }>(`SELECT current_user,login.rolcanlogin,login.rolsuper,login.rolcreaterole,
        login.rolcreatedb,login.rolreplication,login.rolbypassrls,
        has_database_privilege(current_user,current_database(),'CREATE') AS can_create_database_objects,
        has_schema_privilege(current_user,'public','CREATE') AS can_create_schema_objects,
        COALESCE((SELECT array_agg(granted.rolname::text ORDER BY granted.rolname::text)
          FROM pg_auth_members membership JOIN pg_roles granted ON granted.oid=membership.roleid
          WHERE membership.member=login.oid),'{}'::text[]) AS memberships
      FROM pg_roles login
      WHERE login.rolname=current_user`);
    const role = result.rows[0];
    if (!role || role.current_user !== connection.user || !role.rolcanlogin || role.rolsuper
        || role.rolcreaterole || role.rolcreatedb || role.rolreplication || role.rolbypassrls
        || role.memberships.length !== 1 || role.memberships[0] !== "music_runtime"
        || role.can_create_database_objects || role.can_create_schema_objects) {
      throw new Error("runtime database authentication or role attestation failed");
    }
  } catch {
    throw new Error("runtime database authentication or role attestation failed");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

/** The only startup discriminator. No routes, storage, or listener are loaded before it succeeds. */
export async function validateMusicStartupEnvironment(
  environment: Environment,
  dependencies: MusicStartupDependencies = {},
): Promise<MusicIdentityRuntimeConfig> {
  if (environment.MUSIC_MODE === "fixture") parseMusicRuntimeFixtureEnvironment(environment);
  else if (environment.MUSIC_MODE !== "live") throw new Error("MUSIC_MODE must be live or fixture");
  const config = await resolveMusicIdentityRuntimeConfig(environment, dependencies);
  const database = await resolveMusicDatabaseConnection(environment, "runtime", dependencies);
  await (dependencies.verifyDatabaseConnection ?? verifyProductionDatabaseConnection)(database);
  environment.DATABASE_URL = database.connectionString;
  return config;
}

export async function createValidatedApp(
  environment: Environment = process.env,
  dependencies: MusicStartupDependencies = {},
): Promise<{ app: Express; server: Server }> {
  const config = await validateMusicStartupEnvironment(environment, dependencies);
  const runtime = await (dependencies.loadRuntime ?? loadProductionRuntime)();
  return runtime.createApp(config);
}

export async function startMusicServer(
  environment: Environment,
  dependencies: MusicStartupDependencies = {},
): Promise<{ app: Express; server: Server; config: MusicIdentityRuntimeConfig }> {
  const config = await validateMusicStartupEnvironment(environment, dependencies);
  const runtime = await (dependencies.loadRuntime ?? loadProductionRuntime)();
  const { app, server } = await runtime.createApp(config);
  if (app.get("env") === "development") await runtime.setupVite(app, server);
  else runtime.serveStatic(app);

  const port = dependencies.port ?? Number.parseInt(environment.PORT ?? "5000", 10);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error("PORT must be a valid TCP port");
  const host = dependencies.host ?? "0.0.0.0";
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      resolve();
    });
  });
  return { app, server, config };
}
