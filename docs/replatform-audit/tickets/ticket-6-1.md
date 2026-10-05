# Ticket 6.1: Replace the identity bridge

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-06.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** priority prerequisite. **Technical inputs:** 2.2, 3.1. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Package M1: canonical mapping/principal and session HTTP. M2: token-null production startup and generation fencing. M3: purpose-limited socket credential/revocation. Backend/frontend split only after exact interface handoff.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Depends on:** 2.2 authority contract and 3.1 shared runtime; may run before unrelated category tickets after these prerequisites. **Create:** `tunes/server/music/accountMusicRepository.ts`, `tunes/server/music/musicSocketCredential.ts`, `tunes/server/test/canonical-music-identity.integration.test.ts` and the next append-only canonical Music migration.

**Modify:** `tunes/server/music/canonicalMusicPrincipal.ts`, `tunes/server/routes/index.ts`, `tunes/server/middleware/musicPrincipal.ts`, `tunes/server/routes/musicIdentityRoutes.ts`, `tunes/server/repositories/musicIdentityRepository.ts`, `tunes/server/repositories/musicDomainRepository.ts`, `tunes/server/services/musicLifecycleService.ts`, `tunes/server/socket/musicSocketServer.ts`, `tunes/shared/schema.ts`, Music SQL manifest/readiness/role grants; `explorers-earth/src/lib/localTunesApiClient.ts`, `musicCredentialStore.ts`, `explorers-earth/src/features/music/musicIdentityCoordinator.ts` and `musicSessionBoundary.ts`.

**Contract:** `ensureMusicAccount(actor:Actor): Promise<{musicUserId:number;accountId:string}>` transactional one-to-one mapping. Owner HTTP consumes canonical session directly. `POST /api/explorers/v1/music/socket-credential` accepts only a current web-session Actor and issues a memory-only purpose-limited 60-second **handshake** credential bound to user/account/session ID and session version; it is not a general HTTP bearer or OAuth token. OAuth Actors cannot acquire web socket credentials through a fabricated session ID. Verify expiry/audience and current state at connect; an established connection subsequently checks current membership/session/account state per owner event and is disconnected on logout/suspension. The handshake's 60-second expiry does not itself end an otherwise valid live session; reconnect always requests a fresh credential. Existing MusicPrincipal compatibility names may exist only at an adapter boundary; no Strapi-origin values are required.

- [ ] Add failing tests for concurrent provision, two-owner isolation, revoked session replay, expired socket credential, changed account state after connection and no upstream request when Strapi is unreachable.
- [ ] Append explicit canonical mapping/provisioning SQL and adjust triggers/functions that currently require Strapi fields or frozen numeric identity. Retain numeric IDs, guest/publication state and transactional guarantees. Do not make every SQL constraint nullable as a shortcut; map each modified invariant to a canonical replacement and migration test.
- [ ] Recompose Music routes/lifecycle on canonical authority and remove upstream absence/reconciliation from the new runtime path. Keep lifecycle deletion/revocation/idempotency, replacing only Strapi proof assumptions. Remove legacy path files only in Epic 8.
- [ ] Change browser client to session HTTP and socket-ticket acquisition; retain single-flight coordination, generation cancellation and cross-tab invalidation. Audit lifecycle, entitlement, analytics and public descriptor queries that currently read `strapi_account_document_id`—all must resolve canonical mapping.
- [ ] Run canonical identity integration, updated principal/socket/lifecycle unit suites and runtime-role/migration tests. Commit. **Done:** Music starts and operates with zero required Strapi configuration; canonical account deletion/suspension revokes both transports.


## Current startup dependency (2026-10-05)

The original publishing outage case fails before /api/music/dashboard. Canonical auth intentionally keeps token null; musicApi still requests a Strapi proof, and production AuthSyncManager has no Music reconcile startup. Extend frontend ownership to `src/features/music/musicApi.ts`, `src/components/AuthSyncManager.tsx`, `src/hooks/useTunesDashboard.ts` and their focused startup tests. Implement session HTTP under the existing Actor contract, not another HTTP bearer. Keep the 60-second socket credential purpose-limited and memory-only. Reproduce verified-cookie/token-null startup, wrong owner, logout and verified ABA before repair; real HTTP/socket qualification is required. 6.2/6.3 own the remaining publication/workspace transaction parity. Do not issue a fake fixture credential to turn the original publishing case green.
