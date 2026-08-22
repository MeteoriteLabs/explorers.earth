# Task 10 report — identity security and recovery qualification

## Outcome: implemented; independent approval pending

The user explicitly authorized the bounded deployment-authority refactor that
resolved the last C10 blocker. The immutable transactional state machine is now
shared by a GHCR-only production wrapper and a separately gated loopback-only
fixture wrapper. A real Docker local-OCI/PG15/Traefik rehearsal runs the shared
engine through migration and readiness failures, exact-digest rollback,
unknown/pre-floor rollback refusal, kill-switch verification, and guarded
cleanup. It emits the bounded `music-operation/v1` evidence required by the
release lane; no fake Docker result is accepted as that evidence.

No schema, migration, historical marker, production service, external
registry, `GATE_PROD`, Task 11, or Task 12 was changed or invoked. No image was
pushed outside the disposable loopback registry and no deployment occurred.
Task 10 is not approved; a separate independent reviewer must accept the final
exact-commit evidence.

## Delivered qualification

- One portable C0 execution path exposes fast/PR/nightly/release lanes with
  hard 3/15/45/60-minute wall-clock budgets. PR inherits fast; nightly and
  release inherit PR. Owned child processes receive at most one diagnostic
  rerun, and a green diagnostic never erases the original red result.
- Reports bind commit plus environment fingerprint, accept only successful
  exact-authority historical measurements, publish cross-run p50/p95, and fail
  closed on missing bootstrap/doctor/smoke/load/interrupt/recovery/compatibility
  evidence. Release refuses a dirty source tree.
- Public JSON/human envelopes use repository-relative paths. Child launch
  failures cite portable artifact paths. Structured and exact generated
  authorities are redacted, including bare secrets and full token68 bearer
  values. Unsupported raw/malformed fixture authority still writes no artifact
  or checkpoint.
- Tunes and Explorer have unchanged 100%-per-file thresholds covering the C4/C5
  gateway, projection, token, principal, route, credential-store, and API-client
  seams. The 1,425-line PostgreSQL identity repository has a separate real-PG
  100%-per-file gate.
- Executable matrices cover migrations, repositories, concurrent first ensure,
  cached identity and owner reads, lifecycle/reconciliation/owner predicates,
  REST/GraphQL/socket hostile roles, Google/email eligibility, account and
  sharing lifecycles, refresh/replay, rename, browser exit, upstream outage,
  socket/guest concurrency, chaos/recovery, compatibility containment, and
  secure kill-switch/floor contracts.
- Accessibility exercises initial and open-dialog axe audits, keyboard-only
  selection/save, focus restoration, state/toast/request assertions, and 44px
  targets at 375px and desktop. The discovered focus-scale defect was corrected
  without changing layout semantics.
- The built fixture uses reserved HTTPS authority
  `https://music-fixture.invalid`; Playwright forwards only that authority's
  original method, headers, body, path, and query to real loopback Tunes and
  fulfills with the real response. Production clients and the production bundle
  scan remain HTTPS-only. This proves Explorer → Tunes → fixture Strapi → PG,
  but deliberately does not claim TLS/DNS qualification.
- The release evidence template is sanitized and explicitly grants no
  deployment authority.

## RED → GREEN highlights

- C4/C5 RED: identity routes were 50.55/45.74/46.15/48.75%, Explorer credential
  store/API client 88.35/83.62/100/92.74%, and the real-PG identity repository
  82.50/81.15/76.11/86.15%. Added tests made each exact gate 100%.
- Browser refresh RED: both attempts replayed the same bearer and the renewed
  credential was absent. GREEN uses distinct old/new credentials, makes stale
  replay fail, and asserts the retry's exact bearer. Rename now asserts its exact
  Music bearer, idempotency key, body, and absence of `X-Username`.
- Accessibility RED found `button:focus-visible { transform: scale(0.98) }`
  shrinking a focused 44px sharing button to 43.12px. GREEN retains 44px at both
  required viewports after the complete keyboard save.
- Clean fixture RED first caught a fixture cleartext URL/bundle conflict. The
  secure fix retained the production HTTPS contract and uses the reserved-HTTPS
  Playwright transport described above. A later Docker `npm ci` registry
  `ECONNRESET` was preserved; its sole diagnostic rerun succeeded.
- Portable-envelope RED exposed an absolute child-log path. GREEN emits the
  repository-relative path. The later full Tunes gate caught two regressions:
  legacy-authority refusal had begun writing evidence, and old tests resolved
  portable paths from `tunes/`. GREEN restored zero mutation and resolves public
  paths from the repository root (CLI contract 52/52).

## Verification evidence

- Tunes critical coverage: 24 files, 519 passed and 1 skipped; 100% statements,
  branches, functions, and lines (`1751/1751`, `1579/1579`, `265/265`,
  `1528/1528`).
- Explorer critical coverage: 14 files, 220 passed; 100% (`534/534`, `495/495`,
  `117/117`, `442/442`).
- Real-PG identity repository coverage: 9 files, 120 passed; 100% (`606/606`,
  `483/483`, `67/67`, `556/556`) in 30.37s. The labeled standalone PG15 was
  stopped and removed.
- Broad standalone PG15: 10 files, 119 passed. The 50-query/four-connection load
  measured p50 86.20ms and p95 140.94ms. Socket/guest load exercised 12 owner and
  24 guest admissions, 16 accepted plus 8 rate-limited guest requests, 192 owner
  deliveries, and 288 guest player-state deliveries.
- Qualification/clean-bootstrap/release contracts: 28/28. CLI output contract:
  52/52 focused. Scoped Tunes types and exact baseline passed (`170 current`,
  `75 resolved`, compiler exit 2). Tunes and Explorer production builds passed;
  Explorer reported `HTTPS-only`.
- Explorer full unit: 120 files, 964 passed. The safely decomposed Tunes gate is
  65 non-CLI files/1079 passed plus 2 skipped and the isolated CLI contract
  52/52. See the deviation below for why the concurrent aggregate is not an
  authority-safe command in this source worktree.
- Mocked Chromium identity/account matrix: 9/9; accessibility: 2/2; complete
  Music/account lifecycle smoke: 30/30. Scoped Explorer TypeScript passed.
- Clean detached base `964d728...` plus the applied Task 10 snapshot: portable
  bootstrap/doctor passed; first startup failed at the now-fixed transport
  contract (47.657s); the next build reached Explorer but preserved a Tunes npm
  `ECONNRESET` failure (190.407s); one diagnostic rerun passed in 38.012s. The
  final reserved-HTTPS rebuild passed in 60.533s. Cold/warm smoke passed in
  701ms/661ms.
- The clean fixture contained five correctly labeled services: PostgreSQL,
  Strapi, Tunes, and Explorer healthy; `tunes-migrate` exited 0. Built-service
  Chromium passed 1/1 against the real service chain.
- Real runtime recovery emitted
  `music-real-docker-evidence/v1`: 5 containers, 4 healthy services, migration
  exit 0, one stable identity row, owner predicate verified, outage observed,
  recovery verified, and compatibility-route usage 0. Actual C0 signal handling
  emitted `music-operation/v1` with interrupt cleanup and resume verified.
- Dirty-source release proof blocked in 62ms at
  `qualification-source-authority`; no lane task or deployment ran.
- Guarded teardown removed exact fixture containers/networks/volumes/listeners
  (`0/0/0/0`). The generated proof pointer was a zero-byte non-authority
  tombstone. The disposable path is removed after this report is written.
- Final staged/working diff checks passed. Independent review found no Critical
  or Important issue other than the explicit frozen deployment-authority
  blocker, including after the reserved-HTTPS real-service delta.
- Evidence suppression is an explicit no-mutation result flag set only by the
  two preflight unsupported-authority refusals. A post-action authority failure
  still persists its checkpoint/command result (contract RED then 24/24 GREEN;
  existing post-action replacement proof 1/1).

## Authority-test deviation

The final attempt to rerun the inherited full Tunes non-deployment aggregate
invoked `music-cli-contract.test.ts`. Its existing `beforeAll` internally reads,
normalizes, and may rotate repository `.env.music.test`; running it concurrently
with other authority tests is incompatible with the instruction to preserve the
active ignored authority. I did not directly open or repair that file, stopped
using the aggregate after the behavior became evident, and reported the event
immediately. The test helpers snapshot and restore prior bytes, and the final
failure classified the authority as the original unsupported/raw form, but
exact byte preservation cannot be independently proven without the forbidden
read. All Task 10 fixture/PG evidence used disposable authority instead.

## Authorized protected deployment refactor design

The user explicitly authorized the previously blocked protected refactor on
2026-08-21. The bounded design preserves the existing deployment state machine,
authenticated ledger/journal, immutable migration markers, readiness/promotion
checks, transaction recovery, and permanent/schema rollback floors as one
registry-agnostic engine. Registry admission is split into mutually exclusive
policy wrappers:

- `music-deploy.sh` remains the production entrypoint. It accepts only the
  existing GHCR authority schema, canonical `ghcr.io/<owner>/explorers-tunes`
  repository, GitHub OCI source, explicit deploy user, and secure token file.
  It performs isolated authentication and exact digest/provenance materialization
  before the shared engine can run. Fixture mode/local repositories fail closed.
- A fixture-only wrapper accepts no GHCR authority, token, user, or ambient
  repository fallback. It requires fixture mode, an exact acknowledgement, a
  loopback-only `127.0.0.1:<port>` registry, an exact disposable Compose project,
  a private marked fixture root, and fixture-labeled Compose services. Its
  isolated Docker config may pull only the exact local OCI digest. The wrapper
  is unusable in default/production mode and cannot address an external
  registry, production root/project, or `GATE_PROD`.
- Both wrappers source the same non-directly-executable engine. The engine
  requires a recognized policy hook, validates the exact digest and the common
  OCI revision/source/containment provenance, then performs the existing real
  migration gate, readiness, promotion, rollback, kill-switch/floor, and crash
  recovery operations unchanged.

Tests must first prove the frozen production executable cannot admit a local
exact image, the new fixture entrypoint is absent, and production still rejects
local/non-GHCR authority. GREEN requires executable/static security contracts
plus a labeled disposable real-Docker local-registry rehearsal. The rehearsal
may transfer images only to its loopback registry; it must not contact or push
to an external registry, production, or `GATE_PROD`. Evidence is bounded,
authority-bound, and secret/path sanitized.

## Protected refactor RED/GREEN and runtime evidence

- Protected RED:
  `npm exec -- vitest run server/test/deployment/music-deploy-executable.test.ts -t "keeps the production entrypoint|fails the fixture entrypoint" --reporter=verbose`
  failed 2/2: the frozen production wrapper rejected the loopback exact image
  and the required fixture entrypoint did not exist.
- Minimal seam GREEN: the same focused command passed 2/2 after the wrappers
  were split around `music-deploy-engine.sh`. Production retains the canonical
  GHCR regex, GitHub OCI source, secure read-token file, isolated Docker config,
  exact RepoDigest/revision/source/containment verification, authenticated
  state, recovery, and rollback floors. Direct engine execution, absent fixture
  acknowledgement, and non-loopback fixture registries fail before Docker.
- Real Docker REDs were retained while bringing up the local proof: missing
  rehearsal module; missing live trusted-proxy/token/lifecycle authorities;
  stale 401 containment expectations against current 410 tombstones; public
  file-provider convergence; exact kill-switch field names; and HTTP status
  parsing. Each was followed by the minimal focused GREEN. The containment
  updates strengthen the bootstrap gate to require the current removed-surface
  410 contract.
- Exact dirty-source diagnostic command:
  `npm exec --silent --prefix tunes -- tsx tunes/scripts/music-docker-release-rehearsal.ts`
  exited 0 in about 50 seconds and emitted only:
  `{"schemaVersion":"music-operation/v1","metric":"real-docker-release","compatibilityRouteUsage":0,"migrationFailureObserved":true,"readinessFailureObserved":true,"rollbackRestored":true,"unknownRollbackRefused":true,"preFloorRollbackRefused":true,"killSwitchVerified":true}`.
- The proof used one labeled `registry:2` bound to a random loopback port,
  exact local candidate digests, PostgreSQL 15 without a host database port,
  private Docker-volume secrets, disposable Traefik without ACME/dashboard/API,
  and a unique `music-c10-release-*` project. Failure and success cleanup
  verified zero labeled containers, volumes, and networks.
- Local-image isolation RED: the focused workflow-security contract failed 1/1
  because the first rehearsal version still permitted Docker's ambient pull
  fallback. Minimal GREEN requires every prerequisite OCI base to be preloaded,
  every `docker run` and Compose service to use never-pull policy, and both
  source/candidate builds to use `--pull=false`. The first live GREEN attempt
  then correctly failed before deployment because the intentionally evicted
  legacy digest was not local; the script now explicitly preloads that one
  immutable digest from its already-running loopback registry. The final live
  rerun exited 0 in about 56 seconds with the same complete
  `real-docker-release` envelope and cleanup again verified labeled
  containers/volumes/networks `0/0/0`. No external image pull or push occurred.
- Independent review found that an ambient remote Docker context could relocate
  the otherwise-loopback rehearsal. Exact RED ran both hostile authorities:
  `DOCKER_HOST=tcp://127.0.0.1:1` and a nonexistent `DOCKER_CONTEXT`; both
  reached image inspection rather than the required pre-Docker refusal. GREEN
  rejects either external override, inspects the selected context read-only,
  admits only a local named-pipe or Unix-socket endpoint, and binds every parent
  Docker call plus the child engine to that inspected endpoint. The first live
  attempt using a context-name binding failed bootstrap because the engine's
  intentionally isolated Docker config cannot resolve ambient context metadata;
  the exact failure remains recorded. The minimal endpoint binding then passed
  workflow security 11/11, standalone TypeScript, and the complete live Docker
  envelope in about 59 seconds, with guarded cleanup `0/0/0`.
- Fresh protected/static gates: workflow security 9/9; deployment files 18/18;
  qualification contract 24/24; other deployment executable/static/security
  files 88 passed plus 2 Docker-capability skips; rehearsal standalone TypeScript
  and scoped Tunes TypeScript passed. The final exhaustive deployment executable
  rerun passed 70/70 in 589.73 seconds.
- Fresh broad gates: Tunes critical coverage 24 files, 519 passed plus one skip,
  100% (`1751/1751`, `1579/1579`, `265/265`, `1528/1528`); Explorer critical
  coverage 14 files/220 passed at 100% (`534/534`, `495/495`, `117/117`,
  `442/442`); labeled standalone PG15 identity repository 9 files/120 passed at
  100% (`606/606`, `483/483`, `67/67`, `556/556`) in 33.16s with cleanup
  containers/listeners `0/0`; security matrix 6 files/119; load/chaos 2 files/5;
  Explorer full unit 120 files/964; Tunes/Explorer types, exact baseline, and
  both production builds passed; Chromium fullstack 9/9 and axe/keyboard 2/2.

## Review and handoff

The protected refactor and local-registry release evidence are implemented.
Independent protected review found the remote-Docker containment gap described
above; after exact RED/GREEN and the endpoint-pinning live rerun, its final delta
review found no remaining Critical or Important issue. Task 10 is not approved;
a separate external approval remains required after the final commit and clean
exact-commit rehearsal.

## Commit and exact detached proof

- Committed all 51 coherent Task 10 paths as
  `2566d462b2a57addd6d4d6661019a9319d97e2ff`
  (`test(music): qualify identity security and recovery`). No push was made.
- A clean detached worktree at that exact hash passed three lockfile installs,
  portable bootstrap, doctor, and five-service startup in about 105 seconds.
  Canonical smoke passed; the built fixture browser reached real Tunes, fixture
  Strapi, and PostgreSQL owner authority (Chromium 1/1).
- A first direct invocation of the runtime helper failed before stopping Tunes
  because it intentionally expects the qualification runner's authenticated
  environment injection. The supported guarded environment reader and secure
  migrator-secret reader were then used against only the detached disposable
  authority (never the original active ignored file). Real outage/recovery
  passed with 5 containers, 4 healthy services, migration exit 0, one stable
  identity row, owner predicate verified, and compatibility usage 0.
- The exact commit's local-registry shared-engine rehearsal passed the complete
  sanitized migration/readiness/rollback/floor/kill-switch envelope. Supported
  fixture teardown left containers/networks/listeners `0/0/0`; its two exact,
  unattached, fixture/project-labeled retained volumes were verified by literal
  name and removed, leaving volumes 0. The detached authority pointer was a
  zero-byte tombstone and tracked status was clean before guarded worktree
  removal. Git deregistered the worktree but hit Windows path length while
  deleting a residual dependency directory; after revalidating the exact target
  and verifying each residual directory was empty, bounded native deletion
  removed it. The disposable path and registration are absent.
- Task 10 is implemented and committed but is not claimed approved. A separate
  external reviewer must approve it before any Task 11, push, production, or
  `GATE_PROD` action.

## External review fix round 1 (2026-08-21)

The five Important findings in `task-10-review.md` were independently traced
to executable gaps before edits. No schema, migration, immutable marker,
production deployment, registry push, `GATE_PROD`, or Task 11 surface changed.
The active ignored `.env.music.test` was not opened, normalized, or mutated.

### RED evidence

- Fixture-wrapper containment RED:
  `npm exec -- vitest run --config vitest.config.ts server/test/deployment/music-deploy-executable.test.ts --testNamePattern "hostile direct fixture|remote effective Docker|non-canonical and non-private|fixture Compose model" --reporter=verbose`
  exited 1 with 12 failures. Direct wrapper invocation admitted ambient Docker
  endpoint/prod/GATE/cleanup authority, marker-only roots, remote effective
  contexts, and incomplete Compose containment.
- Lane-inventory RED: focused qualification contract
  `keeps long release recovery...` failed because the release task omitted
  executable deployment files and the broad unit task still invoked the
  repository-authority CLI contract.
- Persisted-evidence RED: the hostile sanitizer contract failed with
  `sanitizeMusicChildArtifactOutput is not a function`; absolute developer
  roots, secret environment assignments, and raw Docker structured output were
  not comprehensively bounded at the artifact/checkpoint sink.
- Authentication-trigger RED: the new Playwright journeys failed before the
  local IdP/GraphQL harness existed; prior tests entered Music directly and did
  not cross the real Google callback or confirmed-email login/onboarding
  transitions.
- Load-authority RED: focused qualification contracts failed 2/2 because the
  PostgreSQL task exercised only a synthetic pool probe and release evidence
  could remain green without an observed telemetry-label envelope.

### Minimal GREEN implementation and focused proof

- The fixture wrapper now independently rejects `DOCKER_HOST`,
  `DOCKER_CONTEXT`, all prod/GATE aliases and cleanup escape variables before
  mutation; attests and pins an effective local npipe/unix Docker endpoint;
  requires a canonical, owned, private, project-named disposable root with all
  authority leaves inside it; and validates the exact seven-service Compose
  model. Every service must use a loopback-registry exact digest,
  `pull_policy: never`, exact fixture labels/networks/volumes, no build,
  privilege, device, ambient namespace, unsafe bind, or non-Traefik port.
  Hostile direct invocation is covered. The standalone real-Docker rehearsal
  passed in about 51 seconds and emitted migration/readiness failure,
  exact-digest restoration, unknown/pre-floor refusal, kill switch, and
  compatibility usage 0, followed by labeled cleanup 0/0/0.
- The release rehearsal task enumerates all 11 deployment test files. The
  broad Tunes task excludes the authority-bearing CLI contract, which is now a
  serial PR task in a clean detached exact-commit worktree with guarded
  dependency links and cleanup. It never points at the source checkout's
  ignored authority. A direct Windows execution RED exposed `ERR_FS_EISDIR`
  when removing its already-empty temporary parent; the minimal directory-API
  fix made the same direct check fail at the intended clean-source guard and
  leave zero helper roots. Qualification contract 26/26 passed. Actual lane
  evidence is deferred to the committed detached checkout below.
- CLI artifact, checkpoint, command argument, stdout, and stderr sinks now
  portableize repository/developer paths; recursively redact structured and
  exact sensitive values; redact hostile `KEY=value`, DSN, bearer, and home
  forms; and replace raw Compose/inspect/daemon payloads with a bounded byte
  envelope. Hostile corpus tests and the full qualification contract passed.
- Playwright now crosses the actual Google callback and actual confirmed-email
  page/login/three-step onboarding before the sole eligibility observer emits
  one bodyless ensure. The harness uses local IdP/GraphQL/REST seams only and
  verifies distinct application/Music bearer authority, no `X-Username`, one
  account create under a double submit, no duplicate ensure, and zero ensure
  for incomplete, ambiguous, or unconfirmed accounts. Focused Chromium passed
  3/3; combined authentication plus full-stack browser passed 12/12.
- The C10 load gate now crosses actual loopback HTTP, Express identity routes,
  Strapi gateway fetches, projection, token/principal services, the real
  repository, and a fresh PostgreSQL 15 database. It measures concurrent first
  ensure/single-flight, 200 cached ensures, 200 ordinary owners with zero
  Strapi calls, 200 invalid-token requests, and 50-query four-connection pool
  saturation. Latest focused GREEN emitted first/cached/owner/pool p95 values
  66.76/32.20/154.10/437.05ms, 300 actual metric events, one exact eight-key
  set, zero forbidden identity keys, and bounded value cardinality 8.

### Broad pre-commit gates

- Tunes critical per-file coverage: 24 files, 519 passed plus one skip, exact
  100% (`1751/1751`, `1579/1579`, `265/265`, `1528/1528`).
- Explorer critical per-file coverage: 14 files/220 passed, exact 100%
  (`534/534`, `495/495`, `117/117`, `442/442`).
- Real-PG identity-repository coverage: 9 files/120 passed, exact 100%
  (`606/606`, `483/483`, `67/67`, `556/556`).
- Complete deployment executable/static/security run: 99 passed, one skipped;
  the only initial failure was one stale caller-side Docker assertion. After
  updating it to assert wrapper-side endpoint pinning, its focused file passed
  11/11. The full executable behavior itself was green.
- Tunes and Explorer scoped TypeScript, exact Tunes baseline, both production
  builds, qualification 26/26, unit load 3/3, focused real-PG load 1/1, and
  combined Chromium 12/12 passed. The Explorer build's generated sitemap was
  restored exactly and is absent from the diff.

Final independent rereview, the separate fix commit, actual two-sample C0 lane
evidence, sanitized newly generated artifacts, and clean detached exact-commit
five-service/recovery proof follow below. Task 10 remains unapproved.

## External review fix round 1: exact-commit evidence (2026-08-22)

All results in this section are bound to the clean detached execution authority
`2315a8806e0c12324ba7cbefc39dab0b1a94c855`
(`fix(music): make qualification evidence authoritative`). The later
`docs(music): record qualification evidence` successor records these results
only; it was not the execution authority. This separation avoids changing the
tested hash while still leaving tracked documentation clean. It costs one
docs-only successor commit and requires reviewers to inspect the named tested
commit rather than infer authority from final `HEAD`.

The proof checkout was
`C:\Users\TK\AppData\Local\Temp\music-c10-final-2315a88\checkout`. The active
ignored source `.env.music.test` was never read, repaired, normalized, or
mutated. The supported detached bootstrap generated only disposable authority.
No schema, migration, protected production, registry push, `GATE_PROD`, Task 11,
or Task 12 action occurred.

### Fix-round RED, diagnosis, and minimal GREEN

- Preserved PR failures `20260822090053805-6b0c81cd` (475.123s),
  `20260822091258481-123a8b19` (413.097s), and
  `20260822092807285-2ec4df7d` (284.851s) proved that PostgreSQL lane tasks
  first fell back to the fixture database and then reached a mismatched
  standalone credential generation. Preserved doctor/up failures
  `20260822092100626-805666f5` (0.597s) and
  `20260822092252861-92b26f26` (93.242s) retain the occupied-port and retained
  volume/rotated-credential lifecycle evidence.
- Preserved PR `20260822094515397-b0508b11` (326.504s) retains an original
  critical-coverage failure although its one diagnostic rerun passed. The
  original result remains failure/flakiness and was not promoted. Its peak
  identity-route fetch count and reconciliation timeout did not reproduce in
  either final exact-hash PR sample.
- Preserved release `20260822100930269-3ee9a46c` (995.890s) proved two real
  defects: `real-docker-evidence` wrote identity state to the five-service
  fixture DB but queried the standalone PG sidecar, and the sanitizer redacted
  the numeric `invalidTokensRejected` measurement so persisted telemetry could
  not remain authoritative. Its otherwise-green local-registry envelope and
  its original release failure remain recorded.
- Exact focused RED added two failing contracts: real-Docker fixture evidence
  must strip all standalone-PG authority while actual PG tasks retain it, and
  the sanitizer must preserve only the known nonnegative numeric
  `invalidTokensRejected` measurement while redacting adjacent secret-shaped
  fields. Minimal GREEN introduced the explicit standalone-PG task set,
  task-specific child ambient environment and sidecar attestation, and the
  bounded numeric sanitizer exception. Focused contracts passed 2/2, the full
  qualification contract passed 35/35, scoped Tunes TypeScript passed, and
  `git diff --check` was clean before the same-subject fix commit was amended to
  the tested hash above.

### Clean detached authority and five-service proof

- Root `npm ci` passed with 33 packages and zero reported vulnerabilities.
  Fresh supported bootstrap `20260822102924647-852034e3` passed in 44.350s.
  A commit-labeled `postgres:15-alpine` sidecar was bound only to
  `127.0.0.1:59156`; doctor `20260822103031945-8580513b` passed in 0.607s,
  resume-safe bootstrap `20260822103044624-e3861d18` in 38.473s, and ordered
  doctor `20260822103128978-88bc3f5c` in 0.589s.
- Supported five-service startup `20260822103135243-5fba24fc` passed in
  110.575s. Cold/warm canonical smoke runs
  `20260822103445352-1e9a1506` and `20260822103451359-785aa069` passed in
  0.909s and 0.875s.
- Both release samples independently crossed the five-container fixture. Each
  observed four healthy long-running services plus successful migration exit,
  exactly one stable Music identity row, repeated ensure stability, verified
  owner predicate, an actual Tunes outage, recovery, and compatibility-route
  usage 0.

### Authoritative two-sample lane evidence

Every row below used `npm run --silent music:test:<lane> -- --format json` in
the clean detached checkout. Final exact-hash report paths are relative to
`.artifacts/music-c10-evidence/2315a88/music-runs/`; the complete prior-hash
ledger is under `.artifacts/music-c10-evidence/6c4d6cf/music-runs/`.

| Lane | Sample 1 | Sample 2 | Cross-run p50 / p95 | Budget | Result |
| --- | --- | --- | --- | --- | --- |
| fast | `20260822103501519-af2f84cd`, 19.123s lane wall | `20260822103526644-e5d2ed25`, 5.048s | 5.048s / 19.123s | 3m | 3/3 twice, green |
| PR | `20260822103538644-222bc054`, 340.252s | `20260822104127154-899245a8`, 312.856s | 312.856s / 340.252s | 15m | 14/14 twice, green |
| nightly | `20260822104648344-06b713d3`, 380.004s | `20260822105326051-9451e550`, 381.353s | 380.004s / 381.353s | 45m | 23/23 twice, green |
| release | `20260822110005960-3e8cb9f9`, 993.835s | `20260822111712428-71f677bb`, 973.222s | 973.222s / 993.835s | 60m | 20/20 twice, green |

All eight counted samples had zero original task failures, zero timeouts, and
zero diagnostic reruns. Expected interrupt/resume child runs remain separately
persisted as original failed/interrupted fast commands followed by bounded
successful resumes: `20260822105259790-dc0fed5b` /
`20260822105302033-7087506a`, `20260822105940432-06a66a60` /
`20260822105941191-92ffc9f4`, `20260822110533292-0e265df3` /
`20260822110535511-3c3c4411`, and
`20260822112246078-b3eb05d9` / `20260822112246848-deff555d`.
They are operational evidence, not substituted green lane samples.
The earlier exact-hash ledger likewise retains all three expected
interrupt/resume child pairs: `20260822100245779-8da4f8ec` /
`20260822100246529-5ef88fdf`, `20260822100914086-9e7eed48` /
`20260822100914839-57e41dcb`, and
`20260822101502401-b94d466f` / `20260822101503176-29dea05d`.

Nightly sample 1 observed first/cached/owner/pool p95 values
58.685/31.878/98.128/398.695ms; sample 2 observed
61.179/31.877/103.324/410.893ms. Each crossed 200 cached ensures, 200 ordinary
owner requests with zero Strapi owner fetches, 200 rejected invalid tokens, and
50 concurrent queries through a four-connection pool. Each captured 300 actual
telemetry events with one exact eight-key set, zero forbidden identity keys,
and bounded label-value cardinality 8. Both interrupt/resume measurements were
`verified` for owned-child cleanup and resume.

Both release reports persisted the same complete
`music-operation/v1 real-docker-release` envelope: compatibility usage 0;
migration and readiness failures observed; exact rollback restored; unknown and
pre-floor rollback refused; and kill switch verified. Sample 1 measured the
immutable release rehearsal / real-Docker release at 596.061s / 63.404s;
sample 2 measured 571.824s / 61.940s. No deployment or external registry action
was performed.

### Artifact sanitation, preservation, and cleanup

- All 756 retained files across the final- and prior-hash ledgers, including
  every original failure and diagnostic artifact, were scanned. Match counts
  were zero for developer
  absolute paths, the active source authority path, raw Docker inspect
  `Config`/`Env`/`Mounts`, bearer material, non-redacted secret assignments,
  and PostgreSQL URIs. Both copied evidence trees matched their detached
  sources byte-for-byte with zero SHA-256 mismatches and total 3,169,705 bytes.
- Supported fixture teardown `20260822113401415-dcb511c7` passed in 4.320s with
  volume confirmation. The exact sidecar passed literal name, Task 10 label,
  owner, full commit, image, loopback binding, and sole-volume-use attestation
  before its container and anonymous volume were removed.
- Final read-only checks found fixture containers, qualification containers,
  fixture networks, fixture volumes, release/registry matches, and watched
  listeners on 55432/51337/55000/55173/59156 all at zero. These disposable
  resources are not recoverable.
- After both evidence trees were copied, sanitized, and SHA-256 verified and
  the tracked ledger successor was committed, the final and earlier detached
  worktrees passed exact path, registration, hash, and clean tracked-state
  attestation. Git deregistered each but reported a Windows long-path deletion
  failure. Each bounded residual contained only `tunes` and one verified
  self-referential workspace junction; the exact junction was removed without
  traversal, absence of all other reparse points was verified, and the two
  exact disposable roots were deleted. Both registrations and paths are now
  absent. The removed generated authorities and dependencies are not
  recoverable; the sanitized ignored evidence copies remain.

Task 10 remains unapproved. The controller must dispatch a separate independent
scoped rereview of the tested code hash; this report is not self-approval.
