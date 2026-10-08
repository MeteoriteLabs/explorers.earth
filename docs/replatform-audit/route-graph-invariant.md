# The route-graph invariant — ticket 1.2's open obligation

**2026-10-08.** Step 11 of [the sequence](remaining-work-sequence.md). Written because
`scripts/replatform-route-parity.ts` now points failing CI runs at this file.

## What the invariant says

[Ticket 1.2](tickets/ticket-1-2.md) (restated at `epics/epic-01.md:106`) requires the platform
fixture runtime to mount **the same canonical application route graph as the replacement
production runtime**, asserting "auth, profiles, content, analytics, lifecycle and Music routes
are present as their owning epics land", with external providers injected as fixtures.

The 2026-10-05 independent review found the invariant passing **vacuously**: the inventory
probed six legacy/Strapi/analytics paths and the test pinned the count to exactly `6`, so a
missing canonical route could not fail it.

## What was actually wrong, which is one level deeper than "under-probed"

The review's diagnosis was right and incomplete. The inventory listed no canonical routes
because **the fixture runtime does not serve any.**

- `docker-compose.replatform.yml:56` and `:106` set **`EXPLORERS_API_MODE: legacy-music`**.
- `server/apiMode.ts` makes that selection explicit and total: `legacy-music` starts
  `config/music-startup`, not `auth/canonicalStartup`.
- The legacy composition in `server/routes/index.ts` mounts, from the whole Explorers set,
  only `setupExplorersAnalyticsRoutes` (`:191`) and `setupExplorersPublicProfileRoutes`
  (`:186`). It mounts **no** Better Auth group, no `/health/live`, and none of the
  `/api/explorers/v1` owner routes.

So the fixture is not a canonical runtime with a thin inventory. It is the **legacy** runtime,
and the invariant is unsatisfied at its root. An inventory extension cannot make it pass; it
can only make it tell the truth.

## What changed on 2026-10-08, and what it costs

The inventory now carries five canonical probes beside the original six, and the expected
count is **derived from the inventory** rather than typed in, so adding a probe without a
response fails loudly instead of silently raising a number nobody re-checked:

| Probe | Expectation | What it proves |
|---|---|---|
| `GET /health/live` | 200, `status` = `live` | the canonical app is the thing answering, not the legacy server |
| `POST /api/auth/sign-in/social` | 403, `error.code` = `FORBIDDEN` | the Better Auth group is mounted **with its origin guard ahead of the handler** |
| `GET /api/explorers/v1/me` | 401, `error.code` = `UNAUTHENTICATED` | canonical profile identity |
| `GET /api/explorers/v1/account/lifecycle` | 401, `error.code` = `UNAUTHENTICATED` | canonical account lifecycle |
| `GET /api/explorers/v1/collections` | 401, `error.code` = `UNAUTHENTICATED` | canonical owner content |

**Every expectation is measured, not read off a handler.** Each was taken from the real
`createCanonicalApp` via supertest, and that measurement is now a standing contract in
`tunes/server/test/contracts/platform-route-signatures.test.ts`, which drives the same probe
list against the real app. That test is what stops the inventory describing nothing — an
internally consistent inventory was precisely the earlier failure. It needs **no container**,
which is also measured rather than assumed: none of the five paths touches the database, and
the test asserts the stub pool recorded zero queries, so if a future route starts querying on
an unauthenticated request the test says so.

The probe mechanism gained two things it needed for canonical routes: a request `method`
(the auth-origin probe is a POST) and dotted field paths (canonical errors are
`{error:{code,message,requestId}}`, nested, where every legacy probe asserted a flat field).

### The cost: `platform:test:routes` will fail in CI, by design

`.github/workflows/test.yml:302-310` provisions the fixture and runs
`npm run platform:test:routes`, which calls `verifyPlatformIngress`. Against a
`legacy-music` fixture, the five canonical probes are absent, so **that job now fails.**

That is the ticket's mandated behaviour — "a canonical route promised by a landed epic and
missing from the fixture graph is a failure, not a skip" — and it is the first time the
invariant has been able to fail at all. The failure message carries its own diagnosis rather
than a bare mismatch, naming the mode, the cause and this file.

**If that red is not wanted yet, the revert is one commit** and it restores the vacuous pass;
it does not restore correctness.

## The part of the ticket that cannot be satisfied as written

The 1.2 correction asks for two things that a single-mode runtime cannot both provide:

- "Do not weaken or delete the existing six probes" — but `/api/check`, `/api/csrf-token`,
  `/api/user/reactivate` and the `/api/users/me` Strapi boundary are **legacy-only** surfaces.
  The canonical app serves none of them.
- "Extend the inventory with the landed canonical routes" — which the legacy runtime does not
  serve.

One runtime cannot answer both sets. So closing this obligation requires an owner decision
about sequencing, and it is not an engineering detail:

1. **Flip the fixture to `EXPLORERS_API_MODE: canonical`** and retire the legacy six with the
   legacy server in step 12. This is the end state, and it is a real package: canonical
   startup needs its own environment (`EXPLORERS_PUBLIC_ORIGIN`, the Google client
   configuration, canonical schema readiness), and the existing fixture E2E lanes are built on
   legacy endpoints, so they move with it.
2. **Run both graphs in the fixture** during the transition — two services behind the one
   ingress — so both probe sets pass until the legacy half retires. More fixture surface, but
   the invariant goes green honestly rather than vacuously.
3. **Accept the red** until step 12 reaches the fixture, treating the failure as the tracking
   signal it now is.

Option 1 is the destination either way; the choice is whether the fixture moves now or the
job stays red until step 12. **Neither is mine to pick**, and neither is a reason to delete a
probe.

## Preserved unchanged

The production half of the invariant is untouched: production must still reject fixture
session authority even though the route graph is equivalent, asserted by
`assertCanonicalPlatformRouteGraph` and its existing case in
`platform-route-parity.test.ts`.

## Reproducing

```bash
# the inventory's own behaviour, and the canonical signatures against the real app
npm test --prefix tunes -- --run server/test/contracts/platform-route-parity.test.ts \
  server/test/contracts/platform-route-signatures.test.ts

# the live fixture ingress (needs the provisioned fixture; fails while it is legacy-music)
npm run platform:local -- provision && npm run platform:test:routes
```
