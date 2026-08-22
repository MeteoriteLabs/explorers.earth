# Profile Readiness and Public Route Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the existing profile/dashboard work by making loaders, every public route, saved appearance settings, and real-account UI behavior reliable and fully verified.

**Architecture:** Retain the completed adaptive profile surface and editor organization. Replace legacy booleans/global flags with a generation-keyed route state machine owned by `PublicLayout`; migrate every leaf to explicit loading/ready/refreshing/error reporting, then prove dashboard-to-public persistence through deterministic and real-account UI tests.

**Tech Stack:** React 18, TypeScript, React Router, Apollo Client, TanStack Query, Vitest, React Testing Library, Playwright/Chromium, Sharp, ESLint.

**Spec:** `docs/superpowers/specs/2026-08-22-profile-readiness-route-reliability-design.md`

## Global Constraints

- Work only in the existing `codex/profile-dashboard-public-profile` worktree and branch.
- Preserve all completed profile tabs, Settings account relocation, Appearance controls, gallery accordion, themes, saved data fields, and public adaptive-surface work unless a failing test proves a regression.
- Do not modify Tunes/local-user synchronization, its API contracts, or files owned by the other task.
- Do not change public URL taxonomy, recommendation categories, or persistence schemas.
- No fixed loader delay, global readiness flag, production write, or unbounded retry.
- Every behavior change starts with a failing test and ends with focused verification.

## Task 0: Freeze and Truthful Baseline

**Files:**
- Modify: `docs/superpowers/reports/2026-08-21-public-profile-adaptive-theme-surface-qa.md`
- Create: `.superpowers/sdd/2026-08-22-profile-readiness-route-reliability/baseline.md`

- [ ] Record `git status`, HEAD, remote SHA, Node/npm versions, available environment keys by name only, and known test-account routes without recording secrets.
- [ ] Run the current focused route, profile, Appearance, persistence, and adaptive Playwright tests individually; record exact pass/fail counts and durations.
- [ ] Run `npm run lint -- --quiet`, `npx tsc -b`, `npm run i18n:check`, `npm run build`, and the full `npm run test:unit` with captured summaries.
- [ ] Reproduce `/tk2727/places` and every route-family index in Chromium. Capture URL, final state, requests, console errors, and elapsed readiness condition.
- [ ] Mark the old QA report superseded where its claimed 4/4 and 100% results differ from fresh evidence.
- [ ] Confirm `git diff --quiet origin/main...HEAD -- tunes/` and record that Tunes remains isolated.
- [ ] Commit only baseline documentation: `docs(profile): record truthful reliability baseline`.

## Task 1: Define the Route State Machine

**Files:**
- Modify: `explorers-earth/src/layouts/PublicRouteReadinessContext.tsx`
- Test: `explorers-earth/src/layouts/__tests__/PublicRouteReadinessContext.test.tsx`
- Create: `explorers-earth/src/layouts/publicRouteReadiness.ts`
- Test: `explorers-earth/src/layouts/__tests__/publicRouteReadiness.test.ts`

**Produces:** `PublicRouteState`, immutable `PublicRouteGeneration`, and generation-bound methods `begin`, `ready`, `refreshing`, `empty`, `fail`, and `retry`.

- [ ] Write failing reducer tests for valid transitions, ready-with-empty data, refreshing with retained content, single-flight Retry, retry rejection, and invalid transitions.
- [ ] Write a failing race test in which route A resolves after route B begins; prove A cannot alter B.
- [ ] Implement the pure reducer and generation-bound action factory. Callbacks capture their generation at creation time rather than reading the current generation later.
- [ ] Remove `setIsPageLoaded` from the public context interface after compilation identifies all remaining consumers.
- [ ] Run the two focused test files and `npx tsc -b`.
- [ ] Commit: `refactor(public-profile): define generation-safe route states`.

## Task 2: Give Bootstrap and Skeletons One Owner

**Files:**
- Modify: `explorers-earth/src/layouts/PublicLayout.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicProfileSkeleton.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicProfile.tsx`
- Modify: `explorers-earth/src/routes/validators/TabVisibilityGuard.tsx`
- Test: `explorers-earth/src/routes/__tests__/PublicRoutes.test.tsx`
- Test: `explorers-earth/src/features/PublicHome/components/__tests__/PublicProfileSkeleton.test.tsx`

- [ ] Write failing tests for Earth on direct/hard bootstrap, Earth removal as soon as identity/theme resolve, leaf skeleton after bootstrap, no Earth on internal navigation, and no duplicate skeleton.
- [ ] Write failing tests proving cache-and-network revalidation retains content and hidden tabs resolve deliberately rather than returning a blank indefinite state.
- [ ] Render Earth from `PublicLayout` only during bootstrap; render the stable outlet shell for leaf states.
- [ ] Remove both `window.__publicProfileLoaded` reads/writes and duplicate `ProfileSkeleton` branches from `PublicProfile`.
- [ ] Make `TabVisibilityGuard` return explicit visible/hidden/error readiness while retaining usable data during refresh.
- [ ] Verify reduced motion and that no timeout or artificial delay controls readiness.
- [ ] Run focused tests, lint for changed files, and `npx tsc -b`.
- [ ] Commit: `fix(public-profile): unify bootstrap and skeleton ownership`.

## Task 3: Migrate Every Public Route Leaf

**Files:**
- Modify: `explorers-earth/src/routes/PublicRoutes.tsx`
- Delete: inline `ReadyOnMount` from `explorers-earth/src/routes/PublicRoutes.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicProfile.tsx`
- Modify: `explorers-earth/src/pages/public/PublicMusic.tsx`
- Modify: `explorers-earth/src/pages/public/PublicHomePage.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/MapView.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/PlaceMapView.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicGuides.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicGuideDetailPage.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/Community.tsx`
- Modify: `explorers-earth/src/features/Movies/components/public/PublicMovies.tsx`
- Modify: `explorers-earth/src/features/Movies/components/public/PublicMovieGenre.tsx`
- Modify: `explorers-earth/src/features/Movies/components/public/PublicMovieList.tsx`
- Modify: `explorers-earth/src/features/Books/components/public/PublicBooks.tsx`
- Modify: `explorers-earth/src/features/Books/components/public/PublicBookSubject.tsx`
- Modify: `explorers-earth/src/features/Books/components/public/PublicBookList.tsx`
- Modify: `explorers-earth/src/features/Games/components/public/PublicGames.tsx`
- Modify: `explorers-earth/src/features/Games/components/public/PublicGamesGenre.tsx`
- Modify: `explorers-earth/src/features/Games/components/public/PublicGamesList.tsx`
- Modify: `explorers-earth/src/features/AppsAndTools/components/public/PublicApps.tsx`
- Modify: `explorers-earth/src/features/AppsAndTools/components/public/PublicAppList.tsx`
- Modify: `explorers-earth/src/features/Products/components/public/PublicProducts.tsx`
- Modify: `explorers-earth/src/features/Products/components/public/PublicProductList.tsx`
- Modify: `explorers-earth/src/features/People/components/public/PublicPeople.tsx`
- Modify: `explorers-earth/src/features/People/components/public/PublicPersonSector.tsx`
- Modify: `explorers-earth/src/features/People/components/public/PublicPersonList.tsx`
- Create: `explorers-earth/src/routes/__tests__/PublicRouteMatrix.test.tsx`
- Test: `explorers-earth/src/routes/__tests__/PublicRoutes.test.tsx`

- [ ] Create a table-driven failing test covering root, Music, all Places variants, Guides variants, Community, and every Movies/Books/Games/Apps/Products/People index/filter/detail pattern.
- [ ] For each leaf, add explicit initial-loading, ready/empty, refreshing-with-content, and error/Retry signals tied to its actual query lifecycle.
- [ ] Replace `ReadyOnMount` for maps, guide detail, and Community with data-aware readiness.
- [ ] Ensure a query error cannot be interpreted as `loading: false => ready`.
- [ ] Add explicit unknown-child-route Not Found behavior and a regression test showing `/spaces` is not a supported category.
- [ ] Add direct-entry, internal navigation, username switch, back/forward, stale completion, and unmount tests.
- [ ] Run the route matrix, affected page tests, and `npx tsc -b`.
- [ ] Commit: `fix(public-profile): migrate all public routes to explicit readiness`.

## Task 4: Finish Confirmed Public UI Defects

**Files:**
- Modify: `explorers-earth/src/features/PublicHome/components/PublicProfileHeader.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicProfile.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/SafePublicRichText.tsx`
- Modify: `explorers-earth/src/features/PublicHome/utils/publicProfileContent.ts`
- Modify: `explorers-earth/src/features/Profile/components/ThemeAppearanceSection.tsx`
- Test: corresponding component test files

- [ ] Write failing tests that avatar activation opens the photo viewer for custom and default images while Share retains native share/fallback behavior.
- [ ] Test semantic button behavior, iOS/Android screen-reader name, Enter/Space activation, Escape close, focus return, and descriptive enlarged-image alt text.
- [ ] Write sanitizer/render tests preserving bold, italic, headings, lists, and links while falling back only foreground/highlight colours that fail the active surface contrast.
- [ ] Fix the existing 2.48 theme icon contrast failure to meet the 3:1 UI target and test all six presets.
- [ ] Add mobile geometry tests proving Save & Publish, Appearance horizontal scrolling, cards, descriptions, and bottom safe area never overlap at 320/375 widths and short heights.
- [ ] Run focused component tests, lint, TypeScript, and the adaptive Playwright spec.
- [ ] Commit: `fix(profile): finish viewer contrast and mobile appearance states`.

## Task 5: Prove Dashboard Settings and Persistence

**Files:**
- Extend: `explorers-earth/e2e/profile-editor-polish.spec.ts`
- Extend: `explorers-earth/e2e/profile-theme.spec.ts`
- Extend: `explorers-earth/e2e/profile-presentation-visual.spec.ts`
- Create: `explorers-earth/e2e/profile-settings-persistence.spec.ts`
- Modify tests under `explorers-earth/src/features/Profile/**/__tests__`

- [ ] Build a canonical settings manifest covering all six themes, four wallpaper modes, hero present/absent/broken, three footer modes, profile tabs, social/bio fields, gallery accordion, recommendation layouts, and all nine category-order entries.
- [ ] Add exhaustive option tests for every manifest value and round-trip serialization tests for the complete save payload.
- [ ] Test pointer drag from the intended card interaction area, handle-only behavior where required by the approved editor design, touch interaction, cancel/rollback, rapid saves, failed saves, and keyboard reorder.
- [ ] Render every one of the 24 theme × wallpaper combinations at 375 and 1024 pixels. Add 320/768/1440 boundary runs and high-risk long-bio/broken-media/RTL cases.
- [ ] Use pairwise generation for independent secondary settings, with explicit coverage assertions proving every value and every pair appears.
- [ ] Verify mobile Gallery Import control expands Google Photos and Instagram on the right-aligned action surface.
- [ ] Run the focused unit and UI suites and preserve named screenshot/contact-sheet artifacts.
- [ ] Commit: `test(profile): cover settings combinations and persistence`.

## Task 6: Real Dashboard-to-Public Chrome Journey

**Files:**
- Create: `explorers-earth/e2e/real-account/profile-dashboard-public.smoke.spec.ts`
- Create: `explorers-earth/e2e/real-account/README.md`
- Extend: `explorers-earth/e2e/public-profile-adaptive-surface.spec.ts`

- [ ] Document required environment variable names, safe test-account preconditions, backup/restore procedure, and skip behavior when credentials are unavailable; never commit credentials.
- [ ] Capture the testing account’s current mutable profile/theme values before the test and restore them in `finally`, even after failure.
- [ ] Through UI controls, update one representative value from every persisted group: identity/bio/social, theme/wallpaper, recommendation layout/order, footer, and gallery setting.
- [ ] Save, wait on the actual mutation response rather than time, hard refresh dashboard, and assert controls reflect saved values.
- [ ] Open the public root and every enabled category route in Chrome; assert the saved values, loading sequence, content/empty state, no overlap, and no unhandled console/network failure.
- [ ] Exercise direct deep links, internal navigation, back/forward, reload, slow mocked category, failed category with Retry, invalid username, invalid child route, and stale navigation race.
- [ ] Restore the account and verify restoration on dashboard and public page.
- [ ] Commit: `test(profile): add controlled real-account public journey`.

## Task 7: Full Verification and Honest QA Report

**Files:**
- Create: `docs/superpowers/reports/2026-08-22-profile-readiness-route-reliability-qa.md`
- Modify only defects proven by the final gates

- [ ] Run `npm run lint -- --quiet`; expected zero errors.
- [ ] Run `npx tsc -b`; expected success.
- [ ] Run `npm run i18n:check`; expected success and placeholder parity.
- [ ] Run `npm run test:unit -- --reporter=verbose`; expected complete summary with zero failures.
- [ ] Run each profile/public Playwright file separately, then `npm run test:e2e`; expected zero failures without relying on a pre-existing server.
- [ ] Run `npm run build`; expected production build success.
- [ ] Perform the real-account Chrome walkthrough at 375 and 1440 pixels, including clean console/network inspection and screenshot evidence.
- [ ] Review the complete diff with `git diff --check`, `git status --short`, and `git diff --stat origin/main...HEAD`.
- [ ] Run `git diff --quiet origin/main...HEAD -- tunes/`; expected exit 0.
- [ ] Write actual commands, versions, counts, failures, skips, environment limitations, artifact paths, and remaining risks. Never claim 100% when any required check failed or skipped.
- [ ] Run the `superpowers:requesting-code-review` and `superpowers:verification-before-completion` gates, resolve findings test-first, then rerun affected and full gates.
- [ ] Commit: `docs(profile): record verified route reliability results`.
- [ ] Push `codex/profile-dashboard-public-profile` only after the worktree is clean and all required gates pass.

## Plan Self-Review Checklist

- [x] Every supported public route family and detail/filter/map pattern is named.
- [x] Bootstrap, initial leaf loading, cached refresh, empty, error, retry, not-found, and stale-navigation states are covered.
- [x] Earth-on-refresh and no-Earth-on-internal-navigation decisions are explicit and timer-free.
- [x] Avatar viewer, native Share, rich-text preservation/contrast fallback, mobile Appearance clearance, Gallery controls, drag/keyboard reorder, themes, layouts, and category order are covered.
- [x] Exhaustive bounded matrices, pairwise secondary combinations, responsive boundaries, accessibility, and real-account persistence are included.
- [x] Existing completed work is preserved; the plan starts from the current branch rather than recreating it.
- [x] Tunes/user-sync is explicitly excluded and checked at baseline and completion.
- [x] Each implementation task begins with a failing test, has focused verification, and ends in a reviewable commit.
- [x] Final claims require fresh evidence and correct the stale QA report.

## Execution Checkpoints

1. Tasks 0–2: baseline and loading architecture review.
2. Task 3: complete route-matrix review before UI polish.
3. Tasks 4–5: visual/settings review with screenshot matrix.
4. Task 6: user-observable real-account journey and restoration review.
5. Task 7: independent code review, full verification, QA report, and push.
