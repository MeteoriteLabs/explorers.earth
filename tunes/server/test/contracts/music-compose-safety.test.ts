import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("allowlists only Explorer source and the shared publication parser in the root Docker context", () => {
    const ignore = readFileSync(resolve(repositoryRoot, ".dockerignore"), "utf8");
    expect(ignore).toMatch(/^\*\*$/m);
    expect(ignore).toContain("!explorers-earth/**");
    expect(ignore).toContain("explorers-earth/node_modules/**");
    expect(ignore).toContain("explorers-earth/dist/**");
    expect(ignore).toContain("!tunes/shared/musicPublicationContract.ts");
    expect(ignore).not.toMatch(/^!\.env/m);
    expect(ignore).not.toMatch(/^!\.artifacts/m);
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
