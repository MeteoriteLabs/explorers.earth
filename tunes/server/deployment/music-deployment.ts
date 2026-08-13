import { createHmac, timingSafeEqual } from "node:crypto";

export const CONTAINMENT_MIGRATION_MARKER = "containment-no-schema-change" as const;
export const GATE_KIND = "music-containment-deployment-gate-v1" as const;

export interface ImageCandidate {
  digest: string;
  commit: string;
  migrationMarker: typeof CONTAINMENT_MIGRATION_MARKER;
}

export interface GateAttestation extends ImageCandidate {
  kind: typeof GATE_KIND;
  schemaChanged: false;
  signature: string;
}

export interface DeploymentState {
  activeSlot: "blue" | "green";
  active: ImageCandidate;
  secureHistory: ImageCandidate[];
  rollbackFloorDigest: string;
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
  if (image.migrationMarker !== CONTAINMENT_MIGRATION_MARKER) {
    throw new Error(`C2 only permits ${CONTAINMENT_MIGRATION_MARKER}`);
  }
}

function canonicalGatePayload(image: ImageCandidate): string {
  assertImageCandidate(image);
  return [GATE_KIND, image.digest, image.commit, image.migrationMarker, "schemaChanged=false"].join("\n");
}

export function createGateAttestation(image: ImageCandidate, key: string): GateAttestation {
  if (key.length < 32) throw new Error("gate attestation key must contain at least 32 characters");
  return {
    kind: GATE_KIND,
    ...image,
    schemaChanged: false,
    signature: createHmac("sha256", key).update(canonicalGatePayload(image)).digest("hex"),
  };
}

export function verifyGateAttestation(attestation: GateAttestation, expected: ImageCandidate, key: string): boolean {
  try {
    assertImageCandidate(expected);
    if (attestation.kind !== GATE_KIND || attestation.schemaChanged !== false
      || attestation.digest !== expected.digest || attestation.commit !== expected.commit
      || attestation.migrationMarker !== expected.migrationMarker) return false;
    const expectedSignature = createGateAttestation(expected, key).signature;
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
    try {
      await this.runtime.pull(candidate);
      const attestation = await this.runtime.runContainmentGate(candidate);
      if (!verifyGateAttestation(attestation, candidate, this.attestationKey)) {
        throw new Error("gate attestation mismatch");
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
      };
      return this.snapshot();
    } catch (error) {
      this.state = previous;
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
  requireText(deployExecutable, "containment-no-schema-change", "deploy must run the transitional containment gate");
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
