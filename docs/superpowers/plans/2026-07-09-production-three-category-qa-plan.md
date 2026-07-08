# Production Three Category QA Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `qa` and `browser:control-in-app-browser` to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish production QA for the three unfinished explorers.earth categories: Places, Guides, and Music.

**Architecture:** Treat this as black-box production QA first. Only move into code investigation when a production behavior is reproducible and appears fixable in the frontend or app code.

**Tech Stack:** explorers.earth production, logged-in in-app browser session, React app, GitHub ship workflow if fixes are needed.

---

## Scope

The earlier production pass already covered Movies, Books, Games, People, Products, and Apps & Tools end-to-end. This plan covers only the remaining three categories:

- Places
- Guides
- Music

Infrastructure latency is known and out of scope for this pass unless it produces an application-visible failure.

## QA Matrix

### Task 1: Places

**Files:**
- Report: `.gstack/qa-reports/qa-report-explorers-earth-2026-07-09-three-categories.md`

- [ ] Load `/places` and confirm the page hydrates without a white screen.
- [ ] Open the add location flow.
- [ ] Submit empty form and record validation messages.
- [ ] Type a free-text location and confirm it does not produce the old misleading `List Name is Required` error.
- [ ] Select a real Google Places autocomplete suggestion if available.
- [ ] Complete creation with title/location, note/description, URL, and slug where supported.
- [ ] Confirm post-create state: detail page, draft/publish prompt, or visible created location.
- [ ] Open Manage/Edit controls and verify edit, draft/private, share/QR, and delete controls are visible without using destructive actions.
- [ ] Verify browser back/forward and reload keep the page usable.
- [ ] Check console errors after each major step.

### Task 2: Guides

**Files:**
- Report: `.gstack/qa-reports/qa-report-explorers-earth-2026-07-09-three-categories.md`

- [ ] Load `/guides` and confirm page hydration.
- [ ] Open `Create Guide`.
- [ ] Test required validation on the first wizard step.
- [ ] Select guide type and location suggestion if available.
- [ ] Complete all wizard steps with realistic QA content.
- [ ] Confirm guide detail/draft state after creation.
- [ ] Add or verify guide child content where the UI supports it.
- [ ] Open Manage/Edit controls and verify publish/privacy/share surfaces without destructive actions.
- [ ] Verify browser back/forward and reload keep the page usable.
- [ ] Check console errors after each major step.

### Task 3: Music

**Files:**
- Report: `.gstack/qa-reports/qa-report-explorers-earth-2026-07-09-three-categories.md`

- [ ] Load `/music` and confirm current Local Tunes state.
- [ ] Record exact visible error text and console/network errors.
- [ ] Look for any available retry, reconnect, or create controls.
- [ ] If creation is available, create a QA music list and add 5 realistic items.
- [ ] If creation is blocked, investigate the app-side code path for the sync/database error.
- [ ] Classify the blocker as frontend-fixable, backend/service, auth/session, or third-party integration.
- [ ] Verify mobile viewport does not hide the error or recovery controls.

## Plan Review

Coverage is intentionally deeper than a happy-path smoke test. Places and Guides both depend on location autocomplete, so the plan separates free-text validation from real suggestion selection. Music is allowed to stop at blocker classification if the page cannot expose create controls because of Local Tunes/database sync failure.

Known risks:

- Slow production operations may require long waits and should not be mistaken for failures.
- Google Places suggestions may depend on third-party script loading and account/API configuration.
- Music may be blocked by backend or external service state outside frontend code.

## Completion Criteria

- Every row in the QA matrix is marked pass, fail, blocked, or not applicable.
- Any reproducible frontend/code-side bug has a minimal fix, a local regression test where practical, and a production retest after deploy.
- The final report clearly says whether each of Places, Guides, and Music is fully working, partially working, or blocked.
