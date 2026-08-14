import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { auditDeploymentAuthority } from "../../deployment/music-deployment";

const repoRoot = resolve(import.meta.dirname, "../../../..");
const read = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");
const require = createRequire(import.meta.url);
const { load: parseYaml } = require("js-yaml") as { load(source: string): any };

function heredoc(source: string, opener: string): string {
  const start = source.indexOf(opener);
  expect(start, `missing heredoc opener ${opener}`).toBeGreaterThanOrEqual(0);
  const lines = source.slice(start + opener.length).replace(/^\r?\n/, "").split(/\r?\n/);
  const end = lines.findIndex((line) => line.trim() === "EOF");
  expect(end, `missing EOF for ${opener}`).toBeGreaterThanOrEqual(0);
  const body = lines.slice(0, end);
  const indentation = Math.min(...body.filter((line) => line.trim()).map((line) => line.match(/^\s*/)?.[0].length ?? 0));
  return body.map((line) => line.slice(indentation)).join("\n");
}

describe("Music deployment authority files", () => {
  it("has one build authority, one deploy authority, and no legacy host rebuild path", () => {
    const result = auditDeploymentAuthority({
      ciWorkflow: read(".github/workflows/tunes.yml"),
      deployWorkflow: read(".github/workflows/tunes-deploy.yml"),
      deployExecutable: read("tunes/deployment/music-deploy.sh"),
      rootCompose: read("docker-compose.yml"),
      tunesCompose: read("tunes/docker-compose.yml"),
      fixtureCompose: read("docker-compose.music-test.yml"),
    });
    expect(result).toEqual([]);
  });

  it("does not let the application session store create schema", () => {
    // Production break caught: startup traffic races an implicit CREATE TABLE.
    const storage = read("tunes/server/storage.ts");
    expect(storage).toContain("createTableIfMissing: false");
    expect(storage).not.toContain("createTableIfMissing: true");
  });

  it("proves the one-shot gate entrypoint exists in the exact built image and Compose invokes it", () => {
    // Production break caught: Compose declares a migration gate command that was never copied into the runner image.
    const ci = read(".github/workflows/tunes.yml");
    const compose = read("docker-compose.yml");
    const entrypoint = "dist/server/deployment/run-migration-gate.js";
    expect(ci).toContain(`/app/${entrypoint}`);
    expect(compose).toContain(entrypoint);
    expect(ci).toContain("/app/migrations/0002_identity_lifecycle.sql");
    expect(ci).toContain("/app/migrations/0003_identity_lifecycle_hardening.sql");
    expect(ci).toContain("/app/migrations/0004_identity_delete_saga.sql");
    expect(ci).toContain("/app/migrations/0005_resource_bound_deletion_history.sql");
    expect(ci).toContain("/app/migrations/0006_numeric_identity_lock.sql");
    expect(ci).toContain("/app/migrations/0007_identity_provider_snapshot.sql");
    expect(ci).toContain("/app/migrations/0008_credential_revocation_operations.sql");
    expect(ci).toContain("/app/migrations/0009_credential_revocation_history_immutability.sql");
    expect(read("tunes/deployment/music-deploy.sh")).toContain('production_current_marker="0009_credential_revocation_history_immutability"');
    expect(ci).toContain("/app/dist/server/deployment/run-registration-compat.js");
  });

  it("uses a read-packages-only remote GHCR credential and always logs it out", () => {
    const deploy = read(".github/workflows/tunes-deploy.yml");
    const executable = read("tunes/deployment/music-deploy.sh");
    expect(deploy).toContain("GHCR_DEPLOY_READ_TOKEN");
    expect(executable).toContain("--password-stdin");
    expect(executable).toContain("logout ghcr.io");
    expect(deploy).not.toContain("secrets.GITHUB_TOKEN");
  });

  it("finds no competing Tunes host deployment authority in another workflow", () => {
    const workflowDirectory = resolve(repoRoot, ".github/workflows");
    const competitors = readdirSync(workflowDirectory)
      .filter((name) => !["tunes.yml", "tunes-deploy.yml"].includes(name))
      .filter((name) => {
        const source = read(`.github/workflows/${name}`)
          .split(/\r?\n/).filter((line) => !line.trimStart().startsWith("#")).join("\n");
        const deploysTunes = /(ghcr\.io\/[^\s]+\/explorers-tunes|docker\s+compose[^\n]+\btunes\b|source:\s*["']?tunes(?:\/|["']|\s|$))/i.test(source);
        return deploysTunes && /(ssh|scp|docker\s+compose\s+up)/i.test(source);
      });
    expect(competitors).toEqual([]);
  });

  it("bootstraps the floor from a verified C2 image without assuming C1 has C2 health metadata", () => {
    // Production break caught: bootstrap asks a pre-C2 image for endpoints and labels it cannot contain.
    const runbook = read("docs/operations/music-deploy-runbook.md");
    expect(runbook).toContain("first independently verified C2 image containing C1");
    expect(runbook).toContain("d226f7e4dc5a54195a59804ec729f72b5e8f10d7");
    expect(runbook).not.toMatch(/legacy_(?:container|service)=.*[\s\S]{0,500}health\/ready/);
    expect(runbook).not.toContain("docker compose ps tunes-blue");
    const orderedBootstrap = [
      "legacy_container=",
      "operation=bootstrap",
      "ghcr.token:",
      "bash tunes/deployment/music-deploy.sh",
      "starts blue privately",
      "atomically routes blue",
      "authenticated manifest, permanent floor, and",
      "stops the retained legacy container",
    ];
    let previous = -1;
    for (const step of orderedBootstrap) {
      const current = runbook.indexOf(step, previous + 1);
      expect(current, `missing/out-of-order bootstrap step: ${step}`).toBeGreaterThan(previous);
      previous = current;
    }
  });

  it("makes the private blue C1 hostile gate executable before first routing", () => {
    const executable = read("tunes/deployment/music-deploy.sh");
    const probe = executable.indexOf("compose exec -T tunes-blue node --input-type=module");
    const routeBlue = executable.indexOf('write_route "tunes-${candidate_slot}"');
    expect(probe).toBeGreaterThanOrEqual(0);
    expect(probe).toBeLessThan(routeBlue);
    for (const boundary of ["/api/auth/sync", "/graphql", "/api/subscriptions/user-plans/hostile", "socket.io-client"]) {
      expect(executable.slice(probe, routeBlue)).toContain(boundary);
    }
  });

  it("keeps file-provider routing unambiguous throughout bootstrap and later promotions", () => {
    const deploy = read("tunes/deployment/music-deploy.sh");
    const compose = read("docker-compose.yml");
    const runbook = read("docs/operations/music-deploy-runbook.md");
    expect(runbook).toContain("priority-200");
    expect(deploy).toContain("priority: 200");
    expect(compose).not.toContain("traefik.http.routers.tunes");
    expect(compose).not.toContain("traefik.enable: \"true\"\n      traefik.http.routers.tunes");
  });

  it("renders valid legacy-bootstrap and promotion route YAML with priority and exact upstream", () => {
    // Production break caught: a syntactically valid workflow carries an invalid Traefik heredoc.
    const routeTemplate = heredoc(read("tunes/deployment/music-deploy.sh"), 'cat > "$temporary" <<EOF');
    const legacy = parseYaml(routeTemplate.replaceAll("${service}", "legacy-tunes").replaceAll("\\`", "`"));
    const deployRoute = routeTemplate.replaceAll("${service}", "tunes-green").replaceAll("\\`", "`");
    const promotion = parseYaml(deployRoute);
    expect(legacy.http.routers.tunes).toMatchObject({ priority: 200, service: "tunes-active" });
    expect(legacy.http.services["tunes-active"].loadBalancer.servers[0].url).toBe("http://legacy-tunes:5000");
    expect(promotion.http.routers.tunes).toMatchObject({ priority: 200, service: "tunes-active" });
    expect(promotion.http.services["tunes-active"].loadBalancer.servers[0].url).toBe("http://tunes-green:5000");
  });

  it("keeps reusable deploy inputs internal and manual dispatch rollback-only", () => {
    const workflow = parseYaml(read(".github/workflows/tunes-deploy.yml"));
    expect(Object.keys(workflow.on.workflow_call.inputs)).toEqual(["digest", "commit"]);
    expect(Object.keys(workflow.on.workflow_dispatch.inputs)).toEqual(["target_digest"]);
  });

  it("retains a byte-exact route backup under an armed error trap until durable commit", () => {
    const deploy = read("tunes/deployment/music-deploy.sh");
    const copy = deploy.indexOf('cp -- "$route_file" "$temporary/route.backup"');
    const arm = deploy.indexOf("trap 'abort_transaction $?' ERR", copy);
    const promote = deploy.indexOf('write_route "tunes-${candidate_slot}"', copy);
    const verify = deploy.indexOf("https://localtunes.earth/health/ready", promote);
    const abort = deploy.indexOf("abort_transaction 1", verify);
    const commit = deploy.indexOf('mv -- "$transaction_current" "$committed_transaction"', abort);
    const disarm = deploy.indexOf("trap - ERR", commit);
    expect(copy).toBeGreaterThanOrEqual(0);
    expect(arm).toBeGreaterThan(copy);
    expect(promote).toBeGreaterThan(arm);
    expect(verify).toBeGreaterThan(promote);
    expect(abort).toBeGreaterThan(verify);
    expect(commit).toBeGreaterThan(abort);
    expect(disarm).toBeGreaterThan(commit);
  });

  it("accepts a promoted public response only when digest, commit, and gate marker all match", () => {
    // Production break caught: the router reaches the new digest but reports stale deployment metadata.
    const deploy = read("tunes/deployment/music-deploy.sh");
    const publicVerification = deploy.slice(deploy.indexOf("https://localtunes.earth/health/ready"));
    expect(publicVerification).toContain('\\"digest\\":\\"$candidate_digest\\"');
    expect(publicVerification).toContain('\\"commit\\":\\"$candidate_commit\\"');
    expect(publicVerification).toContain('\\"migrationMarker\\":\\"$candidate_marker\\"');
  });

  it("requires every C1 production startup secret in Compose readiness", () => {
    // Production break caught: immutable deploy succeeds but C1 startup rejects absent STRAPI_JWT_SECRET.
    const compose = read("docker-compose.yml");
    const health = read("tunes/server/deployment/music-health.ts");
    expect(compose).toContain("STRAPI_JWT_SECRET: ${STRAPI_JWT_SECRET:?STRAPI_JWT_SECRET is required}");
    expect(health).toContain("STRAPI_JWT_SECRET: env.STRAPI_JWT_SECRET");
  });

  it("supplies the isolated production-mode fixture with every C1 startup prerequisite", () => {
    // Production break caught: the real image exits before readiness because the
    // disposable Compose contract omitted credentials enforced by C1 startup.
    const fixture = read("docker-compose.music-test.yml");
    expect(fixture).toContain("STRAPI_JWT_SECRET: fixture-strapi-jwt-secret-at-least-32-characters");
    expect(fixture).toContain("ALLOWED_ORIGINS: http://127.0.0.1:55173");
  });

  it("proves the built C2 commit contains C1 and carries the observed legacy Compose project through deploy", () => {
    // Production break caught: a new project creates a second Traefik instead of updating the legacy topology.
    const ci = read(".github/workflows/tunes.yml");
    const deploy = read(".github/workflows/tunes-deploy.yml");
    const runbook = read("docs/operations/music-deploy-runbook.md");
    expect(ci).toContain("git merge-base --is-ancestor d226f7e4dc5a54195a59804ec729f72b5e8f10d7 \"$GITHUB_SHA\"");
    expect(runbook).toContain('legacy_project="$(docker inspect --format');
    expect(runbook).toContain("compose_project=<observed legacy Compose project>");
    expect(deploy).toContain("tunes/deployment/music-deploy.sh");
    expect(read("tunes/deployment/music-deploy.sh")).toContain('docker compose -p "$compose_project"');
  });

  it("does not accept comment-only deployment authority markers", () => {
    const comments = [
      "# explorers-tunes",
      "# docker/build-push-action@v6",
      "# anchore/scan-action@v7",
      "# digest:",
      "# workflow_call:",
      "# music-router.yml",
      "# containment-no-schema-change",
      "# /health/ready",
      "# mv --",
      "# tunes-blue:",
      "# tunes-green:",
      "# tunes-gate:",
      "# --providers.file.directory=/deployment-routing",
      "# POSTGRES_PASSWORD: ${DB_PASS:?required}",
      "# status: superseded",
      "# services: {}",
      "# name: explorers-music-fixture",
    ].join("\n");
    const issues = auditDeploymentAuthority({
      ciWorkflow: comments,
      deployWorkflow: comments,
      deployExecutable: comments,
      rootCompose: comments,
      tunesCompose: comments,
      fixtureCompose: comments,
    });
    expect(issues.length).toBeGreaterThan(10);
  });
});
