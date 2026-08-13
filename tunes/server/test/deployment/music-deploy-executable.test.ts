import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
if [[ "\${!#}" == "https://localtunes.earth/" ]]; then grep -Fq 'http://legacy-tunes:5000' "$MUSIC_DEPLOY_ROOT/deployment-routing/music-router.yml"; printf 'legacy-ok'; exit 0; fi
grep -Fq "http://tunes-$MUSIC_DEPLOY_TEST_SLOT:5000" "$MUSIC_DEPLOY_ROOT/deployment-routing/music-router.yml"
if [[ "\${MUSIC_DEPLOY_TEST_PUBLIC_RESPONSE_MODE:-}" == nonzero ]]; then printf '${publicResponseSentinel}'; exit 22; fi
if [[ "\${MUSIC_DEPLOY_TEST_PUBLIC_RESPONSE_MODE:-}" == invalid-json ]]; then printf '${publicResponseSentinel}'; exit 0; fi
printf '{"ready":true,"digest":"%s","commit":"%s","migrationMarker":"containment-no-schema-change"}\\n' "$MUSIC_DEPLOY_TEST_DIGEST" "$MUSIC_DEPLOY_TEST_COMMIT"
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
    chmodSync(join(fakeBin, "docker"), 0o755);
    chmodSync(join(fakeBin, "curl"), 0o755);
    chmodSync(join(fakeBin, "node"), 0o755);
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
        MUSIC_DEPLOY_TEST_COMMIT: requestedCommit === "-" ? commit("a") : requestedCommit,
        MUSIC_DEPLOY_TEST_SLOT: options.slot ?? (operation === "bootstrap" ? "blue" : "green"),
        MUSIC_DEPLOY_TEST_OCI_COMMIT: options.ociCommit ?? "",
        MUSIC_DEPLOY_TEST_OCI_SOURCE: options.ociSource ?? "",
        MUSIC_DEPLOY_TEST_OCI_CONTAINMENT: options.ociContainment ?? "",
        MUSIC_DEPLOY_TEST_PUBLIC_RESPONSE_MODE: options.publicResponseMode ?? "",
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

  it("bootstraps through the exact executable with one visible route and signed state", () => {
    // Production break caught: the runbook diverges from production transaction behavior.
    bootstrap();
    expect(readFileSync(join(root, "deployment-routing/music-router.yml"), "utf8")).toContain("http://tunes-blue:5000");
    for (const file of ["music-state.tsv", "secure-images.tsv", "music-floor.tsv"]) {
      expect(readFileSync(join(root, "deployment-state", file), "utf8")).toMatch(/\t[a-f0-9]{64}\n?$/);
    }
    expect(existsSync(join(root, "deployment-transactions/current"))).toBe(false);
    const events = readFileSync(eventLog, "utf8");
    expect(events).toContain("curl --fail --silent --show-error --max-time 5 https://localtunes.earth/ | route=http://legacy-tunes:5000");
    expect(events).toContain(`docker pull ${repository}@${digest("a")}`);
  });

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
    const expectedPayload = ["music-ledger-v2", repository, "1", digest("a"), commit("a"), "containment-no-schema-change", "GENESIS"].join("\t");
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
  });

  it.each(["state", "floor"])("rejects %s authority tamper before Docker", (authority) => {
    // Production break caught: mutable host state changes the active slot or permanent rollback floor.
    bootstrap();
    const path = join(root, "deployment-state", authority === "state" ? "music-state.tsv" : "music-floor.tsv");
    const bytes = readFileSync(path, "utf8");
    writeFileSync(path, bytes.replace(/[a-f0-9](\r?\n)?$/, "0$1"));
    writeFileSync(eventLog, "");
    const result = run("deploy", digest("b"), commit("b"));
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(authority === "state" ? /deployment state (HMAC mismatch|malformed)/ : /rollback floor (HMAC mismatch|malformed)/);
    expect(readFileSync(eventLog, "utf8")).toBe("");
  });

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
