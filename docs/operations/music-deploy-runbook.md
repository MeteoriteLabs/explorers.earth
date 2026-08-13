# Music immutable deployment runbook (C2)

## Authority and safety boundary

`.github/workflows/tunes.yml` is the only Tunes image build authority. It tests,
builds once, proves the gate entrypoint exists, scans that exact local image,
then pushes `ghcr.io/<repository-owner>/explorers-tunes:<full-commit>`. The
registry-reported `sha256` digest—not the tag—is passed to the sole deploy
authority, `.github/workflows/tunes-deploy.yml`.

`docker-compose.yml` is the sole production authority.
`docker-compose.music-test.yml` is the sole disposable authority.
`tunes/docker-compose.yml` is deliberately non-runnable and points to both.

Production deploy remains disabled while repository variable `GATE_PROD` is
anything other than `open`. This task does not authorize changing that value.
The deploy host needs a GitHub Packages credential in environment secret
`GHCR_DEPLOY_READ_TOKEN` with `read:packages` only, plus
`GHCR_DEPLOY_USER`. The workflow logs the host out on every exit.

## Transitional C2 gate (not a database migration)

The one-shot `tunes-gate` command runs from the exact candidate image, proves
database connectivity with `SELECT 1`, then creates an HMAC attestation bound
bijectively to image digest, source commit, and the literal marker
`containment-no-schema-change`. It writes no database/schema object. App startup
never creates the attestation and `connect-pg-simple` schema creation is off.

Readiness independently proves database connectivity, mandatory secrets,
production upstream configuration, and the exact signed attestation. Liveness
only proves that the process serves. C3 must replace this transitional gate with
the same-image journal-backed database migration runner and make readiness
require its exact migration ID. Do not extend the C2 marker into a migration
journal.

## One-time bootstrap (legacy `tunes` to private blue slot)

The permanent floor is the **first independently verified C2 immutable image**.
That image must contain C1 containment. C1's minimum included security commit is
recorded as provenance, not incorrectly treated as a C2 image revision:

```sh
MINIMUM_CONTAINMENT_COMMIT=d226f7e4dc5a54195a59804ec729f72b5e8f10d7
floor_image='<CI-output ghcr.io/owner/explorers-tunes@sha256:...>'
floor_digest="${floor_image##*@}"
floor_commit='<CI-output full source commit containing C2>'
test "$floor_image" = "${floor_image%@*}@$floor_digest"
```

The image CI checks `git merge-base --is-ancestor` against that minimum commit
before building; the host consumes the resulting commit/digest outputs and does
not require a source checkout.

The existing host has a legacy `tunes` service and Docker-provider router. Do
not query it for C2 labels or `/health/ready`; those did not exist. Do not stop
it. Install a higher-priority file-provider route to that exact still-serving
legacy container before enabling the provider. This makes the initial routing
choice unambiguous while blue remains private:

```sh
cd /opt/explorers
test ! -e deployment-state/music-state.env
test ! -e deployment-state/secure-images.tsv
test ! -e deployment-routing/music-router.yml
legacy_container="$(docker ps --filter label=com.docker.compose.service=tunes --format '{{.ID}}')"
test "$(printf '%s\n' "$legacy_container" | sed '/^$/d' | wc -l)" -eq 1
legacy_name="$(docker inspect --format '{{.Name}}' "$legacy_container" | sed 's#^/##')"
legacy_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$legacy_container")"
test -n "$legacy_project"
legacy_network="$(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$legacy_container" | grep proxy | head -1)"
test -n "$legacy_network"
install -d -m 700 deployment-state deployment-routing
route_tmp="deployment-routing/music-router.yml.tmp.$$"
cat > "$route_tmp" <<EOF
http:
  routers:
    tunes-cutover:
      rule: Host(\`localtunes.earth\`)
      priority: 200
      entryPoints: [websecure]
      tls: { certResolver: letsencrypt }
      service: tunes-active
  services:
    tunes-active:
      loadBalancer:
        servers: [{ url: http://${legacy_name}:5000 }]
EOF
mv -- "$route_tmp" deployment-routing/music-router.yml
```

Populate the required production environment and blue/green variables with the
floor image, then recreate **only Traefik** so the file provider is enabled.
Verify the legacy application still serves before starting blue:

```sh
set -a
. /opt/explorers/production.env
set +a
export TUNES_BLUE_IMAGE="$floor_image" TUNES_BLUE_DIGEST="$floor_digest" TUNES_BLUE_COMMIT="$floor_commit"
export TUNES_GREEN_IMAGE="$floor_image" TUNES_GREEN_DIGEST="$floor_digest" TUNES_GREEN_COMMIT="$floor_commit"
export TUNES_CANDIDATE_IMAGE="$floor_image" TUNES_CANDIDATE_DIGEST="$floor_digest" TUNES_CANDIDATE_COMMIT="$floor_commit"
compose() { docker compose -p "$legacy_project" --project-directory /opt/explorers -f /opt/explorers/docker-compose.yml "$@"; }
compose up -d --no-deps traefik
curl --fail --silent --show-error https://localtunes.earth/ >/dev/null
```

Pull and inspect the exact floor image, run its one-shot C2 gate, and start blue
without any Docker routing labels. Readiness is checked inside the private
container. Stop here on any failure; the higher-priority route still names the
legacy container.

```sh
docker pull "$floor_image"
docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$floor_image" | grep -Fx "$floor_image"
test "$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$floor_image")" = "$floor_commit"
compose --profile deployment run --rm --no-deps tunes-gate
compose up -d --no-deps tunes-blue
compose exec -T tunes-blue node -e "fetch('http://127.0.0.1:5000/health/ready').then(async r=>{const b=await r.json();if(!r.ok||b.digest!=='$floor_digest'||b.commit!=='$floor_commit'||b.migrationMarker!=='containment-no-schema-change')process.exit(1)}).catch(()=>process.exit(1))"
```

Run the read-only C1 REST, GraphQL, subscription, and socket-origin probes inside
blue while it is still private. Every request must be denied at the containment
boundary; a successful legacy operation or hostile socket connection aborts the
cutover:

```sh
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
  if (response.status !== expected) throw new Error(`${path} returned ${response.status}, expected ${expected}`);
}
await new Promise((resolve, reject) => {
  const socket = io(base, { path: "/ws", transports: ["websocket"], reconnection: false, timeout: 5000,
    extraHeaders: { Origin: "https://hostile.invalid" } });
  const timer = setTimeout(() => { socket.close(); reject(new Error("socket origin probe timed out")); }, 6000);
  socket.once("connect", () => { clearTimeout(timer); socket.close(); reject(new Error("hostile socket origin connected")); });
  socket.once("connect_error", () => { clearTimeout(timer); socket.close(); resolve(); });
});
NODE
```

Only after those probes pass, atomically point the already-higher-priority route
to blue and verify the exact digest publicly. If verification fails, atomically
restore the saved legacy route. Only after success initialize the ledger and
state; existing files are never overwritten.

```sh
cp -- deployment-routing/music-router.yml deployment-routing/music-router.legacy.yml
sed 's#url: http://[^:]*:5000#url: http://tunes-blue:5000#' deployment-routing/music-router.legacy.yml > deployment-routing/music-router.yml.tmp
mv -- deployment-routing/music-router.yml.tmp deployment-routing/music-router.yml
test "$(curl --fail --silent --show-error https://localtunes.earth/health/ready | jq -r .digest)" = "$floor_digest" || { mv -- deployment-routing/music-router.legacy.yml deployment-routing/music-router.yml; exit 1; }
rm -- deployment-routing/music-router.legacy.yml
printf '%s\t%s\t%s\t%s\n' "$floor_digest" "$floor_image" "$floor_commit" containment-no-schema-change > deployment-state/secure-images.tsv
cat > deployment-state/music-state.env <<EOF
COMPOSE_PROJECT_NAME=$legacy_project
ACTIVE_SLOT=blue
ACTIVE_IMAGE_REF=$floor_image
ACTIVE_DIGEST=$floor_digest
ACTIVE_COMMIT=$floor_commit
ROLLBACK_FLOOR_DIGEST=$floor_digest
TUNES_BLUE_IMAGE=$floor_image
TUNES_BLUE_DIGEST=$floor_digest
TUNES_BLUE_COMMIT=$floor_commit
TUNES_GREEN_IMAGE=$floor_image
TUNES_GREEN_DIGEST=$floor_digest
TUNES_GREEN_COMMIT=$floor_commit
EOF
chmod 600 deployment-state/* deployment-routing/*
docker stop "$legacy_container"
```

The verified C2 containment digest is permanent. Retain the stopped legacy
container only for forensics; it is below the rollback floor and is never a
rollback target. Never change `ROLLBACK_FLOOR_DIGEST`.
Rollback accepts only a retained digest at or after that ledger row and rejects
unknown or older images.

## Deploy, canary, rollback, and incidents

The production environment requires approval. A deploy pulls the exact digest,
runs the no-schema-change gate, starts the inactive slot privately, and polls
readiness. Only then does it replace the Traefik dynamic route with atomic
`mv`. The old slot remains healthy. If candidate readiness fails, the route is
untouched. If routed verification fails, the exact prior route is restored.

The server-owned controls default closed:

- `MUSIC_NEW_ENTRY_KILL_SWITCH=true` disables the new Music entry.
- `MUSIC_COHORT_ENABLED=true` limits enablement to the server cohort policy.
- Neither control can enable the legacy Music path; C1 containment stays active.

For rollback, dispatch `Tunes production deploy authority` with operation
`rollback` and an exact retained digest. For a suspected identity or ownership
incident, first set the server kill switch true, verify `/api/music-entry/status`
reports both the new and legacy entries disabled, then roll back only if the
target is at/above the containment floor. Status and container labels expose
commit, digest, migration marker, and slot.

## Rehearsal and outstanding external evidence

The deterministic Vitest state-machine and argv-command rehearsals prove gate,
readiness, and promotion failures retain or restore the exact prior digest
without contacting production. Before `GATE_PROD` may open, run a real Docker
rehearsal on an isolated host with the built GHCR image and capture:

- rendered Compose with no database port or default credentials;
- candidate inaccessible through the public route before readiness;
- forced gate and readiness failure with the exact prior digest still public;
- successful atomic promotion and exact-digest rollback;
- refusal of an unknown and pre-floor digest.

If the local Docker daemon is unavailable, record that as an external block.
Static/process tests are not a substitute for this runtime evidence.
