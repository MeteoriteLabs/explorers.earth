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
- **Step 11 started 2026-10-08. 1.2's route-parity inventory is extended and bound to the real
  app** — [the route-graph invariant](route-graph-invariant.md). The review's "passes
  vacuously" was one level too shallow: the fixture runs `EXPLORERS_API_MODE: legacy-music`
  and serves none of the canonical routes, so the invariant is unsatisfied at its root.
  **`platform:test:routes` now fails in CI as a result, by design** — that is the ticket's
  mandated "failure, not a skip", and reverting is one commit that restores the vacuous pass
  rather than correctness. **An owner decision is needed** because 1.2 asks for the six legacy
  probes *and* canonical routes from one runtime, which is impossible; the three options and
  their costs are in that doc.
- **7.1 re-measured 2026-10-08** — [public parity state](public-parity-7-1-state.md). Three of
  the 2026-10-05 review's four findings are resolved (the overlay is committed with its specs
  migrated; the P0 UUID-as-legacy-subject seam is closed; category coverage is 8 of 9 with no
  ninth to error on, now locked by an enum-driven test). **One is live and is the owner's
  call:** `publicPlaceMedia.ts` still admits any `*.amazonaws.com` host and the Strapi origin,
  so hiding an attachment does not deny its bytes — but tightening it inverts assertions
  `PublicHome.place-image.test.tsx` makes positively, and blanks images that work today. Three
  options in the doc. Full 7.1 parity stays gated on 6.3 by the ticket's own terms.
- 7.3 (the rest of step 11) and steps 12–13 have not started.

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

## 79 of 176 tunes unit test files were in no CI job — counted 2026-10-09

Every tunes job in `.github/workflows/test.yml` runs an **explicit file list**, except the
`contracts` job, which passes a directory. So coverage grows only when someone edits a
list, and the tree has outgrown the lists:

| Directory | Ungated unit files |
|---|---|
| `server/test` (root) | 55 |
| `server/test/publicProfile` | 11 |
| `server/test/explorers` | 5 |
| `server/test/deployment` | 3 |
| `server/test/migrations`, `music`, `integration`, `helpers` | 5 |

**Partly closed:** the `contracts` job now also takes `server/test/explorers` and
`server/test/publicProfile` — 29 files, 277 cases, all passing when added. Directory
arguments were chosen deliberately: a list grows stale, a directory does not. It is safe
because `tunes/vitest.config.ts:24` excludes `*.integration.test.ts`, so a directory
argument cannot pull a database-dependent file into that database-less job.

**Still ungated: the 55 files in `server/test` root, plus deployment and migrations.**
Those were not added in the same change for a reason — the root directory holds files
that gate on environment (`account-recovery.test.ts` and `*.real-tool.test.ts` are
excluded by config, but others skip at runtime), and `server/test/deployment` holds 46
release-authority cases, some of which read the git index and would need checking against
a CI checkout before being made required. Adding them is worth doing and is its own
change, with each file's pass state confirmed first.

## A gate that pins CI's shape is not itself gated

`server/test/deployment/` is in **no** gated selector, so nothing in CI runs it.
`music-image-ci-tests.test.ts` lives there and pins the exact list of integration files
`.github/workflows/test.yml` runs. On 2026-10-08 that list grew from nine to fourteen
(`111466e6`, `4c86ab6b`) and the assertion was not updated; CI stayed green through both
commits and a full local 169-file unit run is what caught it (fixed in `6c6b5634`).

Two consequences worth keeping in mind:

- **Changing `.github/workflows/test.yml`'s selector list means updating that assertion in
  the same commit.** Nothing will remind you.
- Adding a gated selector for `server/test/deployment/` is the real fix. It is a CI-surface
  change of its own and is not done - and note it would newly gate 46 release-authority
  cases, some of which read the git index and would need checking against a CI checkout
  before being made required.

## You can run the integration suites locally, and they need a FRESH database each time

Nothing in the repo says how, and the suites are the only way to verify server work
without pushing. The recipe, which is exactly what `.github/workflows/test.yml:91-105`
does:

```bash
docker run -d --name explorers-pg15-fixture-local   -e POSTGRES_DB=music_fixture -e POSTGRES_USER=music_migrator -e POSTGRES_PASSWORD=music   -p 55432:5432 postgres:15-alpine
```

```powershell
# from tunes/, PowerShell (Git Bash breaks the deploy-executable suites)
$env:DATABASE_URL_TEST="postgresql://music_migrator:music@127.0.0.1:55432/music_fixture"
$env:MUSIC_C3_POSTGRES_TEST="1"   # the workflow sets this too; it is the disposable-DB ack
npx vitest run --config vitest.integration.config.ts <files> --maxWorkers=1 --fileParallelism=false
```

**`MUSIC_C3_POSTGRES_TEST=1` is not an owner decision** — `test.yml:105` and
`tunes.yml:102` both set it. It asserts the target is disposable, which a container you
just created is.

**These suites are not idempotent against a reused database.** Re-running the list
against the same container fails
`explorers-lifecycle.integration.test.ts > keeps a Music-mapped deletion pending …` with
`The Explorer identity conflicts with an existing Music identity`, from
`ensureIdentity`. That is leftover state, not a defect: CI never sees it because it gets
a fresh `postgres:15-alpine` service per run. **Recreate the container before trusting a
result**, and do not debug a failure of this shape until you have.

About 8 of the 15 files skip locally — they gate on environment the local container does
not provide — so a local pass is a weaker signal than CI's, not an equal one. On a fresh
database the list is 7 passed / 8 skipped / 0 failed.

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

## `platform-fixture` has a SECOND failure mode — check the phase before dismissing it

**Read this before the registry-rate-limit section below, because that section says "do not
chase it" and this one is a different failure.**

Observed 2026-10-08/09 on `claude/wave3-auth-lifecycle` and on the base branch:

    Replatform local command refused or failed; phase=receipt-check; authority details redacted.

`phase=receipt-check`, and **no `cause=`** — not `phase=service-build;
cause=registry-rate-limit`. Nothing is being pulled, so the rate-limit explanation does not
apply and re-running on a reset limit is not the remedy.

It is not caused by any branch. Evidence: the job **passed** on `69e0d47f` (the PR #120
merge) and failed on `46274e06` immediately after, and `46274e06` changes
`docs/replatform-audit/HANDOFF.md` and nothing else. A single-markdown-file commit cannot
break a Docker ingress fixture, so this is flaky on `codex/unified-replatform` itself.

**What makes it hard to diagnose is a real observability defect, not the flake.**
`scripts/replatform-local.ts` sets `failurePhase = "receipt-check"` before `check()` and
never updates it before `verifyPlatformIngress`, so the label cannot distinguish a bad
authority receipt from an ingress probe mismatch. The top-level handler then prints only the
phase. The useful messages exist and are thrown - `replatform-route-parity.ts:119-128`
produces `canonical route absent: <path> expected <n> got <m>` - and they contain only paths
and status codes, no authority material. They are discarded anyway.

**Half of that is now done (`44b00775`).** Ingress reports `phase=ingress-check` with a
closed cause set - `canonical-route-absent`, `canonical-handler-mismatch`,
`fixture-route-mismatch`, `fixture-handler-mismatch`, `fixture-identity-boundary`,
`ingress-unreachable`, `unclassified` - modelled on `classifyPlatformBuildFailure` and
tested the same way, with a synthetic secret in each input asserted absent from the output.
Redaction is unchanged: only fixed enum values are ever printed.

**It has now been read, and the answer narrows to one thing.** Run `37865052473`
reported:

    Replatform local command refused or failed; phase=ingress-check; cause=ingress-malformed-body

That is: a probe got **the status it expected** and then `response.json()` threw. So no
route is missing by status code, nothing timed out, and the authority receipt is fine -
one route answered with a body that is not JSON.

The likeliest shape by a wide margin is **the SPA shell**: a route absent from the
fixture falls through to the catch-all, which answers `200` with `index.html`, so the
status assertion passes and only the body gives it away. That is exactly the masking
ticket 1.2's route invariant exists to catch. A dedicated cause now separates it -
`ingress-html-shell`, decided on the response's `content-type` before parsing - so the
next failing run distinguishes "a route is not mounted" from "something truncated the
body".

**What the owner needs to decide, if `ingress-html-shell` is confirmed:** which route,
which needs the probe's path in the output. That is the redaction change described below
and it is still not made.

### What static reading established, and the contradiction it leaves

Port **51474 is the explorers Nginx container**, not the tunes Express app
(`docker-compose.replatform.yml:178` publishes `127.0.0.1:51474:80`;
`explorers-earth/Dockerfile.music-fixture:49` installs
`explorers-earth/nginx.music-fixture.conf`). That config proxies exactly six things, and
against the ten probe paths in `scripts/replatform-route-parity.ts` **only
`/api/music-fixture/readiness` is proxied to tunes.** Everything else - `/api/check`,
`/api/csrf-token`, `/api/user/reactivate`, `/api/explorers/analytics/events`,
`/health/live` and all five canonical probes - falls through to
`location / { try_files $uri $uri/ /index.html; }`.

**But that cannot be the whole story, and the next person should know why before
trusting it.** Two facts contradict it:

1. `platform-fixture` **passed** on `69e0d47f` with this same probe list
   (`b4975654`, which added `CANONICAL_ROUTES`, is an ancestor of it) and with a
   byte-identical workflow - `git show 69e0d47f:.github/workflows/test.yml` matches the
   current file at lines 302-310. So the job demonstrably can pass.
2. The observed cause is `ingress-malformed-body`, which means the **first failing probe
   matched its expected status** and then failed to parse. The first probe is
   `/api/check`, expecting **401**. Nginx serving the SPA would answer 200, which is a
   status mismatch (`fixture-route-mismatch`), not a parse failure.

So either something proxies these paths that is not in the committed Nginx config, or the
probes do not run against the Nginx container at all. Resolving that needs the fixture
running:

```bash
npm ci                                    # root deps FIRST - see below
npm run platform:local -- provision
curl -i http://127.0.0.1:51474/api/check  # 401 means it reaches tunes; 200 + HTML means Nginx
```

**`npm ci` at the repository root is not optional, and omitting it fails in a way that
looks like a code bug.** A fresh worktree has no root `node_modules`, so
`npm run platform:local` resolves a *globally* installed `tsx`, which loads
`tunes/scripts/music-output-redaction.ts` as CommonJS. `import.meta.dirname` is undefined
under CJS, so its line 3 `resolve(import.meta.dirname, "../..")` throws
`ERR_INVALID_ARG_TYPE: paths[0] ... Received undefined` at module load, before any Docker
work happens. CI does not hit this because `test.yml:305` runs `npm ci` at the root before
`:306` and `:307` install the two packages. Same tsx version (4.21.0) either way - the
difference is which copy resolves.

**And on this Windows host the fixture cannot be provisioned at all, for a reason that
has nothing to do with the repository.** With root deps installed, `provision` reaches
`phase=postgres-start` and the container is created but never starts:

    Error response from daemon: ports are not available: exposing port TCP 127.0.0.1:51434
    -> 127.0.0.1:0: listen tcp4 127.0.0.1:51434: bind: An attempt was made to access a
    socket in a way forbidden by its access permissions.

`netsh int ipv4 show excludedportrange protocol=tcp` lists **51342-51441** and
**51442-51541** as excluded ranges, reserved by WinNAT/Hyper-V. The fixture needs
**51434** for its postgres (`replatform-local.ts:13` `PLATFORM_PORT`) and **51474** for
the ingress the route probes hit (`docker-compose.replatform.yml:178`). **Both are inside
excluded ranges**, so no amount of retrying helps.

Options, all the owner's: reserve the two ports (`netsh int ipv4 add excludedportrange
... store=persistent` after a `net stop winnat`), move `PLATFORM_PORT` and the published
ingress port out of the excluded ranges, or accept that this fixture is CI-only on this
machine. Until one of those happens, **`platform-fixture` can only be diagnosed from CI
logs on this host**, which is why the phase and cause work in `44b00775`, `042a1f43` and
`5e4fd449` was worth doing at all.

Cleanup note: a refused `provision` leaves a created-but-never-started container, and
`platform:local -- stop` refuses to clean it because there is no valid receipt. Remove it
by label - `docker rm -f`, then `docker network/volume rm` filtered on
`label=com.docker.compose.project=explorers-replatform-local`.

**Do not conclude "the Nginx config is missing locations, add them"** on the strength of
the first paragraph alone. That is the shape of the evidence, not a verified cause.

What is still not done, and is the part that wants the owner: letting any probe *detail*
through - the path, the expected and received status. That is a redaction change in
authority-sensitive code.

## `platform-fixture` ALSO flaps on an external registry rate limit — do not chase that one

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
