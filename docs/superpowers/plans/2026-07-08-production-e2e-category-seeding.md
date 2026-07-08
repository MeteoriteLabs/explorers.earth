# Production E2E Category Seeding Plan

Date: 2026-07-08
Target: https://explorers.earth
Account: user-provided logged-in production account

## Goal

Build and run a production-safe E2E suite that verifies every recommendation category can create lists, create items under those lists, publish when appropriate, and recover visibly from frontend failures. The target production seed shape is:

- Places: 10 city/place lists, 5-10 places each.
- Movies: 10 lists, 5-10 movies each.
- Books: 10 lists, 5-10 books each.
- Games: 10 lists, 5-10 games each.
- Apps & Tools: 10 lists, 5-10 apps/tools each.
- Products: 10 lists, 5-10 products each.
- People: 10 lists, 5-10 people each.

The suite must also cover negative and edge scenarios: empty-list publish prevention, draft-to-public publish prompts, slow mutation handling, add/edit/delete flows where supported, direct route loading, back navigation, and console/runtime error checks.

## Current Production Findings

- Category list shells were created for movies, books, games, apps/tools, products, and people.
- People list `Founders to Follow` has 5 created person items and was published.
- Product list `Travel Gear` now has product item `QA Travel Bottle`.
- Product creation was slow in production: submit stayed on the form for roughly 30 seconds before navigating back.
- Product and app creation returned with `{ refetch: true }` instead of `{ justAddedRecommendation: true }`, so the publish prompt did not appear after item creation.
- `ErrorBoundary` existed but was commented out in `App.tsx`, allowing route render crashes to become blank/white screens.

## Code Fixes In This Pass

1. Re-enable `ErrorBoundary` around `AppRoutes`.
2. Change product add success navigation to include `justAddedRecommendation: true`.
3. Change app add success navigation to include `justAddedRecommendation: true`.
4. Add a regression test that proves a route render crash shows the visible fallback.

## Test Harness Architecture

Use Playwright against production with a saved authenticated storage state. Keep all seed names prefixed and timestamped so repeated runs are easy to identify without deleting production data.

Files to add in the implementation pass:

- `explorers-earth/playwright.config.ts`
- `explorers-earth/e2e/production/seed-data.ts`
- `explorers-earth/e2e/production/helpers/auth.ts`
- `explorers-earth/e2e/production/helpers/categoryRunner.ts`
- `explorers-earth/e2e/production/helpers/assertions.ts`
- `explorers-earth/e2e/production/recommendations.seed.spec.ts`
- `explorers-earth/e2e/production/recommendations.regression.spec.ts`
- `explorers-earth/e2e/production/README.md`

Required env vars:

- `E2E_BASE_URL=https://explorers.earth`
- `E2E_STORAGE_STATE=.auth/explorers-prod.json`
- `E2E_RUN_ID=YYYYMMDD-HHMM`
- `E2E_DRY_RUN=false`

## Category Matrix

Each category adapter must define:

- Home URL.
- List create button selector.
- List form fields.
- Detail URL pattern.
- Add item button selector.
- Item form strategy.
- Success assertion text.
- Publish prompt assertion.
- Manual publish fallback selector.

Initial category adapters:

- Places: create city/list, add place manually, verify card and map/list tabs.
- Movies: create list, add movie manually/search fallback, verify card, publish prompt.
- Books: create list, add book manually/search fallback, verify card, publish prompt.
- Games: create list, add game manually/search fallback, verify card, publish prompt.
- Apps & Tools: create list, add app manually, verify card, publish prompt.
- Products: create list, add product manually, verify card, publish prompt.
- People: create list, add person manually, verify card, publish prompt.

## E2E Scenarios

### Smoke

1. Load `/home`.
2. Navigate through the sidebar to every category.
3. Assert each page has non-empty main content within 5 seconds.
4. Assert no uncaught `pageerror`.
5. Assert no console `error`.

### List Creation

For every category:

1. Open category home.
2. Create one list named `E2E <Category> <RunId> <Index>`.
3. Assert the new list appears.
4. Open the list.
5. Assert the detail page has title, draft/public status, recommendations/manage tabs, and add button.

### Item Creation

For every category:

1. Open the first E2E list for the category.
2. Add 5 items in conservative mode.
3. After each submit, wait for URL to return to the list detail page.
4. Assert item title appears.
5. Assert page body is not blank.
6. Assert no console/runtime errors.

### Publish Flow

For every category:

1. After the first item is added to a draft list, assert a publish prompt appears.
2. Confirm publish.
3. Assert list status becomes public/published.
4. Open the public profile URL for that category.
5. Assert the published list and first item are visible.

### Empty Publish Guard

For every category:

1. Create a fresh empty list.
2. Try to publish.
3. Assert the UI blocks publish with an “add at least one item” style error.
4. Assert the list remains draft.

### Regression: White Screen

For every create and detail route:

1. Capture body text length before action.
2. Submit create action.
3. Wait for network idle or category-specific success route.
4. Fail if body text length is below 20 after 5 seconds.
5. Fail on `pageerror`.
6. Fail on console `error`.
7. Save screenshot, URL, DOM excerpt, and console logs on failure.

## Execution Steps

1. Install Playwright if missing:

   ```bash
   cd explorers-earth
   npm install -D @playwright/test
   npx playwright install chromium
   ```

2. Capture authenticated storage state manually after login:

   ```bash
   E2E_BASE_URL=https://explorers.earth npx playwright codegen --save-storage=.auth/explorers-prod.json https://explorers.earth/home
   ```

3. Run smoke checks:

   ```bash
   E2E_BASE_URL=https://explorers.earth E2E_STORAGE_STATE=.auth/explorers-prod.json npm run e2e:prod:smoke
   ```

4. Run one-list-per-category creation:

   ```bash
   E2E_BASE_URL=https://explorers.earth E2E_STORAGE_STATE=.auth/explorers-prod.json E2E_RUN_ID=20260708-qa npm run e2e:prod:seed -- --grep "@one-list"
   ```

5. Run full seed only after smoke and one-list run pass:

   ```bash
   E2E_BASE_URL=https://explorers.earth E2E_STORAGE_STATE=.auth/explorers-prod.json E2E_RUN_ID=20260708-full npm run e2e:prod:seed
   ```

## Acceptance Criteria

- Every category has at least 10 lists.
- Each seeded list has 5-10 items unless the category-specific backend blocks creation.
- Every non-empty seeded list can be published or has a documented blocking defect.
- No create flow leaves the app blank for more than 5 seconds after the action resolves.
- Any backend latency over 10 seconds is logged with category, mutation, URL, and timestamp.
- A visible error fallback appears for render crashes.

## Stop Conditions

Stop the production run and switch to debugging when any of these occur:

- Body text remains empty or nearly empty for more than 5 seconds.
- A console error includes `TypeError`, `ReferenceError`, Apollo invariant failure, or router error.
- A submit button stays disabled for more than 60 seconds.
- The app redirects to login unexpectedly.
- A category creates duplicate broken lists without navigable detail pages.

## Manual Production Run Order

Until the automated harness is merged and deployed, continue in this order:

1. Re-check product/app publish prompt fix locally.
2. Seed and publish 1 list per category in production using the browser.
3. If stable, seed remaining items for existing category lists.
4. Seed places last because it has the most route-specific behavior.
5. Record every failure with URL, action, screenshot, and console logs.
