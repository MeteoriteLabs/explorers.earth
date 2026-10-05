# Ticket 4.4: Products

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-04.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** ready after shared handoff. **Technical inputs:** 3.1, 3.2. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Package Products: exact decimal/currency/null contracts and independent recommendation ownership; production adapter and persisted browser cases. Can pair with Apps.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Depends on:** Epic 3. **Produces:** product detail/offer representation and existing recommendation UX; attachment contract consumed in 5.2.

**Existing:** `explorers-earth/src/features/Products/types/index.ts`, `api/query.ts`, `api/mutation.ts`, `utils/productHelpers.ts`, `components/dashboard/AddProductPage.tsx`, `ProductListView.tsx`, `ProductsHome.tsx`, `components/public/PublicProducts.tsx`, `PublicProductList.tsx`, `ProductDetailModal.tsx`.

**Create:** `tunes/server/explorers/categories/products.ts`; `explorers-earth/src/features/Products/api/explorersAdapter.ts`; `tunes/server/test/explorers/products.test.ts`, `products.integration.test.ts`; `explorers-earth/e2e/replatform/products.spec.ts`.

**Behavior contract:** Product/merchant URL, brand, image/specification data, price and currency round-trip. Persist money using the Epic 3 exact-decimal contract; zero is a valid amount, null is unknown, and unknown currency stays unknown. UI formatting and supported price sorts remain stable. This ticket does not implement purchase, affiliate attribution or subscriptions.

- [ ] Test zero versus null, decimal round-trip, missing currency and foreign-owner list assignment; assert similar merchant products are not silently merged.
- [ ] Connect existing price guard/manual form behavior to shared operations and execute the common cycle.
- [ ] Run frontend unit tests filtered to `src/features/Products`; backend commands with `products`; existing/new `products.spec.ts` with their configs.
- [ ] UAT: save zero-price and unknown-price products, edit currency, sort, open external link, upload imagery and publish/unpublish. Keep working manual entry when retired enrichment returns unavailable.
- [ ] In `products.integration.test.ts`, persist prices `"0.00"`, `"19.90"` and null with explicit currency/null; assert wire and stored exact decimal values, never floating sums or invented currency. A's changed recorded offer/title must not change B's recommendation of the same entity. Invalid negative amount and unsupported precision fail validation without a partial write.
- [ ] In `api/__tests__/explorersAdapter.test.ts`, assert conversions used by the current numeric UI preserve zero/null distinctions; in the browser spec assert sort by supported price modes matches the baseline comparator, no unrequested exchange-rate conversion, and unsafe external URL schemes cannot render executable links. Empty currency remains unknown after reload even if the current select offers a default on a new form.

**Acceptance gate:** numeric presentation retains current behavior while the API preserves exact values. Zero-price visibility bugs found in the existing UI are recorded as baseline defects; do not redesign formatting silently to satisfy a new snapshot.

## Independent review correction (2026-10-05)

**Verdict confirmed: NOT-STARTED.** All five mandated files at `:33` are missing, verified path-by-path at `225d83e5`:

| Mandated path | State |
|---|---|
| `tunes/server/explorers/categories/products.ts` | **MISSING** |
| `explorers-earth/src/features/Products/api/explorersAdapter.ts` | **MISSING** |
| `tunes/server/test/explorers/products.test.ts` | **MISSING** |
| `tunes/server/test/explorers/products.integration.test.ts` | **MISSING** |
| `explorers-earth/e2e/replatform/products.spec.ts` | **MISSING** |

**The live consumer is still Apollo/Strapi GraphQL.** `explorers-earth/src/features/Products/api/query.ts:1` is `import { gql } from "@apollo/client"` and `:6` declares `PRODUCT_LISTS_BY_ACCOUNT` as a `gql` query over `productLists(...)` keyed on `$accountDocumentId`. The audit's record of Products as incomplete with a live Apollo consumer is correct and is preserved here.

### The canonical backend has no typed storage or write path for the Products legacy fields

- Manual entity resolution accepts **`{title}` only**: `resolveManualEntitySchema` at `tunes/shared/explorersContract.ts:87` — `details:z.object({title:displayTitleWriteSchema}).strict()`, so every other key is rejected.
- The public read path **rejects any display-override key other than `title`** for non-books/non-movies categories: `tunes/server/application/publicContent.ts:34`.

So the legacy required fields are **currently unrepresentable** end to end: `product_url` (`explorers-earth/src/features/Products/types/index.ts:22`), `price` as `number | null` (`:25`) and `currency` as `string | null` (`:26`), plus brand, image and specification data required by `:35`.

- [ ] **This ticket owes a contract + migration + storage, not just an adapter.** The Epic 3 exact-decimal money contract demanded at `:35` has no Products storage to land in: there is no typed product details table and no write path. Add the typed contract, author the next append-only migration, implement the storage, and extend the public display-override allowlist for `products` — then build the adapter. Until that chain exists, `:41` cannot be executed at all: persisting `"0.00"`, `"19.90"` and null with explicit currency/null, and asserting **exact decimal** wire and stored values, has no destination. The zero-versus-null and unknown-currency distinctions at `:37` and `:42` remain mandatory and must not be approximated by a float column.

### Dependency prose correction

- [ ] `:29` reads "**Depends on:** Epic 3", which is a blanket epic edge. The real edges are **3.1 and 3.2**, as this ticket's execution card already records ("Technical inputs: 3.1, 3.2"). Read the prose as 3.1/3.2; Epic 3 is explicitly not a blanket prerequisite for its consumers.

### Shared fixtures module

The epic-mandated `explorers-earth/e2e/replatform/fixtures.ts` (specified at `docs/replatform-audit/epics/epic-04.md:71`, exporting `test`, `expect`, acceptance account IDs, `signInAs('ownerA'|'ownerB'|'suspended')` and an API request context) **DOES NOT EXIST**; all six existing lanes roll bespoke setup. Creating it is folded into **4.3** as the first category package of Epic 4. This ticket's `products.spec.ts` consumes that fixture rather than deriving its own sign-in, and must not add a publicly mounted test-login endpoint or relax the contained-test network restrictions.
