# Production All Category QA Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `qa` for the test-fix-verify loop and `browser:control-in-app-browser` for authenticated production browser control. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify every recommendation category on `https://explorers.earth` can create lists and create items under them, then fix code-side failures found during the pass.

**Architecture:** Run production QA against the logged-in in-app browser session. Keep production data non-destructive by creating QA lists/items and leaving draft prompts as draft unless a public visibility check explicitly needs publish. Record slow operations separately from code failures because infrastructure latency is already known and out of scope for this pass.

**Tech Stack:** React SPA, Apollo GraphQL, Strapi backend, GitHub Actions deploy, in-app browser automation.

---

## File Structure

- Create: `docs/superpowers/plans/2026-07-08-production-all-category-qa-plan.md`
  - QA execution checklist and scope.
- Modify: `docs/superpowers/plans/2026-07-08-production-e2e-run-notes.md`
  - Append category-by-category production QA evidence and issues.
- Create: `.gstack/qa-reports/qa-report-explorers-earth-2026-07-08.md`
  - Structured QA report with pass/fail results, timings, and repro steps for failures.
- Create screenshots under `.gstack/qa-reports/screenshots/` only when a visual failure or final report evidence needs it.
- If a code-side bug is found, create a branch `codex/fix-<issue-slug>` and modify only files directly tied to that issue.

## Scope

Categories to verify:

- Movies
- Books
- Games
- Apps & Tools
- Products
- People
- Music
- Places / Guides if exposed in the recommendation/list creation UI

Core checks per category:

- [ ] Category landing page loads while authenticated.
- [ ] Existing lists are visible without a white screen.
- [ ] Create-list entry point works.
- [ ] New QA list can be created with a unique title.
- [ ] New QA list detail page loads.
- [ ] Add-item entry point works.
- [ ] Item can be created with realistic QA data.
- [ ] After item creation, the app returns to the list detail page.
- [ ] Created item is visible in the list.
- [ ] Draft list shows `Publish this list?` prompt after item creation when the category supports publishing.
- [ ] `Keep Draft` dismisses the prompt without losing the created item.
- [ ] Manage/edit entry points open without a white screen.
- [ ] Browser console has no new `error` entries during the flow.
- [ ] Operation timing is recorded.

## Execution Tasks

### Task 1: Initialize QA Report

- [ ] Create `.gstack/qa-reports/qa-report-explorers-earth-2026-07-08.md`.
- [ ] Record target URL, date, account context as logged-in user, and exclusions.
- [ ] Record that infrastructure latency is tracked but not fixed in this pass.

### Task 2: Browser Orientation

- [ ] Connect to the in-app browser.
- [ ] Confirm the session is logged in.
- [ ] Visit `https://explorers.earth/recommendations`.
- [ ] Enumerate visible recommendation categories and create/add entry points.
- [ ] Capture console errors before category testing starts.

### Task 3: Category Happy Path Matrix

For each category in scope:

- [ ] Navigate to category page.
- [ ] Create a QA list named `QA <Category> <timestamp>`.
- [ ] Open the created list.
- [ ] Add one realistic QA item using the lowest-risk supported path.
- [ ] Verify return-to-list behavior, item visibility, draft publish prompt, and `Keep Draft`.
- [ ] Record timings and console errors.

### Task 4: Adjacent Feature Smoke Checks

For each category where controls exist:

- [ ] Open Manage.
- [ ] Verify list metadata form loads.
- [ ] Open item edit/details controls if visible.
- [ ] Verify cancel/back returns without data loss.
- [ ] Verify browser back/forward does not produce a blank page.

### Task 5: Triage and Fix

If a code-side issue is found:

- [ ] Capture repro evidence.
- [ ] Create a branch from clean `main`.
- [ ] Locate the responsible source files.
- [ ] Add or update focused regression tests.
- [ ] Apply the smallest code fix.
- [ ] Run targeted tests and `npm run build`.
- [ ] Commit, push, open PR, merge after checks/deploy are green.
- [ ] Retest the failing production flow after deploy.

If an issue is infrastructure-only:

- [ ] Mark it deferred.
- [ ] Include timing and evidence in the report.

### Task 6: Final Report

- [ ] Update production run notes.
- [ ] Save the structured QA report.
- [ ] Summarize pass/fail by category.
- [ ] List top issues, fix status, and remaining risks.
- [ ] Confirm final git status.
