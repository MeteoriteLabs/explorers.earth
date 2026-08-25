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
  it("keeps development dependencies out of the production image", () => {
    const dockerfile = read("tunes/Dockerfile");
    expect(dockerfile).toContain(
      "FROM node@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS base",
    );
    expect(dockerfile).toContain("FROM base AS prod-deps");
    expect(dockerfile).toContain("RUN npm ci --omit=dev --legacy-peer-deps");
    expect(dockerfile).toContain("COPY --from=prod-deps /app/node_modules ./node_modules");
    expect(dockerfile).not.toContain("COPY --from=deps /app/node_modules ./node_modules");
    expect(dockerfile).toContain("rm -rf /usr/local/lib/node_modules/npm");
    expect(read("tunes/server/app.ts")).not.toContain('from "./vite"');
    expect(read("tunes/server/runtime.ts")).not.toMatch(/from ["']vite["']/);
    expect(read("tunes/server/runtime.ts")).not.toContain("nanoid");
    expect(JSON.parse(read("tunes/package.json")).scripts.build).toContain("--splitting");
    expect(JSON.parse(read("tunes/package.json")).scripts.build).toContain("server/deployment/run-production-graph-smoke.ts");
    expect(read("tunes/server/deployment/run-production-graph-smoke.ts")).toContain('from "../app"');
    const ci = read(".github/workflows/tunes.yml");
    expect(ci).toContain("Prove the exact production image loads its server graph");
    expect(ci).toContain("timeout 30s docker run");
    expect(ci).toContain("dist/server/deployment/run-production-graph-smoke.js");
  });

  it("mounts the dedicated lifecycle-proof authority into both production Tunes slots", () => {
    const compose = parseYaml(read("docker-compose.yml"));
    for (const slot of ["tunes-blue", "tunes-green"]) {
      expect(compose.services[slot].environment.STRAPI_LIFECYCLE_PROOF_TOKEN_FILE, slot)
        .toBe("/run/secrets/strapi-lifecycle-proof");
      expect(compose.services[slot].volumes, slot).toContain(
        "${STRAPI_LIFECYCLE_PROOF_TOKEN_FILE_HOST:?STRAPI_LIFECYCLE_PROOF_TOKEN_FILE_HOST is required}:/run/secrets/strapi-lifecycle-proof:ro",
      );
    }
  });

  it("has one build authority, one deploy authority, and no legacy host rebuild path", () => {
    const result = auditDeploymentAuthority({
      ciWorkflow: read(".github/workflows/tunes.yml"),
      deployWorkflow: read(".github/workflows/tunes-deploy.yml"),
      deployExecutable: read("tunes/deployment/music-deploy.sh"),
      deployEngine: read("tunes/deployment/music-deploy-engine.sh"),
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
    expect(ci).toContain("/app/migrations/0010_least_privilege_runtime_role.sql");
    expect(ci).toContain("/app/migrations/0011_durable_publication_idempotency.sql");
    expect(ci).toContain("/app/migrations/0012_publication_replay_expiry_guard.sql");
    expect(ci).toContain("/app/migrations/0014_durable_reactivation_authority.sql");
    expect(ci).toContain("/app/migrations/0015_publication_operation_archive.sql");
    expect(ci).toContain("/app/migrations/0017_publication_idempotency_key_retirement.sql");
    expect(read("tunes/deployment/music-deploy-engine.sh")).toContain('production_current_marker="0017_publication_idempotency_key_retirement"');
    expect(read("tunes/deployment/music-deploy-engine.sh")).toContain("verify-publication-authority.mjs");
    expect(read(".github/workflows/tunes-deploy.yml")).toContain("verify-publication-authority.mjs");
    expect(ci).toContain("/app/dist/server/deployment/run-registration-compat.js");
    const workflow = parseYaml(ci);
    const proof = workflow.jobs["build-test-scan-push"].steps
      .find((step: { name?: string }) => step.name === "Prove gate entrypoint is in the exact image").run;
    expect(proof).toMatch(/node[^\r\n]*-e[ \t]+"const\{existsSync\}/);
  });

  it("documents the exact ordered publication migration recovery authority", () => {
    const runbook = read("docs/operations/music-deploy-runbook.md");
    expect(runbook).toContain("then migrations `0002` through `0013`");
    expect(runbook).toContain("upgraded directly to pending `0013`");
    expect(runbook).toContain("`0011` → `0012` → `0013`");
    expect(runbook).toContain("Migration `0013`");
    expect(runbook).not.toContain("response_expires_at");
    expect(runbook).not.toContain("then migrations `0002` through\n`0011`");
    expect(runbook).not.toContain("upgraded directly to pending `0011`");
  });

  it("documents the exact configured previous publication path as privileged authority", () => {
    const runbook = read("docs/operations/music-deploy-runbook.md");
    expect(runbook).toContain("The configured previous container path is authoritative");
    expect(runbook).toContain("same relative path beneath the host publication directory");
    expect(runbook).toContain("never substitutes the default `previous` alias");
  });

  it("reuses the proven Tunes SSH authority and an ephemeral package-read credential", () => {
    const ci = read(".github/workflows/tunes.yml");
    const deploy = read(".github/workflows/tunes-deploy.yml");
    const executable = read("tunes/deployment/music-deploy.sh");
    expect(deploy).toContain("secrets.TUNES_DEPLOY_HOST");
    expect(deploy).toContain("secrets.TUNES_DEPLOY_KEY");
    expect(deploy).toContain("DEPLOY_USER: deploy");
    expect(deploy).toContain("GHCR_DEPLOY_USER: ${{ github.actor }}");
    expect(deploy).toContain("GHCR_DEPLOY_READ_TOKEN: ${{ github.token }}");
    expect(deploy).not.toContain("secrets.HETZNER_HOST");
    expect(deploy).not.toContain("secrets.HETZNER_USER");
    expect(deploy).not.toContain("secrets.HETZNER_SSH_KEY");
    expect(deploy).not.toContain("secrets.GHCR_DEPLOY_USER");
    expect(deploy).not.toContain("secrets.GHCR_DEPLOY_READ_TOKEN");
    expect(ci).not.toContain("secrets: inherit");
    expect(ci).toContain("TUNES_DEPLOY_HOST: ${{ secrets.TUNES_DEPLOY_HOST }}");
    expect(ci).toContain("TUNES_DEPLOY_KEY: ${{ secrets.TUNES_DEPLOY_KEY }}");
    expect(Object.keys(parseYaml(deploy).on.workflow_call.secrets)).toEqual(["TUNES_DEPLOY_HOST", "TUNES_DEPLOY_KEY"]);
    expect(executable).toContain("--password-stdin");
    expect(executable).toContain("logout ghcr.io");
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
    const executable = read("tunes/deployment/music-deploy-engine.sh");
    const probe = executable.indexOf("compose exec -T tunes-blue node --input-type=module");
    const routeBlue = executable.indexOf('write_route "tunes-${candidate_slot}"');
    expect(probe).toBeGreaterThanOrEqual(0);
    expect(probe).toBeLessThan(routeBlue);
    for (const boundary of ["/api/auth/sync", "/graphql", "/api/subscriptions/user-plans/hostile", "socket.io-client"]) {
      expect(executable.slice(probe, routeBlue)).toContain(boundary);
    }
    expect(executable.slice(probe, routeBlue))
      .toContain('body: JSON.stringify({ strapiUser: { username: "hostile" } }) }, 410],');
    expect(executable.slice(probe, routeBlue))
      .toContain('["/api/subscriptions/user-plans/hostile", {}, 410],');
  });

  it("keeps file-provider routing unambiguous throughout bootstrap and later promotions", () => {
    const deploy = read("tunes/deployment/music-deploy-engine.sh");
    const compose = read("docker-compose.yml");
    const runbook = read("docs/operations/music-deploy-runbook.md");
    expect(runbook).toContain("priority-200");
    expect(deploy).toContain("priority: 200");
    expect(compose).not.toContain("traefik.http.routers.tunes");
    expect(compose).not.toContain("traefik.enable: \"true\"\n      traefik.http.routers.tunes");
  });

  it("renders valid legacy-bootstrap and promotion route YAML with priority and exact upstream", () => {
    // Production break caught: a syntactically valid workflow carries an invalid Traefik heredoc.
    const routeTemplate = heredoc(read("tunes/deployment/music-deploy-engine.sh"), 'cat > "$temporary" <<EOF')
      .replaceAll("${router_security}", "      tls:\n        certResolver: letsencrypt");
    const legacy = parseYaml(routeTemplate.replaceAll("${service}", "legacy-tunes").replaceAll("\\`", "`"));
    const deployRoute = routeTemplate.replaceAll("${service}", "tunes-green").replaceAll("\\`", "`");
    const promotion = parseYaml(deployRoute);
    expect(legacy.http.routers.tunes).toMatchObject({ priority: 200, service: "tunes-active" });
    expect(legacy.http.services["tunes-active"].loadBalancer.servers[0].url).toBe("http://legacy-tunes:5000");
    expect(promotion.http.routers.tunes).toMatchObject({ priority: 200, service: "tunes-active" });
    expect(promotion.http.services["tunes-active"].loadBalancer.servers[0].url).toBe("http://tunes-green:5000");
  });

  it("keeps normal deploy internal and exposes only bootstrap or rollback manually", () => {
    const workflow = parseYaml(read(".github/workflows/tunes-deploy.yml"));
    expect(Object.keys(workflow.on.workflow_call.inputs)).toEqual(["digest", "commit"]);
    expect(Object.keys(workflow.on.workflow_dispatch.inputs)).toEqual([
      "operation",
      "target_digest",
      "target_commit",
      "compose_project",
      "legacy_service",
    ]);
    expect(workflow.on.workflow_dispatch.inputs.operation.options).toEqual(["rollback", "bootstrap"]);
    expect(read("tunes/deployment/music-deploy-engine.sh")).toContain("bootstrap refuses existing deployment authority");
  });

  it("retains a byte-exact route backup under an armed error trap until durable commit", () => {
    const deploy = read("tunes/deployment/music-deploy-engine.sh");
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
    const deploy = read("tunes/deployment/music-deploy-engine.sh");
    const publicVerification = deploy.slice(deploy.indexOf("expected_public_body="));
    expect(publicVerification).toContain('\\"digest\\":\\"$candidate_digest\\"');
    expect(publicVerification).toContain('\\"commit\\":\\"$candidate_commit\\"');
    expect(publicVerification).toContain('\\"migrationMarker\\":\\"$candidate_marker\\"');
    expect(publicVerification.indexOf("expected_public_body=")).toBeLessThan(
      publicVerification.indexOf("https://localtunes.earth/health/ready"),
    );
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
    expect(read("tunes/deployment/music-deploy-engine.sh")).toContain('docker compose -p "$compose_project"');
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
      deployEngine: comments,
      rootCompose: comments,
      tunesCompose: comments,
      fixtureCompose: comments,
    });
    expect(issues.length).toBeGreaterThan(10);
  });
});
