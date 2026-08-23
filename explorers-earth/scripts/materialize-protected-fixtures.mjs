import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PREFIX = "explorers-profile-ci-";
const MAX_GALLERY_BYTES = 10 * 1024 * 1024;

function storageState(value) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("PROTECTED_FIXTURE_INVALID: storage state must be JSON");
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.cookies) || !Array.isArray(parsed.origins)) {
    throw new Error("PROTECTED_FIXTURE_INVALID: storage state requires cookies and origins arrays");
  }
  return `${JSON.stringify(parsed)}\n`;
}

function galleryBytes(value) {
  if (typeof value !== "string" || value.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error("PROTECTED_FIXTURE_INVALID: gallery content must be base64");
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.length === 0 || bytes.length > MAX_GALLERY_BYTES) {
    throw new Error("PROTECTED_FIXTURE_INVALID: gallery content size is invalid");
  }
  const png = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const gif = bytes.subarray(0, 6).toString("ascii") === "GIF87a" || bytes.subarray(0, 6).toString("ascii") === "GIF89a";
  const webp = bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (!png && !jpeg && !gif && !webp) throw new Error("PROTECTED_FIXTURE_INVALID: gallery content is not a supported image");
  return bytes;
}

export async function materializeProtectedFixtures({
  ownerStorageStateJson,
  nonOwnerStorageStateJson,
  galleryBase64,
  tempRoot = os.tmpdir(),
} = {}) {
  const owner = storageState(ownerStorageStateJson);
  const nonOwner = storageState(nonOwnerStorageStateJson);
  const gallery = galleryBytes(galleryBase64);
  const directory = await fs.mkdtemp(path.join(path.resolve(tempRoot), PREFIX));
  await fs.chmod(directory, 0o700);
  const ownerPath = path.join(directory, "owner-storage-state.json");
  const nonOwnerPath = path.join(directory, "non-owner-storage-state.json");
  const galleryPath = path.join(directory, "gallery-fixture.png");
  try {
    await fs.writeFile(ownerPath, owner, { mode: 0o600, flag: "wx" });
    await fs.writeFile(nonOwnerPath, nonOwner, { mode: 0o600, flag: "wx" });
    await fs.writeFile(galleryPath, gallery, { mode: 0o600, flag: "wx" });
    return { directory, ownerPath, nonOwnerPath, galleryPath };
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function cleanupProtectedFixtures(directory, tempRoot = os.tmpdir()) {
  const root = path.resolve(tempRoot);
  const target = path.resolve(directory ?? "");
  if (path.dirname(target) !== root || !path.basename(target).startsWith(PREFIX)) {
    throw new Error("PROTECTED_FIXTURE_CLEANUP_REFUSED");
  }
  await fs.rm(target, { recursive: true, force: true });
}

async function appendGitHubEnvironment(output, envFile) {
  if (!envFile) throw new Error("ENV_MISSING: GITHUB_ENV");
  const lines = [
    `E2E_PROFILE_FIXTURE_DIR=${output.directory}`,
    `E2E_PROFILE_STORAGE_STATE=${output.ownerPath}`,
    `E2E_PROFILE_NON_OWNER_STORAGE_STATE=${output.nonOwnerPath}`,
    `E2E_PROFILE_GALLERY_FILE=${output.galleryPath}`,
  ];
  await fs.appendFile(envFile, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
}

export async function materializeProtectedFixturesForCi({
  ownerStorageStateJson,
  nonOwnerStorageStateJson,
  galleryBase64,
  envFile,
  tempRoot = os.tmpdir(),
  appendEnvironment = appendGitHubEnvironment,
} = {}) {
  const output = await materializeProtectedFixtures({
    ownerStorageStateJson,
    nonOwnerStorageStateJson,
    galleryBase64,
    tempRoot,
  });
  try {
    await appendEnvironment(output, envFile);
    return output;
  } catch (error) {
    await cleanupProtectedFixtures(output.directory, tempRoot);
    throw error;
  }
}

async function main() {
  const cleanup = process.argv.find((argument) => argument.startsWith("--cleanup="))?.slice("--cleanup=".length);
  if (cleanup) {
    await cleanupProtectedFixtures(cleanup);
    return;
  }
  await materializeProtectedFixturesForCi({
    ownerStorageStateJson: process.env.PROTECTED_OWNER_STORAGE_STATE_JSON,
    nonOwnerStorageStateJson: process.env.PROTECTED_NON_OWNER_STORAGE_STATE_JSON,
    galleryBase64: process.env.PROTECTED_GALLERY_BASE64,
    envFile: process.env.GITHUB_ENV,
  });
  process.stdout.write("Protected fixture files materialized.\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message.split(":")[0] : "PROTECTED_FIXTURE_INVALID"}\n`);
    process.exitCode = 1;
  });
}
