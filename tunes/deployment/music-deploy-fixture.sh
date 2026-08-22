#!/usr/bin/env bash
set -euo pipefail

umask 077

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

require_regular_file() {
  local path="$1"
  [[ -f "$path" && ! -L "$path" ]] || fail "secure regular file required: $path"
}

[[ "${MUSIC_DEPLOY_MODE:-}" == fixture ]] || fail "fixture deployment mode is required"
[[ "${MUSIC_DEPLOY_TEST_MODE:-0}" == 1 ]] || fail "fixture deployment test mode is required"
[[ "${MUSIC_DEPLOY_FIXTURE_ACK:-}" == C10_LOCAL_REGISTRY_DISPOSABLE_ONLY ]] \
  || fail "fixture deployment acknowledgement is invalid"
[[ -z "${DOCKER_HOST:-}" && -z "${DOCKER_CONTEXT:-}" ]] \
  || fail "ambient Docker endpoint overrides are forbidden"
[[ -z "${GATE_PROD:-}" && -z "${MUSIC_DEPLOY_PRODUCTION:-}" && -z "${MUSIC_DEPLOY_PROD:-}" ]] \
  || fail "production and GATE authority is forbidden in fixture mode"
[[ -z "${MUSIC_DEPLOY_EPHEMERAL_CREDENTIAL_FILES:-}" && -z "${MUSIC_DEPLOY_CLEANUP_ROOT:-}" ]] \
  || fail "fixture credential cleanup overrides are forbidden"
[[ -z "${MUSIC_DEPLOY_AUTHORITY_FILE:-}" \
  && -z "${MUSIC_DEPLOY_GHCR_TOKEN_FILE:-}" \
  && -z "${MUSIC_DEPLOY_GHCR_USER:-}" \
  && -z "${MUSIC_DEPLOY_EXPECTED_REPOSITORY:-}" \
  && -z "${MUSIC_DEPLOY_EXPECTED_SOURCE:-}" ]] \
  || fail "production registry authority is forbidden in fixture mode"

registry="${MUSIC_DEPLOY_FIXTURE_REGISTRY:-}"
[[ "$registry" =~ ^127\.0\.0\.1:([1-9][0-9]{3,4})$ ]] \
  || fail "fixture registry must be an explicit loopback endpoint"
registry_port="${BASH_REMATCH[1]}"
[[ "$registry_port" -le 65535 ]] || fail "fixture registry port is invalid"
compose_project="${MUSIC_DEPLOY_FIXTURE_COMPOSE_PROJECT:-}"
[[ "$compose_project" =~ ^music-c10-release-[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$ ]] \
  || fail "fixture Compose project is invalid"
root="${MUSIC_DEPLOY_ROOT:-}"
[[ "$root" == /* && "$root" != / && "$root" != /opt/explorers && "$root" != /opt/explorers/ ]] \
  || fail "fixture deployment root is invalid"
[[ -d "$root" && ! -L "$root" && -O "$root" ]] \
  || fail "fixture deployment root must be private and owned"
canonical_root="$(realpath -e -- "$root")" || fail "fixture deployment root must be canonical"
[[ "$root" == "$canonical_root" ]] || fail "fixture deployment root must be canonical"
root_leaf="${canonical_root##*/}"
[[ "$root_leaf" =~ ^${compose_project}-[A-Za-z0-9._-]+$ ]] \
  || fail "fixture deployment root is not the owned disposable project root"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
engine_file="$script_dir/music-deploy-engine.sh"
require_regular_file "$engine_file"
command -v node >/dev/null 2>&1 || fail "required command missing: node"
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    windows_temp="${canonical_root%/*}"
    [[ "$windows_temp" == /tmp \
      || "$windows_temp" =~ ^/[A-Za-z]/Users/[^/]+/AppData/Local/Temp$ ]] \
      || fail "fixture deployment root must be private and owned"
    command -v cygpath >/dev/null 2>&1 || fail "required command missing: cygpath"
    windows_powershell="$(cygpath -u "$(cygpath -S)")/WindowsPowerShell/v1.0/powershell.exe"
    [[ -x "$windows_powershell" ]] || fail "required command missing: powershell.exe"
    windows_security="$("$windows_powershell" -NoProfile -NonInteractive -File \
      "$(cygpath -w "$script_dir/../scripts/windows-write-through.ps1")" inspect-security \
      "$(cygpath -w "$canonical_root")")" \
      || fail "fixture deployment root must be private and owned"
    printf '%s' "$windows_security" | node -e '
      let body="";
      process.stdin.on("data", chunk => body += chunk).on("end", () => {
        try {
          const security = JSON.parse(body);
          if (security.ownerMatchesEffectiveUser !== true
            || security.unsafeWritePrincipalCount !== 0) process.exit(1);
        } catch { process.exit(1); }
      });' || fail "fixture deployment root must be private and owned"
    ;;
  *)
    root_mode="$(stat -c '%a' -- "$canonical_root")"
    [[ "$root_mode" == 700 ]] || fail "fixture deployment root must be private and owned"
    ;;
esac

for private_authority in "${MUSIC_DEPLOY_REQUEST_FILE:-}" "${MUSIC_DEPLOY_HMAC_KEY_FILE:-}"; do
  require_regular_file "$private_authority"
  canonical_authority="$(realpath -e -- "$private_authority")" || fail "fixture authority path is invalid"
  [[ "$private_authority" == "$canonical_authority" && "$canonical_authority" == "$canonical_root"/* ]] \
    || fail "fixture authority paths must remain inside the disposable root"
done

marker_file="$root/.music-c10-fixture-root"
require_regular_file "$marker_file"
mapfile -t marker_lines < "$marker_file"
[[ ${#marker_lines[@]} -eq 4 \
  && "${marker_lines[0]}" == music-c10-fixture-root-v1 \
  && "${marker_lines[1]}" == "compose_project=$compose_project" \
  && "${marker_lines[2]}" == "registry=$registry" \
  && "${marker_lines[3]}" == resource_label=com.explorers.fixture.scope=music-c10-release ]] \
  || fail "fixture deployment root authority is invalid"

command -v docker >/dev/null 2>&1 || fail "required command missing: docker"

docker_context="$(command docker context show)" || fail "effective Docker context is invalid"
[[ "$docker_context" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]] \
  || fail "effective Docker context is invalid"
docker_endpoint="$(command docker context inspect --format '{{.Endpoints.docker.Host}}' "$docker_context")" \
  || fail "effective Docker endpoint is invalid"
case "$docker_endpoint" in
  npipe:////./pipe/*)
    [[ "${docker_endpoint#npipe:////./pipe/}" =~ ^[A-Za-z0-9_.-]+$ ]] \
      || fail "effective Docker endpoint must be a local named pipe or Unix socket"
    ;;
  unix:///*)
    [[ "$docker_endpoint" != *[$'\r\n\t ']* && "$docker_endpoint" != *'/../'* ]] \
      || fail "effective Docker endpoint must be a local named pipe or Unix socket"
    ;;
  *) fail "effective Docker endpoint must be a local named pipe or Unix socket" ;;
esac
docker() {
  command docker --host "$docker_endpoint" "$@"
}
readonly -f docker

compose_json="$(docker compose -p "$compose_project" --project-directory "$root" \
  --env-file "$root/production.env" -f "$root/docker-compose.yml" --profile deployment config --format json)" \
  || fail "fixture Compose authority could not be rendered"
printf '%s' "$compose_json" | node -e '
let body="";
process.stdin.on("data", chunk => body += chunk).on("end", () => {
  const project = process.env.MUSIC_DEPLOY_FIXTURE_COMPOSE_PROJECT;
  const registry = process.env.MUSIC_DEPLOY_FIXTURE_REGISTRY;
  const root = process.env.MUSIC_DEPLOY_ROOT.replaceAll("\\", "/").replace(/^([A-Za-z]):\//, (_, drive) => `/${drive.toLowerCase()}/`);
  const required = ["db", "legacy-tunes", "traefik", "tunes-blue", "tunes-gate", "tunes-green", "tunes-register-compat"];
  const exactKeys = (actual, expected) => JSON.stringify(Object.keys(actual ?? {}).sort()) === JSON.stringify([...expected].sort());
  const onlyKeys = (actual, allowed) => Object.keys(actual ?? {}).every(key => allowed.includes(key));
  const exactArray = (actual, expected) => Array.isArray(actual)
    && JSON.stringify(actual) === JSON.stringify(expected);
  const serviceNetworks = (service) => Array.isArray(service.networks)
    ? service.networks : Object.keys(service.networks ?? {});
  const expectedNetworks = {
    db: ["internal"], "legacy-tunes": ["proxy"], traefik: ["proxy"],
    "tunes-blue": ["internal", "proxy"], "tunes-gate": ["internal"],
    "tunes-green": ["internal", "proxy"], "tunes-register-compat": ["proxy"],
  };
  const normalizeHost = (value) => String(value).replaceAll("\\", "/")
    .replace(/^([A-Za-z]):\//, (_, drive) => `/${drive.toLowerCase()}/`);
  const mountTargets = ["/var/lib/postgresql/data", "/run/music-secrets", "/deployment-gates", "/deployment-routing"];
  const mountToken = (volume) => {
    if (typeof volume === "string") {
      const target = mountTargets.find(candidate => volume.endsWith(`:${candidate}:ro`) || volume.endsWith(`:${candidate}`));
      if (!target) return undefined;
      const readOnly = volume.endsWith(`:${target}:ro`);
      const suffix = `:${target}${readOnly ? ":ro" : ""}`;
      const source = normalizeHost(volume.slice(0, -suffix.length));
      const type = source.startsWith("/") ? "bind" : "volume";
      return `${type}|${source}|${target}|${readOnly ? "ro" : "rw"}`;
    }
    if (!volume || typeof volume !== "object" || !["bind", "volume"].includes(volume.type)
      || typeof volume.source !== "string" || typeof volume.target !== "string") return undefined;
    const allowed = volume.type === "bind"
      ? ["type", "source", "target", "read_only", "bind"]
      : ["type", "source", "target", "read_only", "volume"];
    const options = volume.type === "bind" ? volume.bind : volume.volume;
    if (!onlyKeys(volume, allowed) || (options !== undefined && !exactKeys(options, []))) return undefined;
    return `${volume.type}|${normalizeHost(volume.source)}|${volume.target}|${volume.read_only === true ? "ro" : "rw"}`;
  };
  const expectedMounts = {
    traefik: [`bind|${root}/deployment-routing|/deployment-routing|ro`],
    db: ["volume|fixture-secrets|/run/music-secrets|ro", "volume|postgres-data|/var/lib/postgresql/data|rw"],
    "legacy-tunes": [],
    "tunes-blue": ["volume|fixture-secrets|/run/music-secrets|ro", "volume|music-gate-attestations|/deployment-gates|ro"],
    "tunes-green": ["volume|fixture-secrets|/run/music-secrets|ro", "volume|music-gate-attestations|/deployment-gates|ro"],
    "tunes-gate": ["volume|fixture-secrets|/run/music-secrets|ro", "volume|music-gate-attestations|/deployment-gates|rw"],
    "tunes-register-compat": [],
  };
  const exactMounts = (service, expected) => {
    const actual = (service.volumes ?? []).map(mountToken);
    return !actual.includes(undefined)
      && JSON.stringify(actual.sort()) === JSON.stringify([...expected].sort());
  };
  const commands = {
    traefik: ["--api.dashboard=false", "--providers.docker=false", "--providers.file.directory=/deployment-routing", "--providers.file.watch=true", "--entrypoints.websecure.address=:443"],
    db: null,
    "legacy-tunes": ["node", "-e", "require(\x27node:http\x27).createServer((q,s)=>{s.writeHead(200,{\x27content-type\x27:\x27text/plain\x27});s.end(\x27legacy\x27)}).listen(5000,\x270.0.0.0\x27)"],
    "tunes-blue": null,
    "tunes-green": null,
    "tunes-gate": ["node", "dist/server/deployment/run-migration-gate.js"],
    "tunes-register-compat": ["node", "dist/server/deployment/run-registration-compat.js"],
  };
  const allowedServiceKeys = {
    traefik: ["command", "entrypoint", "image", "labels", "networks", "ports", "pull_policy", "volumes"],
    db: ["command", "entrypoint", "environment", "healthcheck", "image", "labels", "networks", "pull_policy", "volumes"],
    "legacy-tunes": ["command", "container_name", "entrypoint", "image", "labels", "networks", "pull_policy"],
    "tunes-blue": ["command", "depends_on", "entrypoint", "environment", "healthcheck", "image", "labels", "networks", "pull_policy", "restart", "volumes"],
    "tunes-green": ["command", "depends_on", "entrypoint", "environment", "healthcheck", "image", "labels", "networks", "pull_policy", "restart", "volumes"],
    "tunes-gate": ["command", "depends_on", "entrypoint", "environment", "image", "labels", "networks", "profiles", "pull_policy", "restart", "volumes"],
    "tunes-register-compat": ["command", "entrypoint", "environment", "image", "labels", "networks", "profiles", "pull_policy", "restart"],
  };
  const expectedRepositories = {
    traefik: "fixture-traefik", db: "fixture-postgres", "legacy-tunes": "explorers-tunes",
    "tunes-blue": "explorers-tunes", "tunes-green": "explorers-tunes", "tunes-gate": "explorers-tunes",
    "tunes-register-compat": "explorers-tunes",
  };
  const exactImage = (name, image) => typeof image === "string"
    && image.startsWith(`${registry}/${expectedRepositories[name]}@`)
    && /^sha256:[a-f0-9]{64}$/.test(image.slice(image.lastIndexOf("@") + 1));
  const exactLabels = (labels) => exactKeys(labels, ["com.explorers.fixture.scope", "com.explorers.fixture.project"])
    && labels["com.explorers.fixture.scope"] === "music-c10-release"
    && labels["com.explorers.fixture.project"] === project;
  const exactNetworkMembership = (service, expected) => exactKeys(
    Object.fromEntries(serviceNetworks(service).map(value => [value, true])), expected)
    && (!service.networks || Array.isArray(service.networks)
      || Object.values(service.networks).every(value => value === null || exactKeys(value, [])));
  const exactDependsOn = (service, required) => required
    ? exactKeys(service.depends_on, ["db"])
      && service.depends_on.db?.condition === "service_healthy"
      && service.depends_on.db?.required !== false
      && onlyKeys(service.depends_on.db, ["condition", "required"])
    : service.depends_on === undefined;
  const exactHealthcheck = (name, value) => {
    if (!["db", "tunes-blue", "tunes-green"].includes(name)) return value === undefined;
    const expected = name === "db"
      ? ["CMD-SHELL", "pg_isready -U music_migrator -d music_release_fixture"]
      : ["CMD", "node", "-e", "fetch(\x27http://127.0.0.1:5000/health/live\x27).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"];
    return onlyKeys(value, ["test", "interval", "timeout", "retries"])
      && exactArray(value?.test, expected) && value.interval === "2s" && value.timeout === "2s"
      && value.retries === (name === "db" ? 30 : 20);
  };
  const tunesEnvironmentKeys = ["ALLOWED_ORIGINS", "COOKIE_SECRET", "MUSIC_COHORT_ENABLED", "MUSIC_DATABASE_HOST",
    "MUSIC_DATABASE_MIGRATOR_USER", "MUSIC_DATABASE_NAME", "MUSIC_DATABASE_PASSWORD_FILE", "MUSIC_DATABASE_PORT",
    "MUSIC_DATABASE_USER", "MUSIC_DEPLOYMENT_HEALTH_ENABLED", "MUSIC_GATE_ATTESTATION_KEY", "MUSIC_GATE_ATTESTATION_PATH",
    "MUSIC_IMAGE_COMMIT", "MUSIC_IMAGE_DIGEST", "MUSIC_MIGRATION_MARKER", "MUSIC_MODE", "MUSIC_NEW_ENTRY_KILL_SWITCH",
    "MUSIC_PUBLICATION_RESPONSE_CURRENT_KEY_FILE", "MUSIC_PUBLICATION_RESPONSE_CURRENT_KID", "MUSIC_STRAPI_ALLOWED_ORIGINS",
    "MUSIC_TOKEN_CLOCK_SKEW_SECONDS", "MUSIC_TOKEN_CURRENT_KID", "MUSIC_TOKEN_CURRENT_SECRET_FILE", "MUSIC_TOKEN_LIFETIME_SECONDS",
    "MUSIC_TRUSTED_PROXY_IP", "NODE_ENV", "PORT", "SESSION_SECRET", "STRAPI_ACCESS_TOKEN", "STRAPI_JWT_SECRET",
    "STRAPI_LIFECYCLE_PROOF_TOKEN_FILE", "STRAPI_URL", "TRUST_PROXY_HOPS"];
  const exactTunesEnvironment = (environment) => exactKeys(environment, tunesEnvironmentKeys)
    && environment.NODE_ENV === "production" && environment.PORT === "5000" && environment.MUSIC_MODE === "live"
    && environment.MUSIC_DATABASE_HOST === "db" && environment.MUSIC_DATABASE_PORT === "5432"
    && environment.MUSIC_DATABASE_NAME === "music_release_fixture" && environment.MUSIC_DATABASE_USER === "music_runtime_login"
    && environment.MUSIC_DATABASE_MIGRATOR_USER === "music_migrator"
    && environment.MUSIC_DATABASE_PASSWORD_FILE === "/run/music-secrets/database-runtime"
    && environment.STRAPI_LIFECYCLE_PROOF_TOKEN_FILE === "/run/music-secrets/strapi-lifecycle"
    && environment.MUSIC_TOKEN_CURRENT_SECRET_FILE === "/run/music-secrets/music-token/current"
    && environment.MUSIC_PUBLICATION_RESPONSE_CURRENT_KEY_FILE === "/run/music-secrets/music-publication-response/current"
    && environment.MUSIC_GATE_ATTESTATION_PATH === `/deployment-gates/${environment.MUSIC_IMAGE_DIGEST}.json`
    && /^sha256:[a-f0-9]{64}$/.test(environment.MUSIC_IMAGE_DIGEST)
    && /^[a-f0-9]{40}$/.test(environment.MUSIC_IMAGE_COMMIT)
    && /^0013_publication_operation_database_clock$/.test(environment.MUSIC_MIGRATION_MARKER)
    && ["http://8.8.8.8", "https://8.8.8.8"].includes(environment.STRAPI_URL)
    && ["SESSION_SECRET", "COOKIE_SECRET", "STRAPI_ACCESS_TOKEN", "STRAPI_JWT_SECRET", "MUSIC_GATE_ATTESTATION_KEY"]
      .every(key => typeof environment[key] === "string" && environment[key].length >= 8);
  const exactGateEnvironment = (environment) => exactKeys(environment, ["MUSIC_DATABASE_HOST", "MUSIC_DATABASE_NAME",
    "MUSIC_DATABASE_PASSWORD_FILE", "MUSIC_DATABASE_PORT", "MUSIC_DATABASE_USER", "MUSIC_GATE_ATTESTATION_KEY",
    "MUSIC_GATE_ATTESTATION_PATH", "MUSIC_IMAGE_COMMIT", "MUSIC_IMAGE_DIGEST", "MUSIC_MIGRATION_MARKER", "MUSIC_MODE",
    "MUSIC_RUNTIME_DATABASE_PASSWORD_FILE", "MUSIC_RUNTIME_DATABASE_USER"])
    && environment.MUSIC_MODE === "live" && environment.MUSIC_DATABASE_HOST === "db" && environment.MUSIC_DATABASE_PORT === "5432"
    && environment.MUSIC_DATABASE_NAME === "music_release_fixture" && environment.MUSIC_DATABASE_USER === "music_migrator"
    && environment.MUSIC_DATABASE_PASSWORD_FILE === "/run/music-secrets/database-migrator"
    && environment.MUSIC_RUNTIME_DATABASE_USER === "music_runtime_login"
    && environment.MUSIC_RUNTIME_DATABASE_PASSWORD_FILE === "/run/music-secrets/database-runtime"
    && /^sha256:[a-f0-9]{64}$/.test(environment.MUSIC_IMAGE_DIGEST)
    && /^[a-f0-9]{40}$/.test(environment.MUSIC_IMAGE_COMMIT)
    && environment.MUSIC_GATE_ATTESTATION_PATH === `/deployment-gates/${environment.MUSIC_IMAGE_DIGEST}.json`
    && typeof environment.MUSIC_GATE_ATTESTATION_KEY === "string" && environment.MUSIC_GATE_ATTESTATION_KEY.length >= 8;
  try {
    const model = JSON.parse(body);
    const services = model.services ?? {};
    if (!exactKeys(model, ["name", "networks", "services", "volumes"])
      || model.name !== project || !exactKeys(services, required)) process.exit(1);
    for (const name of required) {
      const service = services[name] ?? {};
      const command = commands[name];
      if (!onlyKeys(service, allowedServiceKeys[name]) || service.pull_policy !== "never"
        || !exactImage(name, service.image) || !exactLabels(service.labels ?? {})
        || !exactNetworkMembership(service, expectedNetworks[name]) || !exactMounts(service, expectedMounts[name])
        || service.entrypoint != null || (command === null ? service.command != null : !exactArray(service.command, command))
        || !exactHealthcheck(name, service.healthcheck)
        || !exactDependsOn(service, ["tunes-blue", "tunes-green", "tunes-gate"].includes(name))) process.exit(1);
    }
    const tunesImage = services["tunes-blue"].image;
    const tunesDigest = tunesImage.slice(tunesImage.lastIndexOf("@") + 1);
    if (!["legacy-tunes", "tunes-blue", "tunes-green", "tunes-gate", "tunes-register-compat"]
      .every(name => services[name].image === tunesImage)
      || !["tunes-blue", "tunes-green", "tunes-gate"]
        .every(name => services[name].environment?.MUSIC_IMAGE_DIGEST === tunesDigest)
      || services["tunes-blue"].environment?.MUSIC_IMAGE_COMMIT !== services["tunes-green"].environment?.MUSIC_IMAGE_COMMIT
      || services["tunes-blue"].environment?.MUSIC_IMAGE_COMMIT !== services["tunes-gate"].environment?.MUSIC_IMAGE_COMMIT
      || services["tunes-blue"].environment?.MUSIC_MIGRATION_MARKER !== services["tunes-green"].environment?.MUSIC_MIGRATION_MARKER
      || services["tunes-blue"].environment?.MUSIC_MIGRATION_MARKER !== services["tunes-gate"].environment?.MUSIC_MIGRATION_MARKER) process.exit(1);
    if (services["legacy-tunes"].container_name !== `${project}-legacy`
      || services["tunes-blue"].restart !== "unless-stopped" || services["tunes-green"].restart !== "unless-stopped"
      || services["tunes-gate"].restart !== "no" || services["tunes-register-compat"].restart !== "unless-stopped"
      || !exactArray(services["tunes-gate"].profiles, ["deployment"])
      || !exactArray(services["tunes-register-compat"].profiles, ["deployment"])
      || !exactTunesEnvironment(services["tunes-blue"].environment)
      || !exactTunesEnvironment(services["tunes-green"].environment)
      || !exactGateEnvironment(services["tunes-gate"].environment)
      || !exactKeys(services["tunes-register-compat"].environment, ["PORT"])
      || services["tunes-register-compat"].environment.PORT !== "5100"
      || !exactKeys(services.db.environment, ["POSTGRES_DB", "POSTGRES_PASSWORD_FILE", "POSTGRES_USER"])
      || services.db.environment.POSTGRES_USER !== "music_migrator"
      || services.db.environment.POSTGRES_PASSWORD_FILE !== "/run/music-secrets/database-migrator"
      || services.db.environment.POSTGRES_DB !== "music_release_fixture") process.exit(1);
    if (!exactKeys(model.networks, ["internal", "proxy"])
      || !onlyKeys(model.networks.internal, ["name", "ipam", "internal"])
      || !onlyKeys(model.networks.proxy, ["name", "ipam"])
      || model.networks.internal?.internal !== true
      || (model.networks.internal?.name !== undefined && model.networks.internal.name !== `${project}_internal`)
      || (model.networks.proxy?.name !== undefined && model.networks.proxy.name !== `${project}_proxy`)
      || (model.networks.internal?.ipam !== undefined && !exactKeys(model.networks.internal.ipam, []))
      || (model.networks.proxy?.ipam !== undefined && !exactKeys(model.networks.proxy.ipam, []))) process.exit(1);
    if (!exactKeys(model.volumes, ["fixture-secrets", "music-gate-attestations", "postgres-data"])
      || !onlyKeys(model.volumes["fixture-secrets"], ["external", "name"])
      || !onlyKeys(model.volumes["music-gate-attestations"], ["name"])
      || !onlyKeys(model.volumes["postgres-data"], ["name"])
      || model.volumes["fixture-secrets"]?.external !== true
      || model.volumes["fixture-secrets"]?.name !== `${project}-secrets`
      || (model.volumes["music-gate-attestations"]?.name !== undefined
        && model.volumes["music-gate-attestations"].name !== `${project}_music-gate-attestations`)
      || (model.volumes["postgres-data"]?.name !== undefined
        && model.volumes["postgres-data"].name !== `${project}_postgres-data`)) process.exit(1);
    for (const [name, service] of Object.entries(services)) {
      const ports = service.ports ?? [];
      if (name !== "traefik" && ports.length) process.exit(1);
      if (name === "traefik" && (ports.length !== 1
        || (typeof ports[0] === "string"
          ? !/^127\.0\.0\.1:[1-9][0-9]{3,4}:443$/.test(ports[0])
          : !exactKeys(ports[0], ["host_ip", "mode", "protocol", "published", "target"])
            || ports[0].host_ip !== "127.0.0.1" || ports[0].target !== 443
            || ports[0].protocol !== "tcp" || ports[0].mode !== "ingress"
            || !/^[1-9][0-9]{3,4}$/.test(String(ports[0].published))))) process.exit(1);
    }
  } catch { process.exit(1); }
});' || fail "fixture Compose authority is invalid"

repository="$registry/explorers-tunes"
readonly MUSIC_DEPLOY_POLICY_ID=fixture-loopback-v1
readonly MUSIC_DEPLOY_POLICY_REPOSITORY="$repository"
readonly MUSIC_DEPLOY_POLICY_SOURCE=https://github.com/explorers-earth/explorers.earth
export MUSIC_DEPLOY_EXPECTED_REPOSITORY="$repository"
export MUSIC_DEPLOY_EXPECTED_SOURCE="$MUSIC_DEPLOY_POLICY_SOURCE"

music_deploy_registry_materialize() {
  local auth_dir="$1" candidate_image="$2"
  [[ "$candidate_image" == "$repository"@sha256:[a-f0-9][a-f0-9]* ]] \
    || fail "fixture candidate image authority is invalid"
  docker --config "$auth_dir" pull "$candidate_image"
}

music_deploy_registry_cleanup() {
  local auth_dir="$1"
  rm -f -- "$auth_dir/config.json"
  rmdir -- "$auth_dir" 2>/dev/null || true
}

music_deploy_validate_compose_project() {
  [[ "$1" == "$compose_project" ]] || fail "fixture signed Compose project mismatch"
}

music_deploy_router_security() {
  return 0
}

music_deploy_route_committed() {
  docker compose -p "$compose_project" --project-directory "$root" --env-file "$root/production.env" \
    -f "$root/docker-compose.yml" restart traefik >/dev/null 2>&1 || true
}

# shellcheck source=music-deploy-engine.sh
source "$engine_file"
