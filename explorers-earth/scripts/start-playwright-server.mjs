import { spawn, spawnSync } from "node:child_process";
import { createNpmSpawnPlan } from "./npm-spawn-plan.mjs";

function option(name, fallback) {
  return (
    process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3) ??
    fallback
  );
}

function git(...args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

function apiHostname(value) {
  if (!value) return "not-configured";
  try {
    return new URL(value).hostname || "not-configured";
  } catch {
    return "invalid-url";
  }
}

function environmentClass(project) {
  if (project === "real-account") return "protected-mutation";
  return process.env.VITE_PUBLIC_READ_ACCESS_TOKEN
    ? "fixture-with-public-read-capability"
    : "deterministic-fixture";
}

const port = Number.parseInt(option("port", "5173"), 10);
const project = option("project", "deterministic");
const dryRun = process.argv.includes("--dry-run");
const currentBranch = git("branch", "--show-current") || "detached";

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  console.error("PLAYWRIGHT_SERVER_INVALID_PORT");
  process.exit(2);
}

const baseURL = `http://127.0.0.1:${port}`;
const command = `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`;
console.log(
  [
    "[playwright-server]",
    `baseURL=${baseURL}`,
    `pid=${process.pid}`,
    `command=${command}`,
    `branch=${currentBranch}`,
    `commit=${git("rev-parse", "--short=12", "HEAD")}`,
    `apiHost=${apiHostname(process.env.VITE_API_URL)}`,
    `project=${project}`,
    `environment=${environmentClass(project)}`,
  ].join(" "),
);

if (!dryRun) {
  const plan = createNpmSpawnPlan(process.platform, [
    "run", "dev", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort",
  ]);
  const child = spawn(
    plan.command,
    plan.args,
    {
      stdio: "inherit",
      env: process.env,
      shell: plan.shell,
    },
  );

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }

  child.on("error", (error) => {
    console.error(`PLAYWRIGHT_SERVER_START_FAILED ${error.message}`);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}
