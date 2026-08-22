import { spawnSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../..");
const docker = process.platform === "win32" ? "docker.exe" : "docker";
const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "/bin/bash";
const source = "https://github.com/explorers-earth/explorers.earth";
const containment = "d226f7e4dc5a54195a59804ec729f72b5e8f10d7";
const marker = "0013_publication_operation_database_clock";
const resourceScope = "music-c10-release";
const project = `music-c10-release-${randomBytes(4).toString("hex")}`;
const registryContainer = `${project}-registry`;
const secretVolume = `${project}-secrets`;
const root = privateTemporaryDirectory(join(tmpdir(), `${project}-`));
const composeFile = join(root, "docker-compose.yml");
const environmentFile = join(root, "production.env");
const requestFile = join(root, "request.txt");
const hmacFile = join(root, "hmac.key");
const curlShim = join(root, "fixture-curl.sh");
const publicProbeHeaders = join(root, "public-probe.headers");
const derivedDockerfile = join(root, "Dockerfile.candidate");
const baseImage = `${project}-base:local`;
const localTags: string[] = [];
let registryStarted = false;
let composeCreated = false;
let labelsVerified = false;
let secretVolumeCreated = false;
let dockerAuthorityValidated = false;
let dockerEndpoint = "";

function privateTemporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(prefix);
  if (process.platform !== "win32") {
    chmodSync(directory, 0o700);
    return directory;
  }
  const identity = spawnSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const sid = identity.stdout.match(/,"([^"]+)"\s*$/)?.[1];
  assert(identity.status === 0 && sid !== undefined, "Windows fixture identity is unavailable");
  const hardened = spawnSync("icacls.exe", [directory, "/inheritance:r", "/grant:r",
    `*${sid}:(OI)(CI)(F)`, "*S-1-5-18:(OI)(CI)(F)", "*S-1-5-32-544:(OI)(CI)(F)"], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert(hardened.status === 0, "Windows fixture root hardening failed");
  return directory;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sanitize(value: string): string {
  return value
    .replaceAll(root, "<fixture-root>")
    .replaceAll(root.replaceAll("\\", "/"), "<fixture-root>")
    .replace(/[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\\/\s]+/gi, "<developer-home>")
    .replace(/(?:Bearer\s+)?[A-Za-z0-9_-]{32,}/g, "<redacted>")
    .slice(-2_000);
}

function run(
  phase: string,
  file: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number; allowFailure?: boolean; input?: string } = {},
) {
  const result = spawnSync(file, args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    timeout: options.timeoutMs ?? 120_000,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
    input: options.input,
  });
  const status = result.status ?? (result.error ? 127 : 1);
  if (!options.allowFailure && status !== 0) {
    throw new Error(`${phase} failed with exit ${status}: ${sanitize(`${result.stdout ?? ""}\n${result.stderr ?? ""}`)}`);
  }
  return { status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function dockerRun(phase: string, args: string[], options: { timeoutMs?: number; allowFailure?: boolean; input?: string } = {}) {
  assert(dockerAuthorityValidated && dockerEndpoint !== "", "local Docker authority is not validated");
  return run(phase, docker, ["--host", dockerEndpoint, ...args], {
    timeoutMs: options.timeoutMs,
    allowFailure: options.allowFailure,
    input: options.input,
  });
}

function validateLocalDockerAuthority(): void {
  assert(process.env.DOCKER_HOST === undefined && process.env.DOCKER_CONTEXT === undefined,
    "ambient Docker endpoint overrides are forbidden");
  const selected = run("local Docker context selection", docker, ["context", "show"], { allowFailure: true });
  const context = selected.stdout.trim();
  assert(selected.status === 0 && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(context),
    "effective Docker context is invalid");
  const inspection = run("local Docker endpoint inspection", docker, [
    "context", "inspect", "--format", "{{.Endpoints.docker.Host}}", context,
  ], { allowFailure: true });
  const endpoint = inspection.stdout.trim();
  const pipePrefix = "npipe:////./pipe/";
  const localNamedPipe = endpoint.startsWith(pipePrefix)
    && /^[A-Za-z0-9_.-]+$/.test(endpoint.slice(pipePrefix.length));
  const localUnixSocket = endpoint.startsWith("unix:///")
    && endpoint.length > "unix:///".length
    && !/\s/.test(endpoint);
  assert(inspection.status === 0 && (localNamedPipe || localUnixSocket),
    "effective Docker endpoint must be a local named pipe or Unix socket");
  dockerEndpoint = endpoint;
  dockerAuthorityValidated = true;
}

function requireLocalImage(image: string): void {
  const inspection = dockerRun("local image prerequisite", ["image", "inspect", image], { allowFailure: true });
  assert(inspection.status === 0, `required preloaded image is unavailable: ${image}`);
}

function shellPath(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  return process.platform === "win32" ? `/${normalized[0]!.toLowerCase()}${normalized.slice(2)}` : normalized;
}

function privateFile(path: string, value: string): void {
  writeFileSync(path, value, { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
}

function secret(): string {
  return randomBytes(32).toString("base64url");
}

async function unusedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveReady, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveReady());
  });
  const address = server.address();
  assert(address && typeof address !== "string", "could not reserve a loopback port");
  const port = address.port;
  await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return port;
}

function labels() {
  return {
    "com.explorers.fixture.scope": resourceScope,
    "com.explorers.fixture.project": project,
  };
}

function tunesEnvironment(slot: "blue" | "green") {
  const upper = slot.toUpperCase();
  return {
    NODE_ENV: "production",
    PORT: "5000",
    MUSIC_MODE: "live",
    MUSIC_DATABASE_HOST: "db",
    MUSIC_DATABASE_PORT: "5432",
    MUSIC_DATABASE_NAME: "music_release_fixture",
    MUSIC_DATABASE_USER: "music_runtime_login",
    MUSIC_DATABASE_MIGRATOR_USER: "music_migrator",
    MUSIC_DATABASE_PASSWORD_FILE: "/run/music-secrets/database-runtime",
    SESSION_SECRET: "${SESSION_SECRET}",
    COOKIE_SECRET: "${COOKIE_SECRET}",
    STRAPI_URL: "${STRAPI_URL}",
    MUSIC_STRAPI_ALLOWED_ORIGINS: "https://8.8.8.8",
    STRAPI_ACCESS_TOKEN: "${STRAPI_ACCESS_TOKEN}",
    STRAPI_JWT_SECRET: "${STRAPI_JWT_SECRET}",
    STRAPI_LIFECYCLE_PROOF_TOKEN_FILE: "/run/music-secrets/strapi-lifecycle",
    TRUST_PROXY_HOPS: "1",
    MUSIC_TRUSTED_PROXY_IP: "${TRAEFIK_PROXY_IP}",
    ALLOWED_ORIGINS: "https://localtunes.earth",
    MUSIC_GATE_ATTESTATION_KEY: "${MUSIC_GATE_ATTESTATION_KEY}",
    MUSIC_DEPLOYMENT_HEALTH_ENABLED: "true",
    MUSIC_NEW_ENTRY_KILL_SWITCH: "true",
    MUSIC_COHORT_ENABLED: "false",
    MUSIC_TOKEN_CURRENT_KID: "fixture-token-current-v1",
    MUSIC_TOKEN_CURRENT_SECRET_FILE: "/run/music-secrets/music-token/current",
    MUSIC_TOKEN_LIFETIME_SECONDS: "600",
    MUSIC_TOKEN_CLOCK_SKEW_SECONDS: "15",
    MUSIC_PUBLICATION_RESPONSE_CURRENT_KID: "fixture-publication-current-v1",
    MUSIC_PUBLICATION_RESPONSE_CURRENT_KEY_FILE: "/run/music-secrets/music-publication-response/current",
    MUSIC_IMAGE_DIGEST: `\${TUNES_${upper}_DIGEST}`,
    MUSIC_IMAGE_COMMIT: `\${TUNES_${upper}_COMMIT}`,
    MUSIC_MIGRATION_MARKER: `\${TUNES_${upper}_MIGRATION}`,
    MUSIC_GATE_ATTESTATION_PATH: `/deployment-gates/\${TUNES_${upper}_DIGEST}.json`,
  };
}

function tunesService(slot: "blue" | "green") {
  const upper = slot.toUpperCase();
  return {
    image: `\${TUNES_${upper}_IMAGE}`,
    pull_policy: "never",
    restart: "unless-stopped",
    depends_on: { db: { condition: "service_healthy" } },
    environment: tunesEnvironment(slot),
    volumes: [
      "music-gate-attestations:/deployment-gates:ro",
      "fixture-secrets:/run/music-secrets:ro",
    ],
    networks: ["proxy", "internal"],
    healthcheck: {
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:5000/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"],
      interval: "2s",
      timeout: "2s",
      retries: 20,
    },
    labels: labels(),
  };
}

function writeRequest(operation: "bootstrap" | "deploy" | "rollback", digest: string, commit: string, legacyService: string): void {
  privateFile(requestFile, [
    "music-deploy-request-v2",
    `operation=${operation}`,
    `digest=${digest}`,
    `commit=${commit}`,
    `compose_project=${operation === "bootstrap" ? project : "-"}`,
    `legacy_service=${operation === "bootstrap" ? legacyService : "-"}`,
    "",
  ].join("\n"));
}

function deploymentEnvironment(registryPort: number, traefikProxyIp: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) if (name.startsWith("MUSIC_DEPLOY_")) delete environment[name];
  return {
    ...environment,
    MUSIC_DEPLOY_MODE: "fixture",
    MUSIC_DEPLOY_TEST_MODE: "1",
    MUSIC_DEPLOY_FIXTURE_ACK: "C10_LOCAL_REGISTRY_DISPOSABLE_ONLY",
    MUSIC_DEPLOY_FIXTURE_REGISTRY: `127.0.0.1:${registryPort}`,
    MUSIC_DEPLOY_FIXTURE_COMPOSE_PROJECT: project,
    MUSIC_DEPLOY_ROOT: shellPath(root),
    MUSIC_DEPLOY_REQUEST_FILE: shellPath(requestFile),
    MUSIC_DEPLOY_HMAC_KEY_FILE: shellPath(hmacFile),
    MUSIC_DEPLOY_TEST_CURL_COMMAND: shellPath(curlShim),
    MUSIC_DEPLOY_TEST_READINESS_ATTEMPTS: "20",
    TRAEFIK_PROXY_IP: traefikProxyIp,
    ...extra,
  };
}

function deploy(registryPort: number, traefikProxyIp: string, extra: NodeJS.ProcessEnv = {}, allowFailure = false) {
  return run("shared deployment engine", bash, [
    "--noprofile", "--norc", shellPath(join(repoRoot, "tunes/deployment/music-deploy-fixture.sh")),
  ], { env: deploymentEnvironment(registryPort, traefikProxyIp, extra), timeoutMs: 8 * 60_000, allowFailure });
}

function compose(args: string[], allowFailure = false) {
  return dockerRun("fixture Compose", [
    "compose", "-p", project, "--project-directory", root, "--env-file", environmentFile,
    "-f", composeFile, ...args,
  ], { timeoutMs: 3 * 60_000, allowFailure });
}

function activeState(): { slot: string; digest: string; commit: string } {
  const fields = readFileSync(join(root, "deployment-state/music-state.tsv"), "utf8").trim().split("\t");
  assert(fields.length === 10 && fields[0] === "music-state-v2", "deployment state evidence is malformed");
  return { slot: fields[2]!, digest: fields[3]!, commit: fields[4]! };
}

function publicJson(path: string, method: "GET" | "POST" = "GET", expectedStatus = 200): Record<string, unknown> {
  privateFile(publicProbeHeaders, "");
  const result = run("public fixture probe", bash, [
    shellPath(curlShim), "--silent", "--show-error",
    ...(method === "POST" ? ["--request", "POST", "--data", "{}"] : []),
    "--dump-header", shellPath(publicProbeHeaders),
    `https://localtunes.earth${path}`,
  ], {
    timeoutMs: 15_000,
  });
  const statusMatches = Array.from(readFileSync(publicProbeHeaders, "utf8").matchAll(/^HTTP\/\S+\s+(\d{3})/gm));
  const actualStatus = Number(statusMatches.at(-1)?.[1] ?? 0);
  assert(actualStatus === expectedStatus,
    `public fixture probe status mismatch: expected=${expectedStatus}, actual=${actualStatus || "transport"}`);
  privateFile(publicProbeHeaders, "");
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function verifyResourceLabels(): void {
  const ids = dockerRun("fixture resource discovery", [
    "ps", "-a", "--filter", `label=com.docker.compose.project=${project}`, "--format", "{{.ID}}",
  ]).stdout.split(/\r?\n/).filter(Boolean);
  assert(ids.length >= 4, "disposable deployment services are missing");
  const inspected = JSON.parse(dockerRun("fixture label verification", ["inspect", ...ids]).stdout) as Array<{
    Config?: { Labels?: Record<string, string> };
  }>;
  assert(inspected.every((entry) => entry.Config?.Labels?.["com.explorers.fixture.scope"] === resourceScope
    && entry.Config.Labels["com.explorers.fixture.project"] === project), "disposable deployment labels are invalid");
  const registryInspection = JSON.parse(dockerRun("registry label verification", ["inspect", registryContainer]).stdout) as Array<{
    Config?: { Labels?: Record<string, string> };
  }>;
  assert(registryInspection[0]?.Config?.Labels?.["com.explorers.fixture.scope"] === resourceScope
    && registryInspection[0]?.Config?.Labels?.["com.explorers.fixture.project"] === project,
  "loopback registry labels are invalid");
  const volumeInspection = JSON.parse(dockerRun("secret volume label verification", ["volume", "inspect", secretVolume]).stdout) as Array<{
    Labels?: Record<string, string>;
  }>;
  assert(volumeInspection[0]?.Labels?.["com.explorers.fixture.scope"] === resourceScope
    && volumeInspection[0]?.Labels?.["com.explorers.fixture.project"] === project,
  "secret volume labels are invalid");
  labelsVerified = true;
}

function cleanupLabelsAreAuthorized(): boolean {
  const ids = dockerRun("cleanup resource discovery", [
    "ps", "-a", "--filter", `label=com.docker.compose.project=${project}`, "--format", "{{.ID}}",
  ], { allowFailure: true }).stdout.split(/\r?\n/).filter(Boolean);
  if (ids.length) {
    const inspected = JSON.parse(dockerRun("cleanup label verification", ["inspect", ...ids], { allowFailure: true }).stdout || "[]") as Array<{
      Config?: { Labels?: Record<string, string> };
    }>;
    if (inspected.length !== ids.length || !inspected.every((entry) => entry.Config?.Labels?.["com.explorers.fixture.scope"] === resourceScope
      && entry.Config.Labels["com.explorers.fixture.project"] === project)) return false;
  }
  if (registryStarted) {
    const inspection = dockerRun("cleanup registry label verification", ["inspect", registryContainer], { allowFailure: true });
    if (inspection.status !== 0) return false;
    const rows = JSON.parse(inspection.stdout) as Array<{ Config?: { Labels?: Record<string, string> } }>;
    if (rows[0]?.Config?.Labels?.["com.explorers.fixture.scope"] !== resourceScope
      || rows[0]?.Config?.Labels?.["com.explorers.fixture.project"] !== project) return false;
  }
  if (secretVolumeCreated) {
    const inspection = dockerRun("cleanup secret volume label verification", ["volume", "inspect", secretVolume], { allowFailure: true });
    if (inspection.status !== 0) return false;
    const rows = JSON.parse(inspection.stdout) as Array<{ Labels?: Record<string, string> }>;
    if (rows[0]?.Labels?.["com.explorers.fixture.scope"] !== resourceScope
      || rows[0]?.Labels?.["com.explorers.fixture.project"] !== project) return false;
  }
  return true;
}

async function main(): Promise<void> {
  validateLocalDockerAuthority();
  assert(basename(root).startsWith(`${project}-`), "unsafe fixture root");
  const commit = run("source commit", "git", ["rev-parse", "HEAD"]).stdout.trim();
  assert(/^[a-f0-9]{40}$/.test(commit), "source commit is invalid");
  const registryPort = await unusedPort();
  const traefikPort = await unusedPort();
  const repository = `127.0.0.1:${registryPort}/explorers-tunes`;
  const legacyService = `${project}-legacy`;

  for (const image of ["registry:2", "postgres:15-alpine", "traefik:v3.1", "node:22.12-alpine"]) {
    requireLocalImage(image);
  }

  const secretDirectory = join(root, "secrets");
  const tokenDirectory = join(secretDirectory, "music-token");
  const publicationDirectory = join(secretDirectory, "music-publication-response");
  mkdirSync(tokenDirectory, { recursive: true, mode: 0o700 });
  mkdirSync(publicationDirectory, { recursive: true, mode: 0o700 });
  const secretPaths = {
    tokenDirectory,
    publicationDirectory,
    runtimePassword: join(secretDirectory, "database-runtime"),
    migratorPassword: join(secretDirectory, "database-migrator"),
    lifecycle: join(secretDirectory, "strapi-lifecycle"),
    reconciliation: join(secretDirectory, "strapi-reconciliation"),
  };
  const migratorPassword = secret();
  const tokenSecret = secret();
  const publicationSecret = secret();
  const runtimePassword = secret();
  const lifecycleSecret = secret();
  privateFile(join(tokenDirectory, "current"), tokenSecret);
  privateFile(join(publicationDirectory, "current"), publicationSecret);
  privateFile(secretPaths.runtimePassword, runtimePassword);
  privateFile(secretPaths.migratorPassword, migratorPassword);
  privateFile(secretPaths.lifecycle, lifecycleSecret);
  privateFile(secretPaths.reconciliation, secret());
  const hmacSecret = secret();
  privateFile(hmacFile, hmacSecret);
  privateFile(join(root, ".music-c10-fixture-root"), [
    "music-c10-fixture-root-v1",
    `compose_project=${project}`,
    `registry=127.0.0.1:${registryPort}`,
    "resource_label=com.explorers.fixture.scope=music-c10-release",
    "",
  ].join("\n"));

  const environment = {
    DB_NAME: "music_release_fixture",
    DB_MIGRATOR_USER: "music_migrator",
    DB_RUNTIME_USER: "music_runtime_login",
    SESSION_SECRET: secret(),
    COOKIE_SECRET: secret(),
    STRAPI_URL: "https://8.8.8.8",
    STRAPI_ACCESS_TOKEN: secret(),
    STRAPI_JWT_SECRET: secret(),
    MUSIC_GATE_ATTESTATION_KEY: secret(),
    MUSIC_PUBLICATION_RESPONSE_KEY_DIRECTORY_HOST: publicationDirectory.replaceAll("\\", "/"),
    MUSIC_PUBLICATION_RESPONSE_CURRENT_KID: "fixture-publication-current-v1",
    MUSIC_TOKEN_SECRET_DIRECTORY_HOST: tokenDirectory.replaceAll("\\", "/"),
    MUSIC_TOKEN_CURRENT_KID: "fixture-token-current-v1",
    DB_RUNTIME_PASSWORD_FILE_HOST: secretPaths.runtimePassword.replaceAll("\\", "/"),
    DB_MIGRATOR_PASSWORD_FILE_HOST: secretPaths.migratorPassword.replaceAll("\\", "/"),
    STRAPI_LIFECYCLE_PROOF_TOKEN_FILE_HOST: secretPaths.lifecycle.replaceAll("\\", "/"),
    STRAPI_RECONCILIATION_TOKEN_FILE_HOST: secretPaths.reconciliation.replaceAll("\\", "/"),
  };
  privateFile(environmentFile, `${Object.entries(environment).map(([name, value]) => `${name}=${value}`).join("\n")}\n`);
  privateFile(curlShim, `#!/usr/bin/env bash
set -euo pipefail
mapped=()
for argument in "$@"; do
  if [[ "$argument" == https://localtunes.earth* ]]; then
    mapped+=("http://127.0.0.1:${traefikPort}\${argument#https://localtunes.earth}")
  else
    mapped+=("$argument")
  fi
done
exec curl --header "Host: localtunes.earth" "\${mapped[@]}"
`);
  chmodSync(curlShim, 0o700);

  dockerRun("loopback registry start", [
    "run", "--pull=never", "-d", "--name", registryContainer,
    "--label", `com.explorers.fixture.scope=${resourceScope}`,
    "--label", `com.explorers.fixture.project=${project}`,
    "-p", `127.0.0.1:${registryPort}:5000`, "registry:2",
  ], { timeoutMs: 3 * 60_000 });
  registryStarted = true;
  let registryReady = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${registryPort}/v2/`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) { registryReady = true; break; }
    } catch { /* bounded readiness retry */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  assert(registryReady, "loopback registry did not become ready");

  const transferLocalImage = (sourceImage: string, repositoryName: string): string => {
    const repository = `127.0.0.1:${registryPort}/${repositoryName}`;
    const tag = `${repository}:fixture`;
    dockerRun(`${repositoryName} local tag`, ["image", "tag", sourceImage, tag]);
    localTags.push(tag);
    dockerRun(`${repositoryName} loopback transfer`, ["push", tag], { timeoutMs: 3 * 60_000 });
    const repoDigests = dockerRun(`${repositoryName} digest inspection`, [
      "image", "inspect", "--format", "{{range .RepoDigests}}{{println .}}{{end}}", tag,
    ]).stdout.split(/\r?\n/).filter((value) => value.startsWith(`${repository}@sha256:`));
    assert(repoDigests.length === 1, `${repositoryName} did not resolve one local digest`);
    const exactImage = repoDigests[0]!;
    dockerRun(`${repositoryName} immutable local inspection`, ["image", "inspect", exactImage]);
    localTags.push(exactImage);
    return exactImage;
  };

  const traefikImage = transferLocalImage("traefik:v3.1", "fixture-traefik");
  const postgresImage = transferLocalImage("postgres:15-alpine", "fixture-postgres");

  dockerRun("exact Tunes source image build", [
    "build", "--pull=false", "--file", join(repoRoot, "tunes/Dockerfile"), "--tag", baseImage,
    "--build-arg", `BUILD_COMMIT=${commit}`, "--build-arg", `BUILD_SOURCE=${source}`,
    join(repoRoot, "tunes"),
  ], { timeoutMs: 15 * 60_000 });
  privateFile(derivedDockerfile, [
    `FROM ${baseImage}`,
    "ARG CANDIDATE",
    `LABEL org.opencontainers.image.revision=${commit}`,
    `LABEL org.opencontainers.image.source=${source}`,
    `LABEL com.explorers.music.minimum-containment-commit=${containment}`,
    "LABEL com.explorers.music.fixture.candidate=$CANDIDATE",
    "",
  ].join("\n"));

  const digests: string[] = [];
  for (const candidate of ["a", "b"] as const) {
    const tag = `${repository}:candidate-${candidate}`;
    localTags.push(tag);
    dockerRun(`candidate ${candidate} build`, [
      "build", "--pull=false", "--file", derivedDockerfile, "--tag", tag, "--build-arg", `CANDIDATE=${candidate}`, root,
    ], { timeoutMs: 3 * 60_000 });
    dockerRun(`candidate ${candidate} loopback transfer`, ["push", tag], { timeoutMs: 3 * 60_000 });
    const repoDigests = dockerRun(`candidate ${candidate} digest inspection`, [
      "image", "inspect", "--format", "{{range .RepoDigests}}{{println .}}{{end}}", tag,
    ]).stdout.split(/\r?\n/).filter((value) => value.startsWith(`${repository}@sha256:`));
    assert(repoDigests.length === 1, `candidate ${candidate} did not resolve one local digest`);
    digests.push(repoDigests[0]!.slice(repository.length + 1));
    dockerRun(`candidate ${candidate} local eviction`, ["image", "rm", tag]);
  }
  const [digestA, digestB] = digests;
  assert(digestA && digestB && digestA !== digestB, "local candidates must have distinct immutable digests");
  const initialImage = `${repository}@${digestA}`;
  dockerRun("initial immutable candidate preload", ["pull", initialImage], { timeoutMs: 3 * 60_000 });
  localTags.push(initialImage, `${repository}@${digestB}`);
  privateFile(environmentFile, `${readFileSync(environmentFile, "utf8")}${[
    `TUNES_BLUE_IMAGE=${repository}@${digestA}`,
    `TUNES_BLUE_DIGEST=${digestA}`,
    `TUNES_BLUE_COMMIT=${commit}`,
    `TUNES_BLUE_MIGRATION=${marker}`,
    `TUNES_GREEN_IMAGE=${repository}@${digestA}`,
    `TUNES_GREEN_DIGEST=${digestA}`,
    `TUNES_GREEN_COMMIT=${commit}`,
    `TUNES_GREEN_MIGRATION=${marker}`,
    `TUNES_CANDIDATE_IMAGE=${repository}@${digestA}`,
    `TUNES_CANDIDATE_DIGEST=${digestA}`,
    `TUNES_CANDIDATE_COMMIT=${commit}`,
    `TUNES_CANDIDATE_MIGRATION=${marker}`,
    `TUNES_COMPAT_IMAGE=${repository}@${digestA}`,
    "TUNES_GATE_ENTRYPOINT=dist/server/deployment/run-migration-gate.js",
    "",
  ].join("\n")}`);

  dockerRun("labeled secret volume creation", [
    "volume", "create",
    "--label", `com.explorers.fixture.scope=${resourceScope}`,
    "--label", `com.explorers.fixture.project=${project}`,
    secretVolume,
  ]);
  secretVolumeCreated = true;
  const writeContainerSecrets = (databaseMigratorPassword: string) => dockerRun("private container secret provisioning", [
    "run", "--pull=never", "--rm", "-i", "-v", `${secretVolume}:/secrets`, baseImage, "sh", "-c", [
      "set -eu", "umask 077", "mkdir -p /secrets/music-token /secrets/music-publication-response",
      "IFS= read -r runtime", "IFS= read -r migrator", "IFS= read -r token", "IFS= read -r publication", "IFS= read -r lifecycle",
      "printf %s \"$runtime\" > /secrets/database-runtime",
      "printf %s \"$migrator\" > /secrets/database-migrator",
      "printf %s \"$token\" > /secrets/music-token/current",
      "printf %s \"$publication\" > /secrets/music-publication-response/current",
      "printf %s \"$lifecycle\" > /secrets/strapi-lifecycle",
      "chmod 600 /secrets/database-runtime /secrets/database-migrator /secrets/music-token/current /secrets/music-publication-response/current /secrets/strapi-lifecycle",
    ].join("; "),
  ], { input: `${runtimePassword}\n${databaseMigratorPassword}\n${tokenSecret}\n${publicationSecret}\n${lifecycleSecret}\n` });
  writeContainerSecrets(migratorPassword);

  const commonVolumes = [
    "music-gate-attestations:/deployment-gates",
    "fixture-secrets:/run/music-secrets:ro",
  ];
  const composeAuthority = {
    name: project,
    services: {
      traefik: {
        image: traefikImage,
        pull_policy: "never",
        command: [
          "--api.dashboard=false",
          "--providers.docker=false",
          "--providers.file.directory=/deployment-routing",
          "--providers.file.watch=true",
          "--entrypoints.websecure.address=:443",
        ],
        ports: [`127.0.0.1:${traefikPort}:443`],
        volumes: [
          `${join(root, "deployment-routing").replaceAll("\\", "/")}:/deployment-routing:ro`,
        ],
        networks: ["proxy"],
        labels: labels(),
      },
      db: {
        image: postgresImage,
        pull_policy: "never",
        environment: {
          POSTGRES_USER: "music_migrator",
          POSTGRES_PASSWORD_FILE: "/run/music-secrets/database-migrator",
          POSTGRES_DB: "music_release_fixture",
        },
        volumes: ["postgres-data:/var/lib/postgresql/data", "fixture-secrets:/run/music-secrets:ro"],
        networks: ["internal"],
        healthcheck: {
          test: ["CMD-SHELL", "pg_isready -U music_migrator -d music_release_fixture"],
          interval: "2s",
          timeout: "2s",
          retries: 30,
        },
        labels: labels(),
      },
      "legacy-tunes": {
        image: `${repository}@${digestA}`,
        pull_policy: "never",
        container_name: legacyService,
        command: ["node", "-e", "require('node:http').createServer((q,s)=>{s.writeHead(200,{'content-type':'text/plain'});s.end('legacy')}).listen(5000,'0.0.0.0')"],
        networks: ["proxy"],
        labels: labels(),
      },
      "tunes-blue": tunesService("blue"),
      "tunes-green": tunesService("green"),
      "tunes-gate": {
        profiles: ["deployment"],
        image: "${TUNES_CANDIDATE_IMAGE}",
        pull_policy: "never",
        restart: "no",
        command: ["node", "${TUNES_GATE_ENTRYPOINT:-dist/server/deployment/run-migration-gate.js}"],
        environment: {
          MUSIC_MODE: "live",
          MUSIC_DATABASE_HOST: "db",
          MUSIC_DATABASE_PORT: "5432",
          MUSIC_DATABASE_NAME: "music_release_fixture",
          MUSIC_DATABASE_USER: "music_migrator",
          MUSIC_DATABASE_PASSWORD_FILE: "/run/music-secrets/database-migrator",
          MUSIC_RUNTIME_DATABASE_USER: "music_runtime_login",
          MUSIC_RUNTIME_DATABASE_PASSWORD_FILE: "/run/music-secrets/database-runtime",
          MUSIC_IMAGE_DIGEST: "${TUNES_CANDIDATE_DIGEST}",
          MUSIC_IMAGE_COMMIT: "${TUNES_CANDIDATE_COMMIT}",
          MUSIC_MIGRATION_MARKER: "${TUNES_CANDIDATE_MIGRATION}",
          MUSIC_GATE_ATTESTATION_KEY: "${MUSIC_GATE_ATTESTATION_KEY}",
          MUSIC_GATE_ATTESTATION_PATH: "/deployment-gates/${TUNES_CANDIDATE_DIGEST}.json",
        },
        depends_on: { db: { condition: "service_healthy" } },
        volumes: commonVolumes,
        networks: ["internal"],
        labels: labels(),
      },
      "tunes-register-compat": {
        profiles: ["deployment"],
        image: "${TUNES_COMPAT_IMAGE}",
        pull_policy: "never",
        restart: "unless-stopped",
        command: ["node", "dist/server/deployment/run-registration-compat.js"],
        environment: { PORT: "5100" },
        networks: ["proxy"],
        labels: labels(),
      },
    },
    networks: { proxy: {}, internal: { internal: true } },
    volumes: {
      "postgres-data": {},
      "music-gate-attestations": {},
      "fixture-secrets": { external: true, name: secretVolume },
    },
  };
  privateFile(composeFile, `${JSON.stringify(composeAuthority, null, 2)}\n`);
  composeCreated = true;
  compose(["up", "-d", "db", "legacy-tunes", "traefik"]);
  const traefikContainerId = compose(["ps", "-q", "traefik"]).stdout.trim();
  assert(/^[a-f0-9]{12,64}$/.test(traefikContainerId), "fixture Traefik container is missing");
  const traefikNetworks = JSON.parse(dockerRun("fixture Traefik network inspection", [
    "inspect", "--format", "{{json .NetworkSettings.Networks}}", traefikContainerId,
  ]).stdout) as Record<string, { IPAddress?: string }>;
  const traefikProxyIp = Object.entries(traefikNetworks)
    .find(([name]) => name.endsWith("_proxy"))?.[1].IPAddress;
  assert(traefikProxyIp && /^(?:\d{1,3}\.){3}\d{1,3}$/.test(traefikProxyIp), "fixture Traefik proxy address is invalid");
  privateFile(environmentFile, `${readFileSync(environmentFile, "utf8")}TRAEFIK_PROXY_IP=${traefikProxyIp}\n`);
  const imageAuthorityPayload = [
    "music-c10-fixture-images-v1",
    `tunes=${repository}@${digestA}`,
    `postgres=${postgresImage}`,
    `traefik=${traefikImage}`,
    `commit=${commit}`,
    `migration=${marker}`,
    `proxy_ip=${traefikProxyIp}`,
  ].join("\n");
  privateFile(join(root, ".music-c10-fixture-images"), `${imageAuthorityPayload}\nmac=${
    createHmac("sha256", hmacSecret).update(imageAuthorityPayload).digest("hex")
  }\n`);

  writeContainerSecrets(secret());
  writeRequest("bootstrap", digestA, commit, legacyService);
  const migrationFailure = deploy(registryPort, traefikProxyIp, {}, true);
  assert(migrationFailure.status !== 0, "migration credential fault unexpectedly promoted");
  assert(readFileSync(join(root, "deployment-routing/music-router.yml"), "utf8").includes(`http://${legacyService}:5000`),
    "migration failure changed the general-service target");
  writeContainerSecrets(migratorPassword);
  const bootstrap = deploy(registryPort, traefikProxyIp, {}, true);
  if (bootstrap.status !== 0) {
    const serviceLogs = compose(["logs", "--no-color", "--tail", "80", "tunes-blue"], true);
    const serviceDiagnostics = serviceLogs.stdout.split(/\r?\n/)
      .filter((line) => /Failed to start server|Error:|Database initialized|Server listening/i.test(line))
      .slice(-10).join("\n");
    const gateDiagnostics = bootstrap.stderr.split(/\r?\n/)
      .filter((line) => /(?:Music migration deployment gate failed|error:|password|database|permission|candidate|readiness|containment)/i.test(line))
      .slice(-20).join("\n");
    throw new Error(`exact bootstrap failed: ${sanitize(`${serviceDiagnostics}\n${gateDiagnostics}`)}`);
  }
  assert(bootstrap.status === 0 && activeState().digest === digestA, "exact bootstrap did not promote candidate A");

  const stableRoute = readFileSync(join(root, "deployment-routing/music-router.yml"));
  const stableState = readFileSync(join(root, "deployment-state/music-state.tsv"));
  const normalEnvironment = readFileSync(environmentFile, "utf8");
  privateFile(environmentFile, normalEnvironment.replace("STRAPI_URL=https://8.8.8.8", "STRAPI_URL=http://8.8.8.8"));
  writeRequest("deploy", digestB, commit, legacyService);
  const readinessFailure = deploy(registryPort, traefikProxyIp, { MUSIC_DEPLOY_TEST_READINESS_ATTEMPTS: "1" }, true);
  assert(readinessFailure.status !== 0, "readiness fault unexpectedly promoted");
  assert(readFileSync(join(root, "deployment-routing/music-router.yml")).equals(stableRoute)
    && readFileSync(join(root, "deployment-state/music-state.tsv")).equals(stableState),
  "readiness failure changed prior route or state authority");
  privateFile(environmentFile, normalEnvironment);
  assert(deploy(registryPort, traefikProxyIp).status === 0 && activeState().digest === digestB, "candidate B promotion failed");

  writeRequest("rollback", digestA, "-", legacyService);
  assert(deploy(registryPort, traefikProxyIp).status === 0, "exact digest rollback failed");
  const rolledBack = activeState();
  assert(rolledBack.digest === digestA && rolledBack.commit === commit, "rollback did not restore exact candidate A");
  const ready = publicJson("/health/ready");
  assert(ready.ready === true && ready.digest === digestA && ready.commit === commit && ready.migrationMarker === marker,
    "public readiness did not bind exact rollback authority");

  writeRequest("rollback", `sha256:${"f".repeat(64)}`, "-", legacyService);
  const unknownRollback = deploy(registryPort, traefikProxyIp, {}, true);
  assert(unknownRollback.status !== 0 && unknownRollback.stderr.includes("unknown secure digest"),
    "unknown rollback was not refused by signed history");
  writeRequest("rollback", digestA, "-", legacyService);
  const preFloorRollback = deploy(registryPort, traefikProxyIp, {
    MUSIC_DEPLOY_TEST_CURRENT_MARKER_OVERRIDE: "0012_publication_replay_expiry_guard",
  }, true);
  assert(preFloorRollback.status !== 0 && /schema compatibility floor/i.test(preFloorRollback.stderr),
    "older schema-floor executable was not refused");

  const entryPolicy = publicJson("/api/music-entry/status");
  assert(entryPolicy.killSwitch === true && entryPolicy.newMusicEntryEnabled === false && entryPolicy.legacyMusicEntryEnabled === false,
    "kill switch did not keep both Music entry paths closed");
  const compatibility = publicJson("/api/register", "POST", 410);
  assert((compatibility.error as { code?: string } | undefined)?.code === "LEGACY_IDENTITY_ROUTE_REMOVED",
    "compatibility route did not retain the typed denial");

  verifyResourceLabels();
  process.stdout.write(`${JSON.stringify({
    schemaVersion: "music-operation/v1",
    metric: "real-docker-release",
    compatibilityRouteUsage: 0,
    migrationFailureObserved: true,
    readinessFailureObserved: true,
    rollbackRestored: true,
    unknownRollbackRefused: true,
    preFloorRollbackRefused: true,
    killSwitchVerified: true,
  })}\n`);
}

try {
  await main();
} finally {
  if (dockerAuthorityValidated) {
    const cleanupAuthorized = cleanupLabelsAreAuthorized();
    if (composeCreated && cleanupAuthorized) compose(["--profile", "deployment", "down", "--volumes", "--remove-orphans"], true);
    else if (composeCreated) compose(["stop"], true);
    if (registryStarted && cleanupAuthorized) dockerRun("loopback registry cleanup", ["rm", "-f", registryContainer], { allowFailure: true });
    if (secretVolumeCreated && cleanupAuthorized) dockerRun("secret volume cleanup", ["volume", "rm", secretVolume], { allowFailure: true });
    for (const image of [...localTags, baseImage]) dockerRun("local image cleanup", ["image", "rm", "--force", image], { allowFailure: true });
    if (labelsVerified) {
      const leftovers = dockerRun("cleanup verification", [
        "ps", "-a", "--filter", `label=com.explorers.fixture.project=${project}`, "--format", "{{.ID}}",
      ], { allowFailure: true }).stdout.trim();
      assert(leftovers === "", "labeled disposable containers remain after cleanup");
    }
    assert(cleanupAuthorized, "fixture cleanup refused resources with missing or mismatched labels");
  } else {
    assert(!registryStarted && !composeCreated && !secretVolumeCreated && localTags.length === 0,
      "Docker mutation occurred before local endpoint validation");
  }
  assert(basename(root).startsWith(`${project}-`) && root.startsWith(tmpdir()), "unsafe fixture cleanup root");
  rmSync(root, { recursive: true, force: true });
}
