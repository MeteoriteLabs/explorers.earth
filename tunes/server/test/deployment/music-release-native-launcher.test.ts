import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");
const tunesRoot = join(repositoryRoot, "tunes");
const rehearsal = join(tunesRoot, "scripts", "music-docker-release-rehearsal.ts");
const qualification = join(tunesRoot, "scripts", "music-cli.ts");
const tsxCli = join(tunesRoot, "node_modules", "tsx", "dist", "cli.mjs");
const sandboxes: string[] = [];

function withoutNodeStartupAuthority(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (/^NODE(?:_|$)/i.test(key)) delete environment[key];
  }
  return { ...environment, ...extra };
}

function preloadProbe(): { root: string; preload: string; marker: string } {
  const root = mkdtempSync(join(tmpdir(), "music-c10-native-launch-red-"));
  sandboxes.push(root);
  const marker = join(root, "preload-ran");
  const preload = join(root, "preload.cjs");
  writeFileSync(preload, `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "ran")\n`);
  return { root, preload, marker };
}

function nativeLauncher(): { file: string; args: string[]; source: string } {
  if (process.platform === "win32") {
    const source = join(tunesRoot, "scripts", "music-release-launcher.ps1");
    return {
      file: "C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
      args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", source, "-Mode", "rehearsal"],
      source,
    };
  }
  const source = join(tunesRoot, "scripts", "music-release-launcher.sh");
  return { file: "/bin/sh", args: [source, "rehearsal"], source };
}

afterEach(() => {
  for (const path of sandboxes.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("native Music release launch boundary", () => {
  it("records why a direct Node launch can never be the trusted preload boundary", () => {
    const probe = preloadProbe();
    const result = spawnSync(process.execPath, [tsxCli, rehearsal], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: withoutNodeStartupAuthority({
        MUSIC_DEPLOY_ROOT: "caller-owned",
        NODE_OPTIONS: `--require=${probe.preload}`,
      }),
      windowsHide: true,
    });
    expect(result.status).not.toBe(0);
    expect(existsSync(probe.marker)).toBe(true);
    expect(result.stderr).toContain("native Music release launcher attestation is required");
  });

  it("rejects hostile Node startup variables in native code before Node begins", () => {
    const probe = preloadProbe();
    const launcher = nativeLauncher();
    const launcherSource = readFileSync(launcher.source, "utf8");
    expect(launcherSource).toContain("native Music release launcher rejected Node startup authority");
    expect(launcherSource).toContain("--experimental-transform-types");
    expect(launcherSource).not.toMatch(/NPM_CONFIG_USERCONFIG[^\n]+(?:NUL|\/dev\/null)[\s\S]{0,120}NPM_CONFIG_GLOBALCONFIG[^\n]+(?:NUL|\/dev\/null)/);
    const result = spawnSync(launcher.file, launcher.args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: withoutNodeStartupAuthority({ NODE_OPTIONS: `--require=${probe.preload}` }),
      windowsHide: true,
    });
    expect(result.status).toBe(78);
    expect(result.stderr).toContain("native Music release launcher rejected Node startup authority");
    expect(existsSync(probe.marker)).toBe(false);
  });

  it("retains the canonical Windows native helper directory in the minimal executable allowlist", () => {
    const windowsLauncher = readFileSync(
      join(tunesRoot, "scripts", "music-release-launcher.ps1"),
      "utf8",
    );
    expect(windowsLauncher).toContain(
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0",
    );
  });

  it.each([
    "NODE_PATH",
    "NODE_DEBUG_NATIVE",
    "NODE_INSPECT_RESUME_ON_START",
    "NODE_REPL_EXTERNAL_MODULE",
    "NODE_V8_COVERAGE",
  ])("rejects the %s startup-authority substitution before Node begins", (name) => {
    const launcher = nativeLauncher();
    const result = spawnSync(launcher.file, launcher.args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: withoutNodeStartupAuthority({ [name]: "caller-owned" }),
      windowsHide: true,
    });
    expect(result.status).toBe(78);
    expect(result.stderr).toContain("native Music release launcher rejected Node startup authority");
  });

  it("requires an anonymous native-launcher channel before direct Node can reach Docker authority", () => {
    const result = spawnSync(process.execPath, [tsxCli, rehearsal], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: withoutNodeStartupAuthority({ DOCKER_HOST: "tcp://caller.invalid:2375" }),
      windowsHide: true,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("native Music release launcher attestation is required");
    expect(result.stderr).not.toContain("external fixture deployment authority is forbidden");
  });

  it("refuses the direct qualification entrypoint before it can start a release lane", () => {
    const runRoot = join(repositoryRoot, ".artifacts", "music-runs");
    const before = existsSync(runRoot) ? readdirSync(runRoot).sort() : [];
    const result = spawnSync(process.execPath, [tsxCli, qualification, "test:release"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: withoutNodeStartupAuthority({ DOCKER_HOST: "tcp://caller.invalid:2375" }),
      windowsHide: true,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("native Music release launcher attestation is required");
    expect(result.stderr).not.toContain("external fixture deployment authority is forbidden");
    expect(existsSync(runRoot) ? readdirSync(runRoot).sort() : []).toEqual(before);
  });
});
