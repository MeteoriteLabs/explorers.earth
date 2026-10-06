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
