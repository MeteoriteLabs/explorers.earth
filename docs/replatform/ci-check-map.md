# Replatform CI and release authority

Ticket 1.3 source configuration on `codex/unified-replatform`. Source configuration is not branch protection. The main branch currently has no required status checks or rulesets; the exact `replatform-required` check must be observed in a real PR run before it can be required in repository settings.

## Validation and check names

| Workflow | Events and path scope | Check / purpose |
|---|---|---|
| `CI Pipeline` (`ci.yml`) | Every PR targeting `main` or `develop`, including drafts; pushes to `main`, `develop`, and `codex/unified-replatform`; no path filter | `🔍 Lint`, `🔷 TypeScript`, `🧪 Unit Tests`, `🏗️ Build`, `🔗 Integration Tests`, `🎭 E2E Tests`, `Replatform backend and local fixture`, and `replatform-required`. The last job uses `always()` and fails if any dependency is failed, cancelled, or skipped. |
| `Music contract and qualification CI` (`test.yml`) | Every PR; pushes to `main`, `develop`, and integration branch; nightly and manual `pr`/`nightly` lanes | Existing docs, scoped/baseline types, unit/domain, real PG, security, frontend, browser and image/deployment contracts. Load/chaos remains nightly/manual. Its checks remain useful independent evidence; they are not presently included in the `CI Pipeline` aggregate. |
| `Music C0 contracts` (`music-c0-contracts.yml`) | Main PRs and pushes to main/develop/integration when root lock, backend, frontend, fixtures, local orchestration, Compose, workflows or docs change | Linux and Windows contract/type baseline, plus Linux Compose config. |
| `Tunes immutable image CI` (`tunes.yml`) | Main PRs and pushes to main/integration when shared, backend, frontend, fixture, Compose, workflow or relevant docs paths change; manual dispatch | Builds and scans without registry write on PR/push. Only an explicit `release_production=true` dispatch on main with a successful `CI Pipeline` push run ID for the exact SHA can publish the qualified image and call production deploy. |
| `Frontend E2E qualification` (`frontend-e2e-qualification.yml`) | Scheduled and manual | Deeper contained browser matrix with uploaded evidence; not a PR required check. |

The aggregate is intentionally strict: `lint`, `typecheck`, `unit-tests`, `build`, `integration-tests`, `e2e-tests`, and `backend-validation` must all conclude `success`. An unexpectedly skipped job fails it. The bounded PR browser suites and real PG fixture commands are named in `ci.yml`. The backend job provisions the attested local Compose project, seeds the current Music identity, runs real PG integration and route checks, and stops services. That identity is the current-domain seed only; canonical account/profile/content acceptance seeds are owned by later tickets. Existing coverage, security and image scan checks remain in their existing workflows. A real run must establish whether the new fixture job fits hosted runner time and storage limits.

The currently observed `music:types:baseline` command compares against 142 known TypeScript diagnostics and exits zero while reporting compiler exit 2. It is a regression comparison, not proof that the full Tunes typecheck is green. The frontend `typecheck` job uses `tsc -b` and remains a hard check.

## Release and credential boundary

| Workflow | Authority and checkout | Credentials / deploy calls |
|---|---|---|
| `explorers.yml` | `workflow_run` was removed. Its legacy static deploy job is disabled because it has no recorded immutable artifact digest or source-revision verification. Manual dispatch cannot run that job. | Dormant job still contains legacy repository-scoped `VITE_*`, SSH and SCP references. No job receives them on a PR. Epic 3.5/8 must replace this with the environment-neutral digest-based release. |
| `tunes.yml` → `tunes-deploy.yml` | Manual `release_production=true` on `refs/heads/main` only. A read-only preflight checks the supplied CI run ID: main push, `ci.yml`, exact `GITHUB_SHA`, successful run and successful `replatform-required` job. Validation builds/scans one image; an artifact transfers that image to the write-scoped publish job. The publish job records a GHCR digest and attests source SHA. The reusable deploy compares its commit input with `GITHUB_SHA`, requires the pinned main caller, verifies OCI attestation source digest, and enters protected `tunes-production` only after `GATE_PROD=open` and policy preflight. | Validation/preflight jobs have read-only token; publish has package/attestation write. SSH host/key enter only the reusable deploy. Existing direct `tunes-deploy.yml` dispatch is limited to protected bootstrap/rollback. |
| `music-reconcile.yml` | Hourly scheduled production **report-only** from main; manual staging report/apply is separately guarded and uses reviewed checkpoint authority. Checkout uses event SHA. | `music-reconciliation-production-report` has live token names; staging jobs use their own environments. Retire legacy reconciliation with Epic 6 before canonical identities replace its inputs. |
| `tunes-host-preflight.yml` | Main-only confirmed manual, read-only host inspection | Uses protected `tunes-production` and SSH. |
| `tunes-test-direct-deploy.yml` | Main-only confirmed manual, but preflight rejects after 2026-08-28 | Uses protected `tunes-production`; expired and not a QA release path. |

All PR validation uses default checkout of the PR merge revision except workflows that explicitly request `github.sha`; these are still event SHA. No `workflow_run` deploy consumer remains. The scheduled reconciliation is separate production work and must not be interpreted as a release of the new stack. Production environment metadata read on 2026-09-30 shows `tunes-production` restricted to protected branches with one required reviewer and `prevent_self_review`; `GATE_PROD` value and credential validity were not read. No dedicated QA environment was found.

## Remaining remote gate

After independent static trigger review, push the integration branch and create a draft PR. Inspect each real run's head/source SHA, conclusions, skipped jobs, artifacts, and deployment job list. Resolve actual failures without removing checks. Then configure a main rule requiring the exact observed `replatform-required` status, record whether administrators can bypass it, and verify a failing/skipped dependency blocks merging. Create a QA environment restricted to the integration branch with environment-scoped credentials before any QA deployment is wired. These repository settings and remote runs are not established by this local source change.
