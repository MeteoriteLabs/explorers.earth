# Ticket 7.3: All-category regression and milestone evidence

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-07.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** waiting. **Technical inputs:** 2.4, 3.5, 7.1, 7.2. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Run full retained regression only after reviewed producers; preserve required red positives and publish exact-source evidence, not fixture aggregates.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Grooming focus:** the complete affected frontend suite and each package's clean isolated install/build/test are required before review. Any claimed baseline failure needs the same check reproduced on the base commit. Define real-API fixtures before dependent acceptance and keep mocked UI, provider simulation and hosted gates distinct in the report.

**Depends on:** 7.1/7.2 and all preceding functional gates; consumes, rather than replaces, per-ticket tests.

**Existing:** all category E2E specs, dedicated public/theme/Music configs, package scripts and CI jobs qualified by Epic 1. **Create:** `docs/replatform/evidence/milestone-2.md` during execution; the evidence document contains actual run results, not prefilled PASS entries.

- [ ] Run the complete frontend unit suite, backend unit suite and applicable disposable-database integration suite using existing package scripts; preserve required coverage gates or replace obsolete paths with equivalent behavioral coverage in the same change.
- [ ] Run all new real API scenarios using `npm run platform:test:e2e -- --suite all --milestone 2 --project desktop-chromium --environment local`; run retained Music full-stack/capability suites through the commands pinned by Epic 6.
- [ ] Run applicable baseline presentation suites, keyboard/accessibility checks and desktop/mobile visual comparisons. Fail on unexpected required scenario skips; record baseline defects separately.
- [ ] On QA, exercise Google login and each external provider with nonproduction configuration. Record provider quotas/outages as blocked checks, not successful fixture tests.
- [ ] Drive all nine categories and profile/settings/analytics/claim flows in the browser. Record expected versus actual behavior, screenshots/traces where useful, environment and exact tested commit; no claim of owner sign-off.
- [ ] Capture a network log proving retained runtime flows no longer require Strapi. Separately verify environment-neutral canonical URL output from static generation; the inspected generator has no established live Strapi fetch. Categorize remaining traffic rather than blocking all external catalog/CDN calls indiscriminately.
- [ ] Run branch CI at the tested checkpoint and link its results. Publish milestone report with delivered scope, local automated results, browser acceptance, QA/provider checks, remote CI, defects, blocked cases and optional owner reproduction steps.
- [ ] Gate Milestone 2 on all required category/ownership/privacy scenarios passing. Do not start destructive retirement work merely because mock UI tests pass.
- [ ] Repeat the milestone-2 wrapper with `--project mobile-chromium`, then both projects with `--environment qa`. Record exact discovered/executed/passed/failed/skipped scenario counts; fail the milestone for a required scenario that is absent from discovery, skipped or retried into an unexplained pass.
- [ ] Attach a nine-row category coverage table to the milestone report: owner create/edit/item-delete/list-delete, order/pin, publish/hide, anonymous detail, B denial, media byte check, desktop/mobile and real-provider result. Guides add parent/section round-trip and deletion; Music refers to its distinct owner/guest/socket/publication cases rather than generic collection semantics.

**Acceptance gate:** the route matrix from 1.1 reconciles one-to-one with executed scenarios or explicit agreed exclusions; optional owner testing is not a prerequisite, but required technical checks cannot be waived by silence.
