import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import { createNpmSpawnPlan } from "./npm-spawn-plan.mjs";
import { createVerificationResult, formatVerificationResult } from "./lib/verificationResult.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.dirname(SCRIPT_DIR);
const SUMMARY_PATH = path.join(APP_ROOT, "test-results", "public-profile-verification", "verification-summary.json");
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

function spawnStep(stepDefinition, options) {
  const command = createNpmSpawnPlan(process.platform, stepDefinition.args);
  return new Promise((resolve) => {
    const child = spawn(command.command, command.args, {
      cwd: APP_ROOT,
      env: process.env,
      shell: false,
      stdio: options.json ? "ignore" : "inherit",
    });
    child.once("error", () => resolve({ status: 1 }));
    child.once("close", (status) => resolve({ status: status ?? 1 }));
  });
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
      const code = outcome.code ?? STATUS_CODES.get(outcome.status) ?? "CHILD_COMMAND_FAILED";
      const result = createVerificationResult({
        code,
        summary: `Public-profile verification stopped at ${current.id}.`,
        safeContext: { mode: options.mode, failedCommand: current.id, exitStatus: outcome.status, completed },
        remediation: current.nextCommand ?? `Fix ${current.id}, then rerun the ${options.mode} verification command.`,
        artifactPath: path.relative(APP_ROOT, SUMMARY_PATH).replaceAll("\\", "/"),
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
