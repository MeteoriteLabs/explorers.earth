# Ticket 1.3 local implementation report

Base: `9bd0973bba9681520a2cd8183281f76f8c07d946` (`codex/unified-replatform`). This report covers local work only. No push, PR creation, repository setting mutation, deployment, or secret-value inspection was performed.

## Result and ruling

CI now includes an `always()` aggregate named `replatform-required` that fails on any failed, cancelled, or skipped prerequisite. Main PRs, including drafts, and integration pushes run root/frontend/backend validation without a general path filter. The backend job provisions the disposable Ticket 1.2 fixture and runs domain/security, real PG integration and mounted route checks. Existing Music, image-scan, browser qualification and nightly/load lanes remain.

Ruling: The legacy `explorers.yml` static deploy is disabled until a recorded digest and source-revision-matched frontend artifact exists. Its former `workflow_run` authority built mutable output from the default branch and used SSH after any successful main CI completion; giving that job a manual confirmation alone would not meet the ticket's artifact contract. Its SSH calls are still in source but the job condition is constant false. This intentionally pauses that legacy release path; Epic 3.5/8 must replace it.

Ruling: Tunes image validation keeps its existing job name. It has read-only token permissions on PR/push and transfers the exact scanned image archive to a separate write-scoped publish job only for main `workflow_dispatch` with `release_production=true`. A read-only preflight requires a supplied successful main CI push run ID, matching dispatch `GITHUB_SHA` and successful `replatform-required` job. The reusable production job verifies the resulting digest and `GITHUB_SHA` before protected deployment. This transfer can hit GitHub artifact size limits; only a real release run can establish that operational limit. No ordinary push publishes or deploys.

## Trigger and credential audit before push

| Workflow | Trigger/ref/path | Credential and deploy conclusion |
|---|---|---|
| `ci.yml` | Main/develop PRs and main/develop/integration pushes; no path filters. Default checkout of event revision. | Read-only token. No SSH/deployment secrets or deploy calls. Aggregate requires all seven named lanes. |
| `test.yml` | All PRs; main/develop/integration pushes; scheduled and manual qualification. Default event checkout. | Read-only token; fixture PG, security, browser and image/deploy contract checks; no host deploy call. Optional load/chaos is nightly/manual. |
| `music-c0-contracts.yml` | Main PRs and main/develop/integration pushes on root/lock/backend/frontend/fixture/Compose/workflow/docs paths. Default event checkout. | Read-only token; contracts/types only. |
| `tunes.yml` | Main PRs and main/integration pushes on shared paths; manual dispatch. Default event checkout with C1 ancestry proof. | PR/push image build/scan has read-only token. Main explicit release dispatch requires matching successful CI aggregate before package/attestation write and protected production call with image digest and matching SHA. |
| `tunes-deploy.yml` | Reusable caller or direct manual bootstrap/rollback. Main ref and `GATE_PROD=open` preflight; `tunes-production` protected environment. Checkout event SHA. | SSH only in production job. Reusable deploy requires pinned Tunes main caller, exact `GITHUB_SHA` and GitHub/OCI provenance; direct dispatch remains limited to bootstrap/rollback. |
| `explorers.yml` | Manual trigger only; legacy job permanently skipped pending replacement. | Legacy repository `VITE_*`, SSH and SCP references are unreachable. No `workflow_run` trust bridge remains. |
| `music-reconcile.yml` | Main schedule hourly report-only; manual protected staging report/apply. Checkout event SHA. | Report production and staging environments contain named Strapi token references. Scheduled job is not apply or a release of the new stack; Epic 6 must retire this legacy path before canonical identity cutover. |
| `tunes-host-preflight.yml` | Confirmed manual main only. | `tunes-production` protected SSH, read-only inspection. |
| `tunes-test-direct-deploy.yml` | Confirmed manual main only; runtime expiry 2026-08-28. | Protected production SSH; expired and not used for QA. |
| `frontend-e2e-qualification.yml` | Scheduled/manual, event checkout. | Read-only browser evidence, no deploy. |

Read-only GitHub metadata on 2026-09-30: main `required_status_checks=null`, `enforce_admins.enabled=false`, rulesets `[]`. `tunes-production` has a required reviewer, prevents self-review and restricts to protected branches. No dedicated QA environment appeared in the environment list. `GATE_PROD` current effective value and host credential validity remain unverified. No secret values were read.

## Test evidence and limits

1. Red: `npm test --prefix tunes -- --run server/test/contracts/replatform-workflow-authority.test.ts` exited 1, five expected failures: integration push absent, aggregate absent, frontend `workflow_run` present, explicit release input absent, PR image job write permissions present.
2. Green: same targeted command exited 0, five tests passed.
3. A follow-up red test for release without a successful exact-SHA aggregate exited 1 as expected; release preflight was then added. A read-only existing GitHub CI run showed the API's `.path` is `.github/workflows/ci.yml`; a red test caught the initial incorrect `@` suffix check before it was fixed.
4. `npm test --prefix tunes -- --run server/test/contracts server/test/deployment/music-deploy-workflow-security.test.ts server/test/deployment/music-deployment-files.test.ts`: first run had 2 failures in assertions that expected old automatic push/publish placement; 702 passed, 3 skipped. Updated those assertions to the explicit release and scan-before-transfer contract. Final focused run exited 0, 40 passed. Final full `server/test/contracts` run exited 0, **671 passed, 3 skipped**.
5. `npm run music:types:scoped` exited 0. `npm run music:types:baseline` exited 0 while reporting **142 current TypeScript diagnostics and compiler exit 2**. `npm run check --prefix tunes` exited 1 with the known full type errors; no full-type green claim.
6. All 10 workflow YAML files parsed with `js-yaml`; `git diff --check` exited 0. `actionlint` was unavailable and was not installed solely for this ticket. YAML parse is not GitHub Actions semantic validation.

The broad Tunes `npm test --prefix tunes -- --maxWorkers=2` run began while final preflight changes were still being made. It reported one failure from an intermediate test assertion, then made no further progress for several minutes and was interrupted. It is **not a passing full-suite run**. The final contract directory and focused deployment contracts passed afterward. Remote CI, hosted Docker provision, E2E execution, image transfer, and environment gates are not verified by local static tests.

## Exact remote gates for controller

1. Independently review all source triggers, path filters, checkout revisions, job conditions, secrets, SSH calls, scheduled production work and workflow-call trust before pushing.
2. Push `codex/unified-replatform`, create a draft PR to main, and inspect real workflow run head SHA, conclusions, skipped jobs, artifacts and deploy job list. A feature branch PR must run validation and invoke no deployment. Resolve baseline failures openly; preserve existing checks.
3. After the exact `replatform-required` check appears in a real PR run, configure main protection to require that name, verify failed/skipped dependencies block merge, and record administrator bypass policy. Current source does not enforce this setting.
4. Create a QA environment limited to the integration branch with environment-scoped credentials before any later QA deploy is wired. This ticket does not define a QA deploy workflow or infer a QA hostname.
5. Keep production promotion separate. `tunes-production` protection is present, but the current `GATE_PROD` value and environment/host readiness need direct authorized review before release. The legacy frontend deploy remains paused until immutable artifact authority is implemented.
