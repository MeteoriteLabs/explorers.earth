# Ticket 8.4: Final production topology and promotion authority

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-08.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** waiting. **Technical inputs:** 3.5, 8.3. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Prepare promotion from same immutable artifacts; production deployment requires separate authorization.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Prerequisite:** 8.3; extend 3.5 artifacts and QA authority rather than creating competing deployment paths.

**Files:** extend `deploy/platform.compose.yml`, `deploy/platform-routing.yml`, `scripts/platform-release.ts`, `apps/api/server/test/contracts/platform-release.test.ts`; add `.github/workflows/platform-production.yml`; retire/supersede old deployment workflows explicitly and update source tests that describe their authority.

**Interface produced:** production accepts the exact QA-tested release manifest/digests plus production runtime configuration, validates successful evidence for that release and performs serialized migration/readiness/route switch. QA cannot reference the production database or S3 prefix, although both use the accepted shared bucket/AWS credential arrangement. Reverse proxy is the only public ingress; API, self-hosted PostgreSQL and migration job use least-privilege network/roles. Production promotion is an explicit manual release action; successful QA deployment never triggers it automatically.

- [ ] Add tests refusing untested/mutable artifact, mismatched commit, absent QA evidence, missing environment authority and migration failure; failed readiness keeps previous release selected.
- [ ] Test that QA completion cannot dispatch production and that production rejects QA runtime configuration, wrong S3 prefix, reused QA session secret and unknown callback origin. Recheck environment approval rules before dispatch; retain real GitHub protection, not a documented promise of a gate.
- [ ] Configure web fallback only for frontend routes; API errors and socket upgrade must not receive index HTML. Include TLS, forwarded-proxy trust, secure session cookies, graceful shutdown and socket reconnect during restart.
- [ ] Rehearse QA candidate migration, health and readiness, switch, failed-candidate non-switch and previous compatible image rollback. Preserve useful existing advisory lock/checksum/catalog and runtime/migrator-role guarantees.
- [ ] Verify architecture equality or resolve same multi-platform manifest's platform digest on each host. No rebuild after QA; report both index and platform digests if relevant.
- [ ] Run contract, real-tool compose/image and deployment E2E checks. Commit. **Gate:** production mechanism is ready but has not executed merely because tests passed. Explicit release authorization remains necessary.


## Independent review correction (2026-10-05)

Separate promotion mechanism implementation from production release eligibility. Mechanism work can precede 8.5; actual production dispatch additionally consumes successful 8.5 recovery/capacity/final-acceptance evidence for the exact candidate, all required CI and QA evidence, plus separate release authorization. A failed or missing recovery receipt blocks dispatch. This acceptance join is not a reverse implementation dependency.
