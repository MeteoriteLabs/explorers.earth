# Profile Readiness and Public Route Reliability Design

**Date:** 2026-08-22
**Status:** Approved direction
**Branch:** `codex/profile-dashboard-public-profile`
**Builds on:** `2026-08-21-public-profile-adaptive-theme-surface-design.md` and all profile/dashboard work already present on this branch

## Goal

Make dashboard profile editing and every public profile route predictable, responsive, and verifiably connected to saved account data. Preserve the completed visual work while replacing overlapping loaders and unsafe route-completion signals.

## Product Decisions

- A hard refresh or direct public URL starts with the Earth loader while username, essential profile identity, and theme are unresolved.
- Earth has no artificial minimum duration or fixed timeout. Internal public navigation never returns to Earth.
- Once the public shell is known, only unresolved route content uses a geometry-matched skeleton.
- Background refresh retains visible content and exposes subtle progress; it never replaces content with Earth or a full skeleton.
- A category error preserves the profile header, identity, theme, tabs, footer, and other navigation. Only the category body shows an error and Retry.
- The avatar opens a larger viewer for both custom and default profile images. Share retains the existing native-share flow and fallback.
- Bio structure and emphasis remain intact. Saved foreground/highlight colours render when accessible and fall back to theme-readable colours when they fail contrast.
- Mobile Save & Publish must not cover Appearance controls or bottom navigation.

## Readiness Architecture

`PublicLayout` is the only owner of bootstrap and route-shell readiness. A navigation generation is an immutable `{ username, location.key }` value captured when callbacks are created. Signals from older generations are ignored.

Each public leaf reports a typed state:

- `initial-loading`: no usable route data; shell shows the leaf skeleton.
- `ready`: usable route data or a deliberate empty result.
- `refreshing`: usable stale data remains visible during revalidation.
- `error`: no usable leaf data; shell remains visible with scoped Retry.

Username/profile bootstrap additionally supports `validating`, `not-found`, and `bootstrap-error`. The legacy boolean `setIsPageLoaded`, `ReadyOnMount`, and `window.__publicProfileLoaded` are removed after all leaves migrate. Readiness never depends on elapsed time.

## Route Coverage

The contract applies to direct entry, internal navigation, refresh, back/forward, slow response, empty result, error, retry, and stale completion for:

- `/:username`
- `/:username/music`
- `/:username/places`, `/:placeSlug`, `/map`, `/:placeSlug/map`, and `/:place/placesmap`
- `/:username/guides` and `/:guideSlug`
- `/:username/community`
- Movies: index, `genre/:genreSlug`, `:listSlug`
- Books: index, `subject/:subjectSlug`, `:listSlug`
- Games: index, `genre/:genreSlug`, `:listSlug`
- Apps: index and `:listSlug`
- Products: index and `:listSlug`
- People: index, `sector/:sectorSlug`, `:listSlug`

`/:username/spaces` is not a supported route. Unknown child routes receive an explicit public-profile not-found result rather than being mistaken for a valid category.

## Data and Scale

- Bootstrap identity/theme data is shared and deduplicated across child routes.
- Only the active category’s data is required for route readiness.
- Previously usable category data remains visible during cache-and-network refresh.
- Requests from obsolete navigation generations are cancelled where supported and otherwise ignored.
- Public caching is bounded and keyed by account/category variables; authenticated dashboard data is never shared across users.
- Prefetching is limited to likely visible destinations rather than every category.
- Large collections remain paginated or progressively loaded; images retain responsive sizing and lazy loading.
- Retry is single-flight and bounded. Permanent client errors do not retry indefinitely.

## Security and Observability

- The server remains authoritative for ownership, publication status, username/slug validity, and permitted profile fields.
- Public HTML, URLs, social links, image sources, and theme values remain sanitized.
- Route telemetry records operation, route family, result, duration, retry, and request ID without logging private content.
- Local Tunes sync failures remain out of scope and must not be hidden by this work or modified by it.

## UI State Contract

| Situation | Visible experience |
|---|---|
| Hard refresh/direct public URL | Earth until essential profile shell resolves |
| Bootstrap success, leaf pending | Stable themed shell plus leaf-shaped skeleton |
| Internal route navigation | Stable shell; changing body skeleton only if no cached data |
| Background refresh | Existing content plus subtle progress |
| Empty result | Intentional category-specific empty state |
| Leaf failure | Stable shell plus scoped error and Retry |
| Bootstrap failure | Branded bootstrap error and Retry |
| Unknown username/child route | Explicit Not Found |

## Verification Standard

Verification combines deterministic unit/integration tests, mocked UI fault injection, and a controlled real-account Chrome journey.

- Exhaustive base appearance matrix: 6 themes × 4 wallpaper modes × mobile/desktop.
- Exhaustive individual dashboard settings: theme, wallpaper, hero image present/absent/broken, footer mode, tab selection, recommendation layout, category order, bio states, social visibility, gallery import accordion, and drag/keyboard reorder.
- Pairwise combination coverage for independent high-cardinality settings, plus explicit high-risk combinations and boundary values.
- Real save → reload → public render checks for every persisted appearance/presentation field that the testing account can safely modify.
- Responsive viewports: 320, 375, 768, 1024, and 1440 pixels, plus short mobile height and 200% zoom.
- Accessibility: semantics, names, screen-reader state, keyboard and mobile assistive activation, focus, reduced motion, touch targets, and rendered contrast.
- Quality gates: focused RED/GREEN tests, full Vitest suite, lint with zero errors, TypeScript build, i18n check, production build, Playwright suite, clean console review, diff isolation, and a truthful QA report.

## Acceptance Criteria

1. No public route can remain indefinitely loading after success, empty response, not-found, or handled failure.
2. An obsolete route cannot mark the current route ready or erroneous.
3. Exactly one Earth bootstrap surface is visible on hard refresh; no fixed-duration loader remains.
4. Internal public navigation does not show Earth and retains the stable profile shell.
5. All route families and detail patterns pass direct-entry and navigation tests.
6. Avatar viewer, Share, bio contrast fallback, mobile save clearance, themes, layouts, order, and gallery controls work on mobile and desktop.
7. Saved dashboard values are proven on the real public testing account after reload.
8. All 24 theme/wallpaper combinations pass mobile and desktop geometry/contrast assertions.
9. Full quality gates pass and the branch contains no Tunes/user-sync changes.
