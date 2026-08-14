import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");

function copyRepositoryFile(checkout: string, relativePath: string): void {
  const destination = join(checkout, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(repositoryRoot, relativePath), destination);
}

function writeEmptyPackage(checkout: string, directory: string): void {
  const packageDirectory = join(checkout, directory);
  mkdirSync(packageDirectory, { recursive: true });
  const manifest = { name: `fixture-${directory}`, version: "1.0.0", private: true };
  writeFileSync(join(packageDirectory, "package.json"), `${JSON.stringify(manifest)}\n`);
  writeFileSync(join(packageDirectory, "package-lock.json"), `${JSON.stringify({ name: manifest.name, version: manifest.version, lockfileVersion: 3, requires: true, packages: { "": manifest } })}\n`);
}

describe("clean Music bootstrap", () => {
  it("starts through the root lockfile before child dependencies exist", () => {
    // Production break caught: the root bootstrap launcher asks Tunes for tsx
    // before bootstrap has installed Tunes, so a clean checkout cannot start.
    if (!process.env.npm_execpath) throw new Error("npm_execpath is required");
    const checkout = mkdtempSync(join(tmpdir(), "music-clean-bootstrap-"));
    try {
      for (const file of [
        "package.json",
        "package-lock.json",
        "docker-compose.music-test.yml",
        ".env.music.example",
        ".env.music.test.example",
        "fixtures/strapi/music-identity/identity.fixture.json",
        "tunes/scripts/music-cli.ts",
        "tunes/scripts/music-fixture-secret.ts",
        "tunes/scripts/music-compose-safety.ts",
        "tunes/scripts/music-process-runner.ts",
        "tunes/server/config/music-environment.ts",
        "tunes/server/config/secure-music-secret-file.ts",
        "tunes/shared/music-migration-contract.ts",
      ]) copyRepositoryFile(checkout, file);
      writeEmptyPackage(checkout, "tunes");
      writeEmptyPackage(checkout, "explorers-earth");
      mkdirSync(join(checkout, ".git", "refs", "heads"), { recursive: true });
      writeFileSync(join(checkout, ".git", "HEAD"), "ref: refs/heads/main\n");
      writeFileSync(join(checkout, ".git", "refs", "heads", "main"), "0123456789abcdef0123456789abcdef01234567\n");

      const rootInstall = spawnSync(process.execPath, [process.env.npm_execpath, "ci", "--ignore-scripts"], { cwd: checkout, encoding: "utf8" });
      expect(rootInstall.status).toBe(0);
      expect(existsSync(join(checkout, "tunes", "node_modules"))).toBe(false);
      expect(existsSync(join(checkout, "explorers-earth", "node_modules"))).toBe(false);

      const bootstrap = spawnSync(process.execPath, [process.env.npm_execpath, "run", "--silent", "music:bootstrap", "--", "--format", "json"], {
        cwd: checkout,
        encoding: "utf8",
      });
      expect(bootstrap.status, `${bootstrap.stdout}\n${bootstrap.stderr}`).toBe(0);
      expect(JSON.parse(bootstrap.stdout.trim())).toMatchObject({ command: "bootstrap", status: "success", phase: "bootstrap" });
    } finally {
      rmSync(checkout, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  }, 120_000);
});
