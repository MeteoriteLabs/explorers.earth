# Ticket 6.2: Owner Music parity

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-06.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** waiting. **Technical inputs:** 6.1. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Qualify retained owner playlists, queue, playback, history and entitlement transactions; do not rebuild unrelated Music services.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Depends on:** 6.1. **Modify:** `tunes/server/routes/musicSurfaceRoutes.ts`, `tunes/server/repositories/musicDomainRepository.ts`; `explorers-earth/src/features/music/musicWorkspaceClient.ts`, `musicQueueClient.ts`, `musicSearchClient.ts`, `musicApi.ts`; existing `tunes/server/test/music-domain-repository.integration.test.ts`, `music-surface-routes.test.ts`; create `explorers-earth/e2e/replatform/music-owner.spec.ts`.

- [ ] Adapt failing test fixtures to canonical owners while preserving assertions for playlist create/edit/delete, song add/remove/reorder, atomic queue replace/append, playback/current state, history, guest controls and entitlement. A retired paid import remains retired, not a new failure to fix.
- [ ] Replace principal plumbing only where needed; preserve existing URL/DTO/domain semantics and map canonical account profile data into existing screens.
- [ ] Run real PostgreSQL concurrency tests: rollback queue replacement leaves prior queue intact, duplicate command does not append twice, stale revision conflicts, notifications occur after commit only. Keep owner predicate tests against forged playlist/song IDs.
- [ ] Run existing Music client suites and new real-stack browser spec desktop/mobile; exercise refresh/reconnect and provider failure. Commit. **Done:** Music owner behavior matches baseline without duplicate Tunes UI or Strapi authentication.
