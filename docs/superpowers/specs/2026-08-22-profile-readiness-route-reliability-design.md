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
- A route error preserves that route family's existing chrome. The profile root retains its identity/tabs/footer; category and detail routes retain their existing category composition and `PublicNav`; full-screen maps retain their map shell. Only the owning route body shows an error and Retry.
- The avatar opens a larger viewer for both custom and default profile images. Share retains the existing native-share flow and fallback.
- Bio structure, emphasis, and saved author colours remain intact after sanitization. Theme contrast enforcement applies to system-owned chrome and tokens; this work does not rewrite author rich-text styling.
- Mobile Save & Publish must not cover Appearance controls or bottom navigation.
- When the username exists, an unsupported child path, a hidden category, or a deleted/unpublished child resource redirects with history replacement to `/:username`. Query parameters are preserved for attribution; the invalid child path is not retained in browser history.
- A valid enabled category with no published content remains on its category URL and renders its deliberate empty state.
- Network, authorization, and server failures never masquerade as invalid content. They retain the current route and stable profile shell and expose a scoped Retry state.
- An unknown username remains a genuine Not Found result and never redirects to another profile.

## Readiness Architecture

`PublicLayout` is the only owner of bootstrap and route-shell readiness. `bootstrapKey` is the normalized username; `leafGeneration` is the immutable `{ username, location.key }` captured when callbacks are created. Same-username navigation starts a new leaf generation without restarting bootstrap/Earth. A username change starts a new bootstrap. Signals from older leaf generations are ignored.

Each public leaf reports a typed state:

- `initial-loading`: no usable route data; shell shows the leaf skeleton.
- `ready`: usable route data or a deliberate empty result.
- `refreshing`: usable stale data remains visible during revalidation.
- `error`: no usable leaf data; shell remains visible with scoped Retry.

Username/profile bootstrap additionally supports `validating`, `not-found`, and `bootstrap-error`. Legacy completion signals such as `setIsPageLoaded`, `ReadyOnMount`, and `window.__publicProfileLoaded` remain prohibited and are verified absent after migration. Readiness never depends on elapsed time.

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

Each route entry declares `requiredOperations[]` and `conditionalOperations[]`; the capability preflight and UI tests consume the same declarations and fail on observed undeclared operations.

Every unsupported child route follows the same fallback contract: after a valid username is established, replace-navigate to `/:username` while preserving the query string and hash. The router's nested wildcard is the sole authority for unsupported route shapes; `UsernameValidator` validates the username only and does not maintain a second list of valid paths.

Unavailable-but-structurally-valid children use the same profile fallback:

- A category disabled by the profile owner redirects to `/:username`.
- A list, guide, place, genre, subject, or sector slug that does not resolve to a published resource redirects to `/:username`.
- Extra or malformed child segments redirect to `/:username`.
- A valid, enabled category whose query succeeds with zero items remains in place and displays its empty state.
- A valid route whose query fails because of connectivity, authorization, rate limiting, or a server error remains in place and displays its scoped error and Retry state.

Redirects must be loop-free, use history replacement, and retain query parameters such as UTM attribution. Unknown usernames continue to resolve to Not Found.

## Data and Scale

- Bootstrap identity/theme data is shared and deduplicated across child routes.
- Only the active category’s data is required for route readiness.
- Previously usable category data remains visible during cache-and-network refresh.
- Requests from obsolete navigation generations are cancelled where supported and otherwise ignored.
- Public caching is bounded and keyed by account/category variables; authenticated dashboard data is never shared across users.
- Prefetching is limited to likely visible destinations rather than every category.
- Direct child/taxonomy routes use server-filtered published lookups rather than fetching a fixed first page and filtering in the browser. Large collections expose `pageInfo` and remain paginated or progressively loaded; already rendered pages survive later-page errors. Images retain responsive sizing and lazy loading.
- Retry is single-flight and bounded. Permanent client errors do not retry indefinitely.
- Public profile roots and enabled category routes must load for logged-out visitors. Authentication is not a prerequisite for viewing published profile data.
- The normal GraphQL client and analytics transport share one documented operation-classification policy: `auth`, `session-only`, `public-read`, or `analytics-write`. Session-only operations never receive a browser public capability; public reads may use a least-privilege read capability after the session token check; the approved analytics mutation may use its independently scoped write capability. A single shared browser value is local-compatibility-only and fails release verification.
- An invalid or missing public credential is an environment failure, not an empty state or invalid-route signal. Release verification fails if any required guest read or analytics write is unauthorized.
- The external Strapi service remains the source of published/private enforcement. The frontend never treats client-side `Visibility` filters as an authorization boundary.

## Security and Observability

- The server remains authoritative for ownership, publication status, username/slug validity, and permitted profile fields.
- Public HTML, URLs, social links, image sources, and theme values remain sanitized.
- Route telemetry records operation, route family, result, duration, retry, and request ID without logging private content.
- GA navigation tracking and application analytics are verified separately. GA observes canonical pathname changes; application analytics verifies guest views/clicks, session deduplication, and intentional owner-on-own-profile suppression.
- Apps, Products, and People plus nested Guide/Movie/Book/Game list/detail/filter routes receive an explicit application analytics classification. Routes deliberately covered only by GA pathname tracking are named and tested as such.
- Analytics must not make browser-side calls to multiple third-party IP-discovery services. Any fraud or rate-limit enforcement that depends on client IP belongs at the server boundary.
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
| Unknown username | Explicit Not Found |
| Valid username plus unsupported/hidden/unpublished child | Replace-navigate to `/:username` |

## Verification Standard

Verification combines deterministic unit/integration tests, mocked UI fault injection, and a controlled real-account Chrome journey.

- Exhaustive deterministic base appearance matrix: 6 themes × 4 wallpaper modes × mobile/desktop, one named case per combination with failure artifacts.
- Exhaustive individual dashboard settings: theme, wallpaper, hero image present/absent/broken, footer mode, tab selection, recommendation layout, category order, bio states, social visibility, gallery import accordion, and drag/keyboard reorder.
- Pairwise combination coverage for independent high-cardinality settings, plus explicit high-risk combinations and boundary values.
- Real save → reload → public render checks for one value from every persisted appearance/presentation field plus a declared high-risk subset; deterministic fixtures exhaust all 24 theme/wallpaper combinations.
- Real guest reads compare rendered category data with the corresponding successful GraphQL response; fixture-only success does not satisfy this requirement.
- Analytics checks cover GA pathname calls and application view/click mutations as guest, authenticated owner, and authenticated non-owner, including deduplication and expected owner suppression.
- Capability checks include controlled negative private/unpublished reads, arbitrary mutations, analytics-field/account validation, and non-production rate limiting; absence of a controlled proof makes the BFF/server boundary a release prerequisite.
- Route fallback checks cover unsupported route names, disabled categories, deleted/unpublished slugs, malformed extra segments, trailing slashes, query strings, direct entry, internal navigation, refresh, and back/forward behavior.
- Responsive viewports: 320, 375, 768, 1024, and 1440 pixels, plus short mobile height and 200% zoom.
- Accessibility: semantics, names, screen-reader state, keyboard and mobile assistive activation, focus, reduced motion, touch targets, and rendered contrast.
- Quality gates: focused RED/GREEN tests, full Vitest suite, lint with zero errors, TypeScript build, i18n check, production build, Playwright suite, clean console review, diff isolation, and a truthful QA report.
- Deterministic fixture E2E and serialized real-account E2E are separate Playwright projects. Test and E2E TypeScript each have an explicit compile gate.

## Acceptance Criteria

1. No public route can remain indefinitely loading after success, empty response, not-found, or handled failure.
2. An obsolete route cannot mark the current route ready or erroneous.
3. Exactly one Earth bootstrap surface is visible on hard refresh; no fixed-duration loader remains.
4. Internal public navigation does not show Earth and retains the stable profile shell.
5. All route families and detail patterns pass direct-entry and navigation tests; unsupported, hidden, and unpublished children return to `/:username` without a redirect loop or an extra history entry.
6. Avatar viewer, Share, sanitized rich-text preservation, system-chrome contrast, mobile save clearance, themes, layouts, order, and gallery controls work on mobile and desktop.
7. Saved dashboard values are proven on the real public testing account after reload.
8. All 24 theme/wallpaper combinations pass mobile and desktop geometry/contrast assertions.
9. Full quality gates pass and the branch contains no Tunes/user-sync changes.
10. Logged-out visitors can load every enabled public category with real data, guest analytics writes succeed through the independently scoped capability, and negative capability probes prove private reads/arbitrary mutations are rejected.
11. API/network/authorization failures remain distinguishable from invalid-content redirects and expose a bounded Retry path.
