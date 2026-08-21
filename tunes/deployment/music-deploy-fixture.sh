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

compose_json="$(docker compose -p "$compose_project" --project-directory "$root" \
  --env-file "$root/production.env" -f "$root/docker-compose.yml" --profile deployment config --format json)" \
  || fail "fixture Compose authority could not be rendered"
printf '%s' "$compose_json" | node -e '
let body="";
process.stdin.on("data", chunk => body += chunk).on("end", () => {
  const project = process.env.MUSIC_DEPLOY_FIXTURE_COMPOSE_PROJECT;
  const required = ["traefik", "tunes-register-compat", "tunes-gate", "tunes-blue", "tunes-green"];
  try {
    const services = JSON.parse(body).services ?? {};
    for (const name of required) {
      const labels = services[name]?.labels ?? {};
      if (labels["com.explorers.fixture.scope"] !== "music-c10-release"
        || labels["com.explorers.fixture.project"] !== project) process.exit(1);
    }
  } catch { process.exit(1); }
});' || fail "fixture Compose labels are invalid"

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
  if [[ "${MUSIC_DEPLOY_EPHEMERAL_CREDENTIAL_FILES:-0}" == 1 ]]; then
    rm -f -- "${MUSIC_DEPLOY_REQUEST_FILE:-}" "${MUSIC_DEPLOY_HMAC_KEY_FILE:-}"
  fi
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
