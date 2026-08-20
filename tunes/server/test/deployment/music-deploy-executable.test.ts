import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const { load: parseYaml } = require("js-yaml") as { load(source: string): any };

const repoRoot = resolve(import.meta.dirname, "../../../..");
const deployScript = resolve(repoRoot, "tunes/deployment/music-deploy.sh");
const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "/bin/bash";
const digest = (character: string) => `sha256:${character.repeat(64)}`;
const commit = (character: string) => character.repeat(40);
const repository = "ghcr.io/explorers-earth/explorers-tunes";
const source = "https://github.com/explorers-earth/explorers.earth";
const hmacSentinel = "state-hmac-key-with-at-least-thirty-two-bytes";
const publicResponseSentinel = "UNTRUSTED_PUBLIC_RESPONSE_SENTINEL";

function shellPath(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  return process.platform === "win32" ? `/${normalized[0].toLowerCase()}${normalized.slice(2)}` : normalized;
}

interface RunOptions {
  extraRequestLines?: string[];
  failpoint?: string;
  ociCommit?: string;
  ociSource?: string;
  ociContainment?: string;
  publicResponseMode?: "nonzero" | "invalid-json";
  slot?: "blue" | "green";
  candidateReadinessFailure?: boolean;
  gateCommittedCrash?: boolean;
  gateFailure?: boolean;
  expectedMarkerOverride?: string;
}

describe("checked-in production Music deploy executable", () => {
  let sandbox: string;
  let root: string;
  let fakeBin: string;
  let eventLog: string;
  let requestFile: string;
  let keyFile: string;
  let tokenFile: string;

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), "music-deploy-process-"));
    root = join(sandbox, "root");
    fakeBin = join(sandbox, "bin");
    eventLog = join(sandbox, "events.log");
    requestFile = join(sandbox, "request.txt");
    keyFile = join(sandbox, "hmac.key");
    tokenFile = join(sandbox, "ghcr.token");
    mkdirSync(join(root, "deployment-routing"), { recursive: true });
    mkdirSync(join(root, "deployment-state"), { recursive: true });
    mkdirSync(join(root, "deployment-transactions"), { recursive: true });
    mkdirSync(fakeBin, { recursive: true });
    writeFileSync(join(root, "docker-compose.yml"), "services: {}\n");
    writeFileSync(join(root, "production.env"), "MUSIC_GATE_ATTESTATION_KEY=test-only\n");
    writeFileSync(keyFile, hmacSentinel);
    writeFileSync(tokenFile, "read-only-ghcr-test-token");
    chmodSync(keyFile, 0o600);
    chmodSync(tokenFile, 0o600);

    const docker = `#!/usr/bin/env bash
set -euo pipefail
route="$MUSIC_DEPLOY_ROOT/deployment-routing/music-router.yml"
current_route="none"; if [[ -f "$route" ]]; then current_route="$(grep -Eo 'http://[^ ]+:5000' "$route" | tail -1)"; fi
printf 'docker %s | route=%s\\n' "$*" "$current_route" >> "$MUSIC_DEPLOY_TEST_EVENT_LOG"
if [[ "$*" == *" login "* || "$*" == *" login" ]]; then cat >/dev/null; exit 0; fi
if [[ "$*" == *" logout "* || "$*" == *" logout" ]]; then exit 0; fi
if [[ "$1" == "pull" ]]; then exit 0; fi
if [[ "$*" == *"RepoDigests"* ]]; then printf '%s@%s\\n' "$MUSIC_DEPLOY_EXPECTED_REPOSITORY" "$MUSIC_DEPLOY_TEST_DIGEST"; exit 0; fi
if [[ "$*" == *"org.opencontainers.image.revision"* ]]; then printf '%s\\n' "\${MUSIC_DEPLOY_TEST_OCI_COMMIT:-$MUSIC_DEPLOY_TEST_COMMIT}"; exit 0; fi
if [[ "$*" == *"org.opencontainers.image.source"* ]]; then printf '%s\\n' "\${MUSIC_DEPLOY_TEST_OCI_SOURCE:-$MUSIC_DEPLOY_EXPECTED_SOURCE}"; exit 0; fi
if [[ "$*" == *"com.explorers.music.minimum-containment-commit"* ]]; then printf '%s\\n' "\${MUSIC_DEPLOY_TEST_OCI_CONTAINMENT:-d226f7e4dc5a54195a59804ec729f72b5e8f10d7}"; exit 0; fi
if [[ "$*" == *" compose "* || "$1" == "compose" ]]; then
  service="\${!#}"
  if [[ "\${MUSIC_DEPLOY_TEST_GATE_COMMITTED_CRASH:-}" == 1 && "$*" == *"tunes-gate"* ]]; then
    printf 'database migration committed before gate process loss\n' >> "$MUSIC_DEPLOY_TEST_EVENT_LOG"
    exit 99
  fi
  if [[ "\${MUSIC_DEPLOY_TEST_GATE_FAILURE:-}" == 1 && "$*" == *"tunes-gate"* ]]; then
    printf 'database migration gate failed before commit\n' >> "$MUSIC_DEPLOY_TEST_EVENT_LOG"
    exit 74
  fi
  if [[ "\${MUSIC_DEPLOY_TEST_READINESS_FAILURE:-}" == 1 \
    && ( "$*" == *" exec -T tunes-blue "* || "$*" == *" exec -T tunes-green "* ) ]]; then exit 75; fi
  if [[ "$*" == *" up "* ]] && grep -Fq "http://\${service}:5000" "$route"; then
    echo "refusing to replace the currently public slot: $service" >&2
    exit 73
  fi
  exit 0
fi
exit 0
`;
    const curl = `#!/usr/bin/env bash
set -euo pipefail
count="$(find "$MUSIC_DEPLOY_ROOT/deployment-routing" -maxdepth 1 -type f \\( -name '*.yml' -o -name '*.yaml' \\) | wc -l | tr -d ' ')"
test "$count" = 1
printf 'curl %s | route=%s\\n' "$*" "$(grep -Eo 'http://[^ ]+:5000' "$MUSIC_DEPLOY_ROOT/deployment-routing/music-router.yml" | tail -1)" >> "$MUSIC_DEPLOY_TEST_EVENT_LOG"
if [[ "$*" == *"/api/register"* ]]; then
  grep -Fq 'PathRegexp(\`(?i)^/api/register/?$\`)' "$MUSIC_DEPLOY_ROOT/deployment-routing/music-router.yml"
  grep -Fq 'priority: 1000' "$MUSIC_DEPLOY_ROOT/deployment-routing/music-router.yml"
  grep -Fq 'http://tunes-register-compat:5100' "$MUSIC_DEPLOY_ROOT/deployment-routing/music-router.yml"
  printf '{"error":{"code":"LEGACY_IDENTITY_ROUTE_REMOVED","message":"This identity endpoint is no longer available.","action":"upgrade_client","retryable":false,"requestId":"compat-test-request"}}\\n410'
  exit 0
fi
if [[ "\${!#}" == "https://localtunes.earth/" ]]; then grep -Fq 'http://legacy-tunes:5000' "$MUSIC_DEPLOY_ROOT/deployment-routing/music-router.yml"; printf 'legacy-ok'; exit 0; fi
grep -Fq "http://tunes-$MUSIC_DEPLOY_TEST_SLOT:5000" "$MUSIC_DEPLOY_ROOT/deployment-routing/music-router.yml"
if [[ "\${MUSIC_DEPLOY_TEST_PUBLIC_RESPONSE_MODE:-}" == nonzero ]]; then printf '${publicResponseSentinel}'; exit 22; fi
if [[ "\${MUSIC_DEPLOY_TEST_PUBLIC_RESPONSE_MODE:-}" == invalid-json ]]; then printf '${publicResponseSentinel}'; exit 0; fi
printf '{"ready":true,"digest":"%s","commit":"%s","migrationMarker":"%s"}\\n' "$MUSIC_DEPLOY_TEST_DIGEST" "$MUSIC_DEPLOY_TEST_COMMIT" "$MUSIC_DEPLOY_TEST_CURRENT_MARKER"
`;
    const node = `#!/usr/bin/env bash
set -euo pipefail
printf 'node %s\\n' "$*" >> "$MUSIC_DEPLOY_TEST_NODE_ARGV_LOG"
env >> "$MUSIC_DEPLOY_TEST_NODE_ENV_LOG"
sleep 0.05
exec "$MUSIC_DEPLOY_TEST_REAL_NODE" "$@"
`;
    writeFileSync(join(fakeBin, "docker"), docker);
    writeFileSync(join(fakeBin, "curl"), curl);
    writeFileSync(join(fakeBin, "node"), node);
    writeFileSync(join(fakeBin, "sleep"), "#!/usr/bin/env bash\nexit 0\n");
    chmodSync(join(fakeBin, "docker"), 0o755);
    chmodSync(join(fakeBin, "curl"), 0o755);
    chmodSync(join(fakeBin, "node"), 0o755);
    chmodSync(join(fakeBin, "sleep"), 0o755);
  });

  afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

  function run(operation: "bootstrap" | "deploy" | "rollback", requestedDigest: string, requestedCommit: string, options: RunOptions = {}) {
    const composeProject = operation === "bootstrap" ? "legacy-project" : "-";
    writeFileSync(requestFile, [
      "music-deploy-request-v2",
      `operation=${operation}`,
      `digest=${requestedDigest}`,
      `commit=${requestedCommit}`,
      `compose_project=${composeProject}`,
      `legacy_service=${operation === "bootstrap" ? "legacy-tunes" : "-"}`,
      ...(options.extraRequestLines ?? []),
      "",
    ].join("\n"));
    const environment = { ...process.env };
    for (const name of Object.keys(environment)) if (name.toLowerCase() === "path") delete environment[name];
    Object.assign(environment, {
        PATH: `${shellPath(fakeBin)}:/usr/bin:/bin`,
        MUSIC_DEPLOY_ROOT: shellPath(root),
        MUSIC_DEPLOY_REQUEST_FILE: shellPath(requestFile),
        MUSIC_DEPLOY_HMAC_KEY_FILE: shellPath(keyFile),
        MUSIC_DEPLOY_GHCR_TOKEN_FILE: shellPath(tokenFile),
        MUSIC_DEPLOY_GHCR_USER: "deploy-reader",
        MUSIC_DEPLOY_EXPECTED_REPOSITORY: repository,
        MUSIC_DEPLOY_EXPECTED_SOURCE: source,
        MUSIC_DEPLOY_TEST_EVENT_LOG: shellPath(eventLog),
        MUSIC_DEPLOY_TEST_CURL_COMMAND: shellPath(join(fakeBin, "curl")),
        MUSIC_DEPLOY_TEST_DIGEST: requestedDigest,
        MUSIC_DEPLOY_TEST_COMMIT: requestedCommit === "-" ? (options.ociCommit ?? commit("a")) : requestedCommit,
        MUSIC_DEPLOY_TEST_SLOT: options.slot ?? (operation === "bootstrap" ? "blue" : "green"),
        MUSIC_DEPLOY_TEST_OCI_COMMIT: options.ociCommit ?? "",
        MUSIC_DEPLOY_TEST_OCI_SOURCE: options.ociSource ?? "",
        MUSIC_DEPLOY_TEST_OCI_CONTAINMENT: options.ociContainment ?? "",
        MUSIC_DEPLOY_TEST_PUBLIC_RESPONSE_MODE: options.publicResponseMode ?? "",
        MUSIC_DEPLOY_TEST_READINESS_FAILURE: options.candidateReadinessFailure ? "1" : "0",
        MUSIC_DEPLOY_TEST_GATE_COMMITTED_CRASH: options.gateCommittedCrash ? "1" : "0",
        MUSIC_DEPLOY_TEST_GATE_FAILURE: options.gateFailure ? "1" : "0",
        MUSIC_DEPLOY_TEST_CURRENT_MARKER: options.expectedMarkerOverride ?? "0011_durable_publication_idempotency",
        MUSIC_DEPLOY_TEST_CURRENT_MARKER_OVERRIDE: options.expectedMarkerOverride ?? "",
        MUSIC_DEPLOY_TEST_READINESS_ATTEMPTS: options.candidateReadinessFailure ? "1" : "30",
        MUSIC_DEPLOY_TEST_REAL_NODE: shellPath(process.execPath),
        MUSIC_DEPLOY_TEST_NODE_ARGV_LOG: shellPath(join(sandbox, "node-argv.log")),
        MUSIC_DEPLOY_TEST_NODE_ENV_LOG: shellPath(join(sandbox, "node-env.log")),
        MUSIC_DEPLOY_TEST_MODE: "1",
        MUSIC_DEPLOY_FAILPOINT: options.failpoint ?? "",
    });
    const result = spawnSync(bash, ["--noprofile", "--norc", shellPath(deployScript)], {
      encoding: "utf8",
      env: environment,
    });
    return result;
  }

  function bootstrap() {
    const result = run("bootstrap", digest("a"), commit("a"));
    expect(result.status, result.stderr).toBe(0);
  }

  function seedLegacyAuthority() {
    const priorDigest = digest("a");
    const priorCommit = commit("a");
    const ledgerPayload = ["music-ledger-v2", repository, "1", priorDigest, priorCommit, "containment-no-schema-change", "GENESIS"].join("\t");
    writeFileSync(join(root, "deployment-state/secure-images.tsv"), [
      "music-ledger-v2", "1", priorDigest, priorCommit, "containment-no-schema-change", "GENESIS",
      createHmac("sha256", hmacSentinel).update(ledgerPayload).digest("hex"),
    ].join("\t") + "\n");
    const floorPayload = ["music-floor-v1", repository, priorDigest, priorCommit].join("\t");
    writeFileSync(join(root, "deployment-state/music-floor.tsv"), [
      "music-floor-v1", priorDigest, priorCommit,
      createHmac("sha256", hmacSentinel).update(floorPayload).digest("hex"),
    ].join("\t") + "\n");
    const stateValues = ["legacy-project", "blue", priorDigest, priorCommit, priorDigest, priorCommit, priorDigest, priorCommit];
    const statePayload = ["music-state-v2", repository, ...stateValues].join("\t");
    writeFileSync(join(root, "deployment-state/music-state.tsv"), [
      "music-state-v2", ...stateValues, createHmac("sha256", hmacSentinel).update(statePayload).digest("hex"),
    ].join("\t") + "\n");
    writeFileSync(join(root, "deployment-routing/music-router.yml"), "http:\n  routers:\n    tunes:\n      service: tunes-active\n  services:\n    tunes-active:\n      loadBalancer:\n        servers:\n          - url: http://tunes-blue:5000\n");
  }

  function seedVersionedAuthority(marker: string) {
    bootstrap();
    const priorDigest = digest("a");
    const priorCommit = commit("a");
    const ledgerPayload = ["music-ledger-v2", repository, "1", priorDigest, priorCommit, marker, "GENESIS"].join("\t");
    writeFileSync(join(root, "deployment-state/secure-images.tsv"), [
      "music-ledger-v2", "1", priorDigest, priorCommit, marker, "GENESIS",
      createHmac("sha256", hmacSentinel).update(ledgerPayload).digest("hex"),
    ].join("\t") + "\n");
    for (const [relativePath, schema] of [
      ["deployment-state/music-schema-floor.tsv", "music-schema-floor-v2"],
      ["deployment-transactions/schema-epoch.tsv", "music-schema-epoch-v1"],
    ] as const) {
      const payload = [schema, repository, priorDigest, priorCommit, marker, "current"].join("\t");
      writeFileSync(join(root, relativePath), [
        schema, priorDigest, priorCommit, marker, "current",
        createHmac("sha256", hmacSentinel).update(payload).digest("hex"),
      ].join("\t") + "\n");
    }
    writeFileSync(eventLog, "");
  }

  function seedHistoricalAuthority(marker: string) {
    seedVersionedAuthority(marker);
    if (marker === "0002_identity_lifecycle") {
      rmSync(join(root, "deployment-state/music-schema-floor.tsv"));
      rmSync(join(root, "deployment-transactions/schema-epoch.tsv"));
    } else if (marker === "0003_identity_lifecycle_hardening") {
      const schema = "music-schema-floor-v1";
      const payload = [schema, repository, digest("a"), commit("a"), marker].join("\t");
      writeFileSync(join(root, "deployment-state/music-schema-floor.tsv"), [
        schema, digest("a"), commit("a"), marker,
        createHmac("sha256", hmacSentinel).update(payload).digest("hex"),
      ].join("\t") + "\n");
      rmSync(join(root, "deployment-transactions/schema-epoch.tsv"));
    }
    if (marker === "0002_identity_lifecycle" || marker === "0003_identity_lifecycle_hardening") {
      writeFileSync(join(root, "deployment-routing/music-router.yml"), "http:\n  routers:\n    tunes:\n      service: tunes-active\n  services:\n    tunes-active:\n      loadBalancer:\n        servers:\n          - url: http://tunes-blue:5000\n");
    }
    writeFileSync(eventLog, "");
  }

  function seedNewerAuthorityWithReplayedFloor(format: "v2-0004" | "v1-0003") {
    const olderMarker = format === "v2-0004" ? "0004_identity_delete_saga" : "0003_identity_lifecycle_hardening";
    seedVersionedAuthority(olderMarker);
    const ledgerSchema = "music-ledger-v2";
    const firstPayload = [ledgerSchema, repository, "1", digest("a"), commit("a"), olderMarker, "GENESIS"].join("\t");
    const firstMac = createHmac("sha256", hmacSentinel).update(firstPayload).digest("hex");
    const secondPayload = [ledgerSchema, repository, "2", digest("b"), commit("b"), "0008_credential_revocation_operations", firstMac].join("\t");
    const secondMac = createHmac("sha256", hmacSentinel).update(secondPayload).digest("hex");
    writeFileSync(join(root, "deployment-state/secure-images.tsv"), [
      [ledgerSchema, "1", digest("a"), commit("a"), olderMarker, "GENESIS", firstMac].join("\t"),
      [ledgerSchema, "2", digest("b"), commit("b"), "0008_credential_revocation_operations", firstMac, secondMac].join("\t"),
      "",
    ].join("\n"));
    const stateValues = ["legacy-project", "green", digest("b"), commit("b"), digest("a"), commit("a"), digest("b"), commit("b")];
    const statePayload = ["music-state-v2", repository, ...stateValues].join("\t");
    writeFileSync(join(root, "deployment-state/music-state.tsv"), [
      "music-state-v2", ...stateValues,
      createHmac("sha256", hmacSentinel).update(statePayload).digest("hex"),
    ].join("\t") + "\n");
    if (format === "v2-0004") {
      for (const [relativePath, schema] of [
        ["deployment-state/music-schema-floor.tsv", "music-schema-floor-v2"],
        ["deployment-transactions/schema-epoch.tsv", "music-schema-epoch-v1"],
      ] as const) {
        const payload = [schema, repository, digest("a"), commit("a"), olderMarker, "current"].join("\t");
        writeFileSync(join(root, relativePath), [schema, digest("a"), commit("a"), olderMarker, "current",
          createHmac("sha256", hmacSentinel).update(payload).digest("hex")].join("\t") + "\n");
      }
    } else {
      const schema = "music-schema-floor-v1";
      const payload = [schema, repository, digest("a"), commit("a"), olderMarker].join("\t");
      writeFileSync(join(root, "deployment-state/music-schema-floor.tsv"), [schema, digest("a"), commit("a"), olderMarker,
        createHmac("sha256", hmacSentinel).update(payload).digest("hex")].join("\t") + "\n");
      rmSync(join(root, "deployment-transactions/schema-epoch.tsv"));
    }
    writeFileSync(eventLog, "");
  }

  const authorityPaths = [
    "deployment-state/secure-images.tsv",
    "deployment-state/music-state.tsv",
    "deployment-state/music-floor.tsv",
    "deployment-state/music-schema-floor.tsv",
    "deployment-transactions/schema-epoch.tsv",
  ] as const;

  function snapshotAuthority() {
    return authorityPaths.map((relativePath) => [relativePath,
      existsSync(join(root, relativePath)) ? readFileSync(join(root, relativePath)) : undefined] as const);
  }

  function expectAuthorityUnchanged(snapshot: ReturnType<typeof snapshotAuthority>) {
    for (const [relativePath, bytes] of snapshot) {
      expect(existsSync(join(root, relativePath)), relativePath).toBe(bytes !== undefined);
      if (bytes !== undefined) expect(readFileSync(join(root, relativePath)), relativePath).toEqual(bytes);
    }
  }

  it("upgrades authenticated 0004 deployment authority to 0005 without rewriting history", () => {
    seedVersionedAuthority("0004_identity_delete_saga");
    const historicalLedger = readFileSync(join(root, "deployment-state/secure-images.tsv"), "utf8");

    const result = run("deploy", digest("b"), commit("b"), {
      expectedMarkerOverride: "0005_resource_bound_deletion_history",
    });

    expect(result.status, result.stderr).toBe(0);
    const upgradedLedger = readFileSync(join(root, "deployment-state/secure-images.tsv"), "utf8");
    expect(upgradedLedger.startsWith(historicalLedger)).toBe(true);
    expect(upgradedLedger).toContain("0005_resource_bound_deletion_history");
    expect(readFileSync(join(root, "deployment-state/music-schema-floor.tsv"), "utf8"))
      .toContain("\t0005_resource_bound_deletion_history\tcurrent\t");
    expect(readFileSync(join(root, "deployment-transactions/schema-epoch.tsv"), "utf8"))
      .toContain("\t0005_resource_bound_deletion_history\tcurrent\t");
  }, 20_000);

  it.each([
    "containment-no-schema-change",
    "0002_identity_lifecycle",
    "0003_identity_lifecycle_hardening",
    "0004_identity_delete_saga",
    "0005_resource_bound_deletion_history",
    "0006_numeric_identity_lock",
    "0007_identity_provider_snapshot",
    "0008_credential_revocation_operations",
    "0009_credential_revocation_history_immutability",
    "0010_least_privilege_runtime_role",
  ])("upgrades authenticated historical marker %s directly to production 0011", (historicalMarker) => {
    if (historicalMarker === "containment-no-schema-change") seedLegacyAuthority();
    else seedHistoricalAuthority(historicalMarker);
    const historicalLedger = readFileSync(join(root, "deployment-state/secure-images.tsv"), "utf8");

    const interrupted = run("deploy", digest("b"), commit("b"), { failpoint: "after_epoch_before_gate" });
    expect(interrupted.status, interrupted.stderr).toBe(99);
    expect(readFileSync(join(root, "deployment-state/music-schema-floor.tsv"), "utf8"))
      .toContain("\t0011_durable_publication_idempotency\tpending\t");
    expect(readFileSync(join(root, "deployment-state/secure-images.tsv"), "utf8")).toBe(historicalLedger);

    writeFileSync(eventLog, "");
    const refused = run("rollback", digest("a"), "-");
    expect(refused.status).not.toBe(0);
    expect(refused.stderr).toMatch(/schema compatibility floor/i);
    expect(readFileSync(eventLog, "utf8")).toBe("");

    const recovered = run("deploy", digest("b"), commit("b"));
    expect(recovered.status, recovered.stderr).toBe(0);
    expect(readFileSync(join(root, "deployment-state/secure-images.tsv"), "utf8").startsWith(historicalLedger)).toBe(true);
    expect(readFileSync(join(root, "deployment-state/music-schema-floor.tsv"), "utf8"))
      .toContain("\t0011_durable_publication_idempotency\tcurrent\t");
  }, 40_000);

  it.each([
    ["0003 missing its historical floor", () => {
      seedHistoricalAuthority("0003_identity_lifecycle_hardening");
      rmSync(join(root, "deployment-state/music-schema-floor.tsv"));
    }],
    ["0002 with an unsigned partial floor", () => {
      seedHistoricalAuthority("0002_identity_lifecycle");
      writeFileSync(join(root, "deployment-state/music-schema-floor.tsv"),
        `music-schema-floor-v1\t${digest("a")}\t${commit("a")}\t0002_identity_lifecycle\n`);
    }],
  ])("refuses %s before Docker", (_case, arrange) => {
    arrange();
    writeFileSync(eventLog, "");
    const result = run("deploy", digest("b"), commit("b"));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/schema compatibility floor (missing|malformed)/i);
    expect(readFileSync(eventLog, "utf8")).toBe("");
  }, 20_000);

  it("does not adopt a valid v1 floor until signed state and ledger validate", () => {
    seedHistoricalAuthority("0003_identity_lifecycle_hardening");
    const state = join(root, "deployment-state/music-state.tsv");
    const bytes = readFileSync(state, "utf8");
    writeFileSync(state, bytes.replace(/([a-f0-9])(\r?\n)?$/, (_match, last, ending) =>
      `${last === "0" ? "1" : "0"}${ending ?? ""}`));
    writeFileSync(eventLog, "");

    const result = run("deploy", digest("b"), commit("b"));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/deployment state (HMAC mismatch|malformed)/);
    expect(existsSync(join(root, "deployment-transactions/schema-epoch.tsv"))).toBe(false);
    expect(readFileSync(eventLog, "utf8")).toBe("");
  }, 20_000);

  it.each([
    ["v2 0004", "v2-0004", "deploy"],
    ["v2 0004", "v2-0004", "rollback"],
    ["v1 0003", "v1-0003", "deploy"],
    ["v1 0003", "v1-0003", "rollback"],
  ] as const)("refuses replayed %s authority (%s) behind a newer ledger on %s without writes", (_label, format, operation) => {
    seedNewerAuthorityWithReplayedFloor(format);
    const authority = snapshotAuthority();
    const result = operation === "deploy"
      ? run("deploy", digest("c"), commit("c"))
      : run("rollback", digest("a"), "-");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/schema compatibility floor.*secure ledger/i);
    expect(readFileSync(eventLog, "utf8")).toBe("");
    expectAuthorityUnchanged(authority);
  }, 20_000);

  it("accepts a legitimate pending schema floor ahead of promoted ledger history", () => {
    seedVersionedAuthority("0004_identity_delete_saga");
    for (const [relativePath, schema] of [
      ["deployment-state/music-schema-floor.tsv", "music-schema-floor-v2"],
      ["deployment-transactions/schema-epoch.tsv", "music-schema-epoch-v1"],
    ] as const) {
      const payload = [schema, repository, digest("b"), commit("b"), "0011_durable_publication_idempotency", "pending"].join("\t");
      writeFileSync(join(root, relativePath), [schema, digest("b"), commit("b"), "0011_durable_publication_idempotency", "pending",
        createHmac("sha256", hmacSentinel).update(payload).digest("hex")].join("\t") + "\n");
    }
    writeFileSync(eventLog, "");

    const result = run("deploy", digest("b"), commit("b"));
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(root, "deployment-state/music-schema-floor.tsv"), "utf8"))
      .toContain("\t0011_durable_publication_idempotency\tcurrent\t");
    expect(readFileSync(join(root, "deployment-state/secure-images.tsv"), "utf8"))
      .toContain(`\t${digest("b")}\t${commit("b")}\t0011_durable_publication_idempotency\t`);
  }, 20_000);

  it.each([
    ["before pending", { failpoint: "before_epoch" }, false],
    ["after pending", { failpoint: "after_epoch_before_gate" }, true],
    ["gate failure", { gateFailure: true }, true],
    ["database committed before gate return", { gateCommittedCrash: true }, true],
    ["after current", { failpoint: "after_current_floor" }, true],
  ] as const)("recovers a 0004 to 0005 authority upgrade failure %s monotonically", (_label, failure, crossedPending) => {
    seedVersionedAuthority("0004_identity_delete_saga");
    const historicalLedger = readFileSync(join(root, "deployment-state/secure-images.tsv"), "utf8");
    const failed = run("deploy", digest("b"), commit("b"), {
      ...failure,
      expectedMarkerOverride: "0005_resource_bound_deletion_history",
    });
    expect(failed.status).not.toBe(0);
    expect(readFileSync(join(root, "deployment-state/secure-images.tsv"), "utf8")).toBe(historicalLedger);
    const schemaFloor = readFileSync(join(root, "deployment-state/music-schema-floor.tsv"), "utf8");
    expect(schemaFloor).toContain(crossedPending
      ? "\t0005_resource_bound_deletion_history\t"
      : "\t0004_identity_delete_saga\tcurrent\t");

    if (crossedPending) {
      writeFileSync(eventLog, "");
      const refused = run("rollback", digest("a"), "-", {
        expectedMarkerOverride: "0005_resource_bound_deletion_history",
      });
      expect(refused.status).not.toBe(0);
      expect(refused.stderr).toMatch(/schema compatibility floor/i);
      expect(readFileSync(eventLog, "utf8")).toBe("");
    }

    const recovered = run("deploy", digest("b"), commit("b"), {
      expectedMarkerOverride: "0005_resource_bound_deletion_history",
    });
    expect(recovered.status, recovered.stderr).toBe(0);
    expect(readFileSync(join(root, "deployment-state/secure-images.tsv"), "utf8").startsWith(historicalLedger)).toBe(true);
    expect(readFileSync(join(root, "deployment-state/music-schema-floor.tsv"), "utf8"))
      .toContain("\t0005_resource_bound_deletion_history\tcurrent\t");
  }, 30_000);

  it("rejects authenticated unknown and marker-downgraded authorities before Docker", () => {
    seedVersionedAuthority("0004_identity_delete_saga");
    const epochPath = join(root, "deployment-transactions/schema-epoch.tsv");
    const floorPath = join(root, "deployment-state/music-schema-floor.tsv");
    const originalEpoch = readFileSync(epochPath, "utf8");
    const originalFloor = readFileSync(floorPath, "utf8");

    const floorSchema = "music-schema-floor-v2";
    const floorPayload = [floorSchema, repository, digest("a"), commit("a"), "0005_resource_bound_deletion_history", "current"].join("\t");
    writeFileSync(floorPath, [floorSchema, digest("a"), commit("a"), "0005_resource_bound_deletion_history", "current",
      createHmac("sha256", hmacSentinel).update(floorPayload).digest("hex")].join("\t") + "\n");
    writeFileSync(eventLog, "");
    const downgrade = run("deploy", digest("b"), commit("b"));
    expect(downgrade.status).not.toBe(0);
    expect(downgrade.stderr).toMatch(/downgrade|reordered/i);
    expect(readFileSync(eventLog, "utf8")).toBe("");

    const epochSchema = "music-schema-epoch-v1";
    const unknown = "9999_unknown_marker";
    const epochPayload = [epochSchema, repository, digest("a"), commit("a"), unknown, "current"].join("\t");
    writeFileSync(epochPath, [epochSchema, digest("a"), commit("a"), unknown, "current",
      createHmac("sha256", hmacSentinel).update(epochPayload).digest("hex")].join("\t") + "\n");
    const unknownResult = run("deploy", digest("b"), commit("b"));
    expect(unknownResult.status).not.toBe(0);
    expect(unknownResult.stderr).toMatch(/unknown migration marker/i);
    expect(readFileSync(eventLog, "utf8")).toBe("");

    writeFileSync(epochPath, originalEpoch);
    writeFileSync(floorPath, originalFloor);
    const ledgerSchema = "music-ledger-v2";
    const firstPayload = [ledgerSchema, repository, "1", digest("a"), commit("a"), "0005_resource_bound_deletion_history", "GENESIS"].join("\t");
    const firstMac = createHmac("sha256", hmacSentinel).update(firstPayload).digest("hex");
    const secondPayload = [ledgerSchema, repository, "2", digest("b"), commit("b"), "0004_identity_delete_saga", firstMac].join("\t");
    const secondMac = createHmac("sha256", hmacSentinel).update(secondPayload).digest("hex");
    writeFileSync(join(root, "deployment-state/secure-images.tsv"), [
      [ledgerSchema, "1", digest("a"), commit("a"), "0005_resource_bound_deletion_history", "GENESIS", firstMac].join("\t"),
      [ledgerSchema, "2", digest("b"), commit("b"), "0004_identity_delete_saga", firstMac, secondMac].join("\t"),
      "",
    ].join("\n"));
    const reordered = run("deploy", digest("c"), commit("c"));
    expect(reordered.status).not.toBe(0);
    expect(reordered.stderr).toMatch(/ledger malformed or reordered/i);
    expect(readFileSync(eventLog, "utf8")).toBe("");
  }, 20_000);

  it("bootstraps through the exact executable with one visible route and signed state", () => {
    // Production break caught: the runbook diverges from production transaction behavior.
    bootstrap();
    expect(readFileSync(join(root, "deployment-routing/music-router.yml"), "utf8")).toContain("http://tunes-blue:5000");
    for (const file of ["music-state.tsv", "secure-images.tsv", "music-floor.tsv", "music-schema-floor.tsv"]) {
      expect(readFileSync(join(root, "deployment-state", file), "utf8")).toMatch(/\t[a-f0-9]{64}\n?$/);
    }
    expect(existsSync(join(root, "deployment-transactions/current"))).toBe(false);
    const events = readFileSync(eventLog, "utf8");
    expect(events).toContain("curl --fail --silent --show-error --max-time 5 https://localtunes.earth/ | route=http://legacy-tunes:5000");
    expect(events).toContain(`docker pull ${repository}@${digest("a")}`);
  }, 20_000);

  it("keeps legacy traffic serving but permanently rejects C2 rollback after the C3 schema gate", () => {
    seedLegacyAuthority();
    const priorRoute = readFileSync(join(root, "deployment-routing/music-router.yml"), "utf8");
    const priorLedger = readFileSync(join(root, "deployment-state/secure-images.tsv"), "utf8");
    const failedCandidate = run("deploy", digest("b"), commit("b"), { candidateReadinessFailure: true });
    expect(failedCandidate.status).not.toBe(0);
    const failedRoute = readFileSync(join(root, "deployment-routing/music-router.yml"), "utf8");
    expect(failedRoute).not.toBe(priorRoute);
    expect(failedRoute).toContain("http://tunes-register-compat:5100");
    expect(failedRoute).toContain("http://tunes-blue:5000");
    expect(readFileSync(join(root, "deployment-state/secure-images.tsv"), "utf8")).toBe(priorLedger);
    expect(readFileSync(join(root, "deployment-state/music-schema-floor.tsv"), "utf8")).toContain(digest("b"));
    const gateEvents = readFileSync(eventLog, "utf8");
    expect(gateEvents).toContain("tunes-gate");
    expect(gateEvents).toContain("route=http://tunes-blue:5000");

    // The digest that first ran the irreversible gate may never be promoted.
    // Later images declaring the exact C3 marker must still form a usable
    // rollback history; the compatibility authority is a schema epoch, not a
    // requirement that the gate-running digest appear in the secure ledger.
    const firstCompatibleDeploy = run("deploy", digest("c"), commit("c"));
    expect(firstCompatibleDeploy.status, firstCompatibleDeploy.stderr).toBe(0);
    const secondCompatibleDeploy = run("deploy", digest("d"), commit("d"), { slot: "blue" });
    expect(secondCompatibleDeploy.status, secondCompatibleDeploy.stderr).toBe(0);
    const compatibleRollback = run("rollback", digest("c"), "-", { ociCommit: commit("c"), slot: "green" });
    expect(compatibleRollback.status, compatibleRollback.stderr).toBe(0);

    writeFileSync(eventLog, "");
    const refusedRollback = run("rollback", digest("a"), "-");
    expect(refusedRollback.status).not.toBe(0);
    expect(refusedRollback.stderr).toMatch(/schema compatibility floor/i);
    expect(readFileSync(eventLog, "utf8")).toBe("");
    expect(readFileSync(join(root, "deployment-routing/music-router.yml"), "utf8")).toContain("http://tunes-green:5000");
  }, 30_000);

  it("routes exact native registration to the same-image DB-free denial before migration and preserves it on readiness failure", () => {
    seedLegacyAuthority();
    const priorLedger = readFileSync(join(root, "deployment-state/secure-images.tsv"), "utf8");

    const failed = run("deploy", digest("b"), commit("b"), { candidateReadinessFailure: true });

    expect(failed.status).not.toBe(0);
    const route = readFileSync(join(root, "deployment-routing/music-router.yml"), "utf8");
    const parsedRoute = parseYaml(route);
    expect(route, `${failed.stderr}\n${readFileSync(eventLog, "utf8")}`).toContain("rule: Host(`localtunes.earth`) && PathRegexp(`(?i)^/api/register/?$`) && Method(`POST`)");
    expect(parsedRoute.http.routers["tunes-register-compat"]).toMatchObject({
      rule: "Host(`localtunes.earth`) && PathRegexp(`(?i)^/api/register/?$`) && Method(`POST`)",
      priority: 1000,
      service: "tunes-register-compat",
      middlewares: ["tunes-register-rate-limit"],
    });
    expect(parsedRoute.http.services["tunes-register-compat"].loadBalancer.servers).toEqual([
      { url: "http://tunes-register-compat:5100" },
    ]);
    expect(parsedRoute.http.routers.tunes).toMatchObject({ priority: 200, service: "tunes-active" });
    expect(parsedRoute.http.services["tunes-active"].loadBalancer.servers).toEqual([{ url: "http://tunes-blue:5000" }]);
    expect(parsedRoute.http.middlewares["tunes-register-rate-limit"].rateLimit).toMatchObject({
      average: 4,
      period: "1s",
      burst: 4,
    });
    expect(parsedRoute.http.middlewares["tunes-register-rate-limit"].rateLimit.sourceCriterion).toBeUndefined();
    expect(readFileSync(join(root, "deployment-state/secure-images.tsv"), "utf8")).toBe(priorLedger);
    const events = readFileSync(eventLog, "utf8");
    const omitted = events.indexOf("curl --silent --show-error --max-time 5 --request POST --data {} https://localtunes.earth/api/register");
    const forged = events.indexOf("forged-operation");
    const gate = events.indexOf("tunes-gate");
    expect(omitted).toBeGreaterThanOrEqual(0);
    expect(forged).toBeGreaterThan(omitted);
    expect(gate).toBeGreaterThan(forged);
    expect(events).not.toContain("database insert");
  }, 20_000);

  it.each([
    ["before_epoch", false],
    ["after_epoch_before_gate", true],
    ["after_current_floor", true],
  ] as const)("recovers the schema epoch crash at %s conservatively", (failpoint, crossedEpoch) => {
    seedLegacyAuthority();
    const crashed = run("deploy", digest("b"), commit("b"), { failpoint });
    expect(crashed.status).toBe(99);
    const route = readFileSync(join(root, "deployment-routing/music-router.yml"), "utf8");
    expect(route).toContain("http://tunes-register-compat:5100");
    expect(route).toContain("http://tunes-blue:5000");
    const schemaFloor = join(root, "deployment-state/music-schema-floor.tsv");
    expect(existsSync(schemaFloor)).toBe(crossedEpoch);
    writeFileSync(eventLog, "");
    const rollback = run("rollback", digest("a"), "-");
    if (crossedEpoch) {
      expect(rollback.status).not.toBe(0);
      expect(rollback.stderr).toMatch(/schema compatibility/i);
      expect(readFileSync(eventLog, "utf8")).toBe("");
    }
  }, 20_000);

  it("refuses legacy rollback after the DB commits even when the gate process dies before returning", () => {
    seedLegacyAuthority();
    const crashed = run("deploy", digest("b"), commit("b"), { gateCommittedCrash: true });
    expect(crashed.status).not.toBe(0);
    expect(readFileSync(eventLog, "utf8")).toContain("database migration committed before gate process loss");
    expect(readFileSync(join(root, "deployment-state/music-schema-floor.tsv"), "utf8")).toContain("pending");
    writeFileSync(eventLog, "");
    const rollback = run("rollback", digest("a"), "-");
    expect(rollback.status).not.toBe(0);
    expect(rollback.stderr).toMatch(/schema compatibility/i);
    expect(readFileSync(eventLog, "utf8")).toBe("");
  }, 20_000);

  it.each([
    ["digest metacharacter", `${digest("b")};touch-pwned`, commit("b"), []],
    ["commit newline", digest("b"), `${commit("b")}\ntouch-pwned`, []],
    ["arbitrary owner field", digest("b"), commit("b"), ["repository=ghcr.io/attacker/explorers-tunes"]],
  ])("rejects %s before invoking Docker", (_name, requestedDigest, requestedCommit, extraRequestLines) => {
    // Production break caught: hostile request bytes cross into a shell or another GHCR owner.
    const result = run("bootstrap", requestedDigest, requestedCommit, { extraRequestLines });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("invalid deployment request");
    expect(existsSync(eventLog)).toBe(false);
    expect(existsSync(join(sandbox, "touch-pwned"))).toBe(false);
  });

  it.each([
    ["revision", { ociCommit: commit("c") }],
    ["source", { ociSource: "https://github.com/attacker/repo" }],
    ["containment ancestry", { ociContainment: commit("c") }],
  ])("rejects OCI %s mismatch before the same-image gate", (_name, options) => {
    // Production break caught: readiness merely echoes caller metadata for an unproven image.
    const result = run("bootstrap", digest("a"), commit("a"), options);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("OCI provenance mismatch");
    const events = existsSync(eventLog) ? readFileSync(eventLog, "utf8") : "";
    expect(events).not.toContain("tunes-gate");
    expect(readFileSync(join(root, "deployment-routing/music-router.yml"), "utf8")).toContain("legacy-tunes");
  });

  it.each(["after_journal", "after_route", "after_ledger", "after_floor", "after_state"])(
    "recovers an injected crash at %s before selecting or starting the next candidate",
    (failpoint) => {
      // Production break caught: stale state makes the next run replace the slot currently named by Traefik.
      bootstrap();
      writeFileSync(eventLog, "");
      const crashed = run("deploy", digest("b"), commit("b"), { failpoint });
      expect(crashed.status).toBe(99);
      expect(existsSync(join(root, "deployment-transactions/current"))).toBe(true);

      writeFileSync(eventLog, "");
      const recovered = run("deploy", digest("b"), commit("b"));
      expect(recovered.status, recovered.stderr).toBe(0);
      expect(readFileSync(join(root, "deployment-routing/music-router.yml"), "utf8")).toContain("http://tunes-green:5000");
      const events = readFileSync(eventLog, "utf8").trim().split(/\r?\n/);
      expect(events[0]).toContain("route=http://tunes-blue:5000");
      expect(events.join("\n")).not.toContain("refusing to replace the currently public slot");
      expect(existsSync(join(root, "deployment-transactions/current"))).toBe(false);
    },
    20_000,
  );

  it("resumes after a crash immediately after the durable commit without touching the public slot", () => {
    // Production break caught: a finalized journal is mistaken for an uncommitted route and stale slot state wins.
    bootstrap();
    const crashed = run("deploy", digest("b"), commit("b"), { failpoint: "after_commit" });
    expect(crashed.status).toBe(99);
    expect(readFileSync(join(root, "deployment-routing/music-router.yml"), "utf8")).toContain("http://tunes-green:5000");
    writeFileSync(eventLog, "");
    const resumed = run("deploy", digest("c"), commit("c"), { slot: "blue" });
    expect(resumed.status, resumed.stderr).toBe(0);
    const events = readFileSync(eventLog, "utf8").trim().split(/\r?\n/);
    expect(events[0]).toContain("route=http://tunes-green:5000");
    expect(readFileSync(join(root, "deployment-routing/music-router.yml"), "utf8")).toContain("http://tunes-blue:5000");
    expect(existsSync(join(root, "deployment-transactions/current"))).toBe(false);
  }, 20_000);

  it.each(["nonzero", "invalid-json"] as const)("restores every prior authority and stops the candidate on public %s failure", (publicResponseMode) => {
    // Production break caught: set -e exits on curl transport/HTTP failure after
    // promotion, leaving the candidate public until a later deploy recovers it.
    bootstrap();
    const prior = Object.fromEntries([
      ["route", join(root, "deployment-routing/music-router.yml")],
      ["ledger", join(root, "deployment-state/secure-images.tsv")],
      ["state", join(root, "deployment-state/music-state.tsv")],
      ["floor", join(root, "deployment-state/music-floor.tsv")],
    ].map(([name, path]) => [name, readFileSync(path, "utf8")]));
    writeFileSync(eventLog, "");

    const failed = run("deploy", digest("b"), commit("b"), { publicResponseMode });

    expect(failed.status).not.toBe(0);
    expect(readFileSync(join(root, "deployment-routing/music-router.yml"), "utf8")).toBe(prior.route);
    expect(readFileSync(join(root, "deployment-state/secure-images.tsv"), "utf8")).toBe(prior.ledger);
    expect(readFileSync(join(root, "deployment-state/music-state.tsv"), "utf8")).toBe(prior.state);
    expect(readFileSync(join(root, "deployment-state/music-floor.tsv"), "utf8")).toBe(prior.floor);
    expect(existsSync(join(root, "deployment-transactions/current"))).toBe(false);
    const events = readFileSync(eventLog, "utf8");
    expect(events).toContain("stop tunes-green | route=http://tunes-blue:5000");
    expect(failed.stderr).not.toContain(publicResponseSentinel);
  }, 20_000);

  it("keeps the HMAC key out of helper argv and environment while producing stable MACs", () => {
    // Production break caught: openssl -hmac places the authority key in a
    // child process command line where another same-host process can read it.
    bootstrap();
    const row = readFileSync(join(root, "deployment-state/secure-images.tsv"), "utf8").trim().split("\t");
    const expectedPayload = ["music-ledger-v2", repository, "1", digest("a"), commit("a"), "0011_durable_publication_idempotency", "GENESIS"].join("\t");
    expect(row[6]).toBe(createHmac("sha256", hmacSentinel).update(expectedPayload).digest("hex"));

    const deployed = run("deploy", digest("b"), commit("b"));
    expect(deployed.status, deployed.stderr).toBe(0);
    const argv = readFileSync(join(sandbox, "node-argv.log"), "utf8");
    const environment = readFileSync(join(sandbox, "node-env.log"), "utf8");
    expect(argv).toContain("music-hmac.mjs");
    expect(argv).not.toContain(hmacSentinel);
    expect(environment).not.toContain(hmacSentinel);
    expect(deployed.stderr).not.toContain(hmacSentinel);
  }, 20_000);

  it("fails closed on a tampered incomplete journal before Docker or slot selection", () => {
    // Production break caught: recovery trusts attacker-edited backup metadata.
    bootstrap();
    const crashed = run("deploy", digest("b"), commit("b"), { failpoint: "after_route" });
    expect(crashed.status).toBe(99);
    const journal = join(root, "deployment-transactions/current/journal.tsv");
    const journalBytes = readFileSync(journal, "utf8");
    writeFileSync(journal, journalBytes.replace(/\t([a-f0-9])([a-f0-9]{63})(\r?\n)?$/, (_match, first, rest, ending) => `\t${first === "0" ? "1" : "0"}${rest}${ending ?? ""}`));
    writeFileSync(eventLog, "");
    const result = run("deploy", digest("b"), commit("b"));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("transaction journal HMAC mismatch");
    expect(readFileSync(eventLog, "utf8")).toBe("");
  }, 20_000);

  it.each(["state", "floor", "schema-floor", "schema-epoch"])("rejects %s authority tamper before Docker", (authority) => {
    // Production break caught: mutable host state changes the active slot or permanent rollback floor.
    bootstrap();
    const path = authority === "schema-epoch"
      ? join(root, "deployment-transactions/schema-epoch.tsv")
      : join(root, "deployment-state", authority === "state" ? "music-state.tsv"
        : authority === "floor" ? "music-floor.tsv" : "music-schema-floor.tsv");
    const bytes = readFileSync(path, "utf8");
    writeFileSync(path, bytes.replace(/([a-f0-9])(\r?\n)?$/, (_match, last, ending) => `${last === "0" ? "1" : "0"}${ending ?? ""}`));
    writeFileSync(eventLog, "");
    const result = run("deploy", digest("b"), commit("b"));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(authority === "state" ? /deployment state (HMAC mismatch|malformed)/
      : authority === "floor" ? /rollback floor (HMAC mismatch|malformed)/
        : authority === "schema-epoch" ? /schema epoch (journal )?(HMAC mismatch|malformed)/
          : /schema compatibility floor (HMAC mismatch|malformed)/);
    expect(readFileSync(eventLog, "utf8")).toBe("");
  }, 20_000);

  it.each(["duplicate", "malformed", "truncated", "reordered"])(
    "rejects a %s secure ledger before Docker",
    (mutation) => {
      // Production break caught: line ordering or partial append authorizes an untrusted rollback digest.
      bootstrap();
      if (mutation === "reordered") {
        const deployed = run("deploy", digest("b"), commit("b"));
        expect(deployed.status, deployed.stderr).toBe(0);
      }
      const ledger = join(root, "deployment-state/secure-images.tsv");
      const original = readFileSync(ledger, "utf8");
      const rows = original.trimEnd().split(/\r?\n/);
      const mutated = mutation === "duplicate" ? `${original}${rows[0]}\n`
        : mutation === "malformed" ? "not-a-ledger-row\n"
          : mutation === "truncated" ? original.slice(0, -12)
            : `${rows.reverse().join("\n")}\n`;
      writeFileSync(ledger, mutated);
      writeFileSync(eventLog, "");
      const result = run("deploy", digest("c"), commit("c"), { slot: mutation === "reordered" ? "blue" : "green" });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("secure ledger");
      expect(readFileSync(eventLog, "utf8")).toBe("");
    },
    20_000,
  );
});
