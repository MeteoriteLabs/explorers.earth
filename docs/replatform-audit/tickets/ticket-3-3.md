# Ticket 3.3: Books end to end

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-03.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** partial. **Technical inputs:** 3.1, 3.2. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Preserve canonical Books 20; reconcile outstanding original requirements and external obligations without rebuilding owner/public slice.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Depends on:** 3.1/3.2/2.4. **Create:** `explorers-earth/src/features/Books/api/booksClient.ts`, `explorers-earth/src/features/Books/api/booksViewModel.ts`, `explorers-earth/src/features/Books/api/__tests__/booksClient.test.ts`, `explorers-earth/e2e/replatform/books.spec.ts`.

**Modify:** `explorers-earth/src/features/Books/components/dashboard/AddBookPage.tsx`, `BooksHome.tsx`, `BookListView.tsx`, `TopReadsManager.tsx` in that same dashboard directory; `explorers-earth/src/features/Books/components/public/PublicBooks.tsx`, `PublicBookList.tsx`, `PublicBookSubject.tsx`; current Books `api/query.ts`, `api/mutation.ts`, `types/index.ts`; `tunes/server/publicProfile/publicProfileService.ts` and its repository adapter.

- [ ] Add failing client/view-model tests proving every field in current `BookList`/`RecommendedBook` types survives round-trip, including lower-case list visibility, rich note, 1–10 rating, buy links, media, top reads heading and pin/order.
- [ ] Adapt existing components behind typed API calls; retain current forms, routes, empty/error states and sort behavior. Migrate public category reads through the existing public gateway seam, not direct privileged owner endpoints.
- [ ] Add E2E fixtures for owner A/B and anonymous sessions: create list, lookup/add book, edit note/rating/media, reorder/pin, hide/reveal, delete, reload, subject navigation and public detail. Assert another owner cannot mutate by changing request IDs and anonymous cannot fetch hidden items directly.
- [ ] Run client tests, existing Books helper/list-navigation/toggle/publish tests and real local browser spec desktop/mobile. Commit. **Done:** no Books flow requires Strapi; seed + Google + profile + Books demo is reproducible.
