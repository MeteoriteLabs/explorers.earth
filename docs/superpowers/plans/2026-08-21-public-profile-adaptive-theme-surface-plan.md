# Public Profile Adaptive Theme Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public profile visually stable and accessible across all six theme presets and four wallpaper modes, with a responsive hero, visible tabs, aligned content, stable branding, and one coherent loading/state system.

**Architecture:** Split the oversized public-profile renderer into focused header, bio, tabs, and state components driven by a normalized wallpaper presentation model. Keep recommendation data and saved presentation semantics intact. Consolidate initial loading ownership in `PublicLayout`, then verify the real compositions with unit tests and Chromium screenshot/geometry assertions.

**Tech Stack:** React 18, TypeScript, Tailwind/CSS custom properties, Apollo Client, TanStack Query, React Router, Vitest, React Testing Library, Playwright, Sharp.

**Spec:** `docs/superpowers/specs/2026-08-21-public-profile-adaptive-theme-surface-design.md`

**Approved visual reference:** `docs/design-system/mockups/page/public-profile-adaptive-theme-matrix-approved-2026-08-21.png`

**Reference precedence:** The adaptive-surface spec and approved matrix supersede the older public-profile mock for header branding, identity treatment, avatar border, hero composition, and footer branding. The older mock remains a recommendation-card vocabulary reference.

## Global Constraints

- Work only in `codex/profile-dashboard-public-profile`; do not touch Tunes user-sync behavior.
- Theme preset and wallpaper mode remain independent persisted settings.
- Do not change the GraphQL schema, dashboard save payload, recommendation taxonomy, or public URLs.
- Use existing semantic theme tokens and the 4px spacing scale; introduce no new raw palette.
- Preserve the public rich-text sanitizer and HTTP(S)/email URL safety boundaries.
- Text contrast is at least 4.5:1; icon/UI contrast is at least 3:1.
- Interactive targets are at least 44×44px and retain visible focus.
- Test production behavior before claiming completion; no live production writes.

---

## File Structure and Responsibilities

- Create `explorers-earth/src/features/PublicHome/components/PublicProfileHeader.tsx`: adaptive navigation/hero/identity composition.
- Create `explorers-earth/src/features/PublicHome/components/PublicProfileBio.tsx`: sanitized bio and expansion behavior.
- Create `explorers-earth/src/features/PublicHome/components/PublicProfileTabs.tsx`: semantic non-sticky tab rail with 320px overflow handling.
- Create `explorers-earth/src/features/PublicHome/components/PublicProfileSkeleton.tsx`: single geometry-matched route shell.
- Create `explorers-earth/src/features/PublicHome/components/PublicProfileFeedback.tsx`: discriminated low-chrome public empty/error notices.
- Create `explorers-earth/src/features/PublicHome/utils/resolvePublicProfileSurface.ts`: pure wallpaper/media/fallback resolver.
- Create `explorers-earth/src/layouts/PublicRouteReadinessContext.tsx`: generation-keyed readiness provider and legacy adapter.
- Create matching focused tests under `components/__tests__/`.
- Modify `PublicProfile.tsx`: data orchestration and composition only.
- Modify `PublicProfileFooter.tsx`: icon/full-logo branding contract and token-safe links.
- Modify `ProfileRecommendationsTab.tsx` and `ProfileRecommendationsLayouts.tsx`: aligned content and progressive state surfaces.
- Modify `PublicRoutes.tsx`, `PublicLayout.tsx`, and `UsernameValidator.tsx`: typed shared-route readiness with a legacy adapter.
- Modify `index.css`: scoped adaptive hero/tab/content styles, token-only.
- Modify `e2e/profile-presentation-visual.spec.ts`: all 24 base combinations and state geometry.
- Create `e2e/support/publicProfileFixture.ts`: shared strict deterministic public-profile fixture.
- Create `e2e/public-profile-adaptive-surface.spec.ts`: real route orchestration, loader count, and responsive/accessibility regression journey.
- Modify `.github/workflows/ci.yml`: always upload the public-profile contact sheet.

### Task 0: Lock the Approved Design Package

**Files:**
- Create: `docs/superpowers/specs/2026-08-21-public-profile-adaptive-theme-surface-design.md`
- Create: `docs/superpowers/plans/2026-08-21-public-profile-adaptive-theme-surface-plan.md`
- Create: `docs/design-system/mockups/page/public-profile-adaptive-theme-matrix-approved-2026-08-21.png`

- [ ] **Step 1: Verify the design package and branch isolation**

Run:

```bash
git diff --check
git diff --quiet origin/main...HEAD -- tunes/
git status --short
```

Expected: no whitespace errors, no Tunes diff, and only the three approved design-package files before implementation.

- [ ] **Step 2: Commit the approved design package**

```bash
git add docs/superpowers/specs/2026-08-21-public-profile-adaptive-theme-surface-design.md docs/superpowers/plans/2026-08-21-public-profile-adaptive-theme-surface-plan.md docs/design-system/mockups/page/public-profile-adaptive-theme-matrix-approved-2026-08-21.png
git commit -m "docs(public-profile): approve adaptive theme surface plan"
```

### Task 1: Normalize Wallpaper Presentation and Extract the Header

**Files:**
- Create: `explorers-earth/src/features/PublicHome/components/PublicProfileHeader.tsx`
- Create: `explorers-earth/src/features/PublicHome/utils/resolvePublicProfileSurface.ts`
- Create: `explorers-earth/src/features/PublicHome/utils/__tests__/resolvePublicProfileSurface.test.ts`
- Create: `explorers-earth/src/features/PublicHome/components/__tests__/PublicProfileHeader.test.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicProfile.tsx`
- Modify: `explorers-earth/src/index.css`
- Modify: `explorers-earth/src/i18n/resources/en.json`

**Interfaces:**
- Consumes: existing `ThemeSettings`, `WallpaperMode`, `LogoIcon`, normalized social-link view models, share handler.
- Produces:

```ts
export type PublicProfileHeroMode =
  | "solid-color"
  | "banner-top"
  | "ambient-gradient"
  | "full-wallpaper-image";

export interface PublicProfileSocialLinkViewModel {
  id: string;
  href: string;
  ariaLabel: string;
  renderIcon: (props: { className?: string }) => React.ReactNode;
  analyticsPlatform: string;
}

export interface PublicProfileSurface {
  mode: PublicProfileHeroMode;
  wallpaperUrl: string | null;
  fallbackToPresetSurface: boolean;
}

export interface PublicProfileHeaderProps {
  surface: PublicProfileSurface;
  accountName: string;
  location?: string;
  avatarUrl?: string;
  socialLinks: PublicProfileSocialLinkViewModel[];
  onShare: () => void;
  onAvatarActivate?: () => void;
}
```

- [ ] **Step 1: Write failing surface resolver and header composition tests**

```tsx
it.each(["solid-color", "banner-top", "ambient-gradient", "full-wallpaper-image"] as const)(
  "renders %s without a metadata card or accent avatar ring",
  (mode) => {
    render(<PublicProfileHeader {...fixtureProps} surface={{ mode, wallpaperUrl: null, fallbackToPresetSurface: false }} />);
    expect(screen.getByTestId("public-profile-hero")).toHaveAttribute("data-wallpaper-mode", mode);
    expect(screen.queryByTestId("profile-metadata-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("profile-avatar")).not.toHaveStyle({ borderColor: "var(--accent-color)" });
    expect(screen.getByRole("link", { name: "explorers.earth" })).toBeVisible();
  },
);
```

Resolver cases prove trimmed custom wallpaper → existing `bg_picture` → default background static precedence. HTTP, decode, and fallback-image failures belong to a one-shot header media state machine and component tests; the pure resolver does not simulate a 404.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm exec -- vitest run src/features/PublicHome/utils/__tests__/resolvePublicProfileSurface.test.ts src/features/PublicHome/components/__tests__/PublicProfileHeader.test.tsx`

Expected: FAIL because the resolver and `PublicProfileHeader` do not exist.

- [ ] **Step 3: Implement the pure surface resolver and four explicit hero modes**

Use `data-wallpaper-mode`, a mode-specific media layer, and one identity block. Render `LogoIcon` inside a semantic home link. Apply the gradient to the hero bounds for image modes; do not place a background, radius, border, or shadow on the metadata block.

Ambient mode uses the spec's single page-wide `linear-gradient(155deg, …)` token recipe rather than radial blobs. Full-wallpaper mode uses the normative continuous `--bg-page`-derived overlay, 55% at identity to 78% behind content; do not add individual contrast cards around identity, bio, tabs, notices, or footer.

Use the resolver output rather than reading raw account/theme data inside the header. Broken avatar/wallpaper handlers are one-shot and fall back to the specified neutral surfaces without changing geometry.

The media state machine is generation-keyed: a primary URL change resets failures; primary failure tries fallback once; fallback failure hides media and uses the preset surface; stale prior `onError` callbacks and post-unmount completions are ignored. Accept only relative or HTTP(S) media URLs, reject control characters/active schemes, and set a privacy-preserving referrer policy on external media. Tests cover whitespace, `javascript:`, 404/decode failure, fallback failure, rapid replacement, and stale error delivery.

Preserve profile-photo enlargement through `onAvatarActivate`. When supplied, render a semantic button labelled `View profile photo`; never retain a clickable div. Decorative wallpaper media has `alt=""`; avatar alt text names the account.

Preserve share behavior with explicit branches: Web Share `AbortError` is silent; other Web Share failures try clipboard; unavailable/rejected clipboard shows the existing toast pattern and a contextual development log. Tests cover absent `navigator.share`, cancellation, and clipboard rejection.

- [ ] **Step 4: Move current header markup out of `PublicProfile.tsx`**

Delete the shared `usesComposedHeaderTreatment` black-card branch and the inline accent border. Pass normalized account/social values to the extracted component without changing social URL normalization.

- [ ] **Step 5: Add scoped responsive CSS**

```css
.public-profile-hero[data-wallpaper-mode="banner-top"] {
  min-height: 17.5rem;
}

@media (min-width: 48rem) {
  .public-profile-hero[data-wallpaper-mode="banner-top"] {
    min-height: 20rem;
  }
}

@media (min-width: 64rem) {
  .public-profile-hero[data-wallpaper-mode="banner-top"] {
    min-height: 22.5rem;
  }
}
```

Use existing CSS variables for surfaces/text and existing shadow tokens. Keep all values on the documented spacing scale.

Add solid, banner, ambient, full-wallpaper, and broken-media geometry contracts. At 320px, a 47-character name, wrapped location, all social links, and 200% zoom must grow the hero without clipping or tab overlap.

Add top-of-page and scrolled navigation tests for all four modes. Reserve 56px in hero geometry; verify transparent composed treatment at the hero and `--nav-bg` with existing blur/border tokens after the hero sentinel exits. Reduced motion disables the transition.

Use no avatar shadow unless the documented `--shadow-sm` token is defined once; do not fall back to `shadow-xl`.

- [ ] **Step 6: Run header tests and public-profile presentation tests**

Run: `npm exec -- vitest run src/features/PublicHome/utils/__tests__/resolvePublicProfileSurface.test.ts src/features/PublicHome/components/__tests__/PublicProfileHeader.test.tsx src/features/PublicHome/components/__tests__/PublicProfile.presentation.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add explorers-earth/src/features/PublicHome/utils/resolvePublicProfileSurface.ts explorers-earth/src/features/PublicHome/utils/__tests__/resolvePublicProfileSurface.test.ts explorers-earth/src/features/PublicHome/components/PublicProfileHeader.tsx explorers-earth/src/features/PublicHome/components/__tests__/PublicProfileHeader.test.tsx explorers-earth/src/features/PublicHome/components/PublicProfile.tsx explorers-earth/src/index.css
git commit -m "refactor(public-profile): add adaptive identity hero"
```

### Task 2: Put Bio and Tabs on a Stable Page Surface

**Files:**
- Create: `explorers-earth/src/features/PublicHome/components/PublicProfileBio.tsx`
- Create: `explorers-earth/src/features/PublicHome/components/PublicProfileTabs.tsx`
- Create: `explorers-earth/src/features/PublicHome/components/__tests__/PublicProfileBio.test.tsx`
- Create: `explorers-earth/src/features/PublicHome/components/__tests__/PublicProfileTabs.test.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicProfile.tsx`
- Modify: `explorers-earth/src/index.css`

**Interfaces:**

```ts
export interface PublicProfileBioProps {
  html: unknown;
  collapsedLines?: 3;
}

export interface PublicProfileTabDefinition {
  id: "recommendations" | "gallery" | "business";
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

export interface PublicProfileTabsProps {
  tabs: PublicProfileTabDefinition[];
  activeTab: PublicProfileTabDefinition["id"];
  onChange: (tab: PublicProfileTabDefinition["id"]) => void;
}
```

- [ ] **Step 1: Write RED tests for bio expansion and complete tab semantics**

```tsx
it("keeps the active tab visible and supports arrow navigation", async () => {
  const user = userEvent.setup();
  render(<PublicProfileTabs tabs={tabs} activeTab="recommendations" onChange={onChange} />);
  const recommendations = screen.getByRole("tab", { name: "Recommendations" });
  recommendations.focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Gallery" })).toHaveFocus();
});

it("expands and collapses long sanitized biographies", async () => {
  render(<PublicProfileBio html={longBio} />);
  await userEvent.click(screen.getByRole("button", { name: "Show more" }));
  expect(screen.getByRole("button", { name: "Show less" })).toBeVisible();
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm exec -- vitest run src/features/PublicHome/components/__tests__/PublicProfileBio.test.tsx src/features/PublicHome/components/__tests__/PublicProfileTabs.test.tsx`

- [ ] **Step 3: Implement bio and tabs as focused semantic components**

Keep sanitization at the render boundary: `PublicProfileBio` accepts `html: unknown` and calls `sanitizePublicRichText` internally, or reuses an enhanced `SafePublicRichText` with a forwarded ref. Add a direct malicious-HTML regression. Use a real button for expansion, stable tab/panel IDs, roving `tabIndex`, Left/Right/Home/End keys, and `aria-controls`/`aria-labelledby`. Keep the rail non-sticky in normal document flow.

Use a three-line maximum block size, not `line-clamp` across arbitrary rich block children. Use `ResizeObserver` plus font-readiness/content-change measurement to show the control only when the collapsed content exceeds three lines. Preserve expanded state during resize unless content no longer overflows. If a link below the collapsed boundary receives focus, expand before focus is painted. Mock measurements explicitly in Vitest and cover paragraphs, headings, lists, and links.

Disconnect `ResizeObserver`, cancel font-readiness work after unmount, and prevent resize feedback loops. Add a real-browser assertion for hidden-link focus expansion.

- [ ] **Step 4: Recompose `PublicProfile.tsx`**

Place the hero, bio container, tab rail, and active panel as siblings. The content container owns `px-4 sm:px-6`; no active panel remains inside the hero overflow boundary.

- [ ] **Step 5: Add 320px overflow and RTL tests**

Assert three tabs retain 44px targets, Business can scroll into view, and arrow behavior follows the document direction without reversing DOM semantics twice.

Assert automatic activation changes the selected panel after ArrowLeft/Right, plus Home/End, wraparound, RTL, scroll-into-view, invalid saved-tab fallback, and active-tab removal after account data changes.

Add English `publicProfile.bio.showMore` and `publicProfile.bio.showLess` keys now. Task 4 performs the single repository-wide locale synchronization and placeholder-parity check.

Replace the existing `Math.random()` fallback Feed ID with a deterministic media key derived from stable media fields plus source index so extraction/rerendering cannot remount Gallery items or destabilize screenshots.

Recommendations and Gallery are always present, even when their content is empty; Business remains conditional. Remove the current `hasRecommendations` render gate. Invalid/unavailable saved tabs fall back to Recommendations, then Gallery. Tabs use automatic activation and focused tabs scroll fully into view in an overflowing 320px rail.

- [ ] **Step 6: Run focused and affected tests**

Run: `npm exec -- vitest run src/features/PublicHome/components/__tests__/PublicProfileBio.test.tsx src/features/PublicHome/components/__tests__/PublicProfileTabs.test.tsx src/features/PublicHome/components/__tests__/PublicProfile.presentation.test.tsx`

- [ ] **Step 7: Commit Task 2**

```bash
git add explorers-earth/src/features/PublicHome/components/PublicProfileBio.tsx explorers-earth/src/features/PublicHome/components/PublicProfileTabs.tsx explorers-earth/src/features/PublicHome/components/__tests__/PublicProfileBio.test.tsx explorers-earth/src/features/PublicHome/components/__tests__/PublicProfileTabs.test.tsx explorers-earth/src/features/PublicHome/components/PublicProfile.tsx explorers-earth/src/i18n/resources/en.json explorers-earth/src/index.css
git commit -m "feat(public-profile): stabilize bio and profile tabs"
```

### Task 3: Stabilize Header and Footer Branding

**Files:**
- Modify: `explorers-earth/src/features/PublicHome/components/PublicProfileFooter.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/__tests__/PublicProfileFooter.test.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicProfileHeader.tsx`

**Interfaces:**
- Consumes: existing `LogoIcon` and `LogoFull`.
- Produces: cardless theme-aware brand rendering with explicit `enabled | minimal | disabled` semantics; removes the unused footer username prop.

- [ ] **Step 1: Write RED branding tests**

```tsx
it("renders a full cardless brand mark", () => {
  render(<PublicProfileFooter brandingStyle="enabled" />);
  expect(screen.getByRole("img", { name: "explorers.earth" })).toBeVisible();
  expect(screen.queryByTestId("footer-brand-badge")).not.toBeInTheDocument();
});
```

Also assert header brand link contains the accessible icon logo, footer links contain no hard-coded `text-white`, and `enabled` renders logo+links, `minimal` renders logo only, while `disabled` renders no content or whitespace.

- [ ] **Step 2: Run the branding tests and confirm RED**

Run: `npm exec -- vitest run src/features/PublicHome/components/__tests__/PublicProfileFooter.test.tsx src/features/PublicHome/components/__tests__/PublicProfileHeader.test.tsx`

- [ ] **Step 3: Apply responsive logo dimensions without changing SVG internals**

Use the existing accessible `LogoIcon`/`LogoFull` wrappers. Do not change the embedded paths or brand globe colours merely to support tests.

- [ ] **Step 4: Replace the footer badge**

Render `LogoFull` at 28px/32px inside a 44px-minimum home link, remove the badge background/border/shadow, and use `--text-primary` lettering rather than the user accent. Put legal/profile links inside `<nav aria-label="Footer">`, mark separators `aria-hidden`, and map link hover/focus colours to theme variables.

- [ ] **Step 5: Run branding and accessibility tests**

Run: `npm exec -- vitest run src/features/PublicHome/components/__tests__/PublicProfileFooter.test.tsx src/features/PublicHome/components/__tests__/PublicProfileHeader.test.tsx`

- [ ] **Step 6: Commit Task 3**

```bash
git add explorers-earth/src/features/PublicHome/components/PublicProfileFooter.tsx explorers-earth/src/features/PublicHome/components/__tests__/PublicProfileFooter.test.tsx explorers-earth/src/features/PublicHome/components/PublicProfileHeader.tsx
git commit -m "fix(public-profile): stabilize public branding"
```

### Task 4: Add Typed Public-Route Readiness Without Breaking Nested Routes

**Files:**
- Create: `explorers-earth/src/features/PublicHome/components/PublicProfileSkeleton.tsx`
- Create: `explorers-earth/src/features/PublicHome/components/PublicProfileFeedback.tsx`
- Create: `explorers-earth/src/features/PublicHome/components/__tests__/PublicProfileSkeleton.test.tsx`
- Create: `explorers-earth/src/features/PublicHome/components/__tests__/PublicProfileFeedback.test.tsx`
- Create: `explorers-earth/src/layouts/PublicRouteReadinessContext.tsx`
- Create: `explorers-earth/src/layouts/__tests__/PublicRouteReadinessContext.test.tsx`
- Create: `explorers-earth/src/routes/__tests__/PublicRoutes.test.tsx`
- Modify: `explorers-earth/src/routes/PublicRoutes.tsx`
- Modify: `explorers-earth/src/layouts/PublicLayout.tsx`
- Modify: `explorers-earth/src/routes/validators/UsernameValidator.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicProfile.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/__tests__/PublicProfile.presentation.test.tsx`
- Modify: `explorers-earth/src/i18n/resources/*.json`

**Interfaces:**

```ts
export type PublicRouteReadiness =
  | { status: "validating-username" }
  | { status: "loading-route" }
  | { status: "ready" }
  | { status: "not-found" }
  | { status: "route-error"; source: "username" | "profile"; retrying: boolean; retry: () => Promise<void> };

export interface PublicRouteReadinessContextValue {
  generation: string;
  readiness: PublicRouteReadiness;
  markLoading: (generation: string) => void;
  markReady: (generation: string) => void;
  markNotFound: (generation: string) => void;
  markError: (generation: string, source: "username" | "profile", retry: () => Promise<unknown>) => void;
  setIsPageLoaded: (loaded: boolean) => void;
}

export type PublicProfileFeedbackProps =
  | { kind: "empty"; title: string; description: string }
  | { kind: "partial-error"; title: string; retrying: boolean; onRetry: () => void }
  | { kind: "all-error"; title: string; description: string; retrying: boolean; onRetry: () => void };
```

- [ ] **Step 1: Write a RED orchestration test for exactly one initial shell**

```tsx
it("shows one public-route shell from validation through profile readiness", async () => {
  renderPublicRoute({ usernameDeferred, profileDeferred });
  expect(screen.getAllByTestId("public-profile-shell")).toHaveLength(1);
  usernameDeferred.resolve(validUsernamePayload);
  expect(screen.getAllByTestId("public-profile-shell")).toHaveLength(1);
  profileDeferred.resolve(profilePayload);
  await waitForElementToBeRemoved(() => screen.queryByTestId("public-profile-shell"));
});
```

- [ ] **Step 2: Run the orchestration test and confirm RED**

Run: `npm exec -- vitest run src/features/PublicHome/components/__tests__/PublicProfile.presentation.test.tsx src/routes/__tests__/PublicRoutes.test.tsx`

- [ ] **Step 3: Introduce the route-readiness state machine and preserve legacy consumers**

Use this exact route tree and convert `UsernameValidator` from a `children` component to an `<Outlet />` boundary:

```tsx
<Route path=":username/*" element={<PublicLayout />}>
  <Route element={<UsernameValidator />}>
    {/* existing public route leaves */}
  </Route>
</Route>
```

`PublicLayout` owns a typed React context provider; do not depend on nested Outlet context. Key each state transition to `{ username, location.key }`. Reset to `validating-username` for every new generation and ignore late ready/error/retry completions from prior generations. Model `validating-username → loading-route → ready`, plus `not-found` and retryable `route-error`. Retry is single-flight, catches rejection, retains the error UI, and ignores completion after navigation.

Retain a generation-capturing `setIsPageLoaded` adapter for existing nested-route consumers. Inventory every `PublicRoutes` leaf before resetting on navigation, and add explicit ready-on-mount adapters for MapView, PlaceMapView, Community, or any other leaf that does not signal readiness. Remove `window.__publicProfileLoaded` only from `PublicProfile`; do not claim global removal until every consumer migrates.

- [ ] **Step 4: Implement the neutral geometry-matched shell**

Match hero/avatar/bio/tab/panel positions, use only semantic tokens, and expose one `data-testid="public-profile-shell"`. Honour reduced motion.

- [ ] **Step 5: Separate not-found from username/profile query failures**

Destructure `error` and `refetch` from username and profile queries. Empty account data renders Not Found; username failures render localized `Couldn’t verify this profile`; profile failures render localized `Couldn’t load this profile`. Both error states retain the shell and provide Retry. A completed failed query never marks the route ready.

- [ ] **Step 6: Test the shared route blast radius**

Cover `/:username`, every direct public-route leaf (including map, community, guide detail, list detail, genre, subject, and sector), invalid username, username/profile network and GraphQL errors, retry success/failure/double click, username switching, same-username nested navigation/back, and stale ready/error/retry completion from the prior generation.

Add all English route/feedback copy under `publicProfile.*`, then run `npm run i18n:sync` once to propagate Task 2 and Task 4 keys across all shipped resources; finish with `npm run i18n:check` and placeholder-parity tests.

- [ ] **Step 7: Run route and presentation suites**

Run: `npm exec -- vitest run src/features/PublicHome/components/__tests__/PublicProfileSkeleton.test.tsx src/features/PublicHome/components/__tests__/PublicProfileFeedback.test.tsx src/features/PublicHome/components/__tests__/PublicProfile.presentation.test.tsx src/routes`

- [ ] **Step 8: Commit Task 4**

```bash
git add explorers-earth/src/features/PublicHome/components/PublicProfileSkeleton.tsx explorers-earth/src/features/PublicHome/components/PublicProfileFeedback.tsx explorers-earth/src/features/PublicHome/components/__tests__/PublicProfileSkeleton.test.tsx explorers-earth/src/features/PublicHome/components/__tests__/PublicProfileFeedback.test.tsx explorers-earth/src/layouts/PublicRouteReadinessContext.tsx explorers-earth/src/layouts/__tests__/PublicRouteReadinessContext.test.tsx explorers-earth/src/routes/PublicRoutes.tsx explorers-earth/src/routes/__tests__/PublicRoutes.test.tsx explorers-earth/src/layouts/PublicLayout.tsx explorers-earth/src/routes/validators/UsernameValidator.tsx explorers-earth/src/features/PublicHome/components/PublicProfile.tsx explorers-earth/src/features/PublicHome/components/__tests__/PublicProfile.presentation.test.tsx explorers-earth/src/i18n/resources
git commit -m "fix(public-profile): consolidate initial loading shell"
```

### Task 5: Align Recommendation Content and Progressive States

**Files:**
- Modify: `explorers-earth/src/features/PublicHome/components/ProfileRecommendationsTab.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/ProfileRecommendationsLayouts.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/__tests__/ProfileRecommendationsTab.test.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/__tests__/ProfileRecommendationsLayouts.test.tsx`
- Modify: `explorers-earth/src/index.css`

**Interfaces:**
- Consumes: `PublicProfileFeedback`, existing `RecommendationCategoryQueryState` and layout view models.
- Produces: failed-category diagnostic metadata in development/test only; saved layout behavior unchanged.

- [ ] **Step 1: Write RED tests for content-first partial failure and neutral loading**

```tsx
it("renders successful categories before the compact partial-error notice", () => {
  renderRecommendations({ places: readyPlaces, books: failedBooks });
  const places = screen.getByRole("heading", { name: "Places" });
  const notice = screen.getByRole("status", { name: "Some categories are unavailable" });
  expect(places.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
```

Assert skeleton surfaces contain no category-colour background, retry invokes only failed refetch functions, and all-error/true-empty copy differs.

- [ ] **Step 2: Run focused recommendation tests and confirm RED**

Run: `npm exec -- vitest run src/features/PublicHome/components/__tests__/ProfileRecommendationsTab.test.tsx src/features/PublicHome/components/__tests__/ProfileRecommendationsLayouts.test.tsx`

- [ ] **Step 3: Replace card-heavy notices with shared state vocabulary**

Move partial notice after ready slots, retain successful content during retry, and keep all-error centred/actionable. Add a development-only failed operation/category log without account data.

- [ ] **Step 4: Align headings, shelves, and states to the shared gutter**

The active panel container supplies the gutter once. Remove nested full-width padding conflicts; preserve intentional horizontal shelf overflow and next-card peek.

- [ ] **Step 5: Run recommendation and public-profile suites**

Run: `npm exec -- vitest run src/features/PublicHome/components/__tests__/ProfileRecommendationsTab.test.tsx src/features/PublicHome/components/__tests__/ProfileRecommendationsLayouts.test.tsx src/features/PublicHome/components/__tests__/PublicProfile.presentation.test.tsx`

- [ ] **Step 6: Commit Task 5**

```bash
git add explorers-earth/src/features/PublicHome/components/ProfileRecommendationsTab.tsx explorers-earth/src/features/PublicHome/components/ProfileRecommendationsLayouts.tsx explorers-earth/src/features/PublicHome/components/__tests__/ProfileRecommendationsTab.test.tsx explorers-earth/src/features/PublicHome/components/__tests__/ProfileRecommendationsLayouts.test.tsx explorers-earth/src/index.css
git commit -m "fix(public-profile): align progressive recommendation states"
```

### Task 6: Expand the Theme/Wallpaper Visual Matrix

**Files:**
- Modify: `explorers-earth/e2e/profile-presentation-visual.spec.ts`
- Create: `explorers-earth/e2e/support/publicProfileFixture.ts`
- Create: `explorers-earth/e2e/public-profile-adaptive-surface.spec.ts`

**Interfaces:**
- Consumes: extracted shared strict GraphQL fixture/router, all six preset IDs, three recommendation layouts.
- Produces: screenshot/geometry helpers for all four wallpaper modes and state scenarios.

- [ ] **Step 1: Add RED geometry assertions for the reproduced regressions**

```ts
const heroBox = await page.getByTestId("public-profile-hero").boundingBox();
const tabsBox = await page.getByRole("tablist", { name: "Profile sections" }).boundingBox();
expect(heroBox).not.toBeNull();
expect(tabsBox).not.toBeNull();
expect(tabsBox!.y).toBeGreaterThanOrEqual(heroBox!.y + heroBox!.height);
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
```

At 375px, assert bio, tab rail, notice, category heading, first shelf card, empty state, and footer links begin at the shared 16px gutter within ±1px. At 768px+, assert the shared 24px gutter. Shelves may overflow at the end edge for a next-card preview, but their first card may not begin outside the gutter. Also assert no `[data-testid="profile-metadata-card"]`, no accent-coloured four-pixel avatar border, accessible icon header/full footer logo, and no footer badge.

- [ ] **Step 2: Run the isolated Chromium test and confirm RED**

Run: `npm exec -- playwright test e2e/public-profile-adaptive-surface.spec.ts --project=chromium --workers=1`

- [ ] **Step 3: Extract and expand the deterministic fixture**

Move the existing router, payload builders, and media handlers into `e2e/support/publicProfileFixture.ts`; do not duplicate the large router. Replace the current unknown-operation `{ data: {} }` fallback with an allowlisted operation registry that fails every unknown GraphQL or same-origin request. Snapshot scenario state at request start so delayed responses never read later mutable fixture state.

Emit independent named tests per preset/wallpaper case. Run all six presets × four wallpaper modes at 375 and 1024 against one worst-case adversarial composite. Run bright, dark, high-frequency, and split-luminance media only for representative polarity/mode extremes. Keep all three recommendation layouts covered through a deterministic pairwise mapping, then run dedicated geometry tests at 320/375/768/1024/1440.

- [ ] **Step 4: Replace the percentile sampler with core-pixel contrast checks**

Capture each viewport four times: normal, background-only, foreground forced black, and foreground forced white. Derive foreground alpha from the black/white pair, select pixels with alpha ≥ 0.8, recover rendered foreground colour, and compare it with the corresponding background pixel. Capture the viewport once per pass and evaluate every target rectangle; do not take four screenshots per target. Assert the minimum core-pixel ratio, never a best-pixel percentile. Require 4.5:1 for text and 3:1 for meaningful icons.

Run all 24 preset × wallpaper combinations at 375 and 1024 against bright, dark, high-frequency, and split-luminance adversarial media. Check name, location, social controls, bio, tabs, retry controls, footer links, footer wordmark lettering, and the discernible header-icon silhouette. Do not recolour brand-art pixels merely to satisfy the sampler.

- [ ] **Step 5: Add state and resilience cases**

Cover loading, public empty copy without an owner CTA, partial error, all error/retry, long/missing bio, broken avatar/banner/card media, 30% expanded labels, RTL, reduced motion, 200% zoom, touch targets, and focus traversal. Verify fixed-header top/scrolled states and automatic tab fallback/activation.

At 320×568, 375×667, and 375×812, verify `enabled`, `minimal`, and `disabled` footer settings and require the final footer link to remain at least 16px above the fixed mobile navigation plus `env(safe-area-inset-bottom)`.

- [ ] **Step 6: Add a strict loader transition journey**

Delay username/profile/category responses independently. Assert one initial shell, stable geometry after readiness, category-level progressive placeholders only, and successful content retained beside partial errors.

- [ ] **Step 7: Run focused Chromium verification**

Run: `npm exec -- playwright test e2e/public-profile-adaptive-surface.spec.ts e2e/profile-presentation-visual.spec.ts --project=chromium --workers=1`

Expected: all deterministic fixture tests pass; any live-write production test remains explicitly skipped without credentials.

- [ ] **Step 8: Produce the reviewable 24-combination contact sheet**

Save 24 named 375px screenshots and compose a labelled contact sheet; desktop remains assertion-only to control CI time. Update `.github/workflows/ci.yml` to upload the contact-sheet directory with `if: always()`, and record its artifact URL in the QA report. If CI artifact upload is unavailable, store the compressed sheet under `docs/superpowers/reports/assets/`, never production assets or ephemeral-only `test-results/`.

- [ ] **Step 9: Commit Task 6**

```bash
git add explorers-earth/e2e/support/publicProfileFixture.ts explorers-earth/e2e/profile-presentation-visual.spec.ts explorers-earth/e2e/public-profile-adaptive-surface.spec.ts .github/workflows/ci.yml
git commit -m "test(public-profile): cover adaptive theme surfaces"
```

### Task 7: Full Verification, Chrome Audit, and Branch Handoff

**Files:**
- Modify only if verification exposes an in-scope regression: files listed in Tasks 1–6 and their focused tests.
- Create: `docs/superpowers/reports/2026-08-21-public-profile-adaptive-theme-surface-qa.md`

**Interfaces:**
- Consumes: completed implementation and deterministic fixtures.
- Produces: reproducible QA report, clean isolated branch, pushed remote commit(s).

- [ ] **Step 1: Run all unit, type, locale, lint, and build gates**

Run from `explorers-earth`:

```bash
npm exec -- vitest run
npm exec -- tsc -b tsconfig.json
npm run i18n:check
npm run build
npm exec -- eslint src/features/PublicHome src/layouts/PublicLayout.tsx src/routes/validators/UsernameValidator.tsx e2e/public-profile-adaptive-surface.spec.ts e2e/profile-presentation-visual.spec.ts
```

Expected: zero failures and zero new lint errors.

- [ ] **Step 2: Run the complete deterministic Chromium suite**

Run:

```bash
npm exec -- playwright test e2e/public-profile-adaptive-surface.spec.ts e2e/profile-presentation-visual.spec.ts e2e/profile-editor-polish.spec.ts --project=chromium --workers=1
```

Expected: deterministic tests pass; credential-gated live-write tests are the only allowed skips.

- [ ] **Step 3: Audit the real local account in Chrome**

Open `/:username` at 320, 375, 768, and 1024. Check solid/banner/ambient/full modes through deterministic local fixtures, then verify the logged-in account’s selected combination without modifying production. Record screenshots for hero, tabs, content gutter, footer, loading transition, empty, partial, and all-error cases.

- [ ] **Step 4: Verify console and request behavior**

Record category operation failures separately from analytics. Confirm no new React warnings, unsafe URL/sanitizer regressions, duplicate loader mounts, unhandled promise rejections, or unknown same-origin requests.

- [ ] **Step 5: Write the QA report**

Include exact commands, pass/fail/skip counts, screenshot paths, tested preset/wallpaper matrix, known pre-existing warnings, and whether the local API environment caused any unavailable category.

- [ ] **Step 6: Review the complete branch diff**

Run:

```bash
git diff --check origin/main...HEAD
git status --short
git diff --stat origin/main...HEAD
git diff --quiet origin/main...HEAD -- tunes/
```

Expected: no whitespace errors; only scoped public-profile/docs/test/workflow files; the Tunes isolation command exits 0.

- [ ] **Step 7: Commit the QA report and any reviewed final fixes**

```bash
git add docs/superpowers/reports/2026-08-21-public-profile-adaptive-theme-surface-qa.md
git commit -m "docs(public-profile): record adaptive surface verification"
```

- [ ] **Step 8: Push the dedicated branch**

Run: `git push origin codex/profile-dashboard-public-profile`

Expected: remote branch advances successfully and local worktree is clean.

## Plan Self-Review

- Spec coverage: every hero mode, branding rule, gutter, bio/tab behavior, state, loader owner, accessibility requirement, and matrix dimension maps to Tasks 1–7.
- Type consistency: `PublicProfileHeroMode`, `PublicProfileSurface`, `PublicProfileHeaderProps`, `PublicProfileBioProps`, `PublicProfileTabsProps`, and `PublicProfileFeedbackProps` are defined before their consumers.
- Isolation: no task modifies Tunes sync, dashboard theme persistence, backend schema, or recommendation taxonomy.
- Verification: focused RED/GREEN tests precede implementation; the final gate includes full unit/build and real Chromium evidence.

## What Already Exists

- Six preset definitions and CSS token generation in `themePresets.ts`.
- Four saved wallpaper modes and current account media fields.
- Safe rich-text and public URL/email normalization boundaries.
- Semantic public tabs and three recommendation layout renderers.
- Progressive category queries with per-category retry functions.
- Existing deterministic GraphQL/media Playwright fixture and Sharp screenshot utilities.
- Existing `LogoIcon` and `LogoFull` brand assets.
- Existing public-route readiness calls that will be preserved through a typed adapter.

## Architecture Diagram

```text
ThemeSettings + normalized account media
                 |
                 v
       resolvePublicProfileSurface
                 |
                 v
PublicProfileHeader -- media/share state
        |-- PublicProfileBio -- sanitizer/measurement
        |-- PublicProfileTabs -- active/focus state
        |-- Active panel
        |      `-- ProfileRecommendationsTab
        |             |-- nine category queries
        |             `-- PublicProfileFeedback
        `-- PublicProfileFooter

PublicRoutes
    `-- PublicLayout + generation-keyed readiness provider
          `-- UsernameValidator Outlet boundary
                `-- TabVisibilityGuard
                      `-- every public route leaf
```

## Test Diagram

```text
Route validation/readiness
  |-- valid / empty / network / GraphQL / retry [unit + Chromium]
  |-- retry rejection/double-click [unit]
  |-- username and route generation races [unit + Chromium]
  `-- every direct nested route leaf [route integration]

Adaptive surface
  |-- four modes + URL precedence [unit]
  |-- media URL safety + stale/fallback failures [unit + Chromium]
  |-- hero/nav geometry + long identity [Chromium]
  |-- bio sanitizer/overflow/font/unmount/focus [unit + Chromium]
  |-- tabs activation/fallback/RTL/overflow [unit + Chromium]
  `-- footer settings/safe area [unit + Chromium]

Recommendations
  |-- progressive exact-position loading [unit]
  |-- empty / partial / all-error / retry [unit + Chromium]
  `-- successful content retained on failure [unit + Chromium]

Visual matrix
  |-- 24 combinations at 375/1024, named tests [Chromium]
  |-- four-capture core-pixel contrast [Chromium + Sharp]
  |-- 320/375/768/1024/1440 geometry [Chromium]
  `-- 24-image mobile contact sheet [CI artifact]
```

## Failure Modes Registry

| Failure | Required behavior | Planned proof |
|---|---|---|
| Old route reports ready after navigation | Ignore stale generation | Context unit + delayed E2E |
| Direct nested route never reports ready | Explicit ready-on-mount adapter | Route-leaf integration matrix |
| Username/profile request fails | Retryable route error, never 404 | Unit + E2E retry |
| Retry rejects or is double-clicked | Retain error; one in-flight retry | Context unit |
| Old image error fires after URL change | Ignore stale media generation | Header unit |
| Primary and fallback media fail | Stable preset surface/placeholder | Header unit + E2E |
| Bio measurement completes after unmount | Disconnect/cancel without state update | Bio unit |
| Hidden rich link receives focus | Expand before focus is painted | Chromium keyboard test |
| Arrow key moves focus but not panel | Automatic activation stays synchronized | Tab unit |
| Unknown GraphQL/request escapes fixture | Hard fail strict allowlist | Fixture contract test |
| Busy image defeats contrast | Normative overlay + minimum core-pixel ratio | Adversarial Chromium test |
| Footer falls behind mobile navigation | Safe-area clearance at short heights | Geometry E2E |
| Visual matrix exceeds CI budget | Shared viewport captures and representative media extremes | Timed named tests |

## NOT in Scope

- Dashboard preview adoption of `resolvePublicProfileSurface`.
- Image focal-point persistence controls.
- Luminance-adaptive JavaScript overlays.
- New themes, wallpaper modes, recommendation categories, or persistence fields.
- Tunes account/user synchronization.
- Google Places migration or analytics authentication repair.

## Cross-Phase Themes

- One stable hierarchy matters more than producing attractive isolated screenshots.
- Shared route/loading state needs generation ownership; global booleans are unsafe.
- Contrast must be achieved by continuous composition and verified from rendered pixels, not by adding cards.
- The test fixture must fail closed and produce reviewable artifacts without exceeding CI time.

## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|---|---|---|---|---|---|
| 1 | Product | Use bounded extraction plus typed route readiness | Auto-decided | Explicit over clever | Preserves all public routes while removing duplicate profile loaders | In-place monolith patch; dashboard-wide engine |
| 2 | Product | Treat 280/320/360 as minimums | Mechanical | Completeness | Long identity and zoom must grow safely | Fixed maximum hero |
| 3 | Product | Add pure surface resolver now | Auto-decided | DRY | Makes four-mode behavior and fallbacks deterministic | Repeating mode logic in JSX |
| 4 | Design | Make approved matrix authoritative | Mechanical | Explicit over clever | Prevents older mock from restoring removed card/ring | Ambiguous dual references |
| 5 | Design | Keep continuous overlays instead of local contrast cards | Auto-decided | Completeness | Preserves readability and the requested cardless hierarchy | Metadata/bio/footer cards |
| 6 | Design | Keep current fixed top navigation with scroll-state treatment | Taste resolved from current behavior | Pragmatic | Preserves navigation behavior while matching the mock at scroll top | Removing fixed navigation |
| 7 | Design | Always render Recommendations and Gallery | Mechanical | Completeness | Makes empty states reachable and taxonomy stable | `hasRecommendations` tab gate |
| 8 | Engineering | Use generation-keyed typed React context | Auto-decided | Explicit over clever | Prevents stale route signals and Outlet-context shadowing | Global window flag; unkeyed callbacks |
| 9 | Engineering | Sanitize bio inside its render boundary | Mechanical | Security | Callers cannot bypass public rich-text policy | Trusted sanitized string prop |
| 10 | Engineering | Use four viewport captures for alpha-aware contrast | Auto-decided | Completeness | Measures minimum core-pixel contrast correctly | Fourth-highest pixel heuristic |
| 11 | Engineering | Run full combination coverage with representative adversarial media | Auto-decided | Pragmatic | Preserves coverage within CI budget | 192+ repeated navigations |
| 12 | DX | Skip developer-experience phase | Mechanical | Scope | This is consumer UI with no API/CLI/docs journey | Inventing unrelated developer scope |

## GSTACK REVIEW REPORT

| Run | Status | Findings absorbed |
|---|---|---:|
| CEO / product scope | DONE_WITH_CONCERNS → resolved | 12 |
| Design | DONE_WITH_CONCERNS → resolved | 14 |
| Engineering and tests | DONE_WITH_CONCERNS → resolved | 15 |
| Developer experience | Skipped: no developer-facing product scope | 0 |

**VERDICT:** APPROVAL_READY. The plan has no known P1 implementation ambiguity after three sequential reviews. Production code remains untouched pending user approval.

NO UNRESOLVED DECISIONS
