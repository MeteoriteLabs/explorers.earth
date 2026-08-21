# Public Profile Adaptive Theme Surface Design

**Date:** 2026-08-21
**Status:** Approved direction, pending implementation-plan review
**Scope:** Public profile route `/:username`; dashboard theme controls and persistence remain unchanged

**Approved visual reference:** `docs/design-system/mockups/page/public-profile-adaptive-theme-matrix-approved-2026-08-21.png`

**Reference precedence:** This specification and approved matrix supersede `docs/design-system/mockups/page/public_profile.md` where they conflict: the old wordmark header, rounded identity card, four-pixel accent avatar border, fixed banner composition, and themed footer badge. The older mock remains a reference for existing recommendation-card content vocabulary.

## Problem

The public profile currently treats every non-solid wallpaper as one composition. A fixed-height image sits behind identity content, a rounded black scrim surrounds the name/location/social links, the tab rail can overlap the image on mobile, and the recommendation panel is outside the intended content gutter. The footer is a theme-coloured badge, the avatar has a four-pixel accent ring, and three independent loading systems can appear in sequence.

These issues are especially visible at 320–375px and vary unpredictably across the six theme presets and four wallpaper modes.

## Product Premises

1. Theme preset and wallpaper mode remain independent user choices.
2. The public profile keeps one stable information hierarchy across every combination.
3. Wallpaper modes change the hero composition, not the meaning or order of profile content.
4. The profile must remain readable without adding a floating black metadata card.
5. Header branding becomes the existing icon logo; footer branding becomes a larger, stable full logo.
6. Recommendations, Gallery, and Business taxonomy and saved presentation settings remain unchanged.
7. The work must not modify Tunes user-sync behavior, authentication contracts, or dashboard persistence payloads.

## Information Hierarchy

```text
Public navigation: brand icon | share
Adaptive identity hero
  avatar
  account name
  primary location
  visible social links
Profile bio on the page surface
Profile section tab rail
Active panel
  content
  local loading/empty/error feedback
Stable explorers.earth footer brand and legal links
Mobile product navigation
```

The hero ends before the bio and tab rail begin. The tab rail may never overlap wallpaper media.

## Adaptive Hero Contract

### Solid colour

- No image, image overlay, or artificial black scrim.
- Use the preset's `--bg-page`, `--text-primary`, and `--text-secondary` tokens.
- Render a compact identity region with 24px top/bottom spacing on mobile and 32px on desktop.
- Avatar uses a two-pixel `--border-card` halo and a restrained existing shadow token.
- When profile-photo enlargement is available, the avatar is a semantic button labelled `View profile photo`; otherwise it is non-interactive. Decorative wallpaper images use empty alt text and avatar alt text names the account.

### Banner image

- Render a bounded media hero with baseline minimum heights of 280px on 320–375px screens, 320px at 768px+, and 360px at 1024px+. The hero grows with long identity content and at 200% zoom.
- Apply an edge-to-edge bottom gradient inside the hero, not a rounded element around metadata.
- Anchor identity content to the lower portion of the hero with a 16px mobile gutter and 24px desktop gutter.
- Avatar uses a two-pixel translucent neutral halo. It must not inherit the accent colour.

### Wallpaper and avatar media fallbacks

- Resolve wallpaper media in this order: trimmed `themeSettings.wallpaperUrl`, existing `accountData.bg_picture.url`, then `IMAGE_CONFIG.defaultImages.background`.
- A missing, whitespace-only, 404, or undecodable banner/full wallpaper falls back to the preset page surface without changing hero geometry.
- A broken avatar falls back once to the existing default profile image. Error handling must prevent fallback loops when the fallback itself fails.
- Media state is generation-keyed: URL change resets failure state, primary failure tries fallback once, fallback failure hides media, and stale prior callbacks are ignored. Accept relative or HTTP(S) sources only; reject control characters and active schemes.

### Ambient gradient

- The ambient gradient covers the entire page using one calm token composition: `linear-gradient(155deg, color-mix(in srgb, var(--accent-color) 62%, var(--bg-page)) 0%, var(--bg-page) 62%, color-mix(in srgb, var(--accent-color) 18%, var(--bg-page)) 100%)`.
- Render a bounded identity region without an image, metadata card, or decorative radial blobs.
- Bio, tabs, notices, footer, and the panel background remain part of the continuous gradient surface.

### Full wallpaper image

- Keep the wallpaper behind the entire page and create a bounded identity region at the top.
- Apply one continuous polarity-preserving overlay derived from `--bg-page`, increasing from 55% opacity in the identity region to 78% behind content. Tune only toward greater opacity if adversarial rendered-pixel tests fail.
- Existing recommendation cards remain cards. Identity, bio, tabs, notices, and footer never gain individual contrast cards.

### Composition matrix

| Mode | Wallpaper extent | Identity region | Content surface |
|---|---|---|---|
| Solid colour | None | Compact token surface | Opaque `--bg-page` |
| Banner image | Hero only | Identity anchored in bounded media | Opaque `--bg-page` after hero |
| Ambient gradient | Entire page | Bounded identity region, no card | One continuous gradient |
| Full wallpaper image | Entire page | Bounded region with broad gradient | One continuous readability overlay |

## Branding

### Header

- Replace the wordmark with the existing `LogoIcon` from `src/assets/icons/EoeLogo.tsx`.
- Render at 36×36px on mobile and 40×40px at 768px+.
- The home link keeps the accessible name `explorers.earth`.
- The share control remains opposite the brand with a minimum 44×44px target.
- Public navigation remains fixed. At scroll top, solid mode uses the page surface; banner, ambient, and full-wallpaper modes use the transparent hero treatment shown in the approved matrix. When the hero sentinel leaves the viewport, every mode transitions to `--nav-bg` with existing blur/border tokens. Reserve the full 56px navigation height in hero geometry and disable the transition under reduced motion.

### Footer

- Replace the themed badge/pill with `LogoFull` from `src/assets/icons/EoeLogo.tsx`.
- Render the full logo 28px high on mobile and 32px on desktop.
- Use theme-aware `currentColor` lettering while retaining the globe's brand green/blue.
- Do not render a card background, border, pill, gradient, or shadow around the logo.
- Footer links use `--text-secondary`, `--text-primary` on hover/focus, and visible focus treatment. They must never hard-code white.

## Shared Layout Rules

- Mobile page gutter: 16px at 320–639px.
- Tablet/desktop page gutter: 24px at 640px+.
- Main content maximum width: existing `max-w-5xl`.
- Bio, tab rail, notices, headings, empty states, and recommendation layouts share the same content alignment.
- Horizontal recommendation shelves may visually scroll within the gutter, but headings and status messages remain aligned.
- No content may touch the viewport edge or create horizontal document overflow.
- Reserve the fixed mobile product-navigation height plus `env(safe-area-inset-bottom)`. The final footer link remains at least 16px above it.

## Bio Contract

- Bio always renders after the hero on the normal page surface.
- Body text is 16px with a 24px line height and token colours. The expansion control may use 14px text but retains a 44×44px target.
- Short bios render without a container card.
- Long bios use a three-line maximum block size with a semantic `Show more` / `Show less` button. Do not apply `line-clamp` directly across arbitrary rich block children.
- Show the expansion control only when the rendered sanitized content exceeds three lines. Re-measure after font loading, sanitized-content changes, and container/viewport resize; preserve expanded state unless the content no longer overflows.
- Rich text remains sanitized by the existing public-content boundary.
- `PublicProfileBio` sanitizes `html: unknown` at its own render boundary so no caller can bypass the policy.
- Empty bio consumes no vertical placeholder space.
- A link hidden below the collapsed boundary must not receive invisible keyboard focus; focusing such a descendant expands the bio before focus is painted.

## Tab Rail Contract

- The rail is structurally outside the hero and uses the page surface.
- Recommendations and Gallery always render, even with empty content; Business remains conditional. Invalid or unavailable saved tabs fall back to Recommendations, then Gallery.
- Preserve complete tablist/tab/tabpanel semantics and keyboard navigation.
- Each tab has a 48px minimum height and visible selected state using `--accent-color`.
- At 320px, tabs remain centred and may use horizontal scrolling only if Business is present and labels cannot fit without shrinking targets.
- The rail is non-sticky in this scope. It remains in normal document flow below the bio, avoiding collisions with the fixed public navigation and mobile bottom navigation.

## Recommendation and Gallery States

### Initial loading

- One route-level `PublicProfileSkeleton` owns initial loading.
- It matches final hero, bio, tabs, and content geometry and uses neutral tokens until theme data resolves.
- Username validation and public layout must not display separate overlapping loaders.

### Progressive category loading

- Resolved categories render immediately.
- Remaining category skeletons occupy the exact final category positions.
- Loading surfaces use `--bg-card` and `--border-card`; category accent colours do not fill skeleton boxes.

### Empty

- Use a low-chrome inline state with muted icon, short title, and one helpful sentence.
- Do not imply that the owner hid content.
- Do not wrap the state in a large decorative card unless the active layout already requires a card surface.
- Public empty states intentionally have no primary CTA because visitors cannot modify the owner’s profile. Recommendations use `No public recommendations yet` / `Check back later`; Gallery uses `No public photos yet` / `Check back later`.

### Partial failure

- Render successful categories first.
- Place a compact inline notice after available content: `Some categories are unavailable` plus `Try again`.
- Retry targets only failed category requests and retains successful content.

### All failure

- Render an actionable centred state with `Couldn’t load recommendations` and `Try again`.
- Preserve the hero, tabs, footer, and active tab while retrying.

### Gallery empty/error

- Match the same low-chrome state vocabulary and gutter alignment.
- Keep Gallery upload/import behavior out of this public-route scope.

`PublicProfileFeedback` owns inline empty/partial/all-error messages through a discriminated union. It does not own the full-page skeleton.

## Theme and Wallpaper Matrix

The implementation is one token-driven system, not 24 bespoke layouts.

| Axis | Required values |
|---|---|
| Preset | Cinematic Dark, Glassmorphism, Sunset Glow, Minimal Light, Emerald Nature, Neon Cyber |
| Wallpaper | solid colour, banner image, ambient gradient, full wallpaper image |
| Viewport | 320, 375, 768, 1024, 1440 |
| Content | populated, long/missing bio, missing/broken images, empty, loading, partial error, all error |
| Direction | LTR and RTL |

Every preset × wallpaper combination must render without overlap, overflow, invisible text/icons, theme-coloured footer branding, or an identity metadata box. Automated coverage may use pairwise state reduction, but all 24 base visual combinations must render in Chromium at mobile and desktop sizes.

## Accessibility and Motion

- Text contrast: WCAG AA 4.5:1; UI/icon contrast: 3:1.
- Test rendered pixels for composed image/gradient heroes, not CSS token values alone. Derive glyph/icon masks from paired normal and foreground-transparent captures; require the minimum ratio among core pixels with at least 80% foreground coverage. Do not use a best-pixel percentile.
- All interactive targets are at least 44×44px.
- Focus indicators remain visible on brand link, share, tabs, bio expansion, retry, cards, and footer links.
- At 200% zoom the page reflows without horizontal document scrolling.
- Skeleton animation stops under `prefers-reduced-motion: reduce`.

## Component Boundaries

- `PublicProfileHeader`: owns navigation branding, wallpaper-mode composition, identity, and hero geometry.
- `PublicProfileBio`: owns sanitized bio, clamp state, and expansion control.
- `PublicProfileTabs`: owns semantic tabs and 320px overflow/scroll behavior in normal document flow.
- `PublicProfileSkeleton`: owns the single route-level geometry-matched shell.
- `PublicProfileFeedback`: owns a discriminated empty/partial/all-error vocabulary and requires retry props only for retryable variants.
- `PublicProfileFooter`: owns stable brand and legal links.
- `resolvePublicProfileSurface`: pure resolver for wallpaper mode, media precedence, and fallback presentation.
- `PublicProfile.tsx`: owns data orchestration and composes the above; it must not retain mode-specific markup branches inline.

Existing recommendation presentation components keep their layout responsibility and receive aligned containers/state components rather than duplicating hero logic.

## Loading Ownership

`PublicLayout` is mounted throughout username validation and owns a typed React readiness context: `validating-username`, `loading-route`, `ready`, `not-found`, or `route-error`. Each signal is keyed by `{ username, location.key }`; stale prior-route signals are ignored. Empty username results become Not Found; username-query failures become `Couldn’t verify this profile`; profile-query failures become `Couldn’t load this profile`. Both error states provide single-flight Retry, retain the error on rejection, and never masquerade as a 404.

The shared layout continues to support existing nested public routes. This branch retains an adapter for legacy `setIsPageLoaded` consumers and removes `window.__publicProfileLoaded` only from `PublicProfile`; global removal waits until every public route migrates. Regression coverage includes the profile, Places, Guides, another recommendation category, username switching, and back navigation.

Category queries remain progressive inside the active panel.

## Error Observability

- User-facing copy remains category-agnostic and safe.
- Development/test logging identifies failed category IDs and operation names without exposing private account data.
- The existing analytics 401 is a separate concern and must not be presented as a recommendation-category failure without evidence.

## Footer Setting Semantics

- `enabled`: full logo plus legal/profile links inside `<nav aria-label="Footer">`; separators are `aria-hidden`.
- `minimal`: full logo only.
- `disabled`: no branding and no reserved whitespace.
- The full logo is a home link with a 44px target and `--text-primary` lettering, never the user accent.

## Share Failure Semantics

- Web Share `AbortError`: no message.
- Other Web Share failures: attempt the clipboard fallback.
- Clipboard unavailable or rejected: visible user-facing error plus contextual development logging without private profile data.

## Acceptance Criteria

1. No rounded metadata box appears in any wallpaper mode.
2. The avatar never uses the selected accent as a thick ring.
3. Tabs never overlap the hero at any required viewport.
4. Bio and active panel align to the same mobile/desktop gutters.
5. Header uses `LogoIcon`; footer uses a larger cardless `LogoFull`.
6. Footer branding remains recognizably identical across all presets.
7. Exactly one initial public-profile loading shell is visible.
8. Partial failures do not displace successful categories.
9. All 24 preset × wallpaper combinations pass mobile and desktop visual assertions.
10. Existing public-profile navigation, recommendation layouts, SEO, sanitization, and account privacy behavior remain green.
11. A named 24-combination screenshot contact sheet is produced as a review artifact.
12. New public copy is localized across all shipped resources with placeholder parity.

## Not in Scope

- New theme presets or wallpaper modes.
- Dashboard theme-control redesign or persistence schema changes.
- Recommendation category visibility or taxonomy changes.
- Tunes account synchronization.
- Google Places API migration.
- Analytics authentication repair unless it is proven to block public content.
- Desktop dashboard Profile editor changes.
