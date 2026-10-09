# Ticket 4.1: Movies & Shows

> **Current status and dispatch (2026-10-09):** Read [the two-tree reconciliation](../reconciliation-2026-10-09.md) and [the reconciled sequence](../../superpowers/plans/2026-10-09-replatform-reconciled-sequence.md). Earlier verdicts/execution cards below are historical; requirements and checkboxes remain binding and do not record completed runs.

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-04.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** partial. **Technical inputs:** 3.1, 3.2, 3.3. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Preserve Movies 24; separate missing provider/whole-ticket qualification from accepted manual owner/public flow.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Depends on:** 3.1–3.3, including a passing Books slice. **Produces:** movie/TV entity detail mapping and unchanged owner/public flows through the shared operations.

**Existing files:** `explorers-earth/src/features/Movies/api/query.ts`, `api/mutation.ts`, `types/index.ts`, `hooks/useTMDBSearch.ts`, `components/dashboard/AddMoviePage.tsx`, `MovieListView.tsx`, `MoviesHome.tsx`, `TopPicksManager.tsx`, `components/public/PublicMovies.tsx`, `PublicMovieList.tsx`, `PublicMovieGenre.tsx`, `MovieDetailModal.tsx`; `explorers-earth/src/services/tmdbService.ts`.

**Create:** `tunes/server/explorers/categories/movies.ts`; `explorers-earth/src/features/Movies/api/explorersAdapter.ts`; `tunes/server/test/explorers/movies.test.ts`, `movies.integration.test.ts`; `explorers-earth/e2e/replatform/movies.spec.ts`. Extend the Epic 3 schema/operations in their owned files rather than a parallel schema.

**Behavior contract:** `(provider, media_type, tmdb_id)` identifies a screen work; equal numeric movie/TV IDs are different entities. Preserve title/original title, year, posters/backdrop, genres, director/runtime, rating, overview, season count, cast and watch-provider metadata. Creator rating, rich note, media, pin/order and list membership remain account-owned. Preserve genre routes and publish prompts.

**Provider interface:** extend `tunes/server/routes/explorersCatalogRoutes.ts` from 3.2 with GET `/catalog/movies?query=...&mediaType=movie|tv&cursor=...`; omitted mediaType searches both kinds. Create `tunes/server/services/movieCatalog.ts` with `searchMovies(actor:Actor,input:{query:string;mediaType?:'movie'|'tv';cursor?:string}):Promise<Page<MovieCatalogCandidate>>`. Candidate carries `provider:'tmdb'`, `externalKind:'movie'|'tv'`, `externalId:string` and typed display metadata; resolve/persist via `resolveEntity`. Bound trimmed query to 1–200 characters and page size to 24. Browser TMDB service becomes a client mapper; no server catalog credential is added to Vite. Full-detail/watch-provider enrichment belongs to the same provider service with the same verified media kind.

- [ ] Add `movie_and_tv_same_id_remain_distinct`, asserting two entities and independent collections; add `creator_note_does_not_mutate_catalog_or_other_creator`.
- [ ] Map every consumed movie field to the new DTO and existing view model; make nullable provider fields explicit rather than defaulting unknown values to zero.
- [ ] Run the common category cycle; add provider timeout, missing poster and stale edit conflict cases.
- [ ] Run `npm --prefix explorers-earth run test:unit -- src/features/Movies src/services/__tests__/tmdbService`; run the backend commands above with `movies`.
- [ ] Run existing `movies.spec.ts` with the general config and new `replatform/movies.spec.ts` with the proposed real API config. UAT: movie plus TV, list rename, edit notes, pin/reorder, detail modal, genre navigation and private/public toggles on desktop/mobile.
- [ ] In `movies.integration.test.ts`, resolve fixture movie ID 42 and TV ID 42; assert different canonical IDs, preserved `media_type` and season count only where supplied. A updates title/note/rating while B recommends the same movie: assert B's effective title/note/rating and the entity source remain unchanged. Add malformed provider metadata→recoverable error with no recommendation row.
- [ ] In `api/__tests__/explorersAdapter.test.ts`, assert runtime zero versus null, no fabricated year, and watch-provider/cast arrays preserved. In the real browser spec, pin two items, reorder them, reload and assert exact card order; remove one item and separately remove its list, verifying public direct URLs return unavailable.

**Acceptance gate:** common category assertions plus movie/TV disambiguation, genre/list public navigation and both deletion scopes pass. Provider timeout preserves entered creator notes and offers the existing retry/error state.

## Independent review correction (2026-10-05)

Disposition stays **BOUNDED-SLICE** for the manual owner/public flow.

**The Movies bounded slice verifies exactly.** Recounted from source at `225d83e5`:

- `explorers-earth/e2e/replatform/movies.spec.ts` declares **12** `test(` cases; `explorers-earth/e2e/replatform/movies.playwright.config.ts:3` declares **2** projects (`movies-desktop`, `movies-mobile`, `retries:0`). 12 × 2 = **24 identities**.
- Both files are **committed and clean**, and 24 matches the `movies` lane in the committed `suite-manifest.json` and `movies:{count:24}` at `scripts/replatform-e2e.mjs:11`. No overlay inflation; no `test.skip`/`describe.skip`/`.todo`/`fixme` anywhere in the replatform specs.

**Per-assertion traceability is owed.** The slice count is sound; the mapping from this ticket's named requirements to named assertions is not:

- [ ] **`movie_and_tv_same_id_remain_distinct`** (mandated at `:39`) **does not exist by that name anywhere in source** — 0 non-documentation hits repo-wide.
- [ ] **`creator_note_does_not_mutate_catalog_or_other_creator`** (mandated at `:39`) **does not exist by that name anywhere in source** — 0 non-documentation hits repo-wide.
- [ ] The adapter test `explorers-earth/src/features/Movies/api/__tests__/explorersAdapter.test.ts` holds **3** `it(` cases (`:4` nested-preview draining with global pins preserved, `:8` repeated/cross-list continuation rejection, `:13` newest-cursor with distinct recommendation IDs under one provider identity). The independent review records the adapter as covering **3 of the required field cases**; none of the three required field assertions named at `:45` — runtime **zero versus null**, **no fabricated year**, **watch-provider/cast arrays preserved** — maps to a case by name. Produce the per-assertion map (requirement → file:line → assertion) rather than inferring coverage from the file's existence.

Behavior may well be covered by differently-named cases; that is precisely what the traceability map must establish, and it is not established today. Absence by name is recorded here as absence of traceable evidence, not as proof the behavior is broken.

**Live TMDB qualification stays open.** `:37` keeps provider enrichment server-side with no catalog credential in Vite; the real-provider smoke is separately reported and is not satisfied by the fixture lane. The acceptance gate above is unchanged.
