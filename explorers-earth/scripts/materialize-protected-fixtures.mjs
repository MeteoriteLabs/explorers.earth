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

function invalidGallery() {
  throw new Error("PROTECTED_FIXTURE_INVALID: gallery content is not a complete supported image");
}

function pngDimensions(bytes) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!bytes.subarray(0, 8).equals(signature)) return null;
  let offset = 8;
  let dimensions;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const end = offset + 12 + length;
    if (end > bytes.length) invalidGallery();
    if (!dimensions) {
      if (type !== "IHDR" || length !== 13) invalidGallery();
      const width = bytes.readUInt32BE(offset + 8);
      const height = bytes.readUInt32BE(offset + 12);
      if (!width || !height) invalidGallery();
      dimensions = { width, height };
    }
    offset = end;
    if (type === "IEND") {
      if (length !== 0 || offset !== bytes.length) invalidGallery();
      return dimensions;
    }
  }
  invalidGallery();
}

const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  let dimensions;
  let sawScan = false;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) invalidGallery();
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9) {
      if (!sawScan || !dimensions || offset !== bytes.length) invalidGallery();
      return dimensions;
    }
    if (marker === 0x00 || marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) invalidGallery();
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) invalidGallery();
    if (JPEG_SOF.has(marker)) {
      if (length < 8) invalidGallery();
      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      if (!width || !height) invalidGallery();
      dimensions = { width, height };
    }
    if (marker !== 0xda) {
      offset += length;
      continue;
    }
    sawScan = true;
    offset += length;
    while (offset < bytes.length) {
      if (bytes[offset++] !== 0xff) continue;
      while (bytes[offset] === 0xff) offset += 1;
      const next = bytes[offset];
      if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
        offset += 1;
        continue;
      }
      offset -= 1;
      break;
    }
  }
  invalidGallery();
}

function skipGifSubBlocks(bytes, offset) {
  while (offset < bytes.length) {
    const length = bytes[offset++];
    if (length === 0) return offset;
    if (offset + length > bytes.length) invalidGallery();
    offset += length;
  }
  invalidGallery();
}

function gifDimensions(bytes) {
  if (!["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) return null;
  if (bytes.length < 14) invalidGallery();
  const width = bytes.readUInt16LE(6);
  const height = bytes.readUInt16LE(8);
  if (!width || !height) invalidGallery();
  const packed = bytes[10];
  let offset = 13 + ((packed & 0x80) ? 3 * (2 ** ((packed & 0x07) + 1)) : 0);
  if (offset > bytes.length) invalidGallery();
  let sawImage = false;
  while (offset < bytes.length) {
    const introducer = bytes[offset++];
    if (introducer === 0x3b) {
      if (!sawImage || offset !== bytes.length) invalidGallery();
      return { width, height };
    }
    if (introducer === 0x21) {
      if (offset >= bytes.length) invalidGallery();
      offset += 1;
      offset = skipGifSubBlocks(bytes, offset);
      continue;
    }
    if (introducer !== 0x2c || offset + 9 > bytes.length) invalidGallery();
    const imageWidth = bytes.readUInt16LE(offset + 4);
    const imageHeight = bytes.readUInt16LE(offset + 6);
    const imagePacked = bytes[offset + 8];
    if (!imageWidth || !imageHeight) invalidGallery();
    offset += 9 + ((imagePacked & 0x80) ? 3 * (2 ** ((imagePacked & 0x07) + 1)) : 0);
    if (offset >= bytes.length || bytes[offset++] === 0) invalidGallery();
    offset = skipGifSubBlocks(bytes, offset);
    sawImage = true;
  }
  invalidGallery();
}

function webpDimensions(bytes) {
  if (bytes.subarray(0, 4).toString("ascii") !== "RIFF") return null;
  if (bytes.length < 20 || bytes.readUInt32LE(4) !== bytes.length - 8 || bytes.subarray(8, 12).toString("ascii") !== "WEBP") invalidGallery();
  let offset = 12;
  let dimensions;
  let sawImage = false;
  while (offset + 8 <= bytes.length) {
    const type = bytes.subarray(offset, offset + 4).toString("ascii");
    const length = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    const end = data + length;
    if (end > bytes.length) invalidGallery();
    if (type === "VP8X") {
      if (length !== 10) invalidGallery();
      dimensions = { width: bytes.readUIntLE(data + 4, 3) + 1, height: bytes.readUIntLE(data + 7, 3) + 1 };
    } else if (type === "VP8L") {
      if (length < 5 || bytes[data] !== 0x2f) invalidGallery();
      const bits = bytes.readUInt32LE(data + 1);
      dimensions = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
      sawImage = true;
    } else if (type === "VP8 ") {
      if (length < 10 || !bytes.subarray(data + 3, data + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) invalidGallery();
      dimensions = { width: bytes.readUInt16LE(data + 6) & 0x3fff, height: bytes.readUInt16LE(data + 8) & 0x3fff };
      if (!dimensions.width || !dimensions.height) invalidGallery();
      sawImage = true;
    }
    offset = end + (length % 2);
    if (offset > bytes.length) invalidGallery();
  }
  if (offset !== bytes.length || !dimensions || !sawImage) invalidGallery();
  return dimensions;
}

function galleryFixture(value) {
  if (typeof value !== "string" || value.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error("PROTECTED_FIXTURE_INVALID: gallery content must be base64");
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.length === 0 || bytes.length > MAX_GALLERY_BYTES) {
    throw new Error("PROTECTED_FIXTURE_INVALID: gallery content size is invalid");
  }
  const kind = pngDimensions(bytes)
    ? { extension: "png", mimeType: "image/png" }
    : jpegDimensions(bytes)
      ? { extension: "jpg", mimeType: "image/jpeg" }
      : gifDimensions(bytes)
        ? { extension: "gif", mimeType: "image/gif" }
        : webpDimensions(bytes)
          ? { extension: "webp", mimeType: "image/webp" }
          : null;
  if (!kind) throw new Error("PROTECTED_FIXTURE_INVALID: gallery content is not a supported image");
  return { bytes, ...kind };
}

export async function materializeProtectedFixtures({
  ownerStorageStateJson,
  nonOwnerStorageStateJson,
  galleryBase64,
  tempRoot = os.tmpdir(),
  fileSystem = fs,
} = {}) {
  const owner = storageState(ownerStorageStateJson);
  const nonOwner = storageState(nonOwnerStorageStateJson);
  const gallery = galleryFixture(galleryBase64);
  let directory;
  let complete = false;
  try {
    directory = await fileSystem.mkdtemp(path.join(path.resolve(tempRoot), PREFIX));
    await fileSystem.chmod(directory, 0o700);
    const ownerPath = path.join(directory, "owner-storage-state.json");
    const nonOwnerPath = path.join(directory, "non-owner-storage-state.json");
    const galleryPath = path.join(directory, `gallery-fixture.${gallery.extension}`);
    await fileSystem.writeFile(ownerPath, owner, { mode: 0o600, flag: "wx" });
    await fileSystem.writeFile(nonOwnerPath, nonOwner, { mode: 0o600, flag: "wx" });
    await fileSystem.writeFile(galleryPath, gallery.bytes, { mode: 0o600, flag: "wx" });
    complete = true;
    return { directory, ownerPath, nonOwnerPath, galleryPath, galleryMimeType: gallery.mimeType };
  } catch {
    throw new Error("PROTECTED_FIXTURE_INVALID: fixture materialization failed");
  } finally {
    if (directory && !complete) {
      await fileSystem.rm(directory, { recursive: true, force: true });
    }
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
  let published = false;
  try {
    await appendEnvironment(output, envFile);
    published = true;
    return output;
  } finally {
    if (!published) await cleanupProtectedFixtures(output.directory, tempRoot);
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
