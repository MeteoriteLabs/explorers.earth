# Ticket 4.5: People

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-04.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** ready after shared handoff. **Technical inputs:** 3.1, 3.2. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Package People: preserve alias/profile/social metadata and explicit ownership; same-name and login-handle negatives. Can pair with Places after capacity opens.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Depends on:** Epic 3. **Produces:** recommended-person records and existing list/public/sector flows; attachment contract consumed in 5.2.

**Existing:** `explorers-earth/src/features/People/types/index.ts`, `api/query.ts`, `api/mutation.ts`, `utils/personHelpers.ts`, `components/dashboard/AddPersonPage.tsx`, `PersonListView.tsx`, `PeopleHome.tsx`, `components/public/PublicPeople.tsx`, `PublicPersonList.tsx`, `PublicPersonSector.tsx`, `PersonDetailModal.tsx`.

**Create:** `tunes/server/explorers/categories/people.ts`; `explorers-earth/src/features/People/api/explorersAdapter.ts`; `tunes/server/test/explorers/people.test.ts`, `people.integration.test.ts`; `explorers-earth/e2e/replatform/people.spec.ts`.

**Behavior contract:** Preserve name/handle, headline, location, avatar/media, social URLs/platform, skills/tags and sector/category. Preserve existing aliases (`full_name`, `profile_url`, `platform`, etc.) at the adapter edge until consuming components no longer need them. External follower-count metadata may remain; no Explorers follower relationships are created. Matching an account handle confers no ownership or login linkage.

- [ ] Test `same_name_people_remain_distinct`, `matching_login_handle_grants_no_authority`, and social/alias round-trip with optional fields absent.
- [ ] Implement mapper and common cycle, retaining keyboard navigation/focus behavior from the existing accessibility test.
- [ ] Run frontend unit tests filtered to `src/features/People`; backend commands with `people`; existing/new `people.spec.ts` with their configs.
- [ ] UAT: create/edit person manually, external profiles, sector browse, custom order/top picks and private/public views; enrichment failure must not erase a manual draft.
- [ ] In `people.integration.test.ts`, create two “Alex Lee” records without authoritative matching identifiers; assert distinct IDs. Set one handle equal to owner B's account handle and assert no membership or account link is created. Explicitly assert A's person data edit cannot change B's recommendation.
- [ ] In `api/__tests__/explorersAdapter.test.ts`, compare canonical and compatibility aliases, including `twitter`/`x` presentation normalization, missing avatar fallback and sector names. In the browser spec enter external social URLs and tags manually, save/reload, open/close detail by keyboard, and confirm the sector route lists only visible records.

**Acceptance gate:** recommended people remain data rather than identities, and external follower-count presentation creates no follower-network persistence or API dependency.
