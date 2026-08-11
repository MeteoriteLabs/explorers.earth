# explorers.earth — Consolidated Bug Report (2026-07-25)

Environment: Production `https://explorers.earth`, logged-in TK account, in-app browser.
Scope: full E2E across all categories + guides + the public shared page.
Companion detail: `qa-report-explorers-earth-2026-07-25-comprehensive-e2e.md`.
Status legend: FIXED (committed) · OPEN (recorded, not fixed — per your call to discuss/solve together).

---

## CRITICAL / HIGH

### BUG-1 — Public list-detail CRASHES for a shared place list ("Something went wrong")
- Severity: HIGH. Status: OPEN.
- Where: public shared page, Places list detail. `explorers.earth/tandavkrishna/...` → open the
  "Bengaluru" list (the one created this session, 5 places).
- Symptom: full-page error boundary "Something went wrong / error loading this page" (Reload / Go Home).
  Anyone you share this list link with sees a broken page.
- Console: `TypeError: i.toFixed is not a function` (caught by ErrorBoundary), in `index-B_dazW6O.js`.
- Root cause (CONFIRMED in code): `explorers-earth/src/features/PublicHome/components/PublicPlaceCard.tsx:109`
  renders `★ {rating.toFixed(1)}`, guarded only by `rating !== undefined` (line 107). When `rating`
  is a STRING (which the new add-place flow supplies — the googleRating shows as text like "8.8"),
  it passes the `!== undefined` guard and `.toFixed()` throws `TypeError: i.toFixed is not a function`,
  which the ErrorBoundary turns into the full-page crash. Old data works: "Hyderabad" (Cafe Bahar,
  numeric ★4.2) opens fine; only my new Bengaluru places crash. (`PlaceOverview.tsx:48` avoids this
  by doing `(googleRating * 2).toFixed(1)`, which coerces to number — PublicPlaceCard does not.)
- Scope check: Movies public detail works fine — specific to the public Places card + string rating.
- Fix: in `PublicPlaceCard.tsx`, coerce/guard: `typeof rating === 'number'` or `Number(rating)` with a
  `Number.isFinite` check before `.toFixed(1)`; and store the rating as a number in the add-place flow.

### BUG-2 — Guide activity photos never persist ("images don't come back after adding a day")
- Severity: HIGH. Status: FIXED on branch (commit `020fd01`), needs deploy.
- Where: Guides → add a day/stop → add an "activity" place → save.
- Symptom: activity cards render `placehold.co/400x400` after reload. Confirmed twice live (Leh
  guide Day 1; fresh Jaipur guide Day 1 "Amber Fort" — placeholder even after uploads returned 201).
- Root cause: `GuideSectionForm.tsx` fired `fetchAndUploadActivityPhotos` fire-and-forget;
  `handleSubmit` serialized `activityPlaces` without awaiting the Google→S3 uploads, so `photos:[]`
  is persisted. Waiting for the network is NOT a reliable workaround (the React state update races
  the save).
- Fix (committed): track upload promises, return uploaded photos, await + merge before serializing;
  also reset activityPlaces on create-mode reset. `tsc`/`eslint` clean.
- Note: pre-existing placeholder guides won't self-heal (stored photos already empty) — needs a
  backfill, or re-add the place.

---

## MEDIUM

### BUG-3 — Create-a-list does not open INTO the new list (dumps you back on the dashboard)
- Severity: MEDIUM (UX). Status: OPEN. (This is the one you flagged.)
- Where: every category. Create List / Add Location → after "Create", the modal closes and you land
  on the category DASHBOARD, not inside the new empty list. You then have to scroll-hunt for it
  (worse because list titles are truncated — see BUG-11). Confirmed on Places, Movies, Books.
- Expected: after creating a list, navigate into that list's detail so you can start adding items.
- Fix direction: on successful create, route to the new list's detail (id/slug) instead of staying
  on the dashboard.

### BUG-4 — Guide wizard loses the selected location ("Please select a location")
- Severity: MEDIUM. Status: OPEN.
- Where: Create Guide → Step 1. Pick a city from Google autocomplete; the text stays in the field
  but Next fails with "Please select a location for this guide". Retrying (re-pick, then Next) works.
- Reproducibility: HIGH — hit EVERY guide this session (Jaipur, Udaipur, Delhi, Agra, Goa), single-
  and multi-city (both Start and End points). Same class as BUG-5.
- Root cause: the selected-place object from the autocomplete isn't reliably held in form state
  (mouse-click selection races the form). Fix: bind onPlaceChanged to set/validate the place object;
  disable Next until a real place is selected.

### BUG-5 — Places "Add Location" (list create) intermittently no-ops silently
- Severity: MEDIUM. Status: OPEN.
- Where: Places → Add Location → pick city → Add Location. First attempt often does nothing (modal
  stays open, no toast, no navigation, no network call). Retry creates it.
- Root cause: `useCreateLocation.ts` — the Google Places-details fetch + photo upload run BEFORE the
  try/catch, and the mutation's `catch` swallows errors (no toast, no log). No submit loading state,
  no "select a place" guard. So any failure = silent dead-end.
- Fix direction: guard submit until a place is chosen; wrap the whole flow in try/catch with a
  `toast.error`; add a button loading state.

### BUG-6 — Product URL-scrape pulls the wrong price
- Severity: MEDIUM (data). Status: OPEN.
- Where: Products → Add via URL → paste an Amazon link → Fetch. Title/brand/description/images
  scrape correctly, but PRICE is wrong (Sony WH-1000XM5 scraped as EUR 16.7 vs ~$399) and currency
  defaults to EUR. Had to correct manually.
- Fix direction: fix the price/currency parser for Amazon; validate scraped price is plausible.

---

## LOW / observations

- BUG-7 — Movies search fails when a year is appended ("Dune 2021" → No results; "Dune" works).
- BUG-8 — Games item "Category" dropdown has no selectable options (only "Select Category").
- BUG-9 — Manual-added Products & People have NO image (green/placeholder) unless you upload one;
  URL/API-added items get images. Inconsistent, reads as broken.
- BUG-10 — Guide Step-2 category multiselect sometimes closes after the FIRST pick (must reopen).
- BUG-11 — Dashboard truncates list titles to ~2-3 chars ("Mi…", "Co…"); hard to tell lists apart.
- BUG-12 — Duplicate list names allowed with no de-dup warning (created two "Mind-Bending Sci-Fi").
- BUG-13 — Public page "Share" button produced no visible modal/toast in-browser (may use native
  share API / clipboard). NEEDS VERIFICATION on a real device.
- OBS-14 — Some Google Books editions return Google's own "image not available" cover (Google data
  gap, not an app bug — verified the URLs).
- PERF-15 — Production save latency ~10-20s per item (backdrop/photo upload + GraphQL). Infra
  (RDS/distance), not a code bug, but makes content creation slow.

---

## Verified WORKING / not reproducing (so we don't chase ghosts)

- Public profile page: loads, shows all PUBLISHED content, DRAFTS correctly hidden, all 25 profile
  thumbnails load (0 broken). Publish gating works.
- Public detail — Movies list + individual movie modal (Creator's Note, Creator's Rating, cast
  photos all load). Places "Hyderabad" (old data) loads. Guides publish and appear.
- Cast photos: placeholder in the ADD FORM but they DO load on the public detail — not a real bug.
- Guide Step-2 "picker instability" from the 2026-07-09 run does NOT reproduce (appears fixed):
  months/budget/categories persist through all interactions.
- Add-recommendation flows (Movies/Books/Games/Apps/Products/People) and the guide add-day flow all
  create + persist + render images on reload.

---

## Suggested priority order to fix
1. BUG-1 (public place list crash — breaks sharing) — small, high impact.
2. BUG-2 (guide activity photos — already fixed, deploy it).
3. BUG-3 (create → open into new list — UX, affects every category).
4. BUG-4 / BUG-5 (guide + places location submit reliability — same class).
5. BUG-6 (product price scrape).
6. The LOW batch as cleanup.
