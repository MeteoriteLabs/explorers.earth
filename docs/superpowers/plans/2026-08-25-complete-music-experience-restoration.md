# Complete Music Experience Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the complete owner and guest Music experience through the secured Explorers-to-Tunes identity boundary, with no separate Tunes login and a reversible rollout.

**Architecture:** Keep canonical REST as durable state and authenticated Socket.IO as an update accelerator. Add only the missing canonical settings/import contracts, expand credential-aware frontend clients, and compose focused search, player, queue, history, playlist, sharing, and guest modules behind a feature flag.

**Tech Stack:** Node.js 22.12+, TypeScript 5.6, Express 5, PostgreSQL/Drizzle, Vitest/Supertest, React 18, React Query 5, React Player 3, Socket.IO 4, Tailwind CSS, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-25-complete-music-experience-restoration-design.md`

## Global Constraints

- Explorers is the sole login and account authority for email, Google, and existing accounts.
- Every owner operation derives `musicUserId` from the verified Music principal; requests never accept an owner username or ID as authority.
- Guests use publication state and bounded capabilities; guests cannot emit owner `player_state` authority.
- Do not restore retired Local Tunes auth, cookie, username-target, SSO callback, or browser service-token code.
- Preserve existing Music rows, playlists, queue, history, guest slug, and publication state.
- Keep each new UI module focused; `MusicDashboard` remains a composition layer.
- REST is canonical; socket reconnect or uncertainty triggers a REST refetch.
- All implementation tasks follow red-green-refactor and end in an independently reviewable commit.
- Do not modify unrelated dashboard or public-URL code; coordinate before editing shared public routing.
- Keep the current minimal Music workspace available behind the rollback flag until production canary approval.

## Accepted Cross-Model Review Corrections

The following corrections override any conflicting wording in the task bodies below:

1. **Execution is vertical and gated.** Slice A proves identity and restores owner search → queue → play → history. Slice B adds saved playlists. Slice C adds capability-only guest views and requests after owners explicitly reconfirm sharing. Slice D adds provider-approved imports and optional guest-local playback. No slice waits for every later slice before producing testable value.
2. **Identity is the first technical gate.** Execute Task 10 before Tasks 1-9. Proceed only after cold, warm, and concurrent probes establish ensure success ≥99.5%, warm entry p95 ≤1 second, cold entry p95 ≤5 seconds, and a bounded maximum retry delay. Revisit the cross-service boundary through an ADR if those gates cannot be met.
3. **Flags are runtime controls, not `VITE_*` build constants.** Use independently evaluated `ownerWorkspace`, `guestWorkspace`, and `playlistImports` flags with stable account allowlists/percentage cohorts, exposure telemetry, server kill switches, documented cache/propagation behavior, and rollback without rebuilding frontend assets.
4. **Queue replacement is server-transactional.** Add `POST /api/music/queue/replace` with `Idempotency-Key`, expected queue revision, owner/playlist predicates, all-or-nothing database semantics, and a canonical queue response. The client must not stop/delete/add/play through multiple calls while calling that sequence atomic.
5. **Guest playback is local only.** Rename the restored setting to `allowGuestLocalPlayback`; it permits media playback only in the guest browser. Remote control of an owner device is excluded and requires a separate lease/consent design.
6. **Historic sharing fails closed.** Preserve stored publication data, but do not expose newly restored playlists/history until the owner accepts the current sharing policy and previews the result. Guest requests default off; public discovery follows capability-only validation.
7. **Provider work has a pre-build gate.** Before imports, verify real YouTube embed/API behavior in Chromium and WebKit, Spotify/YouTube credentials, quota/cost, attribution, storage and policy constraints, and rate-limit UX. Keep Spotify/imports independently disabled if the gate fails.
8. **Testing is split by determinism.** CI uses provider/OAuth fakes; staging uses live-provider desktop/mobile smoke tests; controlled Google authentication runs outside every-PR deterministic CI. Real media smoke tests assert playback time advances.
9. **Production activation is separate authority.** This implementation plan ends at a merge-ready artifact plus test-environment evidence. A separate release checklist names the release owner, cohort, observation window, numeric abort thresholds, activation approval, and rollback authority.

## Revised Slice Gates

| Slice | User value | Entry gate | Exit evidence |
|---|---|---|---|
| A | Reliable entry and owner search/queue/player/history | Identity SLOs above | playback-start success ≥99%, no unexpected Music 5xx in UAT, desktop + WebKit smoke green |
| B | Saved playlist lifecycle | Slice A canary stable | playlist create/edit/reorder/play transaction tests and UAT green |
| C | Capability-only guest collaboration | Owner sharing reconfirmation and abuse controls | request completion, capability revoke/rotate, privacy matrix, rate-limit UAT green |
| D | Imports and guest-local playback | Provider readiness and entitlement gates | provider success/quota telemetry and live smoke green |

Each runtime flag records exposure. Canary configuration must specify cohort membership, minimum 24-hour observation (or 100 successful qualified sessions, whichever is later), decision owner, and automatic rollback triggers: identity success <99.5%, playback-start success <99%, unexpected Music 5xx >0.5%, or any cross-account/privacy violation.

## Mandatory Execution Order

The numeric task labels preserve review history; executors follow this dependency order:

1. **Foundation:** Task 10 (identity SLO gate), then the runtime-decision work in Task 8.
2. **Owner core / Slice A:** Task 1 queue transaction subset → Task 3 queue/search clients → Tasks 5 and 6 → Task 8 owner composition.
3. **Saved playlists / Slice B:** remaining Task 1 settings/schema work → Task 7.
4. **Guest collaboration / Slice C:** Task 9, capability-only and requests-off by default.
5. **Provider features / Slice D:** provider readiness spike → Task 2 imports → guest-local playback.
6. **Qualification:** Task 4 invalidation-only sockets, Task 11 deterministic/live test lanes, then Task 12 merge-ready handoff.

No later slice starts until the prior slice’s entry and exit gates are recorded. Sockets carry invalidation and opaque guest-request notifications only; synchronized multi-device playback is excluded until a separate lease/revision design exists.

## Runtime Feature Decision Contract

Create `tunes/server/services/musicFeatureDecisionService.ts`, `tunes/server/routes/musicFeatureRoutes.ts`, and matching tests. `GET /api/music/features` returns `{ ownerWorkspace, guestWorkspace, playlistImports, exposureId, expiresAt }` for the verified account. Decision precedence is emergency server kill switch → explicit account allowlist → stable salted percentage cohort → false. Cache TTL is at most 60 seconds; account switch clears it; malformed/unavailable responses fail closed. Public guest bootstrap returns only the applicable guest flag after capability authorization. Exposure logs contain flag, boolean decision, cohort version, and opaque exposure ID—never account PII or capability material.

## Persistence and Idempotency Contract

Add Drizzle schema and additive migrations for fail-closed Music settings, `sharingPolicyVersionAcceptedAt`, queue revision, and durable owner-scoped operations. The operation key is `(musicUserId, operation, idempotencyKey)` and stores request hash, status, response, and expiry. Exact replay returns the stored status/body; key reuse with different input returns `409`; simultaneous duplicates serialize. Settings columns are `NOT NULL DEFAULT false`. Migrations must remain compatible with the previous server image and require no destructive down-migration.

## UI Implementation Contract

- Desktop: persistent player region, search above the primary content, Queue default, then Playlists and History; sharing/guest controls live in the secondary settings area.
- Tablet: player, search, then content tabs. Mobile: sticky mini-player, Player/Queue/Search/More navigation, safe-area handling, card rows, no horizontal page scroll, and 44×44px touch targets.
- Empty accounts minimize inactive player chrome and focus “Add your first song.” Background refresh preserves content. Stale/offline state disables unsafe canonical mutations but retains local pause/mute/volume.
- Tabs use ARIA tab relationships and arrow navigation; sliders expose values; mutation/import status uses live regions; dialogs restore focus; reorder always provides Move up/down controls; visible focus, reduced motion, WCAG AA contrast, 200% zoom, keyboard-only, and axe checks are release gates.
- Guest capability bootstrap uses an approved one-time fragment/route token, moves it into session-scoped memory, removes it from visible URL/history immediately, and sends it only as `X-Music-Guest-Capability`. Wrong, missing, revoked, and private resources render the same neutral unavailable page.
- Guest copy says: “Let visitors play shared songs on their own device. This never controls your player.” Guest play/pause/seek cannot mutate owner queue, history, or player state.
- Panel errors stay adjacent to the affected control; request IDs appear only under Technical details. Toasts supplement rather than replace durable feedback.

## Provider and Test-Lane Gate

Before Task 2, run a read-only provider spike covering strict provider host/path parsing, redirect/size/time/item bounds, SSRF protections, quota/cost, credentials ownership, attribution/storage policy, autoplay and actual media-time advancement in Chromium and WebKit. CI uses deterministic provider/OAuth fakes. Staging uses controlled live-provider smoke tests. Google authentication uses scheduled controlled-account tests rather than every-PR live OAuth. Expected `401/403/404/409/429/503` responses are asserted per test; only unexpected responses fail the network audit.

## File Structure

### Tunes canonical domain

- Modify `tunes/server/repositories/musicDomainRepository.ts`: persist and retrieve guest settings, perform transactional queue replacement, and write bounded imports under owner predicates.
- Create `tunes/server/services/musicPlaylistImportService.ts`: normalize YouTube/Spotify imports and enforce item limits without accepting owner authority.
- Modify `tunes/server/routes/musicSurfaceRoutes.ts`: expose canonical settings and import routes.
- Modify `tunes/server/routes/musicOpenApiRoutes.ts`: document exact request/response contracts.
- Modify `tunes/server/routes/index.ts`: inject import dependencies.
- Test in `tunes/server/test/music-domain-repository.test.ts`, `music-surface-routes.test.ts`, `music-socket-server.test.ts`, and `contracts/music-openapi-contract.test.ts`.

### Explorers Music domain clients

- Modify `explorers-earth/src/features/music/musicWorkspaceClient.ts`: common domain types plus playlist metadata operations.
- Create `musicQueueClient.ts`, `musicSearchClient.ts`, `musicGuestSettingsClient.ts`, and `musicSocketClient.ts`: one responsibility per transport client.
- Modify `publicMusicClient.ts`: capability-scoped public search/request operations.
- Test each client under `explorers-earth/src/features/music/__tests__/`.

### Explorers Music UI

- Create `explorers-earth/src/features/music/components/` modules for shell, search, player, queue, history, playlists, guest controls, and guest workspace.
- Modify `explorers-earth/src/components/MusicDashboard.tsx`: compose the owner modules.
- Modify `explorers-earth/src/pages/public/PublicMusic.tsx`: compose the public modules without owner authority.
- Modify `explorers-earth/src/pages/Music.tsx`: select full or minimal workspace through the rollout flag.
- Create component tests beside the existing `MusicDashboard` and Music feature tests.

### Qualification and release

- Create `explorers-earth/e2e/music-complete-experience.spec.ts`.
- Modify `.github/workflows/ci.yml` only if the Music E2E project is not already part of required CI.
- Modify `docs/operations/music-deploy-runbook.md` with flag, UAT, canary, and rollback commands.

---

### Task 1: Lock the canonical guest-settings contract

**Files:**
- Modify: `tunes/server/repositories/musicDomainRepository.ts`
- Modify: `tunes/server/routes/musicSurfaceRoutes.ts`
- Modify: `tunes/server/routes/musicOpenApiRoutes.ts`
- Test: `tunes/server/test/music-domain-repository.test.ts`
- Test: `tunes/server/test/music-surface-routes.test.ts`
- Test: `tunes/server/test/contracts/music-openapi-contract.test.ts`

**Interfaces:**
- Consumes: `req.musicPrincipal.musicUserId` from `createMusicPrincipalMiddleware`.
- Produces: `MusicGuestSettings`, settings repository methods/routes, `repository.replaceQueue(ownerId, expectedRevision, songs)`, and `POST /api/music/queue/replace`.

- [ ] **Step 1: Write failing repository and route tests**

```ts
const settings = {
  allowSongRequests: true,
  allowGuestLocalPlayback: false,
  allowPlaylistSharing: true,
  allowRecentlyPlayedVisibility: false,
};

expect(await repository.getGuestSettings(7)).toEqual(settings);
await request(app)
  .patch("/api/music/settings")
  .set(ownerCredentialHeaders)
  .set("Origin", "https://explorers.earth")
  .send({ allowSongRequests: false })
  .expect(200)
  .expect(({ body }) => expect(body.allowSongRequests).toBe(false));
```

Add negative cases for unknown keys, non-booleans, absent principal, forbidden origin, and an injected `ownerId`/`username` field. Assert another owner remains unchanged.

Add queue-replacement tests for success, stale revision `409`, idempotent replay, foreign playlist/song denial, injected failure rollback, and the canonical ordered queue response.

- [ ] **Step 2: Run the focused tests and confirm red**

Run: `cd tunes && npm test -- server/test/music-domain-repository.test.ts server/test/music-surface-routes.test.ts server/test/contracts/music-openapi-contract.test.ts`

Expected: FAIL because settings methods/routes and OpenAPI paths do not exist.

- [ ] **Step 3: Implement the minimal owner-predicated contract**

```ts
export interface MusicGuestSettings {
  allowSongRequests: boolean;
  allowGuestLocalPlayback: boolean;
  allowPlaylistSharing: boolean;
  allowRecentlyPlayedVisibility: boolean;
}

type MusicGuestSettingsPatch = Partial<MusicGuestSettings>;
```

Use an exact allowlist of the four keys. Read and update by `ownerId` only, return the complete settings object, default every restored guest capability to false, and add OpenAPI schemas and `200/400/401/403/503` responses. Add migration/backfill coverage proving existing accounts do not gain exposure. Implement queue replacement inside one database transaction with expected revision and durable idempotency-result storage.

- [ ] **Step 4: Verify the focused contract is green**

Run: `cd tunes && npm test -- server/test/music-domain-repository.test.ts server/test/music-surface-routes.test.ts server/test/contracts/music-openapi-contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the settings contract**

```bash
git add tunes/server/repositories/musicDomainRepository.ts tunes/server/routes/musicSurfaceRoutes.ts tunes/server/routes/musicOpenApiRoutes.ts tunes/server/test/music-domain-repository.test.ts tunes/server/test/music-surface-routes.test.ts tunes/server/test/contracts/music-openapi-contract.test.ts
git commit -m "feat(music): add canonical guest settings"
```

### Task 2: Restore secured playlist imports

**Files:**
- Create: `tunes/server/services/musicPlaylistImportService.ts`
- Modify: `tunes/server/services/youtube-playlist-import.ts`
- Modify: `tunes/server/services/spotify-playlist-import.ts`
- Modify: `tunes/server/repositories/musicDomainRepository.ts`
- Modify: `tunes/server/routes/musicSurfaceRoutes.ts`
- Modify: `tunes/server/routes/musicOpenApiRoutes.ts`
- Modify: `tunes/server/routes/index.ts`
- Test: `tunes/server/test/music-playlist-import-service.test.ts`
- Test: `tunes/server/test/music-surface-routes.test.ts`

**Interfaces:**
- Consumes: verified `musicUserId`, `resolveEntitlement(ownerId)`, existing YouTube/Spotify import adapters, and owner-predicated queue/playlist repository methods.
- Produces: `importPlaylist(ownerId, input)` and `POST /api/music/imports`.

- [ ] **Step 1: Write failing service and route tests**

```ts
type MusicImportInput = {
  source: "youtube" | "spotify";
  url: string;
  destination: { kind: "queue" } | { kind: "playlist"; playlistId: number };
};

type MusicImportResult = {
  addedCount: number;
  skippedCount: number;
  truncated: boolean;
};
```

Cover YouTube and Spotify normalization, queue and saved-playlist destinations, a 100-song maximum, duplicate skipping, playlist ownership, missing provider configuration, invalid/private URL, entitlement denial, idempotent replay, and forbidden owner-target fields.

- [ ] **Step 2: Run the import tests and confirm red**

Run: `cd tunes && npm test -- server/test/music-playlist-import-service.test.ts server/test/music-surface-routes.test.ts`

Expected: FAIL because the canonical import service and route do not exist and `/api/music/paid/import` still returns `410`.

- [ ] **Step 3: Implement the normalized import service and route**

Use the provider adapters only to retrieve song metadata. The service receives `ownerId` from the route, verifies entitlement and playlist ownership, normalizes `{ youtubeId, title, artist, thumbnailUrl }`, applies the 100-song bound, and writes through owner-predicated repository methods. Require `Idempotency-Key` and return `201 MusicImportResult`.

- [ ] **Step 4: Verify import tests and OpenAPI**

Run: `cd tunes && npm test -- server/test/music-playlist-import-service.test.ts server/test/music-surface-routes.test.ts server/test/contracts/music-openapi-contract.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit canonical imports**

```bash
git add tunes/server/services/musicPlaylistImportService.ts tunes/server/services/youtube-playlist-import.ts tunes/server/services/spotify-playlist-import.ts tunes/server/repositories/musicDomainRepository.ts tunes/server/routes/musicSurfaceRoutes.ts tunes/server/routes/musicOpenApiRoutes.ts tunes/server/routes/index.ts tunes/server/test/music-playlist-import-service.test.ts tunes/server/test/music-surface-routes.test.ts tunes/server/test/contracts/music-openapi-contract.test.ts
git commit -m "feat(music): restore secured playlist imports"
```

### Task 3: Expand credential-aware Music clients

**Files:**
- Modify: `explorers-earth/src/features/music/musicWorkspaceClient.ts`
- Create: `explorers-earth/src/features/music/musicQueueClient.ts`
- Create: `explorers-earth/src/features/music/musicSearchClient.ts`
- Create: `explorers-earth/src/features/music/musicGuestSettingsClient.ts`
- Test: `explorers-earth/src/features/music/__tests__/musicQueueClient.test.ts`
- Test: `explorers-earth/src/features/music/__tests__/musicSearchClient.test.ts`
- Test: `explorers-earth/src/features/music/__tests__/musicGuestSettingsClient.test.ts`
- Modify: `explorers-earth/src/features/music/__tests__/musicWorkspaceClient.test.ts`

**Interfaces:**
- Consumes: `LocalMusicRequest` and the credential-aware request function from `localTunesApiClient`.
- Produces: domain types and `createMusicQueueClient`, `createMusicSearchClient`, and `createMusicGuestSettingsClient`.

- [ ] **Step 1: Write failing client contract tests**

```ts
export interface MusicSong {
  id: number;
  youtubeId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  position: number;
  status: "queued" | "playing" | "played";
  playedAt: string | null;
}
```

Assert exact methods: `loadDashboard`, `addSong`, `setPlaying`, `removeSong`, `removeSongs`, `moveSong`, `clearHistory`, `searchYouTube`, `videoFromUrl`, `importPlaylist`, `loadSettings`, and `updateSettings`. Verify method, path, body, idempotency key, response parsing, retry metadata, and no owner identifier.

- [ ] **Step 2: Run client tests and confirm red**

Run: `cd explorers-earth && npm run test:unit -- src/features/music/__tests__/musicQueueClient.test.ts src/features/music/__tests__/musicSearchClient.test.ts src/features/music/__tests__/musicGuestSettingsClient.test.ts`

Expected: FAIL because the clients do not exist.

- [ ] **Step 3: Implement thin domain clients**

Each client delegates transport to the supplied request function, uses shared contained error parsing, returns typed domain values, and generates no owner authority. Extend `MusicSong` with `youtubeId`, `status`, and `playedAt` so player/search/queue modules share one type.

- [ ] **Step 4: Run client and critical boundary tests**

Run: `cd explorers-earth && npm run test:unit -- src/features/music/__tests__/musicQueueClient.test.ts src/features/music/__tests__/musicSearchClient.test.ts src/features/music/__tests__/musicGuestSettingsClient.test.ts src/features/music/__tests__/musicWorkspaceClient.test.ts src/features/music/__tests__/legacyMusicBoundary.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the client layer**

```bash
git add explorers-earth/src/features/music/musicWorkspaceClient.ts explorers-earth/src/features/music/musicQueueClient.ts explorers-earth/src/features/music/musicSearchClient.ts explorers-earth/src/features/music/musicGuestSettingsClient.ts explorers-earth/src/features/music/__tests__
git commit -m "feat(music): add secured workspace clients"
```

### Task 4: Add authenticated socket state synchronization

**Files:**
- Create: `explorers-earth/src/features/music/musicSocketClient.ts`
- Test: `explorers-earth/src/features/music/__tests__/musicSocketClient.test.ts`
- Modify: `tunes/server/test/music-socket-server.test.ts`

**Interfaces:**
- Consumes: current Music credential getter, Socket.IO server owner `player_state` receive allowlist, and guest `guest_request` delivery.
- Produces: `createMusicSocketClient({ baseUrl, getCredential, onInvalidate })` with `connect`, `disconnect`, and `broadcastPlayerState`.

- [ ] **Step 1: Write failing client and authorization tests**

```ts
type PlayerState = {
  songId: number | null;
  playing: boolean;
  positionSeconds: number;
  emittedAt: string;
};
```

Assert credential handshake, exact origin/server enforcement, owner event emission, guest request reception, reconnect invalidation, expired credential disconnect, account-change disconnect, payload bounds, and that guest credentials cannot emit `player_state`.

- [ ] **Step 2: Run socket tests and confirm red**

Run: `cd explorers-earth && npm run test:unit -- src/features/music/__tests__/musicSocketClient.test.ts`

Expected: FAIL because the frontend socket client does not exist.

- [ ] **Step 3: Implement socket client with REST refetch semantics**

Connect with `auth: { credential }`; never place credentials in the URL. Throttle `player_state` to the server contract. Call `onInvalidate("reconnect" | "guest_request" | "sequence_gap")` instead of treating socket payloads as durable state.

- [ ] **Step 4: Verify frontend and server socket suites**

Run: `cd explorers-earth && npm run test:unit -- src/features/music/__tests__/musicSocketClient.test.ts`

Run: `cd tunes && npm test -- server/test/music-socket-server.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit socket synchronization**

```bash
git add explorers-earth/src/features/music/musicSocketClient.ts explorers-earth/src/features/music/__tests__/musicSocketClient.test.ts tunes/server/test/music-socket-server.test.ts
git commit -m "feat(music): add authenticated realtime sync"
```

### Task 5: Rebuild search and queue modules

**Files:**
- Create: `explorers-earth/src/features/music/components/MusicSearch.tsx`
- Create: `explorers-earth/src/features/music/components/MusicQueue.tsx`
- Test: `explorers-earth/src/features/music/components/__tests__/MusicSearch.test.tsx`
- Test: `explorers-earth/src/features/music/components/__tests__/MusicQueue.test.tsx`

**Interfaces:**
- Consumes: `MusicSong`, `musicSearchClient`, `musicQueueClient`, and playlist destination choices.
- Produces: controlled components with success callbacks that invalidate only dashboard or playlist queries.

- [ ] **Step 1: Write failing interaction tests**

Test text search, next page, URL lookup, multi-select, queue/playlist destination, YouTube/Spotify import, entitlement-disabled Spotify state, empty results, retryable errors, play-now, remove, bulk clear, and keyboard-accessible reorder. Assert no uncaught promise rejection.

- [ ] **Step 2: Run component tests and confirm red**

Run: `cd explorers-earth && npm run test:unit -- src/features/music/components/__tests__/MusicSearch.test.tsx src/features/music/components/__tests__/MusicQueue.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement the focused components**

Use explicit modes `search | url | import`, retain previous UI copy where it remains accurate, and expose mutation busy/error state within the affected control. Queue reorder calls `moveSong(song.id, position, idempotencyKey)` and rolls back its local order on error.

- [ ] **Step 4: Verify interactions and accessibility queries**

Run: `cd explorers-earth && npm run test:unit -- src/features/music/components/__tests__/MusicSearch.test.tsx src/features/music/components/__tests__/MusicQueue.test.tsx`

Expected: PASS with controls discoverable by role/name.

- [ ] **Step 5: Commit search and queue**

```bash
git add explorers-earth/src/features/music/components/MusicSearch.tsx explorers-earth/src/features/music/components/MusicQueue.tsx explorers-earth/src/features/music/components/__tests__
git commit -m "feat(music): restore search and queue"
```

### Task 6: Rebuild player and history modules

**Files:**
- Create: `explorers-earth/src/features/music/components/MusicPlayer.tsx`
- Create: `explorers-earth/src/features/music/components/MusicHistory.tsx`
- Test: `explorers-earth/src/features/music/components/__tests__/MusicPlayer.test.tsx`
- Test: `explorers-earth/src/features/music/components/__tests__/MusicHistory.test.tsx`

**Interfaces:**
- Consumes: current/queued/history songs, `setPlaying`, socket `broadcastPlayerState`, and refresh callbacks.
- Produces: media controls and bounded recovery without direct identity or ownership inputs.

- [ ] **Step 1: Write failing media lifecycle tests**

Cover play/pause, seek, volume/mute, next, previous-from-history, ended transition, autoplay rejection, two bounded recovery attempts, unavailable-video skip, current-song change, socket broadcast, clear history, loading, and empty states. Mock React Player through its public media callbacks.

- [ ] **Step 2: Run player/history tests and confirm red**

Run: `cd explorers-earth && npm run test:unit -- src/features/music/components/__tests__/MusicPlayer.test.tsx src/features/music/components/__tests__/MusicHistory.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement player and history**

Keep media-only state (`playing`, `volume`, `muted`, `progress`) local. Persist queue/history transitions through the queue client. Broadcast bounded state after confirmed media transitions. Never auto-skip more than once per failed song after two recovery attempts.

- [ ] **Step 4: Verify player and history behavior**

Run: `cd explorers-earth && npm run test:unit -- src/features/music/components/__tests__/MusicPlayer.test.tsx src/features/music/components/__tests__/MusicHistory.test.tsx`

Expected: PASS and no unhandled promise output.

- [ ] **Step 5: Commit player and history**

```bash
git add explorers-earth/src/features/music/components/MusicPlayer.tsx explorers-earth/src/features/music/components/MusicHistory.tsx explorers-earth/src/features/music/components/__tests__
git commit -m "feat(music): restore player and history"
```

### Task 7: Complete playlists and guest controls

**Files:**
- Create: `explorers-earth/src/features/music/components/MusicPlaylists.tsx`
- Create: `explorers-earth/src/features/music/components/MusicGuestControls.tsx`
- Test: `explorers-earth/src/features/music/components/__tests__/MusicPlaylists.test.tsx`
- Test: `explorers-earth/src/features/music/components/__tests__/MusicGuestControls.test.tsx`

**Interfaces:**
- Consumes: workspace, search, queue, settings, and publication clients.
- Produces: complete saved-playlist and sharing interactions.

- [ ] **Step 1: Write failing playlist/control tests**

Cover create, rename, description, delete confirmation, visibility, add/remove/reorder songs, append, replace-and-play, shuffle-and-play, publication mode, capability-link presentation, song-request permission, guest playback permission, playlist sharing, history visibility, optimistic rollback, and partial errors.

- [ ] **Step 2: Run tests and confirm red**

Run: `cd explorers-earth && npm run test:unit -- src/features/music/components/__tests__/MusicPlaylists.test.tsx src/features/music/components/__tests__/MusicGuestControls.test.tsx`

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Implement playlist and guest-control modules**

Use existing `Button`, modal/confirmation, tabs, toast, and publication registry primitives. Replace the queue only through `POST /api/music/queue/replace`, passing the expected queue revision and an idempotency key. On `409`, refetch and ask the owner to retry; no partial queue state may commit.

- [ ] **Step 4: Verify playlist/control tests**

Run: `cd explorers-earth && npm run test:unit -- src/features/music/components/__tests__/MusicPlaylists.test.tsx src/features/music/components/__tests__/MusicGuestControls.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit playlists and controls**

```bash
git add explorers-earth/src/features/music/components/MusicPlaylists.tsx explorers-earth/src/features/music/components/MusicGuestControls.tsx explorers-earth/src/features/music/components/__tests__
git commit -m "feat(music): complete playlists and guest controls"
```

### Task 8: Compose the responsive owner workspace behind a rollback flag

**Files:**
- Create: `explorers-earth/src/features/music/components/MusicWorkspaceShell.tsx`
- Modify: `explorers-earth/src/components/MusicDashboard.tsx`
- Modify: `explorers-earth/src/pages/Music.tsx`
- Create: `explorers-earth/src/features/music/musicRollout.ts`
- Create: `tunes/server/services/musicFeatureDecisionService.ts`
- Create: `tunes/server/routes/musicFeatureRoutes.ts`
- Test: `tunes/server/test/music-feature-decision-service.test.ts`
- Test: `tunes/server/test/music-feature-routes.test.ts`
- Test: `explorers-earth/src/components/__tests__/MusicDashboard.test.tsx`
- Test: `explorers-earth/src/pages/__tests__/MusicPage.test.tsx`
- Test: `explorers-earth/src/features/music/__tests__/musicRollout.test.ts`

**Interfaces:**
- Consumes: Tasks 3-7 clients/components and current `musicState` precedence.
- Produces: runtime `MusicFeatureExposure` for `ownerWorkspace`, `guestWorkspace`, and `playlistImports`, plus the complete owner page.

- [ ] **Step 1: Write failing composition and flag tests**

Assert the player is the visual anchor; tabs are Queue, Guest controls, Recently played, and Playlists; search is reachable; empty state leads with “Add your first song”; mobile navigation exposes player/queue/search; loading preserves the shell; stale content is read-only; identity retry remains contained; and runtime `ownerWorkspace=false` renders the existing minimal workspace without an asset rebuild.

- [ ] **Step 2: Run composition tests and confirm red**

Run: `cd explorers-earth && npm run test:unit -- src/components/__tests__/MusicDashboard.test.tsx src/pages/__tests__/MusicPage.test.tsx src/features/music/__tests__/musicRollout.test.ts`

Run: `cd tunes && npm test -- server/test/music-feature-decision-service.test.ts server/test/music-feature-routes.test.ts`

Expected: FAIL because the shell and rollout selector do not exist.

- [ ] **Step 3: Compose the workspace without restoring the monolith**

Keep `MusicDashboard` responsible for query composition and tab selection only. Render each module with typed props and stable callbacks. Resolve runtime exposure from the authenticated account and server response, default every flag to false, record exposure, and honor the kill switch without rebuilding assets.

- [ ] **Step 4: Verify owner UI and legacy security boundary**

Run: `cd explorers-earth && npm run test:unit -- src/components/__tests__/MusicDashboard.test.tsx src/pages/__tests__/MusicPage.test.tsx src/features/music/__tests__/musicRollout.test.ts src/features/music/__tests__/legacyMusicBoundary.test.ts`

Run: `cd explorers-earth && npm run build`

Expected: PASS; bundle check reports no retired Music surface.

- [ ] **Step 5: Commit owner composition**

```bash
git add explorers-earth/src/features/music/components/MusicWorkspaceShell.tsx explorers-earth/src/components/MusicDashboard.tsx explorers-earth/src/pages/Music.tsx explorers-earth/src/features/music/musicRollout.ts explorers-earth/src/components/__tests__/MusicDashboard.test.tsx explorers-earth/src/pages/__tests__/MusicPage.test.tsx explorers-earth/src/features/music/__tests__/musicRollout.test.ts tunes/server/services/musicFeatureDecisionService.ts tunes/server/routes/musicFeatureRoutes.ts tunes/server/test/music-feature-decision-service.test.ts tunes/server/test/music-feature-routes.test.ts
git commit -m "feat(music): compose complete owner workspace"
```

### Task 9: Restore the capability-scoped guest workspace

**Files:**
- Modify: `explorers-earth/src/features/music/publicMusicClient.ts`
- Create: `explorers-earth/src/features/music/components/GuestMusicWorkspace.tsx`
- Modify: `explorers-earth/src/pages/public/PublicMusic.tsx`
- Modify: `explorers-earth/src/features/music/__tests__/publicMusicClient.test.ts`
- Create: `explorers-earth/src/features/music/components/__tests__/GuestMusicWorkspace.test.tsx`

**Interfaces:**
- Consumes: public slug/capability, public playlist route, guest search/URL/request routes, publication settings, and guest socket reception.
- Produces: public read/request UI with no owner credential or username.

- [ ] **Step 1: Write failing public client and UI tests**

Cover public/unlisted/private/revoked resources, capability header placement, noindex response handling, visible playlists/history policy, bounded search and song request, disabled request state, guest playback policy, mobile navigation, rate limiting, socket updates, and non-enumerating errors.

- [ ] **Step 2: Run public tests and confirm red**

Run: `cd explorers-earth && npm run test:unit -- src/features/music/__tests__/publicMusicClient.test.ts src/features/music/components/__tests__/GuestMusicWorkspace.test.tsx`

Expected: FAIL because the public client lacks operations and the workspace does not exist.

- [ ] **Step 3: Implement capability-scoped guest UI**

Send capability only in `X-Music-Guest-Capability`; never persist it beyond current session state or include it in diagnostics. Render only server-authorized fields and actions. A `404` remains a generic unavailable page for private, revoked, missing, or incorrect capability cases.

- [ ] **Step 4: Verify guest and security tests**

Run: `cd explorers-earth && npm run test:unit -- src/features/music/__tests__/publicMusicClient.test.ts src/features/music/components/__tests__/GuestMusicWorkspace.test.tsx src/features/music/__tests__/legacyMusicBoundary.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit guest workspace**

```bash
git add explorers-earth/src/features/music/publicMusicClient.ts explorers-earth/src/features/music/components/GuestMusicWorkspace.tsx explorers-earth/src/pages/public/PublicMusic.tsx explorers-earth/src/features/music/__tests__/publicMusicClient.test.ts explorers-earth/src/features/music/components/__tests__/GuestMusicWorkspace.test.tsx
git commit -m "feat(music): restore secured guest workspace"
```

### Task 10: Establish the identity reliability gate before domain/UI execution

**Files:**
- Modify: `explorers-earth/src/features/music/musicIdentityCoordinator.ts`
- Modify: `explorers-earth/src/lib/localTunesApiClient.ts`
- Modify: `explorers-earth/src/features/music/__tests__/musicIdentityCoordinator.test.ts`
- Modify: `explorers-earth/src/lib/__tests__/localTunesApiClient.test.ts`
- Modify: `tunes/server/routes/musicIdentityRoutes.ts`
- Modify: `tunes/server/test/music-identity-route.test.ts`

**Interfaces:**
- Consumes: current credential expiry, stable Music error envelope, `Retry-After`, and request ID response header.
- Produces: bounded retry classification and sanitized correlation metadata.

- [ ] **Step 1: Write failing reliability tests**

Assert valid credentials skip ensure, near-expiry credentials refresh once, concurrent callers share one ensure promise, retryable `503` honors `Retry-After`, non-retryable `401/403` does not retry, the maximum is two retries, request IDs are returned to UI error state, account changes cancel old work, and server logs contain only event/outcome/status/latency/requestId.

- [ ] **Step 2: Run reliability tests and confirm red**

Run: `cd explorers-earth && npm run test:unit -- src/features/music/__tests__/musicIdentityCoordinator.test.ts src/lib/__tests__/localTunesApiClient.test.ts`

Run: `cd tunes && npm test -- server/test/music-identity-route.test.ts`

Expected: at least one new retry/correlation assertion fails.

- [ ] **Step 3: Implement bounded retry and correlation**

Reuse credentials until the configured refresh window, deduplicate ensure/refresh per account, retry only errors with `retryable: true`, cap total attempts at three, honor bounded `Retry-After`, and expose the sanitized request ID through `MusicClientError`. Do not log or surface credential material.

- [ ] **Step 4: Verify reliability and critical coverage**

Run: `cd explorers-earth && npm run test:music-critical-coverage`

Run: `cd tunes && npm run test:music-critical-coverage`

Expected: PASS at existing per-file 100% thresholds.

- [ ] **Step 5: Commit identity hardening**

```bash
git add explorers-earth/src/features/music/musicIdentityCoordinator.ts explorers-earth/src/lib/localTunesApiClient.ts explorers-earth/src/features/music/__tests__/musicIdentityCoordinator.test.ts explorers-earth/src/lib/__tests__/localTunesApiClient.test.ts tunes/server/routes/musicIdentityRoutes.ts tunes/server/test/music-identity-route.test.ts
git commit -m "fix(music): harden identity retry diagnostics"
```

### Task 11: Add complete owner and guest E2E qualification

**Files:**
- Create: `explorers-earth/e2e/music-complete-experience.spec.ts`
- Modify: `explorers-earth/playwright.config.ts`
- Modify: `.github/workflows/ci.yml` if the new Music project is not already selected by required CI

**Interfaces:**
- Consumes: seeded email/Google/existing-account fixtures, secured Tunes test deployment, and rollout flag.
- Produces: repeatable browser qualification and CI evidence.

- [ ] **Step 1: Write failing E2E journeys**

Create named tests for existing-account entry, email onboarding, Google onboarding, search-to-history, playlist lifecycle, guest request-to-owner update, logout/login, account switch, credential expiry, mobile navigation, and clean console/network output. Collect unexpected console errors and Music `4xx/5xx` responses; fail after each journey if either list is non-empty.

- [ ] **Step 2: Run against local test services and confirm the first incomplete journey fails**

Run: `cd explorers-earth && npx playwright test e2e/music-complete-experience.spec.ts --project=chromium`

Expected: FAIL at the first behavior not yet wired or fixture not configured; no test is skipped silently.

- [ ] **Step 3: Complete fixture/config wiring only**

Add a `music` Playwright project with desktop Chromium and a `music-mobile` project using a representative mobile device. Read credentials and base URLs from CI/test environment secrets; never commit credentials. Preserve screenshots, traces, and videos on failure.

- [ ] **Step 4: Run desktop and mobile Music E2E**

Run: `cd explorers-earth && npx playwright test e2e/music-complete-experience.spec.ts --project=music --project=music-mobile`

Expected: PASS with no unexpected Music console errors or network failures.

- [ ] **Step 5: Commit qualification**

```bash
git add explorers-earth/e2e/music-complete-experience.spec.ts explorers-earth/playwright.config.ts .github/workflows/ci.yml
git commit -m "test(music): qualify complete owner and guest journeys"
```

### Task 12: Run full review, deploy to test, UAT, and prepare release handoff

**Files:**
- Modify: `docs/operations/music-deploy-runbook.md`
- Modify: test/prod workflow environment files only where the rollout flag is explicitly set

**Interfaces:**
- Consumes: Tasks 1-11, existing immutable Tunes deployment workflow, Explorers deployment workflow, test-server approval, and rollback image/flag.
- Produces: merge-ready PR, test UAT evidence, immutable artifact evidence, and a separate release checklist awaiting explicit production approval.

- [ ] **Step 1: Document exact rollout and rollback controls**

Record the three runtime flags, cohort/allowlist source, propagation SLA, expected Tunes commit/digest/migration marker, test URL, readiness endpoints, identity request-ID lookup, kill-switch rollback, and immutable image rollback. State that disabling a flag preserves all Music data.

- [ ] **Step 2: Run the complete local qualification matrix**

Run: `cd tunes && npm run check && npm test && npm run test:integration && npm run build`

Run: `cd explorers-earth && npm run lint && npm run test:unit && npm run test:music-critical-coverage && npm run build`

Run: `cd explorers-earth && npx playwright test e2e/music-complete-experience.spec.ts --project=music --project=music-mobile`

Expected: every command exits `0`; coverage retains required thresholds; production bundle boundary passes.

- [ ] **Step 3: Run pre-landing security and code review**

Invoke `superpowers:requesting-code-review`, then the repository `review` and `cso` skills. Resolve every true positive with a failing regression test first. Re-run Step 2 after the final change.

- [ ] **Step 4: Push a dedicated PR and watch required CI**

Push only this branch’s commits, create a draft PR with behavior/security/UX/testing/rollback sections, request Codex review, respond to every review thread with evidence, and keep the PR draft until all required checks are green and no unresolved true-positive comment remains.

- [ ] **Step 5: Deploy Tunes and Explorers to the test environment**

Use the existing immutable deployment route. Confirm the deployed Tunes readiness commit/digest/migration marker and the Explorers asset revision. Enable only the current slice’s runtime flag for the named test accounts.

- [ ] **Step 6: Perform authenticated test-server UAT**

Run all Task 11 journeys against the actual test URL using existing, email, Google, owner, and guest cases. Inspect desktop/mobile UI, console, network, request IDs, socket reconnect, server telemetry, and the previously observed `identity/ensure` 503 scenario. Record screenshots and sanitized evidence.

- [ ] **Step 7: Promote through canary**

Remove draft only when CI, review, and UAT are green. Merge through the protected branch process with every runtime flag disabled. Stop this implementation workflow after immutable artifact and test-environment evidence are recorded; production canary requires the separately approved release checklist and named release owner.

- [ ] **Step 8: Activate production or roll back**

In the separate release workflow, activate one slice only after its numeric gate remains green for the required observation window. On regression, use the server kill switch immediately; if the server is implicated, redeploy the prior immutable Tunes digest. Verify the minimal workspace and identity readiness after rollback.

- [ ] **Step 9: Commit operational documentation**

```bash
git add docs/operations/music-deploy-runbook.md
git commit -m "docs(music): add complete workspace rollout runbook"
```

## Dependency and Review Checkpoints

1. Tasks 1-2 are the canonical server checkpoint and may be reviewed/deployed dark.
2. Tasks 3-4 are the secured transport checkpoint and must pass legacy-boundary tests.
3. Tasks 5-8 are the owner experience checkpoint behind a disabled-by-default flag.
4. Task 9 is the guest/public checkpoint and requires coordination before shared-route edits.
5. Task 10 is the identity reliability checkpoint and must preserve critical coverage thresholds.
6. Task 11 is the browser qualification checkpoint.
7. Task 12 is the only activation checkpoint; no earlier task enables production globally.

## Completion Definition

- All twelve tasks are committed and reviewed.
- Required CI and both Music critical-coverage commands are green.
- The complete desktop and mobile owner/guest E2E suite passes locally and against the test URL.
- Email, Google, and existing accounts enter Music without another login.
- Player, search, queue, history, playlists, imports, sharing, and guest controls are visible and functional.
- No retired authority surface appears in source or production bundle.
- Identity telemetry shows bounded, explainable outcomes with no secret exposure.
- Canary passes and production activation remains reversible through the flag and immutable image rollback.

## Decision Audit Trail

| # | Phase | Decision | Classification | Rationale | Rejected |
|---|---|---|---|---|---|
| 1 | CEO | Deliver complete parity as gated vertical slices | User-approved challenge | Preserves the goal while reducing blast radius and enabling stop/go evidence | All-at-once activation |
| 2 | CEO/Eng/DX | Replace Vite flag with runtime account/cohort decisions and kill switches | Confirmed correction | Build-time flags cannot provide bounded canary or rollback without rebuild | `VITE_COMPLETE_MUSIC_WORKSPACE` |
| 3 | CEO/Eng | Execute identity qualification first with numeric SLOs | Confirmed correction | Every UI flow depends on a reliable credential boundary | Identity hardening after UI |
| 4 | CEO/Eng/Design/DX | Add transactional queue replacement | Confirmed correction | Multi-call replacement can destroy queue state | Client-orchestrated delete/add/play |
| 5 | All | Define guest playback as guest-browser-local only | Confirmed correction | Prevents misleading UX and owner-device authority regression | Remote owner player control |
| 6 | CEO/Eng | Fail historic sharing closed pending owner reconfirmation | Confirmed correction | Prevents silent republication of old playlists/history | Automatic legacy exposure |
| 7 | CEO/Eng/DX | Gate providers before import work | Confirmed correction | Quota, policy, credentials, SSRF, and mobile media behavior require proof | Treating imports as unconditional parity |
| 8 | Design | Make responsive, accessibility, state, and capability-link behavior explicit | Auto-decided completeness | Removes major UI implementation ambiguity | Visual parity without acceptance contracts |
| 9 | Eng/DX | Use durable owner-scoped idempotency and additive compatible migrations | Auto-decided safety | Required for retries, concurrency, rollback compatibility, and multi-instance operation | In-memory or unspecified replay |
| 10 | CEO | Separate merge-ready implementation from production activation authority | Confirmed correction | Production activation requires named approval and abort ownership | Implicit deploy authority inside coding task |

## Cross-Phase Review Summary

- **CEO:** Initial 5/10 → revised 9/10. Strategy is now a staged validation/restoration program with product and operational gates rather than an all-at-once parity rewrite.
- **Design:** Initial 5/10 → revised 8/10. Hierarchy, responsive layout, accessibility, surface states, guest-link handling, and durable feedback are now specified; implementation must validate them with visual/manual UAT.
- **Engineering:** Initial 4/10 → revised 8/10. Identity sequencing, runtime flags, queue transactions, fail-closed sharing, durable idempotency, provider controls, socket scope, and schema compatibility are now explicit.
- **DX:** Initial 4/10 → revised 8/10. A mandatory execution order and concrete contracts replace the conflicting override-only plan. Local E2E orchestration and troubleshooting must be implemented with Task 11.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/autoplan` | Scope & strategy | 2 voices | CLEAR | 10 accepted corrections; staged release retained complete goal |
| Codex Review | independent Codex | Adversarial second opinion | 1 | CLEAR | 15 findings analyzed; blockers incorporated |
| Eng Review | `/autoplan` | Architecture & tests | 1 | CLEAR | 16 findings; P0 contracts incorporated |
| Design Review | `/autoplan` | UI/UX gaps | 1 | CLEAR | 14 findings; core acceptance contracts incorporated |
| DX Review | `/autoplan` | Implementer experience | 1 | CLEAR | 14 findings; execution order and contracts incorporated |

**CROSS-MODEL:** Runtime rollout, identity-first sequencing, queue atomicity, guest-local semantics, fail-closed sharing, staged delivery, and provider gates were independently confirmed.

**VERDICT:** CEO + DESIGN + ENG + DX CLEARED — ready for task-by-task implementation with slice gates.

NO UNRESOLVED DECISIONS
