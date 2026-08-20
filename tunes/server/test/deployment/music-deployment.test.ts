import { describe, expect, it } from "vitest";
import {
  DeploymentController,
  createGateAttestation,
  resolveMusicEntryPolicy,
  type DeploymentRuntime,
  type DeploymentState,
  type ImageCandidate,
} from "../../deployment/music-deployment";

const prior: ImageCandidate = {
  digest: `sha256:${"1".repeat(64)}`,
  commit: "1111111111111111111111111111111111111111",
  migrationMarker: "containment-no-schema-change",
};
const candidate: ImageCandidate = {
  digest: `sha256:${"2".repeat(64)}`,
  commit: "2222222222222222222222222222222222222222",
  migrationMarker: "containment-no-schema-change",
};
const schemaCandidate: ImageCandidate = {
  digest: `sha256:${"4".repeat(64)}`,
  commit: "4444444444444444444444444444444444444444",
  migrationMarker: "0013_publication_operation_database_clock",
};

function initialState(): DeploymentState {
  return {
    activeSlot: "blue",
    active: prior,
    secureHistory: [prior],
    rollbackFloorDigest: prior.digest,
    migrationCompatibilityFloorDigest: undefined,
  };
}

function runtime(failAt?: "gate" | "readiness" | "promotion") {
  const events: string[] = [];
  let serving = prior.digest;
  const implementation: DeploymentRuntime = {
    pull: async (image) => { events.push(`pull:${image.digest}`); },
    runContainmentGate: async (image) => {
      events.push(`gate:${image.digest}`);
      if (failAt === "gate") throw new Error("gate failed");
      return createGateAttestation(image, "test-attestation-key-that-is-long-enough");
    },
    startPrivateCandidate: async (slot, image) => {
      events.push(`private:${slot}:${image.digest}`);
    },
    checkReadiness: async (slot, image, attestation) => {
      events.push(`ready:${slot}:${image.digest}:${attestation.signature.slice(0, 8)}`);
      return failAt !== "readiness";
    },
    promoteAtomically: async (slot, image) => {
      events.push(`promote:${slot}:${image.digest}`);
      if (failAt === "promotion") throw new Error("promotion failed");
      serving = image.digest;
    },
    restoreTraffic: async (slot, image) => {
      events.push(`restore:${slot}:${image.digest}`);
      serving = image.digest;
    },
    stopCandidate: async (slot) => { events.push(`stop:${slot}`); },
  };
  return { implementation, events, serving: () => serving };
}

describe("immutable Music deployment rehearsal", () => {
  it("keeps the exact prior digest serving when the same-image gate fails", async () => {
    // Production break caught: a failed pre-start gate drains or replaces the healthy image.
    const fake = runtime("gate");
    const controller = new DeploymentController(initialState(), fake.implementation, "test-attestation-key-that-is-long-enough");

    await expect(controller.deploy(candidate)).rejects.toThrow("gate failed");

    expect(fake.serving()).toBe(prior.digest);
    expect(controller.snapshot().active.digest).toBe(prior.digest);
    expect(fake.events.some((event) => event.startsWith("private:"))).toBe(false);
  });

  it("keeps a candidate private and restores the exact prior digest when readiness fails", async () => {
    // Production break caught: Traefik sees the candidate before DB/gate/config readiness succeeds.
    const fake = runtime("readiness");
    const controller = new DeploymentController(initialState(), fake.implementation, "test-attestation-key-that-is-long-enough");

    await expect(controller.deploy(candidate)).rejects.toThrow("candidate readiness failed");

    expect(fake.serving()).toBe(prior.digest);
    expect(controller.snapshot().active.digest).toBe(prior.digest);
    expect(fake.events.findIndex((event) => event.startsWith("private:")))
      .toBeLessThan(fake.events.findIndex((event) => event.startsWith("ready:")));
    expect(fake.events.some((event) => event.startsWith("promote:"))).toBe(false);
  });

  it("promotes only after gate and readiness, and records immutable status metadata", async () => {
    const fake = runtime();
    const controller = new DeploymentController(initialState(), fake.implementation, "test-attestation-key-that-is-long-enough");

    const result = await controller.deploy(candidate);

    expect(fake.events.map((event) => event.split(":")[0])).toEqual([
      "pull", "gate", "private", "ready", "promote",
    ]);
    expect(fake.serving()).toBe(candidate.digest);
    expect(result.active).toEqual(candidate);
    expect(result.activeSlot).toBe("green");
  });

  it("restores the exact prior digest when atomic promotion reports failure", async () => {
    const fake = runtime("promotion");
    const controller = new DeploymentController(initialState(), fake.implementation, "test-attestation-key-that-is-long-enough");

    await expect(controller.deploy(candidate)).rejects.toThrow("promotion failed");

    expect(fake.serving()).toBe(prior.digest);
    expect(fake.events).toContain(`restore:blue:${prior.digest}`);
    expect(controller.snapshot().active.digest).toBe(prior.digest);
  });

  it("rejects unknown and pre-floor rollback digests", async () => {
    const newer = { ...candidate, digest: `sha256:${"3".repeat(64)}` };
    const state = initialState();
    state.active = newer;
    state.activeSlot = "green";
    state.secureHistory = [prior, candidate, newer];
    state.rollbackFloorDigest = candidate.digest;
    const controller = new DeploymentController(state, runtime().implementation, "test-attestation-key-that-is-long-enough");

    await expect(controller.rollback(`sha256:${"9".repeat(64)}`)).rejects.toThrow("unknown secure digest");
    await expect(controller.rollback(prior.digest)).rejects.toThrow("older than rollback floor");
  });

  it("advances a distinct schema-compatibility floor after the irreversible migration gate", async () => {
    const fake = runtime("readiness");
    fake.implementation.runContainmentGate = async (image) => {
      fake.events.push(`gate:${image.digest}`);
      return createGateAttestation(image, "test-attestation-key-that-is-long-enough", "a".repeat(64));
    };
    const controller = new DeploymentController(initialState(), fake.implementation, "test-attestation-key-that-is-long-enough");

    await expect(controller.deploy(schemaCandidate)).rejects.toThrow("candidate readiness failed");

    expect(controller.snapshot().active.digest).toBe(prior.digest);
    expect(controller.snapshot().migrationCompatibilityFloorDigest).toBe(schemaCandidate.digest);
    expect(fake.serving()).toBe(prior.digest);
    await expect(controller.rollback(prior.digest)).rejects.toThrow(/schema compatibility floor/i);
  });
});

describe("server-owned Music entry controls", () => {
  it("can only disable the new entry and can never re-enable legacy Music", () => {
    expect(resolveMusicEntryPolicy({ killSwitch: true, cohortEnabled: true, inCohort: true }))
      .toEqual({ newMusicEntryEnabled: false, legacyMusicEntryEnabled: false });
    expect(resolveMusicEntryPolicy({ killSwitch: false, cohortEnabled: true, inCohort: true }))
      .toEqual({ newMusicEntryEnabled: true, legacyMusicEntryEnabled: false });
    expect(resolveMusicEntryPolicy({ killSwitch: false, cohortEnabled: true, inCohort: false }))
      .toEqual({ newMusicEntryEnabled: false, legacyMusicEntryEnabled: false });
  });
});
