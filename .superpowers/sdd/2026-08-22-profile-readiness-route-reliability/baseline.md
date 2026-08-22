# Profile Readiness and Public Route Reliability Baseline

**Captured:** 2026-08-22
**Branch:** `codex/profile-dashboard-public-profile`
**HEAD:** `8a40b3b91792b2b8f4c982532421d1d9dc222eb1`
**Remote before implementation:** `4183b40cba8c4a82fcc0294449f4af67d4d614b2`
**Node:** `v24.14.0`
**npm:** `11.9.0`

## Environment

Only variable names were inspected. The app has API, REST API, public/full access token, Google Maps/search, payment, Instagram, Local Tunes, TMDB, and analytics configuration surfaces. No values or secrets were recorded.

The main public account can load at `http://127.0.0.1:5173/tk2727`, proving the primary public API configuration is present. Browser analytics requests currently return 401 and Local Tunes is independently unavailable; neither explains the shared public child-route readiness failure.

## Quality Gates

| Gate | Fresh result |
|---|---|
| `npx tsc -b` | PASS |
| `npm run i18n:check` | PASS; translations synchronized |
| `npm run build` | PASS; existing large-chunk and ineffective-dynamic-import warnings |
| `npm run lint -- --quiet` | FAIL; 5 errors |
| Focused public/profile Vitest run | Assertions observed passing, but process did not terminate after more than 90 seconds and was interrupted; repeated i18next, React, and Vitest mock warnings |
| Adaptive public-profile Playwright | FAIL; 3 passed, 1 failed in 54.5 seconds |

### Lint failures

1. `PublicProfile.presentation.test.tsx:293` — `prefer-const`.
2. `PublicProfileHeader.test.tsx:217` — `prefer-const`.
3. `resolvePublicProfileSurface.ts:43` — `no-control-regex`.
4. `PublicRoutes.test.tsx:19` — hook called from lower-case mock component.
5. `PublicRoutes.test.tsx:23` — hook called from lower-case mock component.

### Adaptive visual failure

The social-icon core-pixel contrast measured `2.4770290726127757`, below the existing test threshold of `2.5`. The product design target remains 3:1 for UI/icon contrast.

## Real Chrome Route Reproduction

Chrome tested the real `tk2727` public account against the local branch. Timings are observations, not readiness timeouts or product requirements.

| Requested route | Observed result |
|---|---|
| `/tk2727` | Eventually rendered the public profile and recommendations; analytics emitted an unrelated 401 |
| `/tk2727/places` | Stuck on `PublicProfileSkeleton` |
| `/tk2727/places/tokyo` | Stuck on `PublicProfileSkeleton` |
| `/tk2727/guides` | Stuck on `PublicProfileSkeleton` |
| `/tk2727/guides/one-day-in-hyderabad` | Escaped the shell early, then displayed `Failed to load guide` |
| `/tk2727/music` | Hidden-route redirect to `/tk2727/places`, then stuck |
| `/tk2727/movies` | Hidden-route redirect to `/tk2727/places`, then stuck |
| `/tk2727/books` | Hidden-route redirect to `/tk2727/places`, then stuck |
| `/tk2727/games` | Hidden-route redirect to `/tk2727/places`, then stuck |
| `/tk2727/apps` | Stuck on `PublicProfileSkeleton` |
| `/tk2727/apps/everyday-creative-tools` | Stuck on `PublicProfileSkeleton` |
| `/tk2727/products` | Stuck on `PublicProfileSkeleton` |
| `/tk2727/products/travel-tech` | Stuck on `PublicProfileSkeleton` |
| `/tk2727/people` | Stuck on `PublicProfileSkeleton` |
| `/tk2727/people/explorers-storytellers` | Stuck on `PublicProfileSkeleton` |
| `/tk2727/community` | Shell marked ready before child data readiness; showed Community after the route skeleton disappeared |
| `/tk2727/spaces` | Unsupported child route remained on `PublicProfileSkeleton` instead of resolving Not Found |

## Root-Cause Evidence to Protect With Tests

- Legacy `setIsPageLoaded` reads the current generation when invoked, allowing an obsolete route callback to complete a newer navigation.
- `ReadyOnMount` marks maps, Community, and guide detail ready before their data lifecycle resolves.
- Most category leaves equate `loading: false` with readiness without reporting query errors to the shared shell.
- `TabVisibilityGuard` can redirect hidden categories into the broken Places route and can blank children during cache-and-network revalidation.
- `window.__publicProfileLoaded` and duplicate profile skeleton branches compete with the route shell.

## Isolation

No `tunes/` changes are present in `origin/main...HEAD`. This implementation must continue to exclude Tunes/local-user-sync files and behavior.
