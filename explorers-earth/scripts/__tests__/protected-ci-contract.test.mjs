import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import test from "node:test";

import {
  cleanupProtectedFixtures,
  materializeProtectedFixtures,
  materializeProtectedFixturesForCi,
} from "../materialize-protected-fixtures.mjs";
import { validateProtectedPrerequisites } from "../protected-prerequisites.mjs";
import { runPublicApiPreflight } from "../verify-public-api-access.mjs";

const workflowPath = new URL("../../../.github/workflows/ci.yml", import.meta.url);
const sourceImage = () => sharp({
  create: { width: 1, height: 1, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } },
});
const galleryCases = await Promise.all([
  [".png", "image/png", "png"],
  [".jpg", "image/jpeg", "jpeg"],
  [".gif", "image/gif", "gif"],
  [".webp", "image/webp", "webp"],
].map(async ([extension, mimeType, format]) => ({
  extension,
  mimeType,
  bytes: await sourceImage()[format]().toBuffer(),
})));

test("protected CI uses exact cleanup names, qa run IDs, and independent required artifacts", async () => {
  const workflow = await fs.readFile(workflowPath, "utf8");
  assert.match(workflow, /PUBLIC_API_ANALYTICS_RUN_CLEANUP_MUTATION:/);
  assert.match(workflow, /PUBLIC_API_ANALYTICS_RUN_CLEANUP_VERIFY_QUERY:/);
  assert.match(workflow, /PUBLIC_API_RUN_ID: qa-ci-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.doesNotMatch(workflow, /PUBLIC_API_RUN_ID: \$\{\{ github\.run_id \}\}/);
  assert.match(workflow, /materialize-protected-fixtures\.mjs/);
  assert.match(workflow, /--cleanup/);
  for (const required of [
    "verification-summary.json", "real-account-redacted/summary.json",
  ]) {
    assert.match(workflow, new RegExp(`test -f [^\\n]*${required.replaceAll(".", "\\.")}`));
  }
  assert.doesNotMatch(workflow, /E2E_PROFILE_STORAGE_STATE: \$\{\{ secrets\./);
  assert.doesNotMatch(workflow, /E2E_PROFILE_GALLERY_FILE: \$\{\{ (?:secrets|vars)\./);
});

test("materializes restrictive validated fixture files and removes them", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "protected-ci-contract-"));
  for (const gallery of galleryCases) {
    const result = await materializeProtectedFixtures({
      ownerStorageStateJson: JSON.stringify({ cookies: [], origins: [] }),
      nonOwnerStorageStateJson: JSON.stringify({ cookies: [], origins: [] }),
      galleryBase64: gallery.bytes.toString("base64"),
      tempRoot,
    });
    assert.equal(JSON.parse(await fs.readFile(result.ownerPath, "utf8")).cookies.length, 0);
    assert.deepEqual(await fs.readFile(result.galleryPath), gallery.bytes);
    assert.equal(path.extname(result.galleryPath), gallery.extension);
    assert.equal(result.galleryMimeType, gallery.mimeType);
    if (process.platform !== "win32") {
      assert.equal((await fs.stat(result.directory)).mode & 0o777, 0o700);
      assert.equal((await fs.stat(result.ownerPath)).mode & 0o777, 0o600);
    }
    await cleanupProtectedFixtures(result.directory, tempRoot);
    await assert.rejects(fs.stat(result.directory), { code: "ENOENT" });
  }
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test("rejects malformed storage JSON and non-image gallery content", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "protected-ci-invalid-"));
  await assert.rejects(materializeProtectedFixtures({
    ownerStorageStateJson: "secret-owner",
    nonOwnerStorageStateJson: "{}",
    galleryBase64: Buffer.from("not-an-image").toString("base64"),
    tempRoot,
  }), /PROTECTED_FIXTURE_INVALID/);
  for (const gallery of galleryCases) {
    for (const invalid of [
      gallery.bytes.subarray(0, Math.min(12, gallery.bytes.length)),
      gallery.bytes.subarray(0, gallery.bytes.length - 1),
    ]) {
      await assert.rejects(materializeProtectedFixtures({
        ownerStorageStateJson: JSON.stringify({ cookies: [], origins: [] }),
        nonOwnerStorageStateJson: JSON.stringify({ cookies: [], origins: [] }),
        galleryBase64: invalid.toString("base64"),
        tempRoot,
      }), /PROTECTED_FIXTURE_INVALID/);
    }
  }
  const zeroWidthPng = Buffer.from(galleryCases[0].bytes);
  zeroWidthPng.writeUInt32BE(0, 16);
  await assert.rejects(materializeProtectedFixtures({
    ownerStorageStateJson: JSON.stringify({ cookies: [], origins: [] }),
    nonOwnerStorageStateJson: JSON.stringify({ cookies: [], origins: [] }),
    galleryBase64: zeroWidthPng.toString("base64"),
    tempRoot,
  }), /PROTECTED_FIXTURE_INVALID/);
  await assert.rejects(materializeProtectedFixtures({
    ownerStorageStateJson: JSON.stringify({ cookies: [], origins: [] }),
    nonOwnerStorageStateJson: JSON.stringify({ cookies: [], origins: [] }),
    galleryBase64: Buffer.from("RIFF0000NOPEfixture").toString("base64"),
    tempRoot,
  }), /PROTECTED_FIXTURE_INVALID/);
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test("removes the temporary directory when permission hardening fails", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "protected-ci-chmod-failure-"));
  const fileSystem = {
    mkdtemp: fs.mkdtemp,
    chmod: async () => { throw new Error("injected chmod failure private-value"); },
    writeFile: fs.writeFile,
    rm: fs.rm,
  };
  await assert.rejects(materializeProtectedFixtures({
    ownerStorageStateJson: JSON.stringify({ cookies: [], origins: [] }),
    nonOwnerStorageStateJson: JSON.stringify({ cookies: [], origins: [] }),
    galleryBase64: galleryCases[0].bytes.toString("base64"),
    tempRoot,
    fileSystem,
  }), /PROTECTED_FIXTURE_INVALID/);
  assert.deepEqual(await fs.readdir(tempRoot), []);
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test("removes the temporary directory and emits a stable code when a fixture write fails", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "protected-ci-write-failure-"));
  let writes = 0;
  const fileSystem = {
    mkdtemp: fs.mkdtemp,
    chmod: fs.chmod,
    writeFile: async (...args) => {
      writes += 1;
      if (writes === 2) throw new Error("injected private write failure");
      return fs.writeFile(...args);
    },
    rm: fs.rm,
  };
  await assert.rejects(materializeProtectedFixtures({
    ownerStorageStateJson: JSON.stringify({ cookies: [], origins: [] }),
    nonOwnerStorageStateJson: JSON.stringify({ cookies: [], origins: [] }),
    galleryBase64: galleryCases[0].bytes.toString("base64"),
    tempRoot,
    fileSystem,
  }), /^Error: PROTECTED_FIXTURE_INVALID/);
  assert.deepEqual(await fs.readdir(tempRoot), []);
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test("removes materialized secrets if CI environment publication fails", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "protected-ci-publish-failure-"));
  const gallery = galleryCases[0].bytes;
  await assert.rejects(materializeProtectedFixturesForCi({
    ownerStorageStateJson: JSON.stringify({ cookies: [], origins: [] }),
    nonOwnerStorageStateJson: JSON.stringify({ cookies: [], origins: [] }),
    galleryBase64: gallery.toString("base64"),
    envFile: path.join(tempRoot, "missing", "github-env"),
    tempRoot,
  }));
  assert.deepEqual(await fs.readdir(tempRoot), []);
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test("CI-shaped placeholders pass static prerequisite shape but cannot claim live capability", async () => {
  const runId = "qa-ci-123-1";
  const env = {
    E2E_PROFILE_USERNAME: "fixture-user",
    E2E_PROFILE_STORAGE_STATE: "owner.json",
    E2E_PROFILE_NON_OWNER_STORAGE_STATE: "non-owner.json",
    E2E_PROFILE_GALLERY_FILE: "gallery.png",
    E2E_PROFILE_ROUTE_FIXTURES: JSON.stringify({
      enabledRouteIds: ["profile"],
      params: {},
      hiddenPath: "/fixture-user/hidden",
      deletedPath: "/fixture-user/deleted",
      unknownUsername: "missing-fixture-user",
    }),
    E2E_PROFILE_RUN_ID: runId,
    E2E_PROFILE_LIVE_WRITES: "1",
    E2E_PROFILE_LIVE_WRITE_CONFIRMATION: "I_APPROVE_PROFILE_MUTATION_AND_RESTORE",
    VITE_API_URL: "https://api.qa.explorers.earth/graphql",
    VITE_PUBLIC_READ_ACCESS_TOKEN: "fake-public-read-capability",
    VITE_ANALYTICS_WRITE_ACCESS_TOKEN: "fake-analytics-write-capability",
    PUBLIC_API_CAPABILITY_SCOPE: "published-read-only",
    PUBLIC_API_EXPECTED_ORIGIN: "https://qa.explorers.earth",
    PUBLIC_API_ORIGIN_POLICY: '{"allowOrigins":["https://qa.explorers.earth"]}',
    PUBLIC_API_RATE_LIMIT_POLICY: '{"environment":"non-production","limit":3,"windowSeconds":60}',
    PUBLIC_API_CONTROLLED_FIXTURE: "true",
    PUBLIC_API_PRIVATE_ACCOUNT_ID: "fixture-private-account",
    PUBLIC_API_PRIVATE_LIST_ID: "fixture-private-list",
    PUBLIC_API_PRIVATE_ITEM_ID: "fixture-private-item",
    PUBLIC_API_PRIVATE_LIST_SLUG: "fixture-private-slug",
    PUBLIC_PROFILE_MUTATION_APPROVED: "true",
    PUBLIC_PROFILE_TEST_ACCOUNT_MARKER: "public-profile-mutation-fixture",
    PUBLIC_API_ANALYTICS_CANARY_MUTATION: "mutation Canary { canary: createCanary }",
    PUBLIC_API_ANALYTICS_CLEANUP_MUTATION: "mutation Cleanup { cleanup: deleteCanary }",
    PUBLIC_API_ANALYTICS_CLEANUP_VERIFY_QUERY: "query CleanupVerify { remaining: canaries }",
    PUBLIC_API_ANALYTICS_RUN_CLEANUP_MUTATION: "mutation RunCleanup { cleanup: cleanupRun }",
    PUBLIC_API_ANALYTICS_RUN_CLEANUP_VERIFY_QUERY: "query RunCleanupVerify { remaining: remainingRun }",
    PUBLIC_API_ANALYTICS_QA_SINK: runId,
    PUBLIC_API_RUN_ID: runId,
  };

  assert.doesNotThrow(() => validateProtectedPrerequisites(env));
  const report = await runPublicApiPreflight({
    username: "fixture-user",
    env,
    retries: 0,
    fetchImpl: async () => new Response(JSON.stringify({ errors: [{ message: "unauthorized" }] }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
  });
  assert.notEqual(report.code, "READY");
  assert.equal(report.code, "PUBLIC_READ_UNAUTHORIZED");
});
