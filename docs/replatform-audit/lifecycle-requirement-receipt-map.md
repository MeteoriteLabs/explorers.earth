# Frozen lifecycle requirement-to-receipt map (19 + 3)

**Frozen 2026-10-08** against `codex/unified-replatform`. This is the artifact that
[ticket 2.4](tickets/ticket-2-4.md) names as a hard blocking prerequisite before any 2.4
writer dispatch — correction **C2** records that it had only ever been referenced, never
written. Every row below was read from source at the SHA this document was committed at.

## Read this first: what the denominator is, and what it is not

Ticket 2.4, [epic 2](epics/epic-02.md) and the execution packages all require "the original
18 lifecycle behaviors plus 3 recovery equivalents". **That enumeration does not exist
anywhere in this repository.** A search across `docs/`, `.superpowers/` and the source
trees returns only the figure — never the list. C2 is right that it is unwritten rather
than unlocated, and I could not recover it.

So this map does not claim to be that list. The denominator here is **derived from the
lifecycle contract surface that actually exists**: the service methods and routes in
`tunes/server/application/accountLifecycle.ts` and
`tunes/server/routes/explorersLifecycleRoutes.ts`, the recovery contract in
`tunes/server/auth/accountRecovery.ts`, and the behaviours asserted by the committed
lifecycle and auth suites. Each row is a behaviour the system is required to have, stated
so that it is falsifiable.

**It does not come to 18 + 3. It comes to 19 + 3.** My first draft of this map did total
18 + 3, and that was an artifact of my own omission: I had left out the held-completion
fence (L19 below), which ticket 2.4 names explicitly as a preserved requirement. Having
found it, I am not going to merge two rows to make the total match a figure whose source
nobody can produce. The near-miss is worth recording precisely because it shows how easy it
is to reach "18 + 3" by accident and then believe the list has been recovered. If the
original enumeration ever turns up, reconcile it against this one; do not assume they
match.

What this map is therefore good for: it gives "bounded slice" a denominator that can be
audited, so a residual figure stops being unfalsifiable. What it is not good for: claiming
historical continuity with a list nobody wrote down.

## Two corrections to ticket 2.4 found while writing this

Both of 2.4's own corrections below are **stale** at this SHA. Recorded here because the
ticket is still dispatched from.

**C1's substance stands, with one detail changed — and I got this wrong first time.**
`tunes/scripts/lifecycle-browser-guards.ts:1-13` now declares `LIFECYCLE_CASES` with **12**
entries, so the two held-feedback case *names* are committed where they were overlay-only
at the review SHA. **They are still not executed.**
`e2e/replatform/lifecycle.spec.ts` runs indices `[0]` through `[9]` and nothing else
(`:64,93,112,127,145,146,147,148,149,153`), and the only other reference to `[10]` anywhere
is `tunes/server/test/contracts/lifecycle-browser-support.test.ts:48`, which exercises the
control-authority validator rather than the behaviour. So the delivered browser count is
**10 executed cases out of 12 declared**, and C1's instruction — do not cite 12 as
discharged scope — remains correct. A name in a manifest is not a receipt.

**C4's P0 is half resolved.** The retired-assertion half is **done**:
`explorers-earth/e2e/account-lifecycle.spec.ts` contains no `auth-storage`,
no `mock-jwt-token-xyz` and no `**/api/music/identity/lifecycle/**` stub. (`fixture-user-b`
survives at `:192` as a fixture user id, which is not an authority assertion.) The CI half
is **also no longer zero**: `.github/workflows/frontend-e2e-qualification.yml:122`
registers the canonical lane as `{ lane: lifecycle, command: "npm run
explorers:test:lifecycle-browser --" }`, which resolves through
`tunes/package.json:30` to `tsx scripts/profile-browser-fixture.ts --suite lifecycle`.
C4's remaining live obligation is narrower than it reads: whether that workflow feeds a
**protected** aggregate, and the one-to-one retirement map, are still to be settled. Do not
retire `account-lifecycle.spec.ts` on the strength of this paragraph.

## Legend

- **Receipt** — a committed assertion that fails if the behaviour breaks, cited as
  `path:line`.
- **OPEN** — no receipt exists. Named as an obligation, never counted as covered.
- A row with both has partial cover, and the gap is stated.

## The 18 lifecycle behaviours

### Deactivation

| # | Behaviour | Receipt | State |
|---|---|---|---|
| L1 | Deactivation issues exactly one canonical command carrying the observed revision, and ends at login | `e2e/account-lifecycle.spec.ts:302`; `server/test/explorers-lifecycle.integration.test.ts:177` | covered |
| L2 | A stale revision cannot deactivate, and reports without issuing a second command | `e2e/account-lifecycle.spec.ts:317` | covered |
| L3 | Deactivation revokes the current session and every other tab | `e2e/replatform/lifecycle.spec.ts:112` (`LIFECYCLE_CASES[2]`); `server/test/explorers-lifecycle.integration.test.ts:126,177` | covered |

### Deletion feedback

| # | Behaviour | Receipt | State |
|---|---|---|---|
| L4 | A deletion requires a trimmed, non-empty reason, bounded to 2,000 characters | `e2e/replatform/lifecycle.spec.ts:64` (`LIFECYCLE_CASES[0]`); `server/test/explorers-lifecycle.integration.test.ts:167` | covered |
| L5 | A duplicate submit records the reason exactly once | `server/test/explorers-lifecycle.integration.test.ts:152`; `e2e/account-lifecycle.spec.ts:331` | covered |
| L6 | Feedback never accepts caller-supplied ownership, and carries no cross-account payload | `server/test/explorers-lifecycle.integration.test.ts:152,177`; `e2e/replatform/lifecycle.spec.ts:93` (`LIFECYCLE_CASES[1]`) | covered |
| L7 | A cross-origin feedback write is denied, and an invalid reason is not recorded at all | `server/test/explorers-lifecycle.integration.test.ts:167`; `e2e/replatform/lifecycle.spec.ts:149` (`LIFECYCLE_CASES[8]`) | covered |
| L8 | A failed feedback submission is retryable and the retry is the same submission | `e2e/replatform/lifecycle.spec.ts:64` (`LIFECYCLE_CASES[0]`, "retries one durable submission") | covered |

### Deletion

| # | Behaviour | Receipt | State |
|---|---|---|---|
| L9 | A deletion requires feedback belonging to the same account | `server/test/explorers-lifecycle.integration.test.ts:177`; `e2e/replatform/lifecycle.spec.ts:93` | covered |
| L10 | A lost deletion response keeps authority, and the retry reuses the same durable key rather than issuing a second deletion | `e2e/account-lifecycle.spec.ts:349` | covered |
| L11 | Finalisation purges owned content and typed attachments, retains the shared catalog, and leaves a non-revivable tombstone | `server/test/explorers-lifecycle.integration.test.ts:75,615` | covered |
| L12 | A Music-mapped deletion stays pending until the Music owner boundary releases it, and an unmapped deletion is not starved behind it | `server/test/explorers-lifecycle.integration.test.ts:328,363,414,447` | covered |
| L13 | A terminally deleted account is not recreated with its old content by repeating Google login | `server/test/explorers-recovery.integration.test.ts:47`; `e2e/replatform/lifecycle.spec.ts:148` (`LIFECYCLE_CASES[7]`) | covered |

### Authority and fencing

| # | Behaviour | Receipt | State |
|---|---|---|---|
| L14 | Unresolved lifecycle authority fails closed before any destructive control is reachable | `e2e/account-lifecycle.spec.ts:219` (parameterised over status modes) | covered |
| L15 | A finalised deletion hides every ordinary delete entry point and performs no destructive call | `e2e/account-lifecycle.spec.ts:232` | covered |
| L16 | A pending deletion survives a reload and a second tab | `e2e/account-lifecycle.spec.ts:248` | covered |
| L17 | Checking a pending deletion re-reads the authority without mutating it | `e2e/account-lifecycle.spec.ts:282` | covered |
| L18 | An identity change mid-flight abandons the in-flight lifecycle command, and a delayed old response cannot navigate or act for a new owner | `e2e/account-lifecycle.spec.ts:369`; `e2e/replatform/lifecycle.spec.ts:153` (`LIFECYCLE_CASES[9]`) | covered |
| L19 | A **held** deletion, deactivation or recovery completion cannot mutate, navigate or log out either a verified replacement owner B or a fresh verified returning A session | names declared at `tunes/scripts/lifecycle-browser-guards.ts:12-13` (`LIFECYCLE_CASES[10]`, `[11]`); **no executing case** | **OPEN** — see obligation 7 |

## The 3 recovery behaviours

| # | Behaviour | Receipt | State |
|---|---|---|---|
| R1 | A purpose-bound proof recovers an eligible account exactly once, and content access then requires a **fresh ordinary session** | `server/test/explorers-lifecycle.integration.test.ts:194`; `server/test/account-recovery.test.ts:30`; `server/test/explorers-recovery.integration.test.ts:52`; `e2e/replatform/auth.spec.ts:118` | covered |
| R2 | The recovery credential authorises recovery and nothing else: an ordinary route refuses it, and a wrong provider identity, an expired proof and a replay each fail **without any state change** | `e2e/replatform/auth.spec.ts:126-127` (ordinary `/me` returns 401 holding only the proof); `server/test/explorers-recovery.integration.test.ts:40,60`; `server/test/explorers-recovery-callback.integration.test.ts:101,140,151,165,177,194`; `e2e/replatform/lifecycle.spec.ts:145,147` (`LIFECYCLE_CASES[4]`, `[6]`) | covered |
| R3 | Two simultaneous recoveries produce exactly one transition, and the loser is rejected rather than queued | `server/test/explorers-lifecycle.integration.test.ts:250`; `e2e/replatform/lifecycle.spec.ts:146` (`LIFECYCLE_CASES[5]`) | covered |

## Open obligations

These are the rows above that are **not** discharged, plus the obligations 2.4 states
outside the behaviour set. Nothing here is counted as covered anywhere in this map.

1. **The typed lifecycle observation union — OPEN.** C3 narrowed L0's absence claim
   correctly: the observation authority already exists and must not be duplicated.
   `server/routes/explorersLifecycleRoutes.ts:46-53` exposes `GET
   /api/explorers/v1/recovery/status` under `requireRecoveryPrincipal`, returning
   `{recovery:{status, revision}}` read straight from `creator_accounts`. That is a raw
   status read. It does not distinguish a **terminal** outcome from a still-**pending**
   operation from an **unknown/indeterminate** one, which is exactly the distinction a
   client that lost its response needs in order to re-observe without replaying its proof.
   Extend that route; do not add a second observation endpoint.
2. **The manual-review DTO — OPEN.** `manualReview` and `manual_review` have **zero hits**
   across `tunes/server`, `tunes/shared` and `explorers-earth/src` at this SHA. There is no
   server contract and no UI contract. C3's finding is unchanged.
3. **The real Google callback acceptance — OPEN and not satisfiable by a fixture.** The
   provider-adapter boundary is well covered
   (`server/test/explorers-recovery-callback.integration.test.ts`, 8 cases), but every one
   of those drives a simulated callback. 2.4's grooming focus states a fixture cannot stand
   in for the live callback, and C6 keeps it mandatory.
4. **Music socket revocation — OPEN, owned by 6.1, not by this map.** The review-focus item
   "a logged-out or suspended owner must lose socket authority as well as HTTP access" has
   no receipt here. `tunes/server/music/canonicalMusicPrincipal.ts:8` documents that socket
   credentials belong to 6.1. L3 above covers HTTP and tab revocation only, and must not be
   read as covering sockets.
5. **Hosted attestation of the browser receipts — PARTIALLY OPEN.** See the C4 correction
   above: the canonical lane is registered in
   `.github/workflows/frontend-e2e-qualification.yml:122`, but whether that workflow feeds a
   protected aggregate, and the one-to-one map from each retired legacy case to its
   canonical replacement, are unsettled. Until both are, `account-lifecycle.spec.ts` stays.
6. **The held-completion fence (L19) — OPEN.** This is 2.4's "held
   deletion/deactivation/recovery completion fences" requirement and it is the behaviour
   closest to a real-world hazard: a completion that arrives while the browser has moved on
   to a different verified owner must not act for the owner it was issued under. The two
   case names exist in the committed manifest
   (`tunes/scripts/lifecycle-browser-guards.ts:12-13`) and no spec runs them. L18 is
   adjacent but not sufficient: it covers a delayed *response* against a new owner, not a
   completion *held* across a verified replacement and a returning session.
7. **A hardening note, not a required behaviour.** `/recovery/status:50-52` indexes
   `account.rows[0]` without checking it. It cannot be reached with no row today, because
   `requireRecoveryPrincipal` resolves an existing binding and terminal deletion retains a
   tombstone row (`server/test/explorers-lifecycle.integration.test.ts:615`). It is worth
   folding into obligation 1 when the typed union is written, since "no row" is precisely
   the indeterminate case that union exists to express.

## What this map does not license

- It does not retire any existing coverage. 2.4 is explicit that old workflow coverage must
  not be retired against a partial map, and this map is partial — six open obligations.
- It does not give a percentage. 21 of the 22 behaviour rows have receipts and L19 does
  not, but reporting "21/22" would still be misleading while obligations 1-6 are open (7 is a hardening note, not a required behaviour):
  those are contract and attestation gaps that no behaviour row can discharge, and one of
  them — the real Google callback — is a prerequisite 2.4 says a fixture cannot satisfy.
- It does not substitute for the original enumeration, which remains lost. See the first
  section.
