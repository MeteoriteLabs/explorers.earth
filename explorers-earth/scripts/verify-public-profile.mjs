import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { createNpmSpawnPlan } from "./npm-spawn-plan.mjs";
import { createVerificationResult, formatVerificationResult } from "./lib/verificationResult.mjs";
import { STABLE_BLOCKER_CODES } from "./lib/stableVerificationCodes.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.dirname(SCRIPT_DIR);
const SUMMARY_PATH = path.join(APP_ROOT, "test-results", "public-profile-verification", "verification-summary.json");
const PROTECTED_SUMMARY_PATH = path.join(APP_ROOT, "test-results", "playwright", "real-account-redacted", "summary.json");
const MAX_CHILD_OUTPUT = 256 * 1024;
const STATUS_CODES = new Map([
  [20, "ENV_MISSING"],
  [21, "ACCOUNT_MARKER_MISMATCH"],
  [22, "PUBLIC_READ_UNAUTHORIZED"],
  [23, "LIVE_WRITE_NOT_APPROVED"],
  [24, "RESTORE_FAILED"],
  [25, "ANALYTICS_CLEANUP_FAILED"],
]);

export function parseVerificationArgs(args, mode = "deterministic") {
  const options = { mode, username: "tk2727", headed: false, dryRun: false, json: false };
  for (const argument of args) {
    if (argument.startsWith("--username=")) options.username = argument.slice("--username=".length);
    else if (argument === "--headed") options.headed = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--json") options.json = true;
    else throw new Error(`UNKNOWN_OPTION: ${argument}`);
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(options.username)) throw new Error("INVALID_USERNAME");
  return options;
}

function step(id, args, nextCommand) {
  return { id, args, nextCommand };
}

export function createVerificationPlan({ mode, username, headed }) {
  if (mode === "release") {
    return [
      step("read-only-env", ["run", "verify:public-profile:env", "--", "--mode=read-only", "--json"], "Configure the read-only tier documented in docs/environment-variables.md."),
      step("public-api", ["run", "verify:public-api", "--", `--username=${username}`, "--json"], "Correct the reported public API capability blocker, then rerun this command."),
      step("mutation-env", ["run", "verify:public-profile:env", "--", "--mode=mutation", "--json"], "Complete the protected account marker, approval, restore, and analytics cleanup prerequisites."),
      step("real-account", ["run", "test:e2e:real-account", ...(headed ? ["--", "--headed"] : [])], "Follow e2e/real-account/README.md recovery guidance before any rerun."),
    ];
  }
  return [
    step("fixture-env", ["run", "verify:public-profile:env", "--", "--mode=fixture", "--json"]),
    step("contract", ["run", "test:public-profile-contract"]),
    step("lint", ["run", "lint", "--", "--quiet"]),
    step("typecheck-app", ["exec", "--", "tsc", "-b"]),
    step("typecheck-test", ["run", "typecheck:test"]),
    step("typecheck-e2e", ["run", "typecheck:e2e"]),
    step("i18n", ["run", "i18n:check"]),
    step("unit", ["run", "test:unit", "--", "--reporter=verbose"]),
    step("coverage", ["run", "test:public-profile:coverage"]),
    step("e2e", ["run", "test:e2e", ...(headed ? ["--", "--headed"] : [])]),
    step("build", ["run", "build"]),
  ];
}

async function spawnStep(stepDefinition, options) {
  const command = createNpmSpawnPlan(process.platform, stepDefinition.args);
  if (stepDefinition.id === "real-account") {
    await fs.rm(PROTECTED_SUMMARY_PATH, { force: true });
  }
  return new Promise((resolve) => {
    const child = spawn(command.command, command.args, {
      cwd: APP_ROOT,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const append = (current, chunk) => `${current}${chunk}`.slice(-MAX_CHILD_OUTPUT);
    child.stdout.on("data", (chunk) => {
      stdout = append(stdout, chunk);
      if (!options.json) process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr = append(stderr, chunk);
      if (!options.json) process.stderr.write(chunk);
    });
    let settled = false;
    child.once("error", () => {
      if (!settled) resolve({ status: 1, stdout, stderr });
      settled = true;
    });
    child.once("close", async (status) => {
      if (settled) return;
      settled = true;
      const protectedSummary = stepDefinition.id === "real-account"
        ? await fs.readFile(PROTECTED_SUMMARY_PATH, "utf8").catch(() => undefined)
        : undefined;
      resolve({
        status: status ?? 1,
        stdout,
        stderr,
        protectedSummary,
        ...(protectedSummary ? { artifactPath: path.relative(APP_ROOT, PROTECTED_SUMMARY_PATH).replaceAll("\\", "/") } : {}),
      });
    });
  });
}

function safeArtifactPath(value) {
  if (typeof value !== "string" || path.isAbsolute(value) || value.includes("..")) return undefined;
  const normalized = value.replaceAll("\\", "/");
  return /^test-results\/[a-zA-Z0-9._/-]+$/.test(normalized) ? normalized : undefined;
}

export function extractStableChildEvidence({ stdout = "", stderr = "", protectedSummary, code, artifactPath } = {}) {
  let stableCode = STABLE_BLOCKER_CODES.has(code) ? code : undefined;
  let stableArtifact = safeArtifactPath(artifactPath);
  const inspectStructured = (value) => {
    if (!value || typeof value !== "object") return;
    if (!stableCode && STABLE_BLOCKER_CODES.has(value.code)) stableCode = value.code;
    stableArtifact ??= safeArtifactPath(value.artifactPath);
    if (Array.isArray(value.tests)) value.tests.forEach(inspectStructured);
  };
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try {
      inspectStructured(JSON.parse(line));
    } catch {
      // Arbitrary output is intentionally ignored.
    }
  }
  if (protectedSummary) {
    try {
      inspectStructured(JSON.parse(protectedSummary));
    } catch {
      // A malformed report cannot become release evidence.
    }
  }
  if (!stableCode) {
    for (const candidate of STABLE_BLOCKER_CODES) {
      const pattern = new RegExp(`(?:^|\\n)[^\\n]{0,80}\\b${candidate}\\b(?:[:\\s]|$)`);
      if (pattern.test(stderr)) {
        stableCode = candidate;
        break;
      }
    }
  }
  return {
    ...(stableCode ? { code: stableCode } : {}),
    ...(stableArtifact ? { artifactPath: stableArtifact } : {}),
  };
}

async function persistResult(result) {
  await fs.mkdir(path.dirname(SUMMARY_PATH), { recursive: true });
  await fs.writeFile(SUMMARY_PATH, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
}

export async function runVerificationPlan({ options, spawn: spawnOverride = spawnStep }) {
  const plan = createVerificationPlan(options);
  if (options.dryRun) {
    return createVerificationResult({
      code: "DRY_RUN",
      summary: `${options.mode} public-profile verification plan; no child commands executed.`,
      safeContext: { mode: options.mode, commands: plan.map(({ id, args }) => ({ id, args })) },
      remediation: options.mode === "release"
        ? "Satisfy the protected prerequisites, then rerun without --dry-run."
        : "Rerun without --dry-run to execute deterministic verification.",
    });
  }

  const completed = [];
  for (const current of plan) {
    const outcome = await spawnOverride(current, options);
    if (outcome.status !== 0) {
      const evidence = extractStableChildEvidence(outcome);
      const code = evidence.code ?? STATUS_CODES.get(outcome.status) ?? "CHILD_COMMAND_FAILED";
      const result = createVerificationResult({
        code,
        summary: `Public-profile verification stopped at ${current.id}.`,
        safeContext: {
          mode: options.mode,
          failedCommand: current.id,
          exitStatus: outcome.status,
          completed,
          ...(current.nextCommand ? { nextCommand: current.nextCommand } : {}),
        },
        remediation: current.nextCommand ?? `Fix ${current.id}, then rerun the ${options.mode} verification command.`,
        artifactPath: evidence.artifactPath ?? path.relative(APP_ROOT, SUMMARY_PATH).replaceAll("\\", "/"),
      });
      await persistResult(result);
      return result;
    }
    completed.push(current.id);
  }

  const result = createVerificationResult({
    code: "READY",
    summary: `${options.mode} public-profile verification completed.`,
    safeContext: { mode: options.mode, completed },
    remediation: options.mode === "release" ? "Review the protected report before approving release." : "Review artifacts and proceed to protected UAT when its prerequisites are available.",
    artifactPath: path.relative(APP_ROOT, SUMMARY_PATH).replaceAll("\\", "/"),
  });
  await persistResult(result);
  return result;
}

async function main() {
  const mode = process.env.npm_lifecycle_event === "verify:public-profile:release" ? "release" : "deterministic";
  let options;
  try {
    options = parseVerificationArgs(process.argv.slice(2), mode);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "INVALID_OPTIONS");
    process.exitCode = 2;
    return;
  }
  const result = await runVerificationPlan({ options });
  console.log(formatVerificationResult(result, options.json));
  process.exitCode = result.code === "READY" || result.code === "DRY_RUN" ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
