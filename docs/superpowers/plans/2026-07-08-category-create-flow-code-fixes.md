# Category Create Flow Code Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix code-side issues found during production category E2E seeding, excluding known infrastructure latency.

**Architecture:** Keep changes narrow in the React/Apollo frontend. Restore route-level crash fallback, ensure Product/App add flows trigger the same publish prompt as other categories, stop muting browser warnings globally, and verify with targeted unit tests plus production build.

**Tech Stack:** React 18, React Router, Apollo Client, Vitest, Testing Library, Vite.

---

## File Structure

- Modify: `explorers-earth/src/App.tsx`
  - Wrap `AppRoutes` in the existing `ErrorBoundary`.
- Modify: `explorers-earth/src/main.tsx`
  - Remove global `console.warn` suppression.
- Modify: `explorers-earth/src/features/Products/components/dashboard/AddProductPage.tsx`
  - Add `justAddedRecommendation: true` to success navigation state.
- Modify: `explorers-earth/src/features/AppsAndTools/components/dashboard/AddAppPage.tsx`
  - Add `justAddedRecommendation: true` to success navigation state.
- Create: `explorers-earth/src/__tests__/AppErrorBoundary.test.tsx`
  - Verify route render crashes show visible fallback UI.
- Create: `explorers-earth/src/features/Products/components/dashboard/__tests__/addProductNavigationState.test.tsx`
  - Verify product add success includes `justAddedRecommendation`.
- Create: `explorers-earth/src/features/AppsAndTools/components/dashboard/__tests__/addAppNavigationState.test.tsx`
  - Verify app add success includes `justAddedRecommendation`.
- Modify: `docs/superpowers/plans/2026-07-08-production-e2e-run-notes.md`
  - Record investigation and retest outcomes.

## Task 1: Route Crash Fallback

**Files:**
- Modify: `explorers-earth/src/App.tsx`
- Create: `explorers-earth/src/__tests__/AppErrorBoundary.test.tsx`

- [ ] **Step 1: Add regression test**

Create `explorers-earth/src/__tests__/AppErrorBoundary.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";

vi.mock("../routes/AppRoutes", () => ({
  default: () => {
    throw new Error("route render failed");
  },
}));

vi.mock("../components/ScrollToTop", () => ({
  default: () => null,
}));

vi.mock("../components/AuthSyncManager", () => ({
  default: () => null,
}));

describe("App error boundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a visible fallback when a route render fails", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<App />);

    expect(screen.getByRole("heading", { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload page/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go home/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test and confirm it fails before the fix**

Run:

```bash
cd explorers-earth
npm run test:unit -- src/__tests__/AppErrorBoundary.test.tsx
```

Expected before fix: test fails because the route error is not caught by `ErrorBoundary`.

- [ ] **Step 3: Enable ErrorBoundary**

Change `explorers-earth/src/App.tsx` so it imports `ErrorBoundary` and wraps `AppRoutes`:

```tsx
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthSyncManager />
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Run test and confirm it passes**

Run:

```bash
cd explorers-earth
npm run test:unit -- src/__tests__/AppErrorBoundary.test.tsx
```

Expected: 1 test file passes.

## Task 2: Product/App Publish Prompt State

**Files:**
- Modify: `explorers-earth/src/features/Products/components/dashboard/AddProductPage.tsx`
- Modify: `explorers-earth/src/features/AppsAndTools/components/dashboard/AddAppPage.tsx`

- [ ] **Step 1: Patch Product success navigation**

Change both Product success navigation paths:

```tsx
if (redirectBack) {
  navigate(redirectBack, { state: { refetch: true, justAddedRecommendation: true } });
} else {
  navigate(`/recommendations/products/${listId}`, { state: { refetch: true, justAddedRecommendation: true } });
}
```

- [ ] **Step 2: Patch App success navigation**

Change App success navigation:

```tsx
navigate(`/recommendations/apps/${listId}`, { state: { refetch: true, justAddedRecommendation: true } });
```

- [ ] **Step 3: Verify source contains the expected state**

Run:

```bash
cd ..
rg -n "justAddedRecommendation: true" explorers-earth/src/features/Products/components/dashboard/AddProductPage.tsx explorers-earth/src/features/AppsAndTools/components/dashboard/AddAppPage.tsx
```

Expected: Product has two matches; App has one match.

## Task 3: Restore Browser Warning Visibility

**Files:**
- Modify: `explorers-earth/src/main.tsx`

- [ ] **Step 1: Remove global warning suppression**

Delete this line:

```tsx
console.warn = () => {};
```

- [ ] **Step 2: Verify suppression is gone**

Run:

```bash
rg -n "console\\.warn\\s*=\\s*\\(\\)\\s*=>" explorers-earth/src
```

Expected: no matches.

## Task 4: Full Local Verification

**Files:**
- All modified frontend files.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
cd explorers-earth
npm run test:unit -- src/__tests__/AppErrorBoundary.test.tsx
```

Expected: test passes.

- [ ] **Step 2: Run build**

Run:

```bash
cd explorers-earth
npm run build
```

Expected: exit code 0.

- [ ] **Step 3: Review diff**

Run:

```bash
git diff --stat
git diff -- explorers-earth/src/App.tsx explorers-earth/src/main.tsx explorers-earth/src/features/Products/components/dashboard/AddProductPage.tsx explorers-earth/src/features/AppsAndTools/components/dashboard/AddAppPage.tsx
```

Expected: only intended changes.

## Task 5: Publish, CI, Deploy, Retest

**Files:**
- All intended changed files.

- [ ] **Step 1: Stage intended files only**

Run:

```bash
git add docs/superpowers/plans/2026-07-08-category-create-flow-code-fixes.md docs/superpowers/plans/2026-07-08-production-e2e-category-seeding.md docs/superpowers/plans/2026-07-08-production-e2e-run-notes.md explorers-earth/src/App.tsx explorers-earth/src/main.tsx explorers-earth/src/__tests__/AppErrorBoundary.test.tsx explorers-earth/src/features/Products/components/dashboard/AddProductPage.tsx explorers-earth/src/features/AppsAndTools/components/dashboard/AddAppPage.tsx
```

- [ ] **Step 2: Commit**

Run:

```bash
git commit -m "fix category create publish flows"
```

- [ ] **Step 3: Push branch**

Run:

```bash
git push -u origin codex/fix-category-create-qa
```

- [ ] **Step 4: Open draft PR**

Run:

```bash
gh pr create --draft --title "fix category create publish flows" --body-file <generated-pr-body-file>
```

- [ ] **Step 5: Watch CI**

Run:

```bash
gh pr checks --watch
```

Expected: required checks pass, or failures are captured and fixed.

- [ ] **Step 6: Deploy and production retest**

After merge/deploy completes, retest:

- Product add shows publish prompt after item creation.
- App add shows publish prompt after item creation.
- Route crash fallback is visible instead of white screen.
- Console warnings appear normally in DevTools/log capture.
- Product/App public verification still passes.

## Self-Review

- Spec coverage: covers all known code-side issues except infra latency, which is intentionally excluded.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: `justAddedRecommendation` matches existing list-view checks in Product/App/Movie/Book/Game/People list views.
