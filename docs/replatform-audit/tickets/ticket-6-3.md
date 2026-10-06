# Ticket 6.3: Guest, public and socket parity

**Status:** consult the [durable implementation ledger](../../../.superpowers/sdd/epic-01/progress.md); checkboxes below do not assert implementation status.

[Parent epic and shared contracts](../epics/epic-06.md) · [Master plan](../implementation-plan.md) · [All tickets](../ticket-index.md) · [Shared execution checklist](../execution-checklist.md)

## 2026-10-05 execution amendment

Read the [re-groomed dependency and ownership plan](../../superpowers/plans/2026-10-05-replatform-regroomed-execution.md), including this ticket's all-ticket disposition, before allocation. Preserve the implementation and acceptance requirements below. Canonical producer, active consumer, fixture, real-backend evidence and exact-commit hosted status must be tracked separately; missing future producers are dependencies, never fixture waivers. Every new delegated assignment uses a fresh agent. Proposed original paths/commands must be checked against current source before execution.

## Current execution card

**Disposition:** waiting. **Technical inputs:** 6.1, 6.2. Dependencies refer to reviewed interfaces for partial packages; complete-ticket acceptance retains all original gates.

**Next package:** Qualify guest capability, public playback, replay/revocation and socket separation after canonical owner behavior.

**Ownership:** The ticket owns its category/feature files listed below. Shared schema, migration identifiers, route registration, auth clients, Settings, seeds and protected manifests require coordinator allocation before any writer starts. Do not dispatch overlapping writers.

**Execution gate:** Verify listed paths and actual package scripts against current source; classify proposed tests as to-create, never executed. Record the exact failing behavior before changing production code; run focused automated regressions, canonical real-backend/browser acceptance, fresh independent review, then commit/push and exact-SHA hosted checks. Preserve source/dependency hashes, counts/skips, first failure and owned-resource cleanup. Historical acceptance is retained, not rerun by default. External inputs and deployment authority remain explicit gates.

**Current commands:** Read the [command custody correction](../command-custody-2026-10-05.md). Historical generic suite/project/environment commands are proposed interfaces, not supported current runner flags; original behavior obligations remain required.

## Required context

Read the [authoritative database schema](../target-database-schema.md) and apply the [shared execution checklist](../execution-checklist.md) to affected surfaces. Apply the parent epic's global constraints, shared interface definitions, review focus and test-harness prerequisites. Those contracts are maintained once in the epic, rather than copied into thirty-eight potentially conflicting versions. Existing files refer to the pinned audit source; paths labelled create/new were proposed when authored. Commands and checkboxes specify required verification, not completed runs.

## Implementation and acceptance

**Depends on:** 6.2. **Modify:** `tunes/server/socket/musicSocketServer.ts`, `tunes/server/repositories/musicPublicationOperationRepository.ts`, `tunes/server/services/musicPublicChangeListener.ts`, `tunes/server/policies/musicSurfacePolicy.ts`; `explorers-earth/src/features/music/publicMusicClient.ts`, `publicMusicLiveClient.ts`, `ownerMusicLiveClient.ts`, `musicPublishCoordinator.ts`; existing `tunes/server/test/music-public-socket.test.ts`, `music-publication-operation.integration.test.ts`, `music-public-revision-contract.test.ts`; create `explorers-earth/e2e/replatform/music-public.spec.ts`.

- [ ] Add/update failing tests for public vs unlisted capability vs revoked sharing, repeated publication key, mismatched replay body, hidden queue controls, guest request limits, denied origin, expired authority and out-of-order revision notifications.
- [ ] Preserve hashed guest capability, durable encrypted replay and retired-key semantics; update account lookups to canonical mapping and keep guest transport separate from owner authentication.
- [ ] Run two browser contexts (owner and guest), guest request/owner acceptance, player-state update, connection drop/reconnect, revocation while connected and suspension. Verify hidden data never appears through socket payloads or direct public endpoint fetches.
- [ ] Run PostgreSQL publication integration, socket/security tests and real-stack browser spec plus existing Music public qualification command with its documented environment. Commit. **Done:** full owner/public/guest music coverage is ready for Milestone 2; no deferred UI rebuild is needed.

## Independent review verification (2026-10-05)

NOT-STARTED, and correctly **blocked behind 6.2** (and transitively 6.1). The `:13` disposition "waiting" stands. Measured reasons, against source at `225d83e5`:

- The socket is still keyed on the general 600-second HTTP bearer, not a purpose-limited handshake. `explorers-earth/src/hooks/useTunesDashboard.ts:107-109` passes the HTTP credential token into the owner subscription; `tunes/server/socket/musicSocketServer.ts:272,278` consumes it as the handshake value; `tunes/server/services/musicTokenService.ts:127-128` pins that token's lifetime to exactly 600 seconds. The `:32` obligation "keep guest transport separate from owner authentication" cannot be verified while owner socket and owner HTTP share one credential.

**Re-measured 2026-10-06, after 6.1 landed.** 6.1 did **not** deliver this, so it needs an owner here rather than an upstream reference. The call path is confirmed: `musicSocketServer.ts:278` calls `ownerCredentials.handshake({ token })`, which is `createMusicSocketCredentialVerifier` at `server/middleware/musicPrincipal.ts:167-169`, and that calls `principals.resolve(token)` — byte-for-byte the resolver every owner HTTP request uses. There is no purpose claim, no distinct audience and no shorter lifetime, so a leaked socket ticket is a ten-minute owner HTTP bearer.

Four things measured for whoever implements it:

- **Minting a purpose-limited ticket changes nothing on its own.** The gain only exists once the socket *stops* accepting a general bearer, which means the verification has to be asymmetric: HTTP must reject a token carrying a purpose claim, and the socket must require one. Shipping the mint without flipping the socket repeats 6.1's shape — provisioning delivered without the release — and should be treated as incomplete, not as progress.
- **`MusicTokenClaims` already has an optional-claim channel.** `CLAIM_KEYS` holds the seven required claims and `OPTIONAL_CLAIM_KEYS` currently holds only `subjectKind`, added by 6.1, so a `purpose` claim fits the strict decoder without widening the required set.
- **The 600-second lifetime is pinned by an explicit invariant** — `musicTokenService.ts` throws unless `tokenLifetimeSeconds` is exactly 600. A 60-second socket ticket needs its own constant rather than a configuration change, so that invariant stays intact.
- **Reconnection interacts with a short lifetime.** `ownerMusicLiveClient.ts:33-41` sets `reconnection: true` with `reconnectionDelayMax: 30_000`, and the auth object is captured once at `:43`. A 60-second ticket therefore expires across a backoff, so the client has to obtain a fresh ticket per connection attempt rather than reuse one. This is the part the `:33` reconnect obligation actually exercises.

`musicTokenService.ts` is under a 100%-per-file coverage threshold in `test:music-critical-coverage`, so every new branch needs its own test in the same package.
- Owner clients still ride the legacy bearer (`explorers-earth/src/lib/localTunesApiClient.ts:194`), so the `:32` obligation to "update account lookups to canonical mapping" has no canonical mapping to update against: `tunes/server/repositories/musicDomainRepository.ts:1196,1209` still key on `strapi_account_document_id`.
- 6.1 is undispatchable until [ADR-005](../../adr/005-music-identity-migration-deployment-authority.md) `:16-20` is superseded — see [ADR-006](../../adr/006-canonical-music-identity-supersedes-strapi-proof.md) (Proposed). That preflight transitively gates this ticket.

Note for 7.1: `ticket-7-1.md:13` lists 6.3 among its technical inputs, but the shared canonical navigation slice runs with no Music producer. That is a phantom dependency for the shared slice only; full 7.1 parity does consume Music public/unlisted/revoked semantics from this ticket.

### Step 2 correction (2026-10-07)

The handshake-ticket route landed in `99e8da96` with two defects that CI caught and one it could not.

CI caught the contract artifacts. The Music surface keeps three generated-or-hand-maintained records of its routes, and adding one route obliges all three: the hand-written OpenAPI 3.1 document in `server/routes/musicOpenApiRoutes.ts`, whose contract test demands *exact* parity with the live canonical route list; `docs/architecture/music-runtime-surface-inventory.json`, regenerated by `tunes/scripts/inventory-runtime-surfaces.ts --write`; and `docs/architecture/music-authorization-matrix.json`, regenerated by `tunes/scripts/generate-music-authorization-matrix.ts` **from that inventory file**, so the two must be regenerated in that order or the matrix is rebuilt from a stale inventory. The inventory also records each route's source line, so editing the OpenAPI document shifts `/api-docs` and makes the inventory stale by itself — the regeneration is not optional even when no route changed.

CI could not catch the real defect. The route was mounted with the `owner(...)` chain, which is `identify + principal + ownerInputGuard`; `mutation(...)` is `owner(originGuard, ...)`. Every other owner-mutating Music route uses `mutation`, so the ticket route was the only POST that would mint a live socket capability for a signed-in owner on request from **any** origin — a CSRF-shaped hole whose blast radius is a socket capability rather than a single write. It passed every suite because the route had no route-level test at all; only the OpenAPI contract's "a non-GET owner operation must declare an exact Origin" rule made the omission visible, and then only indirectly.

Both are fixed, and `music-surface-routes.test.ts` now covers the route: minting for a proven owner behind an allowed origin, refusal of a foreign origin and of a missing origin, refusal of an unauthenticated caller, and a 404 when no minter is wired so an optional dependency is not advertised as a capability. Reverting `mutation` to `owner` turns the origin case from 403 to 200, so the guard is pinned rather than incidental.

### Step 3 delivered (2026-10-07): the socket accepts only a handshake ticket

The switchover the re-measurement above called the actual gain. The socket no longer accepts a general Music credential, and the client mints a ticket per connection attempt.

**The design problem was the recheck, not the handshake.** `createMusicSocketCredentialVerifier` retained the handshake token and `recheck()` re-ran `principals.resolve(token)` on it, which re-verifies expiry. A 60-second ticket would therefore have disconnected every owner a minute after connecting. The resolution splits token verification from identity resolution: `MusicPrincipalService.resolveSubject(subject)` runs every identity-side check — tombstone, suspension, pending deletion, session-version bump, and canonical-versus-legacy branch — against a `MusicPrincipalSubject` rather than a token, and `resolve()` and `resolveSocketTicket()` are the two verifying front doors onto it. Nothing is weakened by not re-checking expiry: revocation is an identity fact, and all of it still fails on a recheck exactly as it does on an HTTP request.

**One property did need rescuing.** `music-principal.test.ts` asserted that an already-connected socket is evicted once the key that signed its credential leaves its bounded acceptance window — the operator's emergency credential invalidation. Resolving the subject without the token would have silently dropped it. So `MusicTokenService` gained `verifyContext`/`verifySocketTicketContext`, which return the verified claims *and* the key ID that vouched for them, plus `acceptsSigningKey(kid)`; the subject carries `signingKeyId` and `resolveSubject` refuses a retired key. Rotation still evicts live sockets, and the connection holds a key ID rather than a replayable credential — strictly less than the token it used to retain.

**Client.** `subscribeToOwnerMusic` takes `mintTicket()` instead of a captured `token`, and passes Socket.IO the callback form of `auth`, which it invokes on every connection attempt including reconnects. On a mint failure it presents no credential rather than the previous ticket, so the server refuses and Socket.IO retries under its own backoff. `useTunesDashboard` now gates the subscription on whether a credential *exists* rather than on its value, so a routine ten-minute credential rotation no longer tears down and rebuilds the live connection — a side benefit of decoupling the two credentials.

**Evidence.** 19 principal cases, 225 across the tunes security and socket lanes, 857 frontend unit tests, 1180 contract cases, both typechecks clean, and `musicTokenService.ts` and `musicPrincipal.ts` both at 100% statements/branches/functions/lines under the per-file gate. New cases pin each claim: the handshake refuses a general credential; a canonical subject kind survives the handshake and its rechecks; an expired ticket keeps an open connection alive but cannot open a second one; and a reconnect mints a fresh ticket and never falls back to the previous one.

Remaining for this ticket: the reconnect case in a real browser lane, which is 6.2's `:33` obligation and now unblocked.
