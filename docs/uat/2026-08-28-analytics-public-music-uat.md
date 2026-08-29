# Analytics and public Music UAT evidence — 2026-08-29

## Verdict

**Not release qualified.** Read-only regression and contract evidence is strong, but the required two-context live-write UAT did not execute its 17 mutation journeys and therefore produced no before/after restoration hashes. No production, real Strapi, Redis, deployment, or `GATE_PROD` action was used.

Qualification base was `25cc0ee`; `origin/main` resolved to `9284a5dbc606979bb3607a7f5934f8b61519ebdc`. The branch was already current with `origin/main`. Harness remediation is commit `45fcc34` and has not been exercised with writes pending independent pre-write review.

## Environment and commands

- Windows PowerShell, Node/npm from the repository, Chrome/Playwright headless.
- Guarded services: PostgreSQL `tcp://127.0.0.1:55432`, mock Strapi `http://127.0.0.1:51337`, Tunes `http://127.0.0.1:55000`, Explorers `http://localhost:55173`, state service `http://127.0.0.1:55174`.
- Dedicated identity: `e2e-public-music-local-owner`, account `e2e-public-music-local-account`, user `e2e-public-music-local-user`.

| Command/lane | Exact result |
|---|---|
| `git fetch origin main:refs/remotes/origin/main`; `git rebase origin/main` | passed; already up to date |
| current HEAD `tunes: npm run check` | failed with broad TypeScript errors; same categories reproduced on detached `origin/main`, so recorded as baseline-attributed |
| current HEAD `tunes: npm test` | 1,582 passed, 72 skipped, 92 failed, 1 failed suite (99 files); migration-marker/deploy/fixture-secret/timeouts dominate; detached baseline reproduced the same categories before its attribution run was interrupted |
| `tunes: npm run test:music-critical-coverage` | 24 files passed; 551 passed, 1 skipped; 100% statements/branches/functions/lines |
| current HEAD OpenAPI + security + load focused Vitest | 3 files, 13 passed, 0 failed |
| repository integration coverage | safely refused: `MUSIC_C3_POSTGRES_TEST=1` and an explicitly owned destructive test database were absent |
| current HEAD `explorers-earth: npm run test:unit` | 190 files, 1,916 passed |
| current HEAD `npm run lint` | exit 0; 0 errors, 1,377 warnings |
| current HEAD `npm run i18n:check` | passed |
| current HEAD `npm run build` | passed, 5,397 modules; HTTPS-only Music transport contract |
| current HEAD `npm run test:music-critical-coverage` | 369 passed, but coverage threshold failed: 96.99% statements / 95.65% branches / 100% functions / 99.31% lines; detached `origin/main` passes 321 tests at 100%, proving a branch-owned gap |
| exact sanitized PR-safe Playwright lane at `e32ad35` | 251 passed, 45 explicitly skipped, 0 failed, 296 total; exit 0 in 16.8m |
| harness remediation focused PR-safe | 28 passed, 0 skipped, 0 failed |
| guarded local live attempt | Playwright: 31 passed, 17 skipped, 0 failed; runner failed closed because restoration evidence was absent |

## Timezone qualification

Fresh current-HEAD commands set `TZ` explicitly and ran the analytics date-range plus Home analytics suites. `UTC`, `America/New_York`, `America/Los_Angeles`, `Asia/Kolkata`, and `Pacific/Kiritimati` each passed 2 files and 28/28 tests (140 total). Coverage includes DST, leap day, inclusive 90-day behavior, 90-day Home labeling/failure states, and 93/94-day boundaries.

## Browser matrices and routes

Read-only deterministic coverage exercised friendly `/e2e-public-music-local-owner/music` and direct `/music/share/:publicSlug` routing, dashboard `/recommendations/music`, history/fallback behavior, five navigation slots, 32 permission combinations plus pairwise browser rows, loading/empty/error/private/unavailable states, analytics/UTM safety and exactly-once behavior, accessibility, reduced motion, and public/unlisted cache isolation.

Viewport contracts: `320x700`, `375x667`, `390x844`, `768x1024`, and `1440x900`. Theme structure covers six presets and four wallpaper modes. Six risk-based visual baselines live under `explorers-earth/e2e/*-snapshots`; failed-run trace/screenshots are retained under `explorers-earth/test-results`.

The one reviewed guarded attempt at `e32ad35` stopped before callback or business mutations because its combined preflight reported that authority was skipped or the expected mutation journeys did not collect. Standalone read-only diagnostics subsequently showed a null authority skip reason and all 48 live-project tests, including every required title, but the failed run retained no safe sub-result diagnostic to distinguish the child failure. It was not retried.

## Restoration and cleanup

Current attempt artifact: `explorers-earth/.artifacts/music-public/20260829041053317/evidence.json`.

- Preflight failed before callback/business mutations; live UAT is **not proven**.
- Initial snapshot restoration is proven: before and after `328835bdc95100d75ff52a873bfd697b5a03b1d2da1f9d5b842eeca75ec4efdd`.
- Evidence result is `failed`, cleanup is `restored`, and the command exited nonzero.
- Exact fixture-label inspection ended with `containersRemaining=0` and `volumesRemaining=0`; both private auth artifacts are absent and only sanitized `evidence.json` remains.
- No real account or external Strapi was used. No test-created durable fixture remains.

## Reviewer index

| Requirement | Test/lane | CI job | Sanitized artifact | Result | Commit |
|---|---|---|---|---|---|
| documentation/contracts | OpenAPI focused | `docs-contracts` | terminal totals | pass | branch HEAD |
| surface inventory | runtime inventory/critical | `static` | generated inventory | pass, 100% | branch HEAD |
| analytics/unit | unit + five TZ runs | `unit-coverage` | terminal totals | pass | branch HEAD |
| API contract | OpenAPI focused | `contracts` | terminal totals | pass | branch HEAD |
| repository | destructive integration | `database` | refusal output | evidence gap | branch HEAD |
| authority/privacy | security qualification | `security` | terminal totals | pass | branch HEAD |
| UI/build | lint/build/unit | `frontend` | terminal totals | pass with baseline warnings | branch HEAD |
| routing/a11y/visual | PR-safe Playwright | `browser` | snapshots/test-results | pass/read-only skips | branch HEAD |
| load | load qualification focused | `load-chaos` | terminal totals | pass | branch HEAD |
| rollout contract | build/image contracts | `image-deploy-contract` | build output | local build pass; no deploy | branch HEAD |

## Remaining concerns

Release remains blocked on a guarded live run that crosses preflight and executes every required journey, the repository/database lane with explicit disposable DB authority, the Explorer critical coverage threshold, and baseline repository check/test failures. Push, PR review request, merge, deployment, and production mutation are deliberately deferred.

The Explorer critical gap is specifically new `publicMusicClient.ts` behavior: playlist-envelope inconsistency (line 55), invalid recently-played song state (line 99), malformed/oversize/encoding request-response rejection and `PUBLIC_UNAVAILABLE` mapping (165–166), and descriptor parser rejection mapping (243). No code was edited after the safety-review round cap.

Final scan: `gitleaks` is unavailable locally. A fallback high-confidence diff scan found only deterministic test placeholders (`fixture-read-only-token` removals and `contract-fixture-token` addition), with no AWS/GitHub/Google/private-key material. The only reconciliation-named file is `music-reconciliation-workflow.test.ts`, whose diff changes an analytics fixture-token expectation only; no runtime user-sync or reconciliation implementation changed.
