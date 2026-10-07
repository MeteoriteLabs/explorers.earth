# The path to retiring Strapi

**Why this doc exists.** The epics are organised by feature area, so reading them as a
to-do list makes everything look equally pending. They do not distinguish *this blocks
Strapi retirement* from *this is a provider feature we can ship later*. This doc orders
the remaining work by the only thing that ends the cost of running two backends: removing
the last Strapi consumer.

It does not re-plan anything. Each item still belongs to its ticket, and the ticket remains
authoritative for scope and acceptance. This is the order, and the reason for it.

## How the remaining surface was measured

`explorers-earth` has exactly one Apollo HTTP link (`src/main.tsx:32`), pointing at
`/graphql` in the canonical runtime and `VITE_API_URL` otherwise - both Strapi. So one live
Apollo hook call is one Strapi dependency, and counting them measures the real surface.

Measured at `08cd5acb`:

```bash
# from explorers-earth/src — files and live calls still on Strapi
grep -rl "useQuery(\|useMutation(\|useApolloClient(\|useLazyQuery(" \
  --include=*.ts --include=*.tsx . | grep -v __tests__
```

**37 files, 70 live calls.** The steps below partition those exactly - 28 + 10 + 9 + 6 + 8
+ 4 + 5 = 70, nothing ungrouped. Re-run the command to check this doc against the code; if the numbers
disagree, the code is right and this doc is stale.

A file that imports `@apollo/client` only for `gql` is **not** a consumer - those are
retired document definitions awaiting [8.1](tickets/ticket-8-1.md)'s deletion. Counting
imports instead of calls overstates the surface by roughly half.

## What does not block retirement

This is the most useful thing in this doc, because it removes three epics from the
critical path.

**Movies ([4.1](tickets/ticket-4-1.md)), Games ([4.2](tickets/ticket-4-2.md)) and Books
([3.3](tickets/ticket-3-3.md)) read as "partial", but have zero live Strapi calls.** Their
outstanding work is provider search and taxonomy parity - TMDB, IGDB, Google Books - which
is new capability against third-party APIs, not a Strapi dependency. The same is true of
the Apps, Products and People features.

So those can ship before or after retirement, in any order, driven by product priority
rather than by this path.

## The order

### 1. Guides — [5.3](tickets/ticket-5-3.md) · 28 calls, 12 files

The largest single consumer by a wide margin, and the last category without a native owner
read. Already next in epic 5, so the contracts and the adapter pattern are fresh.

### 2. The signed-in dashboard home — `pages/Home.tsx` · 10 calls, 1 file

Found while measuring, and not called out in any epic. Home aggregates **books, apps,
products, people, places and guides lists straight from Strapi**, even though five of those
already have native owner reads on their own pages. So most of it is rewiring to hooks that
exist, not new backend work - the cheapest ten calls on the list. Only guides, dashboard
status and the account read need anything new, and guides arrives in step 1.

Worth doing early for a second reason: it is a cross-category consumer, so leaving it until
the end means one file blocking retirement after everything else is done.

### 3. The auth pages — epic 2 · 9 calls, 7 files

`Register`, `ForgotPassword`, `ResetPassword`, `ResetLinkSent`, `ClaimAccount`,
`hooks/useLogout`, `hooks/useUsernameValidation`.

Epic 2 reads complete, and canonical auth *is* delivered - but these screens were never
converted and still call Strapi today. **Password reset and registration are on Strapi
right now.** Small and mechanical, and the highest consequence if it breaks, so it wants
doing while attention is on it rather than in the last sprint before retirement.

### 4. Public place and person detail — [5.1](tickets/ticket-5-1.md) / [7.1](tickets/ticket-7-1.md) · 6 calls, 4 files

`PlaceDetails`, `PlaceOverview`, `PersonOverview`, `PublicGuideModal`.

The public *list* read is native; the public *detail* read is not. Two sources for one
page is how "correct on the grid, wrong in the modal" bugs happen, and 7.1 cannot prove
parity while the halves disagree.

### 5. Profile, Settings and Analytics — [3.1](tickets/ticket-3-1.md), [3.4](tickets/ticket-3-4.md), [7.2](tickets/ticket-7-2.md) · 8 calls, 6 files

Larger, but the same pattern the six migrated categories established. Analytics also owns
[3.4](tickets/ticket-3-4.md)'s outstanding consent and privacy obligations, which are not
just a rewiring job.

### 6. Music glue — epic 6 tail · 4 calls, 4 files

`AuthSyncManager`, `MusicPublishProvider`, `pages/Music`, `hooks/useTunesDashboard`. Epic 6
is delivered; these are the remaining Strapi reads around it.

### 7. Billing and subscription · 5 calls, 3 files — **blocked on a decision, not on work**

`Checkout`, `SubscriptionPlans`, `BillingTab`. See the decisions below.

### 8. Parity, then retirement — [7.1](tickets/ticket-7-1.md), [7.3](tickets/ticket-7-3.md), then [8.1](tickets/ticket-8-1.md)

8.1 requires full retained parity, a separate release decision, and verifying zero active
consumers before deleting the compatibility files. Steps 1-7 are what make that
verification return zero.

## Decisions that are not mine to make

Each of these blocks a step above, and none is an engineering question.

1. **The `song-limit` quota** (step 7). It is live in `BillingTab`, `Checkout` and
   `useAIGuideQuota`, has no canonical table, and there is no authorization to drop it.
   `revised-direction.md` defers *monetization*, which does not cover an abuse and cost
   control: dropping it means uncapped AI and YouTube usage at launch. Port the quota
   without the billing, port both, or accept uncapped and cap elsewhere.
2. **The Places category/subcategory taxonomy** (affects step 4 and the Places sector
   browse). The vocabulary is Strapi content and [5.1](tickets/ticket-5-1.md) forbids
   inventing production values, so this needs an export or an explicit decision to ship
   without it. Deferred to its own ticket on 2026-10-07.
3. **Per-place pinning** (step 4). Strapi's `recommendedPlace.is_pinned` has no equivalent
   reachable through the owner API, because Places is deliberately outside
   `topPickCategorySchema`. Restoring it needs either Places added to that set or a
   per-list pin of its own. Recorded in [5.1](tickets/ticket-5-1.md).
4. **The `unsubscribe` suppression list and per-field i18n**, both named in the coverage
   register with no canonical equivalent. Zero rows is fine; no table is not.

## Two things this path does not cover

- **Deployment-gated work** - [3.5](tickets/ticket-3-5.md), [8.4](tickets/ticket-8-4.md)
  and the production QA in epic 7 need separate deployment authority and are outside this
  ordering by design.
- **Epics 9 and 10** (public discovery, MCP, delegated grants) depend on retirement rather
  than blocking it, and their protocols are to be revalidated when that phase starts.
