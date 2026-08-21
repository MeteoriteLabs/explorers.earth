# Task 1 Report: Normalize Wallpaper Presentation and Extract the Header

## Summary
Successfully implemented Task 1 of the Public Profile Adaptive Theme Surface Implementation Plan. Extracted `PublicProfileHeader.tsx`, created pure surface resolver `resolvePublicProfileSurface.ts`, removed legacy metadata card scrim/accent border, enforced safe media URLs and scroll-sensitive navigation, updated responsive styling, integrated into `PublicProfile.tsx`, and verified all 105 tests in `src/features/PublicHome` pass cleanly.

## Key Changes
1. **Pure Surface Resolver (`src/features/PublicHome/utils/resolvePublicProfileSurface.ts`)**:
   - Pure function mapping `{ wallpaperMode, wallpaperUrl, bgPictureUrl, defaultWallpaperUrl }` to `{ mode, wallpaperUrl, fallbackToPresetSurface }`.
   - Media precedence: trimmed `wallpaperUrl` -> `bgPictureUrl` -> `defaultWallpaperUrl`.
   - `isSafeMediaUrl` helper checking control characters (`/[\x00-\x1F\x7F]/`) and non-HTTP/HTTPS schemes.

2. **Adaptive Identity Header (`src/features/PublicHome/components/PublicProfileHeader.tsx`)**:
   - Renders cardless identity block with `data-wallpaper-mode` on hero (`data-testid="public-profile-hero"`).
   - Dynamic avatar rendering: semantic `<button aria-label="View profile photo">` when `onAvatarActivate` is provided, non-interactive `<div>` otherwise.
   - Generation-keyed image error fallbacks for banner media and avatar.
   - Fixed top navbar with scroll sentinel transition to `var(--nav-bg)` / `var(--border-card)`.
   - Semantic brand link rendering `LogoIcon` (`screen.getByRole("link", { name: "explorers.earth" })`).
   - Strict `referrerPolicy="no-referrer"` on all media elements.

3. **Data Orchestrator Integration & Full Wallpaper Media Fallback (`src/features/PublicHome/components/PublicProfile.tsx`)**:
   - Replaced old top navbar and legacy banner/card markup with `<PublicProfileHeader />`.
   - Implemented `FullWallpaperBackground` state machine so broken custom wallpaper URLs in `full-wallpaper-image` mode fall back cleanly to `IMAGE_CONFIG.defaultImages.background`, and if default background also fails, remove broken image element to render dark neutral backdrop (`bg-black/50 backdrop-blur-sm`).
   - Added memoized `surface`, `socialLinks`, and `handleShare` hooks.

4. **Responsive CSS (`src/index.css`)**:
   - Added `.public-profile-hero[data-wallpaper-mode="banner-top"]` min-heights: `17.5rem` (mobile), `20rem` (`@media min-width: 48rem`), and `22.5rem` (`@media min-width: 64rem`).

5. **Test Coverage**:
   - Unit tests for surface resolution (`src/features/PublicHome/utils/__tests__/resolvePublicProfileSurface.test.ts`) - 8 tests.
   - Unit tests for header component (`src/features/PublicHome/components/__tests__/PublicProfileHeader.test.tsx`) - 16 tests covering scroll sentinel state transitions, reduced motion styling, cardless identity rendering, avatar button toggling, media error fallbacks, safe URLs, and share behavior.
   - Presentation test suite (`src/features/PublicHome/components/__tests__/PublicProfile.presentation.test.tsx`) updated and verified - 25 tests, including test for `full-wallpaper-image` broken media fallback state machine.
   - Full `src/features/PublicHome` test suite: 105/105 tests GREEN.

## Code Review Fixes (Task Reviewer Feedback)
1. **`full-wallpaper-image` Media Fallback Handling**:
   - Fixed broken media handling in `PublicProfile.tsx` by introducing `FullWallpaperBackground` state machine.
   - When custom image URL fails loading, falls back to `IMAGE_CONFIG.defaultImages.background`; if default image fails loading, hides broken `<img>` element leaving dark neutral surface container.
   - Verified via unit test in `PublicProfile.presentation.test.tsx`.

2. **Expanded Test Suite in `PublicProfileHeader.test.tsx`**:
   - Added test simulating top-of-page transparent header (`isIntersecting: true`) transitioning to scrolled header style (`isIntersecting: false`) when scroll sentinel crosses threshold.
   - Added test verifying `motion-reduce:transition-none` class application on header and hero elements.
   - Added test asserting `full-wallpaper-image` mode cardless identity block rendering.

## Files Created / Modified
- `explorers-earth/src/features/PublicHome/utils/resolvePublicProfileSurface.ts` (NEW)
- `explorers-earth/src/features/PublicHome/utils/__tests__/resolvePublicProfileSurface.test.ts` (NEW)
- `explorers-earth/src/features/PublicHome/components/PublicProfileHeader.tsx` (NEW)
- `explorers-earth/src/features/PublicHome/components/__tests__/PublicProfileHeader.test.tsx` (NEW)
- `explorers-earth/src/features/PublicHome/components/PublicProfile.tsx` (MODIFIED)
- `explorers-earth/src/features/PublicHome/components/__tests__/PublicProfile.presentation.test.tsx` (MODIFIED)
- `explorers-earth/src/index.css` (MODIFIED)

## Verification
- Commits:
  - `dc64414` ("refactor(public-profile): add adaptive identity hero")
  - `5961422` ("fix(public-profile): resolve review issues for full wallpaper fallback and header tests")
- Tests verified: `npx vitest run src/features/PublicHome` -> 105 tests passed across 9 test files (0 failures).
