# Music immutable deployment runbook (C2)

## Authority and closed production gate

`.github/workflows/tunes.yml` is the only Tunes image build authority. It tests,
builds once, scans the exact image, pushes only the full-commit tag to the
canonical `ghcr.io/<repository-owner>/explorers-tunes` package, publishes GitHub
build provenance for the resolved digest, and calls
`.github/workflows/tunes-deploy.yml`. Manual dispatch is rollback-only and
accepts only a retained digest; it cannot deploy a new image or select a package,
owner, or commit.

The reusable workflow verifies GitHub provenance before a normal deploy. The
checked-in `tunes/deployment/music-deploy.sh` executable then verifies the pulled
RepoDigest and the OCI source, revision, and minimum-containment labels. The
workflow sends a base64 bundle to a fixed SSH command. No caller-controlled
string is placed in remote command text.

`docker-compose.yml` is the sole production authority,
`docker-compose.music-test.yml` is the sole disposable authority, and
`tunes/docker-compose.yml` is intentionally non-runnable. `GATE_PROD` remains
closed until external rehearsal evidence and production approval exist. This
task does not authorize opening it or running any production command below.

## Transitional C2 gate

`containment-no-schema-change` is a transitional deployment gate, not a database
migration. The one-shot job uses the exact candidate image, proves PostgreSQL
connectivity with `SELECT 1`, and creates an HMAC attestation bound to digest,
commit, the literal marker, and `schemaChanged=false`. Application startup does
not create it and session startup cannot create schema. Readiness independently
proves DB connectivity, mandatory secrets, HTTPS upstream configuration, and the
exact attestation. Liveness is process-only. C3 replaces this mechanism with a
journal-backed database migration ID.

## Transaction and rollback authority

The checked-in executable is the only bootstrap, deploy, and rollback engine.
Before a route change it durably creates
`/opt/explorers/deployment-transactions/current`. Its HMAC-authenticated journal
binds the candidate and hashes byte-exact backups of the route, ledger, state,
and permanent floor. Backups are outside Traefik's watched directory. The
executable fsyncs and atomically replaces each file, and retains the backup until
route verification, ledger, floor, and state are committed. Every invocation
recovers an incomplete journal before validating state or selecting a slot.

State is strict TSV data and is never sourced as shell. The append-only secure
manifest has explicit sequence numbers, previous-entry MACs, and row MACs. The
executable rejects symlinks, wrong production ownership/mode, malformed or
truncated records, duplicates, reordered rows, chain failures, state/ledger
mismatches, and floor changes. `music-floor.tsv` is a separately authenticated
authority and must equal the first manifest entry. Its first digest is permanent.

## One-time legacy-to-blue bootstrap

The rollback floor is the first independently verified C2 image containing C1.
`d226f7e4dc5a54195a59804ec729f72b5e8f10d7` is only the minimum contained
security provenance, not an image revision. CI proves it is an ancestor and the
image carries the corresponding immutable label.

On an authorized operator machine, first verify the first C2 image and observe
the existing legacy service without asking it for C2 endpoints or labels:

```sh
set -euo pipefail
owner='<lowercase repository owner>'
repository="ghcr.io/${owner}/explorers-tunes"
github_repository='<owner>/<repo>'
source_repository="https://github.com/${github_repository}"
floor_digest='sha256:<CI output>'
floor_commit='<full CI commit>'
floor_image="${repository}@${floor_digest}"
gh attestation verify "$floor_image" --repo "$github_repository"

cd /opt/explorers
legacy_container="$(docker ps --filter label=com.docker.compose.service=tunes --format '{{.ID}}')"
test "$(printf '%s\n' "$legacy_container" | sed '/^$/d' | wc -l)" -eq 1
legacy_service="$(docker inspect --format '{{.Name}}' "$legacy_container" | sed 's#^/##')"
legacy_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$legacy_container")"
test -n "$legacy_service" && test -n "$legacy_project"
```

Obtain the `read:packages`-only GHCR credential and the independent deployment
state HMAC key through the approved secret channel. Do not put either in shell
history. In a mode-0700 temporary directory create four mode-0600 files:

```text
request.txt:
  music-deploy-request-v2
  operation=bootstrap
  digest=sha256:<CI output>
  commit=<full CI commit>
  compose_project=<observed legacy Compose project>
  legacy_service=<observed legacy container name>

authority.txt:
  music-deploy-authority-v1
  repository=ghcr.io/<lowercase owner>/explorers-tunes
  source=https://github.com/<owner>/<repo>
  ghcr_user=<read-packages identity>

hmac.key:    <independent deployment-state HMAC secret>
ghcr.token:  <read:packages-only token>
```

Run the exact checked-in release executable from the repository checkout:

```sh
MUSIC_DEPLOY_REQUEST_FILE="$bundle/request.txt" \
MUSIC_DEPLOY_AUTHORITY_FILE="$bundle/authority.txt" \
MUSIC_DEPLOY_HMAC_KEY_FILE="$bundle/hmac.key" \
MUSIC_DEPLOY_GHCR_TOKEN_FILE="$bundle/ghcr.token" \
bash tunes/deployment/music-deploy.sh
```

The executable performs the complete transition: it atomically installs the
priority-200 file route to the still-serving observed legacy service; recreates
only Traefik under the observed Compose project; logs into GHCR with an isolated
temporary Docker config; pulls and verifies the canonical digest and OCI labels;
runs the same-image gate; starts blue privately; checks readiness; runs the C1
REST, GraphQL, subscription, and hostile Socket.IO origin probes; creates the
durable transaction; atomically routes blue; verifies exact public
digest/commit/marker; writes the authenticated manifest, permanent floor, and
state; commits the journal; and only then stops the retained legacy container.
The registry config and token are cleaned on exit.

At every provider transition exactly one `.yml`/`.yaml` file is visible in
`deployment-routing`. A normal failure restores the exact legacy bytes. A kill
or host crash leaves the durable journal for mandatory next-run recovery.

## Normal deploy, rollback, and incident controls

Normal deployment is possible only through the internal reusable call from the
image CI. It pulls the canonical attested digest, recovers any transaction,
validates every authority file, selects the non-public slot, gates/readies it,
and atomically promotes it. Manual workflow dispatch is only:

```text
target_digest=sha256:<digest already present in authenticated secure manifest>
```

Rollback rejects unknown digests and anything before the separately authenticated
permanent floor. OCI source/revision/minimum-containment checks still apply.

The server controls default closed:

- `MUSIC_NEW_ENTRY_KILL_SWITCH=true` disables the new Music entry.
- `MUSIC_COHORT_ENABLED=true` narrows enablement to the server cohort.
- Neither can re-enable the legacy Music entry; C1 containment remains active.

For an identity or ownership incident, set the server kill switch, verify
`/api/music-entry/status` reports both new and legacy entries disabled, and then
use only an allowed retained digest if rollback is necessary.

## Rehearsal evidence required before GATE_PROD

The exact executable process suite injects crashes after journal creation,
route replacement, manifest write, floor write, state write, and durable commit;
the next invocation must recover before its first Docker action and never replace
the currently public slot. It also covers raw metacharacters/newlines, arbitrary
owners, OCI mismatches, journal/state/floor tamper, and duplicate/malformed/
truncated/reordered manifests.

Before `GATE_PROD` can open, retain output from the disposable real-Docker
rehearsal showing:

- no database host port or default credential in rendered Compose;
- the candidate remains private before readiness;
- gate/readiness failures retain the exact previous route;
- labels and readiness match commit/digest/marker;
- atomic promotion and exact rollback work;
- unknown and pre-floor rollback are refused;
- disposable volumes are removed only after label verification.

No static or fake-process result substitutes for this runtime evidence.
