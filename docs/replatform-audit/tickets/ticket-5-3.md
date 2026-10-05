# Ticket 5.3: Guides and sections

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-05.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** waiting. **Technical inputs:** 3.1, 3.2, 5.1. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Prepare section field map now; implement versioned Guide aggregate and atomic order/archive/media race behavior after Places contract.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Depends on:** 3.1/3.2 and 5.1; implements the guide section contract in the shared interface table.

**Existing:** `explorers-earth/src/features/Guides/api/queries.ts`, `api/mutations.ts`, `guideService.ts`, `types/index.ts`, `types/guideSectionTypes.ts`, `components/CreateGuidePage.tsx`, `GuideSectionForm.tsx`, `pages/GuideDetailsPage.tsx`, `GuideSectionFormPage.tsx`; `explorers-earth/src/features/PublicHome/components/PublicGuideDetailPage.tsx`.

**Create:** `tunes/server/explorers/categories/guides.ts`; `explorers-earth/src/features/Guides/api/explorersAdapter.ts`; `tunes/server/test/explorers/guides.test.ts`, `guides.integration.test.ts`; `explorers-earth/e2e/replatform/guides.spec.ts`.

**Behavior contract:** Guides are account-owned collections with ordered sections, not flattened ordinary item rows. Preserve guide type, multi-city flag, days, tags/tips, best time, media, budget/type and location/transport data. Sections preserve title/description/order, activities, map data, packing/pre-tasks, tags, timeline, transport, stay and budget. Version the block schema. Preserve morning/afternoon/evening places, travel modes and photo metadata from current TypeScript types.

- [ ] Add a deep round-trip fixture containing every consumed guide/section field and non-ASCII rich text; assert editing one section leaves all other blocks unchanged.
- [ ] Test atomic reorder, stale revision conflict, wrong-guide section ID, rejected invalid block version, and public pagination beyond initial section previews.
- [ ] Replace Strapi numeric upload IDs and bearer-token media calls in `guideService.ts` with Epic 3 media contracts. Upload replacement must succeed and link before retiring the old asset; simulate upload failure and assert the original remains visible.
- [ ] Implement adapters and retain the existing wizard/details/itinerary components. Do not turn unavailable AI services into an unplanned integration rebuild; distinguish any baseline broken assistive action from required manual guide creation.
- [ ] Run frontend units filtered to `src/features/Guides src/features/PublicHome`; backend commands with `guides`; run existing/new `guides.spec.ts` under their respective configs.
- [ ] UAT: create multi-day and multi-city guides, add/edit/reorder sections, exercise timeline/stay/transport/budget/tips, replace media, reload and compare, then publish/unpublish on desktop/mobile.
- [ ] Modify `explorers-earth/src/features/Guides/GuidesPage.tsx` for parent data/order/pin/archive wiring. Create parent fixture values for every `GuideCollectionDetails` field, save/reload and assert deep equality; after adding a section update only parent title and assert section count/content unchanged. Keep parent metadata through generic collection discriminated inputs.
- [ ] In `guides.integration.test.ts`, create sections S1/S2 at parent revision N, reorder at N and assert one transaction produces [S2,S1] and revision N+1; attempt an old-revision edit and assert 409 with both sections unchanged. Delete S2 and assert it cannot be fetched through owner/public normal views; archive the whole guide and assert all public children disappear while shared place entities remain.
- [ ] Add `api/__tests__/explorersAdapter.test.ts` for current string/object compatibility of `Place_Details`, categories and `Guide_Section_Details`. Do not stringify twice or coerce an invalid existing block to empty success. Replace an image with forced storage failure and assert the prior asset ID and served bytes still match; then retry successfully and verify new bytes after reload.

**Acceptance gate:** both parent and section payloads survive unchanged, each deletion scope is covered, and rich content cannot smuggle executable HTML through the public renderer. Add a malicious link/HTML fixture to the existing safe-rich-text test rather than introducing a different editor.

**Inline guide editor closure (5.3):** include `Guides/components/GuideDetails/EditStayModal.tsx`, `EditTipModal.tsx`, `BudgetTable.tsx`, `GuideHeader.tsx`, `EditJourneyRouteModal.tsx`, `TransportationTimeline.tsx`, `EditGeneralTipsModal.tsx`, and `TipsTagsTab.tsx` plus parent mutation callbacks. Read exact cases in the feature gap review.

- [ ] Map each micro-editor to the current-revision aggregate operation. For full-section replacement, assemble validated complete state; missing partial fields never become null. Test each editor save against the real API and verify untouched blocks remain deep-equal. A stale conflict preserves entered form data and keeps the modal open.
- [ ] Enforce publish-before-pin and atomic unpublish+unpin for Guides and Places collection pins. No inferred15 limit. Test guide type/category/days/month/budget/location/multicity filter combinations and stable pinned-first results after reload.
