import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function read(relativePath) {
  return readFile(path.resolve(appRoot, relativePath), "utf8");
}

test("verification contract keeps capability names and deterministic browser scope aligned", async () => {
  const [packageJson, envExample, environmentDocs, playwrightConfig] = await Promise.all([
    read("package.json"),
    read(".env.example"),
    read("../docs/environment-variables.md"),
    read("playwright.config.ts"),
  ]);
  const scripts = JSON.parse(packageJson).scripts;

  assert.equal(scripts["verify:public-api"], "node scripts/verify-public-api-access.mjs");
  assert.equal(scripts["verify:public-profile:env"], "node scripts/verify-public-profile-env.mjs");
  for (const capability of ["VITE_PUBLIC_READ_ACCESS_TOKEN", "VITE_ANALYTICS_WRITE_ACCESS_TOKEN"]) {
    assert.match(envExample, new RegExp(`^${capability}=`, "m"));
    assert.match(environmentDocs, new RegExp(`\`${capability}\``));
  }
  assert.match(environmentDocs, /Deterministic fixture/);
  assert.match(environmentDocs, /Protected mutation/);
  assert.match(environmentDocs, /VITE_PUBLIC_ACCESS_TOKEN.*deprecated/i);
  assert.match(playwrightConfig, /name: 'chromium'/);
  assert.doesNotMatch(playwrightConfig, /real-account|VITE_ANALYTICS_WRITE_ACCESS_TOKEN/);
});
