import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  assertPlatformResetTarget,
  assertPlatformContainer,
  assertPlatformNetwork,
  assertPlatformServiceNetworks,
  assertResetComposeModel,
  assertResetResourceInventory,
  assertResetContainerMounts,
  resetPlatformLocal,
  parsePlatformCommand,
  validateProvisionSecretInventory,
  platformViteEnvironment,
  validateResetIntent,
  prepareResetIntent,
  validatePlatformAuthority,
  validatePlatformComposeModel,
  formatPlatformFailure,
  classifyPlatformBuildFailure,
} from "../../../../scripts/replatform-local";

const receipt = {
  version: 1 as const,
  project: "explorers-replatform-local",
  database: "music_fixture",
  host: "127.0.0.1",
  port: 51434,
  containerId: "a".repeat(64),
  commit: "b".repeat(40),
};
const ownedModel = {
  name: receipt.project,
  services: { postgres: { labels: { "com.explorers.replatform.fixture": "true", "com.explorers.replatform.project": receipt.project } } },
  networks: { local: { labels: { "com.explorers.replatform.fixture": "true", "com.explorers.replatform.project": receipt.project } } },
  volumes: { database: { labels: { "com.explorers.replatform.fixture": "true", "com.explorers.replatform.project": receipt.project } } },
};
const ownedContainer = {
  Id: receipt.containerId,
  Name: "/explorers-replatform-local-postgres-1",
  Config: { Image: "postgres:15-alpine", Labels: {
    "com.docker.compose.project": receipt.project,
    "com.docker.compose.service": "postgres",
    "com.explorers.replatform.fixture": "true",
    "com.explorers.replatform.project": receipt.project,
  } },
  State: { Running: true, Health: { Status: "healthy" } },
  HostConfig: { PortBindings: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "51434" }] } },
};
const resetModel = {
  ...ownedModel,
  services: Object.fromEntries(["postgres", "strapi", "tunes-migrate", "tunes", "explorers"].map((name) => [name, { volumes: name === "postgres" ? [{ type: "volume", source: "replatform-local-postgres" }] : [] }])),
  networks: {
    "replatform-local": { name: "explorers-replatform-local_replatform-local", internal: true },
    "replatform-edge": { name: "explorers-replatform-local_replatform-edge" },
  },
  volumes: {
    "replatform-local-postgres": { name: "explorers-replatform-local_replatform-local-postgres" },
    "replatform-local-gates": { name: "explorers-replatform-local_replatform-local-gates" },
  },
};

describe("replatform local authority", () => {
  it("formats a fixed diagnostic phase without underlying authority details", () => {
    expect(formatPlatformFailure("docker-endpoint")).toBe(
      "Replatform local command refused or failed; phase=docker-endpoint; authority details redacted.\n",
    );
  });

  it("classifies a service-build refusal without disclosing Docker output", () => {
    const raw = "toomanyrequests: synthetic-secret-value from a registry";
    const message = formatPlatformFailure("service-build", classifyPlatformBuildFailure(raw));
    expect(message).toContain("phase=service-build; cause=registry-rate-limit");
    expect(message).not.toContain("synthetic-secret-value");
    expect(classifyPlatformBuildFailure("unknown flag: --quiet-build")).toBe("compose-option");
    expect(classifyPlatformBuildFailure("no space left on device")).toBe("resource-exhaustion");
    expect(classifyPlatformBuildFailure("process npm ci did not complete successfully")).toBe("build-command");
    expect(classifyPlatformBuildFailure("sensitive but unknown failure")).toBe("unclassified");
  });

  it("accepts only the declared local and acceptance seed commands", () => {
    expect(parsePlatformCommand(["provision"])).toEqual({ command: "provision" });
    expect(parsePlatformCommand(["seed", "--dataset", "acceptance"])).toEqual({ command: "seed", dataset: "acceptance" });
    for (const args of [["reset", "--project", "production"], ["seed"], ["start", "extra"], ["up"]]) {
      expect(() => parsePlatformCommand(args)).toThrow(/arguments/i);
    }
  });

  it("reuses only a complete interrupted fixture secret inventory", () => {
    const safe = ["db-migrator", "db-runtime", "music-token"].map((name) => ({ name, kind: "file" as const, nlink: 1, size: 43 }));
    expect(validateProvisionSecretInventory([])).toBe("create");
    expect(validateProvisionSecretInventory(safe)).toBe("reuse");
    expect(() => validateProvisionSecretInventory(safe.slice(0, 2))).toThrow(/authority/i);
    expect(() => validateProvisionSecretInventory([{ ...safe[0], kind: "symlink" }, ...safe.slice(1)])).toThrow(/authority/i);
    expect(() => validateProvisionSecretInventory([{ ...safe[0], name: "../db-migrator" }, ...safe.slice(1)])).toThrow(/authority/i);
  });

  it("passes only explicit fixture Vite values from a secret-bearing parent environment", () => {
    const env = platformViteEnvironment({ PATH: "fixture-path", VITE_IGDB_CLIENT_SECRET: "SYNTHETIC_SENTINEL", VITE_PAYMENT_API_URL: "https://hosted.example" });
    expect(env.VITE_IGDB_CLIENT_SECRET).toBeUndefined();
    expect(env.VITE_PAYMENT_API_URL).toBeUndefined();
    expect(env.VITE_API_URL).toBe("http://127.0.0.1:51474/graphql");
    expect(env.MUSIC_DEV_PROXY_TARGET).toBe("http://127.0.0.1:51474");
  });

  it("requires an exact reset intent before reprovisioning a retired receipt", () => {
    expect(validateResetIntent(receipt, { status: "pending", authority: { ...receipt } })).toBe(true);
    expect(validateResetIntent(receipt, { status: "consumed", authority: { ...receipt } })).toBe(false);
    expect(() => validateResetIntent(receipt, { status: "pending", authority: { ...receipt, project: "production" } })).toThrow(/authority/i);
  });
  it("renews or retries only an exact intent for the same provisioned authority", () => {
    expect(prepareResetIntent(receipt, { status: "consumed", authority: { ...receipt } })).toEqual({ status: "pending", authority: receipt });
    expect(() => prepareResetIntent(receipt, { status: "consumed", authority: { ...receipt, containerId: "c".repeat(64) } })).toThrow(/authority/i);
    expect(prepareResetIntent(receipt, { status: "pending", authority: { ...receipt } })).toEqual({ status: "pending", authority: receipt });
  });
  it("accepts only an exact provisioned loopback target", () => {
    expect(validatePlatformAuthority(receipt, `postgresql://music_migrator:fixture@127.0.0.1:51434/music_fixture`, receipt.commit)).toEqual(receipt);
    for (const target of [
      "postgresql://music_migrator:fixture@db.example.com:51434/music_fixture",
      "postgresql://music_migrator:fixture@127.0.0.1:51434/production",
      "postgresql://music_migrator:fixture@127.0.0.1:55435/music_fixture",
    ]) expect(() => validatePlatformAuthority(receipt, target, receipt.commit)).toThrow(/authority/i);
  });

  it("rejects missing, changed, or simultaneous test authorities", () => {
    expect(() => validatePlatformAuthority(undefined, "", receipt.commit)).toThrow(/authority/i);
    expect(() => validatePlatformAuthority({ ...receipt, project: "other" }, "", receipt.commit)).toThrow(/authority/i);
    expect(() => validatePlatformAuthority(receipt, "", "c".repeat(40))).toThrow(/authority/i);
    expect(() => validatePlatformAuthority(receipt, "", receipt.commit, { MUSIC_UAT_DATABASE_ACK: "x" })).toThrow(/authority/i);
    expect(() => validatePlatformAuthority(receipt, "", receipt.commit, { MUSIC_C10_STANDALONE_POSTGRES_ACK: "x" })).toThrow(/authority/i);
    expect(() => validatePlatformAuthority(receipt, "", receipt.commit, { DATABASE_URL: "postgresql://production.example.com/app" })).toThrow(/authority/i);
    expect(() => validatePlatformAuthority(receipt, "", receipt.commit, { DOCKER_CONTEXT: "production" })).toThrow(/authority/i);
  });

  it("refuses any reset target except the attested receipt before mutation", () => {
    expect(() => assertPlatformResetTarget(receipt, { ...receipt, containerId: "c".repeat(64) })).toThrow(/authority/i);
    expect(() => assertPlatformResetTarget(receipt, { ...receipt, project: "production" })).toThrow(/authority/i);
    expect(assertPlatformResetTarget(receipt, { ...receipt })).toEqual(receipt);
  });

  it("rejects every undeclared or unowned Compose deletion target before reset mutation", async () => {
    expect(assertResetComposeModel(resetModel)).toEqual(resetModel);
    const unsafe = { ...resetModel, volumes: { ...resetModel.volumes, extra: { name: "another_local_volume" } } };
    expect(() => assertResetComposeModel(unsafe)).toThrow(/authority/i);
    let mutations = 0;
    await expect(resetPlatformLocal(receipt, { ...receipt }, async () => ownedContainer, async () => unsafe, async () => { mutations++; }))
      .rejects.toThrow(/authority/i);
    expect(mutations).toBe(0);
    let deletionModel: unknown;
    await resetPlatformLocal(receipt, { ...receipt }, async () => ownedContainer, async () => resetModel, async (model) => { deletionModel = model; });
    expect(deletionModel).toBe(resetModel);
    expect(() => assertResetComposeModel({ ...resetModel, volumes: { ...resetModel.volumes, "replatform-local-postgres": { name: "another_local_volume" } } })).toThrow(/authority/i);
    expect(() => assertResetComposeModel({ ...resetModel, volumes: { ...resetModel.volumes, "replatform-local-postgres": { name: "explorers-replatform-local_replatform-local-postgres", external: true } } })).toThrow(/authority/i);
    expect(() => assertResetComposeModel({ ...resetModel, networks: { ...resetModel.networks, "replatform-edge": { name: "another_local_network" } } })).toThrow(/authority/i);
    expect(() => assertResetComposeModel({ ...resetModel, services: { ...resetModel.services, postgres: { volumes: [{ type: "volume", source: "another_local_volume" }] } } })).toThrow(/authority/i);
    expect(() => assertResetResourceInventory(["owned"], ["owned"], ["owned"])).not.toThrow();
    expect(() => assertResetResourceInventory(["owned"], [], ["owned"])).toThrow(/authority/i);
    expect(() => assertResetContainerMounts([{ Type: "volume", Name: "explorers-replatform-local_replatform-local-postgres" }, { Type: "bind" }])).not.toThrow();
    expect(() => assertResetContainerMounts([{ Type: "volume", Name: "unowned_volume" }])).toThrow(/authority/i);
  });

  it("requires a separate labeled Compose project with a loopback PostgreSQL service", () => {
    expect(validatePlatformComposeModel(ownedModel)).toEqual(ownedModel);
    expect(() => validatePlatformComposeModel({ ...ownedModel, name: "production" })).toThrow(/authority/i);
    expect(() => validatePlatformComposeModel({ ...ownedModel, networks: { local: { labels: {} } } })).toThrow(/authority/i);
  });

  it("attests live container identity, labels, and loopback binding", () => {
    expect(assertPlatformContainer(receipt, ownedContainer)).toEqual(receipt);
    expect(() => assertPlatformContainer(receipt, { ...ownedContainer, Id: "c".repeat(64) })).toThrow(/authority/i);
    expect(() => assertPlatformContainer(receipt, { ...ownedContainer, HostConfig: { PortBindings: { "5432/tcp": [{ HostIp: "0.0.0.0", HostPort: "55434" }] } } })).toThrow(/authority/i);
    expect(() => assertPlatformContainer(receipt, { ...ownedContainer, Config: { ...ownedContainer.Config, Labels: { ...ownedContainer.Config.Labels, "com.docker.compose.project": "other" } } })).toThrow(/authority/i);
  });
  it("requires the live fixture network to be private and owned", () => {
    const network = { Name: "explorers-replatform-local_replatform-local", Internal: true, Labels: {
      "com.docker.compose.project": receipt.project,
      "com.explorers.replatform.fixture": "true",
      "com.explorers.replatform.project": receipt.project,
    } };
    expect(assertPlatformNetwork(network)).toEqual(network);
    expect(() => assertPlatformNetwork({ ...network, Internal: false })).toThrow(/authority/i);
    expect(() => assertPlatformNetwork({ ...network, Name: "production_default" })).toThrow(/authority/i);
  });
  it("keeps application backends off the gateway edge network", () => {
    const privateOnly = { NetworkSettings: { Networks: { "explorers-replatform-local_replatform-local": {} } } };
    const gateway = { NetworkSettings: { Networks: { ...privateOnly.NetworkSettings.Networks, "explorers-replatform-local_replatform-edge": {} } } };
    expect(assertPlatformServiceNetworks("tunes", privateOnly)).toEqual(privateOnly);
    expect(assertPlatformServiceNetworks("explorers", gateway)).toEqual(gateway);
    expect(() => assertPlatformServiceNetworks("tunes", gateway)).toThrow(/authority/i);
    expect(() => assertPlatformServiceNetworks("explorers", privateOnly)).toThrow(/authority/i);
  });

  it("does not call reset mutation when container attestation fails", async () => {
    let mutations = 0;
    await expect(resetPlatformLocal(receipt, { ...receipt }, async () => ({ ...ownedContainer, Id: "c".repeat(64) }), async () => resetModel, async () => { mutations++; }))
      .rejects.toThrow(/authority/i);
    expect(mutations).toBe(0);
    await resetPlatformLocal(receipt, { ...receipt }, async () => ownedContainer, async () => resetModel, async () => { mutations++; });
    expect(mutations).toBe(1);
  });

  it("can reset an exact stopped local container after stop", async () => {
    let mutations = 0;
    const stopped = { ...ownedContainer, State: { Running: false, Health: { Status: "healthy" } } };
    await resetPlatformLocal(receipt, { ...receipt }, async () => stopped, async () => resetModel, async () => { mutations++; });
    expect(mutations).toBe(1);
    await expect(resetPlatformLocal(receipt, { ...receipt }, async () => ({ ...stopped, Id: "c".repeat(64) }), async () => resetModel, async () => { mutations++; })).rejects.toThrow(/authority/i);
    expect(mutations).toBe(1);
  });

  it("resolves the checked-in Compose file to the owned local project", () => {
    const root = resolve(import.meta.dirname, "../../../..");
    const result = spawnSync("docker", ["compose", "-f", "docker-compose.replatform.yml", "config", "--format", "json"], {
      cwd: root, encoding: "utf8", windowsHide: true, timeout: 15_000,
      env: { ...process.env,
        MUSIC_DB_MIGRATOR_SECRET_FILE_HOST: resolve(root, "fixtures", "dummy-migrator"),
        MUSIC_DB_RUNTIME_SECRET_FILE_HOST: resolve(root, "fixtures", "dummy-runtime"),
        MUSIC_TOKEN_SECRET_FILE_HOST: resolve(root, "fixtures", "dummy-token"),
      },
    });
    expect(result.status, result.stderr).toBe(0);
    const model = JSON.parse(result.stdout);
    expect(validatePlatformComposeModel(model)).toEqual(model);
    expect(model.services.postgres.ports).toEqual(expect.arrayContaining([expect.objectContaining({ host_ip: "127.0.0.1", published: "51434" })]));
    expect(model.networks["replatform-local"].internal).toBe(true);
    expect(model.services.tunes.ports ?? []).toEqual([]);
    expect(model.services.strapi.ports ?? []).toEqual([]);
    expect(Object.keys(model.services.explorers.networks).sort()).toEqual(["replatform-edge", "replatform-local"]);
    expect(Object.keys(model.services.tunes.networks)).toEqual(["replatform-local"]);
    expect(model.services.explorers.ports).toEqual(expect.arrayContaining([expect.objectContaining({ host_ip: "127.0.0.1", published: "51474" })]));
  }, 20_000);
});
