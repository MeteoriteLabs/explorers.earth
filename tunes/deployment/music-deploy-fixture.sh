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
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    windows_temp="${canonical_root%/*}"
    [[ "$windows_temp" == /tmp \
      || "$windows_temp" =~ ^/[A-Za-z]/Users/[^/]+/AppData/Local/Temp$ ]] \
      || fail "fixture deployment root must be private and owned"
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

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
engine_file="$script_dir/music-deploy-engine.sh"
require_regular_file "$engine_file"
command -v docker >/dev/null 2>&1 || fail "required command missing: docker"
command -v node >/dev/null 2>&1 || fail "required command missing: node"

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
  const serviceNetworks = (service) => Array.isArray(service.networks)
    ? service.networks : Object.keys(service.networks ?? {});
  const expectedNetworks = {
    db: ["internal"], "legacy-tunes": ["proxy"], traefik: ["proxy"],
    "tunes-blue": ["internal", "proxy"], "tunes-gate": ["internal"],
    "tunes-green": ["internal", "proxy"], "tunes-register-compat": ["proxy"],
  };
  const normalizeHost = (value) => String(value).replaceAll("\\", "/")
    .replace(/^([A-Za-z]):\//, (_, drive) => `/${drive.toLowerCase()}/`);
  const safeVolume = (volume) => {
    if (typeof volume === "string") {
      const source = volume.split(":")[0];
      return ["postgres-data", "music-gate-attestations", "fixture-secrets"].includes(source)
        || normalizeHost(source).startsWith(`${root}/`);
    }
    if (!volume || typeof volume !== "object") return false;
    if (volume.type === "bind") return normalizeHost(volume.source).startsWith(`${root}/`)
      && volume.target === "/deployment-routing" && volume.read_only === true;
    return volume.type === "volume"
      && ["postgres-data", "music-gate-attestations", "fixture-secrets",
        `${project}_postgres-data`, `${project}_music-gate-attestations`, `${project}-secrets`].includes(volume.source);
  };
  try {
    const model = JSON.parse(body);
    const services = model.services ?? {};
    if (model.name !== project || !exactKeys(services, required)) process.exit(1);
    for (const name of required) {
      const service = services[name] ?? {};
      const labels = service.labels ?? {};
      if (labels["com.explorers.fixture.scope"] !== "music-c10-release"
        || labels["com.explorers.fixture.project"] !== project) process.exit(1);
      if (service.pull_policy !== "never"
        || !new RegExp(`^${registry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[a-z0-9][a-z0-9_.-]*(?:/[a-z0-9][a-z0-9_.-]*)*@sha256:[a-f0-9]{64}$`).test(service.image)
        || service.build !== undefined || service.privileged === true || service.network_mode !== undefined
        || service.pid !== undefined || service.ipc !== undefined || (service.devices?.length ?? 0) !== 0
        || !exactKeys(Object.fromEntries(serviceNetworks(service).map(value => [value, true])), expectedNetworks[name])
        || !(service.volumes ?? []).every(safeVolume)) process.exit(1);
    }
    if (!exactKeys(model.networks, ["internal", "proxy"])
      || model.networks.internal?.internal !== true
      || model.networks.internal?.external === true || model.networks.proxy?.external === true) process.exit(1);
    if (!exactKeys(model.volumes, ["fixture-secrets", "music-gate-attestations", "postgres-data"])
      || model.volumes["fixture-secrets"]?.external !== true
      || model.volumes["fixture-secrets"]?.name !== `${project}-secrets`
      || model.volumes["music-gate-attestations"]?.external === true
      || model.volumes["postgres-data"]?.external === true) process.exit(1);
    for (const [name, service] of Object.entries(services)) {
      const ports = service.ports ?? [];
      if (name !== "traefik" && ports.length) process.exit(1);
      if (name === "traefik" && (ports.length !== 1
        || (typeof ports[0] === "string" ? !ports[0].startsWith("127.0.0.1:") : ports[0].host_ip !== "127.0.0.1"))) process.exit(1);
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
