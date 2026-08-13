import pg from "pg";
import { migrateMusicDatabase } from "../db/migrate";

const exactTarget = "postgresql://music:music@127.0.0.1:55432/music_fixture";

export default async function setupIntegrationDatabase(): Promise<void> {
  if (process.env.MUSIC_C3_POSTGRES_TEST !== "1") {
    throw new Error("MUSIC_C3_POSTGRES_TEST=1 is required for the destructive integration suite");
  }
  if (process.env.DATABASE_URL_TEST !== exactTarget) {
    throw new Error("integration tests require the exact disposable PostgreSQL target");
  }
  const pool = new pg.Pool({ connectionString: exactTarget, max: 2 });
  try {
    await migrateMusicDatabase(pool);
  } finally {
    await pool.end();
  }
}
