# Ticket 1.2: Reproducible local environment

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-01.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** complete. **Technical inputs:** 1.1. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Reuse accepted runtime; new seeds and migrations belong to the consuming feature.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Prerequisite:** 1.1 fixture personas and scope; final canonical seeds are extended in Epics 2–3.

**Files:** modify root `package.json`/lockfile, `docker-compose.music-test.yml` only where reusable; create `docker-compose.replatform.yml`, `scripts/replatform-local.ts`, `docs/replatform/local-development.md`, `tunes/server/test/contracts/replatform-local-authority.test.ts`; reuse `tunes/scripts/music-uat-database.ts`, `music-compose-safety.ts`, `server/test/integration-global-setup.ts`. Add domain fixture wiring to the seed owner files defined by Epics 2–3.

**Interface produced (new commands, not existing):** `npm run platform:local -- provision|start|check|stop|reset`; `npm run platform:test:integration`; `npm run platform:seed -- --dataset acceptance`. The wrapper records a disposable compose project/database authority and supplies attested environment to existing test processes without printing secrets. Reset accepts only that exact local authority. `start` launches API and existing Explorers Vite app; identity is fixture-only until Epic 2.

**Route-graph invariant:** reuse the Music harness's database authority protections, not its restricted local route composition. The current Music local profile omits optional native auth/analytics/reactivation integrations. The new platform fixture runtime must mount the same canonical application route graph as the replacement production runtime, with external providers injected as fixtures. Add `tunes/server/test/contracts/platform-route-parity.test.ts` and run it before real-API E2E; assert auth, profiles, content, analytics, lifecycle and Music routes are present as their owning epics land. Production must reject fixture session authority even though the route graph is equivalent.

- [ ] Add failing authority tests: reject production-style hostname, unrecognized database, mismatched compose project, missing attestation and simultaneous test authorities; accept only provisioned local target. Assert reset refuses all other targets before connection or deletion.
- [ ] Run `npm test --prefix tunes -- --run server/test/contracts/replatform-local-authority.test.ts`; verify specific authority assertions fail before implementing wrapper.
- [ ] Implement wrapper using process argument arrays and hidden Windows child processes. Preserve existing PG15 test authority and isolated DB-per-test semantics; do not weaken integration-global-setup guards. Never recycle protected PowerShell variables.
- [ ] Provision loopback-only database and nonproduction storage adapter. Add deterministic seeds with stable identifiers and idempotent upserts supplied by domain tickets. Keep provider fixture responses out of production paths; real-provider runs use a separately selected nonproduction configuration.
- [ ] Run `npm run platform:local -- provision`, `npm run platform:local -- check`, `npm run platform:seed -- --dataset acceptance` twice. Compare row counts and stable relationships. Run `npm run platform:test:integration`; prove wrong-target rejection with the authority tests, not by attempting to connect to a real production URL.
- [ ] Extend `explorers-earth/e2e/setup/deny-hosted-egress.ts` to the new fixture host allowlist and retain the unit-test containment runner. Confirm fixture provider attempts fail closed.
- [ ] Document prerequisites, ports, stop/reset behavior and OS differences; commit. **Gate:** clean local startup and deterministic seeds work with no production credential/data requirement. Seed evolution is included in every following functional ticket.
