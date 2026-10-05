# Ticket 4.3: Apps & Tools

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-04.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** ready after shared handoff. **Technical inputs:** 3.1, 3.2. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Package Apps: typed price tiers/platforms/screenshots and manual fallback, production adapter, persisted owner/public browser cases. Coordinate shared DTO/routes with root.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Depends on:** Epic 3. **Produces:** app entities and independent account recommendations using existing cards/forms.

**Existing:** `explorers-earth/src/features/AppsAndTools/types/index.ts`, `api/query.ts`, `api/mutation.ts`, `components/dashboard/AddAppPage.tsx`, `AppListView.tsx`, `AppsHome.tsx`, `components/public/PublicApps.tsx`, `PublicAppList.tsx`, `AppDetailModal.tsx`.

**Create:** `tunes/server/explorers/categories/apps.ts`; `explorers-earth/src/features/AppsAndTools/api/explorersAdapter.ts`; `tunes/server/test/explorers/apps.test.ts`, `apps.integration.test.ts`; `explorers-earth/e2e/replatform/apps.spec.ts`.

**Behavior contract:** Preserve `app_url`, developer/platforms, screenshots, download URL and the exact price-tier choices `Free`, `Freemium`, `Paid`, `Subscription`, or null. This is descriptive app metadata, not a billing feature. Similar URLs or names do not establish entity identity. Preserve manual entry when enrichment is unavailable; do not revive retired scraper endpoints.

- [ ] Test `price_tier_and_platforms_round_trip`, `similar_urls_are_not_auto_merged`, `unsafe_outbound_scheme_is_rejected`, and retained manual fallback after enrichment failure.
- [ ] Implement adapter and common cycle, including modal keyboard focus/accessibility and returning from add/edit to the correct list.
- [ ] Run frontend unit tests filtered to `src/features/AppsAndTools`; backend commands with `apps`; existing/new `apps.spec.ts` with their configs.
- [ ] UAT: manually add app, edit note, upload/replace media, top picks, publish/unpublish and public modal on both viewport sizes.
- [ ] Parameterize `apps.integration.test.ts` over `Free`, `Freemium`, `Paid`, `Subscription`, null; assert exact saved tier and no payment/subscription record. Create manual apps with similar normalized URLs under separate commands and assert distinct entities; retry a single command and assert one entity.
- [ ] In the adapter test and browser spec, round-trip platforms/screenshots/download URL, restore focus to the originating card after modal close, and preserve draft text when enrichment is unavailable. Test keyboard activation and escape in the actual retained modal. Execute the new adapter test file explicitly.

**Acceptance gate:** manual Apps flow is fully persisted, existing list return navigation works after add/edit, and tier metadata does not require any retired billing endpoint.

## Independent review correction (2026-10-05)

**Verdict confirmed: NOT-STARTED.** All five mandated files at `:33` are missing, verified path-by-path at `225d83e5`:

| Mandated path | State |
|---|---|
| `tunes/server/explorers/categories/apps.ts` | **MISSING** |
| `explorers-earth/src/features/AppsAndTools/api/explorersAdapter.ts` | **MISSING** |
| `tunes/server/test/explorers/apps.test.ts` | **MISSING** |
| `tunes/server/test/explorers/apps.integration.test.ts` | **MISSING** |
| `explorers-earth/e2e/replatform/apps.spec.ts` | **MISSING** |

**The live consumer is still Apollo/Strapi GraphQL.** `explorers-earth/src/features/AppsAndTools/api/query.ts:1` is `import { gql } from "@apollo/client"` and `:6` declares `APP_LISTS_BY_ACCOUNT` as a `gql` query over `appLists(...)` keyed on `$accountDocumentId`. This ticket's own audit status is honest about Apps being incomplete with a live Apollo consumer, and that honesty is preserved here: nothing below implies otherwise.

### The canonical backend has no typed storage or write path for the Apps legacy fields

This is the correction that changes the ticket's scope. It is not a UI-adapter job.

- Manual entity resolution accepts **`{title}` only**: `resolveManualEntitySchema` at `tunes/shared/explorersContract.ts:87` is `z.object({kind:z.literal('manual'), category:topPickCategorySchema, details:z.object({title:displayTitleWriteSchema}).strict()}).strict()`. The `.strict()` on `details` rejects every other key.
- The public read path **rejects any display-override key other than `title`** for non-books/non-movies categories: `tunes/server/application/publicContent.ts:34` — `else if(row.content_category!=='books' && Object.keys(overrides.data).some(k=>k!=='title')) throw new PublicContentFailure(400)`.

So the legacy required fields are **currently unrepresentable** end to end: `app_url` (`explorers-earth/src/features/AppsAndTools/types/index.ts:22`) and `price_tier` with the exact enum `Free | Freemium | Paid | Subscription | null` (`:28`), plus developer/platforms, screenshots and download URL required by `:35`.

- [ ] **This ticket owes a contract + migration + storage, not just an adapter.** Add the typed Apps details to the shared contract, author the next append-only migration for its storage, implement the repository/storage write path, and extend the public display-override allowlist for `apps` — then build the adapter. `price_tier_and_platforms_round_trip` at `:37` cannot pass until that chain exists, and parameterizing `apps.integration.test.ts` over the five tier values (`:41`) has nowhere to persist to today.

### Dependency prose correction

- [ ] `:29` reads "**Depends on:** Epic 3", which is a blanket epic edge. The real edges are **3.1 and 3.2**, as this ticket's own execution card already records ("Technical inputs: 3.1, 3.2"). Read the prose as 3.1/3.2. Epic 3 is explicitly not a blanket prerequisite for its consumers; a reviewed producer interface from 3.1/3.2 is what this ticket consumes, and no part of Epic 3's unrelated closure gates it.

### The epic-mandated shared fixtures module does not exist — 4.3 creates it

`docs/replatform-audit/epics/epic-04.md:71` mandates that `explorers-earth/e2e/replatform/fixtures.ts` export `test`, `expect`, acceptance account IDs, `signInAs('ownerA'|'ownerB'|'suspended')` and an API request context, with the Authentication owner defining the fixture rather than category tickets.

**`explorers-earth/e2e/replatform/fixtures.ts` DOES NOT EXIST.** All six existing lanes (`auth`, `profile`, `books`, `lifecycle`, `movies`, `games`) roll **bespoke setup** instead, which is why no two lanes share an identity model.

- [ ] **Creating the shared `fixtures.ts` is folded into this package, as the first category package of Epic 4.** It must export the exact surface epic-04 names — `test`, `expect`, acceptance account IDs, `signInAs('ownerA'|'ownerB'|'suspended')` and an API request context — create real in-process sessions via its identity test factory, and mount **no** public test-login endpoint. 4.4, 4.5 and later category lanes consume it rather than each re-deriving sign-in. Folding the file into this package does not transfer authority over the identity model away from the Authentication owner, and it does not permit weakening the contained-test network restrictions to make a new suite pass.
