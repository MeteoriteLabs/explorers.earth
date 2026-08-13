import { describe, expect, it } from "vitest";
import {
  createGateAttestation,
  evaluateReadiness,
  livenessStatus,
  type ImageCandidate,
} from "../../deployment/music-deployment";

const image: ImageCandidate = {
  digest: `sha256:${"a".repeat(64)}`,
  commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  migrationMarker: "containment-no-schema-change",
};
const key = "test-attestation-key-that-is-long-enough";

describe("Music liveness and readiness", () => {
  it("keeps process liveness independent from deployment dependencies", () => {
    expect(livenessStatus(image)).toEqual({ live: true, ...image });
  });

  it("requires DB, mandatory secrets, upstream configuration, and exact same-image attestation", async () => {
    const attestation = createGateAttestation(image, key);
    const ready = await evaluateReadiness({
      image,
      attestation,
      attestationKey: key,
      requiredSecrets: { SESSION_SECRET: "s".repeat(32), COOKIE_SECRET: "c".repeat(32) },
      upstreamUrls: { STRAPI_URL: "https://cms.example.test" },
      databasePing: async () => true,
    });

    expect(ready).toEqual({ ready: true, ...image });
  });

  it("fails closed for a digest-mismatched attestation even when DB is reachable", async () => {
    const attestation = createGateAttestation({ ...image, digest: `sha256:${"b".repeat(64)}` }, key);
    const result = await evaluateReadiness({
      image,
      attestation,
      attestationKey: key,
      requiredSecrets: { SESSION_SECRET: "s".repeat(32), COOKIE_SECRET: "c".repeat(32) },
      upstreamUrls: { STRAPI_URL: "https://cms.example.test" },
      databasePing: async () => true,
    });

    expect(result.ready).toBe(false);
    expect(result.reason).toBe("gate-attestation-mismatch");
  });

  it.each([
    ["database-unreachable", async () => false, { SESSION_SECRET: "s".repeat(32), COOKIE_SECRET: "c".repeat(32) }, { STRAPI_URL: "https://cms.example.test" }],
    ["mandatory-secret-missing", async () => true, { SESSION_SECRET: "", COOKIE_SECRET: "c".repeat(32) }, { STRAPI_URL: "https://cms.example.test" }],
    ["upstream-config-invalid", async () => true, { SESSION_SECRET: "s".repeat(32), COOKIE_SECRET: "c".repeat(32) }, { STRAPI_URL: "http://localhost:1337" }],
  ])("reports %s without claiming readiness", async (reason, databasePing, requiredSecrets, upstreamUrls) => {
    const result = await evaluateReadiness({
      image,
      attestation: createGateAttestation(image, key),
      attestationKey: key,
      requiredSecrets,
      upstreamUrls,
      databasePing,
    });
    expect(result).toMatchObject({ ready: false, reason });
  });
});
