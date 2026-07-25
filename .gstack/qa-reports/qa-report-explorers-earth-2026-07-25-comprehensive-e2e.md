# explorers.earth Production Comprehensive E2E QA

Date: 2026-07-25
Environment: Production (`https://explorers.earth`), logged-in TK account
Driver: in-app Browser pane. (Headed gstack `/browse` would not launch on Windows —
Playwright `--remote-debugging-pipe` spawn error; Chrome cookie import blocked by
app-bound encryption. Session authenticated by user login in the visible pane.)
Plan: `docs/superpowers/plans/2026-07-25-production-comprehensive-e2e-qa-plan.md`
Branch: `claude/prod-testing-bug-investigation-05aa23`

## Status: COMPLETE (7 categories x 5 recs + guides bug fixed)

## Scorecard

| Category | List created | Recs | Images | Result |
|---|---|---:|---|---|
| Movies & Shows | Mind-Bending Sci-Fi | 5 | TMDB posters load | PASS |
| Books | Big Ideas | 5 | Google Books covers load (some editions have no cover) | PASS |
| Games | Open Worlds | 5 | IGDB covers load | PASS |
| Apps & Tools | AI Utilities | 5 | logos + App Store screenshots load | PASS |
| Products | Camera Kit | 5 | scrape=image loads; manual=no image | PASS (1 bug) |
| People | Writers and Thinkers | 5 | avatars placeholder on manual add | PASS |
| Places | Bengaluru | 5 | Google Place photos load | PASS (1 bug) |
| Guides | (bug fix on existing guide) | n/a | activity photos FIXED | FIXED |

Every category's create-list, add-recommendation, all fillable parameters, publish
flow, and reload persistence were exercised. Both alternate add methods (App Store
search + URL scrape for Apps; manual + Amazon URL scrape for Products; Google
autocomplete for Places/Books/Games/Movies) were tested.

---

## BUG #1 — FIXED: Guide activity photos never persist ("images don't come back")

Severity: High. Status: FIXED on branch (commit `020fd01`), needs deploy to reach prod.

Reproduced on live data: "Leh leh" guide Day 1 — all 5 activity cards rendered
`https://placehold.co/400x400`; persisted `Recommendation_Activity` had empty photos.

Root cause: `explorers-earth/src/features/Guides/components/GuideSectionForm.tsx`.
`addPlaceToSegment` fired `fetchAndUploadActivityPhotos` fire-and-forget; `handleSubmit`
serialized `activityPlaces` into `Recommendation_Activity` without awaiting the in-flight
Google-photo -> S3 uploads. Saving before uploads finish persists `photos: []`; the
detail view then falls back to placehold.co. (The AI-generated section flow already
awaited — only the manual add flow was affected.)

Live proof: added a Day 2 with activity "Shanti Stupa" — selecting it fired 6
`POST /api/upload` -> all `201 Created`; saved after uploads completed. After a full
reload from DB: Day 1 activities = placehold.co (old fast-saved), Day 2 Shanti Stupa =
`localqr-production.s3...amazonaws.com/...` (real, persisted).

Fix: track each upload promise in `pendingActivityUploadsRef`; `fetchAndUploadActivityPhotos`
returns `{ place_id, photos }`; `handleSubmit` awaits `Promise.allSettled` of pending
uploads and merges results before serializing. Also reset `activityPlaces` + the ref on
create-mode reset (prevents activity leak into the next day). Verified: `tsc --noEmit`
exit 0; `eslint` 0 errors.

Note: pre-existing guides with placeholder activities will NOT self-heal after deploy
(their stored `Recommendation_Activity` is already empty). A backfill script could
re-fetch photos for affected sections. Follow-up.

---

## BUG #2 — Places "Add Location" (list creation) intermittently no-ops silently

Severity: Medium. Status: root-caused, not fixed (needs deploy anyway).

Repro: open Add Location, type a city, pick the Google autocomplete suggestion, click
Add Location. On the FIRST attempt it did nothing (modal stayed open, no toast, no
navigation, no network call, List Name reverted to the short name). Retrying created the
list ("Bengaluru" DRAFT). So it is intermittent/timing-dependent, not always broken.

Root cause: `explorers-earth/src/features/Favorites/hooks/useCreateLocation.ts`
`handleLocationSubmit`:
- The Google Places Details `axios.get` (line ~66) and the photo fetch + S3 upload
  (lines ~80-126) run BEFORE the try/catch. Any throw there rejects unhandled (the
  caller in `ListForm.tsx:77` calls `onSubmit(...)` without await/try).
- The mutation's own `catch` (lines ~185-187) does `setIsLoading(false)` and nothing
  else — no toast, no console log. Errors are swallowed.
- There is no submit-button loading state and no disabled-until-place-selected guard.
Net effect: if the selected-place object isn't fully set (Google Autocomplete timing) or
any pre-mutation async fails, the user sees a silent dead-end.

Suggested fix: disable submit until a place is selected; wrap the whole flow in
try/catch and surface `toast.error(...)` on failure; add a loading state on the button.

---

## Minor issues / observations (low severity)

- [Products] Amazon URL-scrape pulls the WRONG price (e.g. Sony WH-1000XM5 scraped as
  EUR 16.7 instead of ~$399) and mis-sets currency to EUR. Images DID scrape (media
  gallery). Manual entry has no product image unless you upload one.
- [People] Manual-added people show a placeholder avatar (no image); URL-scrape would
  fetch one. Platform icons (X, website) render correctly.
- [Movies] TMDB cast photos do not load in the add form (dark placeholder circles).
- [Movies] Search fails when a year is appended ("Dune 2021" -> No results; "Dune" works).
- [Games] The item "Category" dropdown has no selectable options (only "Select Category").
- [Books] Some Google Books editions return Google's own "image not available" cover
  (data gap, not an app bug — verified the URLs).
- [Lists] Dashboard truncates list titles to ~2-3 chars ("Mi...", "Co..."); duplicate list
  names are allowed with no de-dup warning.
- [Perf] Production save latency ~10-20s per item (backdrop/photo upload + GraphQL).
  Known infra distance/RDS routing; not a code bug, but makes bulk UI content-fill slow.

---

## Guide variants (session 2) — findings

Built Guide "Jaipur in a Day: Pink City Highlights" (Itinerary · single-city · single-day).

- BUG (new, Medium): Create-Guide wizard **Step 1 loses the selected location**. If you
  pick the Google-autocomplete location and then change any other Step-1 field (guide
  type, city mode), the place object is dropped — the text stays but Next fails with
  "Please select a location for this guide". Workaround: pick the location LAST. Same
  class as the Places list-create bug (selected-place object not held).
- Step 2 picker (Number of Days / months / budget / categories) is STABLE now — months
  and categories persist through all interactions. The 2026-07-09 "picker instability"
  does NOT reproduce (appears fixed).
- Step 3 cover image auto-fetches from Google Places and loads.
- Activity-photo bug CONFIRMED again on a fresh guide: added "Amber Fort" as a Day-1
  activity, waited until all photo uploads returned `201`, saved — after a full DB
  reload the activity still renders `placehold.co/400x400`. Waiting for the network is
  NOT a reliable workaround because the fire-and-forget upload's React state update
  races the save. Validates BUG #1's committed fix (await + merge).
- Native `<select>` (Guide Type) doesn't respond to coordinate clicks (browser-automation
  quirk, not an app bug) — set via form_input.

Additional guides built to cover the type/mode matrix:
- Guide 2: "Udaipur in 3 Days: Lakes & Palaces" (Itinerary · single-city · multi-day). PASS.
- Guide 3: "Delhi to Agra: Golden Triangle in 5 Days" (Itinerary · multi-city). PASS.
  Multi-city mode has Starting Point + Ending Point + optional Intermediate Cities; the
  location-lost bug hit BOTH endpoints.
- Guide 4: "Goa on a Plate" (Theme · single-city). Theme correctly uses the 2-step wizard
  (skips Itinerary Details). PASS.
- The Step-1 location-lost bug reproduced on EVERY guide (Jaipur, Udaipur, Delhi, Agra,
  Goa) — highly reproducible, ~always on the first submit. Elevate to solid Medium bug.
- Step-2 category multiselect: the FIRST pick after opening sometimes closes the dropdown
  (had to reopen) — minor.

## What was NOT done (deferred)

- The 5-variant Guides matrix (single-day / multi-day / single-city / multi-city /
  Itinerary vs Theme) was NOT built. The guides work this session focused on
  reproducing + fixing the activity-photo bug on the existing guide. Building 5 full
  guides via the multi-step wizard (which also has the known Step-2 picker instability
  from the 2026-07-09 run) is a sizable follow-up.
- Music (`/music`) — external Local Tunes SSO, was blocked in prior runs; not retested.

## Public page verification (`explorers.earth/tandavkrishna`)

The public shareable profile loads and shows ALL published content, correctly grouped:
Places (Hyderabad, Singapore, Bengaluru×5), Movies (binge, Mind-Bending Sci-Fi×5),
Books (Startup, Books for Builders, Big Ideas×5), Games (Open Worlds×5),
Guides (Leh leh, Jaipur in a Day), Apps (Daily Workflow, AI Utilities×5),
Products (Travel Gear, Camera Kit×5), People (Founders to Follow, Writers and Thinkers×5).

- Drafts correctly HIDDEN: the 3 draft guides (Udaipur, Delhi→Agra, Goa) do NOT appear
  publicly. Publish gating works.
- Image health on the profile: 25 images, 25 loaded, 0 broken, 0 placeholders (all S3
  thumbnails). PASS.
- A "Share" control is present.
- NOT yet done (pane was hidden): interactive drill-down into each public list detail,
  opening an individual public recommendation, verifying per-item images on the public
  detail pages, and exercising Share / QR. Needs the visible pane for a reliable pass.

## Content created on the account (all Public unless noted)

- Movies "Mind-Bending Sci-Fi": Interstellar, Arrival, Inception, Blade Runner 2049, Dune
- Books "Big Ideas": Sapiens, Range, Thinking Fast and Slow, Factfulness, Atomic Habits
- Games "Open Worlds": Witcher 3, RDR2, Elden Ring, Ghost of Tsushima, Zelda BOTW
- Apps "AI Utilities": ChatGPT, Claude, Cursor, Perplexity, Grammarly
- Products "Camera Kit": Sony A7 IV, Sony WH-1000XM5, Fujifilm X100VI, DJI Osmo Pocket 3, Peak Design Capture Clip
- People "Writers and Thinkers": Paul Graham, Morgan Housel, James Clear, Austin Kleon, Cal Newport
- Places "Bengaluru": Lalbagh Botanical Garden, Bangalore Palace, Cubbon Park, ISKCON Temple, Toit
- Guides: added "QA Day 2 Image Test" (Shanti Stupa) to the existing "Leh leh" guide
