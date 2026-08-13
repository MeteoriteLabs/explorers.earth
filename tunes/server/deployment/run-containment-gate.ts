import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pool } from "../db";
import { createGateAttestation } from "./music-deployment";
import { deploymentImageFromEnvironment } from "./music-health";

async function run(): Promise<void> {
  const image = deploymentImageFromEnvironment(process.env);
  const key = process.env.MUSIC_GATE_ATTESTATION_KEY ?? "";
  const target = process.env.MUSIC_GATE_ATTESTATION_PATH;
  if (!target) throw new Error("MUSIC_GATE_ATTESTATION_PATH is required");

  // C2 transitional gate only: prove DB connectivity, then attest that this
  // exact image intentionally performs no schema change. C3 replaces this
  // with the journal-backed database migration runner.
  await pool.query("SELECT 1");
  const attestation = createGateAttestation(image, key);
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(attestation)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  await rename(temporary, target);
  await pool.end();
}

run().catch(async (error) => {
  console.error("Music containment deployment gate failed", error);
  await pool.end().catch(() => undefined);
  process.exitCode = 1;
});
