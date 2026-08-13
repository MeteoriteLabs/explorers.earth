import { describe, expect, it } from "vitest";
import { validateComposeModel, validateOwnedResources } from "../../../scripts/music-compose-safety.ts";

const ownedLabels = {
  "com.docker.compose.project": "explorers-music-fixture",
  "com.explorers.music.fixture": "true",
  "com.explorers.music.project": "explorers-music-fixture",
};

const actualServices = {
  postgres: { image: "postgres:15-alpine", labels: ownedLabels },
  strapi: { image: "node:22.12-alpine", labels: ownedLabels },
  tunes: { build: { context: "C:/repo/tunes", dockerfile: "Dockerfile" }, labels: ownedLabels },
  explorers: { build: { context: "C:/repo/explorers-earth", dockerfile: "Dockerfile" }, labels: ownedLabels },
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
