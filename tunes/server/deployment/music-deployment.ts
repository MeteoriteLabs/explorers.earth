import { createHmac, timingSafeEqual } from "node:crypto";
import {
  DEPLOYABLE_MUSIC_MIGRATION_MARKERS,
  EXPECTED_MUSIC_MIGRATION_ID,
  LEGACY_CONTAINMENT_MIGRATION_MARKER,
  type DeployableMusicMigrationMarker,
} from "../../shared/music-migration-contract";

export const CONTAINMENT_MIGRATION_MARKER = LEGACY_CONTAINMENT_MIGRATION_MARKER;
export const CURRENT_MIGRATION_MARKER = EXPECTED_MUSIC_MIGRATION_ID;
export const GATE_KIND = "music-schema-deployment-gate-v2" as const;
export const LEGACY_GATE_KIND = "music-containment-deployment-gate-v1" as const;

export interface ImageCandidate {
  digest: string;
  commit: string;
  migrationMarker: DeployableMusicMigrationMarker;
}

export interface GateAttestation extends ImageCandidate {
  kind: typeof GATE_KIND | typeof LEGACY_GATE_KIND;
  schemaChanged: boolean;
  migrationChecksum?: string;
  signature: string;
}

export interface DeploymentState {
  activeSlot: "blue" | "green";
  active: ImageCandidate;
  secureHistory: ImageCandidate[];
  rollbackFloorDigest: string;
  /** Image provenance that first completed the irreversible current-schema gate. */
  migrationCompatibilityFloorDigest?: string;
}

export interface DeploymentRuntime {
  pull(image: ImageCandidate): Promise<void>;
  runContainmentGate(image: ImageCandidate): Promise<GateAttestation>;
  startPrivateCandidate(slot: "blue" | "green", image: ImageCandidate): Promise<void>;
  checkReadiness(slot: "blue" | "green", image: ImageCandidate, attestation: GateAttestation): Promise<boolean>;
  promoteAtomically(slot: "blue" | "green", image: ImageCandidate): Promise<void>;
  restoreTraffic(slot: "blue" | "green", image: ImageCandidate): Promise<void>;
  stopCandidate(slot: "blue" | "green"): Promise<void>;
}

function assertImageCandidate(image: ImageCandidate): void {
  if (!/^sha256:[a-f0-9]{64}$/.test(image.digest)) throw new Error("image digest must be immutable sha256");
  if (!/^[a-f0-9]{40}$/.test(image.commit)) throw new Error("image commit must be a full git SHA");
  if (!(DEPLOYABLE_MUSIC_MIGRATION_MARKERS as readonly string[]).includes(image.migrationMarker)) {
    throw new Error(`unsupported migration marker ${image.migrationMarker}`);
  }
}

function canonicalGatePayload(image: ImageCandidate, migrationChecksum?: string): string {
  assertImageCandidate(image);
  const legacy = image.migrationMarker === CONTAINMENT_MIGRATION_MARKER;
  if (!legacy && !/^[a-f0-9]{64}$/.test(migrationChecksum ?? "")) throw new Error("migration checksum is required");
  return [legacy ? LEGACY_GATE_KIND : GATE_KIND, image.digest, image.commit, image.migrationMarker,
    legacy ? "schemaChanged=false" : "schemaChanged=true", migrationChecksum ?? ""].join("\n");
}

export function createGateAttestation(image: ImageCandidate, key: string, migrationChecksum?: string): GateAttestation {
  if (key.length < 32) throw new Error("gate attestation key must contain at least 32 characters");
  const legacy = image.migrationMarker === CONTAINMENT_MIGRATION_MARKER;
  return {
    kind: legacy ? LEGACY_GATE_KIND : GATE_KIND,
    ...image,
    schemaChanged: !legacy,
    ...(legacy ? {} : { migrationChecksum }),
    signature: createHmac("sha256", key).update(canonicalGatePayload(image, migrationChecksum)).digest("hex"),
  };
}

export function verifyGateAttestation(attestation: GateAttestation, expected: ImageCandidate, key: string): boolean {
  try {
    assertImageCandidate(expected);
    const legacy = expected.migrationMarker === CONTAINMENT_MIGRATION_MARKER;
    if (attestation.kind !== (legacy ? LEGACY_GATE_KIND : GATE_KIND) || attestation.schemaChanged !== !legacy
      || attestation.digest !== expected.digest || attestation.commit !== expected.commit
      || attestation.migrationMarker !== expected.migrationMarker) return false;
    if (!legacy && !/^[a-f0-9]{64}$/.test(attestation.migrationChecksum ?? "")) return false;
    const expectedSignature = createGateAttestation(expected, key, attestation.migrationChecksum).signature;
    const actual = Buffer.from(attestation.signature, "hex");
    const wanted = Buffer.from(expectedSignature, "hex");
    return actual.length === wanted.length && timingSafeEqual(actual, wanted);
  } catch {
    return false;
  }
}

export class DeploymentController {
  private state: DeploymentState;

  constructor(state: DeploymentState, private readonly runtime: DeploymentRuntime, private readonly attestationKey: string) {
    this.state = structuredClone(state);
    assertImageCandidate(this.state.active);
    if (!this.state.secureHistory.some((image) => image.digest === this.state.rollbackFloorDigest)) {
      throw new Error("rollback floor must be a known secure digest");
    }
  }

  snapshot(): DeploymentState {
    return structuredClone(this.state);
  }

  async deploy(candidate: ImageCandidate): Promise<DeploymentState> {
    assertImageCandidate(candidate);
    const previous = structuredClone(this.state);
    const candidateSlot = previous.activeSlot === "blue" ? "green" : "blue";
    let candidateStarted = false;
    let promotionAttempted = false;
    let migrationFloorAdvanced = false;
    try {
      await this.runtime.pull(candidate);
      const attestation = await this.runtime.runContainmentGate(candidate);
      if (!verifyGateAttestation(attestation, candidate, this.attestationKey)) {
        throw new Error("gate attestation mismatch");
      }
      if (candidate.migrationMarker === CURRENT_MIGRATION_MARKER && !previous.migrationCompatibilityFloorDigest) {
        // The schema gate is irreversible even if candidate readiness or
        // promotion later fails. Preserve this floor while old traffic stays
        // serving so no subsequent rollback can start a pre-schema image.
        migrationFloorAdvanced = true;
        this.state = { ...previous, migrationCompatibilityFloorDigest: candidate.digest };
      }
      await this.runtime.startPrivateCandidate(candidateSlot, candidate);
      candidateStarted = true;
      if (!await this.runtime.checkReadiness(candidateSlot, candidate, attestation)) {
        throw new Error("candidate readiness failed");
      }
      promotionAttempted = true;
      await this.runtime.promoteAtomically(candidateSlot, candidate);
      this.state = {
        ...previous,
        activeSlot: candidateSlot,
        active: candidate,
        secureHistory: previous.secureHistory.some((image) => image.digest === candidate.digest)
          ? previous.secureHistory
          : [...previous.secureHistory, candidate],
        migrationCompatibilityFloorDigest: migrationFloorAdvanced
          ? candidate.digest
          : previous.migrationCompatibilityFloorDigest,
      };
      return this.snapshot();
    } catch (error) {
      this.state = migrationFloorAdvanced
        ? { ...previous, migrationCompatibilityFloorDigest: candidate.digest }
        : previous;
      if (candidateStarted) {
        if (promotionAttempted) await this.runtime.restoreTraffic(previous.activeSlot, previous.active);
        await this.runtime.stopCandidate(candidateSlot);
      }
      throw error;
    }
  }

  async rollback(targetDigest: string): Promise<DeploymentState> {
    const targetIndex = this.state.secureHistory.findIndex((image) => image.digest === targetDigest);
    if (targetIndex < 0) throw new Error("rollback refused: unknown secure digest");
    const floorIndex = this.state.secureHistory.findIndex((image) => image.digest === this.state.rollbackFloorDigest);
    if (targetIndex < floorIndex) throw new Error("rollback refused: digest is older than rollback floor");
    if (this.state.migrationCompatibilityFloorDigest
        && this.state.secureHistory[targetIndex].migrationMarker !== CURRENT_MIGRATION_MARKER) {
      throw new Error("rollback refused: digest is older than schema compatibility floor");
    }
    return this.deploy(this.state.secureHistory[targetIndex]);
  }
}

export function resolveMusicEntryPolicy(input: { killSwitch: boolean; cohortEnabled: boolean; inCohort: boolean }) {
  return {
    newMusicEntryEnabled: !input.killSwitch && (!input.cohortEnabled || input.inCohort),
    legacyMusicEntryEnabled: false,
  } as const;
}

export function livenessStatus() {
  return { live: true as const };
}

export type ReadinessResult = (ImageCandidate & { ready: true }) | (Partial<ImageCandidate> & { ready: false; reason: string });

export async function evaluateReadiness(input: {
  image: ImageCandidate;
  attestation: GateAttestation | undefined;
  attestationKey: string;
  requiredSecrets: Record<string, string | undefined>;
  upstreamUrls: Record<string, string | undefined>;
  databasePing: () => Promise<boolean>;
  migrationState?: () => Promise<{ ready: boolean; currentId?: string; currentChecksum?: string }>;
}): Promise<ReadinessResult> {
  try {
    assertImageCandidate(input.image);
  } catch {
    return { ready: false, reason: "image-metadata-invalid" };
  }
  if (Object.values(input.requiredSecrets).some((value) => !value || value.length < 16)) {
    return { ready: false, reason: "mandatory-secret-missing", ...input.image };
  }
  try {
    for (const value of Object.values(input.upstreamUrls)) {
      if (!value) throw new Error("missing");
      const url = new URL(value);
      if (url.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) throw new Error("unsafe");
    }
  } catch {
    return { ready: false, reason: "upstream-config-invalid", ...input.image };
  }
  if (!await input.databasePing().catch(() => false)) {
    return { ready: false, reason: "database-unreachable", ...input.image };
  }
  if (input.image.migrationMarker === CURRENT_MIGRATION_MARKER) {
    let state: { ready: boolean; currentId?: string; currentChecksum?: string } | undefined;
    try { state = await input.migrationState?.(); }
    catch { state = { ready: false }; }
    if (!state?.ready || state.currentId !== CURRENT_MIGRATION_MARKER
      || state.currentChecksum !== input.attestation?.migrationChecksum) {
      return { ready: false, reason: "migration-state-invalid", ...input.image };
    }
  }
  if (!input.attestation || !verifyGateAttestation(input.attestation, input.image, input.attestationKey)) {
    return { ready: false, reason: "gate-attestation-mismatch", ...input.image };
  }
  return { ready: true, ...input.image };
}

export function auditDeploymentAuthority(files: {
  ciWorkflow: string;
  deployWorkflow: string;
  deployExecutable: string;
  rootCompose: string;
  tunesCompose: string;
  fixtureCompose: string;
}): string[] {
  const issues: string[] = [];
  const uncomment = (source: string) => source.split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
  const ciWorkflow = uncomment(files.ciWorkflow);
  const deployWorkflow = uncomment(files.deployWorkflow);
  const deployExecutable = uncomment(files.deployExecutable);
  const rootCompose = uncomment(files.rootCompose);
  const tunesCompose = uncomment(files.tunesCompose);
  const fixtureCompose = uncomment(files.fixtureCompose);
  const requireText = (source: string, needle: string, issue: string) => {
    if (!source.includes(needle)) issues.push(issue);
  };
  requireText(ciWorkflow, "explorers-tunes", "CI must publish explorers-tunes");
  requireText(ciWorkflow, "docker/build-push-action@v6", "CI must have one documented image build");
  requireText(ciWorkflow, "anchore/scan-action@v7", "CI must scan the built image before push");
  requireText(ciWorkflow, "digest:", "CI must propagate the pushed digest");
  if (/explorers-tunes:latest|tags:[^\n]*latest/.test(ciWorkflow)) issues.push("CI must not publish a mutable tag");
  requireText(deployWorkflow, "workflow_call:", "deploy authority must be reusable from CI");
  requireText(deployWorkflow, "tunes/deployment/music-deploy.sh", "workflow must invoke the checked-in deploy executable");
  requireText(deployExecutable, "music-router.yml", "deploy must atomically manage the Music route");
  requireText(deployExecutable, EXPECTED_MUSIC_MIGRATION_ID, "deploy must run the exact schema migration gate");
  requireText(deployExecutable, "/health/ready", "deploy must gate promotion on readiness");
  requireText(deployExecutable, "transaction_current", "deploy must recover through a durable transaction journal");
  for (const forbidden of ["scp-action", "docker compose down", "--build", "build-push-action"]) {
    if (deployWorkflow.includes(forbidden) || deployExecutable.includes(forbidden)) issues.push(`deploy authority contains forbidden operation ${forbidden}`);
  }
  for (const name of ["tunes-blue:", "tunes-green:", "tunes-gate:", "--providers.file.directory=/deployment-routing"]) {
    requireText(rootCompose, name, `root Compose missing ${name}`);
  }
  if (/ghcr\.io\/[^\n]+:(?:latest|\$\{IMAGE_TAG)/.test(rootCompose)) issues.push("root Compose contains a mutable Tunes image");
  if (!/POSTGRES_PASSWORD:\s*\$\{DB_PASS:\?/.test(rootCompose)) issues.push("database credentials must fail closed");
  const dbSection = rootCompose.match(/\n  db:\n([\s\S]*?)(?=\n  [a-zA-Z][\w-]*:\n)/)?.[1] ?? "";
  if (/\n\s+ports:/.test(dbSection)) issues.push("production database must not publish a port");
  requireText(tunesCompose, "status: superseded", "Tunes Compose must be explicitly superseded");
  requireText(tunesCompose, "services: {}", "superseded Tunes Compose must be non-runnable");
  requireText(fixtureCompose, "name: explorers-music-fixture", "music-test Compose must remain disposable authority");
  return issues;
}
