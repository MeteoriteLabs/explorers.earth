import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createGateAttestation, type ImageCandidate } from "../../deployment/music-deployment";
import { setupMusicHealthRoutes } from "../../deployment/music-health";

const image: ImageCandidate = {
  digest: `sha256:${"e".repeat(64)}`,
  commit: "e".repeat(40),
  migrationMarker: "containment-no-schema-change",
};
const key = "health-route-attestation-key-long-enough";
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function appWithAttestation(databaseQuery: () => Promise<unknown>) {
  const directory = await mkdtemp(join(tmpdir(), "music-health-"));
  directories.push(directory);
  const path = join(directory, "gate.json");
  await writeFile(path, JSON.stringify(createGateAttestation(image, key)));
  const app = express();
  setupMusicHealthRoutes(app, {
    pool: { query: databaseQuery } as never,
    env: {
      MUSIC_IMAGE_DIGEST: image.digest,
      MUSIC_IMAGE_COMMIT: image.commit,
      MUSIC_MIGRATION_MARKER: image.migrationMarker,
      MUSIC_GATE_ATTESTATION_KEY: key,
      MUSIC_GATE_ATTESTATION_PATH: path,
      SESSION_SECRET: "s".repeat(32),
      COOKIE_SECRET: "c".repeat(32),
      STRAPI_ACCESS_TOKEN: "t".repeat(32),
      STRAPI_JWT_SECRET: "j".repeat(32),
      STRAPI_URL: "https://cms.example.test",
      MUSIC_NEW_ENTRY_KILL_SWITCH: "true",
      MUSIC_COHORT_ENABLED: "false",
    },
  });
  return app;
}

describe("Music health endpoints", () => {
  it("reports liveness while readiness independently fails DB", async () => {
    const app = await appWithAttestation(async () => { throw new Error("db unavailable"); });
    expect((await request(app).get("/health/live")).status).toBe(200);
    const readiness = await request(app).get("/health/ready");
    expect(readiness.status).toBe(503);
    expect(readiness.body.reason).toBe("database-unreachable");
  });

  it("returns immutable metadata and a fail-closed server kill switch", async () => {
    const app = await appWithAttestation(async () => ({ rows: [{ ok: 1 }] }));
    const readiness = await request(app).get("/health/ready");
    expect(readiness.status).toBe(200);
    expect(readiness.body).toMatchObject({ ready: true, ...image });
    const status = await request(app).get("/api/music-entry/status");
    expect(status.body).toMatchObject({
      newMusicEntryEnabled: false,
      legacyMusicEntryEnabled: false,
      killSwitch: true,
      ...image,
    });
  });
});
