# Ticket 8.1: Remove remaining Strapi coupling

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-08.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** waiting. **Technical inputs:** 7.3. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Retire Strapi only after full retained parity and separate release decision; verify zero active consumers before deleting compatibility files.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Prerequisite:** Milestone 2 technical acceptance; Epics 2–7 have replaced retained paths.

**Files:** use `docs/replatform-audit/source-inventory.json` and `inventory.cjs` to enumerate exact removals; expected affected areas include `explorers-earth/src/graphql/`, `src/lib/localTunesApiClient.ts`, auth stores/coordinators, public-profile adapters, `tunes/server/services/{strapiIdentityGateway,strapiIdentityAbsenceProof}.ts`, gateway adapters, reconciliation workers, fixtures, `.github/workflows/music-reconcile.yml`, `.env.example` files, proxy and SEO generation configuration. Actual consumed paths govern removal, not directory-name matching alone. Add `scripts/check-retired-dependencies.mjs` and `explorers-earth/e2e/replatform/no-strapi.spec.ts`.

**Interface produced:** zero retained application flows requiring Strapi; static check has a narrow allowlist for historical docs/migration provenance only. No Strapi credential/proof env is required for canonical startup.

- [ ] Regenerate inventory; map each occurrence to replacement, historical evidence or justified non-Strapi GraphQL use. Do not delete all GraphQL dependencies blindly.
- [ ] Add browser network assertions that fail retained flow scenarios on Strapi origins or legacy proof routes; test shutdown of canonical account does not call absence polling.
- [ ] Remove replaced runtime modules and configuration in small commits, along with source-dependent reconciliation jobs. Preserve tombstone endpoint behavior where needed to avoid accidentally reopening retired routes.
- [ ] Run new scan, canonical full-stack acceptance and relevant lifecycle/authorization suites. Boot without Strapi variables and with outbound Strapi access denied.
- [ ] Commit and refresh replacement coverage map. **Gate:** both static and runtime evidence; an unused text match is not a runtime dependency, and a successful page load is not proof all writes are detached.
