import { fstatSync, readFileSync } from "node:fs";

const CHANNEL_ARGUMENT = "--music-native-release-channel";
const CHANNEL_MODES = new Set(["qualification", "rehearsal"]);
let nativeReleaseMode;

const markerIndex = process.argv.lastIndexOf(CHANNEL_ARGUMENT);
if (markerIndex !== -1) {
  const mode = process.argv[markerIndex + 1];
  const nonce = process.argv[markerIndex + 2];
  const nodeAuthority = Object.keys(process.env).find((name) => /^NODE(?:_|$)/i.test(name));
  let channel = "";
  let channelIsAnonymous = false;
  try {
    const stat = fstatSync(0);
    channelIsAnonymous = process.platform === "win32"
      ? !stat.isFile() && !stat.isDirectory() && !stat.isCharacterDevice()
      : stat.isFIFO() || stat.isSocket();
    channel = readFileSync(0, "utf8").trim();
  } catch {
    channelIsAnonymous = false;
  }
  if (markerIndex !== process.argv.length - 3
      || !CHANNEL_MODES.has(mode)
      || !/^[a-f0-9]{64}$/.test(nonce ?? "")
      || nodeAuthority
      || !channelIsAnonymous
      || channel !== nonce) {
    throw new Error("native Music release launcher attestation is invalid");
  }
  process.argv.splice(markerIndex, 3);
  nativeReleaseMode = mode;
}

export function requireNativeMusicReleaseLauncher(mode) {
  if (nativeReleaseMode !== mode) {
    throw new Error("native Music release launcher attestation is required");
  }
}
