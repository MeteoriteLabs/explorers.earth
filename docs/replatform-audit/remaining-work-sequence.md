# Remaining work, in the order we will do it

**2026-10-08. Supersedes `strapi-retirement-path.md`.**

Everything still outstanding, sequenced. This says *what* and *when*, not *how* — the ticket
stays authoritative for scope, acceptance and design.

Read with: [ticket index](ticket-index.md) for per-ticket verdicts, the
[coverage register](strapi-coverage-register.md) for field-level gaps, and the
[execution checklist](execution-checklist.md) for the rules every package follows.

## Where we are

Delivered on `codex/unified-replatform`: epic 1 (bar one obligation), epic 2.1–2.3,
epic 6 complete, Books/Movies/Games manual slices, and the category migrations
**4.3 Apps · 4.4 Products · 4.5 People · 5.1 Places · 5.2 place-links**. PR #119 is green
and still a draft.

Two numbers set the shape of what is left, both measured at `d97a5733`:

- **Corrected 2026-10-08: Apollo is not the whole frontend surface.** This doc originally
  said the 70 calls below partition it and that reaching zero ends the dependency. That was
  wrong. explorers-earth also reaches Strapi over REST through a *second* base,
  `VITE_REST_API_URL`, used by 19 files. Thirteen point at tunes (payment, subscription,
  AI) and are canonical; **four still hit Strapi-only endpoints** (`/upload`,
  `/upload/files/:id`, `/guides`): `features/Favorites/components/AddRecommendation.tsx`
  (step 7), `pages/ClaimAccount.tsx` (step 3), `pages/Home.tsx` (step 2),
  `pages/Profile.tsx` (step 7). The two that were in Guides are done. Zero Apollo calls
  would not have ended the dependency on its own.
- **Frontend: 37 files, 70 live Apollo calls** when written; **26 files, 43 calls** as of
  2026-10-08. There is one Apollo link
  (`src/main.tsx:32`) and it points at Strapi, so one live `useQuery`/`useMutation` is one
  Strapi dependency. Files importing `@apollo/client` only for `gql` are retired
  definitions, not consumers — counting imports instead of calls overstates the surface by
  about half.
- **Server: 55 non-test files mention Strapi.** That 55 overstates real coupling: some of
  those files exist precisely to *prove* Strapi's absence (`musicRetirementPolicy`,
  `strapiIdentityAbsenceProof`). Classifying them is step 10 below, not a guess to make here.
- **Corrected 2026-10-08: the canonical API already boots with no Strapi configuration.**
  This doc said `server/app.ts:179` builds a gateway from a required `strapiOrigin` so
  "the API cannot boot without Strapi configured", and named it the epic-6 exit blocker.
  Wrong API. `server/api.ts` selects a mode: `canonical` starts `canonicalStartup`,
  which has **no** Strapi reference and resolves Music tokens through ADR-008's
  `resolveCanonicalMusicTokenConfiguration` - explicitly "the token configuration and
  nothing else, notably not STRAPI_URL". `app.ts` is on the `legacy-music` path only,
  and that path is what step 12 (8.2/8.3) removes. So epic 6's "zero required Strapi
  config" already holds for the canonical runtime; what remains is deleting the legacy
  server, not loosening a required origin.
- **Not to be loosened casually:** `strapiIdentityAbsenceProof` gates *finalizing account
  deletions*. With no access token it returns `"outage"`, so deletions defer rather than
  finalize - it fails closed, which is correct. Turning that into `"absent"` by declaring
  Strapi retired would finalize deletions without confirming Strapi deleted its copy. That
  is a deliberate grant of lifecycle-delete authority and needs explicit owner
  authorization; it is not a config tidy-up.

The frontend steps partition all 70 calls exactly, so when the last one is done the count
is zero: **28** Guides + **10** Home + **9** auth pages + **6** public detail + **8**
Profile/Settings/Analytics + **4** music glue + **5** billing = 70. Steps with no call count
are structural work with no live Strapi consumer.

```bash
# recheck the frontend number, from explorers-earth/src
grep -rl "useQuery(\|useMutation(\|useApolloClient(\|useLazyQuery(" \
  --include=*.ts --include=*.tsx . | grep -v __tests__
```

If the code and this doc disagree, the code is right and this doc is stale.

---

## Phase A — finish the categories

### 1. Guides — [5.3](tickets/ticket-5-3.md) · 28 calls, 12 files · 27 MISSING fields

**Backend done (2026-10-08).** Migration 0050 plus the contract, repository, service and
seven owner routes are on the branch and verified: 29 contract cases, 18 integration cases
against PostgreSQL 15, role attestation green. Guides is no longer schema-unreachable.

Correction worth carrying: the ticket called for widening 0029's CHECKs on
`recommendations.category` and `collection_items.category` to admit `'guides'`. That is
wrong and was not done. A guide section's places are denormalised provider snapshots inside
the section's blocks, so nothing writes either row for a guide — and those CHECKs are what
make "a guide is never flattened into ordinary item rows" true in storage.

**Owner side done (2026-10-08).** Client, view model, adapter, owner hook, editing context
and every owner consumer are canonical: `GuidesPage`, `GuideDetailsPage`, `GuideSectionForm`,
`GuideSectionFormPage`, `CreateGuidePage` and all six `GuideDetails` editors. The feature has
**one** Strapi call left, and `guideService.ts` — the bearer-token `/upload` path — is deleted.

Still to do:
- The public (non-owner) guide read and `PublicGuideDetailPage`, which go with **step 6**,
  the public-detail package.
- `CreateGuideStep2`'s guide category vocabulary — the one remaining call, blocked on **D9**.

### 2. Dashboard home — `pages/Home.tsx` · 10 calls, 1 file · no ticket — **DONE 2026-10-08**
- Found by measurement, recorded in no epic. Read books, apps, products, people, places and
  guides straight from Strapi though five already had native owner reads.
- The last four were three reads of **the same account, read three different ways** -
  `GetDashboardStatus` by user document id, `accountsDetailQuery` filtered by username, and
  `GET_USER_ACCOUNT_QUERY` to recover the account id - plus one write. All three collapsed
  into the `useCanonicalAccount` call the file was already making.
- `GetDashboardStatus` was **inert**: it selected `usersPermissionsUser` and its only
  consumer read `dashboardStatusData?.me?.accounts`, a field the document never returned, so
  the completion check always fell through to the canonical Places read beside it. It
  fetched a large payload on every dashboard load and decided nothing.
- The write was a stale duplicate: Home had its own copy of the Places list create, on the
  Strapi mutation with the thumbnail posted to Strapi `/upload` and `display_order`
  computed from whatever lists this component happened to have loaded.
  `useCreateLocation` already does it canonically, and the server assigns
  `display_order` - which is also the only correct answer, since another tab may have
  created a list since this one loaded. Home now delegates to it.
- **Still there, deliberately:** `resolveCoverUrl` prepends the Strapi host to a stored
  `/uploads/...` media path. That is not a Strapi API call, it is display-time resolution
  of legacy media, and it stops mattering when the media is migrated - step 12, not here.

### 3. Claim flow — [5.4](tickets/ticket-5-4.md) · 18 MISSING fields — **measured 2026-10-08; genuinely D4's**
Unlike steps 8 and 9, nothing here turns out to be dead, so there is no honest way to
advance it without the decision. What D4 is actually deciding, precisely:

- **The flow is live and linked.** `/claimaccount` is routed at
  `routes/AuthRoutes.tsx:29` and linked from `pages/Login.tsx:46` and
  `pages/Register.tsx:252,276`. A signed-out visitor can reach it today. (One of those two
  entrances, Register, is itself D10's.)
- **It has three Strapi dependencies and no canonical target.** Two `useLazyQuery` lookups
  for a claimable place profile by phone and by address, a `POST` to Strapi `/upload` for
  the verification document, and `createVerifyClaim`. A search of `tunes/server`,
  `tunes/shared` and `tunes/migrations` for claim or verify-claim support returns **one
  comment and no code** - no table, no route, no contract. That is what the 18 MISSING
  fields are.
- **The failure mode at retirement is the part worth deciding against.** This is not a flow
  that stops working at the door: a claimant fills the form, uploads a document, and only
  then hits a dead backend. Breaking mid-flow after a document upload is materially worse
  than a closed door, so "decide later" is not neutral here.
- **Security finding, independent of D4.** The upload sends `Bearer
  VITE_PUBLIC_ACCESS_TOKEN` when no session token is present
  (`pages/ClaimAccount.tsx:131-139`). That is a bundled client-side credential authorising
  writes to the Strapi upload endpoint by any unauthenticated visitor. It is retired along
  with Strapi, but if the claim flow is rebuilt canonically it must not acquire an
  equivalent: an unauthenticated document upload needs a server-issued, single-use,
  purpose-bound grant, the way recovery proofs work.

I did **not** contain this flow the way step 9's was contained. Step 9 applied a decision
already in force on two of three entrances; closing a live, linked, user-facing flow that
nothing has closed yet is the product decision itself, and that is D4's to make, not mine.
- Claim service, repository, routes and migration — none of it exists.
- Eligibility is the direct canonical query 5.1 already specifies; no second stale directory.
- Retires `features/Favorites/services/claimablePlaceProfileService.ts`, still in the tree and no longer called.
- Needs decision **D4** first.

## Phase B — close the gaps behind "complete"

### 4. Auth pages — epic 2 · 4 calls, 4 files — **DONE 2026-10-08**

**Corrected twice, and the second correction is the one that matters.** First I called these
small mechanical screens. Then I corrected that to "cannot be converted - retiring them is a
product change needing **D10**". That was also wrong, and I should have checked before
writing it: **the product change is already shipped, and the decision is already recorded.**

- `config/featureFlags.ts` has `ENABLE_MANUAL_AUTH: false`.
- All four pages already act on it: `ForgotPassword`, `ResetPassword` and `ResetLinkSent`
  redirect to `/login` with a "sign in with Google" message, and `Register` renders
  Google-only at `:227`.
- `Login` has **no password field at all** — only `authClient.startGoogleSignIn()`.
- And [ticket 2.4 line 45](tickets/ticket-2-4.md) states the obligation as already settled:
  "Existing password-only routes redirect to Google sign-in without exposing broken forms;
  **record this agreed visible change**."

So there was no decision outstanding. What remained was the same shape step 9 found: each
page still carried an Apollo mutation in a path the redirect makes unreachable. Those are
gone, and each submit path now refuses by construction rather than being merely unreached —
the redirect runs in an effect, so it fires a frame after the first render.

Also removed: the Strapi error-message classification below each call (`ApolloError`
branches matching on "email not found", "rate limit" and so on), which mapped responses a
retired backend will never send.

What is genuinely still D10's is narrower than this step: whether the four routes keep
existing as redirects or stop being routed at all, and whether `Register`'s Google-only
screen is the long-term sign-up page. Neither blocks Strapi retirement.

- `ClaimAccount` (3 calls plus a Strapi REST `/upload`) is the claim flow and belongs to
  **step 3** under **D4**, not here.
- `hooks/useLogout` and `hooks/useUsernameValidation` hold no live Apollo call — retired
  `gql` definitions awaiting step 12's deletion.

### 5. Auth UX and lifecycle — [2.4](tickets/ticket-2-4.md) — **prerequisite discharged 2026-10-08**
- The blocking prerequisite is done: [the frozen requirement-to-receipt map](lifecycle-requirement-receipt-map.md). Writer dispatch is no longer gated on it.
- Three findings from writing it. The stated "18+3" enumeration **does not exist in the repo** - only the figure does - so the map's denominator is derived from the actual contract surface and says so. It comes to **19 + 3**; my first draft came to 18 + 3 only because I had omitted the held-completion fence the ticket names. And the ticket's own C1 and C4 are partly stale: the two held-feedback case names are committed but **unexecuted** (10 of 12 declared), and the legacy spec's retired `auth-storage`/`mock-jwt-token-xyz` assertions are already gone with the canonical lane registered in `frontend-e2e-qualification.yml:122`.
- 21 of 22 behaviour rows have receipts. Two of the map's obligations are now **done**: the typed terminal/pending/unknown observation union and the manual-review DTO, both on the existing `/recovery/status` route. Doing them showed C3 is wrong on one point that mattered - a client which lost its response **could not** re-observe, because `requireRecoveryPrincipal` requires an unconsumed proof and a suspended-or-pending account, so the re-read returned 403 and a terminal deletion was unreportable. That needed a **security boundary change** (a separate read-only observation authority), called out in the map for the owner to veto.
- All 22 behaviour rows now have receipts, the held-completion fence included - it was already covered at `e2e/replatform/lifecycle.spec.ts:202`, where a `for` loop generates both cases, which is why a line-anchored `test(` grep missed it. **Three obligations remain and none is a behaviour gap:** the **real Google callback** which the ticket says a fixture cannot satisfy, **Music socket revocation** owned by 6.1, and **hosted attestation** of the browser receipts.
- Four subpackages L0→L3; migrate the unmigrated legacy spec; add the absent held-completion, response-loss and reload cases.
- Close the "no browser authority from account IDs" violation on *subjects* — it holds for bearers already.

### 6. Public place and person detail — [5.1](tickets/ticket-5-1.md)/[7.1](tickets/ticket-7-1.md) · 6 calls, 4 files
- `PlaceDetails`, `PlaceOverview`, `PersonOverview` and the remaining PublicHome readers still fetch detail through Strapi while the list read next to them is native.
- Two sources for one page is how "right on the grid, wrong in the modal" happens, and 7.1 cannot prove parity across the split.

### 7. Profile, Settings, Analytics — [3.1](tickets/ticket-3-1.md), [3.2](tickets/ticket-3-2.md), [3.4](tickets/ticket-3-4.md), [7.2](tickets/ticket-7-2.md) · 8 calls, 6 files
**Partly done 2026-10-08.** The three Analytics components and `useUpdateProfile` are off
Strapi. What that took was not a rewiring job either, and it is worth saying why:

- The two Analytics charts read `recommendationListQuery`, which is the Places category
  that `usePlacesOwner` already served under exactly that key. `AnalyticsDashboard` looked
  an account up with an inline `gql` document; `useCanonicalAccount` already existed to do
  it, and the selection logic around it (`selectCompletedAccount` over a list of accounts)
  has no canonical meaning — one owner has one account, and the read is owner-scoped.
- `useUpdateProfile` held four paths. Both of its callers already feed it from
  `useCanonicalAccount`, so the id reaching it is always a canonical UUID and **the three
  Strapi paths were already unreachable**: a `createAccount` for an owner with no account,
  an `updateAccount` for a non-UUID id, and a write mirroring the username onto
  `usersPermissionsUser`. No canonical `createAccount` is needed to replace the first -
  `ensureInitialAccount` provisions the account during authentication, so the client cannot
  and need not create one. A missing id now refuses the save instead of creating anything.

Two defects fell out of that, both live on this branch today:

1. **A rename did not reach the dashboard's own links.** Every public link and QR code is
   built from the auth store's `user.username`, and the only code that wrote that field was
   in the unreachable Strapi branch. So on the canonical path a rename updated the account
   and left every generated link pointing at the old handle until a full reload. Fixed, and
   mutation-checked: removing the write-back fails a test.
2. **The Music venue name never followed a rename — FIXED 2026-10-08.** `users.venue_name`
   was written once, at provision, from `display_name || handle`, and nothing updated it
   afterwards, so a creator who renamed their profile kept the old name on the Music surface
   indefinitely. `musicApi.refreshIdentity()` looked like the mechanism and carried nothing:
   the credential it re-mints is `{token, expiresAt}` with no display data, and the ensure
   endpoint returned early for an already-mapped account.
   `ensureMusicAccount` now converges the name on reuse, which is the one place that
   already holds the mapping and is reached on every identity refresh - so the Explorers
   account write does not have to reach into a Music table. That makes the client call
   meaningful, so it is **restored** in `useUpdateProfile`, best-effort: a Music name one
   save stale must not fail an Explorers profile save. The name derivation is now one
   function used by both paths, because two copies of a fallback chain is how they come to
   disagree about what an unnamed venue is called.

Also found, not fixed: `localTunesvisiblity` is hydrated into the profile form from
`social_media.localTunes.visibility` in two places and **no component renders it and no
code writes it back**. It is Strapi-era; Music visibility on a public profile is
`account_category_settings` for `music`, which travels as `categories`. The dead hydration
goes with the form cleanup in step 12.

**Settings is done too, and it was not D10's either.** `Settings.tsx:127` is
`const data = { usersPermissionsUser: { provider: "google" } }` - a **hardcoded constant,
not a read**. So every `provider !== "google"` branch in the file, including the Change
Password row and its modal, is statically unreachable, and the `updatePasswordMutation`
behind them was dead code pointed at Strapi. Removed; the handler now refuses by
construction, so restoring a real provider read without porting the flow fails loudly
instead of appearing to change a password canonical auth does not have.

Deleting the unreachable password UI itself - four guarded branches and a modal - is left to
step 12's form cleanup rather than done here, and is recorded in the file so it is not read
as live.

- Remaining: `Settings`, and the ticket obligations below.
- **3.4**: 10 analytics identities are authored and **0 attested** — add the analytics lane to the runner and the suite manifest. Its consent and privacy obligations are also open, and are not a rewiring job.
- **3.2**: the mandated upload-hook changes were never made.
- **7.2**: the dashboard gates on a token canonical auth never sets, so it is structurally dead; plus the reference-content module (`faq`, `platform-term`, legal copy — 7 MISSING fields) and the canonical email suppression table.
- Decisions **D2**, **D6**, **D7**, **D8** all land in this step.

### 8. Music glue — epic 6 tail · **1 call**, not 4 — mostly already done
**Corrected 2026-10-08.** Three of the four files are not Strapi consumers:

- `hooks/useTunesDashboard` uses **TanStack** Query, not Apollo. My `useQuery(` grep
  matched it; it never imported `@apollo/client`. The repo-wide call counts in this doc
  are inflated for the same reason — the honest figure is files that genuinely
  call an Apollo hook outside tests, which was 19 when this was written and is **8** now.
- `MusicPublishProvider` held an Apollo client only to pass it to
  `createMusicPublishAdapter`, which **never used it** — zero references in 76 lines. Both
  the parameter and the provider's `useApolloClient` are now gone.
- `AuthSyncManager` calls `apollo.clearStore()` on logout. That is Apollo cache plumbing,
  not a Strapi read, and it disappears with Apollo in step 12.

So what is actually left here is **one** read: `musicPageEligibilityQuery` in `pages/Music`.

The server half is also already done — see the corrected note above: the canonical API
boots with no Strapi configuration, and `app.ts` is on the `legacy-music` path that step
12 removes.

### 9. Billing and subscription · 5 calls, 3 files — **DONE 2026-10-08, without pre-empting D1**
Measured rather than assumed, and the "5 live Strapi consumers" was wrong in both directions:

- **3 of the 5 were already unreachable.** `MUSIC_SUBSCRIPTION_FLOWS_ENABLED = false` makes
  `Checkout` and `SubscriptionPlans` return `MusicSubscriptionUnavailable` before their
  active subtrees render, so their two mutations and one mutation respectively could not
  fire. They still imported `@apollo/client`, which is what blocks step 12, so the documents
  are gone and the call sites now refuse loudly - if that flag is ever flipped without
  porting the flow, it throws instead of writing to a retired backend.
- **1 was a dead read.** `BillingTab` fetched username, email and `razorpay_customer_id`
  from Strapi on every render into `_userData` and **never read it**. The underscore was the
  only hint. Deleted; there is nothing to port a read to when nothing consumes it.
- **1 was a live write, and it was the inconsistency worth fixing.** `BillingTab`'s
  free-plan upgrade set `is_subscribed` through `usersPermissionsUser`. The paid branch
  beside it navigates into the contained `Checkout`, and the other two entrances are closed
  - only this one escaped. It now refuses like its siblings.

**This applies the containment already in force; it does not decide D1.** There is no
canonical subscription state to port to - `updateAccountInputSchema` has no `is_subscribed`
- so what a subscription means canonically is still the owner's call, and it was never going
to be answered by continuing to write to Strapi. The `song-limit` quotas (3 MISSING fields)
remain D1's, and the chat-assistant work has its own central `ai_usage` meter planned.

## Phase C — prove it, then retire

### 10. Classify the server-side Strapi references — [8.1a](tickets/ticket-8-1.md)
- Walk the 55 files and label each: live consumer, retirement-policy/absence-proof (stays), or dead. 8.1 is oversized and splits into 8.1a (classify, remove coupling) and 8.1b (delete).
- Make `strapiOrigin` optional, then absent.

### 11. Parity and milestone evidence — [7.1](tickets/ticket-7-1.md), [7.3](tickets/ticket-7-3.md), [1.2](tickets/ticket-1-2.md)
- 7.1: all nine public categories (3 of 9 at audit), privacy and public media, pins, cold-entry positives; commit the navigation slice that currently exists only as an uncommitted overlay.
- 7.3: milestone-2 evidence — the command flags it mandates do not exist in the runner yet.
- 1.2: extend the route-parity inventory to the landed canonical routes and raise its expected count. Epic 1's one open obligation; shared files, so coordinator-allocated.

### 12. Retire Strapi — [8.1b](tickets/ticket-8-1.md), [8.2](tickets/ticket-8-2.md), [8.3](tickets/ticket-8-3.md)
- Verify zero active consumers, then delete the compatibility files and the retired `gql` documents across all nine category features.
- 8.2: remove the duplicate Tunes frontend — still built and served. A CI-gating risk, not a product change.
- 8.3: the mechanical backend rename, strictly after 8.1 and 8.2.

### 13. Topology, deployment, recovery — [3.5](tickets/ticket-3-5.md), [8.4](tickets/ticket-8-4.md), [8.5](tickets/ticket-8-5.md)
- **All of this needs separate deployment authority**, so it sits outside the engineering sequence by design.
- 3.5: both mandated workflows are absent, so Q2 has no artifact producer; the QA hostname is still pending.
- 8.4: verifier, compose and routing exist but self-label synthetic, with placeholder digests.
- 8.5: prose only — every named artifact absent, no restore evidence.

## Phase D — not blocking retirement, ship on product priority

Measured: these have **zero live Strapi calls**. What is outstanding is new capability
against third-party APIs, so they can ship before or after retirement, in any order.

### 14. Provider search
- **[4.2](tickets/ticket-4-2.md) Games** — the IGDB provider chain is dead code behind an unconditional 503; four named provider cases absent; 7 MISSING provider-fact fields.
- **[4.1](tickets/ticket-4-1.md) Movies** — the live TMDB provider is open; two named cases absent by name.
- **[3.3](tickets/ticket-3-3.md) Books** — "no Books flow requires Strapi" is unproven at an exact SHA; otherwise 20/20 verified.

### 15. Owed from the delivered category tickets
- `tunes/server/test/explorers/places.test.ts` — the unit suite 5.1 names.
- `e2e/replatform/places.spec.ts` and `place-links.spec.ts` — need the Docker fixture runner plus `suite-manifest.json` identities; **reserved to the coordinator**.
- Places seeded taxonomy and the sector browse — blocked on **D3**.
- Per-place pinning — blocked on **D5**.
- `e2e/{apps,products,people}.spec.ts` still expect the retired scraper steps. Nightly discovery only, and already failing on `main`.

### 16. Epic 9 — public discovery
- [9.1](tickets/ticket-9-1.md) MCP adapter and public tools: no module and no dependency yet. Revalidate the current MCP and OpenAI protocols when the phase starts.
- [9.2](tickets/ticket-9-2.md) discovery quality and observability: default-deny currently holds only *vacuously*.
- Prerequisite is 8.5, in step 13.

### 17. Epic 10 — linked creator tools
- [10.1](tickets/ticket-10-1.md) OAuth linking and delegated principal, [10.2](tickets/ticket-10-2.md) creator tools, [10.3](tickets/ticket-10-3.md) publication readiness.
- Resolve the one tool double-claimed between 10.1 and 10.2.
- Submission to any external directory is a separate authorized action.

---

## Decisions only the owner can make

Each blocks a step above, and none is an engineering question. Source: coverage register §7.

| | Decision | Blocks | Why it cannot be assumed |
|---|---|---|---|
| **D1** | `song-limit` AI-guide and song request quotas | 9 | Live in `BillingTab`, `Checkout` and `useAIGuideQuota`; no canonical table and no authorization to drop. `revised-direction.md` defers *monetization*, which does not cover an abuse and cost control — dropping it means uncapped AI and YouTube usage at launch. Port the quota without the billing, port both, or accept uncapped and cap elsewhere. |
| **D2** | `unsubscribe` email suppression list | 7 | The only `unique:true` in the legacy schema. "No users to migrate" authorizes zero rows, not no table — new unsubscribes must be honoured from the first email sent. |
| **D3** | Places category and subcategory taxonomy values | 15 | The vocabulary is Strapi content and 5.1 forbids inventing production values. Needs an export, or an explicit decision to ship without it. Deferred to its own ticket on 2026-10-07. |
| **D4** | Claim flow scope | 3 | 18 MISSING fields across `claimable-place-profile`, `verify-claim` and `account.Is_Claimable`. Either in scope, or recorded as dropped. |
| **D5** | Per-place pinning | 15 | Strapi's `recommendedPlace.is_pinned` has no equivalent reachable through the owner API, because Places sits outside `topPickCategorySchema` by design. Needs Places added to that set, or a per-list pin of its own. |
| **D6** | Instagram import scope | 7 | Without OAuth token storage, feed import works exactly once — at authorization. In scope with token storage, or dropped. |
| **D7** | Per-field i18n (19 `account` fields, `faq`, `platform-term`, `recommendation-category`) | 7 | `revised-direction.md:47` instructs preserving language behaviour. That is an instruction to preserve, not authority to drop. Likely out of launch scope, but it needs saying. |
| **D8** | Residual unaccounted fields (register §7.5) | 7 | `account.profile_place_media_details`, `account.localtunes_public` and others have neither a canonical equivalent nor a drop record. |
| **D10** | Email/password registration and password reset | 4 | Found 2026-10-08. Canonical auth is Google-only with password auth off, by epic 2's own scope boundary, so `Register`, `ForgotPassword`, `ResetPassword` and `ResetLinkSent` have nothing canonical to move to. They work today against Strapi. Retiring them makes sign-up Google-only and removes password reset entirely — a user-visible change to how people get into the product, and the last Strapi consumer in that area either way. Either retire them, or add email/password to canonical auth and widen epic 2's boundary. |
| **D9** | Guide category vocabulary | 1 | Found 2026-10-08 while migrating Guides. `CreateGuideStep2` reads `guideCategories { Category_Name }` from Strapi, so the vocabulary is Strapi content exactly as the Places taxonomy is in **D3** — and 5.1's rule against inventing production values applies the same way. Needs an export of the existing values, or a decision to ship a fixed list. The rest of Guides does not wait on it. |

## Standing facts worth not rediscovering

- **122 of 401 legacy attributes are MISSING** — missing *structure for future content*, not unmigrated rows. TK confirmed on 2026-10-05 that the legacy Strapi instance holds nothing worth carrying over, so there is no import ticket. That does **not** reduce the structural scope.
- The shared E2E fixture module epic 4 mandated now exists, at `explorers-earth/e2e/replatform/fixtures.ts`.
- Protected browser lanes are coordinator-allocated throughout: each needs a Docker fixture runner plus `suite-manifest.json` identities.
- The Games integration suite needs its own disposable Postgres container on a port other than 55432, which is reserved.
- eslint carries 1647 warnings against a 0-error gate. The burn-down is ongoing and deliberately not sequenced here.
