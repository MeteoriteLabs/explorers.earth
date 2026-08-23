# Public Profile Routing, Data, and Analytics QA Report

Date: 2026-08-23 (Asia/Calcutta)

Branch: `codex/profile-dashboard-public-profile`

Runtime: Node `v24.14.0`, npm `11.9.0`, Playwright `1.61.1`

## Verdict

Deterministic verification is green. Live public-read and protected real-account
UAT are **release-blocked**, not passed or skipped: the safe read-only environment
doctor returned `ENV_MISSING` because `VITE_PUBLIC_READ_ACCESS_TOKEN` is absent.
No live API probe, browser callback, analytics mutation, account mutation, or
restore callback was executed after that blocker.

## Deterministic evidence

Commands ran from `explorers-earth/` on the final working tree unless noted.

| Gate | Exact command | Result |
|---|---|---|
| Orchestrator/contract | `npm run test:public-profile-contract` | 84 passed, 0 failed |
| Deterministic dry run | `npm run verify:public-profile -- --dry-run --json` | `DRY_RUN`; 11 child commands listed, none executed |
| Protected dry run | `npm run verify:public-profile:release -- --username=tk2727 --dry-run --json` | `DRY_RUN`; 4 ordered preflight/journey commands listed, none executed |
| Lint | `npm run lint -- --quiet` | 0 errors, 0 warnings |
| Application TypeScript | `npx tsc -b` | exit 0 |
| Unit-test TypeScript | `npm run typecheck:test` | exit 0 |
| E2E TypeScript | `npm run typecheck:e2e` | exit 0 |
| Translation parity | `npm run i18n:check` | all translation files synchronized |
| Unit suite | `npm run test:unit -- --reporter=verbose` | 188 files, 1,533 passed, 0 failed, 39.71s |
| Pure/state coverage | `npm run test:public-profile:coverage` | 132 tests; 100% statements/branches/functions/lines (123/123 branches) |
| Legacy integration coverage | same command | 42 tests; 77.52% branches, reported separately and truthfully |
| Build | `npm run build` | exit 0; 5,313 modules; Vite build 12.41s |

The focused bootstrap regression suite also passed 6/6 after preserving the
synchronous single-flight retry behavior and documenting its promise-identity
assignment for ESLint.

### Corrective harness review

The independent Task 8 review found four release-harness defects and two test/
baseline defects. The corrective pass now:

- uses the exact run-cleanup prerequisite names and one matching unique
  `qa-ci-<workflow-run>-<attempt>` run ID for API and browser evidence;
- validates and materializes owner/non-owner storage JSON plus a base64 gallery
  image into restrictive OS-temporary files, exposes paths only, and cleans up
  in an unconditional CI step;
- bounded-captures child output, emits only allowlisted blocker codes/artifact
  paths in JSON mode, and recovers structured Playwright exit-one evidence;
- requires deterministic HTML, JSON, and JUnit outputs and each protected JSON
  summary independently while treating failure media as optional;
- proves fake CI-shaped placeholders cannot be mistaken for a live capability;
- retains the Earth bootstrap assertion and then proves the authenticated
  `Public profile editor` tablist and `Appearance` tab actually settle.

Fresh corrective evidence: targeted orchestrator/CI contracts 15/15, complete
contracts 84/84, protected project discovery 10 tests (list-only), focused
authenticated theme browser test 1/1, unit 1,533/1,533, pure coverage 123/123
branches, legacy coverage 77.52%, lint, all three TypeScript gates, i18n, and
build. Both orchestrator dry-runs passed. The live doctor still returned the
same `ENV_MISSING`, so no protected callback or mutation ran. The sitemap hash
is byte-identical to the pre-Task-8 baseline (`c8747103e7d16e2b8d466ecb20baa18d2819a115`).

### Corrective harness review round 2

The second review found two remaining Important gaps and one Minor cleanup gap.
All verification-result exit codes, protected reporter codes, and global-setup
blockers now share one source-defined catalog. Exit-one JSON and nested protected
summaries preserve each failure code—including `PUBLIC_API_TRANSPORT_ERROR`,
`PUBLIC_API_MALFORMED`, `SECURITY_PROOF_MISSING`, and
`PROTECTED_TEST_FAILED`—plus the safe artifact and next command, without keeping
private child output. A drift contract enumerates every producer category.

Gallery base64 now has a validated PNG/JPEG/GIF/WebP signature and a matching
`.png`, `.jpg`, `.gif`, or `.webp` OS-temporary upload path. Unsupported RIFF
content is rejected. Temporary directory creation, permission hardening, file
writes, and CI environment publication are cleanup-guarded; injected chmod and
environment-publication failures both prove no secret directory remains.

Fresh round-2 evidence: 34/34 focused harness/reporter contracts, 86/86 complete
contracts, deterministic/protected no-process dry-runs, protected list-only 10
tests, unit 188 files/1,533 tests (47.09s), lint, application/test/E2E TypeScript,
i18n, and build (5,313 modules; 9.18s). The read-only doctor remains
`ENV_MISSING`; protected execution and live mutations were not run.

### Independent deterministic browser files

Each affected file ran independently before the complete project:

| File | Result | Duration |
|---|---:|---:|
| `e2e/profile-editor-polish.spec.ts` | 26 passed | 1.1m |
| `e2e/profile-presentation-visual.spec.ts` | 7 passed | 1.2m |
| `e2e/profile-settings-persistence.spec.ts` | 1 passed | 8.3s |
| `e2e/profile-theme.spec.ts` | 11 passed | 5.4s |
| `e2e/public-profile-adaptive-surface.spec.ts` | 45 passed | 2.6m |
| `e2e/public-profile-route-contract.spec.ts` | 59 passed | 5.9m |
| `e2e/public-route-skeleton-geometry.spec.ts` | 1 passed | 6.9s |
| `e2e/protected-harness-contract.spec.ts` (deterministic project) | 3 passed | 1.5s |

The first `profile-theme` run exposed one stale wordmark assertion: the page
correctly rendered the approved Earth bootstrap instead of the removed literal
wordmark. That assertion was corrected to the current branded bootstrap and
authenticated navigation contract, then the file passed 11/11.

Complete project: `npm run test:e2e` -> **181 passed, 2 intentional pre-existing
skips, 0 failed, 12.5m**. The skips are the existing Guides portal multi-select
case without a stable hook and Locations Gemini/async category injection case;
neither is a public-profile route/settings assertion.

Artifacts:

- `explorers-earth/playwright-report/deterministic/index.html`
- `explorers-earth/test-results/playwright/deterministic/summary.json`
- `explorers-earth/test-results/playwright/deterministic/junit.xml`
- failure media, when present: `explorers-earth/test-results/playwright/deterministic/failure-artifacts/`

Expected fault-injection cases intentionally emit classified Apollo, REST,
Google Maps, recommendation, and retry diagnostics. Assertions and the network
audit distinguish these injected failures from unexpected traffic. The legacy
category fixture files remain noisy; this is a diagnosability risk, not a waived
failure.

## Live/protected release blocker

Safe preflight:

```text
npm run verify:public-profile:env -- --mode=read-only --json
=> code=ENV_MISSING, publicReadSource=missing, apiUrl=present
```

Because the preflight failed, `npm run verify:public-api -- --username=tk2727`
was not run. The protected real-account command was exercised only through its
no-process `--dry-run`; its guest/owner/non-owner, analytics, save/restore, and
cleanup claims remain pending. Supply independently scoped non-production
capabilities and every protected account/recovery prerequisite documented in
`explorers-earth/e2e/real-account/README.md`, then run:

```text
npm run verify:public-profile:release -- --username=<published-test-username>
```

## Manual Chrome UAT checklist (pending)

Use the dedicated non-production account and Chrome. Do not continue after any
restore or analytics-cleanup blocker.

- Guest/incognito: open the profile root and every enabled category/detail/list/map URL; confirm published data and media load.
- Guest redirects: try unsupported, hidden, deleted, unpublished, extra-segment, query, and hash URLs; confirm one replace-navigation to `/:username`, while an unknown username remains Not Found.
- Guest states: confirm successful empty categories remain on their category URL; force 401/403/429/500/network failure in the approved environment, confirm scoped Retry stays on the URL, and confirm Retry recovers without an Earth/skeleton stack.
- Loader journey: hard-refresh a public category (Earth bootstrap, then one skeleton/content); navigate internally (stable shell, one target skeleton); background-refresh (content retained).
- Themes: visually inspect all 6 presets x 4 wallpaper modes at 375x812 and 1440x900, including absent/broken hero, avatar viewer, bio rich text, tabs, footer branding, contrast, RTL, 200% zoom, and horizontal overflow.
- Dashboard owner: save representative accent, First View, layout/order, visible tabs, footer, bio/social, and gallery values; hard-refresh dashboard and public root/category and compare persistence.
- Non-owner: open the same public routes with a separate session; confirm owner-only controls are absent and content parity remains.
- Analytics: verify GA path events and application route/card/share events use the expected route identity and stable resource ID; confirm owner suppression and non-owner/guest behavior.
- Recovery: verify exact account restoration publicly and confirm run-ID analytics cleanup/zero remaining events before deleting the recovery artifact.

## CI and isolation

Normal PR CI runs deterministic contract, app/test/E2E type checks, i18n, and
the deterministic Playwright project. HTML, JSON, JUnit, and optional failure
artifacts have explicit retention and `if-no-files-found` policies. Protected
release verification is an explicit `workflow_dispatch` environment job and
cannot be satisfied by fixture or legacy shared tokens.

`git diff --check` passed. `git diff --quiet origin/main...HEAD -- tunes/`
returned 0, and a case-insensitive ownership-marker scan found no changed path
matching `tunes/`, Local-Tunes, or user-sync. Task 8 adds no secret, storage
state, private response, or mutable account snapshot.

## Remaining risks

- Live public-read permission, least-privilege boundary, rate-limit policy, and real published data are unproven until `ENV_MISSING` is resolved.
- Owner/non-owner analytics behavior and exact save/restore remain deterministic-contract proof only until protected UAT completes.
- The production bundle remains large and emits existing chunk/dynamic-import warnings; the build succeeds, but performance optimization is separate work.
- Deterministic legacy fixtures emit substantial expected console noise, which can make human log review slower even though strict public-route audit cases fail closed.
