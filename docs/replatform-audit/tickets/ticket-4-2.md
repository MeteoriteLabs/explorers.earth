# Ticket 4.2: Games


**Current finite status (2026-10-05):** Manual Games slice independently reviewed, committed and pushed at46eea549d0d2661424a3dd2b8d71cee38cc47f30, with exact committed canonical82 acceptance and separate native Games checks. Later1a5c image/C0 hosted validation succeeded. Full IGDB/provider parity, required broader browser QA, operational QA and release remain open. Earlier commit-preparation wording is historical. See [checked status](../current-status-2026-10-05.md).

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-04.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** partial. **Technical inputs:** 3.1, 3.2. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Preserve committed manual Games 46ee; package G-provider owns IGDB, search and taxonomy parity with explicit provider access.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Depends on:** Epic 3 shared contracts; can follow 4.1 sequentially without new infrastructure. **Produces:** Games data mapper and server-owned provider access.

**Existing:** `explorers-earth/src/features/Games/api/query.ts`, `api/mutation.ts`, `components/dashboard/AddGamePage.tsx`, `GameListView.tsx`, `GamesHome.tsx`, `components/public/PublicGames.tsx`, `PublicGamesGenre.tsx`, `PublicGamesList.tsx`; `explorers-earth/src/services/igdbService.ts`, `src/types/igdbTypes.ts`.

**Create:** `tunes/server/explorers/categories/games.ts`, `tunes/server/explorers/providers/igdb.ts`; `explorers-earth/src/features/Games/api/explorersAdapter.ts`; `tunes/server/test/explorers/games.test.ts`, `games.integration.test.ts`; `explorers-earth/e2e/replatform/games.spec.ts`.

**Behavior contract:** Retain IGDB ID, source URLs/image IDs, platforms, genres, release information, modes, developer/publisher and media. Browser requests bounded catalog searches; server owns Twitch credentials/token refresh. Existing `VITE_IGDB_CLIENT_SECRET` usage must disappear from runtime browser code and build inputs. Missing credentials must produce a truthful unavailable state, never a fabricated successful catalog response.

**Provider interface:** extend `explorersCatalogRoutes.ts` with GET `/catalog/games?query=...&cursor=...`; `tunes/server/explorers/providers/igdb.ts` exports `searchGames(actor:Actor,input:{query:string;cursor?:string}):Promise<Page<GameCatalogCandidate>>`, sharing Epic 3 catalog error/candidate conventions. Candidate carries `provider:'igdb'`, `externalKind:'game'`, `externalId:string` and mapped metadata. Query length 1–200 and page size 24; server constructs IGDB queries rather than accepting caller query syntax. Resolve through the canonical `resolveEntity` provider registry, extending its allowlist in this ticket.

- [ ] Add tests `provider_credentials_never_enter_browser_dto`, `token_refresh_is_shared_under_concurrency`, `provider_429_is_recoverable`, and `platforms_and_genres_round_trip`.
- [ ] Replace client-side token acquisition through the Epic 3 catalog boundary; coordinate removal of corresponding workflow/build secret injection in the same ticket.
- [ ] Execute the common cycle, then scan built JavaScript/source maps for the old secret variable and a nonsecret sentinel used in the test build. No real secret needs to be printed or logged.
- [ ] Run frontend unit tests filtered to `src/features/Games src/services/__tests__/igdbService`; backend commands with `games`; existing/new `games.spec.ts` via the respective configs.
- [ ] UAT: search, select, create list, edit rating, filter platform/genre, reorder, anonymous detail, provider failure. QA real IGDB lookup is reported separately from fixture lookup.
- [ ] In `games.test.ts`, run ten concurrent catalog requests with an expired server token and assert exactly one refresh; provider 429 produces the shared rate-limit/upstream error rather than empty success. In `games.integration.test.ts`, save two platform/genre values, reload, and assert both survive without converting provider rating into creator rating.
- [ ] In the real Games browser spec, fail the provider after typing a note, assert the draft remains, recover provider lookup and save once. Fetch uploaded cover bytes as owner/public after publication and assert another-owner attach is rejected. Run `npm --prefix explorers-earth run test:unit -- src/features/Games/api/__tests__/explorersAdapter.test.ts` in addition to existing units.

**Acceptance gate:** search→resolve→save→public view works; client build contains no IGDB credential input or server token; fixtures and actual QA provider smoke are reported separately.

## Current Games delivery status (2026-10-05)

The additive A3M manual native Games slice is locally qualified and independently reviewed. Current104 source freeze b76b20edc744cfcf517e34b15df1fbe4e90c040c693bbc23d9f5bee6c2ec579e has4231 frontend tests/0fail/0skip, types/build/lint0errors (1658 retained warnings), source-bound frontend image and JavaScript/sourcemap retirement checks, and actual canonical protected82 PASS (auth6/profile2/Books20/lifecycle10/Movies24/Games20; retries0; source/artifact/owned cleanup guards passed). This qualifies delivered manual behavior, not completion of Ticket4.2.

Hosted qualification of the proposed commit remains pending. Full IGDB acquisition/import/live-provider/media/taxonomy parity remains open; unavailable provider behavior is truthful. Ticket3.5 operational QA/full parity and production release remain separate. No next category batch begins before the agreed consolidation/discussion. Historical intermittent Books cover/paging and Games publication/reader failures remain preserved with unproved causes; a later canonical pass does not erase them.


## Independent review correction (2026-10-05)

The earlier category-batch hold records historical failure diagnosis. It is superseded for read-only field mapping and package preparation by the re-groomed plan. Production category writes still require exact shared-contract handoff and independent review; this does not erase original red required consumers or approve a full category batch.
