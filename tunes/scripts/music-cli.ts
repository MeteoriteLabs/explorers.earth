import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statfsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const MUSIC_CLI_SCHEMA_VERSION = "music-cli/v1";
export const FIXTURE_SCHEMA_VERSION = "strapi-identity-fixture/v1";
export const EXIT = { success: 0, verification: 1, usage: 2, prerequisite: 3, dependency: 4, safety: 5, interrupted: 130 } as const;

export interface StrapiIdentityFixture {
  schemaVersion: "strapi-identity-fixture/v1";
  fixtureVersion: string;
  identities: Array<{
    user: { id?: string };
    accounts: Array<{ id?: string; completed?: boolean }>;
  }>;
  pagination?: { page?: number; pageCount?: number; pageSize?: number; total?: number };
  serviceToken?: { operations: string[] };
}

export function validateStrapiFixture(
  fixture: StrapiIdentityFixture,
  options: { mode: "fixture" | "live"; readOnlyCredential?: string },
): void {
  if (fixture.schemaVersion !== FIXTURE_SCHEMA_VERSION) {
    throw new Error("unsupported fixture schema");
  }
  if (!fixture.fixtureVersion) throw new Error("fixtureVersion is required");
  if (options.mode === "live" && !options.readOnlyCredential) {
    throw new Error("LIVE_STRAPI_READ_ONLY_CREDENTIAL is required");
  }
  fixture.identities.forEach((identity, index) => {
    if (!identity.user.id) throw new Error(`identity[${index}].user.id is required`);
    const completed = identity.accounts.filter((account) => account.completed);
    if (completed.length !== 1) {
      throw new Error(`identity[${index}] has ${completed.length === 0 ? "no" : "ambiguous"} completed Accounts`);
    }
    if (!completed[0].id) throw new Error(`identity[${index}].accounts completed Account id is required`);
  });
  if (fixture.pagination && (!Number.isInteger(fixture.pagination.page) || !Number.isInteger(fixture.pagination.pageCount) || !Number.isInteger(fixture.pagination.pageSize) || !Number.isInteger(fixture.pagination.total))) {
    throw new Error("pagination metadata is truncated");
  }
  if (fixture.serviceToken?.operations.some((operation) => !operation.startsWith("GET ") && !operation.startsWith("HEAD "))) {
    throw new Error("service token operation must be read-only");
  }
}

type OutputFormat = "human" | "json";
type Mode = "fixture" | "live";

interface ParsedArgs { command?: string; mode: Mode; format: OutputFormat; detach: boolean; wait: boolean; volumes: boolean; confirmProject?: string; resume?: string; }
interface RunResult { status: "success" | "failure" | "blocked"; phase: string; exitCode: number; artifacts?: string[]; checkpoint?: string; error?: string; }

const root = resolve(import.meta.dirname, "../..");
const artifactRoot = join(root, ".artifacts", "music-runs");
const projectName = "explorers-music-fixture";
const npmCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const requiredFiles = ["docker-compose.music-test.yml", ".env.music.example", ".env.music.test.example", "fixtures/strapi/music-identity/identity.fixture.json"];
const musicEnvKeys = ["MUSIC_MODE", "MUSIC_FIXTURE_VERSION", "DATABASE_URL_TEST", "SESSION_SECRET", "COOKIE_SECRET", "MUSIC_SIGNING_KEY_CURRENT_ID", "MUSIC_SIGNING_KEY_CURRENT_SECRET", "MUSIC_SIGNING_KEY_PREVIOUS_ID", "MUSIC_SIGNING_KEY_PREVIOUS_SECRET", "MUSIC_CONNECT_TIMEOUT_MS", "MUSIC_READ_TIMEOUT_MS", "MUSIC_CIRCUIT_FAILURE_THRESHOLD", "MUSIC_RATE_LIMIT_PER_MINUTE", "MUSIC_PROVISIONING_KILL_SWITCH", "MUSIC_PROVISIONING_COHORT", "MUSIC_EXPECTED_MIGRATION_ID", "MUSIC_RECONCILIATION_ENABLED", "MUSIC_RECONCILIATION_MAX_ROWS"];

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = { mode: "fixture", format: "human", detach: false, wait: false, volumes: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--") && !parsed.command) parsed.command = arg;
    else if (arg === "--mode") parsed.mode = args[++i] as Mode;
    else if (arg === "--format") parsed.format = args[++i] as OutputFormat;
    else if (arg === "--detach") parsed.detach = true;
    else if (arg === "--wait") parsed.wait = true;
    else if (arg === "--volumes") parsed.volumes = true;
    else if (arg === "--confirm-project") parsed.confirmProject = args[++i];
    else if (arg === "--resume") parsed.resume = args[++i];
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!parsed.command || !["bootstrap", "doctor", "up", "test:smoke", "test:all", "down", "db:status", "db:migrate", "db:reset", "fixtures:capture"].includes(parsed.command)) throw new Error("usage: music:<bootstrap|doctor|up|test:smoke|test:all|down|db:status|db:migrate|db:reset|fixtures:capture>");
  if (!(["fixture", "live"] as string[]).includes(parsed.mode)) throw new Error("--mode must be fixture or live");
  if (!(["human", "json"] as string[]).includes(parsed.format)) throw new Error("--format must be human or json");
  return parsed;
}

function redacted(value: unknown): string | undefined { return value instanceof Error ? value.message.replace(/(password|secret|token|key)=?[^\s]*/gi, "$1=[REDACTED]") : undefined; }
function runId(): string { return `${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${randomBytes(4).toString("hex")}`; }
function writeCheckpoint(id: string, result: RunResult): string {
  const directory = join(artifactRoot, id); mkdirSync(directory, { recursive: true });
  const target = join(directory, "checkpoint.json"); const temporary = `${target}.tmp`;
  writeFileSync(temporary, JSON.stringify({ schemaVersion: MUSIC_CLI_SCHEMA_VERSION, commit: process.env.GIT_COMMIT ?? "local", fixtureVersion: process.env.MUSIC_FIXTURE_VERSION ?? "1", gateValues: process.env.MUSIC_GATE_VALUES ?? "unrecorded", environmentFingerprint: `${process.platform}:${process.version}`, ...result }, null, 2));
  renameSync(temporary, target); return target;
}
class ResumeMismatchError extends Error {}
function assertResume(path: string): void {
  const checkpoint = JSON.parse(readFileSync(path, "utf8")) as { commit?: string; fixtureVersion?: string; gateValues?: string; environmentFingerprint?: string };
  const expected = {
    commit: process.env.GIT_COMMIT ?? "local",
    fixtureVersion: process.env.MUSIC_FIXTURE_VERSION ?? "1",
    gateValues: process.env.MUSIC_GATE_VALUES ?? "unrecorded",
    environmentFingerprint: `${process.platform}:${process.version}`,
  };
  for (const [key, value] of Object.entries(expected)) if (checkpoint[key as keyof typeof checkpoint] !== value) throw new ResumeMismatchError(`resume checkpoint ${key} does not match`);
}
function emit(id: string, command: string, format: OutputFormat, started: number, result: RunResult): number {
  const checkpoint = result.checkpoint ?? writeCheckpoint(id, result);
  const output = { schemaVersion: MUSIC_CLI_SCHEMA_VERSION, command, runId: id, status: result.status, phase: result.phase, durationMs: Date.now() - started, artifacts: result.artifacts ?? [], checkpoint, error: result.error ? "[REDACTED] " + result.error : undefined, nextCommand: result.status === "success" ? "music:doctor" : "music:doctor", recoveryCommand: "music:down" };
  if (format === "json") console.log(JSON.stringify(output)); else console.log(`${command}: ${result.status} (${result.phase})\nnext: ${output.nextCommand}\nrecovery: ${output.recoveryCommand}\ncheckpoint: ${checkpoint}`);
  return result.exitCode;
}
function executable(commandName: string): { file: string; prefix: string[] } { if (commandName === "npm") return { file: process.execPath, prefix: [npmCli] }; return { file: process.platform === "win32" ? `${commandName}.exe` : commandName, prefix: [] }; }
function command(commandName: string, args: string[]): void { const executableCommand = executable(commandName); const output = spawnSync(executableCommand.file, [...executableCommand.prefix, ...args], { cwd: root, stdio: "inherit" }); if (output.status !== 0) throw new Error(`${commandName} ${args.join(" ")} failed`); }
function readEnvFile(file: string): Record<string, string> { return Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/).filter((line) => line && !line.startsWith("#")).map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)]; })); }
function createTestEnv(): void { const path = join(root, ".env.music.test"); if (existsSync(path) && musicEnvKeys.every((key) => readEnvFile(path)[key])) return; writeFileSync(path, `MUSIC_MODE=fixture\nMUSIC_FIXTURE_VERSION=1\nDATABASE_URL_TEST=postgresql://music:music@127.0.0.1:55432/music_fixture\nSESSION_SECRET=${randomBytes(32).toString("base64url")}\nCOOKIE_SECRET=${randomBytes(32).toString("base64url")}\nMUSIC_SIGNING_KEY_CURRENT_ID=fixture-current\nMUSIC_SIGNING_KEY_CURRENT_SECRET=${randomBytes(32).toString("base64url")}\nMUSIC_SIGNING_KEY_PREVIOUS_ID=fixture-previous\nMUSIC_SIGNING_KEY_PREVIOUS_SECRET=${randomBytes(32).toString("base64url")}\nMUSIC_CONNECT_TIMEOUT_MS=5000\nMUSIC_READ_TIMEOUT_MS=10000\nMUSIC_CIRCUIT_FAILURE_THRESHOLD=3\nMUSIC_RATE_LIMIT_PER_MINUTE=60\nMUSIC_PROVISIONING_KILL_SWITCH=true\nMUSIC_PROVISIONING_COHORT=disabled\nMUSIC_EXPECTED_MIGRATION_ID=schema-push-no-migration-history\nMUSIC_RECONCILIATION_ENABLED=false\nMUSIC_RECONCILIATION_MAX_ROWS=0\n`); }
function doctor(): RunResult {
  const failures: string[] = [];
  if (Number(process.versions.node.split(".")[0]) < 22 || (Number(process.versions.node.split(".")[0]) === 22 && Number(process.versions.node.split(".")[1]) < 12)) failures.push("Node >=22.12 is required; fix: nvm use; next: music:bootstrap; recovery: music:down");
  for (const file of requiredFiles) if (!existsSync(join(root, file))) failures.push(`missing ${file}; fix: restore the repository file; next: music:bootstrap; recovery: music:down`);
  if (!existsSync(join(root, ".env.music.test"))) failures.push("missing .env.music.test; fix: music:bootstrap; next: music:bootstrap; recovery: music:down");
  else for (const key of musicEnvKeys) if (!readEnvFile(join(root, ".env.music.test"))[key]) failures.push(`missing ${key} in .env.music.test; fix: music:bootstrap; next: music:bootstrap; recovery: music:down`);
  for (const example of [".env.music.example", ".env.music.test.example"]) {
    const values = readEnvFile(join(root, example));
    for (const key of musicEnvKeys.filter((entry) => entry !== "SESSION_SECRET" && entry !== "COOKIE_SECRET")) if (!(key in values)) failures.push(`${example} does not satisfy the server schema: ${key}; fix: restore the example; next: music:doctor; recovery: music:down`);
  }
  const npmCommand = executable("npm"); if (spawnSync(npmCommand.file, [...npmCommand.prefix, "--version"], { cwd: root }).status !== 0) failures.push("npm is unavailable; fix: install Node/npm; next: music:doctor; recovery: music:down");
  const dockerCommand = executable("docker"); if (spawnSync(dockerCommand.file, [...dockerCommand.prefix, "compose", "version"], { cwd: root }).status !== 0) failures.push("Docker Compose v2 is unavailable; fix: install/start Docker Desktop; next: music:doctor; recovery: music:down");
  else if (spawnSync(dockerCommand.file, [...dockerCommand.prefix, "info"], { cwd: root, stdio: "ignore" }).status !== 0) failures.push("Docker daemon is unavailable; fix: start Docker Desktop or the Docker daemon; next: music:doctor; recovery: music:down");
  if (statfsSync(root).bavail * statfsSync(root).bsize < 2 * 1024 * 1024 * 1024) failures.push("less than 2 GiB free disk space; fix: free disk space; next: music:doctor; recovery: music:down");
  const netstat = spawnSync(process.platform === "win32" ? "netstat.exe" : "netstat", ["-an"], { cwd: root, encoding: "utf8" });
  for (const port of [55432, 51337]) if (netstat.status === 0 && String(netstat.stdout).match(new RegExp(`:${port}(\\s|$)`))) failures.push(`fixture port ${port} is occupied; fix: stop the conflicting process; next: music:up; recovery: music:down`);
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("music_fixture")) failures.push("DATABASE_URL must not target a non-fixture database; fix: unset DATABASE_URL; next: music:doctor; recovery: music:down");
  return failures.length ? { status: "failure", phase: "doctor", exitCode: EXIT.prerequisite, error: failures.join(" | ") } : { status: "success", phase: "doctor", exitCode: EXIT.success };
}
function captureFixture(mode: Mode): RunResult {
  if (mode !== "live") return { status: "success", phase: "fixture-capture", exitCode: EXIT.success, artifacts: ["fixtures/strapi/music-identity/identity.fixture.json"] };
  if (!process.env.LIVE_STRAPI_READ_ONLY_CREDENTIAL || !process.env.LIVE_STRAPI_URL) return { status: "blocked", phase: "live-fixture-capture", exitCode: EXIT.safety, error: "LIVE_STRAPI_URL and LIVE_STRAPI_READ_ONLY_CREDENTIAL are required; no probe was attempted" };
  return { status: "blocked", phase: "live-fixture-capture", exitCode: EXIT.safety, error: "live capture requires an identity-owner-reviewed endpoint allowlist; no probe was attempted" };
}
function main(): number {
  const id = runId(); const started = Date.now(); let parsed: ParsedArgs;
  try { parsed = parseArgs(process.argv.slice(2)); } catch (error) { return emit(id, "music", "human", started, { status: "failure", phase: "arguments", exitCode: EXIT.usage, error: redacted(error) }); }
  const interrupted = () => { process.exit(emit(id, parsed.command!, parsed.format, started, { status: "failure", phase: "interrupted", exitCode: EXIT.interrupted })); };
  process.once("SIGINT", interrupted); process.once("SIGTERM", interrupted);
  try {
    if (parsed.resume) assertResume(parsed.resume);
    let result: RunResult;
    if (parsed.command === "bootstrap") { command("npm", ["ci"]); command("npm", ["ci", "--prefix", "tunes"]); command("npm", ["ci", "--prefix", "explorers-earth"]); createTestEnv(); const fixture = JSON.parse(readFileSync(join(root, "fixtures/strapi/music-identity/identity.fixture.json"), "utf8")); validateStrapiFixture(fixture, { mode: "fixture" }); result = { status: "success", phase: "bootstrap", exitCode: EXIT.success, artifacts: [".env.music.test"] }; }
    else if (parsed.command === "doctor") result = doctor();
    else if (parsed.command === "fixtures:capture") result = captureFixture(parsed.mode);
    else if (parsed.command === "down") { if (parsed.volumes && parsed.confirmProject !== projectName) result = { status: "failure", phase: "safety", exitCode: EXIT.safety, error: `--volumes requires --confirm-project ${projectName}` }; else { command("docker", ["compose", "-p", projectName, "-f", "docker-compose.music-test.yml", "down", ...(parsed.volumes ? ["--volumes"] : [])]); result = { status: "success", phase: "down", exitCode: EXIT.success }; } }
    else if (parsed.command === "up") { command("docker", ["compose", "-p", projectName, "-f", "docker-compose.music-test.yml", "up", ...(parsed.detach ? ["--detach"] : []), ...(parsed.wait ? ["--wait"] : [])]); result = { status: "success", phase: "up", exitCode: EXIT.success }; }
    else if (parsed.command === "test:smoke") { command("npm", ["test", "--prefix", "tunes", "--", "server/test/contracts"]); result = { status: "success", phase: "smoke", exitCode: EXIT.success }; }
    else if (parsed.command === "test:all") { command("npm", ["test", "--prefix", "tunes"]); result = { status: "success", phase: "all-tests", exitCode: EXIT.success }; }
    else if (parsed.command === "db:status") result = { status: "success", phase: "db-status", exitCode: EXIT.success, artifacts: ["docs/architecture/music-runtime-table-manifest.md"] };
    else if (parsed.command === "db:migrate") { command("npm", ["run", "db:push", "--prefix", "tunes"]); result = { status: "success", phase: "db-migrate", exitCode: EXIT.success }; }
    else { if (parsed.mode !== "fixture" || parsed.confirmProject !== projectName) result = { status: "failure", phase: "safety", exitCode: EXIT.safety, error: `db reset is disposable-only; use --mode fixture --confirm-project ${projectName}` }; else { command("docker", ["compose", "-p", projectName, "-f", "docker-compose.music-test.yml", "down", "--volumes"]); result = { status: "success", phase: "db-reset", exitCode: EXIT.success }; } }
    return emit(id, parsed.command, parsed.format, started, result);
  } catch (error) { return emit(id, parsed.command!, parsed.format, started, { status: "failure", phase: error instanceof ResumeMismatchError ? "resume" : "execution", exitCode: error instanceof ResumeMismatchError ? EXIT.prerequisite : EXIT.dependency, error: redacted(error) }); }
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/scripts/music-cli.ts")) process.exitCode = main();
