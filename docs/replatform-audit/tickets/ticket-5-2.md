# Ticket 5.2: Maps, QR and linked lists

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-05.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** waiting. **Technical inputs:** 4.4, 4.5, 5.1. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Freeze attachment DTOs first; then qualify map, QR and location links without inventing provider success.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Depends on:** 5.1, 4.4, 4.5, explicit attachment command/DTO in shared contract.

**Existing:** `explorers-earth/src/features/Favorites/components/AddLinkedProductsPage.tsx`, `AddLinkedPeoplePage.tsx`, `LinksAndQR.tsx`, `QRSticker.tsx`; `explorers-earth/src/features/PublicHome/components/MapView.tsx`, `PlaceMapView.tsx`; `explorers-earth/src/utils/qrCodeService.ts`, `src/hooks/useQRActions.tsx`.

**Create:** `tunes/server/test/explorers/placeLinks.integration.test.ts`; `explorers-earth/e2e/replatform/place-links.spec.ts`; extend 5.1 category module and the shared collection association repository, not a separate authorization service.

**Behavior contract:** Account-owned Product/People lists attach only to account-owned place/location context allowed by current UI. Public traversal rechecks profile, category, list and target visibility. QR output retains its existing canonical web destination and optional UTM behavior; scanned links resolve to the same page. Browser map presentation remains unchanged.

- [ ] Test cross-account attachment denial, private child under public parent, detach without deleting the child list, and account/category unpublish invalidating public linked results.
- [ ] Add link association persistence and adapt existing pages; preserve map loading/failure/retry and directions behavior.
- [ ] Add unit assertions on QR payload URL and encoding; inspect generated QR by decoding it in the test rather than merely asserting that an image exists.
- [ ] Run `npm --prefix explorers-earth run test:unit -- src/utils/__tests__/qrCodeService.replatform.test.ts` for the new QR assertions; a missing decoder dependency is added to dev/test dependencies only after verifying the installed QR library cannot decode.
- [ ] Run `npm --prefix tunes run test:integration -- server/test/explorers/placeLinks.integration.test.ts`; run new `replatform/place-links.spec.ts` with the real API config.
- [ ] UAT: attach/detach both list kinds, public map navigation and directions, QR scan/decode/open on mobile, then hide a linked list and verify direct/public nested access is denied. A real Maps smoke remains separate from fixture map UI evidence.
- [ ] Add the existing `recommendation_list: locationId` create path to Product/People `CreateCollectionInput` as `parentLocationCollectionId?:string`. The application create transaction validates the parent and links the new list atomically. Failed parent ownership or revision validation must leave no orphan child; consume the same core create operation, not another list creator.
- [ ] Preserve one location parent per linked child list. In `placeLinks.integration.test.ts`, attach a child to location A, try attaching it to location B and assert 409 with the original relation unchanged; explicit detach followed by attach is permitted. A bare individual place recommendation ID supplied as parent must fail 404/422, never create an accidental relation.
- [ ] Add `explorers-earth/src/utils/__tests__/qrCodeService.replatform.test.ts`: decode generated profile/location QR bytes, assert exact canonical route and supplied UTM parameters, and verify URL encoding for spaces/non-ASCII handles. Missing location coordinates must show the existing no-map state, not a map pin at zero.

**Acceptance gate:** create-linked-list from the current location route needs no place item, detach preserves list/content, private child is absent from nested public responses, and both QR payload and opened destination are verified.


## Independent review correction (2026-10-05)

Create-and-link input includes parentLocationCollectionId and a required parentExpectedRevision when a parent is supplied; reject incomplete parent/revision pairs. The shared core create transaction locks and validates the parent, atomically creates/links child, increments the parent relation revision and returns child plus resulting parent revision. Freeze exact current revision names/DTO in producer preflight. Stale-parent or foreign-owner failure leaves neither orphan child nor changed link. Same command id replays its receipt without another child/revision bump; changed input conflicts. Ticket 5.2 owns this core extension jointly allocated by the coordinator.
