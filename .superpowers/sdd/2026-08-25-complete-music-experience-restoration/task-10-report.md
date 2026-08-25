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
