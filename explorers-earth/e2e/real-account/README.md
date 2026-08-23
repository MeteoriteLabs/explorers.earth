# Protected public-profile verification

This project is a serialized release gate for one dedicated, non-production
account. Ordinary `npm run test:e2e` never discovers these files. Never use a
personal or production account and never paste storage state, tokens, API
responses, or recovery JSON into test output or an issue.

## Read-only guest run

Required names: `VITE_API_URL`, `VITE_PUBLIC_READ_ACCESS_TOKEN`, and
`E2E_PROFILE_USERNAME`. `E2E_PROFILE_ROUTE_FIXTURES` is a JSON contract with
`params`, every `enabledRouteIds` entry, `hiddenPath`, `deletedPath`, and an
`unknownUsername`; missing detail fixtures fail with `ROUTE_FIXTURE_INVALID`
instead of silently reducing coverage. After bootstrap, the declared IDs must
exactly match every live enabled and always-visible contract route, including
details; missing, extra, duplicate, or stale IDs fail with
`ROUTE_FIXTURE_COVERAGE_MISMATCH`. The capability must expose published reads only.
Detail parameters are typed: `placeSlug`, `guideSlug`, `movieGenreSlug`,
`bookSubjectSlug`, `gameGenreSlug`, `peopleSectorSlug`, and separate
`movieListSlug`, `bookListSlug`, `gameListSlug`, `appListSlug`,
`productListSlug`, and `peopleListSlug`. Global setup proves each identifier
exists in its matching published collection response; shared `listSlug` is rejected.

```text
npm run verify:public-profile:env -- --mode=read-only --json
npm run verify:public-api -- --username=<published-username> --json
npm run test:e2e:real-account:read-only
```

This opens enabled public routes as a clean guest at 375×812 and 1440×900.
Evidence contains only GraphQL operation name, HTTP status, and stable error
code. Authorization headers, variables, URLs with query/hash, console text,
and response data are not retained.

## Mutation run

In addition to the read-only names, configure all names reported by
`npm run verify:public-profile:env -- --mode=mutation --json`, including:

- `E2E_PROFILE_STORAGE_STATE` and `E2E_PROFILE_NON_OWNER_STORAGE_STATE`
- `E2E_PROFILE_LIVE_WRITES=1`
- `E2E_PROFILE_LIVE_WRITE_CONFIRMATION=I_APPROVE_PROFILE_MUTATION_AND_RESTORE`
- `PUBLIC_PROFILE_MUTATION_APPROVED=true`
- `PUBLIC_PROFILE_TEST_ACCOUNT_MARKER=public-profile-mutation-fixture`
- independent `VITE_ANALYTICS_WRITE_ACCESS_TOKEN`
- a `qa-`/`qa_` analytics sink, run ID, canary, cleanup, and cleanup verifier
- `E2E_PROFILE_GALLERY_FILE` plus owner and non-owner storage states
- run-wide browser-event cleanup/remaining documents using aliases `cleanup`
  and `remaining`

`PUBLIC_API_RUN_ID` and `E2E_PROFILE_RUN_ID` must be the same unique value
starting with `qa-` or `qa_`. The protected GitHub Actions job derives both as
`qa-ci-<workflow-run>-<attempt>`; a bare workflow run number is rejected.

In protected GitHub Actions, store each Playwright storage state as the complete
JSON object in `E2E_PROFILE_OWNER_STORAGE_STATE_JSON` and
`E2E_PROFILE_NON_OWNER_STORAGE_STATE_JSON` secrets. Store the gallery fixture in
`E2E_PROFILE_GALLERY_BASE64` as strict base64 for a complete PNG, JPEG, GIF, or
WebP image of at most 10 MiB, at most 8,192 pixels on either axis, and at most
33,554,432 total pixels. CI uses overflow-safe dimension checks and structurally validates bounded
chunks/segments/blocks, and each format's required end marker before writing.
PNG validation additionally checks critical-chunk order, non-empty IDAT data,
and every chunk CRC. Only after validation are
those values written to user-restricted
files under the operating-system temporary directory, derives the gallery file
extension from its validated PNG/JPEG/GIF/WebP signature so Playwright uploads
the matching type, exposes only paths to Playwright, and removes that directory
in an `always()` step. Secret values
must never be supplied directly as `E2E_PROFILE_*_STATE` or gallery path values.

Before any browser/account callback, global setup writes a harmless isolated
`qa-preflight-*` canary and proves the run-wide cleanup mutation and
zero-remaining query. Failure is `ANALYTICS_RUN_CLEANUP_UNAVAILABLE`.
Cleanup and verification are retried from `finally` after every canary write
attempt. A timeout, transport throw, null body, or unparseable/lost
acknowledgement is treated as a possible server-side commit: the run-ID-scoped
emergency cleanup and zero-remaining query still run, the primary failure still
blocks every browser callback, and a restrictive OS-temporary recovery artifact
is retained with redacted identifiers and a truthful residual-unverified flag.
If permission or disk failure prevents that artifact from being written, setup
still returns the redacted blocker with `RECOVERY_ARTIFACT_WRITE_FAILED`, omits
an artifact path, and truthfully reports that recovery evidence is unavailable.

Run `npm run test:e2e:real-account`. Global setup fails before any test body if
one prerequisite is absent. Groups run one at a time and stop on the first
restoration or analytics-cleanup failure.

## Backup and restoration contract

Immediately before each group, the suite copies only `Bio`, `bg_picture`,
`profile_picture`, `Feed_Data`, `social_media`, and `public_profile` into a versioned
JSON artifact below the operating-system temporary directory. Its directory
and file permissions are restricted to the current user. It never contains
credentials, identity/contact fields outside the mutable projection, storage
state, headers, or raw responses.

Before mutation, the suite captures actual Profile and Appearance control
values and proves every restore control exists, is enabled, and accepts the
captured value. Mutation never begins if that dry-run contract fails. Normal
restore replays those captured values through the same visible controls; one
emergency retry uses the same independently verified path. It then verifies
the allowlisted account state through successful public GraphQL operations and
the rendered public UI. The artifact is deleted only after both
checks succeed. `RESTORE_FAILED` retains it and aborts every later mutation.
Analytics events are stamped with `PUBLIC_API_RUN_ID`; cleanup or verified
reporting exclusion is mandatory and `ANALYTICS_CLEANUP_FAILED` blocks release.

Crash recovery:

1. Do not rerun mutation tests.
2. Locate the newest `explorers-profile-recovery-*` directory under the OS
   temporary directory. Do not print or copy its contents.
3. Restore only the six allowlisted fields through the authenticated Profile
   dashboard of the dedicated fixture account.
4. Run the read-only verification below and visually compare the public root
   and enabled categories to the approved baseline:

```text
npm run verify:public-api -- --username=<published-username> --json
npm run test:e2e:real-account:read-only
```

5. Delete the retained artifact only after API and public UI verification.

Stable blockers include `ENV_MISSING`, `PUBLIC_READ_UNAUTHORIZED`,
`PUBLIC_READ_FORBIDDEN`, `ACCOUNT_MARKER_MISMATCH`,
`LIVE_WRITE_NOT_APPROVED`, `ANALYTICS_CANARY_REQUIRED`, `RESTORE_FAILED`, and
`ANALYTICS_CLEANUP_FAILED`.
