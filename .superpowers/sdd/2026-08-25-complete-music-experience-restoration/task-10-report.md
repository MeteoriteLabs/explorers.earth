# Task 10 report — identity reliability gate

## Status

DONE_WITH_CONCERNS

Commit: `5c6c2ba` (`fix(music): harden identity retry diagnostics`)

## Outcome

- Reuses a Music credential until the configurable 60-second refresh window, then refreshes once through the existing per-authority single flight.
- Retries only stable identity errors with `retryable: true`, with at most three total attempts, a 1-second default delay, a 2-second per-delay ceiling, and therefore at most 4 seconds of retry delay.
- Preserves the sanitized `Retry-After` value and safe `X-Request-Id` on `MusicClientError`; unsafe request IDs and credential material are not surfaced.
- Prevents explicitly non-retryable coordinator failures from being retried by rerenders or the retry action.
- Detaches old coordinator/client work across account changes so stale completion or delayed retries cannot publish into the new authority.
- Makes ensure latency deterministic for local qualification through an injectable route clock, while the route log remains exactly `event`, `outcome`, `status`, `latencyMs`, and `requestId`.
- The existing server metrics callback continues to provide numeric cold/warm/concurrent evidence (`latencyMs`, upstream calls, retry count, cache hit/miss, and leader/coalesced classification). Live deployment probes were intentionally not run in this coding task.

## RED evidence

### Required Explorers reliability command

Command:

```text
cd explorers-earth
npm run test:unit -- src/features/music/__tests__/musicIdentityCoordinator.test.ts src/lib/__tests__/localTunesApiClient.test.ts
```

The isolated worktree initially had no `explorers-earth/node_modules`, so the first invocation could not start (`'vitest' is not recognized`). I linked the worktree temporarily to the already-installed dependency tree and reran the exact command. The real RED result was:

```text
Test Files  2 failed (2)
Tests       6 failed | 56 passed (62)
```

Expected failures observed:

- near-expiry credential made zero ensure calls instead of one;
- retryable `503` made one attempt instead of three;
- safe request IDs were absent on `401` and `403` errors;
- unsafe request-ID sanitization metadata was absent;
- an old account flight published `ready` while the new account was still setting up.

An additional coordinator classification RED run produced:

```text
Test Files  1 failed (1)
Tests       2 failed | 32 passed (34)
```

The non-retryable operation was called three times instead of once, and the stale account flight still published readiness.

### Required Tunes reliability command

Command:

```text
cd tunes
npm test -- server/test/music-identity-route.test.ts
```

RED result:

```text
Test Files  1 failed (1)
Tests       1 failed | 13 passed (14)
Expected latencyMs: 37
Received latencyMs: 1
```

This proved the route was still coupled to wall-clock time rather than the deterministic SLO evidence clock.

### Retry-budget regression RED

The first critical run showed two 3-second waits exceeded Vitest's 5-second budget. A focused contract assertion was changed first to require the cold-entry-compatible 4-second maximum retry delay and failed as expected:

```text
expected 10000 to be 4000
```

The implementation was then reduced to a 2-second per-delay maximum. A second RED assertion established that UI metadata must retain the sanitized server `Retry-After` rather than the local wait clamp:

```text
expected retryAfterSeconds 3600
received retryAfterSeconds 2
```

The final implementation clamps waiting but preserves response metadata.

## GREEN evidence

### Focused reliability suites

Commands:

```text
cd explorers-earth
npm run test:unit -- src/features/music/__tests__/musicIdentityCoordinator.test.ts src/lib/__tests__/localTunesApiClient.test.ts

cd tunes
npm test -- server/test/music-identity-route.test.ts
```

Results after the initial implementation:

```text
Explorers: 2 test files passed, 63 tests passed
Tunes:     1 test file passed, 14 tests passed
```

The later critical suite includes the additional default-delay/account-cancellation coverage test, bringing the changed Explorers test total to 64 within that run.

### Required critical coverage — final fresh run

Command:

```text
cd explorers-earth
npm run test:music-critical-coverage
```

Result:

```text
Test Files  14 passed (14)
Tests       229 passed (229)
Statements  100% (581/581)
Branches    100% (535/535)
Functions   100% (121/121)
Lines       100% (485/485)
```

Command:

```text
cd tunes
npm run test:music-critical-coverage
```

Result:

```text
Test Files  24 passed (24)
Tests       548 passed | 1 skipped (549)
Statements  100% (1888/1888)
Branches    100% (1695/1695)
Functions   100% (274/274)
Lines       100% (1647/1647)
```

### Static verification

```text
cd explorers-earth && npx tsc -b --pretty false
exit 0

cd explorers-earth && npx eslint <four scoped files>
exit 0, with two pre-existing warnings in existing test lines and no errors

cd tunes && npm run music:types:scoped
exit 0

git diff --check
exit 0
```

The repository-wide `cd tunes && npm run check` remains red on existing legacy client TypeScript errors (theme provider, analytics, Apollo client, old dashboard/playlist pages, and related files). None reference the six files changed here. A scoped Tunes ESLint command is unavailable because that package has no ESLint configuration and `npx` selected ESLint 10.

## Files changed

- `explorers-earth/src/features/music/musicIdentityCoordinator.ts`
- `explorers-earth/src/lib/localTunesApiClient.ts`
- `explorers-earth/src/features/music/__tests__/musicIdentityCoordinator.test.ts`
- `explorers-earth/src/lib/__tests__/localTunesApiClient.test.ts`
- `tunes/server/routes/musicIdentityRoutes.ts`
- `tunes/server/test/music-identity-route.test.ts`

No unrelated tracked files and neither untracked `.gstack` file were staged or modified.

## Self-review

- Constructor compatibility is preserved by appending `requestId` to `MusicClientError`'s existing positional parameters.
- Retry classification depends only on the stable envelope's explicit `retryable: true`; `401`, `403`, malformed envelopes, and network failures do not enter the identity retry loop.
- The third failed attempt is terminal; no fourth request is reachable.
- `Retry-After` controls waiting through a 2-second clamp, while the original safe numeric value remains available to later UI clients.
- Credential tokens remain only in the Authorization header and credential store. Tests verify sentinel proofs/tokens do not enter errors, URLs, response bodies, or logs.
- Account changes clear the credential, abort fetch work, invalidate coordinator generations, and stop a delayed old retry before its next request.
- Fresh credentials take the warm path without Strapi/ensure. Near-expiry concurrent calls take one cold refresh flight.
- Route log assertions verify the exact allowed key set and deterministic numeric latency.
- Mutation check: removing retryability checks, increasing attempts, removing the delay clamp, accepting unsafe request IDs, or allowing old generations to publish would each fail a named test.

## Concerns

- No live deployment cold/warm/concurrent probe was run, by task scope. The code and telemetry hooks are ready, but the release gate still requires deployed evidence for success rate ≥99.5%, warm p95 ≤1 second, and cold p95 ≤5 seconds.
- Repository-wide Tunes TypeScript remains red on unrelated pre-existing legacy client errors; the Music-scoped typecheck and both required 100% coverage suites pass.

---

## Review fix round 1/5 — retry ownership, deadline, and UI correlation

### Outcome

The shared identity contract now has one automatic retry owner: `localTunesApiClient`. One coordinator entry can issue at most three ensure HTTP calls total. The client rejects malformed or contradictory identity errors without retrying, applies a 4.5-second deadline across proof acquisition, fetch, response decoding, and retry waits, and aborts an old authority flight promptly. A sanitized request ID is retained by the coordinator and exposed by both automatic and explicit retry paths to the Music page under a collapsed **Technical details** disclosure.

### RED evidence

Initial focused review command:

```text
cd explorers-earth
npm run test:unit -- src/lib/__tests__/localTunesApiClient.test.ts src/features/music/__tests__/musicIdentityCoordinator.test.ts src/components/__tests__/AuthSyncManager.test.tsx src/hooks/__tests__/useTunesDashboardIsolation.test.tsx src/pages/__tests__/MusicPage.test.tsx
```

Initial result:

```text
Test Files  5 failed (5)
Tests       11 failed | 93 passed (104)
```

The failures proved the review findings independently:

- lying `401`/`403`, unversioned `503`, status/code contradiction, and mismatched correlation envelopes each made three fetches instead of failing closed after one;
- a fetch that ignored `AbortSignal` remained pending at 4,500 ms;
- account switch did not settle an injected unresolved retry wait within the real 75 ms bound;
- the coordinator had no diagnostic snapshot;
- `AuthSyncManager` and `useTunesDashboard` dropped retry errors instead of forwarding them;
- the Music page had no technical-details correlation disclosure.

Additional focused RED assertions:

```text
Retry-After budget: expected total sleep 2000, received 4000
Coordinator ownership: expected retryable, received unavailable
```

These showed that two bounded waits still consumed too much of the cold budget and that the coordinator was applying a second retry-failure budget above the client.

Response-decoding deadline RED:

```text
npm run test:unit -- src/lib/__tests__/localTunesApiClient.test.ts -t "decoding an ensure response"

Test Files  1 failed (1)
Tests       1 failed | 39 skipped (40)
expected "pending" to match { code: "AUTH_UNAVAILABLE", status: 503, retryable: false }
```

Required-header RED, aligned with the shared `music-error/v1` parser:

```text
npm run test:unit -- src/lib/__tests__/localTunesApiClient.test.ts -t "missing Retry-After"

Test Files  1 failed (1)
Tests       1 failed | 43 skipped (44)
expected fetch to be called 1 time, received 3
```

The first critical-coverage qualification also exposed two stale legacy assertions in `music-critical-client-coverage.test.ts` that expected thrown decoder errors to escape and accepted a partial unversioned retry envelope:

```text
Test Files  1 failed | 13 passed (14)
Tests       2 failed | 236 passed (238)
```

After those assertions were updated to the stable envelope contract, behavior was green but the new branches were not yet completely exercised:

```text
Tests       238 passed (238)
Statements  98.55%
Branches    98.26%
Functions   98.48%
Lines       100%
```

Focused default-delay, synchronous-abort, malformed-`400`, diagnostic-listener, and header validation cases were added before the final coverage gate.

### GREEN evidence

Final focused command:

```text
cd explorers-earth
npm run test:unit -- src/lib/__tests__/localTunesApiClient.test.ts src/features/music/__tests__/musicIdentityCoordinator.test.ts src/components/__tests__/AuthSyncManager.test.tsx src/hooks/__tests__/useTunesDashboardIsolation.test.tsx src/pages/__tests__/MusicPage.test.tsx
```

Final result:

```text
Test Files  5 passed (5)
Tests       112 passed (112)
```

Final Explorers critical coverage:

```text
cd explorers-earth
npm run test:music-critical-coverage

Test Files  14 passed (14)
Tests       245 passed (245)
Statements  100% (617/617)
Branches    100% (575/575)
Functions   100% (132/132)
Lines       100% (514/514)
```

Final Tunes critical coverage:

```text
cd tunes
npm run test:music-critical-coverage

Test Files  24 passed (24)
Tests       548 passed | 1 skipped (549)
Statements  100% (1888/1888)
Branches    100% (1695/1695)
Functions   100% (274/274)
Lines       100% (1647/1647)
```

Static verification:

```text
cd explorers-earth && npx tsc -b --pretty false
exit 0

cd tunes && npm run music:types:scoped
exit 0

cd explorers-earth && npx eslint <11 scoped changed source/test files>
exit 0; 7 existing warnings, 0 errors

git diff --check
exit 0
```

### Files changed in review fix round 1/5

- `explorers-earth/src/lib/localTunesApiClient.ts`
- `explorers-earth/src/lib/__tests__/localTunesApiClient.test.ts`
- `explorers-earth/src/lib/__tests__/music-critical-client-coverage.test.ts`
- `explorers-earth/src/features/music/musicIdentityCoordinator.ts`
- `explorers-earth/src/features/music/__tests__/musicIdentityCoordinator.test.ts`
- `explorers-earth/src/components/AuthSyncManager.tsx`
- `explorers-earth/src/components/__tests__/AuthSyncManager.test.tsx`
- `explorers-earth/src/hooks/useTunesDashboard.ts`
- `explorers-earth/src/hooks/__tests__/useTunesDashboardIsolation.test.tsx`
- `explorers-earth/src/pages/Music.tsx`
- `explorers-earth/src/pages/__tests__/MusicPage.test.tsx`

Neither untracked `.gstack` file was staged or modified.

### Commits

- Baseline identity hardening: `5c6c2ba fix(music): harden identity retry diagnostics`
- Review implementation and tests: `1b13369 fix(music): enforce identity retry contract`
- This appended evidence is committed in the follow-up documentation commit that contains this report.

### Self-review

- `containedEnsureError` accepts only the exact strict `music-error/v1` shape, a documented identity response status/code pair, a known action, consistent action/retryability, a safe equal header/body request ID, and the required positive integer `Retry-After` on `429`/`503`. Any contradiction fails closed with no retry. `401` and `403` can never become retryable.
- The client owns the only automatic budget (`maxAttempts: 3`). Coordinator `retry()` remains an explicit user action and no longer multiplies or terminalizes the client's automatic attempt budget.
- One 4,500 ms timer bounds proof acquisition, ensure fetch, response JSON decoding, and retry waits. Each of the two possible waits is capped at 1,000 ms, leaving at least 2,500 ms of the nominal cold budget for non-wait work when responses are immediate.
- Authority changes abort the controller with a distinct reason. The outer flight races injected or native waits against that signal, so the old promise settles as contained `AUTH_REQUIRED` even when the underlying delay implementation ignores cancellation.
- Request IDs are pattern-sanitized twice: at the HTTP boundary and at the coordinator boundary. No credential, bearer, upstream message, or arbitrary error property reaches UI state. The page displays only `Request ID: <safe-id>` inside a collapsed technical-details element.
- Automatic reconcile failures and explicit hook retry failures both flow through `reportFailure`; rejection is still contained by their respective UI boundaries.
- Mutation-sensitive tests cover malformed and contradictory envelopes, missing/invalid retry headers, exactly three composed `503` calls, full deadline expiration, real-timer switch cancellation, safe/unsafe diagnostic publication, AuthSync forwarding, hook forwarding/exposure, and UI disclosure.

### Concerns / external gate

- The deployed cold/warm/concurrent SLO probe is explicitly outside this coding task and remains a release gate. Do not claim restoration complete until deployed evidence demonstrates success rate at least 99.5%, warm p95 at most 1 second, and cold p95 at most 5 seconds under the required concurrency profile.
- Scoped ESLint exits successfully but still reports seven warnings already present in the touched files (hook dependency, fast-refresh export shape, test `any`, and unused legacy test helpers/locals). No lint errors were introduced.
- Repository-wide Tunes TypeScript remains subject to the unrelated legacy baseline described above; the required Music-scoped Tunes typecheck exits 0.

---

## Review fix round 2/5 — policy-derived retries and stale-account isolation

### Outcome

Identity retryability is now derived exclusively from one explicit server-compatible status/code/action policy table. The response body must agree with that policy, but its `retryable` boolean never grants retry authority. All consumer-level `reportFailure` calls were removed from `AuthSyncManager` and `useTunesDashboard`; only the coordinator's generation-checked reconcile/retry flight may publish identity failures or request IDs.

### RED evidence

Command:

```text
cd explorers-earth
npm run test:unit -- src/lib/__tests__/localTunesApiClient.test.ts src/components/__tests__/AuthSyncManager.test.tsx src/hooks/__tests__/useTunesDashboardIsolation.test.tsx
```

Result:

```text
Test Files  3 failed (3)
Tests       5 failed | 78 passed (83)
```

Expected failures:

- contradictory `400 REQUEST_INVALID` + `action: retry` + `retryable: true` made three ensure calls instead of one;
- contradictory `409 IDENTITY_CONFLICT` + `action: retry` + `retryable: true` made three ensure calls instead of one;
- the legitimate server-emitted `409 ONBOARDING_INCOMPLETE` envelope failed closed and lost `upstreamCode` instead of being accepted as non-retryable;
- after A→B account switch, delayed account A rejection changed the simulated active diagnostic from B `setting_up`/no request ID to A `retryable`/`account-a-request` through `AuthSyncManager`'s external catch;
- delayed explicit retry rejection from account A called `reportFailure` after the hook rendered account B, republishing A's request ID.

The first critical-coverage run after behavior became green identified one unexercised malformed-code branch:

```text
Test Files  14 passed (14)
Tests       264 passed (264)
Statements  100%
Branches    99.82% (572/573)
Functions   100%
Lines       100%
```

A fully shaped non-string code regression was added, bringing the strict fail-closed validator back to the required per-file 100% threshold.

### GREEN evidence

Final focused command:

```text
cd explorers-earth
npm run test:unit -- src/lib/__tests__/localTunesApiClient.test.ts src/features/music/__tests__/musicIdentityCoordinator.test.ts src/components/__tests__/AuthSyncManager.test.tsx src/hooks/__tests__/useTunesDashboardIsolation.test.tsx src/pages/__tests__/MusicPage.test.tsx
```

Result:

```text
Test Files  5 passed (5)
Tests       132 passed (132)
```

Final Explorers critical coverage:

```text
cd explorers-earth
npm run test:music-critical-coverage

Test Files  14 passed (14)
Tests       265 passed (265)
Statements  100% (619/619)
Branches    100% (573/573)
Functions   100% (133/133)
Lines       100% (516/516)
```

Final Tunes critical coverage:

```text
cd tunes
npm run test:music-critical-coverage

Test Files  24 passed (24)
Tests       548 passed | 1 skipped (549)
Statements  100% (1888/1888)
Branches    100% (1695/1695)
Functions   100% (274/274)
Lines       100% (1647/1647)
```

Static verification:

```text
cd explorers-earth && npx tsc -b --pretty false
exit 0

cd tunes && npm run music:types:scoped
exit 0

cd explorers-earth && npx eslint <6 round-2 scoped source/test files>
exit 0; 2 existing warnings, 0 errors

git diff --check
exit 0
```

### Server-emitted ensure policy covered

The client table and parameterized regression cover every concrete pair emitted by the ensure route, Strapi gateway, or ensure repository:

- `400 REQUEST_INVALID / none / non-retryable`
- `401 AUTH_REQUIRED / authenticate / non-retryable`
- `401 AUTH_INVALID / authenticate / non-retryable`
- `403 IDENTITY_INELIGIBLE / complete_onboarding / non-retryable`
- `403 IDENTITY_SUSPENDED / contact_support / non-retryable`
- `409 ONBOARDING_INCOMPLETE / complete_onboarding / non-retryable`
- `409 ACCOUNT_AMBIGUOUS / contact_support / non-retryable`
- `409 ACCOUNT_SWITCH_CONFLICT / contact_support / non-retryable`
- `409 IDENTITY_CONFLICT / contact_support / non-retryable`
- `409 IDENTITY_TOMBSTONED / contact_support / non-retryable`
- `409 IDENTITY_PENDING_DELETION / contact_support / non-retryable`
- `429 RATE_LIMITED / retry / retryable`
- `500 INTERNAL_ERROR / retry / retryable`
- `502 UPSTREAM_MALFORMED / retry / retryable`
- `503 UPSTREAM_UNAVAILABLE / retry / retryable`
- `503 DATABASE_UNAVAILABLE / retry / retryable`
- `503 ENTRY_DISABLED / retry / retryable`

Every valid case asserts exact call count and preservation of `upstreamCode`. Contradictory status/code/action/body combinations fail closed and omit the untrusted upstream code.

### Files changed in review fix round 2/5

- `explorers-earth/src/lib/localTunesApiClient.ts`
- `explorers-earth/src/lib/__tests__/localTunesApiClient.test.ts`
- `explorers-earth/src/components/AuthSyncManager.tsx`
- `explorers-earth/src/components/__tests__/AuthSyncManager.test.tsx`
- `explorers-earth/src/hooks/useTunesDashboard.ts`
- `explorers-earth/src/hooks/__tests__/useTunesDashboardIsolation.test.tsx`

Neither untracked `.gstack` file was staged or modified.

### Commits

- Round-2 implementation and tests: `971c374 fix(music): scope identity failure policy`
- This appended evidence is committed in the follow-up documentation commit that contains this report.

### Self-review

- The policy lookup first matches exact status and code, then requires the exact policy action and body boolean. Returned `MusicClientError.retryable` is copied from the trusted policy entry, never from the body.
- The prior incorrect `403 ONBOARDING_INCOMPLETE` association is removed. The concrete gateway contract, `409 ONBOARDING_INCOMPLETE / complete_onboarding / false`, is accepted and retains its sanitized upstream code.
- Automatic reconcile failures and explicit retry failures already pass through the coordinator's `startedGeneration` guard. Removing the two redundant consumer catches prevents a stale generation from bypassing that guard.
- Workspace query errors remain locally contained by React Query and the hook's safe generic error state; they no longer mutate identity coordinator state without an immutable account/generation token.
- The A→B component regression leaves B in `setting_up` with no request ID when A rejects, and the hook regression proves an A explicit-retry rejection cannot call external failure publication after B renders.

### Concerns / external gate

- The deployed cold/warm/concurrent SLO probe remains explicitly external and unchanged: release still requires success rate at least 99.5%, warm p95 at most 1 second, and cold p95 at most 5 seconds under the required concurrency profile.
- Round-2 scoped ESLint exits successfully with two existing warnings (the `AuthSyncManager` hook dependency warning and one unused legacy test local); no lint errors were introduced.
- The unrelated repository-wide Tunes TypeScript baseline remains outside this fix; the required Music-scoped typecheck exits 0.

## Authenticated live identity SLO workflow extension (2026-08-26)

### Scope and safety contract

The existing manual `.github/workflows/tunes-host-preflight.yml` now exposes a separate `run_authenticated_identity_slo` boolean input. Its job is restricted to `refs/heads/codex/tunes-fingerprint-diagnostic` and is mutually exclusive with both the diagnostic and test-deploy paths. The job uses the existing pinned SSH action, host/key secrets, deploy user, fingerprint, and `tunes-app-1` container authority.

Before mutation, the remote script requires the existing container to be the running, healthy `tunes/app` Compose service. It permits exactly one suppressed `docker restart --time 30 tunes-app-1`, then waits for running state, healthy state, and `/health/ready` for at most 45 bounded attempts before measuring the cold ensure. No deploy, image, database, filesystem, or Strapi mutation was added.

The probe executes entirely inside `tunes-app-1`. It reads `STRAPI_ACCESS_TOKEN`, `STRAPI_URL`, and `STRAPI_JWT_SECRET` there; selects the first eligible local-confirmed or Google user with exactly one complete account using bounded, ID-ordered pagination; and signs an ephemeral five-minute HS256 JWT. Neither the selection authority, JWT secret, JWT, user ID, account identity, response body, nor request ID is emitted.

The SLO set is exactly 30 bodyless `POST /api/music/identity/ensure` calls: one cold, 14 sequential warm, and 15 concurrent. This stays at the route's default 30-request window. The gate requires all 30 requests to succeed in practice (`>=99.5%` over 30 samples), warm p95 `<=1000ms`, and cold latency `<=5000ms`. The single JSON output contains schema/outcome/reason plus aggregate counts and latencies only. Missing eligibility, exhausted selection bounds, unavailable authority, malformed responses, and probe errors fail closed without raw error output.

The workflow was not triggered, deployed, or run against the server in this coding task.

### RED evidence

The original preflight test was stale against the already-existing one-shot deploy workflow (`workflow.jobs.preflight` did not exist). It was replaced with a contract for the actual workflow before implementation. The first implementation-driving run was:

```text
cd tunes
npm test -- server/test/deployment/music-host-preflight.test.ts

Test Files  1 failed (1)
Tests       5 failed (5)
```

The failures established that the explicit input/job, guarded restart/readiness loop, in-container authority and ephemeral JWT, cold/warm/concurrent threshold checks, and sanitized fail-closed output did not yet exist.

Three focused self-review regressions were also written and observed RED before their minimal fixes:

```text
# Exact provider eligibility (confirmed non-local providers must not be selected)
Test Files  1 failed (1)
Tests       1 failed | 4 passed (5)
Expected: (provider === "local" && candidate.confirmed === true) || provider === "google"

# Mutual exclusion from the existing diagnose/deploy paths
Test Files  1 failed (1)
Tests       1 failed | 4 passed (5)
Expected: !inputs.run_authenticated_identity_slo

# Bounded pagination rather than searching only the first 100 Strapi users
Test Files  1 failed (1)
Tests       1 failed | 4 passed (5)
Expected: const selectionPageSize = 100
```

An intermediate run after the initial workflow implementation had three passing contracts and two assertion-code defects. Those defects were corrected (`job["runs-on"]` for the hyphenated YAML key and matching the actual schema constant declaration) before GREEN was accepted; they did not require production behavior changes.

### GREEN evidence

Final focused and neighboring workflow security contracts:

```text
cd tunes
npm test -- server/test/deployment/music-host-preflight.test.ts server/test/deployment/music-deploy-workflow-security.test.ts

Test Files  2 passed (2)
Tests       17 passed (17)
```

Music-scoped type verification:

```text
cd tunes
npm run music:types:scoped

> tsc --project tsconfig.music-c0.json --pretty false --incremental false
exit 0
```

Critical coverage verification:

```text
cd tunes
npm run test:music-critical-coverage

Test Files  24 passed (24)
Tests       548 passed | 1 skipped (549)
Statements  100% (1888/1888)
Branches    100% (1695/1695)
Functions   100% (274/274)
Lines       100% (1647/1647)
```

Embedded JavaScript syntax and diff hygiene:

```text
# Extract the single-quoted NODE heredoc and pipe it to `node --check -`
exit 0

git diff --check
exit 0
```

The workflow contract itself parses the YAML with `js-yaml`. The Tunes package has no `lint` script or installed ESLint/Prettier dependency, and `actionlint` is unavailable in this environment:

```text
npm run lint
npm error Missing script: "lint"
exit 1

actionlint: unavailable
```

No ad-hoc package was downloaded to manufacture a lint result. YAML parsing, 17 static workflow/security assertions, embedded Node syntax validation, scoped TypeScript, critical coverage, and diff hygiene are the available local static gates.

### Files changed

- `.github/workflows/tunes-host-preflight.yml`
- `tunes/server/test/deployment/music-host-preflight.test.ts`
- `.superpowers/sdd/2026-08-25-complete-music-experience-restoration/task-10-report.md` (this appendix)

The untracked `.gstack/browse-audit.jsonl` and `.gstack/claude-available.json` files were neither modified nor staged.

### Commits

- `0d693bb test(music): add authenticated identity SLO probe`
- `3f0db39 test(music): bound SLO identity selection`
- This appended evidence is committed in the follow-up documentation commit containing this report.

### Self-review

- Input exclusivity prevents a single dispatch from combining the SLO restart with diagnostic output or an image deployment.
- The restart is guarded by immutable Compose identity plus current running/healthy state, happens exactly once, and is followed by a bounded running+healthy+readiness gate.
- Candidate pagination is deterministic and bounded at 100 pages of 100. Exhausting that bound without a candidate fails closed instead of selecting an unverified user.
- Candidate validation mirrors the Music gateway's provider/confirmation, blocked, single-account, and account-completeness rules.
- JWT minting and authenticated calls happen only inside the container. The token is ephemeral and never exported through SSH action environment inputs or output.
- Ensure requests have no body, each response body is canceled without inspection, and individual status codes/request IDs are not emitted.
- The only probe `console.log` serializes a fixed aggregate object; catches intentionally discard raw errors.
- With 30 total samples, one failure yields 96.667%, so the 99.5% requirement is unambiguously fail-closed while respecting the current default per-source route limit.

### Concerns / external gate

- Local code now supplies the authenticated cold/warm/concurrent qualification path, but the real SLO result remains an external release gate until an authorized operator manually dispatches it against the test server. Per instruction, this task did not trigger or deploy the workflow and makes no claim that the live thresholds pass.
- The repository does not provide a Tunes lint script and this machine does not have `actionlint`; the exact unavailable evidence is recorded above. All available scoped static and test gates pass.

## Authenticated SLO probe review hardening (2026-08-26)

### Review findings resolved

The manual probe now measures a successful ensure only after it has fully read the response body, parsed JSON, and validated the strict `music-identity/v1` response shape. Validation requires exact top-level, identity, and credential keys; a positive integer Music user ID; active identity status; a 64–4096 character three-segment base64url/JWT-shaped credential; and a safe-integer expiry strictly in the future. The latency clock stops only after this validation. Fetch, body-read, malformed-body, expiry, and cancellation failures all produce unsuccessful samples, and a cleanup cancellation that never settles cannot strand the sample.

Before the only restart, the job now requires the operator to supply `expected_deployed_commit`. The SSH script rejects non-lowercase 40-character commits, verifies the container's `MUSIC_IMAGE_COMMIT`, verifies the OCI image revision label, verifies `MUSIC_IMAGE_DIGEST`, and requires `.Config.Image` to match the immutable `ghcr.io/<owner>/explorers-tunes-test@sha256:<64 hex>` form. The existing exact branch lock, Compose project/service checks, running/healthy checks, one suppressed restart, and bounded post-restart readiness check remain in force.

Identity selection is DB-first. The in-container script reads one active, already-provisioned Music identity from the Music `users` table, then asks Strapi for that exact document ID and requires the exact stored account document ID plus the same eligibility/completeness rules used by the gateway. It no longer selects the first eligible arbitrary Strapi user, so the probe cannot provision a new Music identity as a side effect.

The ensure operation is semantically idempotent for this pre-provisioned identity, but it is not mutation-free. Every successful call refreshes the stored Strapi snapshots and writes `last_identity_sync_at` and `updated_at`. The aggregate output names this honestly as `identity_snapshots_and_sync_timestamps`. The workflow also performs one controlled test-app restart. There are no other intended mutations.

### Statistically and operationally valid sampling

The route limiter was inspected before redesign. It independently keys fixed-window buckets by socket source and bearer-proof fingerprint. The in-container calls all share the loopback source, whose default limit is 30 requests per 60 seconds; distinct identities or proofs cannot bypass that source cap.

The probe therefore collects exactly 200 measurements in seven batches: six batches of 30 and one batch of 20. It waits 61 seconds after each completed non-final batch, so every new batch begins more than one complete limiter window after the preceding batch's last request. It does not change or reset limiter configuration.

The measured population is:

- 20 `gateway_proof_cache_cold` calls, each using a fresh two-minute HS256 Strapi JWT with a unique `jti`, which exercises a real gateway proof-cache miss without additional process restarts.
- 90 sequential warm calls reusing the last cold proof in each batch.
- 90 concurrent warm calls reusing that same proof, in groups no larger than 14.

The single app restart is reported separately as `restartCount: 1`; the cold metric is deliberately named `gatewayProofCacheColdP95Ms` and is not represented as process-cold latency.

The pass predicate requires all exact sample counts, at least 99.5% success, gateway-proof-cache-cold p95 at most 5000ms, sequential warm p95 at most 1000ms, and concurrent p95 at most 1000ms. At 200 samples, 199 successes equal exactly 99.5% and pass; 198 equal 99% and fail. A mutation check temporarily weakened the implementation threshold to 99%, and the executable test failed as expected before the 99.5% predicate was restored.

Expected healthy execution is approximately 7–9 minutes. The six mandatory 61-second pacing intervals contribute 366 seconds. The per-call deadline is six seconds; a pessimistic calculation across all sequential calls, concurrent groups, pacing, selection, and the bounded restart/readiness wait is below 22 minutes. The SSH command timeout is 22 minutes and the job timeout is 25 minutes, providing a modest outer margin while still failing closed.

### RED evidence

Initial review contract and behavioral tests were written before the implementation change:

```text
cd tunes
npm test -- server/test/deployment/music-host-preflight.test.ts

Test Files  1 failed (1)
Tests       10 failed (10)
```

The failures covered missing deployment attestation, arbitrary Strapi-first selection, absent executable helper exports, absent credential validation, status-only success, insufficient sample size, and incomplete p95 gating.

The cancellation-settlement regression was then observed RED against the first implementation:

```text
Test Files  1 failed (1)
Tests       1 failed | 10 passed (11)
Expected: { success: false, latencyMs: 0 }
Received: { timedOut: true }
```

The fix makes cleanup cancellation best-effort and rejection-contained without awaiting it after the sample has already failed.

The exact success-rate boundary was mutation-tested by temporarily changing `>=99.5` to `>=99`:

```text
Test Files  1 failed (1)
Tests       1 failed | 10 passed (11)
Expected: passed false for 198/200
Received: passed true
```

Restoring `>=99.5` returned the focused suite to GREEN. A final RED/GREEN cycle also replaced the container-controlled `MUSIC_SLO_UNIT_TEST` switch with the workflow-owned `docker exec -e MUSIC_SLO_EXECUTE=1` execution marker, preventing container configuration from silently disabling the probe.

### Executable behavior coverage

The test extracts the exact Node heredoc from the parsed workflow, compiles it in a VM, and invokes the exported functions. These are behavior tests of the script that will execute in the container, not substring approximations of its validator or predicate. Covered cases include:

- valid complete payload and post-body-read latency;
- invalid JSON, missing version/identity, expired credential, empty token, non-JWT token, and extra top-level fields;
- stalled response body;
- rejected response body read plus rejected cancellation;
- never-settling cancellation after body timeout;
- 199/200 passing and 198/200 failing;
- cold, sequential warm, and concurrent p95 gates;
- a concurrent distribution whose p95 is 1001ms failing even when all requests return successful credentials.

Static workflow assertions remain for GitHub/SSH authority, immutable image attestation, exact branch and input gating, DB-first selection, limiter pacing, one restart, and the fixed aggregate-only output path.

### GREEN evidence

Final focused plus adjacent workflow security tests:

```text
cd tunes
npm test -- server/test/deployment/music-host-preflight.test.ts server/test/deployment/music-deploy-workflow-security.test.ts

Test Files  2 passed (2)
Tests       23 passed (23)
```

Scoped types:

```text
cd tunes
npm run music:types:scoped

> tsc --project tsconfig.music-c0.json --pretty false --incremental false
exit 0
```

Critical coverage:

```text
cd tunes
npm run test:music-critical-coverage

Test Files  24 passed (24)
Tests       548 passed | 1 skipped (549)
Statements  100% (1888/1888)
Branches    100% (1695/1695)
Functions   100% (274/274)
Lines       100% (1647/1647)
```

The final embedded Node heredoc was extracted and passed to `node --check -` (`exit 0`). The focused test parses the entire workflow with `js-yaml`. `git diff --check` also exited 0.

### Files and commits

- `.github/workflows/tunes-host-preflight.yml`
- `tunes/server/test/deployment/music-host-preflight.test.ts`
- `.superpowers/sdd/2026-08-25-complete-music-experience-restoration/task-10-report.md` (this appendix)

Implementation and tests: `3d31432 test(music): harden authenticated SLO evidence`.

This appendix is committed in the follow-up documentation commit containing the report. The two untracked `.gstack` files were neither modified nor staged.

### Concerns / external gate

- The workflow was deliberately not dispatched or deployed. Local tests prove the executable probe logic and workflow contract, but only an authorized manual test-server run against an explicitly attested commit can establish the real success rate and p95 values.
- The probe requires at least one active Music identity whose exact Strapi user/account remains eligible. Absence or mismatch fails closed with aggregate reason `no_provisioned_eligible_identity` and does not provision a replacement.
- The manual probe is intentionally long-running because the loopback source limit creates a hard lower bound above six minutes for 200 requests. Shortening the pacing would invalidate the result or weaken the production limiter.

## Published readiness binding live-run fix (2026-08-26)

### Live evidence and root cause

GitHub Actions run `32888146424` failed after the single controlled app restart and before identity sampling began. The SLO readiness loop curled `http://127.0.0.1:5000/health/ready` from the host. Port 5000 is the app's container-internal listener; this test deployment publishes that listener on host port 5001. The workflow's existing diagnostic, rollback, and deploy-readiness paths already use host port 5001, so the failure was isolated to the newly added SLO restart-readiness boundary.

Sanitized recovery run `32888360286` passed, establishing that the test app recovered and the deployment's published health path was available. It was not a completed 200-sample SLO run and is not reported as SLO qualification.

### RED evidence

The regression separates the pre-`docker exec` host shell from the embedded container probe. It requires the host readiness path to derive and validate the published `5000/tcp` binding and prohibits host use of `127.0.0.1:5000`, while independently requiring the in-container ensure client to retain `http://127.0.0.1:5000`.

```text
cd tunes
npm test -- server/test/deployment/music-host-preflight.test.ts

Test Files  1 failed (1)
Tests       1 failed | 11 passed (12)
Expected: published_binding_count from .NetworkSettings.Ports["5000/tcp"]
Received: host curl http://127.0.0.1:5000/health/ready
```

### Minimal fix

Before restart, the SSH script now reads `.NetworkSettings.Ports["5000/tcp"]` through `docker inspect` and fails closed unless:

- exactly one published binding exists;
- its host IP is `127.0.0.1` or `0.0.0.0`, both reachable through host loopback;
- its host port is one to five decimal digits in the range 1–65535.

The readiness URL is then built as `http://127.0.0.1:<attested published port>/health/ready`. On the current test deployment this resolves to host port 5001 without hardcoding it. The authenticated ensure measurements still execute through `docker exec` and still target the container-local `http://127.0.0.1:5000/api/music/identity/ensure` endpoint.

### GREEN evidence

```text
cd tunes
npm test -- server/test/deployment/music-host-preflight.test.ts server/test/deployment/music-deploy-workflow-security.test.ts

Test Files  2 passed (2)
Tests       24 passed (24)
```

The exact embedded Node heredoc passed `node --check -`, the focused test parsed the workflow with `js-yaml`, and `git diff --check` exited 0.

### Files and commits

- `.github/workflows/tunes-host-preflight.yml`
- `tunes/server/test/deployment/music-host-preflight.test.ts`
- `.superpowers/sdd/2026-08-25-complete-music-experience-restoration/task-10-report.md` (this appendix)

Implementation and regression: `cfb1fd6 fix(music): probe published readiness binding`.

This appendix is committed in the follow-up documentation commit containing the report. The untracked `.gstack` files were neither modified nor staged.

### Remaining external gate

The corrected workflow was not pushed or triggered in this fix. A new authorized run against an explicitly attested deployed commit is still required to establish the live 200-sample success-rate and p95 gates.

## Dual-stack published-binding follow-up (2026-08-26)

### Live evidence and diagnosis

GitHub Actions run `32888977145` was a manual dispatch on `codex/tunes-fingerprint-diagnostic` at commit `ddec74b227a21aaf84a919836cf2c32044828dbd`. GitHub reports conclusion `failure`, created at `2026-08-25T19:20:08Z`, updated at `19:20:19Z`, with the remote process exiting status 1 at `19:20:17.751Z`. The failed log contains the one-binding contract:

```text
published_binding_count="$(docker inspect --format '{{with index .NetworkSettings.Ports "5000/tcp"}}{{len .}}{{else}}0{{end}}' tunes-app-1)"
test "$published_binding_count" = 1
2026-08-25T19:20:17.7511098Z 2026/08/25 19:20:17 Process exited with status 1
```

The action intentionally did not print the inspected binding count, IPs, or ports, so the log cannot directly prove the exact topology. Its early exit is consistent with Docker's normal dual IPv4/IPv6 published entries being rejected by the new `count = 1` assertion. The workflow contract was therefore too narrow even though both entries can safely describe the same published port. This fix addresses that concrete contract defect without logging topology.

### RED evidence

The first command was invoked from the repository root with the wrong package runner and established only an environment invocation error, not the behavioral RED:

```text
pnpm exec vitest run tunes/server/test/deployment/music-host-preflight.test.ts

'vitest' is not recognized as an internal or external command
ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command "vitest" not found
```

The corrected focused command exercised the new regressions against the old single-binding implementation:

```text
npm test --prefix tunes -- server/test/deployment/music-host-preflight.test.ts

Test Files  1 failed (1)
Tests       4 failed | 11 passed (15)
```

The failures required the workflow to derive a validated selection from all published bindings, execute single/dual pass and invalid-input fail cases, and emit a sanitized pre-sampling failure stage. During the first implementation pass, one executable rejection regression remained red. It exposed that validation inside command substitution must not rely on the caller's `set -e`; each selector guard was then changed to explicit `|| return 1` fail-closed control flow.

### Minimal fix and safety contract

The pre-restart SSH shell now obtains newline-delimited `HostIp|HostPort` rows from Docker inspect and runs an executable Bash selector. It accepts exactly one or two rows only when:

- every IP is exactly `127.0.0.1`, `0.0.0.0`, `::1`, or `::`;
- every port contains one to five decimal digits and is in the range 1–65535;
- all rows have exactly one unique port.

The selector uses host loopback `127.0.0.1` whenever an IPv4 binding exists, otherwise bracketed IPv6 loopback `[::1]`. Missing bindings, more than two rows, unexpected IPs, malformed/out-of-range ports, extra fields, and different ports fail closed before restart. The in-container authenticated ensure probe remains unchanged at `http://127.0.0.1:5000`.

Pre-sampling shell failures now emit one aggregate JSON stage record with schema `music-identity-slo-stage/v1`, outcome `failed_closed`, and only a fixed stage name (`target_attestation`, `published_binding_attestation`, `restart`, or `restart_readiness`). It contains no raw binding values, response body, request ID, identity field, token, or secret. The trap is removed before the embedded identity sampler, whose existing aggregate-only output remains authoritative.

### GREEN and verification evidence

```text
npm test --prefix tunes -- server/test/deployment/music-host-preflight.test.ts

Test Files  1 passed (1)
Tests       15 passed (15)
```

```text
npm test --prefix tunes -- server/test/deployment/music-host-preflight.test.ts server/test/deployment/music-deploy-workflow-security.test.ts

Test Files  2 passed (2)
Tests       27 passed (27)
```

```text
npm run music:types:scoped --prefix tunes

> tsc --project tsconfig.music-c0.json --pretty false --incremental false
exit 0
```

The workflow parsed successfully with the repository's `js-yaml`; the complete extracted remote shell, including its Node heredoc, passed Git Bash `bash -n`; and `git diff --check` exited 0. The diff was reviewed to confirm the host readiness URL is derived, the internal ensure URL remains port 5000, and no deploy/dispatch behavior was added.

### Files and commits

- `.github/workflows/tunes-host-preflight.yml`
- `tunes/server/test/deployment/music-host-preflight.test.ts`
- `.superpowers/sdd/2026-08-25-complete-music-experience-restoration/task-10-report.md` (this appendix)

Implementation and executable regressions: `b414f21 fix(music): accept safe dual-stack readiness bindings`.

This appendix is committed in the follow-up documentation commit. The untracked `.gstack` files were neither modified nor staged.

### Self-review and concerns

- The selector contract is narrower than general Docker publishing by design: only one or two loopback/wildcard IPv4/IPv6 entries sharing one port are accepted. Unexpected topology fails before the controlled restart.
- Run `32888977145` did not expose the actual binding rows, so dual-stack is a strongly supported diagnosis from timing and workflow order, not a raw-log-confirmed topology fact. The fixed stage vocabulary will make a future early failure diagnosable without weakening data sanitization.
- This fix was not pushed, deployed, or triggered. The external live 200-sample SLO gate still requires an authorized manual workflow run against an explicitly attested test-app commit.
