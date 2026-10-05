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

## Independent review correction (2026-10-05)

**Verdict confirmed: NOT-STARTED.** All five mandated files at `:33` are missing, verified path-by-path at `225d83e5`:

| Mandated path | State |
|---|---|
| `tunes/server/explorers/categories/people.ts` | **MISSING** |
| `explorers-earth/src/features/People/api/explorersAdapter.ts` | **MISSING** |
| `tunes/server/test/explorers/people.test.ts` | **MISSING** |
| `tunes/server/test/explorers/people.integration.test.ts` | **MISSING** |
| `explorers-earth/e2e/replatform/people.spec.ts` | **MISSING** |

**The live consumer is still Apollo/Strapi GraphQL.** `explorers-earth/src/features/People/api/query.ts:1` is `import { gql } from "@apollo/client"` and `:6` declares `PERSON_LISTS_BY_ACCOUNT` as a `gql` query over `personLists(...)` keyed on `$accountDocumentId`. The audit's record of People as incomplete with a live Apollo consumer is correct and is preserved here.

### The canonical backend has no typed storage or write path for the People legacy fields

- Manual entity resolution accepts **`{title}` only**: `resolveManualEntitySchema` at `tunes/shared/explorersContract.ts:87` — `details:z.object({title:displayTitleWriteSchema}).strict()`.
- The public read path **rejects any display-override key other than `title`** for non-books/non-movies categories: `tunes/server/application/publicContent.ts:34`.

So the legacy required fields are **currently unrepresentable** end to end: person `name` (`explorers-earth/src/features/People/types/index.ts:23`), `primary_platform` with the exact enum `instagram | linkedin | twitter | github | youtube | website | other | null` (`:32`), and `social_urls` as a JSON object (`:33`), plus headline, location, avatar/media, skills/tags and sector required by `:35`. Note that a person entity is reachable as a catalog **kind** — `places:['place','person']` and `people:['person']` appear in the replacement category matrix at `tunes/server/repositories/explorersRecommendationRepository.ts:301` — but kind reachability is not typed field storage.

- [ ] **This ticket owes a contract + migration + storage, not just an adapter.** Add the typed People details contract (including the `primary_platform` enum and `social_urls`), author the next append-only migration, implement the storage, and extend the public display-override allowlist for `people` — then build the adapter and the alias edge at `:35`. Until that chain exists, the social/alias round-trip at `:37` and the canonical-versus-compatibility alias comparison at `:42` have no persistence to round-trip through.
- The two negatives at `:37` remain mandatory and are **not** satisfied by the absence of storage: `same_name_people_remain_distinct` and `matching_login_handle_grants_no_authority`. The second is a safety obligation — matching an account handle must confer no ownership or login linkage (`:35`, `:41`) — and must be asserted server-side once storage exists, never inferred from the UI.

### Dependency prose correction

- [ ] `:29` reads "**Depends on:** Epic 3", which is a blanket epic edge. The real edges are **3.1 and 3.2**, as this ticket's execution card already records ("Technical inputs: 3.1, 3.2"). Read the prose as 3.1/3.2; Epic 3 is explicitly not a blanket prerequisite for its consumers.

### Shared fixtures module

The epic-mandated `explorers-earth/e2e/replatform/fixtures.ts` (specified at `docs/replatform-audit/epics/epic-04.md:71`, exporting `test`, `expect`, acceptance account IDs, `signInAs('ownerA'|'ownerB'|'suspended')` and an API request context) **DOES NOT EXIST**; all six existing lanes roll bespoke setup. Creating it is folded into **4.3** as the first category package of Epic 4. This ticket's `people.spec.ts` consumes that fixture — in particular its `ownerA`/`ownerB`/`suspended` identities, which the foreign-owner and handle-collision negatives need — rather than deriving its own sign-in, and must not add a publicly mounted test-login endpoint or relax the contained-test network restrictions.
