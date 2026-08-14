# Music immutable deployment and migration runbook (C2-C5)

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

Before `GATE_PROD` can open, repository administrators must configure the
`tunes-production` environment deployment branch policy to **protected branches only**
(`protected_branches=true`, `custom_branch_policies=false`), and main must be the sole protected branch.
GitHub then also refuses a tag or fork whose name matches protected `main`.
Administrators must independently confirm main is protected. The workflow's
no-environment preflight verifies all of those facts through the GitHub API
before the environment-bearing job is eligible. A
non-main dispatch fails in that preflight, and the deploy job also has a
job-level `refs/heads/main` condition evaluated before environment access. The
production credentials are environment-scoped only; repository- or
organization-scoped copies of those credentials are forbidden. The
YAML check is not the security boundary: a branch can edit its own YAML, while
the external environment policy cannot be bypassed by that branch copy.
`GATE_PROD must remain closed` if the API check is unavailable, the policy is
absent or different, or `main` is not protected.

## C3-C5 same-image migration gate

`0010_least_privilege_runtime_role` is the exact expected migration ID. The
C5 chain appends durable, exact-operation credential-revocation authority,
immutable revocation history, and the least-privilege runtime boundary
without changing the immutable user/selected-Account ownership tuple. Each
operation binds a lowercase UUIDv4, numeric Music resource, immutable Explorer
user/Account tuple, closed internal reason, and expected/result session version.
Only an exact replay is idempotent; another operation, reason, resource, or
version fails closed. The candidate
image contains the ordered SQL files and `run-migration-gate.js`; the one-shot
gate takes the PostgreSQL advisory lock, verifies the checksum journal and
catalog fingerprint, applies pending migrations transactionally, and writes an
HMAC attestation bound to digest, commit, migration ID, and the exact final
migration checksum. A checksum change, missing or future journal row, catalog
drift, unversioned application table, or partial migration fails before the
candidate can become ready. Application/session startup never creates schema.

Readiness independently proves connectivity, mandatory secrets, HTTPS upstream
configuration, exact same-image attestation, and the live journal ID/checksum.
Liveness remains process-only. The secure image ledger can retain historical
`containment-no-schema-change` entries for audit and the permanent security
floor, but they cease to be rollback targets as soon as the real C3 gate has
migrated the database. All new images use
`0010_least_privilege_runtime_role` and the
real migration gate. Because production catalog/row-count and restore evidence
are still absent, an existing unversioned database is a conflict: there is no
automatic baseline adoption, username/email matching, or authorized production
migration path. `GATE_PROD` remains closed.

Deletion replay is resource-bound at this schema epoch: finalized lifecycle and
tombstone history records the retired numeric `users.id` without a foreign key
to the removed row. A replay succeeds only for the exact numeric user ID and
operation ID pair. The ID column is immutable and the user sequence is
non-cycling. Every user insert and authorized deletion takes the same
external-user, selected-Account, then numeric-user advisory-lock order before a
row or unique-index lock; the insert trigger rechecks retired numeric IDs after
that serialization. Explicit IDs and a reset sequence therefore cannot race a
committing deletion or reuse a retired ID.

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
`music-schema-floor.tsv` is a second HMAC-authenticated authority with a
different purpose. Before the irreversible C3 gate is invoked, the executable
records the candidate digest/commit and exact marker as `pending`; the separate
authenticated `deployment-transactions/schema-epoch.tsv` recovery journal
records the same epoch. From `pending` onward every legacy-marker rollback is
refused before Docker, even if the gate or host dies. After the gate returns,
both authorities advance atomically to `current`. They are deliberately not
reverted if later readiness or promotion fails; the prior healthy app remains
the general route while every future rollback must use the exact current
migration marker. The gate-running digest need not have been promoted: this
authority records the conservative schema epoch and gate provenance, while
secure history remains the rollback allowlist. Missing, mismatched, malformed,
or tampered schema-epoch authority fails closed before Docker. Marker parsing
is versioned rather than coupled only to the newest image. The known ordered
authority is `containment-no-schema-change`, then migrations `0002` through
`0010`; authenticated historical rows remain byte-exact and valid, while an
unknown marker or decreasing ledger/epoch rank fails closed. The executable
conservatively adopts only two pre-epoch formats: a signed
state/ledger ending at `0002` with no compatibility file, or the exact historical
`music-schema-floor-v1` five-field HMAC record for `0003`. A missing `0003`
floor, an unsigned partial file, or any reinterpreted v1 field fails before
Docker. The candidate compatibility listener and exact-path denial route are
installed before either format is upgraded directly to pending `0010`.
For an upgrade, the higher signed epoch is written first and recovered only in that monotonic
direction, then the signed floor advances to `pending` before the gate. From
that point, older-marker rollback is rejected before Docker. Gate failure
retains the pending epoch and compatibility route so the exact candidate can
retry; success advances the same marker to `current`.
After signed ledger, permanent floor, and state validation, the schema floor
must be at least the maximum authenticated ledger marker before epoch recovery
may write. It may be higher for a pending gate whose image was not promoted,
but replaying older valid v1 or v2 floor/epoch bytes beside newer history fails
before Docker without changing any authority file. Because every state digest
and commit must resolve to the signed ledger, the ledger maximum also covers the
active state's marker. A missing schema floor remains valid only when every
ledger marker is containment or `0002`.
The checked-in `music-hmac.mjs` helper reads the mode-0600 HMAC key path directly
with Node's crypto API. Key bytes never enter a child-process argument, exported
environment variable, or log. Node 22 is therefore a deployment-control runtime
prerequisite on the host; it is not used to build application source there.

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
starts the same-candidate-image `tunes-register-compat` process without database
configuration and verifies its process-only liveness and shared typed 410; then
atomically adds the priority-1000 `POST` route for the complete Express-default
registration path family (ASCII case-insensitive `/api/register`, with at most
one trailing slash and query parsing kept separate) to that process while
leaving every other path on legacy. Extra path segments and double slashes are
not part of the denial route. Public omitted and forged registration probes
must return the bounded, non-reflecting typed 410. Only then
does it persist the pending schema epoch and run the same-image gate. It then
starts blue privately; checks readiness; runs the C1
REST, GraphQL, subscription, and hostile Socket.IO origin probes; creates the
durable transaction; atomically routes blue; verifies exact public
digest/commit/marker; writes the authenticated manifest, permanent floor, and
state; commits the journal; and only then stops the retained legacy container.
The registry config and token are cleaned on exit. The exact-path denial remains
installed through promotion, gate/readiness failure, and reboot; recovery must
never restore route bytes that remove it after the schema epoch is pending.

The compatibility listener accepts at most 8 KiB whether a body has a declared
length or uses chunked transfer, returns the shared typed 413 on excess, and
enforces two-second header/request timeouts, a one-second keep-alive timeout,
32 headers, and 128 concurrent sockets. Traefik additionally applies a
four-request-per-second rate limiter with burst four. Its `sourceCriterion` is
deliberately omitted: Traefik's default criterion is the direct remote address,
so caller-supplied `X-Forwarded-For` values cannot create new buckets.

## C4 identity gateway startup and admission controls

Tunes has one discriminated bootstrap before importing the application graph,
registering routes, or listening. `fixture` mode first enforces the complete
C0 fixture contract and then the bounded identity controls. `live` mode does
not require fixture database, signing, provisioning, or reconciliation values;
it invokes the asynchronous C4 validator exactly once. Live mode accepts only
the exact allowlisted HTTPS
`STRAPI_URL` origin. It rejects credentials, paths, queries, fragments, and any
DNS answer that is private, loopback, link-local, documentation, multicast, or
otherwise non-public. The gateway then pins the validated address set in its
HTTPS lookup while retaining the declared hostname for TLS, so a later DNS
answer cannot redirect a request. Fixture mode accepts only its separately
declared exact `MUSIC_FIXTURE_STRAPI_ORIGIN` and does not perform live DNS.

Production uses one exact proxy peer, not a caller-controlled hop count. Compose
assigns Traefik `${TRAEFIK_PROXY_IP:-172.31.250.2}` inside
`${TRAEFIK_PROXY_SUBNET:-172.31.250.0/24}` and gives Tunes the same value as
`MUSIC_TRUSTED_PROXY_IP`. Operators must choose a dedicated non-conflicting
subnet before first deployment and must change the subnet and peer IP together.
Tunes honors `X-Forwarded-For` only when the direct socket peer equals that IP;
otherwise the socket address is the rate-limit source. Do not expose a Tunes
port directly or add another proxy without updating and rehearsing this exact
peer contract.

All concurrency, queue, deadline, retry, cache, circuit, rate, and cardinality
settings are bounded integers with cross-field validation. Startup fails before
listen when a value is missing, malformed, non-finite, out of range, or when a
queue/deadline relationship is unsafe. `429` and `503` always carry a bounded
integer `Retry-After`, and every documented response carries `X-Request-Id`.
Admission reserves source and fingerprint capacity before the global tier.
Local refusal consumes no global token; global refusal atomically rolls back
the local reservations, including newly created cardinality entries.

Administrative deletion is one identity saga. If the row is already
`pending_deletion`, storage reuses its locked operation ID; a caller-supplied
different ID fails with `LIFECYCLE_OPERATION_CONFLICT` before child cleanup. An
active administrative delete generates a cryptographically random operation
ID, returns it to the caller, and records it through the database primitive.
Retrying a finalized deletion with that exact ID is idempotent.

## C5 database authority cutover

Production uses two independent, canonical-base64url credential files owned by
root and mode `0600`: one for the existing database owner/migrator login and one
for the application runtime login. `DB_MIGRATOR_USER` must be the role that owns
the database and `public` schema and can create roles. `DB_RUNTIME_USER` must be
a distinct safe role name; it must not already have superuser, database-create,
role-create, replication, bypass-RLS, object ownership, or membership in any
owner/migrator role. Never put either password in an environment variable,
connection-string file, Compose value, command argument, image, or log.

Migration `0010` creates the fixed `music_runtime` capability as `NOLOGIN`,
grants current DML/sequence/function access, revokes migration-journal writes
and revocation-history update/delete, enables the history trigger `ALWAYS`, and
sets explicit default privileges for objects created by subsequent migrations.
The one-shot candidate gate mounts both files only for this bounded step. It
authenticates as the migrator, validates owner and role-bootstrap authority,
and, before migration, rejects any pre-existing `music_runtime` capability
whose attributes are unsafe or which is itself a member of another role.
It then applies the chain, provisions/rotates the separate restricted `LOGIN` through a
parameterized security-definer function, connects as that login, and executes
the hostile privilege attestation. The attestation must prove the runtime login
cannot set `session_replication_role`, write the migration journal, update or
delete revocation history, alter/drop its trigger, replace its function, own an
application object, or inherit any role except `music_runtime`. It recursively
checks both the login and capability membership closures twice, rejects cycles
or any direct/transitive role beyond the one login-to-capability edge, and
executes the allowed capability `SET ROLE` plus a denied migrator-role attempt
on the real runtime session. Any role-graph change between snapshots fails
closed. The migration attestation file is written only after those checks
succeed.

The Tunes application mounts only the runtime credential and independently
authenticates and checks the restricted role before importing routes or binding
a listener. It never mounts or reads the migrator credential. The database
container and gate mount the migrator credential; only the gate additionally
mounts the runtime credential. For an existing environment, keep `GATE_PROD`
closed until an operator has backed up the database, confirmed the configured
migrator is the actual database/schema owner with role-create authority, and
confirmed that an existing proposed runtime role is either absent or already
has exactly the safe attributes above. Missing files, legacy inline
`DATABASE_URL`/password values, ownership mismatch, unsafe membership, failed
runtime authentication, or any hostile-attestation success is a hard preflight
failure before promotion.

Disposable bootstrap writes each secret-bearing environment as a fresh,
cryptographically named, exclusive/no-follow mode-0600 generation under
`.artifacts/music-environment-generations/`. It validates and fsyncs that exact
descriptor before atomically publishing `.env.music.test`, which is only a
non-secret versioned reference containing the generation name, byte count, and
SHA-256 digest. The generation leaf is never renamed into a fixed pathname.

Every fixture command holds and validates the reference and generation
descriptors, parses the environment in memory, and passes the variables only in
the child process environment. Docker Compose is never given `--env-file`, so
it cannot reopen a secret pathname after validation. A reference or generation
race fails closed. A raw or malformed legacy `.env.music.test` is never parsed
as migration authority and is never auto-converted. Bootstrap fails before
creating credentials, generations, journals, or a new pointer with
`MUSIC_FIXTURE_LEGACY_ENVIRONMENT_UNSUPPORTED` and secret-free recovery
guidance.

Because this is disposable fixture state, recovery is an explicit guarded
cleanup/re-bootstrap rather than a compatibility migration:

```powershell
npm run music:bootstrap -- --mode fixture --confirm-project explorers-music-fixture
```

That path first verifies the repository/root ownership boundary, the exact
fixture project confirmation, and the absence of a non-empty pending rotation
journal. Before erasing anything it durably publishes a non-secret cleanup
intent bound to the captured repository root and artifact-directory identities.
It descriptor-zeroes recognized fixture-owned generated leaves without
interpreting variables, erases the unsupported raw pointer last, proves no old
nonzero fixture artifact remains, and erases the intent only after all verified
descriptors close successfully. A wrong project, linked or unowned path,
pending journal or cleanup intent, cleanup failure, or concurrent identity
change fails closed. The ordinary unconfirmed bootstrap remains read-only on
raw authority, and rotation refuses a pending cleanup intent before creating a
candidate.

Bootstrap rotates one four-resource authority bundle: the environment
generation, Music signing-key leaf, migrator-password leaf, and runtime-password
leaf. It snapshots the exact prior directory/file identities, sizes, and
SHA-256 digests before creating replacements. Candidate names, expected byte
counts/digests, operation-bound role/name grammar, and the operation ID are
chosen first. A non-secret v3 intent journal is durably published before the
first candidate secret is created. Candidate and prior paths must be unique and
disjoint, and the journal's prior pointer and both environment-to-credential
graphs must match their exact captured authority; recovery rejects a replay,
redirected path, duplicate, or incomplete graph without mutation.

Each candidate starts as an exclusive zero-byte leaf. Its directory and file
device/inode are durably journaled before secret bytes are written through the
same open descriptor. A later atomic journal phase records the verified final
size and SHA-256 only after file sync and close. Thus a hard exit during any
write is recoverable by exact journal-bound inode; a name, size, or attacker-
supplied digest alone never authorizes erasure. The journal contains metadata
and hashes only, never raw environment or credential bytes.

Immediately before the pointer rename and during recovery, all four candidates
are reopened and matched against their recorded directory/file identities,
sizes, and SHA-256 digests. The pointer rename remains provisional until its
parent directory is synced and the candidate bundle is revalidated. Until that
exact commit is durable, failure erases only matching new unreferenced leaves
and leaves the prior pointer and four resources byte-exact. After that switch,
no error path may erase the new set. Prior resources are retired only when
their captured identities and digests still match; mismatch is a typed cleanup
failure that leaves both attacker and displaced bytes untouched.
On POSIX, durable metadata publication is file fsync, atomic rename, and parent
directory fsync. Windows does not treat directory fsync as available; the
checked-in bounded helper validates native file and parent identities and
renames the verified source handle before its write-through metadata barrier.
It receives paths and identity metadata only, never secret values. Windows
cannot simultaneously keep an existing destination handle non-delete-shared
and replace that destination (the actual host returns sharing violation 32),
while delete sharing permits a child-entry swap. POSIX pathname rename has the
analogous final close-to-commit race. Raw legacy conversion was therefore
removed instead of weakening this contract or pretending a final recheck could
recover overwritten bytes. Normal versioned pointer/generation rotation is
unchanged. Descriptor truncation plus file fsync remains the durability barrier
for retirement because it does not change directory metadata.

Bootstrap/down/reset reconcile any pending journal before other cleanup, so a
restart deterministically retires the old set after commit or the candidate set
before commit. Successful retirement leaves zero-byte tombstones and zeroes the
non-secret journal.

Bootstrap/down/reset cleanup never pathname-unlinks an artifact: it
truncates and durably syncs only a verified descriptor. A truncate, sync, close,
or digest failure makes the command nonzero with
`MUSIC_FIXTURE_SECRET_CLEANUP_FAILED` and only the exact random leaf identifier.
Each destructive open is checked beneath the originally authorized native
root/ancestor/directory graph; a directory replacement aborts before touching
the replacement tree. Retry the same guarded fixture cleanup after correcting
the filesystem error; the durable intent resumes artifacts-first/pointer-last
cleanup and success leaves zero-byte non-secret tombstones. Never delete the
reported path by hand or broaden cleanup outside the fixture project.

## C5 local Music credential keys and emergency revocation

Tunes exchanges a successful bodyless Strapi-backed identity ensure for an
HS256 Music credential with a fixed ten-minute lifetime. The current key must
be at least 32 random bytes and must be generated by an approved secret manager
or CSPRNG. Store only its base64url value in the mode-0600 host file
`${MUSIC_TOKEN_SECRET_DIRECTORY_HOST}/current`; Compose mounts that directory
read-only and exposes only `/run/secrets/music-token/current` to Tunes. Set the
explicit non-secret `MUSIC_TOKEN_CURRENT_KID` in `production.env`. Never place
the secret in `production.env`, a Compose value, an image/build argument,
command line, deployment bundle, log, status endpoint, or operator evidence.

Rotation is verifier-first and bounded:

1. Retain the old secret as `${MUSIC_TOKEN_SECRET_DIRECTORY_HOST}/previous`.
2. Generate a new `current` secret and distinct key ID. Set
   `MUSIC_TOKEN_PREVIOUS_KID`,
   `MUSIC_TOKEN_PREVIOUS_SECRET_FILE=/run/secrets/music-token/previous`, and an
   exact UTC-millisecond `MUSIC_TOKEN_PREVIOUS_ACCEPT_UNTIL` no later than 630
   seconds after activation (600-second token lifetime plus at most 30 seconds
   configured skew).
3. Deploy the verifier with both keys. Confirm ensure signs only with the new
   current ID and HTTP/socket contexts signed by the previous key work strictly
   before the cutoff.
4. After the cutoff, remove the previous variables and securely retire the old
   file. At and after the instant, the previous key fails closed.

Rollback is compatible only with an image whose configured verifier includes
the keys needed by still-live credentials. During overlap, retain an image that
knows both current and previous. After the old key cutoff, do not roll back to
an image that signs with or accepts only the retired key. This key compatibility
rule is additional to the authenticated image/security/schema floors.

For a user-scoped incident, use the server-side revoke-all primitive with the
exact observed `sessionVersion`; retrying the same expected version is
idempotent. Logout-all, entitlement security revocation, and credential
compromise each increment it atomically. Suspension and pending deletion retain
the same coupling from C3. Every HTTP request and sensitive socket-event helper
rechecks current local status, either immutable tombstone, and session version,
so the old credential stops immediately without a Strapi call. Task 5 does not
register the contained legacy owner socket events; Task 6 performs that wiring.

The Explorer credential store is module-memory only. A reload loses it and
logout clears it. During a Strapi outage, an unexpired Music credential may
continue local protected reads. Once expired, failed refresh becomes typed
authorization-unavailable; no unsafe mutation is replayed.

At every provider transition exactly one `.yml`/`.yaml` file is visible in
`deployment-routing`. Once the durable journal exists, an armed error handler
restores exact route/ledger/state/floor bytes and stops the candidate for any
ordinary command, transport, HTTP, or response-validation failure. It emits only
a fixed typed failure and never the untrusted public response body. The handler
is disarmed only after the commit rename and directory sync. A kill or host crash
leaves the durable journal for mandatory next-run recovery.

## Normal deploy, rollback, and incident controls

Normal deployment is possible only through the internal reusable call from the
image CI. It pulls the canonical attested digest, recovers any transaction,
validates every authority file, selects the non-public slot, gates/readies it,
and atomically promotes it. Manual workflow dispatch is only:

```text
target_digest=sha256:<digest already present in authenticated secure manifest>
```

Rollback rejects unknown digests, anything before the separately authenticated
permanent security floor, and—once the schema gate has run—every image without
the exact current schema marker. OCI source/revision/minimum-containment checks
still apply.

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
owners, OCI mismatches, journal/state/security-floor/schema-floor tamper, an old
C2 image against the C3 schema, and duplicate/malformed/
truncated/reordered manifests.

Before `GATE_PROD` can open, retain output from the disposable real-Docker
rehearsal showing:

- no database host port or default credential in rendered Compose;
- the candidate remains private before readiness;
- gate/readiness failures retain the exact previous general-service target and
  the persistent higher-priority registration denial;
- labels and readiness match commit/digest/marker;
- atomic promotion and exact rollback work;
- unknown and pre-floor rollback are refused;
- disposable volumes are removed only after label verification.

No static or fake-process result substitutes for this runtime evidence.
