import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function read(relativePath) {
  return readFile(path.resolve(appRoot, relativePath), "utf8");
}

function npmInvocation(args) {
  if (process.env.npm_execpath) return { command: process.execPath, args: [process.env.npm_execpath, ...args] };
  if (process.platform === "win32") return { command: process.execPath, args: [path.resolve(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"), ...args] };
  return { command: "npm", args };
}

test("the package environment-doctor command returns the stable deterministic result", () => {
  const invocation = npmInvocation(["run", "verify:public-profile:env", "--", "--mode=fixture", "--json"]);
  const child = spawnSync(invocation.command, invocation.args, { cwd: appRoot, encoding: "utf8" });
  const jsonLine = child.stdout.trim().split(/\r?\n/).findLast((line) => line.startsWith("{"));

  assert.equal(child.status, 0, child.stderr || child.stdout);
  assert.deepEqual(JSON.parse(jsonLine), {
    code: "READY",
    summary: "Deterministic fixture verification is ready.",
    safeContext: { mode: "fixture", publicReadSource: "not-required", analyticsWriteSource: "not-required" },
    remediation: "Run npm run verify:public-profile:env -- --mode=fixture before deterministic tests.",
  });
});

test("Playwright discovery for the deterministic project excludes real-account specs", () => {
  const playwrightCli = path.resolve(appRoot, "node_modules/@playwright/test/cli.js");
  const child = spawnSync(process.execPath, [playwrightCli, "test", "--project=chromium", "--list"], { cwd: appRoot, encoding: "utf8" });
  const output = `${child.stdout}\n${child.stderr}`;

  assert.equal(child.status, 0, output);
  assert.match(output, /Listing tests:/);
  assert.match(output, /\[chromium\]/);
  assert.doesNotMatch(output, /real-account/i);
});

test("human verification docs retain the exact runtime, tiers, and capability names", async () => {
  const [environmentDocs, troubleshooting] = await Promise.all([
    read("../docs/environment-variables.md"),
    read("../docs/troubleshooting.md"),
  ]);

  for (const capability of ["VITE_PUBLIC_READ_ACCESS_TOKEN", "VITE_ANALYTICS_WRITE_ACCESS_TOKEN"]) assert.ok(environmentDocs.includes(`\`${capability}\``));
  for (const tier of ["Deterministic fixture", "Live read-only", "Protected mutation"]) assert.match(environmentDocs, new RegExp(tier));
  assert.match(troubleshooting, /Node `>=22\.12`/);
  assert.doesNotMatch(troubleshooting, /Node(?:\.js)? 18\+/i);
});
