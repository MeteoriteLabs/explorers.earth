import { spawnSync } from "node:child_process";
import { createHash, timingSafeEqual } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

const REQUIRED_CODE_FILES = [
  "music-deploy-engine.sh",
  "music-hmac.mjs",
  "verify-publication-authority.mjs",
] as const;

const TRUSTED_GIT_CANDIDATES = process.platform === "win32"
  ? ["C:/Program Files/Git/cmd/git.exe", "C:/Program Files/Git/bin/git.exe"]
  : process.platform === "darwin"
    ? ["/usr/bin/git", "/opt/homebrew/bin/git", "/usr/local/bin/git"]
    : ["/usr/bin/git", "/usr/local/bin/git"];

function fail(message: string): never {
  throw new Error(message);
}

export function resolveTrustedSystemExecutable(label: string, candidates: readonly string[]): string {
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const exact = realpathSync(candidate);
    const stat = lstatSync(exact);
    if (!stat.isFile()) continue;
    if (process.platform === "win32") {
      const acl = spawnSync("C:/Windows/System32/icacls.exe", [exact], {
        encoding: "utf8",
        windowsHide: true,
      });
      if (acl.status !== 0) continue;
      const unsafeWriter = acl.stdout.split(/\r?\n/).some((line) =>
        /\((?:F|M|W|WD|AD|DC|WO)\)/.test(line)
        && !/(?:NT AUTHORITY\\SYSTEM|BUILTIN\\Administrators|NT SERVICE\\TrustedInstaller)/i.test(line));
      if (unsafeWriter) continue;
    } else if (stat.uid !== 0 || (stat.mode & 0o022) !== 0) {
      continue;
    }
    return exact;
  }
  fail(`trusted system ${label} executable is unavailable`);
}

const gitExecutable = resolveTrustedSystemExecutable("Git", TRUSTED_GIT_CANDIDATES);

function runGit(root: string, args: string[], encoding: "utf8"): string;
function runGit(root: string, args: string[], encoding: null): Buffer;
function runGit(root: string, args: string[], encoding: "utf8" | null): string | Buffer {
  const result = spawnSync(gitExecutable, args, {
    cwd: root,
    encoding,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) fail("trusted source Git operation failed");
  return result.stdout;
}

function portable(path: string): string {
  return path.replaceAll("\\", "/");
}

function trackedRelativePath(root: string, path: string): string {
  const candidate = relative(root, path).split(sep).join("/");
  if (!candidate || candidate === ".." || candidate.startsWith("../")) {
    fail("executing rehearsal script must be tracked");
  }
  const result = spawnSync(gitExecutable, ["ls-files", "--error-unmatch", "--full-name", "--", candidate], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) fail("executing rehearsal script must be tracked");
  const tracked = result.stdout.trim();
  if (tracked !== candidate) fail("executing rehearsal script must be tracked");
  return candidate;
}

function trackedObjectId(root: string, commit: string, path: string): string {
  const objectId = runGit(root, ["rev-parse", `${commit}:${path}`], "utf8").trim();
  if (!/^[a-f0-9]{40}$/.test(objectId)) fail("tracked source object identity is invalid");
  return objectId;
}

function workingTreeObjectId(root: string, path: string): string {
  const objectId = runGit(root, ["hash-object", `--path=${path}`, "--", path], "utf8").trim();
  if (!/^[a-f0-9]{40}$/.test(objectId)) fail("tracked source object identity is invalid");
  return objectId;
}

function hiddenTrackedFlags(root: string): string[] {
  return runGit(root, ["ls-files", "-v"], "utf8").split(/\r?\n/).filter((line) => /^[a-zS] /.test(line));
}

function cleanTrackedCheckout(root: string): boolean {
  const status = runGit(root, ["status", "--porcelain=v1", "--untracked-files=no"], "utf8").trim();
  const worktree = spawnSync(gitExecutable, ["diff", "--quiet", "HEAD", "--"], { cwd: root, windowsHide: true });
  const index = spawnSync(gitExecutable, ["diff", "--cached", "--quiet", "HEAD", "--"], { cwd: root, windowsHide: true });
  return status === "" && worktree.status === 0 && index.status === 0;
}

export interface TrustedFixtureSource {
  repoRoot: string;
  nativeRepoRoot: string;
  scriptPath: string;
  scriptRelativePath: string;
  commit: string;
  tunesArchive: Buffer;
  codeFiles: Record<(typeof REQUIRED_CODE_FILES)[number], Buffer>;
}

export function captureTrustedFixtureSource(scriptInput: string): TrustedFixtureSource {
  const scriptPath = realpathSync(resolve(scriptInput));
  const discovered = runGit(dirname(scriptPath), ["rev-parse", "--show-toplevel"], "utf8").trim();
  const nativeRepoRoot = realpathSync(discovered);
  const scriptRelativePath = trackedRelativePath(nativeRepoRoot, scriptPath);
  if (hiddenTrackedFlags(nativeRepoRoot).length) fail("hidden tracked source flags are forbidden");
  if (!cleanTrackedCheckout(nativeRepoRoot)) fail("tracked source checkout must be clean");
  const commit = runGit(nativeRepoRoot, ["rev-parse", "HEAD"], "utf8").trim();
  if (!/^[a-f0-9]{40}$/.test(commit)) fail("exact source commit is invalid");
  if (workingTreeObjectId(nativeRepoRoot, scriptRelativePath)
    !== trackedObjectId(nativeRepoRoot, commit, scriptRelativePath)) {
    fail("executing rehearsal script does not match the exact source commit");
  }
  const tunesArchive = runGit(nativeRepoRoot, ["archive", "--format=tar", `${commit}:tunes`], null);
  const codeFiles = Object.fromEntries(REQUIRED_CODE_FILES.map((name) => [
    name,
    runGit(nativeRepoRoot, ["show", `${commit}:tunes/deployment/${name}`], null),
  ])) as TrustedFixtureSource["codeFiles"];
  return {
    repoRoot: portable(nativeRepoRoot),
    nativeRepoRoot,
    scriptPath: portable(scriptPath),
    scriptRelativePath,
    commit,
    tunesArchive,
    codeFiles,
  };
}

export function assertTrustedFixtureSourceUnchanged(authority: TrustedFixtureSource): void {
  const head = runGit(authority.nativeRepoRoot, ["rev-parse", "HEAD"], "utf8").trim();
  if (head !== authority.commit || hiddenTrackedFlags(authority.nativeRepoRoot).length
    || !cleanTrackedCheckout(authority.nativeRepoRoot)) {
    fail("tracked source checkout changed");
  }
  const path = realpathSync(resolve(authority.nativeRepoRoot, ...authority.scriptRelativePath.split("/")));
  if (portable(path) !== authority.scriptPath) fail("tracked source checkout changed");
  if (workingTreeObjectId(authority.nativeRepoRoot, authority.scriptRelativePath)
    !== trackedObjectId(authority.nativeRepoRoot, authority.commit, authority.scriptRelativePath)) {
    fail("tracked source checkout changed");
  }
}

export function assertNoExternalFixtureAuthority(environment: NodeJS.ProcessEnv): void {
  const forbidden = Object.keys(environment).sort().find((name) =>
    name.startsWith("MUSIC_DEPLOY_") && environment[name] !== undefined && environment[name] !== "");
  if (forbidden) fail(`external fixture deployment authority is forbidden: ${forbidden}`);
}

export interface PrivateFixtureFile {
  path: string;
  expected: Buffer;
  digest: string;
  device: string;
  inode: string;
  links: string;
  size: string;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function capturePrivateFixtureFile(pathInput: string, expected: Buffer): PrivateFixtureFile {
  const path = realpathSync(resolve(pathInput));
  const stat = lstatSync(path, { bigint: true });
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n) fail("fixture authority must be one regular file");
  const observed = readFileSync(path);
  if (observed.length !== expected.length || !timingSafeEqual(observed, expected)) {
    fail("fixture authority bytes changed");
  }
  return {
    path,
    expected: Buffer.from(expected),
    digest: sha256(expected),
    device: stat.dev.toString(),
    inode: stat.ino.toString(),
    links: stat.nlink.toString(),
    size: stat.size.toString(),
  };
}

export function assertPrivateFixtureFileUnchanged(authority: PrivateFixtureFile): void {
  let path: string;
  try {
    path = realpathSync(authority.path);
  } catch {
    fail("fixture authority native identity changed");
  }
  const stat = lstatSync(path, { bigint: true });
  if (path !== authority.path || !stat.isFile() || stat.isSymbolicLink()
    || stat.dev.toString() !== authority.device || stat.ino.toString() !== authority.inode
    || stat.nlink.toString() !== authority.links || stat.size.toString() !== authority.size) {
    fail("fixture authority native identity changed");
  }
  const observed = readFileSync(path);
  if (sha256(observed) !== authority.digest || observed.length !== authority.expected.length
    || !timingSafeEqual(observed, authority.expected)) {
    fail("fixture authority bytes changed");
  }
}

export function requireRegistryReturnedDigest(value: string | undefined): string {
  if (!value || !/^sha256:[a-f0-9]{64}$/.test(value)) {
    fail("loopback registry returned an invalid immutable digest");
  }
  return value;
}

function shellLiteral(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export interface InternalFixturePolicyInput {
  engineFile: string;
  root: string;
  repository: string;
  source: string;
  composeProject: string;
  dockerExecutable: string;
  dockerEndpoint: string;
  approvedImages: readonly string[];
  authorities: readonly Pick<PrivateFixtureFile, "path" | "digest">[];
}

export function createInternalFixturePolicyScript(input: InternalFixturePolicyInput): string {
  if (!/^127\.0\.0\.1:[1-9][0-9]{3,4}\/[a-z0-9._/-]+$/.test(input.repository)
    || !/^music-c10-release-[a-z0-9-]+$/.test(input.composeProject)
    || !/^(?:\/[A-Za-z0-9._+ /-]+|[A-Za-z]:[\\/][A-Za-z0-9._+ \\/-]+)$/.test(input.dockerExecutable)
    || !input.approvedImages.length
    || !input.approvedImages.every((image) => image.startsWith(`${input.repository}@sha256:`)
      && /^sha256:[a-f0-9]{64}$/.test(image.slice(image.lastIndexOf("@") + 1)))) {
    fail("internal fixture policy authority is invalid");
  }
  const checks = input.authorities.map(({ path, digest }) => [
    `[[ -f ${shellLiteral(path)} && ! -L ${shellLiteral(path)} ]] || fail "internal fixture authority missing"`,
    `[[ "$(sha256sum ${shellLiteral(path)} | awk '{print $1}')" == ${shellLiteral(digest)} ]] || fail "internal fixture authority changed"`,
  ].join("\n")).join("\n");
  const imageCases = input.approvedImages.map(shellLiteral).join("|");
  return `#!/usr/bin/env bash
set -euo pipefail
umask 077
fail() { printf '%s\\n' "$*" >&2; exit 1; }
${checks}
docker() { command ${shellLiteral(input.dockerExecutable)} --host ${shellLiteral(input.dockerEndpoint)} "$@"; }
readonly -f docker
readonly MUSIC_DEPLOY_POLICY_ID=fixture-loopback-v1
readonly MUSIC_DEPLOY_POLICY_REPOSITORY=${shellLiteral(input.repository)}
readonly MUSIC_DEPLOY_POLICY_SOURCE=${shellLiteral(input.source)}
export MUSIC_DEPLOY_EXPECTED_REPOSITORY="$MUSIC_DEPLOY_POLICY_REPOSITORY"
export MUSIC_DEPLOY_EXPECTED_SOURCE="$MUSIC_DEPLOY_POLICY_SOURCE"
music_deploy_registry_materialize() {
  local auth_dir="$1" candidate_image="$2"
  case "$candidate_image" in ${imageCases}) ;; *) fail "fixture candidate is not an internally built registry digest" ;; esac
  docker --config "$auth_dir" pull "$candidate_image"
}
music_deploy_registry_cleanup() {
  local auth_dir="$1"
  rm -f -- "$auth_dir/config.json"
  rmdir -- "$auth_dir" 2>/dev/null || true
}
music_deploy_validate_compose_project() {
  [[ "$1" == ${shellLiteral(input.composeProject)} ]] || fail "fixture signed Compose project mismatch"
}
music_deploy_router_security() { return 0; }
music_deploy_route_committed() {
  docker compose -p ${shellLiteral(input.composeProject)} --project-directory ${shellLiteral(input.root)} \\
    --env-file ${shellLiteral(`${input.root}/production.env`)} -f ${shellLiteral(`${input.root}/docker-compose.yml`)} restart traefik >/dev/null 2>&1 || true
}
source ${shellLiteral(input.engineFile)}
`;
}
