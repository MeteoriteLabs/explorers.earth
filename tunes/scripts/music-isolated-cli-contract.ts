import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const parent = mkdtempSync(join(tmpdir(), "music-c10-cli-contract-"));
const checkout = join(parent, "checkout");
const fakeDockerDirectory = join(parent, "fake-docker");
let worktreeAdded = false;
const linkedPaths: string[] = [];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function sanitize(value: string): string {
  return value
    .replaceAll(repositoryRoot, "<repository-root>")
    .replaceAll(repositoryRoot.replaceAll("\\", "/"), "<repository-root>")
    .replaceAll(parent, "<isolated-root>")
    .replaceAll(parent.replaceAll("\\", "/"), "<isolated-root>")
    .replace(/[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\\/\s]+/gi, "<developer-home>")
    .slice(-2_000);
}

function run(phase: string, file: string, args: string[], cwd = repositoryRoot, env = process.env) {
  const result = spawnSync(file, args, {
    cwd,
    encoding: "utf8",
    env,
    windowsHide: true,
    timeout: 12 * 60_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  const status = result.status ?? (result.error ? 127 : 1);
  if (status !== 0) throw new Error(`${phase} failed with exit ${status}: ${sanitize(`${result.stdout ?? ""}\n${result.stderr ?? ""}`)}`);
  return result.stdout ?? "";
}

function linkDependencies(source: string, target: string): void {
  if (!existsSync(source)) return;
  symlinkSync(source, target, process.platform === "win32" ? "junction" : "dir");
  linkedPaths.push(target);
}

try {
  const status = run("source cleanliness", "git", ["status", "--porcelain=v1", "--untracked-files=all"]).trim();
  assert(status === "", "isolated CLI contract requires an exact clean source commit");
  const commit = run("source commit", "git", ["rev-parse", "HEAD"]).trim();
  assert(/^[a-f0-9]{40}$/.test(commit), "source commit is invalid");
  run("detached worktree creation", "git", ["worktree", "add", "--detach", checkout, commit]);
  worktreeAdded = true;
  linkDependencies(join(repositoryRoot, "node_modules"), join(checkout, "node_modules"));
  linkDependencies(join(repositoryRoot, "tunes", "node_modules"), join(checkout, "tunes", "node_modules"));
  const composeModel = run("compose-config fixture model", "docker", [
    "compose", "-p", "explorers-music-fixture", "--env-file", ".env.music.test.example",
    "-f", "docker-compose.music-test.yml", "config", "--format", "json",
  ], checkout);
  assert(Boolean(JSON.parse(composeModel)?.services), "fixture Compose model is invalid");
  mkdirSync(fakeDockerDirectory, { mode: 0o700 });
  const composeModelPath = join(fakeDockerDirectory, "compose-model.json");
  const fakeDockerScript = join(fakeDockerDirectory, "fake-docker.cjs");
  const fakeDockerTrace = join(fakeDockerDirectory, "docker-calls.jsonl");
  const fakeNpmScript = join(fakeDockerDirectory, "fake-npm.cjs");
  writeFileSync(composeModelPath, composeModel, { mode: 0o600 });
  writeFileSync(fakeDockerScript, `const { appendFileSync, readFileSync } = require("node:fs");
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(fakeDockerTrace)}, JSON.stringify(args) + "\\n");
if (args[0] === "info") { process.stdout.write("{}\\n"); process.exit(0); }
if (args[0] === "compose" && args.includes("config")) { process.stdout.write(readFileSync(${JSON.stringify(composeModelPath)}, "utf8")); process.exit(0); }
if (args[0] === "compose" && args.includes("ps")) process.exit(0);
process.stderr.write("fixture Docker mutation blocked\\n"); process.exit(70);
`, { mode: 0o700 });
  writeFileSync(fakeNpmScript, `const args = process.argv.slice(2);
if (JSON.stringify(args) === JSON.stringify(["--version"])) { process.stdout.write("10.0.0\\n"); process.exit(0); }
if (JSON.stringify(args) === JSON.stringify(["exec", "--silent", "--prefix", "tunes", "--", "tsx", "tunes/scripts/music-smoke.ts"])) {
  process.stdout.write("SESSION_SECRET=hostile-child-secret C:\\\\Users\\\\fixture\\\\private\\n");
  process.stderr.write("Bearer hostile-child-token\\n");
  process.exit(1);
}
process.stderr.write("fixture npm mutation blocked\\n"); process.exit(70);
`, { mode: 0o700 });
  const mutationProbe = spawnSync(process.execPath, [fakeDockerScript, "compose", "-p", "explorers-music-fixture", "down"], {
    cwd: checkout, encoding: "utf8", windowsHide: true,
  });
  assert(mutationProbe.status === 70 && mutationProbe.stderr.trim() === "fixture Docker mutation blocked",
    "fixture Docker mutation probe did not fail closed");
  const isolatedEnvironment = { ...process.env };
  isolatedEnvironment.MUSIC_C10_ISOLATED_DOCKER_ACK = "C10_MUTATION_BLOCKED";
  isolatedEnvironment.MUSIC_C10_ISOLATED_DOCKER_SCRIPT = fakeDockerScript;
  isolatedEnvironment.MUSIC_C10_ISOLATED_NPM_EXECPATH = fakeNpmScript;
  const vitest = join(repositoryRoot, "tunes", "node_modules", "vitest", "vitest.mjs");
  assert(existsSync(vitest), "isolated CLI contract Vitest runtime is unavailable");
  run("isolated CLI contract", process.execPath, [
    vitest, "run", "--config", "vitest.config.ts", "server/test/contracts/music-cli-contract.test.ts",
  ], join(checkout, "tunes"), isolatedEnvironment);
  const dockerCalls = readFileSync(fakeDockerTrace, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line) as string[]);
  assert(dockerCalls.some((args) => args[0] === "info")
    && dockerCalls.some((args) => args[0] === "compose" && args.includes("config"))
    && dockerCalls.some((args) => args[0] === "compose" && args.includes("ps"))
    && dockerCalls.some((args) => args[0] === "compose" && args.includes("down")),
  "isolated Docker probe did not observe the complete bounded command set");
  process.stdout.write(`${JSON.stringify({
    schemaVersion: "music-operation/v1",
    metric: "isolated-cli-contract",
    exactCommit: true,
    sourceAuthorityUntouched: true,
  })}\n`);
} finally {
  assert(basename(parent).startsWith("music-c10-cli-contract-"), "unsafe isolated CLI cleanup root");
  for (const linkedPath of linkedPaths.reverse()) {
    if (existsSync(linkedPath) && lstatSync(linkedPath).isSymbolicLink()) unlinkSync(linkedPath);
  }
  if (worktreeAdded) {
    const removed = spawnSync("git", ["worktree", "remove", "--force", checkout], {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      timeout: 60_000,
    });
    if ((removed.status ?? 1) !== 0) throw new Error(`isolated worktree cleanup failed: ${sanitize(removed.stderr ?? "")}`);
  }
  assert(!existsSync(checkout), "isolated worktree remains after cleanup");
  rmSync(fakeDockerDirectory, { recursive: true, force: true });
  rmdirSync(parent);
}
