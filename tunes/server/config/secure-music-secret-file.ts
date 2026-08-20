import { constants, type BigIntStats } from "node:fs";
import { lstat, open, realpath, type FileHandle } from "node:fs/promises";
import { dirname, isAbsolute, parse, resolve } from "node:path";

const MAX_SECRET_FILE_BYTES = 256;

export interface SecureMusicSecretFileSystem {
  lstat(path: string): Promise<BigIntStats>;
  open(path: string, flags: number): Promise<FileHandle>;
  realpath?(path: string): Promise<string>;
}

export interface SecureMusicSecretFileOptions {
  mode: "live" | "fixture";
  fileSystem?: SecureMusicSecretFileSystem;
  platform?: NodeJS.Platform;
  effectiveUserId?: number;
}

const defaultFileSystem: SecureMusicSecretFileSystem = {
  lstat: (path) => lstat(path, { bigint: true }),
  open: (path, flags) => open(path, flags),
  realpath,
};

export async function readSecureMusicSecretFile(
  path: string,
  options: SecureMusicSecretFileOptions,
): Promise<string> {
  try {
    if (!path || path.length > 512 || path.includes("\0") || !isAbsolute(path)) return invalidSecretFile();
    const fileSystem = options.fileSystem ?? defaultFileSystem;
    const ancestorPaths = ancestors(path);
    const ancestorBefore = await Promise.all(ancestorPaths.map(async (ancestor) => {
      const stat = await fileSystem.lstat(ancestor);
      validateDirectoryMetadata(stat);
      return stat;
    }));
    const canonicalBefore = await (fileSystem.realpath ?? defaultFileSystem.realpath!)(path);
    if (!sameResolvedPath(canonicalBefore, path, options.platform ?? process.platform)) return invalidSecretFile();
    const before = await fileSystem.lstat(path);
    validateMetadata(before, options);
    const noFollow = options.platform === "win32" || process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
    const handle = await fileSystem.open(path, constants.O_RDONLY | noFollow);
    try {
      const opened = await handle.stat({ bigint: true });
      validateMetadata(opened, options);
      if (!sameMetadata(before, opened)) return invalidSecretFile();

      const buffer = Buffer.alloc(MAX_SECRET_FILE_BYTES + 1);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      const afterRead = await handle.stat({ bigint: true });
      const afterPath = await fileSystem.lstat(path);
      const ancestorAfter = await Promise.all(ancestorPaths.map(async (ancestor) => {
        const stat = await fileSystem.lstat(ancestor);
        validateDirectoryMetadata(stat);
        return stat;
      }));
      const canonicalAfter = await (fileSystem.realpath ?? defaultFileSystem.realpath!)(path);
      validateMetadata(afterRead, options);
      validateMetadata(afterPath, options);
      if (bytesRead > MAX_SECRET_FILE_BYTES
          || bytesRead !== Number(opened.size)
          || !sameMetadata(opened, afterRead)
          || !sameMetadata(opened, afterPath)
          || !sameResolvedPath(canonicalAfter, path, options.platform ?? process.platform)
          || ancestorBefore.some((stat, index) => !sameDirectoryIdentity(stat, ancestorAfter[index]))) {
        return invalidSecretFile();
      }

      const raw = buffer.subarray(0, bytesRead).toString("ascii");
      if (!/^[A-Za-z0-9_-]+\n?$/.test(raw)) return invalidSecretFile();
      const value = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
      if (!value || Buffer.byteLength(value, "ascii") !== value.length) return invalidSecretFile();
      return value;
    } finally {
      await handle.close();
    }
  } catch {
    return invalidSecretFile();
  }
}

function ancestors(path: string): string[] {
  const root = parse(path).root;
  const result: string[] = [];
  let current = dirname(path);
  while (true) {
    result.push(current);
    if (current === root) break;
    const parent = dirname(current);
    if (parent === current) return invalidSecretFile();
    current = parent;
  }
  return result.reverse();
}

function validateDirectoryMetadata(stat: BigIntStats): void {
  if (!stat.isDirectory() || stat.isSymbolicLink()) invalidSecretFile();
}

function sameDirectoryIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.uid === right.uid
    && left.gid === right.gid;
}

function sameResolvedPath(left: string, right: string, platform: NodeJS.Platform): boolean {
  const normalize = (value: string) => resolve(value).replace(/^\\\\\?\\/, "");
  const leftResolved = normalize(left);
  const rightResolved = normalize(right);
  return platform === "win32" ? leftResolved.toLowerCase() === rightResolved.toLowerCase() : leftResolved === rightResolved;
}

function validateMetadata(stat: BigIntStats, options: SecureMusicSecretFileOptions): void {
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== BigInt(1)
      || stat.size < BigInt(1) || stat.size > BigInt(MAX_SECRET_FILE_BYTES)) {
    invalidSecretFile();
  }
  if (options.mode !== "live") return;
  if ((options.platform ?? process.platform) === "win32") return;
  if ((stat.mode & BigInt(0o077)) !== BigInt(0)) invalidSecretFile();
  const effectiveUserId = options.effectiveUserId ?? process.geteuid?.();
  if (stat.uid !== BigInt(0) && (effectiveUserId === undefined || stat.uid !== BigInt(effectiveUserId))) {
    invalidSecretFile();
  }
}

function sameMetadata(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.uid === right.uid
    && left.gid === right.gid
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function invalidSecretFile(): never {
  throw new Error("Music token secret file is insecure or invalid");
}
