#!/usr/bin/env bash
set -euo pipefail

umask 077

readonly request_schema="music-deploy-request-v2"
readonly state_schema="music-state-v2"
readonly ledger_schema="music-ledger-v2"
readonly floor_schema="music-floor-v1"
readonly legacy_compatibility_floor_schema="music-schema-floor-v1"
readonly compatibility_floor_schema="music-schema-floor-v2"
readonly schema_epoch_schema="music-schema-epoch-v1"
readonly journal_schema="music-transaction-v1"
readonly legacy_marker="containment-no-schema-change"
readonly production_current_marker="0006_numeric_identity_lock"
readonly -a known_markers=(
  "$legacy_marker"
  "0002_identity_lifecycle"
  "0003_identity_lifecycle_hardening"
  "0004_identity_delete_saga"
  "0005_resource_bound_deletion_history"
  "$production_current_marker"
)
current_marker="$production_current_marker"
if [[ "${MUSIC_DEPLOY_TEST_MODE:-0}" == 1 && -n "${MUSIC_DEPLOY_TEST_CURRENT_MARKER_OVERRIDE:-}" ]]; then
  current_marker="$MUSIC_DEPLOY_TEST_CURRENT_MARKER_OVERRIDE"
fi
readonly current_marker
readonly minimum_containment_commit="d226f7e4dc5a54195a59804ec729f72b5e8f10d7"

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

marker_rank() {
  local candidate="$1" index
  for index in "${!known_markers[@]}"; do
    if [[ "${known_markers[index]}" == "$candidate" ]]; then
      printf '%s\n' "$index"
      return 0
    fi
  done
  return 1
}

current_marker_rank="$(marker_rank "$current_marker")" || fail "current migration marker is unknown"
[[ "$current_marker_rank" -gt 0 ]] || fail "current migration marker cannot be containment"
readonly current_marker_rank

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command missing: $1"
}

require_safe_root() {
  [[ "$1" == /* && "$1" != / && "$1" != /opt && "$1" != /opt/ ]] || fail "unsafe deployment root"
}

require_code_file() {
  local path="$1"
  [[ -f "$path" && ! -L "$path" ]] || fail "regular deployment code file required: $path"
  if [[ "${MUSIC_DEPLOY_TEST_MODE:-0}" != 1 ]]; then
    [[ -O "$path" ]] || fail "deployment code file has wrong owner: $path"
  fi
}

require_regular_file() {
  local path="$1"
  [[ -f "$path" && ! -L "$path" ]] || fail "secure regular file required: $path"
  if [[ "${MUSIC_DEPLOY_TEST_MODE:-0}" != 1 ]]; then
    [[ -O "$path" ]] || fail "deployment file has wrong owner: $path"
    local mode
    mode="$(stat -c '%a' "$path")"
    [[ "$mode" == 600 || "$mode" == 400 ]] || fail "deployment file mode must be 0600 or 0400: $path"
  fi
}

ensure_private_directory() {
  if [[ "${MUSIC_DEPLOY_TEST_MODE:-0}" == 1 ]]; then
    mkdir -p "$@"
  else
    install -d -m 700 "$@"
  fi
}

durable_file() {
  chmod 600 "$1"
  sync -f "$1"
}

durable_directory() {
  sync -f "$1"
}

atomic_replace() {
  local temporary="$1"
  local destination="$2"
  durable_file "$temporary"
  mv -- "$temporary" "$destination"
  durable_directory "$(dirname "$destination")"
}

sha256_file() {
  sha256sum "$1" | awk '{print $1}'
}

root="${MUSIC_DEPLOY_ROOT:-/opt/explorers}"
request_file="${MUSIC_DEPLOY_REQUEST_FILE:-}"
hmac_key_file="${MUSIC_DEPLOY_HMAC_KEY_FILE:-}"
ghcr_token_file="${MUSIC_DEPLOY_GHCR_TOKEN_FILE:-}"
authority_file="${MUSIC_DEPLOY_AUTHORITY_FILE:-}"
ghcr_user="${MUSIC_DEPLOY_GHCR_USER:-}"
repository="${MUSIC_DEPLOY_EXPECTED_REPOSITORY:-}"
expected_source="${MUSIC_DEPLOY_EXPECTED_SOURCE:-}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
hmac_helper_file="${MUSIC_DEPLOY_HMAC_HELPER_FILE:-$script_dir/music-hmac.mjs}"

if [[ -n "$authority_file" ]]; then
  require_regular_file "$authority_file"
  mapfile -t authority_lines < "$authority_file"
  [[ ${#authority_lines[@]} -eq 4 && "${authority_lines[0]}" == music-deploy-authority-v1 \
    && "${authority_lines[1]}" == repository=* && "${authority_lines[2]}" == source=* \
    && "${authority_lines[3]}" == ghcr_user=* ]] || fail "invalid deployment authority schema"
  repository="${authority_lines[1]#repository=}"
  expected_source="${authority_lines[2]#source=}"
  ghcr_user="${authority_lines[3]#ghcr_user=}"
fi

require_safe_root "$root"
[[ "$repository" =~ ^ghcr\.io/[a-z0-9]([a-z0-9_.-]{0,37}[a-z0-9])?/explorers-tunes$ ]] \
  || fail "canonical image repository is invalid"
[[ "$expected_source" =~ ^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] \
  || fail "expected OCI source is invalid"
[[ "$ghcr_user" =~ ^[A-Za-z0-9_.-]+$ ]] || fail "GHCR deploy user is invalid"
require_regular_file "$request_file"
require_regular_file "$hmac_key_file"
require_regular_file "$ghcr_token_file"
require_code_file "$hmac_helper_file"
require_command docker
require_command node
require_command sha256sum
require_command sync
curl_command=curl
if [[ "${MUSIC_DEPLOY_TEST_MODE:-0}" == 1 && -n "${MUSIC_DEPLOY_TEST_CURL_COMMAND:-}" ]]; then
  curl_command="$MUSIC_DEPLOY_TEST_CURL_COMMAND"
  [[ -f "$curl_command" && ! -L "$curl_command" ]] || fail "test curl command is invalid"
else
  require_command curl
fi

hmac() {
  printf '%s' "$1" | node "$hmac_helper_file" "$hmac_key_file"
}

hmac "" >/dev/null || fail "state HMAC key is invalid"

mapfile -t request_lines < "$request_file"
if [[ ${#request_lines[@]} -ne 6 \
  || "${request_lines[0]}" != "$request_schema" \
  || "${request_lines[1]}" != operation=* \
  || "${request_lines[2]}" != digest=* \
  || "${request_lines[3]}" != commit=* \
  || "${request_lines[4]}" != compose_project=* \
  || "${request_lines[5]}" != legacy_service=* ]]; then
  fail "invalid deployment request schema"
fi
operation="${request_lines[1]#operation=}"
requested_digest="${request_lines[2]#digest=}"
requested_commit="${request_lines[3]#commit=}"
requested_compose_project="${request_lines[4]#compose_project=}"
requested_legacy_service="${request_lines[5]#legacy_service=}"
[[ "$operation" == bootstrap || "$operation" == deploy || "$operation" == rollback ]] \
  || fail "invalid deployment request operation"
[[ "$requested_digest" =~ ^sha256:[a-f0-9]{64}$ ]] || fail "invalid deployment request digest"
if [[ "$operation" == rollback ]]; then
  [[ "$requested_commit" == - && "$requested_compose_project" == - && "$requested_legacy_service" == - ]] \
    || fail "invalid deployment request rollback fields"
elif [[ "$operation" == deploy ]]; then
  [[ "$requested_commit" =~ ^[a-f0-9]{40}$ && "$requested_compose_project" == - && "$requested_legacy_service" == - ]] \
    || fail "invalid deployment request deploy fields"
else
  [[ "$requested_commit" =~ ^[a-f0-9]{40}$ \
    && "$requested_compose_project" =~ ^[a-z0-9][a-z0-9_-]{0,62}$ \
    && "$requested_legacy_service" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$ ]] \
    || fail "invalid deployment request bootstrap fields"
fi

state_dir="$root/deployment-state"
route_dir="$root/deployment-routing"
transaction_dir="$root/deployment-transactions"
route_file="$route_dir/music-router.yml"
state_file="$state_dir/music-state.tsv"
ledger_file="$state_dir/secure-images.tsv"
floor_file="$state_dir/music-floor.tsv"
compatibility_floor_file="$state_dir/music-schema-floor.tsv"
schema_epoch_file="$transaction_dir/schema-epoch.tsv"
transaction_current="$transaction_dir/current"

ensure_private_directory "$state_dir" "$route_dir" "$transaction_dir"
[[ -f "$root/docker-compose.yml" && ! -L "$root/docker-compose.yml" ]] || fail "production Compose authority missing"
[[ -f "$root/production.env" && ! -L "$root/production.env" ]] || fail "production environment missing"

declare -a ledger_digests=()
declare -a ledger_commits=()
declare -a ledger_markers=()
declare -A ledger_seen=()
ledger_last_mac=""
ledger_max_marker_rank=-1

validate_ledger() {
  require_regular_file "$ledger_file"
  mapfile -t ledger_rows < "$ledger_file"
  [[ ${#ledger_rows[@]} -gt 0 ]] || fail "secure ledger is empty"
  ledger_digests=()
  ledger_commits=()
  ledger_markers=()
  ledger_seen=()
  ledger_last_mac=""
  ledger_max_marker_rank=-1
  local expected_sequence=1
  local previous_marker_rank=-1
  local row schema sequence digest_value commit_value marker_value marker_value_rank previous_mac mac extra expected_mac
  for row in "${ledger_rows[@]}"; do
    IFS=$'\t' read -r schema sequence digest_value commit_value marker_value previous_mac mac extra <<< "$row"
    marker_value_rank="$(marker_rank "$marker_value")" || fail "secure ledger contains unknown migration marker"
    [[ "$schema" == "$ledger_schema" && -z "${extra:-}" \
      && "$sequence" == "$expected_sequence" \
      && "$digest_value" =~ ^sha256:[a-f0-9]{64}$ \
      && "$commit_value" =~ ^[a-f0-9]{40}$ \
      && "$marker_value_rank" -ge "$previous_marker_rank" \
      && "$mac" =~ ^[a-f0-9]{64}$ ]] || fail "secure ledger malformed or reordered"
    if [[ "$expected_sequence" -eq 1 ]]; then
      [[ "$previous_mac" == GENESIS ]] || fail "secure ledger genesis mismatch"
    else
      [[ "$previous_mac" == "$ledger_last_mac" ]] || fail "secure ledger chain mismatch"
    fi
    [[ -z "${ledger_seen[$digest_value]:-}" ]] || fail "secure ledger contains duplicate digest"
    expected_mac="$(hmac "$ledger_schema"$'\t'"$repository"$'\t'"$sequence"$'\t'"$digest_value"$'\t'"$commit_value"$'\t'"$marker_value"$'\t'"$previous_mac")"
    [[ "$mac" == "$expected_mac" ]] || fail "secure ledger HMAC mismatch"
    ledger_seen["$digest_value"]="$expected_sequence"
    ledger_digests+=("$digest_value")
    ledger_commits+=("$commit_value")
    ledger_markers+=("$marker_value")
    ledger_last_mac="$mac"
    previous_marker_rank="$marker_value_rank"
    ledger_max_marker_rank="$marker_value_rank"
    expected_sequence=$((expected_sequence + 1))
  done
}

floor_digest=""
floor_commit=""
validate_floor() {
  require_regular_file "$floor_file"
  mapfile -t floor_rows < "$floor_file"
  [[ ${#floor_rows[@]} -eq 1 ]] || fail "rollback floor malformed"
  local schema mac extra expected_mac
  IFS=$'\t' read -r schema floor_digest floor_commit mac extra <<< "${floor_rows[0]}"
  [[ "$schema" == "$floor_schema" && -z "${extra:-}" \
    && "$floor_digest" =~ ^sha256:[a-f0-9]{64}$ \
    && "$floor_commit" =~ ^[a-f0-9]{40}$ \
    && "$mac" =~ ^[a-f0-9]{64}$ ]] || fail "rollback floor malformed"
  expected_mac="$(hmac "$floor_schema"$'\t'"$repository"$'\t'"$floor_digest"$'\t'"$floor_commit")"
  [[ "$mac" == "$expected_mac" ]] || fail "rollback floor HMAC mismatch"
  [[ "${ledger_digests[0]}" == "$floor_digest" && "${ledger_commits[0]}" == "$floor_commit" ]] \
    || fail "rollback floor invariant mismatch"
}

compatibility_floor_digest=""
compatibility_floor_commit=""
compatibility_floor_marker=""
compatibility_floor_marker_rank=""
compatibility_floor_state=""
compatibility_floor_format=""
validate_compatibility_floor() {
  require_regular_file "$compatibility_floor_file"
  mapfile -t compatibility_rows < "$compatibility_floor_file"
  [[ ${#compatibility_rows[@]} -eq 1 ]] || fail "schema compatibility floor malformed"
  local schema mac extra expected_mac
  schema="${compatibility_rows[0]%%$'\t'*}"
  if [[ "$schema" == "$legacy_compatibility_floor_schema" ]]; then
    IFS=$'\t' read -r schema compatibility_floor_digest compatibility_floor_commit compatibility_floor_marker mac extra <<< "${compatibility_rows[0]}"
    compatibility_floor_state=current
    [[ -z "${extra:-}" && "$compatibility_floor_marker" == "0003_identity_lifecycle_hardening" ]] \
      || fail "schema compatibility floor malformed"
    expected_mac="$(hmac "$legacy_compatibility_floor_schema"$'\t'"$repository"$'\t'"$compatibility_floor_digest"$'\t'"$compatibility_floor_commit"$'\t'"$compatibility_floor_marker")"
  elif [[ "$schema" == "$compatibility_floor_schema" ]]; then
    IFS=$'\t' read -r schema compatibility_floor_digest compatibility_floor_commit compatibility_floor_marker compatibility_floor_state mac extra <<< "${compatibility_rows[0]}"
    [[ -z "${extra:-}" && ( "$compatibility_floor_state" == pending || "$compatibility_floor_state" == current ) ]] \
      || fail "schema compatibility floor malformed"
    expected_mac="$(hmac "$compatibility_floor_schema"$'\t'"$repository"$'\t'"$compatibility_floor_digest"$'\t'"$compatibility_floor_commit"$'\t'"$compatibility_floor_marker"$'\t'"$compatibility_floor_state")"
  else
    fail "schema compatibility floor malformed"
  fi
  compatibility_floor_marker_rank="$(marker_rank "$compatibility_floor_marker")" \
    || fail "schema compatibility floor contains unknown migration marker"
  [[ "$compatibility_floor_digest" =~ ^sha256:[a-f0-9]{64}$ \
    && "$compatibility_floor_commit" =~ ^[a-f0-9]{40}$ \
    && "$compatibility_floor_marker_rank" -gt 0 \
    && "$compatibility_floor_marker_rank" -le "$current_marker_rank" \
    && "$mac" =~ ^[a-f0-9]{64}$ ]] || fail "schema compatibility floor malformed"
  [[ "$mac" == "$expected_mac" ]] || fail "schema compatibility floor HMAC mismatch"
  compatibility_floor_format="$schema"
}

write_compatibility_floor() {
  local digest_value="$1" commit_value="$2" state_value="$3" marker_value="${4:-$current_marker}" marker_value_rank
  [[ "$state_value" == pending || "$state_value" == current ]] || fail "invalid schema compatibility floor state"
  marker_value_rank="$(marker_rank "$marker_value")" || fail "invalid schema compatibility floor marker"
  [[ "$marker_value_rank" -gt 0 && "$marker_value_rank" -le "$current_marker_rank" ]] \
    || fail "invalid schema compatibility floor marker"
  local mac temporary
  mac="$(hmac "$compatibility_floor_schema"$'\t'"$repository"$'\t'"$digest_value"$'\t'"$commit_value"$'\t'"$marker_value"$'\t'"$state_value")"
  temporary="$compatibility_floor_file.next.$$"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$compatibility_floor_schema" "$digest_value" "$commit_value" "$marker_value" "$state_value" "$mac" > "$temporary"
  atomic_replace "$temporary" "$compatibility_floor_file"
  compatibility_floor_digest="$digest_value"
  compatibility_floor_commit="$commit_value"
  compatibility_floor_marker="$marker_value"
  compatibility_floor_marker_rank="$marker_value_rank"
  compatibility_floor_state="$state_value"
  compatibility_floor_format="$compatibility_floor_schema"
}

schema_epoch_digest=""
schema_epoch_commit=""
schema_epoch_marker=""
schema_epoch_marker_rank=""
schema_epoch_state=""
validate_schema_epoch() {
  require_regular_file "$schema_epoch_file"
  mapfile -t epoch_rows < "$schema_epoch_file"
  [[ ${#epoch_rows[@]} -eq 1 ]] || fail "schema epoch journal malformed"
  local schema mac extra expected_mac
  IFS=$'\t' read -r schema schema_epoch_digest schema_epoch_commit schema_epoch_marker schema_epoch_state mac extra <<< "${epoch_rows[0]}"
  schema_epoch_marker_rank="$(marker_rank "$schema_epoch_marker")" \
    || fail "schema epoch journal contains unknown migration marker"
  [[ "$schema" == "$schema_epoch_schema" && -z "${extra:-}" \
    && "$schema_epoch_digest" =~ ^sha256:[a-f0-9]{64}$ \
    && "$schema_epoch_commit" =~ ^[a-f0-9]{40}$ \
    && "$schema_epoch_marker_rank" -gt 0 \
    && "$schema_epoch_marker_rank" -le "$current_marker_rank" \
    && ( "$schema_epoch_state" == preparing || "$schema_epoch_state" == pending || "$schema_epoch_state" == current ) \
    && "$mac" =~ ^[a-f0-9]{64}$ ]] || fail "schema epoch journal malformed"
  expected_mac="$(hmac "$schema_epoch_schema"$'\t'"$repository"$'\t'"$schema_epoch_digest"$'\t'"$schema_epoch_commit"$'\t'"$schema_epoch_marker"$'\t'"$schema_epoch_state")"
  [[ "$mac" == "$expected_mac" ]] || fail "schema epoch journal HMAC mismatch"
}

write_schema_epoch() {
  local digest_value="$1" commit_value="$2" state_value="$3" marker_value="${4:-$current_marker}" marker_value_rank
  [[ "$state_value" == preparing || "$state_value" == pending || "$state_value" == current ]] || fail "invalid schema epoch state"
  marker_value_rank="$(marker_rank "$marker_value")" || fail "invalid schema epoch marker"
  [[ "$marker_value_rank" -gt 0 && "$marker_value_rank" -le "$current_marker_rank" ]] \
    || fail "invalid schema epoch marker"
  local mac temporary
  mac="$(hmac "$schema_epoch_schema"$'\t'"$repository"$'\t'"$digest_value"$'\t'"$commit_value"$'\t'"$marker_value"$'\t'"$state_value")"
  temporary="$schema_epoch_file.next.$$"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$schema_epoch_schema" "$digest_value" "$commit_value" "$marker_value" "$state_value" "$mac" > "$temporary"
  atomic_replace "$temporary" "$schema_epoch_file"
  schema_epoch_digest="$digest_value"
  schema_epoch_commit="$commit_value"
  schema_epoch_marker="$marker_value"
  schema_epoch_marker_rank="$marker_value_rank"
  schema_epoch_state="$state_value"
}

recover_schema_epoch() {
  local has_epoch=0 has_floor=0
  if [[ -e "$schema_epoch_file" ]]; then validate_schema_epoch; has_epoch=1; fi
  if [[ -e "$compatibility_floor_file" ]]; then validate_compatibility_floor; has_floor=1; fi
  if [[ "$has_floor" == 1 && "$has_epoch" == 0 ]]; then
    write_schema_epoch "$compatibility_floor_digest" "$compatibility_floor_commit" "$compatibility_floor_state" "$compatibility_floor_marker"
    has_epoch=1
  elif [[ "$has_floor" == 0 && "$has_epoch" == 1 && "$schema_epoch_state" != preparing ]]; then
    write_compatibility_floor "$schema_epoch_digest" "$schema_epoch_commit" "$schema_epoch_state" "$schema_epoch_marker"
    has_floor=1
  fi
  if [[ "$has_floor" == 1 && "$has_epoch" == 1 ]]; then
    if [[ "$schema_epoch_marker_rank" -gt "$compatibility_floor_marker_rank" ]]; then
      # The executable always writes the higher authenticated epoch first.
      # A crash before the floor write is therefore recoverable and must move
      # the floor forward; the reverse ordering can only be a downgrade.
      [[ "$schema_epoch_state" != preparing ]] || fail "schema epoch authority mismatch"
      write_compatibility_floor "$schema_epoch_digest" "$schema_epoch_commit" "$schema_epoch_state" "$schema_epoch_marker"
    elif [[ "$schema_epoch_marker_rank" -lt "$compatibility_floor_marker_rank" ]]; then
      fail "schema epoch marker downgrade or reordered authority"
    else
      [[ "$compatibility_floor_marker" == "$schema_epoch_marker" \
        && "$compatibility_floor_digest" == "$schema_epoch_digest" \
        && "$compatibility_floor_commit" == "$schema_epoch_commit" ]] || fail "schema epoch authority mismatch"
      if [[ "$compatibility_floor_state" == current || "$schema_epoch_state" == current ]]; then
        [[ "$compatibility_floor_state" == current ]] \
          || write_compatibility_floor "$schema_epoch_digest" "$schema_epoch_commit" current "$schema_epoch_marker"
        [[ "$schema_epoch_state" == current ]] \
          || write_schema_epoch "$schema_epoch_digest" "$schema_epoch_commit" current "$schema_epoch_marker"
      elif [[ "$compatibility_floor_state" != "$schema_epoch_state" ]]; then
        write_schema_epoch "$compatibility_floor_digest" "$compatibility_floor_commit" "$compatibility_floor_state" "$compatibility_floor_marker"
      fi
    fi
  fi
}

state_compose_project=""
state_active_slot=""
state_active_digest=""
state_active_commit=""
state_blue_digest=""
state_blue_commit=""
state_green_digest=""
state_green_commit=""
validate_state() {
  require_regular_file "$state_file"
  mapfile -t state_rows < "$state_file"
  [[ ${#state_rows[@]} -eq 1 ]] || fail "deployment state malformed"
  local schema mac extra expected_mac
  IFS=$'\t' read -r schema state_compose_project state_active_slot state_active_digest state_active_commit \
    state_blue_digest state_blue_commit state_green_digest state_green_commit mac extra <<< "${state_rows[0]}"
  [[ "$schema" == "$state_schema" && -z "${extra:-}" \
    && "$state_compose_project" =~ ^[a-z0-9][a-z0-9_-]{0,62}$ \
    && ( "$state_active_slot" == blue || "$state_active_slot" == green ) \
    && "$state_active_digest" =~ ^sha256:[a-f0-9]{64}$ \
    && "$state_active_commit" =~ ^[a-f0-9]{40}$ \
    && "$state_blue_digest" =~ ^sha256:[a-f0-9]{64}$ \
    && "$state_blue_commit" =~ ^[a-f0-9]{40}$ \
    && "$state_green_digest" =~ ^sha256:[a-f0-9]{64}$ \
    && "$state_green_commit" =~ ^[a-f0-9]{40}$ \
    && "$mac" =~ ^[a-f0-9]{64}$ ]] || fail "deployment state malformed"
  expected_mac="$(hmac "$state_schema"$'\t'"$repository"$'\t'"$state_compose_project"$'\t'"$state_active_slot"$'\t'"$state_active_digest"$'\t'"$state_active_commit"$'\t'"$state_blue_digest"$'\t'"$state_blue_commit"$'\t'"$state_green_digest"$'\t'"$state_green_commit")"
  [[ "$mac" == "$expected_mac" ]] || fail "deployment state HMAC mismatch"
  local active_index="${ledger_seen[$state_active_digest]:-}"
  local blue_index="${ledger_seen[$state_blue_digest]:-}"
  local green_index="${ledger_seen[$state_green_digest]:-}"
  [[ -n "$active_index" && -n "$blue_index" && -n "$green_index" ]] || fail "deployment state references unknown digest"
  [[ "${ledger_commits[active_index-1]}" == "$state_active_commit" \
    && "${ledger_commits[blue_index-1]}" == "$state_blue_commit" \
    && "${ledger_commits[green_index-1]}" == "$state_green_commit" ]] \
    || fail "deployment state commit mismatch"
  if [[ "$state_active_slot" == blue ]]; then
    [[ "$state_active_digest" == "$state_blue_digest" && "$state_active_commit" == "$state_blue_commit" ]] \
      || fail "deployment active blue invariant mismatch"
  else
    [[ "$state_active_digest" == "$state_green_digest" && "$state_active_commit" == "$state_green_commit" ]] \
      || fail "deployment active green invariant mismatch"
  fi
}

cleanup_transaction_directory() {
  local directory="$1"
  rm -f -- "$directory/route.backup" "$directory/ledger.backup" "$directory/state.backup" \
    "$directory/floor.backup" "$directory/journal.tsv"
  rmdir -- "$directory" 2>/dev/null || true
}

restore_optional_backup() {
  local present="$1"
  local backup="$2"
  local destination="$3"
  if [[ "$present" == 1 ]]; then
    local temporary="$destination.recovery.$$"
    cp -- "$backup" "$temporary"
    atomic_replace "$temporary" "$destination"
  else
    [[ ! -L "$destination" ]] || fail "refusing to remove symlink during recovery: $destination"
    rm -f -- "$destination"
    durable_directory "$(dirname "$destination")"
  fi
}

recover_transaction() {
  [[ -e "$transaction_current" ]] || return 0
  [[ -d "$transaction_current" && ! -L "$transaction_current" ]] || fail "transaction journal path is unsafe"
  local journal="$transaction_current/journal.tsv"
  require_regular_file "$journal"
  mapfile -t journal_rows < "$journal"
  [[ ${#journal_rows[@]} -eq 1 ]] || fail "transaction journal malformed"
  local schema journal_operation candidate_slot candidate_digest candidate_commit route_hash
  local ledger_present ledger_hash state_present state_hash floor_present floor_hash mac extra expected_mac
  IFS=$'\t' read -r schema journal_operation candidate_slot candidate_digest candidate_commit route_hash \
    ledger_present ledger_hash state_present state_hash floor_present floor_hash mac extra <<< "${journal_rows[0]}"
  [[ "$schema" == "$journal_schema" && -z "${extra:-}" \
    && ( "$journal_operation" == bootstrap || "$journal_operation" == deploy || "$journal_operation" == rollback ) \
    && ( "$candidate_slot" == blue || "$candidate_slot" == green ) \
    && "$candidate_digest" =~ ^sha256:[a-f0-9]{64}$ \
    && "$candidate_commit" =~ ^[a-f0-9]{40}$ \
    && "$route_hash" =~ ^[a-f0-9]{64}$ \
    && ( "$ledger_present" == 0 || "$ledger_present" == 1 ) \
    && ( "$state_present" == 0 || "$state_present" == 1 ) \
    && ( "$floor_present" == 0 || "$floor_present" == 1 ) \
    && "$ledger_hash" =~ ^(ABSENT|[a-f0-9]{64})$ \
    && "$state_hash" =~ ^(ABSENT|[a-f0-9]{64})$ \
    && "$floor_hash" =~ ^(ABSENT|[a-f0-9]{64})$ \
    && "$mac" =~ ^[a-f0-9]{64}$ ]] || fail "transaction journal malformed"
  expected_mac="$(hmac "$journal_schema"$'\t'"$repository"$'\t'"$journal_operation"$'\t'"$candidate_slot"$'\t'"$candidate_digest"$'\t'"$candidate_commit"$'\t'"$route_hash"$'\t'"$ledger_present"$'\t'"$ledger_hash"$'\t'"$state_present"$'\t'"$state_hash"$'\t'"$floor_present"$'\t'"$floor_hash")"
  [[ "$mac" == "$expected_mac" ]] || fail "transaction journal HMAC mismatch"
  require_regular_file "$transaction_current/route.backup"
  [[ "$(sha256_file "$transaction_current/route.backup")" == "$route_hash" ]] || fail "transaction route backup mismatch"
  for entry in "ledger:$ledger_present:$ledger_hash" "state:$state_present:$state_hash" "floor:$floor_present:$floor_hash"; do
    IFS=: read -r name present hash_value <<< "$entry"
    if [[ "$present" == 1 ]]; then
      require_regular_file "$transaction_current/$name.backup"
      [[ "$(sha256_file "$transaction_current/$name.backup")" == "$hash_value" ]] \
        || fail "transaction $name backup mismatch"
    else
      [[ "$hash_value" == ABSENT && ! -e "$transaction_current/$name.backup" ]] \
        || fail "transaction absent $name backup mismatch"
    fi
  done
  local route_temporary="$route_file.recovery.$$"
  cp -- "$transaction_current/route.backup" "$route_temporary"
  atomic_replace "$route_temporary" "$route_file"
  restore_optional_backup "$ledger_present" "$transaction_current/ledger.backup" "$ledger_file"
  restore_optional_backup "$state_present" "$transaction_current/state.backup" "$state_file"
  restore_optional_backup "$floor_present" "$transaction_current/floor.backup" "$floor_file"
  cleanup_transaction_directory "$transaction_current"
  durable_directory "$transaction_dir"
}

recover_transaction

write_route() {
  local service="$1"
  local include_registration_compat="${2:-false}"
  local temporary="$route_file.next.$$"
  if [[ "$include_registration_compat" == true ]]; then
    cat > "$temporary" <<EOF
http:
  routers:
    tunes-register-compat:
      rule: Host(\`localtunes.earth\`) && PathRegexp(\`(?i)^/api/register/?$\`) && Method(\`POST\`)
      priority: 1000
      entryPoints: [websecure]
      tls:
        certResolver: letsencrypt
      service: tunes-register-compat
      middlewares: [tunes-register-rate-limit]
    tunes:
      rule: Host(\`localtunes.earth\`)
      priority: 200
      entryPoints: [websecure]
      tls:
        certResolver: letsencrypt
      service: tunes-active
  services:
    tunes-register-compat:
      loadBalancer:
        servers:
          - url: http://tunes-register-compat:5100
    tunes-active:
      loadBalancer:
        servers:
          - url: http://${service}:5000
  middlewares:
    tunes-register-rate-limit:
      rateLimit:
        average: 4
        period: 1s
        burst: 4
EOF
  else
    cat > "$temporary" <<EOF
http:
  routers:
    tunes:
      rule: Host(\`localtunes.earth\`)
      priority: 200
      entryPoints: [websecure]
      tls:
        certResolver: letsencrypt
      service: tunes-active
  services:
    tunes-active:
      loadBalancer:
        servers:
          - url: http://${service}:5000
EOF
  fi
  atomic_replace "$temporary" "$route_file"
}

if [[ "$operation" == bootstrap ]]; then
  [[ ! -e "$state_file" && ! -e "$ledger_file" && ! -e "$floor_file" ]] \
    || fail "bootstrap refuses existing deployment authority"
  recover_schema_epoch
  compose_project="$requested_compose_project"
  legacy_service="$requested_legacy_service"
  if [[ -e "$route_file" ]]; then
    require_regular_file "$route_file"
    [[ "$(grep -Ec "url: http://${legacy_service}:5000$" "$route_file")" == 1 ]] \
      || fail "bootstrap legacy route does not match observed service"
  else
    write_route "$legacy_service" false
  fi
  candidate_slot=blue
  candidate_digest="$requested_digest"
  candidate_commit="$requested_commit"
  candidate_marker="$current_marker"
  active_service="$legacy_service"
  blue_digest="$candidate_digest"
  blue_commit="$candidate_commit"
  blue_marker="$candidate_marker"
  green_digest="$candidate_digest"
  green_commit="$candidate_commit"
  green_marker="$candidate_marker"
  if [[ -e "$compatibility_floor_file" ]]; then
    validate_compatibility_floor
    [[ "$compatibility_floor_digest" == "$candidate_digest" && "$compatibility_floor_commit" == "$candidate_commit" ]] \
      || fail "bootstrap schema compatibility floor candidate mismatch"
  fi
else
  require_regular_file "$route_file"
  validate_ledger
  validate_floor
  validate_state
  if [[ -e "$compatibility_floor_file" ]]; then
    validate_compatibility_floor
  fi
  if [[ -e "$schema_epoch_file" ]]; then validate_schema_epoch; fi
  if [[ -e "$compatibility_floor_file" ]]; then
    [[ "$compatibility_floor_marker_rank" -ge "$ledger_max_marker_rank" ]] \
      || fail "schema compatibility floor is older than secure ledger authority"
  else
    [[ "$ledger_max_marker_rank" -le 1 ]] \
      || fail "schema compatibility floor missing after schema migration"
  fi
  recover_schema_epoch
  if [[ -e "$compatibility_floor_file" ]]; then
    validate_compatibility_floor
    [[ "$compatibility_floor_marker_rank" -ge "$ledger_max_marker_rank" ]] \
      || fail "schema compatibility floor is older than secure ledger authority"
  else
    for known_marker in "${ledger_markers[@]}"; do
      known_marker_rank="$(marker_rank "$known_marker")" || fail "secure ledger contains unknown migration marker"
      [[ "$known_marker_rank" -le 1 ]] || fail "schema compatibility floor missing after schema migration"
    done
    active_sequence="${ledger_seen[$state_active_digest]}"
    active_marker_rank="$(marker_rank "${ledger_markers[active_sequence-1]}")" \
      || fail "secure ledger contains unknown migration marker"
    [[ "$active_marker_rank" -le 1 ]] \
      || fail "schema compatibility floor missing for active schema image"
  fi
  compose_project="$state_compose_project"
  if [[ "$state_active_slot" == blue ]]; then candidate_slot=green; else candidate_slot=blue; fi
  active_service="tunes-${state_active_slot}"
  blue_digest="$state_blue_digest"
  blue_commit="$state_blue_commit"
  blue_marker="${ledger_markers[${ledger_seen[$blue_digest]}-1]}"
  green_digest="$state_green_digest"
  green_commit="$state_green_commit"
  green_marker="${ledger_markers[${ledger_seen[$green_digest]}-1]}"
  if [[ "$operation" == rollback ]]; then
    target_sequence="${ledger_seen[$requested_digest]:-}"
    floor_sequence="${ledger_seen[$floor_digest]:-}"
    [[ -n "$target_sequence" ]] || fail "rollback refused: unknown secure digest"
    [[ "$target_sequence" -ge "$floor_sequence" ]] || fail "rollback refused: digest older than permanent floor"
    candidate_digest="$requested_digest"
    candidate_commit="${ledger_commits[target_sequence-1]}"
    candidate_marker="${ledger_markers[target_sequence-1]}"
    if [[ -e "$compatibility_floor_file" ]]; then
      candidate_marker_rank="$(marker_rank "$candidate_marker")" || fail "rollback refused: unknown migration marker"
      [[ "$candidate_marker_rank" -ge "$compatibility_floor_marker_rank" ]] \
        || fail "rollback refused: digest older than schema compatibility floor"
    fi
  else
    candidate_digest="$requested_digest"
    candidate_commit="$requested_commit"
    candidate_marker="$current_marker"
  fi
  if [[ "$candidate_slot" == blue ]]; then
    blue_digest="$candidate_digest"
    blue_commit="$candidate_commit"
    blue_marker="$candidate_marker"
  else
    green_digest="$candidate_digest"
    green_commit="$candidate_commit"
    green_marker="$candidate_marker"
  fi
fi

candidate_marker_rank="$(marker_rank "$candidate_marker")" || fail "candidate migration marker is unknown"
if [[ -e "$compatibility_floor_file" ]]; then
  [[ "$candidate_marker_rank" -ge "$compatibility_floor_marker_rank" ]] \
    || fail "candidate refused: migration marker older than schema compatibility floor"
  if [[ "$compatibility_floor_state" == pending ]]; then
    [[ "$candidate_marker_rank" -eq "$compatibility_floor_marker_rank" \
      && "$candidate_digest" == "$compatibility_floor_digest" \
      && "$candidate_commit" == "$compatibility_floor_commit" ]] \
      || fail "candidate refused: pending schema epoch must be retried exactly"
  fi
fi

provider_file_count="$(find "$route_dir" -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) | wc -l | tr -d ' ')"
[[ "$provider_file_count" == 1 ]] || fail "exactly one Traefik provider file is required"
if [[ -e "$compatibility_floor_file" \
  && ( "$compatibility_floor_state" == pending || "$compatibility_floor_marker_rank" -eq "$current_marker_rank" ) ]]; then
  grep -Fq 'PathRegexp(`(?i)^/api/register/?$`)' "$route_file" || fail "schema compatibility route missing"
  grep -Fq 'url: http://tunes-register-compat:5100' "$route_file" || fail "schema compatibility service route missing"
fi

candidate_image="$repository@$candidate_digest"
export TUNES_CANDIDATE_IMAGE="$candidate_image" TUNES_CANDIDATE_DIGEST="$candidate_digest" TUNES_CANDIDATE_COMMIT="$candidate_commit"
export TUNES_COMPAT_IMAGE="$candidate_image"
export TUNES_BLUE_IMAGE="$repository@$blue_digest" TUNES_BLUE_DIGEST="$blue_digest" TUNES_BLUE_COMMIT="$blue_commit"
export TUNES_GREEN_IMAGE="$repository@$green_digest" TUNES_GREEN_DIGEST="$green_digest" TUNES_GREEN_COMMIT="$green_commit"
export TUNES_CANDIDATE_MIGRATION="$candidate_marker" TUNES_BLUE_MIGRATION="$blue_marker" TUNES_GREEN_MIGRATION="$green_marker"
if [[ "$candidate_marker" == "$legacy_marker" ]]; then
  export TUNES_GATE_ENTRYPOINT="dist/server/deployment/run-containment-gate.js"
else
  export TUNES_GATE_ENTRYPOINT="dist/server/deployment/run-migration-gate.js"
fi

auth_dir="$transaction_dir/registry-auth.$$"
ensure_private_directory "$auth_dir"
registry_logged_in=false
cleanup_credentials() {
  local status=$?
  if [[ "$registry_logged_in" == true ]]; then
    docker --config "$auth_dir" logout ghcr.io >/dev/null 2>&1 || true
  fi
  rm -f -- "$auth_dir/config.json"
  rmdir -- "$auth_dir" 2>/dev/null || true
  if [[ "${MUSIC_DEPLOY_EPHEMERAL_CREDENTIAL_FILES:-0}" == 1 ]]; then
    rm -f -- "$request_file" "$hmac_key_file" "$ghcr_token_file" "$authority_file"
  fi
  exit "$status"
}
trap cleanup_credentials EXIT

cat "$ghcr_token_file" | docker --config "$auth_dir" login ghcr.io --username "$ghcr_user" --password-stdin >/dev/null
registry_logged_in=true
docker pull "$candidate_image"
repo_digests="$(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$candidate_image")"
[[ "$repo_digests" == *"$candidate_image"* ]] || fail "pulled image digest mismatch"
oci_revision="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$candidate_image")"
oci_source="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.source" }}' "$candidate_image")"
oci_containment="$(docker image inspect --format '{{ index .Config.Labels "com.explorers.music.minimum-containment-commit" }}' "$candidate_image")"
[[ "$oci_revision" == "$candidate_commit" && "$oci_source" == "$expected_source" \
  && "$oci_containment" == "$minimum_containment_commit" ]] || fail "OCI provenance mismatch"

compose() {
  docker compose -p "$compose_project" --project-directory "$root" --env-file "$root/production.env" \
    -f "$root/docker-compose.yml" "$@"
}

maybe_failpoint() {
  if [[ "${MUSIC_DEPLOY_TEST_MODE:-0}" == 1 && "${MUSIC_DEPLOY_FAILPOINT:-}" == "$1" ]]; then
    printf 'injected crash at %s\n' "$1" >&2
    trap - EXIT
    exit 99
  fi
}

probe_registration_denial() {
  local payload="$1" response status body
  response="$("$curl_command" --silent --show-error --max-time 5 --request POST \
    --data "$payload" https://localtunes.earth/api/register --write-out $'\n%{http_code}')"
  status="${response##*$'\n'}"
  body="${response%$'\n'*}"
  [[ "$status" == 410 ]] || fail "registration compatibility route status mismatch"
  printf '%s' "$body" | node -e \
    "let b='';process.stdin.on('data',c=>b+=c).on('end',()=>{try{const v=JSON.parse(b);if(v?.error?.code!=='LEGACY_IDENTITY_ROUTE_REMOVED'||v.error.retryable!==false||!v.error.requestId)process.exit(1)}catch{process.exit(1)}})" \
    || fail "registration compatibility response mismatch"
}

install_registration_compatibility_route() {
  compose --profile deployment up -d --no-deps tunes-register-compat
  compose exec -T tunes-register-compat node -e \
    "fetch('http://127.0.0.1:5100/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
  compose exec -T tunes-register-compat node -e \
    "fetch('http://127.0.0.1:5100/api/register',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).then(async r=>{const b=await r.json();if(r.status!==410||b?.error?.code!=='LEGACY_IDENTITY_ROUTE_REMOVED')process.exit(1)}).catch(()=>process.exit(1))"
  write_route "$active_service" true
  probe_registration_denial '{}'
  probe_registration_denial '{"strapiUserDocumentId":"forged-person","strapiAccountDocumentId":"forged-account","lifecycleOperationId":"forged-operation","guestCapabilityHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}'
}

if [[ "$operation" == bootstrap ]]; then
  compose up -d --no-deps traefik
  "$curl_command" --fail --silent --show-error --max-time 5 https://localtunes.earth/ >/dev/null
fi

if [[ ! -e "$compatibility_floor_file" ]]; then
  if [[ ! -e "$schema_epoch_file" ]]; then
    write_schema_epoch "$candidate_digest" "$candidate_commit" preparing
  else
    validate_schema_epoch
    [[ "$schema_epoch_state" == preparing && "$schema_epoch_digest" == "$candidate_digest" \
      && "$schema_epoch_commit" == "$candidate_commit" ]] || fail "schema epoch preparing candidate mismatch"
  fi
  install_registration_compatibility_route
  maybe_failpoint before_epoch
  write_schema_epoch "$candidate_digest" "$candidate_commit" pending
  write_compatibility_floor "$candidate_digest" "$candidate_commit" pending
  maybe_failpoint after_epoch_before_gate
else
  if [[ "$operation" != rollback && "$candidate_marker_rank" -gt "$compatibility_floor_marker_rank" ]]; then
    install_registration_compatibility_route
    maybe_failpoint before_epoch
    # The higher signed epoch is durable first. Recovery recognizes this one
    # direction as an interrupted monotonic upgrade and advances the floor.
    write_schema_epoch "$candidate_digest" "$candidate_commit" pending "$candidate_marker"
    write_compatibility_floor "$candidate_digest" "$candidate_commit" pending "$candidate_marker"
    maybe_failpoint after_epoch_before_gate
  else
    probe_registration_denial '{}'
  fi
fi

compose --profile deployment run --rm --no-deps tunes-gate
validate_compatibility_floor
if [[ "$compatibility_floor_state" == pending ]]; then
  [[ "$candidate_marker_rank" -eq "$compatibility_floor_marker_rank" \
    && "$candidate_digest" == "$compatibility_floor_digest" \
    && "$candidate_commit" == "$compatibility_floor_commit" ]] \
    || fail "gate candidate does not match pending schema epoch"
  write_compatibility_floor "$compatibility_floor_digest" "$compatibility_floor_commit" current "$compatibility_floor_marker"
  write_schema_epoch "$compatibility_floor_digest" "$compatibility_floor_commit" current "$compatibility_floor_marker"
fi
maybe_failpoint after_current_floor
compose up -d --no-deps "tunes-$candidate_slot"
ready=false
readiness_attempts=30
readiness_delay=2
if [[ "${MUSIC_DEPLOY_TEST_MODE:-0}" == 1 ]]; then
  readiness_attempts="${MUSIC_DEPLOY_TEST_READINESS_ATTEMPTS:-30}"
  [[ "$readiness_attempts" =~ ^[1-9][0-9]?$ ]] || fail "invalid test readiness attempts"
  readiness_delay=0
fi
for _attempt in $(seq 1 "$readiness_attempts"); do
  if compose exec -T "tunes-$candidate_slot" node -e \
    "fetch('http://127.0.0.1:5000/health/ready').then(async r=>{const b=await r.json();if(!r.ok||b.digest!=='$candidate_digest'||b.commit!=='$candidate_commit'||b.migrationMarker!=='$candidate_marker')process.exit(1)}).catch(()=>process.exit(1))"; then
    ready=true
    break
  fi
  sleep "$readiness_delay"
done
[[ "$ready" == true ]] || { compose stop "tunes-$candidate_slot"; fail "candidate readiness failed"; }

if [[ "$operation" == bootstrap ]]; then
  compose exec -T tunes-blue node --input-type=module <<'NODE'
import { io } from "socket.io-client";
const base = "http://127.0.0.1:5000";
const denials = [
  ["/api/auth/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ strapiUser: { username: "hostile" } }) }, 401],
  ["/graphql", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "mutation { deleteUsers { documentId } }" }) }, 410],
  ["/api/subscriptions/user-plans/hostile", {}, 401],
];
for (const [path, init, expected] of denials) {
  const response = await fetch(base + path, init);
  if (response.status !== expected) throw new Error(`${path} containment failure`);
}
await new Promise((resolve, reject) => {
  const socket = io(base, { path: "/ws", transports: ["websocket"], reconnection: false, timeout: 5000,
    extraHeaders: { Origin: "https://hostile.invalid" } });
  const timer = setTimeout(() => { socket.close(); reject(new Error("socket origin probe timed out")); }, 6000);
  socket.once("connect", () => { clearTimeout(timer); socket.close(); reject(new Error("hostile socket origin connected")); });
  socket.once("connect_error", () => { clearTimeout(timer); socket.close(); resolve(); });
});
NODE
fi

create_transaction() {
  [[ ! -e "$transaction_current" ]] || fail "unrecovered deployment transaction exists"
  local temporary="$transaction_dir/.current.$$"
  [[ ! -e "$temporary" ]] || fail "transaction temporary path already exists"
  ensure_private_directory "$temporary"
  cp -- "$route_file" "$temporary/route.backup"
  chmod 600 "$temporary/route.backup"
  local route_hash ledger_present=0 ledger_hash=ABSENT state_present=0 state_hash=ABSENT floor_present=0 floor_hash=ABSENT
  route_hash="$(sha256_file "$temporary/route.backup")"
  if [[ -e "$ledger_file" ]]; then require_regular_file "$ledger_file"; cp -- "$ledger_file" "$temporary/ledger.backup"; chmod 600 "$temporary/ledger.backup"; ledger_present=1; ledger_hash="$(sha256_file "$temporary/ledger.backup")"; fi
  if [[ -e "$state_file" ]]; then require_regular_file "$state_file"; cp -- "$state_file" "$temporary/state.backup"; chmod 600 "$temporary/state.backup"; state_present=1; state_hash="$(sha256_file "$temporary/state.backup")"; fi
  if [[ -e "$floor_file" ]]; then require_regular_file "$floor_file"; cp -- "$floor_file" "$temporary/floor.backup"; chmod 600 "$temporary/floor.backup"; floor_present=1; floor_hash="$(sha256_file "$temporary/floor.backup")"; fi
  local payload mac
  payload="$journal_schema"$'\t'"$operation"$'\t'"$candidate_slot"$'\t'"$candidate_digest"$'\t'"$candidate_commit"$'\t'"$route_hash"$'\t'"$ledger_present"$'\t'"$ledger_hash"$'\t'"$state_present"$'\t'"$state_hash"$'\t'"$floor_present"$'\t'"$floor_hash"
  mac="$(hmac "$journal_schema"$'\t'"$repository"$'\t'"$operation"$'\t'"$candidate_slot"$'\t'"$candidate_digest"$'\t'"$candidate_commit"$'\t'"$route_hash"$'\t'"$ledger_present"$'\t'"$ledger_hash"$'\t'"$state_present"$'\t'"$state_hash"$'\t'"$floor_present"$'\t'"$floor_hash")"
  printf '%s\t%s\n' "$payload" "$mac" > "$temporary/journal.tsv"
  for file in "$temporary"/*; do durable_file "$file"; done
  durable_directory "$temporary"
  mv -- "$temporary" "$transaction_current"
  durable_directory "$transaction_dir"
}

transaction_committing=""
abort_transaction() {
  local status="${1:-1}"
  trap - ERR
  set +e
  if [[ ! -e "$transaction_current" && -n "$transaction_committing" && -d "$transaction_committing" ]]; then
    mv -- "$transaction_committing" "$transaction_current"
    durable_directory "$transaction_dir"
  fi
  recover_transaction
  local recovery_status=$?
  compose stop "tunes-$candidate_slot" >/dev/null 2>&1
  if [[ "$recovery_status" -eq 0 ]]; then
    printf '%s\n' "deployment transaction aborted; exact prior authority restored" >&2
  else
    printf '%s\n' "deployment transaction recovery failed; journal retained" >&2
  fi
  exit "$status"
}

create_transaction
trap 'abort_transaction $?' ERR
maybe_failpoint after_journal

write_route "tunes-${candidate_slot}" true
maybe_failpoint after_route

public_body="$("$curl_command" --fail --silent --show-error --max-time 5 https://localtunes.earth/health/ready)"
expected_public_body="{\"ready\":true,\"digest\":\"$candidate_digest\",\"commit\":\"$candidate_commit\",\"migrationMarker\":\"$candidate_marker\"}"
if [[ "$public_body" != "$expected_public_body" ]]; then
  printf '%s\n' "public promotion metadata verification failed" >&2
  abort_transaction 1
fi

if [[ "$operation" == bootstrap ]]; then
  sequence=1
  previous_mac=GENESIS
  ledger_mac="$(hmac "$ledger_schema"$'\t'"$repository"$'\t'"$sequence"$'\t'"$candidate_digest"$'\t'"$candidate_commit"$'\t'"$candidate_marker"$'\t'"$previous_mac")"
  ledger_temporary="$ledger_file.next.$$"
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$ledger_schema" "$sequence" "$candidate_digest" "$candidate_commit" "$candidate_marker" "$previous_mac" "$ledger_mac" > "$ledger_temporary"
  atomic_replace "$ledger_temporary" "$ledger_file"
else
  if [[ -z "${ledger_seen[$candidate_digest]:-}" ]]; then
    sequence=$((${#ledger_digests[@]} + 1))
    previous_mac="$ledger_last_mac"
    ledger_mac="$(hmac "$ledger_schema"$'\t'"$repository"$'\t'"$sequence"$'\t'"$candidate_digest"$'\t'"$candidate_commit"$'\t'"$candidate_marker"$'\t'"$previous_mac")"
    ledger_temporary="$ledger_file.next.$$"
    cp -- "$ledger_file" "$ledger_temporary"
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$ledger_schema" "$sequence" "$candidate_digest" "$candidate_commit" "$candidate_marker" "$previous_mac" "$ledger_mac" >> "$ledger_temporary"
    atomic_replace "$ledger_temporary" "$ledger_file"
  fi
fi
maybe_failpoint after_ledger

if [[ "$operation" == bootstrap ]]; then
  floor_mac="$(hmac "$floor_schema"$'\t'"$repository"$'\t'"$candidate_digest"$'\t'"$candidate_commit")"
  floor_temporary="$floor_file.next.$$"
  printf '%s\t%s\t%s\t%s\n' "$floor_schema" "$candidate_digest" "$candidate_commit" "$floor_mac" > "$floor_temporary"
  atomic_replace "$floor_temporary" "$floor_file"
fi
maybe_failpoint after_floor

state_mac="$(hmac "$state_schema"$'\t'"$repository"$'\t'"$compose_project"$'\t'"$candidate_slot"$'\t'"$candidate_digest"$'\t'"$candidate_commit"$'\t'"$blue_digest"$'\t'"$blue_commit"$'\t'"$green_digest"$'\t'"$green_commit")"
state_temporary="$state_file.next.$$"
printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$state_schema" "$compose_project" "$candidate_slot" "$candidate_digest" "$candidate_commit" "$blue_digest" "$blue_commit" "$green_digest" "$green_commit" "$state_mac" > "$state_temporary"
atomic_replace "$state_temporary" "$state_file"
maybe_failpoint after_state

committed_transaction="$transaction_dir/committed-${candidate_digest#sha256:}-$$"
transaction_committing="$committed_transaction"
mv -- "$transaction_current" "$committed_transaction"
durable_directory "$transaction_dir"
trap - ERR
if [[ "$operation" == bootstrap ]]; then docker stop "$legacy_service" >/dev/null; fi
maybe_failpoint after_commit
cleanup_transaction_directory "$committed_transaction"
durable_directory "$transaction_dir"

printf 'active commit=%s digest=%s migration=%s slot=%s\n' "$candidate_commit" "$candidate_digest" "$candidate_marker" "$candidate_slot"
