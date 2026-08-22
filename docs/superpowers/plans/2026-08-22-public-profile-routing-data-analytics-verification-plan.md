# Public Profile Routing, Data, Analytics, and Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining public-profile reliability work so every supported route loads published data for guests, unavailable child URLs return to the username root, analytics behaves deliberately, and dashboard-to-public behavior is proven through deterministic and real-account UI tests.

**Architecture:** Preserve the generation-safe readiness state machine already implemented on this branch. Make React Router the sole authority for valid URL shapes, use one reusable profile-root redirect for unsupported or unavailable children, share one Apollo authentication transport between page data and analytics, and verify each boundary independently before running the full settings and browser matrix.

**Tech Stack:** React 18, TypeScript, React Router 7, Apollo Client 3, Vitest, React Testing Library, Playwright/Chrome, Vite, external Strapi GraphQL.

**Spec:** `docs/superpowers/specs/2026-08-22-profile-readiness-route-reliability-design.md`

## Global Constraints

- Work only in `codex/profile-dashboard-public-profile` and its existing isolated worktree.
- Preserve the completed profile editor, Settings relocation, adaptive themes, gallery accordion, recommendation layouts/order, and readiness state machine unless a failing regression test proves a required correction.
- Do not edit Tunes, Local Tunes synchronization, or user-sync files.
- `/:username` is the canonical fallback for valid usernames with unsupported, hidden, deleted, or unpublished children.
- Unknown usernames remain Not Found. Successful empty category queries remain category-specific empty states. Network, authorization, rate-limit, and server failures remain scoped Retry states.
- Public enabled routes must work without viewer authentication. A stale or missing environment credential is a failed release gate, not an empty state.
- Redirects use history replacement, preserve `search` and `hash`, and cannot loop.
- Every behavior change begins with a failing test, receives focused verification, and lands as a reviewable commit.
- No production secrets, JWTs, passwords, or mutable account snapshots are committed.

---

### Task 1: Make the Router the Single Source of Child-URL Truth

**Files:**
- Create: `explorers-earth/src/routes/PublicProfileFallbackRedirect.tsx`
- Create: `explorers-earth/src/routes/__tests__/PublicProfileFallbackRedirect.test.tsx`
- Modify: `explorers-earth/src/routes/PublicRoutes.tsx`
- Modify: `explorers-earth/src/routes/validators/UsernameValidator.tsx`
- Modify: `explorers-earth/src/routes/validators/TabVisibilityGuard.tsx`
- Modify: `explorers-earth/src/routes/__tests__/PublicRoutes.test.tsx`
- Modify: `explorers-earth/src/routes/validators/__tests__/TabVisibilityGuard.test.tsx`

**Interfaces:**
- Produces: `PublicProfileFallbackRedirect(): JSX.Element`, which requires `username` from route params and replace-navigates to `/${username}` while retaining the current `search` and `hash`.
- Removes: child-route enumeration from `UsernameValidator`; it validates account existence only.
- Preserves: `PublicRouteNotFound` for unknown usernames/bootstrap not-found state.

- [ ] **Step 1: Write failing redirect-contract tests**

```tsx
it.each([
  "/alice/spaces",
  "/alice/not-a-category",
  "/alice/apps/list/extra-segment",
])("replace-redirects %s to the profile root", async (entry) => {
  const router = createMemoryRouter(routes, {
    initialEntries: [`${entry}?utm_source=qa#profile`],
  });
  render(<RouterProvider router={router} />);

  await waitFor(() => expect(router.state.location.pathname).toBe("/alice"));
  expect(router.state.location.search).toBe("?utm_source=qa");
  expect(router.state.location.hash).toBe("#profile");
  expect(router.state.historyAction).toBe("REPLACE");
});
```

- [ ] **Step 2: Run the focused route tests and confirm RED**

Run: `npm test -- --run src/routes/__tests__/PublicProfileFallbackRedirect.test.tsx src/routes/__tests__/PublicRoutes.test.tsx`

Expected: failures show the current nested wildcard rendering `Page Not Found` and `UsernameValidator` still owning a duplicate route list.

- [ ] **Step 3: Implement the minimal reusable redirect**

```tsx
import { Navigate, useLocation, useParams } from "react-router-dom";

export function PublicProfileFallbackRedirect() {
  const { username } = useParams<{ username: string }>();
  const location = useLocation();

  return (
    <Navigate
      replace
      to={{
        pathname: username ? `/${username}` : "/",
        search: location.search,
        hash: location.hash,
      }}
    />
  );
}
```

- [ ] **Step 4: Replace the nested wildcard and remove duplicate validation**

In `PublicRoutes.tsx`, render `<PublicProfileFallbackRedirect />` for the child `path="*"`. In `UsernameValidator.tsx`, remove `useLocation`, `validRoutes`, `validPlacesSubRoutes`, and all child-path checks. The validator must only report username loading, error, missing account, or success.

- [ ] **Step 5: Make hidden categories use the same fallback**

Replace `TabVisibilityGuard`'s “first available tab” search and premium unavailable card with `<PublicProfileFallbackRedirect />`. Retain `loading && !data`, background refresh retention, and query-error readiness behavior.

- [ ] **Step 6: Add loop, root, trailing-slash, query/hash, direct-entry, and back-button tests**

Assert that `/alice` never redirects to itself, `/alice/` renders the root, an invalid entry contributes no extra history entry, and Back returns to the page visited before the invalid URL.

- [ ] **Step 7: Run focused verification and commit**

Run: `npm test -- --run src/routes/__tests__/PublicProfileFallbackRedirect.test.tsx src/routes/__tests__/PublicRoutes.test.tsx src/routes/validators/__tests__/TabVisibilityGuard.test.tsx`

Run: `npx tsc -b`

Commit: `fix(public-profile): redirect unavailable children to profile root`

---

### Task 2: Distinguish Missing Published Resources From Empty and Failed Queries

**Files:**
- Create: `explorers-earth/src/routes/resolvePublicChildState.ts`
- Create: `explorers-earth/src/routes/__tests__/resolvePublicChildState.test.ts`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicGuideDetailPage.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicHome.tsx`
- Modify: `explorers-earth/src/features/Movies/components/public/PublicMovieList.tsx`
- Modify: `explorers-earth/src/features/Movies/components/public/PublicMovieGenre.tsx`
- Modify: `explorers-earth/src/features/Books/components/public/PublicBookList.tsx`
- Modify: `explorers-earth/src/features/Books/components/public/PublicBookSubject.tsx`
- Modify: `explorers-earth/src/features/Games/components/public/PublicGamesList.tsx`
- Modify: `explorers-earth/src/features/Games/components/public/PublicGamesGenre.tsx`
- Modify: `explorers-earth/src/features/AppsAndTools/components/public/PublicAppList.tsx`
- Modify: `explorers-earth/src/features/Products/components/public/PublicProductList.tsx`
- Modify: `explorers-earth/src/features/People/components/public/PublicPersonList.tsx`
- Modify: `explorers-earth/src/features/People/components/public/PublicPersonSector.tsx`
- Test: corresponding public component test files created beside each feature's public components

**Interfaces:**
- Produces: `resolvePublicChildState({ loading, error, parentResolved, childResolved, allowEmpty }): "loading" | "error" | "redirect" | "empty" | "ready"`.
- Consumes: `PublicProfileFallbackRedirect` from Task 1.
- Rule: errors always win over missing-resource redirects once loading finishes; collection roots may be empty, child resources may redirect.

- [ ] **Step 1: Write the pure-state RED matrix**

```ts
it.each([
  [{ loading: true, error: undefined, parentResolved: false, childResolved: false, allowEmpty: false }, "loading"],
  [{ loading: false, error: new Error("Forbidden"), parentResolved: true, childResolved: false, allowEmpty: false }, "error"],
  [{ loading: false, error: undefined, parentResolved: true, childResolved: false, allowEmpty: false }, "redirect"],
  [{ loading: false, error: undefined, parentResolved: true, childResolved: false, allowEmpty: true }, "empty"],
  [{ loading: false, error: undefined, parentResolved: true, childResolved: true, allowEmpty: false }, "ready"],
])("resolves %j as %s", (input, expected) => {
  expect(resolvePublicChildState(input)).toBe(expected);
});
```

- [ ] **Step 2: Run the state test and confirm RED**

Run: `npm test -- --run src/routes/__tests__/resolvePublicChildState.test.ts`

Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement the explicit resolver**

```ts
export function resolvePublicChildState(input: PublicChildStateInput): PublicChildState {
  if (input.loading) return "loading";
  if (input.error) return "error";
  if (!input.parentResolved) return "redirect";
  if (input.childResolved) return "ready";
  return input.allowEmpty ? "empty" : "redirect";
}
```

- [ ] **Step 4: Write component RED tests for every child family**

For each detail/filter component, mock these four outcomes and assert exactly one UI result: loading skeleton, scoped Retry error, profile-root redirect, or content. For category indexes, assert a successful zero-length response stays on its URL and renders the category-specific empty state.

- [ ] **Step 5: Migrate detail/list/slug components**

Use `resolvePublicChildState` before rendering existing not-found cards. Return `<PublicProfileFallbackRedirect />` only for `"redirect"`; pass actual failures to `usePublicRouteLifecycle`; preserve existing empty index/collection rendering.

- [ ] **Step 6: Verify stale navigation cannot redirect the current route**

Add a deferred-query test: begin `/alice/apps/deleted-list`, navigate to `/alice/products`, resolve the old Apps query with no resource, and assert the Products URL remains unchanged.

- [ ] **Step 7: Run focused tests and commit**

Run: `npm test -- --run src/routes/__tests__/resolvePublicChildState.test.ts src/routes/__tests__/PublicRoutes.test.tsx src/features/Movies/components/public src/features/Books/components/public src/features/Games/components/public src/features/AppsAndTools/components/public src/features/Products/components/public src/features/People/components/public`

Run: `npx tsc -b`

Commit: `fix(public-profile): separate unavailable resources from request failures`

---

### Task 3: Share One Tested Apollo Credential Policy

**Files:**
- Create: `explorers-earth/src/lib/apolloTransport.ts`
- Create: `explorers-earth/src/lib/__tests__/apolloTransport.test.ts`
- Modify: `explorers-earth/src/main.tsx`
- Modify: `explorers-earth/src/__tests__/main.auth.test.tsx`
- Modify: `explorers-earth/src/services/analyticsService.ts`
- Modify: `explorers-earth/src/services/__tests__/analyticsService.test.ts`
- Create: `explorers-earth/scripts/verify-public-api-access.mjs`
- Create: `explorers-earth/scripts/__tests__/verify-public-api-access.test.mjs`
- Modify: `explorers-earth/package.json`

**Interfaces:**
- Produces: `createApolloTransport({ uri, getSessionToken, publicAccessToken }): ApolloLink`.
- Credential precedence: authenticated JWT, otherwise configured public credential, otherwise anonymous.
- Authentication operations never receive the public credential.
- A single 401 retry without the public credential is allowed only when the failed request actually used that credential.

- [ ] **Step 1: Write RED tests for the complete credential matrix**

```ts
it.each([
  ["login", "session", "public", undefined],
  ["PublicAppData", "session", "public", "Bearer session"],
  ["PublicAppData", undefined, "public", "Bearer public"],
  ["PublicAppData", undefined, undefined, undefined],
])("selects authorization for %s", (operationName, session, publicToken, expected) => {
  expect(selectAuthorization({ operationName, sessionToken: session, publicAccessToken: publicToken })).toBe(expected);
});
```

Add tests proving a public-token 401 retries once anonymously, a session-token 401 does not downgrade, a GraphQL `Forbidden access` response is not misclassified as empty, and concurrent requests do not share retry flags.

- [ ] **Step 2: Run transport tests and confirm RED**

Run: `npm test -- --run src/lib/__tests__/apolloTransport.test.ts src/__tests__/main.auth.test.tsx src/services/__tests__/analyticsService.test.ts`

- [ ] **Step 3: Implement the transport and migrate both clients**

Move the current `setContext` and `onError` logic out of `main.tsx`. Use the resulting link in the application client and the dedicated analytics client. Do not import `main.tsx` from services.

- [ ] **Step 4: Remove client-side third-party IP discovery**

Delete `getUserIPAddress` and its four external browser requests. Omit `ipAddress` from the browser mutation payload; server/network infrastructure remains responsible for trustworthy IP/rate-limit data.

- [ ] **Step 5: Add a read-only environment preflight**

`verify-public-api-access.mjs` loads the configured GraphQL URL/token without printing the token, resolves a test username, and queries every enabled public collection operation. It prints operation name, HTTP status, GraphQL errors, and item count, then exits non-zero on 401, 403/`Forbidden access`, malformed data, or an unreachable endpoint.

Add package script:

```json
"verify:public-api": "node scripts/verify-public-api-access.mjs"
```

- [ ] **Step 6: Run focused verification**

Run: `npm test -- --run src/lib/__tests__/apolloTransport.test.ts src/__tests__/main.auth.test.tsx src/services/__tests__/analyticsService.test.ts`

Run: `npm run verify:public-api -- --username=tk2727`

Expected locally today: non-zero with an explicit invalid-public-credential message until the external Strapi credential/permissions are corrected. This result blocks the final release claim but does not permit weakening the tests.

- [ ] **Step 7: Commit**

Commit: `fix(api): unify public data and analytics credentials`

---

### Task 4: Complete Application Analytics Coverage

**Files:**
- Modify: `explorers-earth/src/services/analyticsService.ts`
- Modify: `explorers-earth/src/services/__tests__/analyticsService.test.ts`
- Modify: `explorers-earth/src/features/AppsAndTools/components/public/PublicApps.tsx`
- Modify: `explorers-earth/src/features/AppsAndTools/components/public/PublicAppList.tsx`
- Modify: `explorers-earth/src/features/Products/components/public/PublicProducts.tsx`
- Modify: `explorers-earth/src/features/Products/components/public/PublicProductList.tsx`
- Modify: `explorers-earth/src/features/People/components/public/PublicPeople.tsx`
- Modify: `explorers-earth/src/features/People/components/public/PublicPersonList.tsx`
- Modify: `explorers-earth/src/features/People/components/public/PublicPersonSector.tsx`
- Create: `explorers-earth/src/features/AppsAndTools/components/public/__tests__/PublicApps.analytics.test.tsx`
- Create: `explorers-earth/src/features/Products/components/public/__tests__/PublicProducts.analytics.test.tsx`
- Create: `explorers-earth/src/features/People/components/public/__tests__/PublicPeople.analytics.test.tsx`
- Modify: `explorers-earth/src/hooks/__tests__/usePageTracking.test.ts`

**Interfaces:**
- Produces: `createAnalyticsOptions.apps`, `.products`, and `.people`, accepting account ID, username, and optional list/filter IDs.
- Event names: `app-card`, `product-card`, `person-card`, `share-button`, plus the existing page view event.
- Owner viewing their own profile remains intentionally suppressed; guest and non-owner events remain enabled and session-deduplicated.

- [ ] **Step 1: Write RED tests for new option factories and event behavior**

```ts
expect(createAnalyticsOptions.apps("acct-1", "alice", "list-1")).toMatchObject({
  accountId: "acct-1",
  locationId: "list-1",
  pageName: "public-apps",
  pageUsername: "alice",
  autoTrackView: true,
});
```

Assert one guest view, one non-owner view, zero owner-on-own-profile mutations, one mutation per unique card click, duplicate suppression within a session, and a new event after session reset.

- [ ] **Step 2: Run analytics tests and confirm RED**

Run: `npm test -- --run src/services/__tests__/analyticsService.test.ts src/features/AppsAndTools/components/public/__tests__/PublicApps.analytics.test.tsx src/features/Products/components/public/__tests__/PublicProducts.analytics.test.tsx src/features/People/components/public/__tests__/PublicPeople.analytics.test.tsx`

- [ ] **Step 3: Add explicit factories and instrumentation**

Follow the existing Movies/Books/Games pattern. Pass stable document IDs in metadata, invoke `trackClick` before opening the detail modal, and track Share from both index and list pages.

- [ ] **Step 4: Verify GA navigation separately**

Extend `usePageTracking.test.ts` to navigate `/alice` → `/alice/apps` → `/alice/products/list-a` and assert one `gtag("config", measurementId, { page_path })` call for each pathname transition. Query/hash-only changes do not create a second pathname event under the existing contract.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- --run src/services/__tests__/analyticsService.test.ts src/hooks/__tests__/usePageTracking.test.ts src/features/AppsAndTools/components/public/__tests__/PublicApps.analytics.test.tsx src/features/Products/components/public/__tests__/PublicProducts.analytics.test.tsx src/features/People/components/public/__tests__/PublicPeople.analytics.test.tsx`

Commit: `feat(analytics): cover apps products and people public routes`

---

### Task 5: Build the Deterministic Route, Data, and Settings Matrix

**Files:**
- Create: `explorers-earth/e2e/support/publicRouteManifest.ts`
- Modify: `explorers-earth/e2e/support/publicProfileFixture.ts`
- Create: `explorers-earth/e2e/public-profile-route-contract.spec.ts`
- Modify: `explorers-earth/e2e/public-profile-adaptive-surface.spec.ts`
- Modify: `explorers-earth/e2e/profile-theme.spec.ts`
- Modify: `explorers-earth/e2e/profile-presentation-visual.spec.ts`
- Modify: `explorers-earth/e2e/profile-editor-polish.spec.ts`
- Create: `explorers-earth/e2e/profile-settings-persistence.spec.ts`

**Interfaces:**
- Produces: a typed route manifest containing every root/index/detail/filter/map route, expected visibility field, expected page marker, and mock GraphQL operation.
- Produces: a settings manifest for six themes, four wallpaper modes, hero present/absent/broken, footer modes, recommendation layouts, category order, bio/social/gallery states, and responsive boundaries.

- [ ] **Step 1: Define a manifest whose coverage assertions fail when a route is absent**

```ts
export const publicRouteManifest = [
  { family: "profile", path: "/:username", operation: "PublicProfile", marker: "public-profile-shell" },
  { family: "places", path: "/:username/places", operation: "AccountsDetail", marker: "places-page" },
  { family: "apps", path: "/:username/apps", operation: "PublicAppData", marker: "apps-page" },
  { family: "apps-list", path: "/:username/apps/:listSlug", operation: "AppListBySlug", marker: "apps-list-page" },
] as const;
```

The complete implementation must enumerate all route families named in the specification; a test compares manifest families with the router contract and fails on omissions.

- [ ] **Step 2: Add route-state tests**

For every manifest route, test direct entry, internal navigation, hard refresh, successful content, successful empty root, missing child redirect, hidden category redirect, slow initial load, background refresh, failure with Retry, stale response, and clean console/network output.

- [ ] **Step 3: Add bounded exhaustive and pairwise settings coverage**

Run all 24 theme × wallpaper combinations at 375 and 1024 widths. Exercise every individual setting value. Generate pairwise cases for independent secondary settings and assert every value and pair appears. Include 320/768/1440 boundaries, short mobile height, 200% zoom, broken media, long rich-text bio, reduced motion, keyboard reorder, and touch drag.

- [ ] **Step 4: Verify save payload and public rendering**

Intercept the save mutation, assert the complete payload, return the saved state, hard reload the dashboard, then open the public route and assert the same theme, wallpaper, category order, layout, footer, bio/social/gallery behavior, and enabled tabs.

- [ ] **Step 5: Run deterministic UI suites and commit**

Run each modified Playwright file individually with `--workers=1`, then run them together. Preserve screenshot/contact-sheet artifacts for visual failures.

Commit: `test(public-profile): cover route data and settings matrix`

---

### Task 6: Prove the Real Guest and Authenticated Account Journeys

**Files:**
- Create: `explorers-earth/e2e/real-account/profile-public-contract.spec.ts`
- Create: `explorers-earth/e2e/real-account/README.md`
- Create: `explorers-earth/e2e/support/consoleNetworkAudit.ts`
- Modify: `explorers-earth/playwright.config.ts`

**Interfaces:**
- Consumes environment variable names for a controlled testing account; never records their values.
- Captures mutable dashboard settings before the test and restores them in `finally`.
- Records GraphQL operation/status/error summaries without Authorization headers or response-private fields.

- [ ] **Step 1: Document safe prerequisites and restoration**

Document the test account, required variable names, guest/owner/non-owner browser contexts, backup shape, restoration order, and explicit skip reasons. A missing credential produces a named skip, never a pass.

- [ ] **Step 2: Add the real dashboard-to-public save journey**

Through visible UI controls, change one value in every persisted group, save and wait for the mutation, reload the dashboard, verify controls, open the public root/category routes, and compare visible data with successful GraphQL response summaries.

- [ ] **Step 3: Add guest route and analytics verification**

Use a clean guest context to open every enabled category. Assert HTTP success, no GraphQL errors, expected content/empty state, one application view mutation per page/session contract, card/share click mutations, and GA pathname calls. Then repeat as owner and non-owner to prove owner suppression only affects the intended account.

- [ ] **Step 4: Add invalid/unavailable/error separation**

Verify unsupported paths, hidden categories, and deleted/unpublished slugs replace-navigate to `/:username`; unknown usernames show Not Found; API 401/403/429/500 simulations remain on the requested route and show Retry.

- [ ] **Step 5: Run mobile and desktop Chrome verification**

Run at 375 × 812 and 1440 × 900, including refresh, back/forward, touch/keyboard controls, screenshots, and console/network audit. Restore the account and verify the restoration publicly.

- [ ] **Step 6: Commit**

Commit: `test(public-profile): add real guest and account contract journey`

---

### Task 7: Final Review, Quality Gates, and Truthful Release Report

**Files:**
- Create: `docs/superpowers/reports/2026-08-22-public-profile-routing-data-analytics-qa.md`
- Modify only defects proven by final verification

- [ ] **Step 1: Run static and unit gates**

Run: `npm run lint -- --quiet`

Run: `npx tsc -b`

Run: `npm run i18n:check`

Run: `npm run test:unit -- --reporter=verbose`

Expected: zero errors and zero failing tests; record actual counts and duration.

- [ ] **Step 2: Run API and browser gates**

Run: `npm run verify:public-api -- --username=tk2727`

Run every affected Playwright file independently, then: `npm run test:e2e`

Run: `npm run build`

Expected: guest category reads and analytics writes succeed with no unexpected console/network failures. Any missing external credential remains a named blocker rather than being waived.

- [ ] **Step 3: Run the complete manual Chrome checklist**

Verify guest, owner, and non-owner sessions; every enabled route; invalid/unavailable redirects; empty/error/Retry; all theme/wallpaper combinations; responsive boundaries; save/reload/public persistence; GA and application analytics evidence.

- [ ] **Step 4: Review isolation and the final diff**

Run: `git diff --check`

Run: `git status --short`

Run: `git diff --stat origin/main...HEAD`

Run: `git diff --quiet origin/main...HEAD -- tunes/`

Expected: no whitespace errors, only intentional files, and no Tunes/user-sync changes.

- [ ] **Step 5: Request independent code review and rerun affected gates**

Use `superpowers:requesting-code-review`; resolve every accepted finding test-first. Use `superpowers:verification-before-completion` immediately before any completion claim.

- [ ] **Step 6: Write the truthful report, commit, and push**

The report records exact commands, versions, pass/fail/skip counts, API operation results, browser artifacts, environment limitations, and remaining risks. Never state “all combinations” or “100%” if any required real-account or external API check was skipped or failed.

Commit: `docs(public-profile): record routing data and analytics verification`

Push only `codex/profile-dashboard-public-profile` after the worktree is clean and all mandatory gates pass.

---

## Plan Self-Review

- [x] The approved invalid/unavailable/empty/error distinctions map to explicit tasks and tests.
- [x] React Router, username validation, visibility gating, detail-resource resolution, data credentials, and analytics have separate owners.
- [x] Every supported route family and nested pattern is required by a coverage manifest.
- [x] Guest, owner, and non-owner behavior is covered without committing credentials.
- [x] Real API data and analytics are release gates; fixture-only tests cannot satisfy them.
- [x] Exhaustive bounded matrices and pairwise secondary settings avoid an unbounded Cartesian product while proving every value and pair.
- [x] Existing readiness and profile design work is preserved.
- [x] No placeholders, Tunes changes, fixed loader delays, unbounded retries, or production-secret output are permitted.
