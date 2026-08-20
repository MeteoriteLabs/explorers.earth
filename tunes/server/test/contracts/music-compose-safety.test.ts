import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { validateComposeModel, validateOwnedResources } from "../../../scripts/music-compose-safety.ts";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");

const ownedLabels = {
  "com.docker.compose.project": "explorers-music-fixture",
  "com.explorers.music.fixture": "true",
  "com.explorers.music.project": "explorers-music-fixture",
};

const actualServices = {
  postgres: { image: "postgres:15-alpine", labels: ownedLabels },
  strapi: { image: "node:22.12-alpine", labels: ownedLabels },
  tunes: { build: { context: "C:/repo/tunes", dockerfile: "Dockerfile" }, labels: ownedLabels },
  explorers: { build: { context: "C:/repo", dockerfile: "explorers-earth/Dockerfile.music-fixture" }, labels: ownedLabels },
};

describe("Music Compose ownership safety", () => {
  it("refuses a model with an unlabeled network before cleanup", () => {
    // Production break caught: project-name confirmation alone could stop or
    // delete a network/volume that Compose resolved outside the fixture.
    expect(() => validateComposeModel({
      name: "explorers-music-fixture",
      services: actualServices,
      networks: { default: { labels: {} } },
      volumes: { database: { labels: ownedLabels } },
    })).toThrow("network default is missing required fixture labels");
  });

  it("refuses renamed fixture servers in place of the actual applications", () => {
    // Production break caught: Compose labels a generic fixture HTTP server as
    // Tunes and Explorers, so smoke never starts either application build.
    expect(() => validateComposeModel({
      name: "explorers-music-fixture",
      services: {
        ...actualServices,
        tunes: { image: "node:22-alpine", command: ["node", "music-fixture-server.ts"], labels: ownedLabels },
      },
      networks: { default: { labels: ownedLabels } },
      volumes: { database: { labels: ownedLabels } },
    })).toThrow("tunes must build the actual application");
  });

  it("requires the root-context Explorer fixture image that includes the shared publication contract", () => {
    expect(() => validateComposeModel({
      name: "explorers-music-fixture",
      services: {
        ...actualServices,
        explorers: { build: { context: "C:/repo/explorers-earth", dockerfile: "Dockerfile" }, labels: ownedLabels },
      },
      networks: { default: { labels: ownedLabels } },
      volumes: { database: { labels: ownedLabels } },
    })).toThrow("explorers must build the actual application");
  });

  it("keeps the generated exact tracked-file fixture context synchronized", () => {
    const result = spawnSync(process.execPath, [
      resolve(repositoryRoot, "scripts/generate-music-fixture-dockerignore.mjs"),
      "--check",
    ], { cwd: repositoryRoot, encoding: "utf8" });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  });

  it("passes only the exact source manifest through Docker ignore semantics", () => {
    const sandbox = mkdtempSync(join(tmpdir(), "music-fixture-context-"));
    const context = join(sandbox, "context");
    const output = join(sandbox, "output");
    const write = (relative: string, value = "fixture") => {
      const path = join(context, ...relative.split("/"));
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, value);
    };
    try {
      mkdirSync(context);
      write(".dockerignore", readFileSync(resolve(repositoryRoot, ".dockerignore"), "utf8"));
      write("explorers-earth/Dockerfile.music-fixture");
      write("explorers-earth/package.json", "{}");
      write("explorers-earth/src/main.tsx");
      write("explorers-earth/public/robots.txt");
      write("explorers-earth/scripts/generate-static-files.js");
      write("tunes/shared/musicPublicationContract.ts");
      for (const hostile of [
        "explorers-earth/server/.chrome-profile/Default/Cookies",
        "explorers-earth/test-results/music/trace.zip",
        "explorers-earth/test-results/screenshots/capability.png",
        "explorers-earth/src/nested/.env.authority",
        "explorers-earth/src/nested/debug_capability.html",
        "explorers-earth/src/nested/runtime.log",
        "explorers-earth/src/.artifacts/authority/key",
        "explorers-earth/src/nested/tests/authority.ts",
        "explorers-earth/src/nested/test/authority.ts",
        "explorers-earth/src/nested/arbitrary-authority.ts",
        "explorers-earth/public/nested/.env.public",
        "explorers-earth/public/debug_response.html",
        "tunes/.env.music.test",
        "tunes/node_modules/fixture-dependency/index.js",
        "tunes/dist/server/index.js",
        "tunes/coverage/coverage-final.json",
        "tunes/test-results/music/trace.zip",
        "tunes/server/runtime.log",
        "tunes/server/tests/authority.ts",
      ]) write(hostile, "hostile-context-sentinel");
      const dockerfile = join(sandbox, "Dockerfile.context-manifest");
      writeFileSync(dockerfile, [
        "FROM node:22.12-alpine AS manifest",
        "COPY . /capture/context",
        "RUN find /capture/context -type f | sed 's#^/capture/context/##' | sort > /context-manifest.txt",
        "FROM scratch",
        "COPY --from=manifest /context-manifest.txt /context-manifest.txt",
        "",
      ].join("\n"));
      const result = spawnSync("docker", ["build", "--progress=plain", "--file", dockerfile,
        "--output", `type=local,dest=${output}`, context], { encoding: "utf8" });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const manifest = readFileSync(join(output, "context-manifest.txt"), "utf8").trim().split(/\r?\n/);
      expect(manifest).toEqual([
        "explorers-earth/Dockerfile.music-fixture",
        "explorers-earth/package.json",
        "explorers-earth/public/robots.txt",
        "explorers-earth/scripts/generate-static-files.js",
        "explorers-earth/src/main.tsx",
        "tunes/shared/musicPublicationContract.ts",
      ]);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it("matches the actual root BuildKit context to the generated tracked fixture manifest", () => {
    const sandbox = mkdtempSync(join(tmpdir(), "music-fixture-actual-context-"));
    const output = join(sandbox, "output");
    const dockerfile = join(sandbox, "Dockerfile.context-manifest");
    try {
      const expectedResult = spawnSync(process.execPath, [
        resolve(repositoryRoot, "scripts/generate-music-fixture-dockerignore.mjs"),
        "--manifest",
      ], { cwd: repositoryRoot, encoding: "utf8" });
      expect(expectedResult.status, `${expectedResult.stdout}\n${expectedResult.stderr}`).toBe(0);
      const expected = expectedResult.stdout.trim().split(/\r?\n/);
      writeFileSync(dockerfile, [
        "FROM node:22.12-alpine AS manifest",
        "COPY . /capture/context",
        "RUN find /capture/context -type f | sed 's#^/capture/context/##' | sort > /context-manifest.txt",
        "FROM scratch",
        "COPY --from=manifest /context-manifest.txt /context-manifest.txt",
        "",
      ].join("\n"));
      const result = spawnSync("docker", ["build", "--progress=plain", "--file", dockerfile,
        "--output", `type=local,dest=${output}`, repositoryRoot], { encoding: "utf8" });
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const manifest = readFileSync(join(output, "context-manifest.txt"), "utf8").trim().split(/\r?\n/);
      expect(manifest).toEqual(expected);
      for (const denied of [
        "tunes/.env.music.test",
        "tunes/node_modules/.bin/autoprefixer",
        "tunes/dist/server/index.js",
        "explorers-earth/src/nested/tests/authority.ts",
      ]) expect(manifest).not.toContain(denied);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it("refuses absent or production-like resolved resources before cleanup", () => {
    // Production break caught: an empty `compose ps` result or a misleadingly
    // labeled production resource could be treated as safe to delete.
    expect(() => validateOwnedResources([])).toThrow("no resolved fixture resources");
    expect(() => validateOwnedResources([{
      kind: "volume",
      name: "production_music_fixture_data",
      labels: ownedLabels,
    }])).toThrow("production-like");
  });
});
