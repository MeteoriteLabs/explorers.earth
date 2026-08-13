import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statfsSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { isAbsolute, join, resolve, win32 as windowsPath } from "node:path";
import { parseMusicEnvironment } from "../server/config/music-environment.ts";
import { MUSIC_COMPOSE_PROJECT, validateComposeModel, validateOwnedResources, type ComposeModel } from "./music-compose-safety.ts";
import { OwnedProcessRunner } from "./music-process-runner.ts";

export const MUSIC_CLI_SCHEMA_VERSION = "music-cli/v1";
export const FIXTURE_SCHEMA_VERSION = "strapi-identity-fixture/v1";
export const EXIT = { success: 0, verification: 1, usage: 2, prerequisite: 3, dependency: 4, safety: 5, interrupted: 130 } as const;

export interface StrapiIdentityFixture {
  schemaVersion: "strapi-identity-fixture/v1";
  fixtureVersion: string;
  identities: Array<{ user: { documentId?: string; blocked?: boolean; is_subscribed?: boolean; accounts: Array<{ documentId?: string; Account_Name?: string; Account_Type?: string; mobile_number?: string; localtunes_integrated?: "Yes" | "No" }> } }>;
  pagination?: { page?: number; pageCount?: number; pageSize?: number; total?: number };
  serviceToken?: { operations: string[] };
}

export function validateStrapiFixture(fixture: StrapiIdentityFixture, options: { mode: "fixture" | "live"; readOnlyCredential?: string }): void {
  if (fixture.schemaVersion !== FIXTURE_SCHEMA_VERSION) throw new Error("unsupported fixture schema");
  if (!fixture.fixtureVersion) throw new Error("fixtureVersion is required");
  if (options.mode === "live" && !options.readOnlyCredential) throw new Error("LIVE_STRAPI_READ_ONLY_CREDENTIAL is required");
  fixture.identities.forEach((identity, index) => {
    if (!identity.user.documentId) throw new Error(`identity[${index}].user.documentId is required`);
    if (typeof identity.user.blocked !== "boolean") throw new Error(`identity[${index}].user.blocked must be boolean`);
    if (typeof identity.user.is_subscribed !== "boolean") throw new Error(`identity[${index}].user.is_subscribed must be boolean`);
    const completed = identity.user.accounts.filter((account) => account.Account_Name && account.Account_Type && account.mobile_number);
    if (completed.length !== 1) throw new Error(`identity[${index}] has ${completed.length === 0 ? "no" : "ambiguous"} completed Accounts`);
    if (!completed[0].documentId) throw new Error(`identity[${index}].accounts completed Account documentId is required`);
    if (completed[0].localtunes_integrated !== "Yes" && completed[0].localtunes_integrated !== "No") throw new Error(`identity[${index}].accounts completed Account localtunes_integrated must be Yes or No`);
  });
  if (fixture.pagination && (!Number.isInteger(fixture.pagination.page) || !Number.isInteger(fixture.pagination.pageCount) || !Number.isInteger(fixture.pagination.pageSize) || !Number.isInteger(fixture.pagination.total))) throw new Error("pagination metadata is truncated");
  if (fixture.pagination && (fixture.pagination.page! < 1 || fixture.pagination.pageCount! < 1 || fixture.pagination.page! > fixture.pagination.pageCount! || fixture.pagination.pageSize! < 1 || fixture.pagination.total! < fixture.identities.length)) throw new Error("pagination metadata is inconsistent");
  if (fixture.serviceToken?.operations.some((operation) => !operation.startsWith("GET ") && !operation.startsWith("HEAD "))) throw new Error("service token operation must be read-only");
}

type OutputFormat = "human" | "json";
type Mode = "fixture" | "live";
interface ParsedArgs { command: string; mode: Mode; format: OutputFormat; detach: boolean; wait: boolean; volumes: boolean; confirmProject?: string; resume?: string; }
interface RunResult { status: "success" | "failure" | "blocked"; phase: string; exitCode: number; artifacts?: string[]; checkpoint?: string; error?: string; }
interface RunContext { commit: string; fixtureVersion: string; fixtureSchemaVersion: string; gateValues: Record<string, string>; environmentFingerprint: string; }

const root = resolve(import.meta.dirname, "../..");
const artifactRoot = join(root, ".artifacts", "music-runs");
const composeFile = "docker-compose.music-test.yml";
const requiredFiles = [composeFile, ".env.music.example", ".env.music.test.example", "fixtures/strapi/music-identity/identity.fixture.json", "fixtures/db/music-runtime-table-manifest.json"];
const runner = new OwnedProcessRunner();
let activeRun: { id: string; command: string; format: OutputFormat; started: number; context: RunContext } | undefined;
let childSequence = 0;

class MusicCommandError extends Error {
  readonly phase: string;
  readonly exitCode: number;

  constructor(message: string, phase: string, exitCode: number) {
    super(message);
    this.phase = phase;
    this.exitCode = exitCode;
  }
}
class ResumeMismatchError extends MusicCommandError { constructor(message: string) { super(message, "resume", EXIT.prerequisite); } }
class SafetyError extends MusicCommandError { constructor(message: string, phase = "cleanup-safety") { super(message, phase, EXIT.safety); } }

function parseArgs(args: string[]): ParsedArgs {
  const parsed: Partial<ParsedArgs> = { mode: "fixture", format: "human", detach: false, wait: false, volumes: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument.startsWith("--") && !parsed.command) parsed.command = argument;
    else if (argument === "--mode") parsed.mode = args[++index] as Mode;
    else if (argument === "--format") parsed.format = args[++index] as OutputFormat;
    else if (argument === "--detach") parsed.detach = true;
    else if (argument === "--wait") parsed.wait = true;
    else if (argument === "--volumes") parsed.volumes = true;
    else if (argument === "--confirm-project") parsed.confirmProject = args[++index];
    else if (argument === "--resume") parsed.resume = args[++index];
    else throw new MusicCommandError(`unknown argument: ${argument}`, "arguments", EXIT.usage);
  }
  if (!parsed.command || !["bootstrap", "doctor", "up", "test:smoke", "test:all", "down", "db:status", "db:migrate", "db:reset", "fixtures:capture"].includes(parsed.command)) throw new MusicCommandError("usage: music:<bootstrap|doctor|up|test:smoke|test:all|down|db:status|db:migrate|db:reset|fixtures:capture>", "arguments", EXIT.usage);
  if (!(["fixture", "live"] as string[]).includes(parsed.mode!)) throw new MusicCommandError("--mode must be fixture or live", "arguments", EXIT.usage);
  if (!(["human", "json"] as string[]).includes(parsed.format!)) throw new MusicCommandError("--format must be human or json", "arguments", EXIT.usage);
  return parsed as ParsedArgs;
}

function sanitize(value: string): string {
  return value
    .replace(/(postgres(?:ql)?:\/\/)[^:@/\s]+:[^@/\s]+@/gi, "$1[REDACTED]@")
    .replace(/\b(password|secret|token|api[_-]?key|authorization)\b\s*[:=]\s*[^\s,}]+/gi, "$1=[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]");
}
function redactedError(value: unknown): string { return sanitize(value instanceof Error ? value.message : String(value)); }
function runId(): string { return `${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${randomBytes(4).toString("hex")}`; }
function runDirectory(id: string): string { const directory = join(artifactRoot, id); mkdirSync(directory, { recursive: true }); return directory; }
function writeArtifact(id: string, name: string, content: string): string { const target = join(runDirectory(id), name); writeFileSync(target, sanitize(content)); return target; }

function readEnvFile(file: string): Record<string, string> {
  return Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/).filter((line) => line.trim() && !line.trimStart().startsWith("#")).map((line) => { const separator = line.indexOf("="); if (separator < 1) throw new Error(`invalid environment line in ${file}`); return [line.slice(0, separator), line.slice(separator + 1)]; }));
}

function gitDirectory(): string {
  const dotGit = join(root, ".git");
  const contents = readFileSync(dotGit, "utf8").trim();
  if (!contents.startsWith("gitdir:")) return dotGit;
  const path = contents.slice("gitdir:".length).trim();
  return isAbsolute(path) ? path : resolve(root, path);
}
function readGitSha(): string {
  const gitDir = gitDirectory();
  const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
  if (!head.startsWith("ref:")) return head;
  const reference = head.slice("ref:".length).trim();
  let commonDir = gitDir;
  const commonDirFile = join(gitDir, "commondir");
  if (existsSync(commonDirFile)) commonDir = resolve(gitDir, readFileSync(commonDirFile, "utf8").trim());
  const loose = join(commonDir, reference);
  if (existsSync(loose)) return readFileSync(loose, "utf8").trim();
  const packed = readFileSync(join(commonDir, "packed-refs"), "utf8").split(/\r?\n/).find((line) => line.endsWith(` ${reference}`));
  if (!packed) throw new Error(`cannot resolve Git reference ${reference}`);
  return packed.split(" ")[0];
}

function buildRunContext(): RunContext {
  const fixture = JSON.parse(readFileSync(join(root, "fixtures/strapi/music-identity/identity.fixture.json"), "utf8")) as StrapiIdentityFixture;
  const environmentFile = existsSync(join(root, ".env.music.test")) ? join(root, ".env.music.test") : join(root, ".env.music.test.example");
  const rawEnvironment = readEnvFile(environmentFile);
  const environment = parseMusicEnvironment(rawEnvironment);
  const gateValues = {
    MUSIC_PROVISIONING_KILL_SWITCH: String(environment.MUSIC_PROVISIONING_KILL_SWITCH),
    MUSIC_PROVISIONING_COHORT: environment.MUSIC_PROVISIONING_COHORT,
    MUSIC_RECONCILIATION_ENABLED: String(environment.MUSIC_RECONCILIATION_ENABLED),
    MUSIC_RECONCILIATION_MAX_ROWS: String(environment.MUSIC_RECONCILIATION_MAX_ROWS),
    MUSIC_EXPECTED_MIGRATION_ID: environment.MUSIC_EXPECTED_MIGRATION_ID,
  };
  let databaseTarget = "missing";
  try { const database = new URL(rawEnvironment.DATABASE_URL_TEST); databaseTarget = `${database.protocol}//${database.hostname}:${database.port}${database.pathname}`; } catch { databaseTarget = "invalid"; }
  const environmentFingerprint = createHash("sha256").update(JSON.stringify({
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    composeProject: MUSIC_COMPOSE_PROJECT,
    databaseTarget,
    mode: environment.MUSIC_MODE,
    fixtureUrl: environment.STRAPI_FIXTURE_URL,
    fixtureVersion: fixture.fixtureVersion,
    fixtureSchemaVersion: fixture.schemaVersion,
    signingKeyIds: [environment.MUSIC_SIGNING_KEY_CURRENT_ID, environment.MUSIC_SIGNING_KEY_PREVIOUS_ID],
    controls: [environment.MUSIC_CONNECT_TIMEOUT_MS, environment.MUSIC_READ_TIMEOUT_MS, environment.MUSIC_CIRCUIT_FAILURE_THRESHOLD, environment.MUSIC_RATE_LIMIT_PER_MINUTE],
    gateValues,
  })).digest("hex");
  return { commit: readGitSha(), fixtureVersion: fixture.fixtureVersion, fixtureSchemaVersion: fixture.schemaVersion, gateValues, environmentFingerprint };
}

function writeCheckpoint(id: string, context: RunContext, result: RunResult): string {
  const target = join(runDirectory(id), "checkpoint.json");
  const temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify({ schemaVersion: MUSIC_CLI_SCHEMA_VERSION, ...context, ...result }, null, 2));
  renameSync(temporary, target);
  return target;
}
function assertResume(path: string, context: RunContext): void {
  const checkpoint = JSON.parse(readFileSync(path, "utf8")) as Partial<RunContext>;
  for (const key of ["commit", "fixtureVersion", "fixtureSchemaVersion", "environmentFingerprint"] as const) if (checkpoint[key] !== context[key]) throw new ResumeMismatchError(`resume checkpoint ${key} does not match`);
  if (JSON.stringify(checkpoint.gateValues) !== JSON.stringify(context.gateValues)) throw new ResumeMismatchError("resume checkpoint gateValues do not match");
}

const commandGuidance: Record<string, { success: string; failure: string; recovery: string }> = {
  bootstrap: { success: "npm run music:doctor", failure: "npm run music:bootstrap", recovery: "npm run music:down" },
  doctor: { success: "npm run music:up -- --detach --wait", failure: "npm run music:doctor", recovery: "npm run music:down" },
  up: { success: "npm run music:test:smoke", failure: "npm run music:doctor", recovery: "npm run music:down" },
  "test:smoke": { success: "npm run music:down", failure: "npm run music:test:smoke", recovery: "npm run music:down" },
  "test:all": { success: "npm run music:down", failure: "npm run music:test:all", recovery: "npm run music:down" },
  down: { success: "npm run music:doctor", failure: "npm run music:doctor", recovery: "inspect the checkpoint; no cleanup was attempted" },
  "db:status": { success: "review the runtime manifest", failure: "npm run music:doctor", recovery: "npm run music:down" },
  "db:migrate": { success: "npm run music:db:status", failure: "implement reviewed C3 migrations", recovery: "npm run music:db:status" },
  "db:reset": { success: "npm run music:up -- --detach --wait", failure: "npm run music:doctor", recovery: "npm run music:down" },
  "fixtures:capture": { success: "request TK identity-owner review", failure: "supply explicit read-only credentials or use fixture mode", recovery: "npm run music:fixtures:capture -- --mode fixture" },
  music: { success: "npm run music:doctor", failure: "review command usage", recovery: "npm run music:down" },
};

function emit(id: string, command: string, format: OutputFormat, started: number, context: RunContext, result: RunResult): number {
  const checkpoint = result.checkpoint ?? writeCheckpoint(id, context, result);
  const guidance = commandGuidance[command] ?? commandGuidance.music;
  const output = { schemaVersion: MUSIC_CLI_SCHEMA_VERSION, command, runId: id, status: result.status, phase: result.phase, durationMs: Date.now() - started, artifacts: result.artifacts ?? [], checkpoint, error: result.error ? sanitize(result.error) : undefined, nextCommand: result.status === "success" ? guidance.success : guidance.failure, recoveryCommand: guidance.recovery };
  if (format === "json") process.stdout.write(`${JSON.stringify(output)}\n`);
  else process.stdout.write(`${command}: ${result.status} (${result.phase})${output.error ? `\nerror: ${output.error}` : ""}\nnext: ${output.nextCommand}\nrecovery: ${output.recoveryCommand}\nartifacts: ${output.artifacts.join(", ") || "none"}\ncheckpoint: ${checkpoint}\n`);
  return result.exitCode;
}

export function resolveNpmCommand(input: { npmExecPath?: string; nodeExecPath: string; platform: NodeJS.Platform }): { file: string; args: string[] } {
  if (input.npmExecPath) return { file: input.nodeExecPath, args: [input.npmExecPath] };
  if (input.platform === "win32") return {
    file: input.nodeExecPath,
    args: [windowsPath.join(windowsPath.dirname(input.nodeExecPath), "node_modules", "npm", "bin", "npm-cli.js")],
  };
  return { file: "npm", args: [] };
}
function executable(command: "npm" | "docker" | "node"): { file: string; args: string[] } {
  if (command === "npm") return resolveNpmCommand({ npmExecPath: process.env.npm_execpath, nodeExecPath: process.execPath, platform: process.platform });
  if (command === "node") return { file: process.execPath, args: [] };
  return { file: process.platform === "win32" ? "docker.exe" : "docker", args: [] };
}

async function runChild(id: string, command: "npm" | "docker" | "node", args: string[], phase: string, failureExitCode: number): Promise<{ stdout: string; stderr: string; artifact: string }> {
  const resolved = executable(command);
  const result = await runner.run(resolved.file, [...resolved.args, ...args], { cwd: root, env: process.env });
  const artifact = writeArtifact(id, `child-${String(++childSequence).padStart(3, "0")}-${phase}.log`, `$ ${command} ${args.join(" ")}\nexit=${result.exitCode}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  if (result.exitCode !== 0) throw new MusicCommandError(`${command} ${args.join(" ")} failed with exit ${result.exitCode}; see ${artifact}`, phase, failureExitCode);
  return { ...result, artifact };
}

function createTestEnv(): void {
  const path = join(root, ".env.music.test");
  if (existsSync(path)) { try { parseMusicEnvironment(readEnvFile(path)); return; } catch { /* replace invalid disposable configuration */ } }
  writeFileSync(path, `MUSIC_MODE=fixture\nMUSIC_FIXTURE_VERSION=1\nSTRAPI_FIXTURE_URL=http://127.0.0.1:51337\nDATABASE_URL_TEST=postgresql://music:music@127.0.0.1:55432/music_fixture\nSESSION_SECRET=${randomBytes(32).toString("base64url")}\nCOOKIE_SECRET=${randomBytes(32).toString("base64url")}\nMUSIC_SIGNING_KEY_CURRENT_ID=fixture-current\nMUSIC_SIGNING_KEY_CURRENT_SECRET=${randomBytes(32).toString("base64url")}\nMUSIC_SIGNING_KEY_PREVIOUS_ID=fixture-previous\nMUSIC_SIGNING_KEY_PREVIOUS_SECRET=${randomBytes(32).toString("base64url")}\nMUSIC_CONNECT_TIMEOUT_MS=5000\nMUSIC_READ_TIMEOUT_MS=10000\nMUSIC_CIRCUIT_FAILURE_THRESHOLD=3\nMUSIC_RATE_LIMIT_PER_MINUTE=60\nMUSIC_PROVISIONING_KILL_SWITCH=true\nMUSIC_PROVISIONING_COHORT=disabled\nMUSIC_EXPECTED_MIGRATION_ID=versioned-migrations-unavailable-c0\nMUSIC_RECONCILIATION_ENABLED=false\nMUSIC_RECONCILIATION_MAX_ROWS=0\n`);
}

async function portAvailable(port: number): Promise<boolean> {
  return await new Promise((resolvePort) => { const server = createServer(); server.unref(); server.once("error", () => resolvePort(false)); server.listen({ host: "127.0.0.1", port }, () => server.close(() => resolvePort(true))); });
}

async function renderComposeModel(id: string): Promise<{ model: ComposeModel; artifacts: string[] }> {
  const rendered = await runChild(id, "docker", ["compose", "-p", MUSIC_COMPOSE_PROJECT, "-f", composeFile, "config", "--format", "json"], "compose-config", EXIT.prerequisite);
  const model = JSON.parse(rendered.stdout) as ComposeModel;
  validateComposeModel(model);
  return { model, artifacts: [rendered.artifact] };
}

async function inspectOwnedComposeResources(id: string, model: ComposeModel): Promise<string[]> {
  const artifacts: string[] = [];
  const ps = await runChild(id, "docker", ["compose", "-p", MUSIC_COMPOSE_PROJECT, "-f", composeFile, "ps", "-a", "-q"], "compose-ps", EXIT.dependency); artifacts.push(ps.artifact);
  const ids = ps.stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  if (!ids.length) throw new SafetyError("no owned fixture containers were found; cleanup refused");
  const inspectedContainers = await runChild(id, "docker", ["inspect", ...ids], "inspect-containers", EXIT.dependency); artifacts.push(inspectedContainers.artifact);
  const resources: Array<{ kind: "container" | "network" | "volume"; name: string; labels?: Record<string, string> }> = JSON.parse(inspectedContainers.stdout).map((entry: { Name?: string; Config?: { Labels?: Record<string, string> } }) => ({ kind: "container" as const, name: entry.Name ?? "unknown", labels: entry.Config?.Labels }));
  const networks = Object.values(model.networks ?? {}).map((resource) => (resource as { name?: string }).name).filter((name): name is string => Boolean(name));
  const volumes = Object.values(model.volumes ?? {}).map((resource) => (resource as { name?: string }).name).filter((name): name is string => Boolean(name));
  for (const name of [...networks, ...volumes]) if (!name.startsWith(`${MUSIC_COMPOSE_PROJECT}_`) || /prod(?:uction)?/i.test(name)) throw new SafetyError(`resolved resource ${name} is outside the isolated fixture project`);
  if (networks.length) { const inspected = await runChild(id, "docker", ["network", "inspect", ...networks], "inspect-networks", EXIT.dependency); artifacts.push(inspected.artifact); resources.push(...JSON.parse(inspected.stdout).map((entry: { Name?: string; Labels?: Record<string, string> }) => ({ kind: "network" as const, name: entry.Name ?? "unknown", labels: entry.Labels }))); }
  if (volumes.length) { const inspected = await runChild(id, "docker", ["volume", "inspect", ...volumes], "inspect-volumes", EXIT.dependency); artifacts.push(inspected.artifact); resources.push(...JSON.parse(inspected.stdout).map((entry: { Name?: string; Labels?: Record<string, string> }) => ({ kind: "volume" as const, name: entry.Name ?? "unknown", labels: entry.Labels }))); }
  validateOwnedResources(resources);
  return artifacts;
}

async function doctor(id: string): Promise<RunResult> {
  const failures: string[] = [];
  const artifacts: string[] = [];
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 12)) failures.push("Node >=22.12 is required; fix: nvm use");
  for (const file of requiredFiles) if (!existsSync(join(root, file))) failures.push(`missing ${file}; fix: restore the repository file`);
  try { parseMusicEnvironment(readEnvFile(join(root, ".env.music.test"))); } catch (error) { failures.push(`invalid .env.music.test: ${redactedError(error)}; fix: npm run music:bootstrap`); }
  for (const example of [".env.music.example", ".env.music.test.example"]) try { parseMusicEnvironment(readEnvFile(join(root, example))); } catch (error) { failures.push(`invalid ${example}: ${redactedError(error)}; fix: restore the typed example`); }
  try { const npm = await runChild(id, "npm", ["--version"], "npm-version", EXIT.prerequisite); artifacts.push(npm.artifact); } catch (error) { failures.push(redactedError(error)); }
  try { const compose = await renderComposeModel(id); artifacts.push(...compose.artifacts); } catch (error) { failures.push(redactedError(error)); }
  try { const docker = await runChild(id, "docker", ["info"], "docker-daemon", EXIT.prerequisite); artifacts.push(docker.artifact); } catch { failures.push("Docker daemon is unavailable; fix: start Docker Desktop or the Docker daemon"); }
  if (statfsSync(root).bavail * statfsSync(root).bsize < 2 * 1024 * 1024 * 1024) failures.push("less than 2 GiB free disk space; fix: free disk space");
  for (const port of [55432, 51337, 55000, 55173]) if (!(await portAvailable(port))) failures.push(`fixture port ${port} is occupied; fix: stop the conflicting process`);
  return failures.length ? { status: "failure", phase: "doctor", exitCode: EXIT.prerequisite, error: failures.join(" | "), artifacts } : { status: "success", phase: "doctor", exitCode: EXIT.success, artifacts };
}

function captureFixture(mode: Mode): RunResult {
  if (mode !== "live") return { status: "success", phase: "fixture-capture", exitCode: EXIT.success, artifacts: [join(root, "fixtures/strapi/music-identity/identity.fixture.json")] };
  if (!process.env.LIVE_STRAPI_READ_ONLY_CREDENTIAL || !process.env.LIVE_STRAPI_URL) return { status: "blocked", phase: "live-fixture-capture", exitCode: EXIT.safety, error: "LIVE_STRAPI_URL and LIVE_STRAPI_READ_ONLY_CREDENTIAL are required; no probe was attempted" };
  return { status: "blocked", phase: "live-fixture-capture", exitCode: EXIT.safety, error: "live capture requires TK identity-owner endpoint allowlist review; no probe was attempted" };
}

async function executeCommand(id: string, parsed: ParsedArgs): Promise<RunResult> {
  if (parsed.command === "bootstrap") {
    createTestEnv(); parseMusicEnvironment(readEnvFile(join(root, ".env.music.test")));
    const fixture = JSON.parse(readFileSync(join(root, "fixtures/strapi/music-identity/identity.fixture.json"), "utf8")); validateStrapiFixture(fixture, { mode: "fixture" });
    const artifacts: string[] = [];
    for (const args of [["ci"], ["ci", "--prefix", "tunes"], ["ci", "--prefix", "explorers-earth"]]) { const result = await runChild(id, "npm", args, "bootstrap-install", EXIT.prerequisite); artifacts.push(result.artifact); }
    return { status: "success", phase: "bootstrap", exitCode: EXIT.success, artifacts: [join(root, ".env.music.test"), ...artifacts] };
  }
  if (parsed.command === "doctor") return await doctor(id);
  if (parsed.command === "fixtures:capture") return captureFixture(parsed.mode);
  if (parsed.command === "db:migrate") return { status: "blocked", phase: "migration-safety", exitCode: EXIT.safety, error: "C0 has no reviewed versioned migration; db:migrate is disabled until C3" };
  if (parsed.command === "db:status") return { status: "success", phase: "db-status", exitCode: EXIT.success, artifacts: [join(root, "fixtures/db/music-runtime-table-manifest.json")] };
  if (parsed.command === "up") {
    const compose = await renderComposeModel(id);
    const result = await runChild(id, "docker", ["compose", "-p", MUSIC_COMPOSE_PROJECT, "-f", composeFile, "up", ...(parsed.detach ? ["--detach"] : []), ...(parsed.wait ? ["--wait"] : [])], "up", EXIT.dependency);
    return { status: "success", phase: "up", exitCode: EXIT.success, artifacts: [...compose.artifacts, result.artifact] };
  }
  if (parsed.command === "test:smoke") { const result = await runChild(id, "node", ["tunes/scripts/music-smoke.ts"], "smoke", EXIT.verification); return { status: "success", phase: "smoke", exitCode: EXIT.success, artifacts: [result.artifact] }; }
  if (parsed.command === "test:all") { const result = await runChild(id, "npm", ["test", "--prefix", "tunes"], "all-tests", EXIT.verification); return { status: "success", phase: "all-tests", exitCode: EXIT.success, artifacts: [result.artifact] }; }
  if (parsed.command === "down" || parsed.command === "db:reset") {
    const destructive = parsed.command === "db:reset" || parsed.volumes;
    if (destructive && (parsed.mode !== "fixture" || parsed.confirmProject !== MUSIC_COMPOSE_PROJECT)) throw new SafetyError(`destructive cleanup requires --mode fixture --confirm-project ${MUSIC_COMPOSE_PROJECT}`);
    const compose = await renderComposeModel(id);
    const artifacts = [...compose.artifacts, ...(await inspectOwnedComposeResources(id, compose.model))];
    const result = await runChild(id, "docker", ["compose", "-p", MUSIC_COMPOSE_PROJECT, "-f", composeFile, "down", ...(destructive ? ["--volumes"] : [])], parsed.command === "db:reset" ? "db-reset" : "down", EXIT.dependency);
    return { status: "success", phase: parsed.command === "db:reset" ? "db-reset" : "down", exitCode: EXIT.success, artifacts: [...artifacts, result.artifact] };
  }
  throw new MusicCommandError(`unhandled command ${parsed.command}`, "arguments", EXIT.usage);
}

async function main(): Promise<number> {
  const id = runId(); const started = Date.now(); let parsed: ParsedArgs;
  try { parsed = parseArgs(process.argv.slice(2)); } catch (error) { const context = buildRunContext(); const failure = error instanceof MusicCommandError ? error : new MusicCommandError(redactedError(error), "arguments", EXIT.usage); return emit(id, "music", "human", started, context, { status: "failure", phase: failure.phase, exitCode: failure.exitCode, error: redactedError(failure) }); }
  if (parsed.command === "bootstrap") createTestEnv();
  const context = buildRunContext();
  activeRun = { id, command: parsed.command, format: parsed.format, started, context };
  if (parsed.resume) { try { assertResume(parsed.resume, context); } catch (error) { const failure = error as MusicCommandError; return emit(id, parsed.command, parsed.format, started, context, { status: "failure", phase: failure.phase, exitCode: failure.exitCode, error: redactedError(failure) }); } }
  try { return emit(id, parsed.command, parsed.format, started, context, await executeCommand(id, parsed)); }
  catch (error) { const failure = error instanceof MusicCommandError ? error : new MusicCommandError(redactedError(error), "execution", EXIT.dependency); return emit(id, parsed.command, parsed.format, started, context, { status: failure.exitCode === EXIT.safety ? "blocked" : "failure", phase: failure.phase, exitCode: failure.exitCode, error: redactedError(failure) }); }
  finally { activeRun = undefined; }
}

async function interrupted(): Promise<void> {
  if (!activeRun) process.exit(EXIT.interrupted);
  const run = activeRun;
  await runner.terminateAll();
  const checkpoint = writeCheckpoint(run.id, run.context, { status: "failure", phase: "interrupted", exitCode: EXIT.interrupted });
  emit(run.id, run.command, run.format, run.started, run.context, { status: "failure", phase: "interrupted", exitCode: EXIT.interrupted, checkpoint });
  process.exit(EXIT.interrupted);
}
process.once("SIGINT", () => { void interrupted(); });
process.once("SIGTERM", () => { void interrupted(); });

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/scripts/music-cli.ts")) void main().then((code) => { process.exitCode = code; });
