import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { migrateMusicDatabase } from "../db/migrate";
import { provisionMusicRuntimeLogin } from "../db/music-runtime-role";
import {
  attestC10StandalonePostgresAuthority,
  parseC10StandalonePostgresAuthority,
} from "../../scripts/music-qualification-postgres";

export function validateIntegrationDatabaseTarget(rawTarget: string, environment: NodeJS.ProcessEnv = process.env): URL {
  let target: URL;
  try { target = new URL(rawTarget); }
  catch { throw new Error("integration tests require the exact disposable PostgreSQL target"); }
  const standalone = parseC10StandalonePostgresAuthority(environment);
  if (target.protocol !== "postgresql:" || target.hostname !== "127.0.0.1"
      || target.port !== String(standalone?.port ?? 55_432)
      || target.pathname !== "/music_fixture" || target.username !== "music_migrator" || !target.password
      || target.search || target.hash) {
    throw new Error("integration tests require the exact disposable PostgreSQL target");
  }
  return target;
}

export default async function setupIntegrationDatabase(): Promise<void> {
  if (process.env.MUSIC_C3_POSTGRES_TEST !== "1") {
    throw new Error("MUSIC_C3_POSTGRES_TEST=1 is required for the destructive integration suite");
  }
  const rawTarget = process.env.DATABASE_URL_TEST ?? "";
  validateIntegrationDatabaseTarget(rawTarget);
  let sourceCommit: string;
  try {
    sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(), encoding: "utf8", windowsHide: true, timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new Error("integration tests require an exact source commit for PostgreSQL attestation");
  }
  attestC10StandalonePostgresAuthority(process.env, sourceCommit);
  const pool = new pg.Pool({ connectionString: rawTarget, max: 2 });
  try {
    const version = await pool.query<{ server_version_num: string }>("SHOW server_version_num");
    const versionNumber = Number(version.rows[0]?.server_version_num);
    if (!Number.isSafeInteger(versionNumber) || versionNumber < 150_000 || versionNumber >= 160_000) {
      throw new Error("integration tests require PostgreSQL 15 before migration");
    }
    await migrateMusicDatabase(pool);
    const runtimePassword = randomBytes(32).toString("base64url");
    await provisionMusicRuntimeLogin(pool, {
      loginRole: process.env.MUSIC_DATABASE_USER ?? "music_runtime_login",
      password: runtimePassword,
    });
    const secretDirectory = mkdtempSync(join(tmpdir(), "music-runtime-integration-"));
    const passwordFile = join(secretDirectory, "runtime-password");
    writeFileSync(passwordFile, runtimePassword, { mode: 0o600 });
    const target = new URL(rawTarget);
    process.env.MUSIC_DATABASE_HOST = target.hostname;
    process.env.MUSIC_DATABASE_PORT = target.port;
    process.env.MUSIC_DATABASE_NAME = target.pathname.slice(1);
    process.env.MUSIC_DATABASE_PASSWORD_FILE = passwordFile;
    delete process.env.DATABASE_URL;
  } finally {
    await pool.end();
  }
}
