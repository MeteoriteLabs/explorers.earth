# Ticket 7.1: Public navigation and profile parity

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-07.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** partial / full parity waiting. **Technical inputs:** 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 6.3. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Package N-shared review proceeds now using existing producer contracts; N-full requires all nine categories, privacy/public media, pins and cold-entry positives. Full-ticket dependencies do not block the shared slice.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Depends on:** Epics 4–6; all nine categories have real persisted fixtures.

**Existing:** `explorers-earth/src/features/PublicHome/api/publicProfileGatewayClient.ts`, `usePublicProfileShell.ts`, `usePublicRecommendationCategory.ts`, `usePublicProfileDetail.ts`, `usePublicPagedResource.ts`, `publicProfilePagination.ts`, `publicProfileInvalidation.ts`; `explorers-earth/src/routes/PublicRoutes.tsx`; `tunes/server/publicProfile/publicProfileService.ts`, `publicProfileContract.ts`, `publicProfilePolicy.ts`; `tunes/server/routes/explorersPublicProfileRoutes.ts`.

**Create:** `tunes/server/test/explorers/publicVisibility.integration.test.ts`; `explorers-earth/e2e/replatform/public-parity.spec.ts`. Modify existing gateway backend implementation to use shared operations while retaining public route/response compatibility.

**Behavior contract:** Default profile visibility stays public; category flags stay off until enabled. Keep pinned navigation, auto-pinning, top picks, category themes, canonical handles/slugs, deep links and desktop/mobile shells. Every page and nested result applies visibility; unpublished data must not survive in cached responses after a revision change.

- [ ] Seed more than 24 nested items and more than one category/list page; assert complete traversal without duplicates or omissions, including guide sections.
- [ ] Add a table-driven public matrix for profile/category/list/item visibility, owner/other-owner/anonymous modes and Music public/unlisted/revoked semantics from Epic 6.
- [ ] Test ETag invalidation, client cache reuse after logout/account change, same slug under two accounts, reserved handle protection and canonical URL resolution.
- [ ] Run `npm --prefix explorers-earth run test:unit -- src/features/PublicHome`; `npm --prefix tunes run test -- server/test/publicProfile`; `npm --prefix tunes run test:integration -- server/test/explorers/publicVisibility.integration.test.ts`.
- [ ] Run existing public-shell/category-navigation suites using their existing dedicated configs and new `replatform/public-parity.spec.ts`. UAT navigates every category on desktop/mobile, including keyboard/focus and long-name overflow cases; compare to Epic 1 baseline screenshots without blanket snapshot replacement.
- [ ] Include `explorers-earth/src/features/PublicHome/components/publicPlaceMedia.ts` in modified files: admit only the controlled same-origin media-content route alongside explicitly retained approved provider imagery; do not introduce a generic URL proxy. Test allowed uploaded image/video rendering, arbitrary remote URL rejection and retained video Range delivery through the media owner's contract.
- [ ] In `publicVisibility.integration.test.ts`, create 53 items with duplicate order values and assert cursor traversal returns exactly 53 unique IDs in deterministic order; change account/category visibility between pages and assert the continuation cannot disclose now-hidden rows. Revalidate a cached ETag after unpublish and assert response is denial/new safe state, never 304 carrying old private data.
- [ ] Pin route checks: `/:username`, all nine category routes, list slugs, genre/subject/sector routes, guide detail and Music shared capability route. Same list slug on two accounts resolves to its own owner; missing/private/archived detail has the same public unavailable response. Upload URL bytes fetched after hiding the only public attachment must be denied independently of the page cache.

**Acceptance gate:** complete traversal, nested policies, cached fetches and actual media bytes obey the same publication boundary. Owner preview visibility is not evidence of anonymous publication.

**Public-shell compatibility additions (source review):** include `routes/validators/TabVisibilityGuard.tsx`, `UsernameRootRedirect.tsx`, `layouts/PublicColdEntryBoundary.tsx`, `layouts/publicShellReadiness.ts`, `features/music/PublicMusicAvailabilityProvider.tsx`, and `features/PublicHome/api/publicProfileInvalidation.ts` in 7.1 scope.

- [ ] Map canonical boolean category settings into the existing compatibility `Yes`/`No` flags where retained guards consume them; test every flag including `public_movie` alias. Do not pass booleans into a guard that treats unknown values as hidden. Keep the profile-root fallback separate to prevent redirect loops.
- [ ] Test public cold entry on nested routes, invalid username, terminal API failure, rapid username A→B navigation and back/forward. A late A response must not reveal A content in B's shell; every terminal state releases the loading overlay.
- [ ] Preserve the existing account-scoped publish/unpublish/content invalidation transport across tabs. After confirmed unpublish, direct-category access remains hidden while refresh fails or returns stale data. Deduplicate repeated events; wrong-account events do not invalidate another profile. Preserve supported attribution query parameters through fallback redirects.


## Shared slice versus all-category parity (2026-10-05)

The shared canonical navigation/settings repair was advanced as an explicit prerequisite slice. All-nine stored preference mapping and safe hide/unpin are separate from publication/pin eligibility: only complete native Books/Movies/Games content is currently supported, Music uses its own reviewed transactional contract, and the five remaining category positives stay required. Category writers hand off complete typed query contracts to the controller before extending shared eligibility/public registration. Full7.1 remains dependent on all category/Music producer and active-consumer closure; exact schema enums or contained fixtures do not satisfy that gate.
