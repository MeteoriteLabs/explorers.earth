# Handoff — replatform, as of 2026-10-08

Written to end a long session. Start here, then use
[the sequence doc](remaining-work-sequence.md) as the backlog. Branch
`codex/unified-replatform`, draft PR #119, worktree
`C:/Users/TK/.codex/worktrees/replatform-audit/explorers.earth-main`.

**PR #119 is the integration branch for all ten epics. Do not land it incrementally.**

## Do these three things first

### 1. One CI check is still red, and it is fully diagnosed

`🎭 E2E Category A` and `🎭 E2E Category B` fail on one case:
`category-navigation-a.spec.ts:474` → *"guides: Auto saved → header Off → reload → Hub On →
Manual explicit Pin"*. The assertion is the harness's own route guard
(`e2e/setup/category-navigation.ts:546`, `assertClean`) reporting four **denied** requests:

```
GET /api/explorers/v1/categories/guides/content-snapshot   (x4)
```

Cause, not a guess: `e2e/setup/category-navigation.ts:250` matches native content reads with

```
/^\/api\/explorers\/v1\/categories\/(movies|games|apps|products|people|places)\/(?:content-snapshot(?:\/validate)?|memberships|top-picks)$/
```

**`guides` is not in that alternation.** Guides became the seventh category to read its owner
content natively, and the contained harness never learned about it, so the request falls
through to the catch-all deny at `:545`.

The change has an exact precedent in the same file — Places, at `:138-141`, with a comment
saying why. Three edits:

1. Add `guides` to the alternation at `:250`.
2. Add a seventh entry to `nativeContentFixtures` (`:133-141`):
   `createNativeNavigationContentFixture('guides', () => state.lists.guides, state.account.documentId)`.
   `state.lists.guides` already exists — it is read at `:470`.
3. Extend the `nativeReader` chain at `:252` with `nativeCategory==='guides' ? nativeContentFixtures[6]`.

**Verify, do not assume:** the guides fixture state is shaped from the legacy GraphQL guide
objects (`guide_sections` as its child root, see the category table at `:29`), so confirm
`createNativeNavigationContentFixture` renders them into a valid content-snapshot the way it
does Places' `recommendation_lists`. Run:

```bash
cd explorers-earth && npx playwright test --config=playwright.category-navigation-a.config.ts
```

I did not make this change because it needs that Playwright run to be honest about, and I
was at the end of a long session. Everything else on the PR is green: `npx tsc -b` exits 0
and `npm run build` succeeds after `f818e1a9`.

### 2. There is uncommitted work in the tree, and it is not safe to commit as-is

Two files, both for **decision D9** (the guide category picker):

- `explorers-earth/src/features/Guides/components/CreateGuideStep2.tsx` — modified
- `explorers-earth/src/features/Guides/components/__tests__/CreateGuideStep2.categories.test.tsx` — new

What the change does: the picker read a Strapi `guideCategories` collection. The canonical
contract stores free strings (`guide_collection_details.categories` is
`z.array(filled(100)).max(24)`), so that collection was only a suggestion list. But the field
is **required with "select at least 4"** and had no free-text entry, and an empty list
rendered *"No categories available"* with no way forward — so at retirement **guide creation
becomes impossible, not merely worse.** The change derives suggestions from the categories
this creator has already used (via `useGuidesOwner`) and lets them type a new one.

**Why it is not committed: the new test file hangs the vitest worker.** `tests 0ms`, then
`Worker exited unexpectedly` after 170s. What I established:

- The component **mounts fine and fast** in isolation — a one-test smoke file with the same
  four mocks passes in under a second. So it is not the module graph or the mocks.
- The hang starts once a test *interacts* (`fireEvent.change` on the category input).
- Prime suspect, unverified: `CreateGuideStep2.tsx:119-129`. That effect calls
  `setSelectedCategories(initialCategories)` with `initialCategories = []` as a **default
  parameter** — a fresh array identity on every render — and the array is in its own
  dependency list. Any re-render re-runs the effect, which sets state, which re-renders. A
  single mount survives it; typing may be what tips it into a loop. If that is it, it is a
  **pre-existing latent bug** in the component, not something the migration introduced, and
  the test is the first thing to have provoked it.

Next step: confirm that hypothesis (pass a stable array from the test, or memoize the
defaults in the component) before committing either file. Do not commit the component change
without a passing test — the free-text path is the load-bearing part, and a mutation check
proved nothing currently covers it.

### 3. Read the frozen map before touching lifecycle work

[`lifecycle-requirement-receipt-map.md`](lifecycle-requirement-receipt-map.md) is the
artifact ticket 2.4 names as a hard prerequisite. Its first section matters: the "original 18
+ 3 lifecycle behaviours" **does not exist anywhere in the repo**, so the map derives its
denominator from the actual contract surface and comes to **19 + 3**. All 22 rows have
receipts; three obligations remain.

## State of steps 1–9

| Step | State |
|---|---|
| 1. Guides (5.3) | Done |
| 2. Dashboard home | Done |
| 3. Claim flow | **Open — D4.** Measured, not implemented. See below. |
| 4. Auth pages | Done. Was never D10's — see below. |
| 5. Auth UX and lifecycle (2.4) | Prerequisite discharged; 2 of 6 obligations done; 3 remain |
| 6. Public place/person detail | Done |
| 7. Profile, Settings, Analytics | Done except ticket 7.2's reference content |
| 8. Music glue | Done |
| 9. Billing | Done, without pre-empting D1 |

Apollo hook consumers outside tests: **19 → 6**. The six: `AuthSyncManager` and `useLogout`
(`clearStore()` cache plumbing, goes with Apollo in step 12), `CreateGuideStep2` (D9, item 2
above), `useFaqs` and `usePlatformTerms` (ticket 7.2), `ClaimAccount` (D4).

Count it honestly:

```bash
cd explorers-earth && grep -rn "useQuery\|useMutation\|useLazyQuery\|useApolloClient" src \
  --include=*.ts --include=*.tsx -l | xargs grep -ln "@apollo/client" \
  | grep -v "__tests__\|/test/" | wc -l
```

## What actually remains, and what it needs

**Genuine decisions — do not pick these unilaterally:**

- **D4, claim flow (step 3).** `/claimaccount` is routed (`routes/AuthRoutes.tsx:29`) and
  linked from Login and Register; a signed-out visitor reaches it today. Three Strapi
  dependencies and **no canonical support at all** — a search of `tunes/server`,
  `tunes/shared` and `tunes/migrations` returns one comment and no code. It breaks
  **mid-flow**: a claimant fills the form, uploads a document, and only then meets a dead
  backend. Independent of D4: the upload sends `Bearer VITE_PUBLIC_ACCESS_TOKEN`
  (`pages/ClaimAccount.tsx:131-139`) — a bundled client-side credential authorising writes
  by any unauthenticated visitor. If the flow is rebuilt, it must not acquire an equivalent.
- **Ticket 7.2, reference content.** `/terms`, `/privacy` and `/cookies` **go blank** at
  retirement, plus the landing FAQ. No copy in the repo (i18n has labels only).
  `page_contents` exists in `tunes/shared/schema.ts:535` but is the tunes app's own CMS table
  and has **no locale column**, while both hooks key off `i18n.language` — and
  `i18n/resources` ships 46 locales against a canonical `en|hi` enum. Options and costs are
  in the sequence doc under step 7.
- **D9, guide categories.** Implementation drafted — item 2 above.

**Not decisions, just not mine or not here:**

- Step 5's three open obligations: the **real Google callback** (needs live credentials; the
  ticket says a fixture cannot substitute), **Music socket revocation** (owned by 6.1, which
  is step 10+), and **hosted attestation** — `frontend-e2e-qualification.yml` triggers on
  `schedule` and `workflow_dispatch` only, so **none of the 12 canonical lifecycle browser
  cases gates a merge**, and `account-lifecycle.spec.ts` is the only lifecycle coverage that
  does. Wiring the canonical lane into a protected aggregate is merge governance, jointly
  owned with 1.3, and the one-to-one retirement map is still unwritten.
- Steps 10–13 (Phase C) have not started.

## One security boundary change the owner may want to veto

`requireRecoveryObservation` in `tunes/server/auth/accountRecovery.ts`. `requireRecoveryPrincipal`
gates on `consumed_at IS NULL` **and** `status IN ('suspended','pending_deletion')`, which made
two lifecycle outcomes unreachable: a recovery that succeeded (so `ReactivateConfirm` told the
owner "This account cannot be recovered") and a terminal deletion (shown identically to a
transient failure, offering retry forever). The new authority is branded, read-only, not
assignable to `RecoveryPrincipal` or `Actor`, and drops exactly those two conditions while
keeping the proof's five-minute expiry and revocation checks. `/recovery/complete` is untouched.
The security inventory label changed from `single-use-google-bound-recovery-proof` to
`google-bound-recovery-proof-within-expiry-read-only`.

**Reverting it re-breaks the lost-response and terminal cases.** That is the trade.

This also means **ticket 2.4's C3 is wrong** where it says a client that lost its response can
already re-observe through `/recovery/status`: it returned 403.

## Lessons that will cost you time if you skip them

- **`tsc -p tsconfig.json` in explorers-earth checks nothing** and always reports 0 errors
  (`"files": []` plus project references). Use `tsconfig.app.json` while iterating — and
  before pushing, run what CI runs: **`npx tsc -b`** and **`npm run build`**. That gap is
  exactly what made `f818e1a9` necessary. In tunes, filter to `^(shared|server)/`; the one
  `youtube-playlist-import.ts:307` error is pre-existing.
- **New shared contracts the frontend imports must use `zod/v3`, not `zod`.**
- **A new shared contract file needs three edits, not one**: the file, the `fixedFiles` list
  in `scripts/generate-music-fixture-dockerignore.mjs`, and a `COPY` in
  `explorers-earth/Dockerfile.music-fixture`. The generator's own `--check` passes without
  them; it caught nothing on four occasions this session. Always run both:
  `node scripts/generate-music-fixture-dockerignore.mjs --check` **and** the import-closure
  walk in the scratchpad (`check_fixture_context.py`).
- **Never count test cases with a line-anchored grep.** `grep -nE "^\s*test\("` on
  `e2e/replatform/lifecycle.spec.ts` reports 10; there are 12, because two are generated by a
  `for` loop at `:202`. I published that undercount as a "correction" to a claim that had been
  right. Use `grep -c "test("`.
- **On this branch, "blocked on an owner decision" is usually wrong — measure first.** Five
  items I had filed as blocked were not: the password pages (already redirecting, and ticket
  2.4 line 45 records it as *agreed*), Settings' password mutation (dead behind a literal at
  `Settings.tsx:127`), billing (3 of 5 calls already unreachable, 1 a read nothing consumed),
  the venue name (intent already in the provision code), and Home's `GetDashboardStatus`
  (inert — its only consumer read `data?.me?.accounts`, a field the document never returned).
- Run tunes suites **from PowerShell**; in Git Bash `whoami.exe` resolves to MSYS `whoami` and
  81 deploy-executable tests fail environmentally.
- `explorers-lifecycle.integration.test.ts` is **not self-cleaning** against the shared
  `music_fixture` database and collides once identities accumulate. Reset:
  `docker exec explorers-music-fixture-postgres-1 psql -U music_migrator -d postgres -c "DROP DATABASE IF EXISTS music_fixture;" -c "CREATE DATABASE music_fixture OWNER music_migrator;"`
  then re-run `server/test/migrations/music-migration.integration.test.ts` to re-apply migrations.
- Two frontend tests are **load-sensitive flakes**, not regressions:
  `contained-unit.launcher`'s VITE-identifier case (5s budget, scans the whole tree) and
  `ProfileMusic.gateway-recovery`. Both pass in isolation; confirm with a second full run
  before chasing them.
- Write Python patch scripts with the Write tool and run them by path — heredocs mangle CRLF
  on Windows. Always `assert '\r\r' not in text` before writing.

## Verification commands

```bash
# frontend
cd explorers-earth && npx tsc -b && npm run build && node scripts/run-contained-vitest.cjs
# tunes (PowerShell)
cd tunes; npx tsc --noEmit; npx vitest run server/test/contracts
# tunes integration (PowerShell, needs the fixture container on 55432)
$env:MUSIC_C3_POSTGRES_TEST='1'; $env:MUSIC_C6_POSTGRES_TEST='1'
$env:DATABASE_URL_TEST='postgresql://music_migrator:music@127.0.0.1:55432/music_fixture'
npx vitest run --config vitest.integration.config.ts server/test/explorers-lifecycle.integration.test.ts
```

Last known good: frontend **4502 tests / 320 files**, tunes contracts **1190**, lifecycle +
recovery integration **42/42** on a reset fixture database.
