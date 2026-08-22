<!-- /autoplan restore point: C:\Users\TK\.gstack\projects\MeteoriteLabs-explorers.earth\codex-profile-dashboard-public-profile-autoplan-restore-20260822T110734Z.md -->
# Public Profile Routing, Data, Analytics, and Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining public-profile reliability work so every supported route loads published data for guests, unavailable child URLs return to the username root, analytics behaves deliberately, and dashboard-to-public behavior is proven through deterministic and real-account UI tests.

**Architecture:** Preserve the generation-safe readiness state machine already implemented on this branch. Make React Router the sole authority for valid URL shapes, use one reusable profile-root redirect for unsupported or unavailable children, share one Apollo authentication transport between page data and analytics, and verify each boundary independently before running the full settings and browser matrix.

**Tech Stack:** React 18, TypeScript, React Router 7, Apollo Client 3, Vitest, React Testing Library, Playwright/Chrome, Vite, external Strapi GraphQL.

**Spec:** `docs/superpowers/specs/2026-08-22-profile-readiness-route-reliability-design.md`

**Command convention:** All `npm`/`npx` commands in this plan run with the working directory set to `<repo>/explorers-earth`. All `git` commands run from `<repo>`. This distinction is part of reproducibility because the repository root is not a Node package.

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

### Task 0: Prove the Public API Capability Boundary Before UI Changes

**Files:**
- Create: `explorers-earth/scripts/public-api-capabilities.mjs`
- Create: `explorers-earth/scripts/verify-public-api-access.mjs`
- Create: `explorers-earth/scripts/__tests__/verify-public-api-access.test.mjs`
- Modify: `explorers-earth/package.json`
- Modify: `explorers-earth/.env.example`
- Modify: `docs/environment-variables.md`
- Modify: `.github/workflows/ci.yml` (or the repository's actual release workflow discovered during implementation)

**Interfaces:**
- Produces: a read-only capability manifest for account bootstrap and every public collection operation used by the route contract.
- Produces: a preflight that reports `transport-error`, `unauthorized`, `forbidden`, `malformed`, `empty`, or `ready` per operation without printing credentials or private response fields.
- Decision gate: continue with browser transport only if Strapi can expose published reads through a deliberately scoped public capability. If it cannot, stop the release claim and require a backend/BFF proxy; do not disguise the failure with anonymous fallbacks or empty UI.
- Security fact: every `VITE_*` credential is extractable by a browser user. The preflight and release report must record the configured capability scope, origin policy, and server-side rate-limit policy instead of treating the value as a secret.
- Release rule: one value shared between public-read and analytics-write is permitted only as a local compatibility input. CI/release fails until independently scoped capabilities are proven.
- Diagnostic rule: every failure begins with operation, classification, likely cause, and exact remediation. JSON includes a stable code and redacted observed status so humans and CI consume the same result.

- [ ] **Step 1: Write RED tests for classified capability results**

Cover account-bootstrap failure, 401, GraphQL `Forbidden access`, malformed payloads, successful empty collections, successful published collections, request timeout, bounded retry, stable machine-readable exit codes/JSON, environment loading, and redaction of Authorization values and private response fields from stdout/stderr.

Add negative capability probes against controlled non-production fixtures:

- Public-read cannot fetch a private/unpublished account, list, or item by direct ID, by slug, or by omitting a client visibility filter.
- Public-read cannot execute any mutation.
- Analytics-write cannot execute reads or non-analytics mutations.
- Analytics writes reject unknown fields, invalid account targets, and unsupported event shapes.
- The non-production rate limit is exercised and classified without using production traffic.

- [ ] **Step 2: Implement the operation manifest and preflight**

The preflight first resolves the username and enabled public tabs. Only after bootstrap succeeds does it probe the applicable operation catalog. A bootstrap failure reports one blocking root cause rather than misleading per-category failures. Use `AbortController`, a bounded timeout/retry policy, stable exit codes, and redacted JSON output suitable for CI artifacts.

- [ ] **Step 3: Add the reproducible command**

```json
"verify:public-api": "node scripts/verify-public-api-access.mjs"
```

Document the public-read and analytics-write environment variable names, their browser-extractable nature, controlled-fixture requirements, and example invocations in `.env.example` and `docs/environment-variables.md`. Never place usable values in examples.

Run: `node --test scripts/__tests__/verify-public-api-access.test.mjs`

Run: `npm run verify:public-api -- --username=tk2727`

Expected locally today: non-zero with an explicit invalid-public-credential result until the external Strapi credential/permissions are corrected.

- [ ] **Step 4: Record the architecture decision**

Proceed with the client transport tasks only if the public API can be restricted to published reads and the analytics mutation has an independently auditable least-privilege capability. If a controlled private fixture or server-side permission proof is unavailable, or a negative probe succeeds, mark the BFF/server proxy as a release prerequisite and stop before UI claims.

- [ ] **Step 5: Wire the preflight into CI/release**

Run the deterministic script tests on every change. Run the live capability preflight only in the protected non-production/release job with its required environment; a missing prerequisite fails that release job rather than becoming a green skip. Archive only redacted JSON.

- [ ] **Step 6: Commit**

Commit: `test(api): add public capability preflight`

---

### Task 0A: Make Verification Safe and Reproducible for Another Contributor

**Files:**
- Create: `explorers-earth/scripts/verify-public-profile-env.mjs`
- Create: `explorers-earth/scripts/lib/verificationResult.mjs`
- Create: `explorers-earth/scripts/__tests__/verify-public-profile-env.test.mjs`
- Create: `explorers-earth/scripts/__tests__/verificationResult.test.mjs`
- Modify: `explorers-earth/package.json`
- Modify: `explorers-earth/README.md`
- Modify: `docs/getting-started.md`
- Modify: `docs/environment-variables.md`
- Modify: `docs/testing.md`
- Modify: `docs/troubleshooting.md`

**Golden-path contract:**
- Runtime: Node `>=22.12`, `npm ci`, commands run from `explorers-earth`, and Chromium installed with `npx playwright install chromium` (`--with-deps` in Linux CI).
- Exact browser capability names: `VITE_PUBLIC_READ_ACCESS_TOKEN` and `VITE_ANALYTICS_WRITE_ACCESS_TOKEN`. `VITE_PUBLIC_ACCESS_TOKEN` is a deprecated local-only compatibility fallback and is rejected by protected release verification when it supplies both capabilities.
- Environment tiers: deterministic fixture, live read-only, and protected mutation. Each variable is documented in exactly one tier and reports presence/source/classification without revealing its value.
- Stable failure codes include at least `ENV_MISSING`, `ACCOUNT_MARKER_MISMATCH`, `PUBLIC_READ_UNAUTHORIZED`, `LIVE_WRITE_NOT_APPROVED`, `RESTORE_FAILED`, and `ANALYTICS_CLEANUP_FAILED`.

- [ ] **Step 1: Write RED tests for the environment doctor and result envelope**

Assert deterministic mode passes without live credentials; live read-only mode names missing public API inputs; protected mutation mode requires the explicit opt-in plus exact dedicated-account marker. Every failure returns a stable non-zero code and `{ code, summary, safeContext, remediation, artifactPath? }` JSON without values, tokens, storage state, or private payloads.

- [ ] **Step 2: Implement the safe environment doctor**

Add `npm run verify:public-profile:env`. Support `--mode=fixture|read-only|mutation` and `--json`. Human output leads with what failed, why, the exact corrective command/document, and the safe observed classification.

- [ ] **Step 3: Correct contributor prerequisites and testing documentation**

Replace Node 18/npm-install guidance with the repository engine and lockfile workflow. Document the app working directory, version checks, browser install, deterministic versus protected suite table, headed/debug modes, expected durations/artifact paths, error codes, clean console/network policy, and the rule that retained recovery artifacts block all further mutations.

- [ ] **Step 4: Add contract drift tests**

Fail if `.env.example`, environment docs, package scripts, or Playwright projects disagree on capability names, environment tier, or the deterministic/real-account separation.

- [ ] **Step 5: Commit**

Commit: `chore(qa): define public profile verification contract`

---

### Task 1: Make the Router the Single Source of Child-URL Truth

**Files:**
- Create: `explorers-earth/src/routes/publicRouteContract.ts`
- Create: `explorers-earth/src/routes/PublicProfileFallbackRedirect.tsx`
- Create: `explorers-earth/src/routes/__tests__/PublicProfileFallbackRedirect.test.tsx`
- Modify: `explorers-earth/src/routes/PublicRoutes.tsx`
- Modify: `explorers-earth/src/routes/validators/UsernameValidator.tsx`
- Modify: `explorers-earth/src/routes/__tests__/PublicRoutes.test.tsx`

**Interfaces:**
- Produces: one DOM-free typed `publicRouteContract` consumed by `PublicRoutes` and deterministic route tests; tests must not maintain a second path list. `PublicRoutes` keeps an exhaustive element map keyed by the contract's route IDs so metadata remains importable by Playwright without loading React/CSS.
- Produces: `PublicProfileFallbackRedirect(): JSX.Element`, which requires `username` from route params and replace-navigates to `/${username}` while retaining the current `search` and `hash`, plus a non-persisted navigation-state marker used only for post-redirect focus management.
- Removes: child-route enumeration from `UsernameValidator`; it validates account existence only.
- Preserves: `PublicRouteNotFound` for unknown usernames/bootstrap not-found state.

- [ ] **Step 1: Write failing redirect-contract tests**

```tsx
it.each([
  "/alice/unsupported-child",
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

- [ ] **Step 4: Build routes from one typed contract and remove duplicate validation**

Move each supported child path, route family, visibility field, page marker, `requiredOperations[]`, and `conditionalOperations[]` into `publicRouteContract.ts`. `PublicRoutes.tsx` renders from that ordered contract with an exhaustive `Record<PublicRouteId, ReactElement>` mapping and uses `<PublicProfileFallbackRedirect />` for the child `path="*"`. In `UsernameValidator.tsx`, remove `useLocation`, `validRoutes`, `validPlacesSubRoutes`, and all child-path checks. The validator must only report username loading, error, missing account, or success.

- [ ] **Step 5: Add loop, root, trailing-slash, query/hash, direct-entry, and back-button tests**

Assert that `/alice` never redirects to itself, `/alice/` renders the root, an invalid entry contributes no extra history entry, and Back returns to the page visited before the invalid URL.

- [ ] **Step 6: Run focused verification and commit**

Run: `npm test -- --run src/routes/__tests__/PublicProfileFallbackRedirect.test.tsx src/routes/__tests__/PublicRoutes.test.tsx`

Run: `npx tsc -b`

Commit: `fix(public-profile): redirect unavailable children to profile root`

---

### Task 2: Finish the Bootstrap and Leaf-Readiness Architecture

**Files:**
- Create: `explorers-earth/src/layouts/PublicProfileBootstrapContext.tsx`
- Create: `explorers-earth/src/layouts/__tests__/PublicProfileBootstrapContext.test.tsx`
- Modify: `explorers-earth/src/layouts/PublicRouteReadinessContext.tsx`
- Modify: `explorers-earth/src/layouts/publicRouteReadiness.ts`
- Modify: `explorers-earth/src/layouts/usePublicRouteLifecycle.ts`
- Modify: `explorers-earth/src/layouts/__tests__/PublicRouteReadinessContext.test.tsx`
- Modify: `explorers-earth/src/layouts/__tests__/publicRouteReadiness.test.ts`
- Modify: `explorers-earth/src/layouts/__tests__/usePublicRouteLifecycle.test.tsx`
- Modify: `explorers-earth/src/layouts/PublicLayout.tsx`
- Modify: `explorers-earth/src/layouts/__tests__/PublicLayout.test.tsx`
- Modify: `explorers-earth/src/routes/validators/UsernameValidator.tsx`
- Modify: `explorers-earth/src/routes/validators/TabVisibilityGuard.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicProfile.tsx`
- Modify: every route leaf named by `publicRouteContract`
- Verify and keep absent: legacy readiness helpers/signals such as `ReadyOnMount`, local `setIsPageLoaded` completion flags, and `window.__publicProfileLoaded`
- Modify: `explorers-earth/src/routes/__tests__/PublicRoutes.test.tsx`

**Interfaces:**
- Preserves: the generation-safe readiness reducer already introduced on this branch.
- Defines: bootstrap state owned by `PublicLayout`'s bootstrap context, and leaf state owned by the currently matched route generation.
- Keys: `bootstrapKey = normalized username`; `leafGeneration = username + location.key`. A same-username route change dispatches `begin-route` for the new generation, never `begin-bootstrap`. A username change starts a new bootstrap.
- Leaf states: `initial-loading | ready | refreshing | error`; a stale generation cannot change the current generation.
- Error state records `hasUsableContent`. An initial failure replaces only the leaf with Retry; a refresh failure retains stale content and presents a non-blocking Retry treatment.
- Loader contract: a direct entry or hard refresh shows Earth only during username/bootstrap identity; after bootstrap it shows at most one route skeleton. Internal category navigation keeps the stable public shell mounted and changes only the leaf state. Background refresh retains content. There is no fixed minimum delay.
- Data ownership: username/account identity and theme/bootstrap data have one shared owner/cache boundary and are not re-requested independently by every leaf.
- Query-count contract: one direct entry issues one bootstrap identity/visibility/theme operation; route guards consume that result and do not issue duplicate account operations.

- [ ] **Step 1: Write the RED state-transition matrix**

Cover direct entry, hard refresh, same-username internal navigation, username switch, background refresh success/failure, initial terminal error, Retry, route switch while an old query is pending, and Strict Mode remount. Assert `begin-route` can replace the prior leaf generation without restarting bootstrap, while all other mismatched-generation events are ignored.

- [ ] **Step 2: Write RED rendered-loader tests**

Assert the exact visible sequence:

```text
DIRECT / REFRESH: Earth bootstrap -> one route skeleton or ready content -> content
INTERNAL NAV:     stable shell/content -> target leaf skeleton -> target content
REFRESHING:       existing content + non-blocking refresh state -> updated content
ERROR:            stable shell + scoped Retry on the requested URL
```

At no point may Earth, the profile skeleton, and a category skeleton be visible together. Assert no green placeholder box flashes before the intended surface.

- [ ] **Step 3: Consolidate bootstrap identity/theme ownership**

Move the minimal account-existence, public-tab visibility, and bootstrap theme fields into one `PublicProfileBootstrapContext` query at the layout boundary. `UsernameValidator` and `TabVisibilityGuard` consume that result and its classified error/retry state instead of issuing their current separate account queries. The root profile may still fetch its larger content payload, but it must reuse the bootstrap account identity and must not create independent “page loaded” truth.

Add an integration assertion that a direct category entry makes exactly one bootstrap operation. A bootstrap network/auth/server error stays on the requested URL with Retry; it must never pass through `TabVisibilityGuard` as if an absent account or tab were valid.

- [ ] **Step 4: Make hidden categories use the canonical fallback after bootstrap**

Only after shared bootstrap succeeds, replace `TabVisibilityGuard`'s “first available tab” search and premium unavailable card with `<PublicProfileFallbackRedirect />`. Preserve query-error classification and consume the bootstrap result without a second account query.

- [ ] **Step 5: Migrate every route leaf from the authoritative contract**

Each leaf reports its real query lifecycle through `usePublicRouteLifecycle`. Remove unconditional ready-on-mount signals and local completion effects as each route migrates. Map and modal-local loaders may remain only when they represent a separate user-triggered subrequest, not the route's initial readiness.

- [ ] **Step 6: Prove legacy global completion signals remain absent**

Add a source-contract test/search gate for `window.__publicProfileLoaded`, `ReadyOnMount`, and duplicated page-loaded flags. Replace any E2E wait that still relies on an implementation signal with semantic page markers and route-readiness state.

- [ ] **Step 7: Verify all contract leaves and commit**

Run: `npm test -- --run src/layouts/__tests__/publicRouteReadiness.test.ts src/layouts/__tests__/PublicRouteReadinessContext.test.tsx src/layouts/__tests__/PublicProfileBootstrapContext.test.tsx src/layouts/__tests__/usePublicRouteLifecycle.test.tsx src/layouts/__tests__/PublicLayout.test.tsx src/routes/__tests__/PublicRoutes.test.tsx`

Run: `npx tsc -b`

Commit: `fix(public-profile): consolidate bootstrap and route readiness`

---

### Task 2A: Define and Implement the Public Visual-State Contract

**Files:**
- Modify: `explorers-earth/src/routes/publicRouteContract.ts`
- Create: `explorers-earth/src/layouts/PublicRouteSkeleton.tsx`
- Create: `explorers-earth/src/layouts/__tests__/PublicRouteSkeleton.test.tsx`
- Modify: `explorers-earth/src/layouts/PublicLayout.tsx`
- Modify: `explorers-earth/src/layouts/__tests__/PublicLayout.test.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicProfile.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicProfileHeader.tsx`
- Modify: existing public empty/error/refresh components and locale resources only where a failing state-contract test requires it

**Route-family shell contract:**

| Route kind | Persistent chrome | Loading geometry | Refresh behavior |
|---|---|---|---|
| Profile root | existing `PublicNav`, profile identity/hero, bio, tabs, footer once ready | profile-root skeleton | keep full profile content; one non-blocking route progress treatment |
| Collection index | existing `PublicNav` plus that category's existing composition | collection skeleton | keep category content and focus; no dim/remount |
| Detail/filter/list | existing `PublicNav` plus that route's existing composition | detail/list skeleton | keep detail/list content and focus; no dim/remount |
| Map/full-screen | existing full-screen map chrome; no profile wrapping | map skeleton | keep map canvas/controls; local progress only |

“Stable shell” does **not** wrap Movies, Places, Guides, Apps, Products, People, or map routes inside the root profile identity and tabs. Existing category compositions remain unchanged.

- [ ] **Step 1: Write RED shell/skeleton registry tests**

Require every route-contract ID to name a shell kind and skeleton kind. At 320, 375, 768, 1024, and 1440 CSS pixels plus `375x667`, assert the route skeleton uses theme tokens, keeps the intended stable regions, has no two-dimensional page scroll, and stays within the approved screenshot/bounding-box baseline.

- [ ] **Step 2: Implement one route-family skeleton selector**

Replace the universal `PublicProfileSkeleton` fallback for every route with geometry appropriate to the current contract entry. Do not introduce decorative cards or a second container behind identity/content.

- [ ] **Step 3: Standardize refresh treatment**

Use one existing low-motion progress treatment at the owning shell's top edge. Set `aria-busy` on the content region, do not repeatedly announce background refreshes, respect `prefers-reduced-motion`, and never hide/dim stale content or move focus.

- [ ] **Step 4: Specify empty/error/focus behavior**

- Bootstrap error: named error region receives programmatic focus or an assertive one-time announcement.
- Leaf error: requested URL remains; a named region exposes Retry; focus returns to the recovered content heading after success.
- Redirect: no invalid-child card flashes, Earth does not restart, and focus lands on the root profile `<h1>` after replacement while ordinary internal navigation does not steal focus.
- Unknown username: Not Found owns the document title and one primary heading.
- Collection empty: category-specific title/description using existing tokens; guests never see owner-only dashboard actions.
- Missing detail/filter/list: redirects rather than rendering an empty card.
- Map with no points: remains a valid map state with the existing no-points treatment.

- [ ] **Step 5: Add localized state keys and structural parity tests**

Add/confirm keys for bootstrap error, leaf error, Retry, refresh status, and empty states. Run `npm run i18n:check` and assert locale-key structure, not English fallback behavior.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- --run src/layouts/__tests__/PublicRouteSkeleton.test.tsx src/layouts/__tests__/PublicLayout.test.tsx`

Run: `npm run i18n:check`

Commit: `fix(public-profile): align route loading error and empty surfaces`

---

### Task 2B: Correct the Public Avatar Interaction Without Rewriting Bio Content

**Files:**
- Modify: `explorers-earth/src/features/PublicHome/components/PublicProfile.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicProfileHeader.tsx`
- Modify: `explorers-earth/src/features/PublicHome/components/__tests__/PublicProfile.presentation.test.tsx`
- Modify: `explorers-earth/src/features/PublicHome/utils/resolvePublicProfileSurface.ts`

**Behavior:**
- Activating the avatar opens the existing full media viewer on that profile photo; it never opens the QR modal.
- A configured photo, a safe fallback image, and the generated default avatar all have the same clickable viewer behavior.
- The avatar button has an accurate localized accessible name; native Enter/Space activation, Escape-to-close, focus return, and image alt behavior are tested.
- QR/share behavior remains available through the existing dedicated share control and is not coupled to the avatar.
- User-authored rich-text bold, italic, links, and explicit colors remain untouched. Contrast enforcement applies to system chrome/tokens, not by rewriting saved rich-text markup.

- [ ] **Step 1: Write RED interaction tests**

Assert avatar activation opens `MediaViewer` with exactly the resolved avatar item, QR remains closed, default avatar behaves identically, keyboard activation works, Escape closes, and focus returns to the avatar.

- [ ] **Step 2: Route avatar activation to the media viewer**

Replace `setShowQR(true)`/`open-qr-modal` behavior with a dedicated avatar viewer item and accurate analytics metadata. Keep feed-media viewer behavior independent.

- [ ] **Step 3: Verify rich-text preservation and system contrast boundaries**

Keep sanitization and supported inline formatting intact. Test system headings, tabs, empty/error UI, footer, and focus rings against theme tokens without changing author-selected bio styling.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- --run src/features/PublicHome/components/__tests__/PublicProfile.presentation.test.tsx src/features/PublicHome/utils/__tests__/publicProfileContent.test.ts`

Commit: `fix(public-profile): open avatar in the media viewer`

---

### Task 3: Distinguish Missing Published Resources From Empty and Failed Queries

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
- Modify: public GraphQL query modules for Places/Guides/Movies/Books/Games/Apps/Products/People where current fixed limits or client-side taxonomy filtering are proven
- Test: corresponding public component test files created beside each feature's public components

**Interfaces:**
- Produces: `resolvePublicChildState({ loading, error, bootstrapReady, resourceKind, entityExists, empty }): "loading" | "error" | "redirect" | "empty" | "ready"`.
- Consumes: `PublicProfileFallbackRedirect` from Task 1.
- Rule: errors always win over missing-resource redirects once loading finishes; collection roots may be empty; a missing child entity redirects; an existing published child with zero contained items remains on its URL and renders its child-specific empty state.
- Boundary: this resolver classifies a settled resource result only. `usePublicRouteLifecycle` owns presentation lifecycle. Cached data plus loading is `refreshing`; cached data plus error retains stale content with non-blocking Retry. A settled response may redirect only when its captured leaf generation is still current.

- [ ] **Step 1: Write the pure-state RED matrix**

```ts
it.each([
  [{ loading: true, error: undefined, bootstrapReady: false, resourceKind: "child", entityExists: false, empty: false }, "loading"],
  [{ loading: false, error: new Error("Forbidden"), bootstrapReady: true, resourceKind: "child", entityExists: false, empty: false }, "error"],
  [{ loading: false, error: undefined, bootstrapReady: true, resourceKind: "child", entityExists: false, empty: false }, "redirect"],
  [{ loading: false, error: undefined, bootstrapReady: true, resourceKind: "collection", entityExists: true, empty: true }, "empty"],
  [{ loading: false, error: undefined, bootstrapReady: true, resourceKind: "child", entityExists: true, empty: true }, "empty"],
  [{ loading: false, error: undefined, bootstrapReady: true, resourceKind: "child", entityExists: true, empty: false }, "ready"],
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
  if (input.loading || !input.bootstrapReady) return "loading";
  if (input.error) return "error";
  if (input.resourceKind === "child" && !input.entityExists) return "redirect";
  if (input.empty) return "empty";
  return "ready";
}
```

- [ ] **Step 4: Write component RED tests for every child family**

For each detail/filter component, mock these four outcomes and assert exactly one UI result: loading skeleton, scoped Retry error, profile-root redirect, or content. For category indexes, assert a successful zero-length response stays on its URL and renders the category-specific empty state.

- [ ] **Step 5: Batch A, migrate Places and Guides**

Use `resolvePublicChildState` in the guide/detail and place/filter flows before rendering existing not-found cards. Return `<PublicProfileFallbackRedirect />` only for `"redirect"`; pass actual failures to `usePublicRouteLifecycle`; preserve existing empty index/collection rendering.

Run the shared state tests plus only the Places/Guides component tests.

Commit: `fix(public-profile): classify unavailable place and guide routes`

- [ ] **Step 6: Batch B, migrate Movies, Books, and Games**

Apply the identical loading/error/redirect/empty/ready contract to list and genre/subject routes. Run the shared state tests plus entertainment-family tests.

Commit: `fix(public-profile): classify unavailable entertainment routes`

- [ ] **Step 7: Batch C, migrate Apps, Products, and People**

Apply the same contract to list and sector routes. Run the shared state tests plus Apps/Products/People tests.

Commit: `fix(public-profile): classify unavailable recommendation routes`

- [ ] **Step 8: Verify stale navigation cannot redirect the current route**

Add a deferred-query test: begin `/alice/apps/deleted-list`, navigate to `/alice/products`, resolve the old Apps query with no resource, and assert the Products URL remains unchanged.

- [ ] **Step 9: Replace fixed-cap and client-filtered child lookup paths**

For slug/detail/taxonomy routes, prefer a server-filtered published-resource query keyed by account plus slug/taxonomy instead of fetching the first 100/200 records and filtering in the browser. For genuinely browsable collections, request `pageInfo` and progressively load stable pages. Preserve old items during the next-page request and expose a local retry if a later page fails.

Add tests proving:

- The 201st published item remains reachable.
- A second page appends once without duplicates and preserves ordering.
- A partial-page failure retains already rendered items and can retry.
- A valid published taxonomy with zero contained items remains on its URL with the correct empty state.
- A missing/unpublished taxonomy or child redirects only after its direct lookup settles for the current generation.

- [ ] **Step 10: Run the cross-family focused suite**

Run: `npm test -- --run src/routes/__tests__/resolvePublicChildState.test.ts src/routes/__tests__/PublicRoutes.test.tsx src/features/Movies/components/public src/features/Books/components/public src/features/Games/components/public src/features/AppsAndTools/components/public src/features/Products/components/public src/features/People/components/public`

Run: `npx tsc -b`

---

### Task 4: Share One Tested Apollo Credential Policy

**Files:**
- Create: `explorers-earth/src/lib/apolloTransport.ts`
- Create: `explorers-earth/src/lib/__tests__/apolloTransport.test.ts`
- Modify: `explorers-earth/src/main.tsx`
- Modify: `explorers-earth/src/__tests__/main.auth.test.tsx`
- Modify: `explorers-earth/src/services/analyticsService.ts`
- Modify: `explorers-earth/src/services/__tests__/analyticsService.test.ts`

**Interfaces:**
- Produces: `createApolloTransport({ uri, getSessionToken, capabilities }): ApolloLink` and a pure capability-aware authorization selector.
- Produces: `classifyApolloOperation(operation): "auth" | "session-only" | "public-read" | "analytics-write"`. Authentication operations are explicit `auth`; the one approved analytics mutation is `analytics-write`; all other mutations are `session-only`; queries may use `public-read` after the session token check.
- Credential precedence for public reads: authenticated JWT, otherwise configured least-privilege public-read capability, otherwise anonymous.
- Credential precedence for analytics writes: authenticated JWT when allowed by the existing owner/non-owner contract, otherwise the independently configured analytics-write capability, otherwise anonymous.
- Browser capability inputs are `VITE_PUBLIC_READ_ACCESS_TOKEN` and `VITE_ANALYTICS_WRITE_ACCESS_TOKEN`. The implementation may support the current shared `VITE_PUBLIC_ACCESS_TOKEN` as a deprecated local compatibility input, but protected release verification fails when read and write resolve to that same extractable value.
- Authentication and session-only operations never receive a browser public credential.
- A single 401 retry without a credential is allowed only for a query that actually used the `public-read` capability. Session and analytics-write failures never downgrade to anonymous.

- [ ] **Step 1: Write RED tests for the complete credential matrix**

```ts
it.each([
  ["login", "auth", "session", "public-read", undefined],
  ["PublicAppData", "public-read", "session", "public-read", "Bearer session"],
  ["PublicAppData", "public-read", undefined, "public-read", "Bearer public-read"],
  ["CreateAnalytics", "analytics-write", undefined, "analytics-write", "Bearer analytics-write"],
  ["PublicAppData", "public-read", undefined, undefined, undefined],
])("selects authorization for %s", (operationName, capability, session, publicToken, expected) => {
  expect(selectAuthorization({ operationName, capability, sessionToken: session, publicAccessToken: publicToken })).toBe(expected);
});
```

Add tests proving AST mutation/query classification, an explicit authentication-operation allowlist, an explicit analytics-mutation allowlist, a public-read 401 retry once anonymously, no downgrade for session/analytics-write failures, no public credential on arbitrary mutations, a GraphQL `Forbidden access` response not misclassified as empty, and per-operation retry flags that cannot leak across concurrent requests.

- [ ] **Step 2: Run transport tests and confirm RED**

Run: `npm test -- --run src/lib/__tests__/apolloTransport.test.ts src/__tests__/main.auth.test.tsx src/services/__tests__/analyticsService.test.ts`

- [ ] **Step 3: Implement the transport and migrate both clients**

Move the current `setContext` and `onError` logic out of `main.tsx`. Use the resulting link in the application client and the dedicated analytics client. Do not import `main.tsx` from services.

- [ ] **Step 4: Remove client-side third-party IP discovery**

Delete `getUserIPAddress` and its four external browser requests. Omit `ipAddress` from the browser mutation payload; server/network infrastructure remains responsible for trustworthy IP/rate-limit data.

- [ ] **Step 5: Run focused verification**

Run: `npm test -- --run src/lib/__tests__/apolloTransport.test.ts src/__tests__/main.auth.test.tsx src/services/__tests__/analyticsService.test.ts`

Run: `npm run verify:public-api -- --username=tk2727`

Run the Task 0 preflight again after transport migration. The classified result must be unchanged except for intentionally corrected credentials/permissions.

- [ ] **Step 6: Commit**

Commit: `fix(api): unify public data and analytics credentials`

---

### Task 5: Complete Application Analytics Coverage

**Files:**
- Modify: `explorers-earth/src/routes/publicRouteContract.ts`
- Modify: `explorers-earth/src/services/analyticsService.ts`
- Modify: `explorers-earth/src/services/__tests__/analyticsService.test.ts`
- Modify: `explorers-earth/src/features/PublicHome/components/PublicGuideDetailPage.tsx`
- Modify: `explorers-earth/src/features/Movies/components/public/PublicMovieList.tsx`
- Modify: `explorers-earth/src/features/Movies/components/public/PublicMovieGenre.tsx`
- Modify: `explorers-earth/src/features/Books/components/public/PublicBookList.tsx`
- Modify: `explorers-earth/src/features/Books/components/public/PublicBookSubject.tsx`
- Modify: `explorers-earth/src/features/Games/components/public/PublicGamesList.tsx`
- Modify: `explorers-earth/src/features/Games/components/public/PublicGamesGenre.tsx`
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
- Create or modify: corresponding nested-route analytics tests for Guides, Movies, Books, and Games
- Modify: `explorers-earth/src/hooks/__tests__/usePageTracking.test.ts`

**Interfaces:**
- Produces: `createAnalyticsOptions.apps`, `.products`, and `.people`, accepting account ID, username, and optional list/filter IDs.
- Extends: existing Movies/Books/Games/Guides options to their list/detail/filter routes instead of tracking only category indexes.
- Adds: an explicit analytics requirement to every `publicRouteContract` entry: `custom-page-view`, `custom-page-view-and-interactions`, or `ga-pathname-only`. A test fails if a route has no classification.
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

Assert one guest view, one non-owner view, zero owner-on-own-profile mutations, one mutation per unique card click, duplicate suppression within a session, a new event after session reset, and suppression remaining correct when authentication state changes after initial render. Assert analytics debug payloads are not written to the browser console.

- [ ] **Step 2: Run analytics tests and confirm RED**

Run: `npm test -- --run src/services/__tests__/analyticsService.test.ts src/features/AppsAndTools/components/public/__tests__/PublicApps.analytics.test.tsx src/features/Products/components/public/__tests__/PublicProducts.analytics.test.tsx src/features/People/components/public/__tests__/PublicPeople.analytics.test.tsx`

- [ ] **Step 3: Add explicit factories and route-complete instrumentation**

Follow the existing Movies/Books/Games index pattern, then close its current nested-route gap. Pass stable document IDs rather than slugs in identifier fields, invoke `trackClick` before opening detail modals, track Share from index/list/detail surfaces, include route variant/path in metadata, and make the owner-suppression callbacks depend on the current `shouldSkipTracking` value rather than a stale closure. Remove the existing debug `console.log` payload.

For map/community or any route intentionally classified `ga-pathname-only`, test that custom analytics is deliberately absent while GA still receives the pathname. Do not silently omit a route.

- [ ] **Step 4: Verify GA navigation separately**

Extend `usePageTracking.test.ts` to navigate `/alice` → `/alice/apps` → `/alice/products/list-a` and assert one `gtag("config", measurementId, { page_path })` call for each pathname transition. Query/hash-only changes do not create a second pathname event under the existing contract.

- [ ] **Step 5: Run focused tests and commit**

Run: `npm test -- --run src/services/__tests__/analyticsService.test.ts src/hooks/__tests__/usePageTracking.test.ts src/features/AppsAndTools/components/public/__tests__/PublicApps.analytics.test.tsx src/features/Products/components/public/__tests__/PublicProducts.analytics.test.tsx src/features/People/components/public/__tests__/PublicPeople.analytics.test.tsx`

Commit: `feat(analytics): cover apps products and people public routes`

---

### Task 6: Build the Deterministic Route, Data, and Settings Matrix

**Files:**
- Import: `explorers-earth/src/routes/publicRouteContract.ts`
- Modify: `explorers-earth/e2e/support/publicProfileFixture.ts`
- Create: `explorers-earth/e2e/public-profile-route-contract.spec.ts`
- Modify: `explorers-earth/e2e/public-profile-adaptive-surface.spec.ts`
- Modify: `explorers-earth/e2e/profile-theme.spec.ts`
- Modify: `explorers-earth/e2e/profile-presentation-visual.spec.ts`
- Modify: `explorers-earth/e2e/profile-editor-polish.spec.ts`
- Create: `explorers-earth/e2e/profile-settings-persistence.spec.ts`
- Create: `explorers-earth/tsconfig.test.json`
- Create: `explorers-earth/tsconfig.e2e.json`
- Modify: `explorers-earth/playwright.config.ts`
- Modify: `explorers-earth/package.json`

**Interfaces:**
- Consumes: the application-owned typed route contract containing every root/index/detail/filter/map route, expected visibility field, expected page marker, and public GraphQL operation. E2E must not re-declare paths.
- Produces: a settings manifest for six themes, four wallpaper modes, hero present/absent/broken, footer modes, recommendation layouts, category order, bio/social/gallery states, and responsive boundaries.

- [ ] **Step 1: Make the application route contract test-complete**

```ts
export const publicRouteContract = [
  { family: "profile", path: "/:username", requiredOperations: ["PublicProfile"], conditionalOperations: [], marker: "public-profile-shell" },
  { family: "places", path: "/:username/places", requiredOperations: ["AccountsDetail"], conditionalOperations: ["PlacesNextPage"], marker: "places-page" },
  { family: "apps", path: "/:username/apps", requiredOperations: ["PublicAppData"], conditionalOperations: ["AppsNextPage"], marker: "apps-page" },
  { family: "apps-list", path: "/:username/apps/:listSlug", requiredOperations: ["AppListBySlug"], conditionalOperations: ["AppsListNextPage"], marker: "apps-list-page" },
] as const;
```

The complete implementation must enumerate all route families named in the specification. Tests import this contract, assert that every route ID has an element mapping, every required/conditional operation references the Task 0 capability manifest, and each observed GraphQL operation in every exercised state is declared. Undeclared or unobserved required operations fail CI.

- [ ] **Step 2: Add exhaustive component-state tests and tiered route E2E**

At unit/component level, exhaust every contract route across direct-entry initialization, successful content, successful empty root, missing child redirect, hidden category redirect, initial loading, background refresh, failure with Retry, and stale response. At Playwright level, exhaust every supported route shape for direct entry, internal navigation, hard refresh, successful content/empty behavior, page marker, and clean console/network output; run each timing/failure/stale scenario on one representative route per route family instead of multiplying every state by every path.

- [ ] **Step 3: Add bounded exhaustive and pairwise settings coverage**

Run all 24 theme × wallpaper combinations at 375 and 1024 widths. Exercise every individual setting value. Generate pairwise cases for independent secondary settings and assert every value and pair appears. Include 320/768/1440 boundaries, short mobile height, 200% zoom, broken media, long rich-text bio, reduced motion, keyboard reorder, and touch drag.

The visual assertions use the approved rendered-pixel four-capture method rather than CSS-variable inspection. Sample system-owned hero identity text, tabs, cards, empty/error UI, footer, controls, and focus rings against their rendered backgrounds/wallpapers. Require 4.5:1 for normal system text and 3:1 for large text, icons, and UI boundaries. Preserve user-authored rich-text colors as content rather than rewriting them.

Responsive pass criteria: no two-dimensional page scroll at 320 CSS pixels except intentional horizontal tab/appearance rails; all interactive targets are at least 44×44; selected items remain visible after horizontal scrolling; focus indicators are not clipped; safe-area bottom clearance prevents overlap with bottom navigation and Save & Publish; `375x667` remains usable; 200% zoom reflows without content loss.

- [ ] **Step 4: Verify save payload and public rendering**

Intercept the save mutation, assert the complete payload, return the saved state, hard reload the dashboard, then open the public route and assert the same theme, wallpaper, category order, layout, footer, bio/social/gallery behavior, and enabled tabs.

- [ ] **Step 5: Prove changed-branch coverage before browser breadth**

Run focused Vitest coverage for the new route contract, redirect, readiness reducer/context/hook, child-state resolver, Apollo classifier/transport, and analytics policy. Require 100% branch coverage for those new pure/state modules; report existing repository-wide coverage separately without pretending the legacy baseline is 100%.

- [ ] **Step 6: Run deterministic UI suites and commit**

Create separate Playwright projects/scripts:

- `test:e2e`: deterministic fixtures with `testIgnore: /real-account/`, no real-account requirements, and a contract test proving `npm run test:e2e -- --list` never discovers protected specs.
- `test:e2e:real-account`: protected project with `testMatch: /real-account/`, `workers: 1`, `fullyParallel: false`, `reuseExistingServer: false`, and both an explicit live-write flag and exact dedicated-account marker before mutation. Missing prerequisites fail this explicitly invoked command rather than becoming skipped/pass.

Extract and reuse the existing `profile-theme.spec.ts` approved-live-write gate, exact restore, and emergency-restore mechanics instead of creating a competing mutation harness. Run every theme × wallpaper combination as its own named test with `workers=1`; attach per-case screenshots/diagnostics on failure and generate a post-suite contact sheet.

Add `typecheck:test` and `typecheck:e2e` scripts using the dedicated tsconfig files so unit and Playwright code—which the application tsconfig currently excludes—are compiled in CI.

Set deterministic-project diagnostics to `trace: "retain-on-failure"`, `screenshot: "only-on-failure"`, HTML + line reporters, and a machine-readable JSON/JUnit summary. Each artifact name includes project, route/case ID, viewport, and attempt so the first useful evidence is discoverable without reading a long log. Protected real-account CI does not retain raw traces/video that may embed Authorization headers or private dashboard data; it emits redacted operation summaries and controlled-account public screenshots. Redaction tests inspect attachments/artifacts as well as stdout.

Verification starts a fresh app server by default on an allocated/reported port. Reuse is available only through explicit `PW_REUSE_SERVER=1`. The startup banner records base URL, PID/start command, branch/commit marker, API hostname, project, and redacted environment classification so a stale process or wrong worktree cannot produce a false green.

Run each modified Playwright file individually, then run the deterministic project together. Preserve screenshot/contact-sheet artifacts for visual failures and record the bounded case count so “all combinations” means the declared exhaustive dimensions, not an unbounded Cartesian product.

Commit: `test(public-profile): cover route data and settings matrix`

---

### Task 7: Prove the Real Guest and Authenticated Account Journeys

**Files:**
- Create: `explorers-earth/e2e/real-account/profile-public-contract.spec.ts`
- Create: `explorers-earth/e2e/real-account/README.md`
- Create: `explorers-earth/e2e/support/consoleNetworkAudit.ts`
- Modify: `explorers-earth/playwright.config.ts`
- Modify: `docs/testing.md`
- Modify: `docs/troubleshooting.md`

**Interfaces:**
- Consumes environment variable names for a controlled testing account; never records their values.
- Splits the read-only guest/API audit from the serialized mutation/persistence audit.
- Captures mutable dashboard settings before each persisted group, writes a versioned backup artifact outside git, verifies a dedicated test-account marker, restores after each group in `finally`, and verifies restoration through both API and public UI.
- Records GraphQL operation/status/error summaries without Authorization headers or response-private fields.
- Uses a non-production analytics sink or a dedicated QA account excluded from reporting. Every generated event carries a run ID, and cleanup/filtering is verified before the suite reports success.

- [ ] **Step 1: Document safe prerequisites and restoration**

Document the dedicated test-account marker, required variable names, guest/owner/non-owner browser contexts, allowlisted backup shape outside the repository, per-group restoration order, crash-recovery command, and explicit block reasons. Store backups in an OS temporary directory with restrictive permissions; never include credentials, unrelated account fields, or raw private responses. Record the path for crash recovery, delete the backup only after restoration is verified, and document recovery for intentionally retained crash artifacts. Link this recovery guide from `docs/testing.md` and `docs/troubleshooting.md`; include the read-only restoration verification command. A missing credential or mismatched account marker produces a stable named failure when the protected suite is invoked, never a pass/skip and never a mutation.

- [ ] **Step 2: Add the read-only real guest/API journey**

Without mutating account data, open every enabled public route as a clean guest, verify GraphQL operation/status/error summaries, assert content or the correct successful empty state, and capture console/network evidence.

- [ ] **Step 3: Add the serialized dashboard-to-public save journeys**

For one persisted group at a time, back up that group, change values through visible UI controls, save and wait for the mutation, reload the dashboard, verify controls, open the public root/category routes, compare visible data with successful GraphQL response summaries, restore that group, and verify the restoration before continuing. A failed restoration aborts all remaining mutations.

The deterministic fixture suite is the exhaustive proof for all 24 theme × wallpaper combinations. The real account suite proves one value from every persisted field plus a declared high-risk subset: absent hero, broken hero fallback, full-wallpaper dark theme, banner light theme, ambient gradient, long bio, reordered categories, and gallery/social visibility. It does not mutate the real account through all 24 cases.

- [ ] **Step 4: Add guest route and analytics verification**

Use a clean guest context to open every enabled category. Assert HTTP success, no GraphQL errors, expected content/empty state, one application view mutation per page/session contract, card/share click mutations, and GA pathname calls. Then repeat as owner and non-owner to prove owner suppression only affects the intended account. Stamp analytics events with the run ID, verify they reached the QA sink, then delete them or prove the reporting exclusion; cleanup failure is a release blocker.

- [ ] **Step 5: Add invalid/unavailable/error separation**

Verify unsupported paths, hidden categories, and deleted/unpublished slugs replace-navigate to `/:username`; unknown usernames show Not Found; API 401/403/429/500 simulations remain on the requested route and show Retry.

- [ ] **Step 6: Run mobile and desktop Chrome verification**

Run at 375 × 812 and 1440 × 900, including refresh, back/forward, touch/keyboard controls, screenshots, and console/network audit. Restore the account and verify the restoration publicly.

Run only through the serialized `real-account` Playwright project with `reuseExistingServer: false`; deterministic fixture E2E remains a separate normal CI project.

- [ ] **Step 7: Commit**

Commit: `test(public-profile): add real guest and account contract journey`

---

### Task 8: Final Review, Quality Gates, and Truthful Release Report

**Files:**
- Create: `docs/superpowers/reports/2026-08-22-public-profile-routing-data-analytics-qa.md`
- Create: `explorers-earth/scripts/verify-public-profile.mjs`
- Create: `explorers-earth/scripts/__tests__/verify-public-profile.test.mjs`
- Modify: `explorers-earth/README.md`
- Modify: `.github/workflows/ci.yml`
- Modify only defects proven by final verification

- [ ] **Step 1: Run static and unit gates**

Run: `npm run lint -- --quiet`

Run: `npx tsc -b`

Run: `npm run typecheck:test`

Run: `npm run typecheck:e2e`

Run: `npm run i18n:check`

Run: `npm run test:unit -- --reporter=verbose`

Run: the focused changed-module coverage command from Task 6 and prove 100% branch coverage for the new pure contract/state modules.

Expected: zero errors and zero failing tests; record actual counts and duration.

- [ ] **Step 2: Run API and browser gates**

Run: `npm run verify:public-api -- --username=tk2727`

Run every affected deterministic Playwright file independently, then: `npm run test:e2e`

Run the protected release journey separately: `npm run test:e2e:real-account`

Run: `npm run build`

Expected: guest category reads and analytics writes succeed with no unexpected console/network failures. Any missing external credential remains a named blocker rather than being waived.

Expose and document two golden-path commands:

- `npm run verify:public-profile`: deterministic static/unit/contract/fixture-E2E gates, safe on every contributor machine after `npm ci` and Playwright browser install.
- `npm run verify:public-profile:release`: protected capability plus real-account/analytics journey, with prerequisite errors that name the missing variable, expected test-account marker, and recovery document.

Implement these as a cross-platform Node orchestrator rather than shell chaining. Support `--username`, `--headed`, `--dry-run`, and `--json` where safe; print the failed child command, artifact path, and next corrective command. The README links to the environment and real-account safety documentation and states Node `>=22.12`, the app-directory working requirement, expected runtime, artifacts, and which command is safe/non-mutating.

Update CI explicitly: normal PR jobs run the script/env contract tests, `typecheck:test`, `typecheck:e2e`, i18n, and deterministic E2E only. A protected approved environment job runs live capability preflight and `verify:public-profile:release` with required secrets. Fake fixture tokens never satisfy live capability claims; missing protected prerequisites fail only the protected job with a stable code.

Upload HTML plus machine-readable Playwright reports and failure artifacts with `if: always()`. Configure `if-no-files-found` intentionally (`error` for required summaries, `warn` for optional failure media) so an empty artifact directory cannot look like evidence.

- [ ] **Step 3: Run the complete manual Chrome checklist**

Verify guest, owner, and non-owner sessions; every enabled route; invalid/unavailable redirects; empty/error/Retry; all theme/wallpaper combinations; responsive boundaries; save/reload/public persistence; GA and application analytics evidence.

- [ ] **Step 4: Review isolation and the final diff**

Run: `git diff --check`

Run: `git status --short`

Run: `git diff --stat origin/main...HEAD`

Run: `git diff --quiet origin/main...HEAD -- tunes/`

Run: `git diff --name-only origin/main...HEAD` and explicitly fail if any path matches user-sync/Local-Tunes ownership markers, even outside the `tunes/` directory.

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

## CEO/Product Review

**Mode:** Selective expansion. Keep the public-profile reliability scope, but add only work that closes a proven user-visible gap. Do not turn this branch into a backend rewrite.

### Premises and chosen approach

The review treats these user decisions as settled: valid usernames own the canonical `/:username` fallback; true API errors stay visible with Retry; valid empty categories stay on their URL; guests must be able to view enabled public routes; direct bootstrap uses Earth without a fixed delay; internal navigation keeps a stable shell; existing profile/theme functionality must remain intact.

| Approach | Completeness | Decision |
|---|---:|---|
| Wildcard redirect + environment-token patch | 4/10 | Rejected. It leaves competing loaders, stale readiness, missing/error ambiguity, analytics gaps, and no persistence proof. |
| Typed route contract + readiness consolidation + classified data/credential/analytics tests | 10/10 | Selected. It fixes the complete observed failure boundary while remaining inside the frontend repository. |
| Full BFF/server telemetry redesign | 10/10 | Conditional release prerequisite only if Task 0 proves Strapi cannot provide safe published-read and analytics-write capabilities. Otherwise deferred as a larger backend program. |

### What already exists

- The generation-aware public-route readiness reducer exists and is reused; the plan finishes its adoption rather than replacing it.
- `PublicRoutes`, `UsernameValidator`, and `TabVisibilityGuard` already expose the three routing decision points; the plan removes their conflicting responsibilities.
- Apollo auth/public-token fallback exists in `main.tsx`; the plan extracts and tests it instead of creating another policy.
- Movies, Books, and Games already demonstrate custom analytics instrumentation; Apps, Products, and People reuse that pattern.
- Existing public empty, Retry, skeleton, theme, gallery, footer, and recommendation surfaces remain the visual vocabulary.

### Target architecture

```text
Browser URL
   |
   v
publicRouteContract.ts -------------------------------+
   | paths + visibility + marker + operation ID       |
   v                                                 |
PublicRoutes -> UsernameValidator -> PublicLayout     |
   |             account exists?      |               |
   |                                  +-> shared bootstrap identity/theme cache
   |                                                   |
   +-> hidden/unsupported -----------------------------+-> replace /:username
   |
   +-> current leaf -> usePublicRouteLifecycle(generation)
                         |
                         +-> initial-loading -> one leaf skeleton
                         +-> ready/refreshing -> stable content
                         +-> error -> scoped Retry, same URL
                         +-> successful missing child -> replace /:username

Apollo transport
   +-> auth capability (never public credential)
   +-> published-read capability -> public data
   +-> analytics-write capability -> custom analytics
   +-> GA pathname tracking remains a separate browser concern
```

### Shadow-path data flow

```text
URL params -> route contract -> bootstrap -> leaf query -> classified state -> UI
   |              |               |            |              |
   | malformed    | unsupported   | unknown    | 401/403/500  | Retry, same URL
   |              |               | username   |              |
   |              +-------------------------------> replace /:username
   |                              |
   |                              +-> Not Found (unknown username only)
   |
   +-> valid route + zero items ------------------> category empty state
   +-> valid route + missing child ---------------> replace /:username
   +-> stale response ----------------------------> ignored by generation ID
```

### Loader/readiness state machine

```text
UNRESOLVED_USERNAME --bootstrap starts--> BOOTSTRAPPING(Earth)
BOOTSTRAPPING --account/theme ready------> LEAF_INITIAL_LOADING(one skeleton)
LEAF_INITIAL_LOADING --query success-----> READY
LEAF_INITIAL_LOADING --query failure-----> ERROR(Retry)
READY --background request---------------> REFRESHING(content retained)
REFRESHING --success---------------------> READY
REFRESHING --failure---------------------> ERROR(content/shell retained)
ANY --route generation changes----------> new generation; old completions ignored

Invalid transitions: an old generation cannot mark the new route ready, redirect it,
or replace its error. Generation checks prevent all three.
```

### Error and rescue registry

| Codepath | Failure | Rescue/action | User sees |
|---|---|---|---|
| Username bootstrap | unknown account | terminal not-found classification | Not Found |
| Username bootstrap | network/auth/server failure | retain requested URL, Retry | scoped error, not redirect |
| Route matching | unsupported/extra segments | replace canonical fallback with search/hash | profile root |
| Visibility guard | category disabled | replace canonical fallback | profile root |
| Child query | successful missing/unpublished child | classified redirect | profile root |
| Collection query | successful zero items | classified empty | category empty state |
| Any leaf query | 401/403/429/500/timeout | route lifecycle error + Retry | current route and recoverable error |
| Any old query | resolves after navigation | generation mismatch drops result | no visible change |
| Public credential | invalid/excess permission | Task 0 preflight blocks release | explicit capability failure |
| Analytics mutation | guest token failure | isolated analytics error, page remains usable | content remains; failure recorded |
| Real-account mutation | save/restore failure | abort suite, restore from versioned backup | no further account mutation |

### Failure-mode and scaling review

| Codepath | Real production failure | Test | Silent? |
|---|---|---|---|
| Bootstrap/readiness | two profile navigations resolve out of order | reducer + route integration | No |
| Child resource | unpublished list returns empty data | component matrix | No, canonical fallback |
| Public data | expired public credential | transport + API preflight + browser Retry | No |
| Route contract | new path added without metadata/tests | exhaustive key/operation assertions | No, CI failure |
| Analytics | duplicate Strict Mode effect or repeated click | session-dedupe tests | No |
| Settings matrix | one theme/wallpaper combination clips tabs | 24-case mobile/desktop visual suite | No, screenshot failure |
| Real-account QA | browser dies after saving | per-group backup/restore and abort gate | No, named blocker |

At 10x traffic, Strapi/public-token limits and analytics-write throughput fail before the client state machine. At 100x, a server-owned public API/BFF, cache policy, telemetry ingestion, and rate-limit dashboards become necessary; those are not safely solved by more browser code.

### Security and rollout posture

- No new secret is created. Browser capability values are explicitly treated as public and rotatable.
- Public reads must remain published-data-only; analytics writes must reject arbitrary fields and enforce server-side rate limits.
- Client-side IP discovery is removed because a browser-supplied IP is both unreliable and spoofable.
- No new dependency, database migration, or backend mutation is introduced by the selected approach.
- Rollout order: capability preflight -> route contract -> readiness -> child classification -> transport -> analytics -> deterministic QA -> real-account QA.
- Code rollback is a git revert by logical commit. Real-account settings and QA analytics are external side effects, so rollback also requires verified settings restoration plus run-ID analytics cleanup/report exclusion; a git revert alone is insufficient.

### NOT in scope

- Full BFF/public-profile API rewrite, unless Task 0 makes it a release prerequisite; it requires a separately deployed backend and operational ownership.
- Server-side fraud scoring, trustworthy IP enrichment, alerting dashboards, and analytics warehouse changes; browser code cannot provide trustworthy enforcement.
- Tunes, Local Tunes synchronization, or user-sync behavior; another workstream owns them.
- New public-profile visual direction; this plan preserves the approved adaptive theme/profile design and fixes state behavior.

### Dream-state delta

After this plan, route behavior, leaf readiness, guest access, client analytics intent, and settings rendering are deterministic and diagnosable. The remaining 12-month gap is operational: server-owned publication policy, cache/SLO dashboards, rate-limited analytics ingestion, and automated production canaries.

## Design Plan Review

The gstack designer is not available in this environment, and this plan intentionally preserves the previously approved visual direction. The review therefore tightened the rendered state contract instead of inventing new mockups.

| Dimension | Before | After plan revisions | Decision |
|---|---:|---:|---|
| Information architecture | 8.5/10 | 10/10 | Route-family shell table defines exactly what persists without wrapping category pages in profile-root chrome. |
| Interaction states | 8/10 | 10/10 | Direct bootstrap, leaf loading, refresh, empty, error, missing, redirect, and stale response each have one visible result. |
| User journey | 7.5/10 | 9.5/10 | Direct, internal, Retry, Back, focus, and mutation/restore journeys are explicit. Final visual QA remains implementation-time evidence. |
| Specificity / AI-slop resistance | 6.5/10 | 9/10 | Existing compositions/tokens are reused; decorative cards and duplicate containers are prohibited. |
| Design-system alignment | 8.5/10 | 9.5/10 | No `DESIGN.md` exists, so existing public components and theme tokens are the source of truth. |
| Responsive + accessibility | 7/10 | 10/10 | Exact viewport, zoom, target-size, safe-area, focus, announcement, contrast, and horizontal-rail rules are specified. |
| Decision closure | 5.5/10 | 10/10 | Stable shell, avatar/QR behavior, skeleton geometry, refresh behavior, real-account matrix depth, and rich-text boundary are decided. |

### Interaction-state coverage

| Surface | Loading | Empty | Error | Success | Refreshing |
|---|---|---|---|---|---|
| Profile root | Earth bootstrap, then profile skeleton | valid profile tabs may have category empty states | stable route error + Retry | approved identity/bio/tabs/footer | full content retained + one progress treatment |
| Collection index | collection geometry skeleton | category-specific visitor-safe empty state | category shell + Retry | existing category composition | content retained |
| Detail/filter/list | detail/list skeleton | not used for missing child; redirect | requested route + Retry | existing detail/list composition | content retained |
| Map | map geometry skeleton | existing no-points map state | full-screen map error + Retry | existing map surface | map retained |

### Accessibility and responsive decisions

- Redirects preserve the approved query and hash contract, use replacement history, avoid an invalid-card flash, and focus the root profile heading after landing.
- Background refresh uses `aria-busy` without repeated live announcements and never moves focus.
- Retry exposes a named error region and returns focus to recovered content.
- All controls meet 44×44 touch targets; keyboard and touch reorder paths are both tested.
- System-owned text and controls meet rendered contrast thresholds over real wallpaper pixels. User-authored rich-text formatting/colors are sanitized for safety but are not rewritten for theme readability, matching the user's explicit decision.
- All 24 theme × wallpaper combinations are deterministic-fixture exhaustive at mobile and desktop; the real account uses a high-risk representative subset to avoid unsafe repetitive mutations.

### Design work explicitly not added

- No new global profile wrapper for category/detail/map routes.
- No new card grid, decorative empty-state container, or alternate theme system.
- No forced recoloring of saved rich-text bio spans.
- No new mockup direction; post-implementation `/design-review` on rendered pages is mandatory.

## Engineering Plan Review

The engineering review traced the current router, Apollo transports, readiness reducer, route guards, fixed-cap GraphQL queries, analytics service, Playwright configuration, and existing live-write restoration harness. The plan was revised where implementation details could otherwise produce a green test while leaving a production failure.

| Severity | Finding | Plan decision |
|---|---|---|
| P0 | Browser credentials are extractable and a positive public query does not prove least privilege. | Task 0 now requires controlled negative reads/mutations, analytics input validation, non-production rate-limit proof, independent capabilities, and a release-failing BFF decision gate. |
| P0 | `{username, location.key}` as one bootstrap generation restarts Earth on every route transition. | Bootstrap identity is keyed only by username; leaf readiness retains location generation protection. |
| P1 | Three account queries can disagree and `TabVisibilityGuard` currently ignores query errors. | One bootstrap provider owns identity/visibility/theme; guards consume it; query-count and bootstrap-error integration tests are mandatory. |
| P1 | Missing-resource resolution can mistake refresh/stale responses for absence. | Resource classification is separated from presentation lifecycle; cached-data failures retain content, and only current-generation settled results may redirect. |
| P1 | A route can issue multiple conditional GraphQL operations. | The route contract declares required and conditional operation arrays, cross-checked against the capability manifest and observed requests. |
| P1 | Fixed 100/200 caps and client-side taxonomy filtering make valid deep data appear missing. | Direct published lookups plus `pageInfo`/progressive loading and 201st-item/partial-page tests are included. |
| P1 | Fixture and real-account Playwright runs have different safety/reproducibility needs. | Separate projects/scripts; deterministic suite is normal CI, serialized real-account suite is a protected release gate. |
| P1 | Application TypeScript build excludes tests/E2E. | Dedicated test and E2E tsconfigs/scripts are mandatory gates. |
| P1 | Analytics verification persists external rows. | Use a QA sink/account, stamp run IDs, and verify cleanup or reporting exclusion. |
| P2 | A new mutation harness could bypass the existing approved-live-write restoration controls. | Extract and reuse the existing profile-theme live-write gate and exact/emergency restore path. |
| P2 | Real-account backups can leak more data than needed. | Allowlisted OS-temp artifacts, restrictive permissions, crash recovery, and verified deletion are specified. |

### Architecture and dependency order

```text
Task 0 capability proof
  -> Task 1 typed route shapes + unsupported fallback
  -> Task 2 shared bootstrap + leaf readiness + hidden fallback
  -> Tasks 2A/2B rendered states + avatar interaction
  -> Task 3 settled child classification + pagination
  -> Task 4 operation-aware transport
  -> Task 5 explicit analytics coverage
  -> Task 6 deterministic contract/settings verification
  -> Task 7 protected real-account verification
  -> Task 8 independent review + release report
```

This order intentionally delays hidden-tab decisions until bootstrap errors and visibility share one authoritative query. It also proves server capability before client UI work so permission defects are not disguised as frontend empty states.

### Test architecture

```text
Pure unit tests
  route contract | readiness reducer | child resolver | credential classifier
        |
Component/integration tests
  router history | one bootstrap request | stale responses | error/empty/redirect
        |
Deterministic Playwright project
  every route shape | every declared theme/wallpaper pair | responsive/a11y/faults
        |
Protected real-account project
  guest data | owner/non-owner analytics | save/reload/public | restore/cleanup
```

### Failure and recovery posture

- Timeout, 401/403, GraphQL forbidden, 429, 5xx, malformed payload, stale completion, partial-page failure, and restoration failure each have a named test and visible classification.
- Retry is bounded/single-flight. No failure becomes a false empty result or silent redirect.
- Real-account mutation stops immediately if the test marker, backup, restore, or public restoration check fails.
- Code rollback and external QA cleanup are documented separately.
- The final isolation gate inspects both `tunes/` and any user-sync/Local-Tunes ownership markers elsewhere in the repository.

## Developer Experience Plan Review

**Mode:** DX TRIAGE. The product is end-user-facing, but this plan introduces an internal verification interface that another contributor or release operator must run safely. The review therefore focused on first-run success and diagnosable failure rather than expanding the product scope.

**Primary persona:** a repository contributor who did not participate in this session and needs to reproduce the public-profile verdict without risking the real testing account.

| Dimension | Before | After plan revisions |
|---|---:|---:|
| Time to first deterministic verdict | 30+ minutes of command discovery | One documented command; target ≤10 minutes on a warm install |
| Setup correctness | 4/10 | 9.5/10 |
| Safety of live verification | 5/10 | 10/10 |
| Error diagnosability | 5/10 | 9.5/10 |
| CI/local parity | 5/10 | 9/10 |
| Overall DX | 4.8/10 | 9.5/10 |

### Triage findings resolved in the plan

1. Setup docs currently say Node 18/npm install while the package requires Node 22.12+ and CI uses `npm ci`; Task 0A corrects and contract-tests the prerequisite docs.
2. No one-command golden path exists; Task 8 adds cross-platform deterministic and protected-release orchestrators with dry-run/headed/JSON modes.
3. Ordinary E2E could discover `e2e/real-account`; Task 6 requires hard `testIgnore`/`testMatch` boundaries plus a list-contract test.
4. Public credential documentation is contradictory; Tasks 0A/4 define exact read/write capability names, precedence, tiers, and a safe environment doctor.
5. Current Playwright configuration discards evidence and may reuse a stale server; Task 6 adds useful deterministic artifacts, redacted protected output, and fresh-server-by-default identity banners.
6. CI does not compile tests/E2E, run i18n, or distinguish fixture tokens from protected live proof; Tasks 6/8 define the exact job split and required artifact behavior.
7. Recovery guidance is not discoverable; Task 7 links the protected-suite recovery contract from normal testing and troubleshooting docs.

### Implementation tasks from the DX review

- [ ] **DX1 (P1)** — Land Task 0A's environment doctor, stable result envelope, exact capability names, and prerequisite/doc drift tests before route code.
- [ ] **DX2 (P1)** — Hard-separate deterministic and protected Playwright discovery, default to a fresh identified server, and configure privacy-appropriate diagnostics.
- [ ] **DX3 (P1)** — Add the two golden-path Node orchestrators and map each to the correct normal/protected CI job.
- [ ] **DX4 (P2)** — Standardize recovery and analytics-cleanup errors and link their corrective commands from generated reports and troubleshooting docs.

No unresolved DX decisions remain. The final implementation-time boomerang is to run the documented commands from a clean shell/worktree and confirm the measured time and first failure are as described.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 6 proposals accepted; 2 larger backend/operations programs explicitly deferred or made conditional release prerequisites. |
| Codex Review | `/codex review` | Independent 2nd opinion | — | Not separately run | CEO, design, engineering, and DX phases each used an independent read-only reviewer; final diff review remains mandatory after implementation. |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 17 issues resolved in the plan; 0 critical gaps and 0 unresolved decisions. |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | Score improved 6.5/10 → 9.5/10; 7 interaction/responsive decisions closed. |
| DX Review | `/plan-devex-review` | Developer experience gaps | 1 | CLEAR | Score improved 4.8/10 → 9.5/10; target time to first deterministic verdict reduced from 30+ minutes of discovery to one ≤10-minute warm command. |

**CROSS-MODEL:** Independent reviewers agreed on one shared bootstrap owner, operation-aware capabilities, deterministic/protected suite separation, and evidence that cannot confuse missing data with API failure.

**VERDICT:** CEO + ENG + DESIGN + DX CLEARED — plan is ready for the implementation approval gate.

NO UNRESOLVED DECISIONS
