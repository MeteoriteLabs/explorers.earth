# Unified Explorers implementation plan

**Current execution order (2026-10-05):** follow the [re-groomed recovery plan](../superpowers/plans/2026-10-05-replatform-regroomed-execution.md) and [durable ledger](../../.superpowers/sdd/epic-01/progress.md). Tickets1.1–1.4 and2.1–2.3 are complete; see the [checked status summary](current-status-2026-10-05.md). Preserve these accepted foundations and bounded Books/Movies/manual Games/analytics results; new navigation/lifecycle overlays still need their stated review and exact-commit gates. Music 6.1 startup can proceed before unrelated categories. Required all-category QA remains open until its actual producers land. Planning checkboxes remain requirements, not completion records.

**Goal:** evolve Tunes into the unified backend while preserving the existing Explorers experience, then add ChatGPT through the same application services.

**Architecture:** existing React frontend; TypeScript modular backend, fresh PostgreSQL database and reviewed migrations; Better Auth with Google-only login; separate login identity and account-owned content. Shared entities plus account-owned recommendations; retained Music domain behavior. One integration branch, local-first testing, QA on the former Tunes host and production on the main host.

**Sources:** Explorers main at `79ef17d0b88c7e11b49d618fc7c888a513f29fa8`; Strapi main at `50b6c6e180de4a1290b0c0a3c8450ac5947566d5`. [Agreed direction](revised-direction.md), [backlog](epics-and-tickets.md), [Strapi schemas](strapi-schema-inventory.md), [original runtime inventory](source-inventory.md).

**Review:** all 38 tickets are covered across ten individual plans. See [review findings and resolved dependencies](plan-review.md). Read the [shared execution checklist](execution-checklist.md) for current handoff and verification requirements; the ledger records actual implementation evidence.

**Final grooming gate:** read [readiness, S3 delivery and external inputs](readiness-and-inputs.md) before authorizing implementation. The second independent review corrected six feature-contract gaps and deployment/media details. Google OAuth, AWS delivery policy, QA routing/access and repository configuration still require closure; secret-name presence is not proof of readiness.

## Database source of truth

Read the [consolidated target database schema](target-database-schema.md) before schema work. It includes application columns, keys, constraints, indexes, lifecycle rules, existing Music transformations, field mappings and scale/restore qualification. Better Auth physical generation remains an explicit version-qualification gate; no migration has been applied.

## Read and execute order

Each epic and each of the 38 tickets has its own document. Use the [individual ticket index](ticket-index.md) to open any ticket. Ticket files include their implementation steps and acceptance criteria, and link to the parent epic for shared contracts and harness prerequisites. `[ ]` indicates planned work, never completed work.

| Milestone | Epic plan | Depends on |
|---|---|---|
| 1 | [1. Local development and safe CI](epics/epic-01.md) | Agreed scope |
| 1 | [2. Google identity and accounts](epics/epic-02.md) | 1 |
| 1 | [3. Core recommendations and Books](epics/epic-03.md) | 2; QA ticket uses 1's deployment boundary |
| 2 | [4. Catalog categories](epics/epic-04.md) | 3 |
| 2 | [5. Places and Guides](epics/epic-05.md) | 3 and linked Products/People from 4 |
| 2 | [6. Music identity and parity](epics/epic-06.md) | 2's principal contract, 3's backend foundation |
| 2 | [7. Cross-category completion](epics/epic-07.md) | 4–6 |
| 3 | [8. Retirement and deployment](epics/epic-08.md) | Milestone 2 evidence |
| 4 | [9. Public ChatGPT discovery](epics/epic-09.md) | Milestone 3 |
| 4 | [10. Linked creator tools](epics/epic-10.md) | 9 and shared web commands |

Execute ready prerequisites using the re-groomed dependency order: shared repair review, lifecycle acceptance and Music principal startup, independent category packages, then full public/analytics parity. Category work can be parallelized only after shared contracts are fixed and file ownership is clear. Parallel planning does not require parallel implementation. Avoid simultaneous edits to auth, shared schema or deployment authority without coordination.

## Invariants across every ticket

1. Existing Explorers visual design, navigation and working behavior remain; Google-only login is the explicit exception. Backend wiring may change.
2. One user initially owns one account. Accounts own profile/recommendations/guides/Music, with membership designed for future expansion but no switching UI now.
3. A fresh database removes historical migration, not transactional, authorization, lifecycle or recovery requirements.
4. No followers/community, new admin UI, monetization or revived retired integrations. Public profiles remain.
5. Separate databases, volumes and application secrets; one shared Google OAuth client and one S3 bucket with environment prefixes. Existing AWS credentials may be reused after permission checks; do not equate shared-principal prefix naming with IAM isolation. No test writes against production. Existing secrets are configuration inputs, not evidence of verified access.
6. Update CI with code. Before pushing, prove validation does not deploy unfinished code. Manual workflow dispatch is not automatically safe merely because it is manual.
7. Keep package paths under `tunes` until Epic 8; rename to `apps/api` there. Later plans use the renamed path. No unnecessary frontend folder move.
8. Unexecuted, skipped or mocked checks are not full-stack/live-provider success. Report them distinctly.
9. No user approval is required per ticket once implementation is authorized; milestone reports include optional owner UAT. Production promotion/publication remain explicit release decisions.

## Testing and evidence contract

| Layer | Required evidence and scope |
|---|---|
| Static/build | Relevant TypeScript, lint, contract/schema checks and production build; record existing baseline failures rather than silently suppressing them |
| Unit/domain | Validation, ownership policy, visibility, entity resolution, revisions/idempotency, event/privacy logic |
| Database integration | Disposable authorized PostgreSQL; real constraints/transactions/rollback and cross-account reads; test selection must execute, not skip |
| HTTP integration | Cookie/session/CSRF, authenticated/anonymous DTOs, pagination, uploads, rate limits and provider failure translation |
| Automated E2E | Real web + API + disposable DB, fixture users through a test-only authority; create/edit/publish/reload and anonymous/other-owner results |
| Browser acceptance | Agent-controlled actual screens, desktop/mobile navigation/forms/errors; screenshots/traces when useful; optional owner testing |
| Real integrations | Google callback and representative catalog/media/Music provider checks using QA configuration; fixture simulations recorded separately |
| Accessibility | Keyboard flow, focus, labels and critical contrast/semantic regressions on touched screens; automated accessibility checks where available, plus browser inspection |
| Performance | Baseline and repeat representative public list/detail, category search and Music/socket behavior with the same dataset; set justified limits before acceptance, no invented universal target |
| Security boundary | Other-owner and private-resource denial, unsafe upload/URL handling, no frontend provider secrets, revoked/suspended access and redacted artifacts |
| Operational | CI trigger behavior, immutable QA artifact, cookies/socket proxying, health/readiness, backup/restore and release gating |

The existing category Playwright tests often stub GraphQL and authentication. Retain them as UI regression checks while adding an explicitly real-API suite. The existing Music database harness requires authority/flags and can otherwise skip; execution counts and non-skipped required suites are part of the pass criteria.

### Milestone report format

- Scope delivered and tested commit/artifact.
- Local automated checks: passed/failed/blocked with executed test counts.
- Real-API E2E and browser acceptance: scenario results and evidence links.
- Remote CI: actual run status; do not substitute local status.
- QA deployment/integrations: tested environment and provider coverage.
- Defects, skipped checks and limitations, each with owner/next action.
- Optional owner demo steps; no assumption of owner sign-off.

## Grooming rules

For each ticket, confirm the file scope and shared interfaces against the pinned source before implementation. If actual main changes, refresh the baseline and explain meaningful drift. Proposed files are explicitly new; current files must resolve. Proposed commands must be implemented by their owning prerequisite before later tickets use them.

The detailed plans identify package-compatibility or external-config qualification steps where source alone cannot establish behavior. Those are executable prerequisites, not permission to invent supported library APIs. A ticket blocked on provider access remains blocked and cannot be counted complete through mocks.

Implementation plans are review artifacts. They may contain proposed schema and test file names, but no migrations, new runtime modules, or production configuration have been created by this planning task.

## Latest hosting agreement

Self-hosted PostgreSQL runs alongside the app on each existing host; no Amazon RDS or additional database service. Promote the same QA-tested artifact to production only at the release step, using runtime configuration and production migrations, never QA content. See the [owner setup checklist](owner-setup-checklist.md) for remaining input ownership.

**Auth qualification update:** [Pinned Better Auth schema and local probe results](auth-schema-qualification.md) now resolve the generated-schema uncertainty. Application integration, live Google callbacks, recovery negative tests and later delegated issuance/revocation remain named acceptance work.
