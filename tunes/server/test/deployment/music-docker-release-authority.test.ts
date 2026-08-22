import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertNoExternalFixtureAuthority,
  assertPrivateFixtureFileUnchanged,
  assertTrustedFixtureSourceUnchanged,
  capturePrivateFixtureFile,
  captureTrustedFixtureSource,
  createInternalFixturePolicyScript,
  requireRegistryReturnedDigest,
  resolveTrustedSystemExecutable,
} from "../../../scripts/music-docker-release-authority";

const sandboxes: string[] = [];
const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "/bin/bash";
const shellPath = (path: string) => {
  const normalized = path.replaceAll("\\", "/");
  return process.platform === "win32" ? `/${normalized[0]!.toLowerCase()}${normalized.slice(2)}` : normalized;
};
const git = (root: string, ...args: string[]) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`${args.join(" ")}: ${result.stderr}`);
  return result.stdout.trim();
};

function cleanFixtureRepository(crlfScript = false): { root: string; script: string; commit: string } {
  const root = mkdtempSync(join(tmpdir(), "music-c10-source-authority-"));
  sandboxes.push(root);
  const files = {
    ...(crlfScript ? { ".gitattributes": "*.ts text eol=crlf\n" } : {}),
    "tunes/scripts/music-docker-release-rehearsal.ts": "export const tracked = true;\n",
    "tunes/Dockerfile": "FROM scratch\nCOPY . /app\n",
    "tunes/app.ts": "export const exact = 1;\n",
    "tunes/deployment/music-deploy-engine.sh": "engine\n",
    "tunes/deployment/music-hmac.mjs": "hmac\n",
    "tunes/deployment/verify-publication-authority.mjs": "verify\n",
  };
  for (const [relative, contents] of Object.entries(files)) {
    const path = join(root, ...relative.split("/"));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
  git(root, "init");
  git(root, "config", "user.email", "fixture@example.invalid");
  git(root, "config", "user.name", "Fixture Test");
  git(root, "add", ".");
  git(root, "commit", "-m", "fixture");
  const script = join(root, "tunes/scripts/music-docker-release-rehearsal.ts");
  if (crlfScript) {
    rmSync(script);
    git(root, "checkout", "--", "tunes/scripts/music-docker-release-rehearsal.ts");
  }
  return {
    root,
    script,
    commit: git(root, "rev-parse", "HEAD"),
  };
}

afterEach(() => {
  for (const path of sandboxes.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("Music Docker release source authority", () => {
  it("refuses caller-selected source, root, Compose, expected-image map, and HMAC authority", () => {
    for (const name of [
      "MUSIC_DEPLOY_ROOT",
      "MUSIC_DEPLOY_REQUEST_FILE",
      "MUSIC_DEPLOY_HMAC_KEY_FILE",
      "MUSIC_DEPLOY_FIXTURE_EXPECTED_IMAGE_FILE",
      "MUSIC_DEPLOY_FIXTURE_COMPOSE_FILE",
      "MUSIC_DEPLOY_FIXTURE_SOURCE_ROOT",
    ]) {
      expect(() => assertNoExternalFixtureAuthority({ [name]: "caller-owned" })).toThrow(
        `external fixture deployment authority is forbidden: ${name}`,
      );
    }
    expect(() => assertNoExternalFixtureAuthority({ PATH: process.env.PATH })).not.toThrow();
    const root = mkdtempSync(join(tmpdir(), "music-c10-host-tool-"));
    sandboxes.push(root);
    const callerTool = join(root, process.platform === "win32" ? "git.exe" : "git");
    writeFileSync(callerTool, "caller selected\n");
    chmodSync(callerTool, 0o777);
    expect(() => resolveTrustedSystemExecutable("caller tool", [callerTool]))
      .toThrow("trusted system caller tool executable is unavailable");
  });

  it("captures exact Git-object bytes from the executing tracked script and fails on source changes", () => {
    const fixture = cleanFixtureRepository(true);
    const fakeBin = join(fixture.root, "caller-bin");
    mkdirSync(fakeBin);
    const fakeGit = join(fakeBin, process.platform === "win32" ? "git.exe" : "git");
    writeFileSync(fakeGit, "#!/usr/bin/env bash\nexit 91\n");
    chmodSync(fakeGit, 0o700);
    const originalPath = process.env.PATH;
    let authority: ReturnType<typeof captureTrustedFixtureSource>;
    try {
      process.env.PATH = `${fakeBin}${process.platform === "win32" ? ";" : ":"}${originalPath ?? ""}`;
      authority = captureTrustedFixtureSource(fixture.script);
    } finally {
      process.env.PATH = originalPath;
    }
    expect(authority.repoRoot).toBe(fixture.root.replaceAll("\\", "/"));
    expect(readFileSync(fixture.script, "utf8")).toContain("\r\n");
    expect(authority.commit).toBe(fixture.commit);
    expect(authority.tunesArchive.subarray(257, 265).toString("utf8")).toBe("ustar\0" + "00");
    expect(authority.codeFiles["music-deploy-engine.sh"].toString("utf8")).toBe("engine\n");

    writeFileSync(join(fixture.root, "tunes/app.ts"), "export const exact = 2;\n");
    expect(() => assertTrustedFixtureSourceUnchanged(authority)).toThrow("tracked source checkout changed");
    expect(authority.tunesArchive.includes(Buffer.from("export const exact = 1;"))).toBe(true);
    expect(authority.tunesArchive.includes(Buffer.from("export const exact = 2;"))).toBe(false);
  });

  it("rejects dirty, detached-script, and hidden index authority before source capture", () => {
    const dirty = cleanFixtureRepository();
    writeFileSync(join(dirty.root, "tunes/app.ts"), "dirty\n");
    expect(() => captureTrustedFixtureSource(dirty.script)).toThrow("tracked source checkout must be clean");

    const detached = cleanFixtureRepository();
    const outside = join(detached.root, "outside.ts");
    writeFileSync(outside, "outside\n");
    expect(() => captureTrustedFixtureSource(outside)).toThrow("executing rehearsal script must be tracked");

    const hidden = cleanFixtureRepository();
    git(hidden.root, "update-index", "--assume-unchanged", "tunes/app.ts");
    expect(() => captureTrustedFixtureSource(hidden.script)).toThrow("hidden tracked source flags are forbidden");
  });

  it("binds internally generated authority to its native identity and exact bytes", () => {
    const root = mkdtempSync(join(tmpdir(), "music-c10-native-authority-"));
    sandboxes.push(root);
    const path = join(root, "compose.json");
    writeFileSync(path, "exact-model", { mode: 0o600 });
    const authority = capturePrivateFixtureFile(path, Buffer.from("exact-model"));
    expect(() => assertPrivateFixtureFileUnchanged(authority)).not.toThrow();

    const replacement = join(root, "replacement");
    writeFileSync(replacement, "exact-model", { mode: 0o600 });
    rmSync(path);
    renameSync(replacement, path);
    expect(readFileSync(path, "utf8")).toBe("exact-model");
    expect(() => assertPrivateFixtureFileUnchanged(authority)).toThrow("fixture authority native identity changed");
  });

  it("accepts only one immutable digest returned by the loopback registry", () => {
    const digest = `sha256:${"a".repeat(64)}`;
    expect(requireRegistryReturnedDigest(digest)).toBe(digest);
    for (const value of [undefined, "", `sha256:${"a".repeat(63)}`, `sha256:${"A".repeat(64)}`, `${digest}\n${digest}`]) {
      expect(() => requireRegistryReturnedDigest(value)).toThrow("loopback registry returned an invalid immutable digest");
    }
  });

  it("executes only the internal exact-image policy adapter against the shared engine", () => {
    const root = mkdtempSync(join(tmpdir(), "music-c10-policy-adapter-"));
    sandboxes.push(root);
    const fakeBin = join(root, "bin");
    mkdirSync(fakeBin);
    const dockerLog = join(root, "docker.log");
    const dockerShim = join(fakeBin, "docker");
    writeFileSync(dockerShim, `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> ${JSON.stringify(shellPath(dockerLog))}\n`);
    chmodSync(dockerShim, 0o700);
    const digest = `sha256:${"a".repeat(64)}`;
    const repository = "127.0.0.1:55123/explorers-tunes";
    const approved = `${repository}@${digest}`;
    const engine = join(root, "music-deploy-engine.sh");
    writeFileSync(engine, [
      '[[ "$MUSIC_DEPLOY_POLICY_ID" == fixture-loopback-v1 ]] || exit 70',
      '[[ "$MUSIC_DEPLOY_EXPECTED_REPOSITORY" == "127.0.0.1:55123/explorers-tunes" ]] || exit 71',
      'music_deploy_validate_compose_project "music-c10-release-adapter"',
      `music_deploy_registry_materialize ${JSON.stringify(shellPath(join(root, "auth")))} ${JSON.stringify(approved)}`,
      "",
    ].join("\n"), { mode: 0o600 });
    const authority = capturePrivateFixtureFile(engine, readFileSync(engine));
    const adapter = createInternalFixturePolicyScript({
      engineFile: shellPath(engine),
      root: shellPath(root),
      repository,
      source: "https://github.com/explorers-earth/explorers.earth",
      composeProject: "music-c10-release-adapter",
      dockerExecutable: shellPath(dockerShim),
      dockerEndpoint: "unix:///var/run/docker.sock",
      approvedImages: [approved],
      authorities: [{ path: shellPath(authority.path), digest: authority.digest }],
    });
    const result = spawnSync(bash, ["--noprofile", "--norc", "-s"], {
      input: adapter,
      encoding: "utf8",
      env: { ...process.env, PATH: `${fakeBin}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}` },
      windowsHide: true,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(dockerLog, "utf8")).toContain(`--host unix:///var/run/docker.sock --config ${shellPath(join(root, "auth"))} pull ${approved}`);

    writeFileSync(engine, readFileSync(engine, "utf8").replace(approved, `${repository}@sha256:${"b".repeat(64)}`));
    const tampered = spawnSync(bash, ["--noprofile", "--norc", "-s"], {
      input: adapter,
      encoding: "utf8",
      env: { ...process.env, PATH: `${fakeBin}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}` },
      windowsHide: true,
    });
    expect(tampered.status).not.toBe(0);
    expect(tampered.stderr).toContain("internal fixture authority changed");
  });
});
