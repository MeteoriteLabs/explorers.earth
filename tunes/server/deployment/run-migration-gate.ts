import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pool } from "../db";
import { migrateMusicDatabase } from "../db/migrate";
import { createGateAttestation, CURRENT_MIGRATION_MARKER } from "./music-deployment";
import { deploymentImageFromEnvironment } from "./music-health";

async function run(): Promise<void> {
  const image = deploymentImageFromEnvironment(process.env);
  if (image.migrationMarker !== CURRENT_MIGRATION_MARKER) throw new Error(`same-image gate requires ${CURRENT_MIGRATION_MARKER}`);
  const key = process.env.MUSIC_GATE_ATTESTATION_KEY ?? "";
  const target = process.env.MUSIC_GATE_ATTESTATION_PATH;
  if (!target) throw new Error("MUSIC_GATE_ATTESTATION_PATH is required");

  const migration = await migrateMusicDatabase(pool);
  if (!migration.ready || migration.currentId !== CURRENT_MIGRATION_MARKER || !migration.currentChecksum) {
    throw new Error("exact migration journal state was not reached");
  }
  const attestation = createGateAttestation(image, key, migration.currentChecksum);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(attestation)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await rename(temporary, target);
  await pool.end();
}

run().catch(async (error) => {
  console.error("Music migration deployment gate failed", error);
  await pool.end().catch(() => undefined);
  process.exitCode = 1;
});
