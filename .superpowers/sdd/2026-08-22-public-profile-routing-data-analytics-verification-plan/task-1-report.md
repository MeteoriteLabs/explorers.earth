# Task 1 Report — Router-owned public child URLs

## Status

Implemented and committed as `fix(public-profile): redirect unavailable children to profile root`.

## Implementation

- Added a DOM-free typed `publicRouteContract` defining every supported child route, route family, visibility field/default, marker, shell/skeleton kind, required/conditional capability operation identifiers, and analytics classification.
- `PublicRoutes` now renders the ordered contract with an exhaustive `Record<PublicRouteId, ReactElement>` element map. The contract, rather than JSX or tests, owns the valid child-path list and visibility metadata.
- Added `PublicProfileFallbackRedirect`, which replace-navigates malformed/unsupported valid-user children to `/:username`, preserving search/hash and passing `{ publicProfileFallback: true }` via navigation state for Task 2 focus handling.
- Removed all URL parsing and child-route allowlists from `UsernameValidator`; it only owns username account loading, errors, missing-account Not Found, and successful bootstrap completion.
- Preserved username-error/unknown-account precedence: neither condition redirects an unsupported child URL.

## TDD evidence

| Behavior | RED evidence | GREEN evidence |
|---|---|---|
| Unsupported child uses the canonical root | `npm test -- --run src/routes/__tests__/PublicRoutes.test.tsx` → 3 failures; locations remained `/alice/unsupported-child`, `/alice/not-a-category`, and `/alice/apps/list/extra-segment` while Page Not Found rendered | Same command → 11/11 passed after reusable replace redirect |
| Fallback carries focus-handoff state | `npm test -- --run src/routes/__tests__/PublicProfileFallbackRedirect.test.tsx` → expected `{ publicProfileFallback: true }`, received `null` | Same command → 1/1 passed after typed navigation state |
| Router contract is importable and drives route matching | `npm test -- --run src/routes/__tests__/PublicRoutes.test.tsx` → unresolved `../publicRouteContract` import | Focused command for both route files → 38/38 passed after contract-backed route rendering |

Characterization coverage additionally proves every declared route matches by its contract ID, root and trailing-slash entries do not loop, replacement removes the bad entry from Back history, search/hash are retained, and unknown username/API error keep their original child URL instead of redirecting.

## Verification

```text
npm test -- --run src/routes/__tests__/PublicRoutes.test.tsx src/routes/__tests__/PublicProfileFallbackRedirect.test.tsx
Test Files  2 passed (2)
Tests  43 passed (43)

npx tsc -b
exit 0

npm run test:unit
Test Files  146 passed (146)
Tests  1125 passed (1125)
exit 0
```

The full suite emits its pre-existing expected test-generated console output for `route render failed`, missing route-readiness context, and jsdom `Window.scrollTo`; it has no test failures.

## Files

- `explorers-earth/src/routes/publicRouteContract.ts`
- `explorers-earth/src/routes/PublicProfileFallbackRedirect.tsx`
- `explorers-earth/src/routes/PublicRoutes.tsx`
- `explorers-earth/src/routes/validators/UsernameValidator.tsx`
- `explorers-earth/src/routes/__tests__/PublicProfileFallbackRedirect.test.tsx`
- `explorers-earth/src/routes/__tests__/PublicRoutes.test.tsx`
- `.superpowers/sdd/2026-08-22-public-profile-routing-data-analytics-verification-plan/task-1-report.md`

## Self-review and concerns

- The direct-entry tests use real memory-router matching/history; they do not source-grep or mock route elements to assert navigation.
- Removing `replace`, search/hash forwarding, the fallback state, any contract entry, or any exhaustive element-map key fails the focused router/TypeScript checks.
- Task 2 still owns the planned visibility-bootstrap consolidation and hidden-category fallback migration. This task deliberately leaves `TabVisibilityGuard` behavior untouched.
- No Tunes, Local Tunes, user-sync, real environment, credential, or Task 0 capability script changed.

## Fix round 1 — preserve unguarded Places maps

Review found that the initial route contract assigned `public_recommendations` to the three pre-existing unguarded Places map routes. The generic renderer consequently added `TabVisibilityGuard`, changing their hidden-category behavior and issuing the guard query. The contract now has explicit `visibility: "guarded" | "always-visible"` metadata. The three map route IDs (`places-map`, `places-detail-map`, and `places-map-detail`) are `always-visible` and carry no visibility field; Places index/detail remain `guarded` with `public_recommendations`.

RED/GREEN evidence:

```text
npm test -- --run src/routes/__tests__/PublicRoutes.test.tsx
RED: 3 failures; each map route rendered inside the visible visibility-guard test double

npm test -- --run src/routes/__tests__/PublicRoutes.test.tsx src/routes/__tests__/PublicProfileFallbackRedirect.test.tsx
GREEN: Test Files 2 passed; Tests 48 passed

npx tsc -b
GREEN: exit 0

npm run test:unit
GREEN: Test Files 146 passed; Tests 1130 passed; exit 0
```

The parity test uses the real `PublicRoutes` assembly and a deliberately visible guard double: it proves Places index/detail are wrapped and all three map IDs are not. The unsupported-child redirect/history assertions remain in the same focused suite. The full suite retains only its expected test-generated console output.
