# Handoff — replatform, as of 2026-10-08

Written to end a long session. Start here, then use
[the sequence doc](remaining-work-sequence.md) as the backlog. Branch
`codex/unified-replatform`, draft PR #119, worktree
`C:/Users/TK/.codex/worktrees/replatform-audit/explorers.earth-main`.

**PR #119 is the integration branch for all ten epics. Do not land it incrementally.**

## Read these three first — two are closed, and how they closed is the useful part

Items 1 and 2 were open when this document was written and are now done. They are kept
because each one failed in a way that will recur: a fix that looked like one line and was
three, and a check that passed because the check was broken.

### 1. CI is green again, and the guides E2E fix needed three things, not one

Both `🎭 E2E Category A` and `🎭 E2E Category B` failed on the same cause and share the same
harness, so one fix covered both. It took more than the one-line change I first wrote down
here, which is worth recording because the first two attempts each looked right and changed
nothing:

1. **The allowlist regex** at `e2e/setup/category-navigation.ts:250` matched native content
   reads for `movies|games|apps|products|people|places`. Guides became the seventh, so its
   `content-snapshot` fell through to the catch-all deny. Added `guides`, plus a seventh
   `nativeContentFixtures` entry and its arm in the `nativeReader` chain - the shape of
   change Places already had at `:138-141`.
2. **The guide aggregate read was still denied.** `GET /collections/:id/guide` is addressed by
   collection id with **no category in the path**, so the category regex could never match it
   and my new fixture branch was never reached. The editable-list read has exactly this
   property and its own dispatch, so that predicate now covers `(?:editable|guide)`.
3. **The DTO rejected my fixture.** `guideAggregateDtoSchema.revision` is a number; I passed a
   string. The fixture serves an empty guide - the same default the service returns for a
   collection with no details row - because this lane exercises navigation and pinning, not
   guide content.

Verified locally, not inferred: the guides case passes in 23s, and the whole Category A lane
is **19/19** so the other six categories are undisturbed.

### 2. D9 is done — the uncommitted work is committed

Landed in `f84f96df`. The guide category picker now suggests the categories this creator has
already used and accepts anything typed; it invents no vocabulary, because which category
names exist is product copy.

Two things that came out of it are worth carrying forward:

- The test hang was a **latent render loop**: `initialCategories` and
  `initialBestTimeToVisit` defaulted to inline `[]`, a fresh identity every render, and the
  prop-sync effect lists both in its dependencies. Mounting survived it; the first
  interaction did not. The defaults are module-level constants now. It was never live - the
  single caller passes stable `formData` references - so only a caller omitting those props
  could reach it. **If another component in this codebase syncs props to state with array
  defaults, it has the same bug.**
- My first mutation check reported all 5 tests passing with the free-text affordance removed,
  which would have meant the load-bearing path was uncovered. The check itself was broken:
  the patch script's `replace()` silently no-opped because the pattern had shifted and I had
  omitted the `assert`. **Always assert the mutation applied**, or a no-op reads as coverage.

### 3. The legacy retirement map is written — read it before touching the lifecycle lanes

[`lifecycle-legacy-retirement-map.md`](lifecycle-legacy-retirement-map.md) maps each of the
**11** executing legacy cases to its canonical replacement, which C4 required before
`account-lifecycle.spec.ts` can be retired. Two rows are clean **gaps** and five are
**partial**, each with the specific assertion needed. `:219` — "unresolved lifecycle authority
fails closed before any destructive control", which exists because that regression actually
happened — has no canonical equivalent at all. Do not retire that one.

### 4. Read the frozen map before touching lifecycle work

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
| 7. Profile, Settings, Analytics | Done. Ticket 7.2's reference content landed 2026-10-08 |
| 8. Music glue | Done |
| 9. Billing | Done, without pre-empting D1 |

Apollo hook consumers outside tests: **19 → 2**, and the milestone is sharper than the
number. The two left are `AuthSyncManager` and `useLogout`, and both hold nothing but
`apollo.clearStore()` — cache plumbing that goes with Apollo in step 12. So as of 2026-10-08
**the frontend makes no Strapi read or write through Apollo at all.** `CreateGuideStep2` went
with D9, `ClaimAccount` with the claim-flow containment, and `useFaqs`/`usePlatformTerms`
with ticket 7.2.

What that does **not** mean is that the frontend is off Strapi — see the REST note in the
sequence doc, which the 2026-10-08 recount found to be wider than the four files recorded
there.

Count it honestly:

```bash
cd explorers-earth && grep -rn "useQuery\|useMutation\|useLazyQuery\|useApolloClient" src \
  --include=*.ts --include=*.tsx -l | xargs grep -ln "@apollo/client" \
  | grep -v "__tests__\|/test/" | wc -l
```

## What actually remains, and what it needs

**Nothing here is waiting on a decision any more.** All three that were are taken:

- **Ticket 7.2 — done** in `cc9f3e4b`. The copy lives in the repo at
  `explorers-earth/src/content/reference/<locale>.json` behind `useReferenceContent`;
  `useFaqs` and `usePlatformTerms` delegate to it and `LandingPage/api/queries.ts` is gone.
  Ten locales, which is what Strapi actually had — not the i18n bundles' 47.
- **D9, guide categories — done** in `f84f96df`. Suggestions come from the creator's own
  history and the field accepts anything typed, so no vocabulary was invented.
- **D4, the claim flow — the part that was mine is done** in `dfb16b35`, and my earlier
  description of it here was wrong. It does **not** break mid-flow after a document upload:
  the verification step is reachable only after a successful search, and the search is a
  Strapi read, so the flow never reaches an upload. What it did was fail at the door with a
  **misleading** message — "No account found with the provided details" — telling an owner
  whose place is claimable that it is not. That now says the feature is unavailable and
  explicitly that this does not mean the place is unclaimable, reaches no network, and no
  longer carries `Bearer VITE_PUBLIC_ACCESS_TOKEN` to Strapi's `/upload`.

  **Still D4's**, and unchanged: whether a canonical claim flow is rebuilt and in what shape
  — 18 MISSING fields, no table, no route, no contract. If it is, an unauthenticated document
  upload needs a server-issued, single-use, purpose-bound grant, the way recovery proofs do.

**Not decisions, just not mine or not here:**

- Step 5's three open obligations: the **real Google callback** (needs live credentials; the
  ticket says a fixture cannot substitute), **Music socket revocation** (owned by 6.1, which
  is step 10+), and **hosted attestation** — `frontend-e2e-qualification.yml` triggers on
  `schedule` and `workflow_dispatch` only, so **none of the 12 canonical lifecycle browser
  cases gates a merge**, and `account-lifecycle.spec.ts` is the only lifecycle coverage that
  does. Wiring the canonical lane into a protected aggregate is merge governance, jointly
  owned with 1.3. The one-to-one retirement map is now written
  ([`lifecycle-legacy-retirement-map.md`](lifecycle-legacy-retirement-map.md)) and found
  2 clean gaps and 5 partials across the 11 legacy cases, so retirement is blocked on
  coverage as well as on gating.
- Step 10's **classification is done** (2026-10-08) —
  [the server-side Strapi classification](strapi-server-classification.md), plus the named
  static scan `scripts/check-retired-dependencies.mjs`, wired into `tunes.yml`. Headline: no
  reachable canonical path touches Strapi and canonical startup needs no `STRAPI_*`; the
  "55 files" was never the denominator, and most of the volume is `strapi_*` **columns**
  (data about a retired system, not calls into one). `strapiOrigin` needs no loosening — it is
  legacy-path only. What is left of 8.1a is three owner items (compose `${VAR:?}` loosening,
  the `music-reconcile.yml` cron disablement, an executed boot receipt) and one small move.
- **New live defect found there, owned by 3.4, not by retirement** — the analytics events
  panel is empty for every signed-in owner, because its read is gated on an auth-store token
  canonical auth never sets. **The false message is fixed** (it said "No Analytics Data" and
  advised sharing QR codes; it now reports the read as unavailable, says that does not mean
  no visitors, and reaches no network). **The repoint is scoped, not done:** seven of the
  twelve charts want a cross-tabulation `AnalyticsSummary` does not carry, and
  `analyticsQuerySchema` has no `page` or `element` filter, so it needs a contract decision
  about which breakdowns are worth keeping. Table in the classification doc, section D.
- **A fixture hid that defect behind a green suite, and the lesson generalises.**
  `AnalyticsDashboard.test.tsx` seeds `token: 'private-user-token'`, which production never
  issues, so every existing test ran the path no real owner is on. If another suite seeds a
  token or credential, check whether canonical auth actually issues it.
- Steps 11–13 (rest of Phase C) have not started.

## Owner decisions taken on 2026-10-08

**Ticket 7.2 — the legal copy lives in the repo.** TK chose the repo option. Done: the FAQ
and the Terms/Privacy/Cookie bodies are at `explorers-earth/src/content/reference/`,
locale-keyed, and `useFaqs`/`usePlatformTerms` read them instead of Strapi. See the section
below for what the export showed, including one thing that needs TK's eyes.

**`requireRecoveryObservation` stays.** TK chose keep, so the read-only observation
authority in `tunes/server/auth/accountRecovery.ts` is settled and no code changed. The
lost-response and terminal-deletion cases keep working. Ticket 2.4's C3 is corrected in
place: it claimed a client that lost its response could already re-observe through
`/recovery/status`, and before this authority existed that returned 403.

## Three things that need your acknowledgement, not engineering

Each of these looked like unfinished work and is not. They are recorded so nobody spends a
session rediscovering it.

1. **Ticket 3.4, analytics attestation.** The lane exists, is contained, and is already in the
   nightly workflow; `suite-manifest.json` records \"Analytics acceptance\" as pending by
   design, and `scripts/replatform-e2e.mjs` *runs and receipts* every listed lane on each
   invocation. Promoting it means producing that receipt, which needs the explicit
   `TASK4_FIXTURE_OWNED_DISPOSABLE_PG15` acknowledgement: `cd tunes && npx tsx
   scripts/analytics-browser-fixture.ts`. Hand-adding the lane would falsify an attestation.
2. **Ticket 2.4, the real Google callback.** Needs live provider credentials. The ticket is
   explicit that a fixture cannot substitute.
3. **Ticket 7.2 is decided and built — but read what the copy actually says.** Decided for
   the repo, migrated verbatim from the live Strapi collections, 23 tests, three mutations
   killed. Two things the export surfaced that are **yours, not engineering's**:

   - **The live legal copy is placeholder-ridden.** It is titled "Terms and Conditions for
     **LocalQR**" and contains unfilled template slots: `[your app URL]`,
     `[Your Company Name]`, `[Your Country/State]`, a contact address of
     `hello@localqr.earth`, a website of `www.localqr.earth`, and an effective date of
     10th Sept 2025. This is what explorers.earth serves **today** — the migration did not
     introduce it and deliberately did not fix it, because rewriting the operative text of a
     legal document is not an engineering call. Replacing the copy is now a one-file edit.
   - **Privacy and Cookie policies exist in English only.** Measured across all ten locales
     Strapi had configured: `Terms_and_Condition` is translated in eight (`bn` and `id` have
     no row at all), `Privacy_and_Policy` and `Cookie_Policy` came back as empty arrays in
     nine of ten, and the FAQ is genuinely translated in all ten. So a non-English visitor
     already saw a blank privacy page before this change. The new module falls back to
     English **per section**, which is strictly better than the Strapi behaviour it replaces,
     but it does not translate anything.

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

## A history discrepancy on this branch — read before trusting `git log`

**Commit `2846157e`'s message does not describe its contents.** Its message is only about a
CI registry rate-limit flake and states "there is no code fix". It actually carries:

- the whole ticket-3.4 analytics honesty fix (`AnalyticsDashboard.tsx`, 48 lines),
- its new test file `AnalyticsDashboard.unavailable.test.tsx` (148 lines),
- the two new `emptyState.unavailable*` i18n keys in `en.json` and `hi.json`,
- and `public/sitemap.xml`, which is **build output** — `npm run build` rewrites it with the
  current date, and it had been deliberately kept out of the preceding commits.

What happened: **two sessions were working this branch at the same time**, and one ran a
stage-everything commit while the other had that work uncommitted in the shared worktree. The
code is correct and was verified — tsc, build, eslint 0 errors, the full suite at 4538/326,
and three mutations confirming the fix fails when reverted — but none of that reasoning is in
the commit that carries it, and the message actively denies a code change.

**Not rewritten, deliberately.** `2846157e` is already on `origin` and another session was
live on the same branch; a rebase or force-push there risks destroying someone else's work.
The rationale lives in the classification doc's section D and in the entry above instead.

**If you run more than one session against
`C:/Users/TK/.codex/worktrees/replatform-audit/explorers.earth-main`, serialize them.** They
share one index and one working tree, so `git add -A` in either one commits whatever the other
is holding, under the wrong message.

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
- **`git checkout -- <path>` cannot undo a mutation to an untracked file.** It fails with
  "did not match any file(s) known to git", and if you are looping over mutations the failure
  is one line of stderr between two passing-looking runs — so the mutations **stack** and the
  file is left corrupt. It cost me two confusing re-runs this session. When mutation-testing a
  file that is new in your working tree, either `git add -N` it first or restore from a copy,
  and always re-run the suite afterwards to confirm you are back to green.
- **`npm run build` in explorers-earth rewrites `public/sitemap.xml`** with the current date.
  It will show up in `git status` as a change you did not make; drop it rather than committing
  it.

## `platform-fixture` flaps on an external registry rate limit — do not chase it

`platform-fixture` (and `music-required`, the aggregate gating on it) failed three times on
2026-10-08 with:

    Replatform local command refused or failed; phase=service-build; cause=registry-rate-limit

That is not a code defect and there is nothing to commit for it. Evidence rather than
inference: the same job **passed** on `5253fcb2` at 12:38 and failed on `c23614db` at 12:53,
and `c23614db` is documentation plus one standalone check script - nothing that pulls an
image. `scripts/replatform-local.ts:246` classifies the cause from
`toomanyrequests|rate.limit|429`, and the script reports and refuses by design rather than
retrying, which is why there is no retry to add.

Remedies, both the owner's: re-run the job once the limit resets, or authenticate the build
to the registry so pulls are not anonymous. If it becomes persistent rather than
intermittent, registry auth is the real fix and needs a secret.

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

Last known good: frontend **4532 tests / 325 files** (measured 2026-10-08, all passing;
the previous 4502/320 figure was stale by then, so do not read the increase as only the 23
new ticket-7.2 cases), tunes contracts **1190**, lifecycle + recovery integration **42/42**
on a reset fixture database.
