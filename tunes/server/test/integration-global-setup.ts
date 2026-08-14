import pg from "pg";
import { migrateMusicDatabase } from "../db/migrate";

export default async function setupIntegrationDatabase(): Promise<void> {
  if (process.env.MUSIC_C3_POSTGRES_TEST !== "1") {
    throw new Error("MUSIC_C3_POSTGRES_TEST=1 is required for the destructive integration suite");
  }
  const rawTarget = process.env.DATABASE_URL_TEST ?? "";
  let target: URL;
  try { target = new URL(rawTarget); }
  catch { throw new Error("integration tests require the exact disposable PostgreSQL target"); }
  if (target.protocol !== "postgresql:" || target.hostname !== "127.0.0.1" || target.port !== "55432"
      || target.pathname !== "/music_fixture" || target.username !== "music_migrator" || !target.password) {
    throw new Error("integration tests require the exact disposable PostgreSQL target");
  }
  const pool = new pg.Pool({ connectionString: rawTarget, max: 2 });
  try {
    await migrateMusicDatabase(pool);
  } finally {
    await pool.end();
  }
}
