# Ticket 4.3: Apps & Tools

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-04.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** ready after shared handoff. **Technical inputs:** 3.1, 3.2. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Package Apps: typed price tiers/platforms/screenshots and manual fallback, production adapter, persisted owner/public browser cases. Coordinate shared DTO/routes with root.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Depends on:** Epic 3. **Produces:** app entities and independent account recommendations using existing cards/forms.

**Existing:** `explorers-earth/src/features/AppsAndTools/types/index.ts`, `api/query.ts`, `api/mutation.ts`, `components/dashboard/AddAppPage.tsx`, `AppListView.tsx`, `AppsHome.tsx`, `components/public/PublicApps.tsx`, `PublicAppList.tsx`, `AppDetailModal.tsx`.

**Create:** `tunes/server/explorers/categories/apps.ts`; `explorers-earth/src/features/AppsAndTools/api/explorersAdapter.ts`; `tunes/server/test/explorers/apps.test.ts`, `apps.integration.test.ts`; `explorers-earth/e2e/replatform/apps.spec.ts`.

**Behavior contract:** Preserve `app_url`, developer/platforms, screenshots, download URL and the exact price-tier choices `Free`, `Freemium`, `Paid`, `Subscription`, or null. This is descriptive app metadata, not a billing feature. Similar URLs or names do not establish entity identity. Preserve manual entry when enrichment is unavailable; do not revive retired scraper endpoints.

- [ ] Test `price_tier_and_platforms_round_trip`, `similar_urls_are_not_auto_merged`, `unsafe_outbound_scheme_is_rejected`, and retained manual fallback after enrichment failure.
- [ ] Implement adapter and common cycle, including modal keyboard focus/accessibility and returning from add/edit to the correct list.
- [ ] Run frontend unit tests filtered to `src/features/AppsAndTools`; backend commands with `apps`; existing/new `apps.spec.ts` with their configs.
- [ ] UAT: manually add app, edit note, upload/replace media, top picks, publish/unpublish and public modal on both viewport sizes.
- [ ] Parameterize `apps.integration.test.ts` over `Free`, `Freemium`, `Paid`, `Subscription`, null; assert exact saved tier and no payment/subscription record. Create manual apps with similar normalized URLs under separate commands and assert distinct entities; retry a single command and assert one entity.
- [ ] In the adapter test and browser spec, round-trip platforms/screenshots/download URL, restore focus to the originating card after modal close, and preserve draft text when enrichment is unavailable. Test keyboard activation and escape in the actual retained modal. Execute the new adapter test file explicitly.

**Acceptance gate:** manual Apps flow is fully persisted, existing list return navigation works after add/edit, and tier metadata does not require any retired billing endpoint.
