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
    const entrypoint = "dist/server/deployment/run-containment-gate.js";
    expect(ci).toContain(`existsSync('/app/${entrypoint}')`);
    expect(compose).toContain(`command: ["node", "${entrypoint}"]`);
  });

  it("uses a read-packages-only remote GHCR credential and always logs it out", () => {
    const deploy = read(".github/workflows/tunes-deploy.yml");
    expect(deploy).toContain("GHCR_DEPLOY_READ_TOKEN");
    expect(deploy).toContain("--password-stdin");
    expect(deploy).toContain("docker logout ghcr.io");
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
    expect(runbook).toContain("first independently verified C2 immutable image");
    expect(runbook).toContain("MINIMUM_CONTAINMENT_COMMIT=d226f7e4dc5a54195a59804ec729f72b5e8f10d7");
    expect(runbook).toContain("test ! -e deployment-state/music-state.env");
    expect(runbook).not.toMatch(/active_container=.*[\s\S]{0,800}health\/ready/);
    expect(runbook).not.toContain("image revision is d226f7e4dc5a54195a59804ec729f72b5e8f10d7");
    expect(runbook).not.toContain("docker compose ps tunes-blue");
    const orderedBootstrap = [
      "legacy_container=",
      "url: http://${legacy_name}:5000",
      "run --rm --no-deps tunes-gate",
      "exec -T tunes-blue",
      "url: http://tunes-blue:5000",
      "https://localtunes.earth/health/ready",
      "deployment-state/secure-images.tsv",
      "docker stop \"$legacy_container\"",
    ];
    let previous = -1;
    for (const step of orderedBootstrap) {
      const current = runbook.indexOf(step, previous + 1);
      expect(current, `missing/out-of-order bootstrap step: ${step}`).toBeGreaterThan(previous);
      previous = current;
    }
  });

  it("makes the private blue C1 hostile gate executable before first routing", () => {
    const runbook = read("docs/operations/music-deploy-runbook.md");
    const probe = runbook.indexOf("compose exec -T tunes-blue node --input-type=module");
    const routeBlue = runbook.indexOf("sed 's#url: http://[^:]*:5000#url: http://tunes-blue:5000#'");
    expect(probe).toBeGreaterThanOrEqual(0);
    expect(probe).toBeLessThan(routeBlue);
    for (const boundary of ["/api/auth/sync", "/graphql", "/api/subscriptions/user-plans/hostile", "socket.io-client"]) {
      expect(runbook.slice(probe, routeBlue)).toContain(boundary);
    }
  });

  it("keeps file-provider routing unambiguous throughout bootstrap and later promotions", () => {
    const deploy = read(".github/workflows/tunes-deploy.yml");
    const compose = read("docker-compose.yml");
    const runbook = read("docs/operations/music-deploy-runbook.md");
    expect(runbook).toContain("priority: 200");
    expect(deploy).toContain("priority: 200");
    expect(compose).not.toContain("traefik.http.routers.tunes");
    expect(compose).not.toContain("traefik.enable: \"true\"\n      traefik.http.routers.tunes");
  });

  it("renders valid legacy-bootstrap and promotion route YAML with priority and exact upstream", () => {
    // Production break caught: a syntactically valid workflow carries an invalid Traefik heredoc.
    const runbookRoute = heredoc(read("docs/operations/music-deploy-runbook.md"), 'cat > "$route_tmp" <<EOF')
      .replaceAll("${legacy_name}", "legacy-tunes").replaceAll("\\`", "`");
    const deployRoute = heredoc(read(".github/workflows/tunes-deploy.yml"), 'cat > "$route_tmp" <<EOF')
      .replaceAll("${candidate_service}", "tunes-green").replaceAll("\\`", "`");
    const legacy = parseYaml(runbookRoute);
    const promotion = parseYaml(deployRoute);
    expect(legacy.http.routers["tunes-cutover"]).toMatchObject({ priority: 200, service: "tunes-active" });
    expect(legacy.http.services["tunes-active"].loadBalancer.servers[0].url).toBe("http://legacy-tunes:5000");
    expect(promotion.http.routers.tunes).toMatchObject({ priority: 200, service: "tunes-active" });
    expect(promotion.http.services["tunes-active"].loadBalancer.servers[0].url).toBe("http://tunes-green:5000");
  });

  it("declares reusable rollback input without requiring deploy-only candidate fields", () => {
    const workflow = parseYaml(read(".github/workflows/tunes-deploy.yml"));
    const inputs = workflow.on.workflow_call.inputs;
    expect(inputs.target_digest).toMatchObject({ type: "string", required: false });
    for (const field of ["image_ref", "digest", "commit"]) expect(inputs[field].required).toBe(false);
    const validation = read(".github/workflows/tunes-deploy.yml");
    expect(validation.indexOf('if [[ "$OPERATION" == deploy ]]')).toBeLessThan(validation.indexOf('[[ "$IMAGE_REF" == ghcr.io/*/explorers-tunes@"$DIGEST" ]]'));
  });

  it("retains a byte-exact route backup until public verification and restores it on failure", () => {
    const deploy = read(".github/workflows/tunes-deploy.yml");
    const copy = deploy.indexOf('cp -- "$route" "$route_backup"');
    const promote = deploy.indexOf('mv -- "$route_tmp" "$route"', copy);
    const verify = deploy.indexOf("https://localtunes.earth/health/ready", promote);
    const restore = deploy.indexOf('mv -- "$route_backup" "$route"', verify);
    const remove = deploy.indexOf('rm -- "$route_backup"', restore);
    expect(copy).toBeGreaterThanOrEqual(0);
    expect(promote).toBeGreaterThan(copy);
    expect(verify).toBeGreaterThan(promote);
    expect(restore).toBeGreaterThan(verify);
    expect(remove).toBeGreaterThan(restore);
  });

  it("accepts a promoted public response only when digest, commit, and gate marker all match", () => {
    // Production break caught: the router reaches the new digest but reports stale deployment metadata.
    const deploy = read(".github/workflows/tunes-deploy.yml");
    const publicVerification = deploy.slice(deploy.indexOf("https://localtunes.earth/health/ready"));
    expect(publicVerification).toContain('b.digest !== process.argv[1]');
    expect(publicVerification).toContain('b.commit !== process.argv[2]');
    expect(publicVerification).toContain('b.migrationMarker !== process.argv[3]');
    expect(publicVerification).toContain('"$requested_digest" "$requested_commit" "$marker"');
  });

  it("requires every C1 production startup secret in Compose readiness", () => {
    // Production break caught: immutable deploy succeeds but C1 startup rejects absent STRAPI_JWT_SECRET.
    const compose = read("docker-compose.yml");
    const health = read("tunes/server/deployment/music-health.ts");
    expect(compose).toContain("STRAPI_JWT_SECRET: ${STRAPI_JWT_SECRET:?STRAPI_JWT_SECRET is required}");
    expect(health).toContain("STRAPI_JWT_SECRET: env.STRAPI_JWT_SECRET");
  });

  it("proves the built C2 commit contains C1 and carries the observed legacy Compose project through deploy", () => {
    // Production break caught: a new project creates a second Traefik instead of updating the legacy topology.
    const ci = read(".github/workflows/tunes.yml");
    const deploy = read(".github/workflows/tunes-deploy.yml");
    const runbook = read("docs/operations/music-deploy-runbook.md");
    expect(ci).toContain("git merge-base --is-ancestor d226f7e4dc5a54195a59804ec729f72b5e8f10d7 \"$GITHUB_SHA\"");
    expect(runbook).toContain('legacy_project="$(docker inspect --format');
    expect(runbook).toContain('compose() { docker compose -p "$legacy_project"');
    expect(runbook).toContain("COMPOSE_PROJECT_NAME=$legacy_project");
    expect(deploy).toContain('docker compose -p "$COMPOSE_PROJECT_NAME"');
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
      rootCompose: comments,
      tunesCompose: comments,
      fixtureCompose: comments,
    });
    expect(issues.length).toBeGreaterThan(10);
  });
});
