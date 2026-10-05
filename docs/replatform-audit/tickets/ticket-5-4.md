# Ticket 5.4: Existing claim flow

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-05.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** waiting. **Technical inputs:** 2.2, 3.2, 5.1. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Implement current claim/evidence eligibility only; no new administrator or implicit ownership grant.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Depends on:** Epic 2 Google identity, Epic 3 private media contract, 5.1; implements the claim contract in the shared interface table.

**Existing:** `explorers-earth/src/pages/ClaimAccount.tsx`, `src/features/Authentication/api/queries.ts`, `components/VerificationForm.tsx`, `components/PlaceProfileCard.tsx`; `explorers-earth/src/features/Favorites/services/claimablePlaceProfileService.ts`.

**Create:** `tunes/server/application/claims.ts`, `tunes/server/repositories/claimRepository.ts`, `tunes/server/routes/explorersClaimRoutes.ts`; `tunes/server/test/explorers/claims.test.ts`, `claims.integration.test.ts`; `explorers-earth/e2e/replatform/claims.spec.ts`.

**Behavior contract:** Retain search/profile-details/evidence-submission flow, including no-match/error states. Submission is pending evidence, not verified ownership; no membership or account ownership change results. Evidence must not become publicly accessible. Replace the current first-result guess with the explicit ambiguous-target validation error defined below; phone/address lookup is not identity verification. Do not add an admin review UI.

- [ ] Define bounded lookup fields/results and authorization/rate limits with the identity owner; no endpoint returns arbitrary private claimant information.
- [ ] Test no match, multiple candidates, duplicate submission/retry, private evidence ownership and upload failure; assert memberships remain unchanged after successful submission.
- [ ] Implement pending submission persistence and adapt the current form through shared auth/media clients.
- [ ] Run frontend units filtered to `src/features/Favorites/__tests__/claimablePlaceProfileService`; backend commands with `claims`; run new `replatform/claims.spec.ts`.
- [ ] UAT: fixture claimable place, submit evidence, confirm existing success state; verify another account and anonymous browser cannot retrieve evidence. Multiple matches must use the existing error presentation and request more precise search input.
- [ ] Use `tunes/server/application/claims.ts` as the sole command service. Implement persistence in `tunes/server/repositories/claimRepository.ts` and an append-only claim/evidence migration in this ticket; mount `tunes/server/routes/explorersClaimRoutes.ts` from `routes/index.ts`.
- [ ] Pin lookup outcomes: no phone/address→422; zero candidates→200 empty array; one→200 single candidate; multiple after fallback→422 `AMBIGUOUS_CLAIM_TARGET`. Return only public name/address/id. Neither private owner contact nor another claimant's evidence appears. A claim submitted with anonymous authority is 401; wrong-owner media is 404; same idempotency key/body returns the same pending ID and one row; changed body→409.
- [ ] In real browser acceptance create/publish a place first, then use the current search/details/verification route. Assert successful pending receipt does not change membership count, `Is_Claimed` semantics or account permissions. Fetch the evidence byte URL as anonymous and B and assert 404 even when the place is public; owner A can retrieve its evidence.

**Acceptance gate:** an empty fresh deployment acquires eligible lookup data through normal Places use; no fixture-only directory or implicit ownership grant is needed.
