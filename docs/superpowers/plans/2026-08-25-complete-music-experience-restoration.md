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

## File Structure

### Tunes canonical domain

- Modify `tunes/server/repositories/musicDomainRepository.ts`: persist and retrieve guest settings and bounded imported songs under owner predicates.
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
- Produces: `MusicGuestSettings`, `repository.getGuestSettings(ownerId)`, `repository.updateGuestSettings(ownerId, patch)`, `GET /api/music/settings`, and `PATCH /api/music/settings`.

- [ ] **Step 1: Write failing repository and route tests**

```ts
const settings = {
  allowSongRequests: true,
  allowGuestPlayOnDevice: false,
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

- [ ] **Step 2: Run the focused tests and confirm red**

Run: `cd tunes && npm test -- server/test/music-domain-repository.test.ts server/test/music-surface-routes.test.ts server/test/contracts/music-openapi-contract.test.ts`

Expected: FAIL because settings methods/routes and OpenAPI paths do not exist.

- [ ] **Step 3: Implement the minimal owner-predicated contract**

```ts
export interface MusicGuestSettings {
  allowSongRequests: boolean;
  allowGuestPlayOnDevice: boolean;
  allowPlaylistSharing: boolean;
  allowRecentlyPlayedVisibility: boolean;
}

type MusicGuestSettingsPatch = Partial<MusicGuestSettings>;
```

Use an exact allowlist of the four keys. Read and update by `ownerId` only, return the complete settings object, and add OpenAPI schemas and `200/400/401/403/503` responses.

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

Use existing `Button`, modal/confirmation, tabs, toast, and publication registry primitives. Replace queue atomically in the UI sequence: stop current playback, bulk-remove current queued IDs, add ordered playlist songs, then set the first returned queue song as playing; surface a recoverable partial-failure state and refetch canonical dashboard.

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
- Test: `explorers-earth/src/components/__tests__/MusicDashboard.test.tsx`
- Test: `explorers-earth/src/pages/__tests__/MusicPage.test.tsx`
- Test: `explorers-earth/src/features/music/__tests__/musicRollout.test.ts`

**Interfaces:**
- Consumes: Tasks 3-7 clients/components and current `musicState` precedence.
- Produces: `isCompleteMusicWorkspaceEnabled(env, override): boolean` and the complete owner page.

- [ ] **Step 1: Write failing composition and flag tests**

Assert the player is the visual anchor; tabs are Queue, Guest controls, Recently played, and Playlists; search is reachable; empty state leads with “Add your first song”; mobile navigation exposes player/queue/search; loading preserves the shell; stale content is read-only; identity retry remains contained; and `VITE_COMPLETE_MUSIC_WORKSPACE=false` renders the existing minimal workspace.

- [ ] **Step 2: Run composition tests and confirm red**

Run: `cd explorers-earth && npm run test:unit -- src/components/__tests__/MusicDashboard.test.tsx src/pages/__tests__/MusicPage.test.tsx src/features/music/__tests__/musicRollout.test.ts`

Expected: FAIL because the shell and rollout selector do not exist.

- [ ] **Step 3: Compose the workspace without restoring the monolith**

Keep `MusicDashboard` responsible for query composition and tab selection only. Render each module with typed props and stable callbacks. Set the production default to `false`; test/test-server deployment explicitly enables it.

- [ ] **Step 4: Verify owner UI and legacy security boundary**

Run: `cd explorers-earth && npm run test:unit -- src/components/__tests__/MusicDashboard.test.tsx src/pages/__tests__/MusicPage.test.tsx src/features/music/__tests__/musicRollout.test.ts src/features/music/__tests__/legacyMusicBoundary.test.ts`

Run: `cd explorers-earth && npm run build`

Expected: PASS; bundle check reports no retired Music surface.

- [ ] **Step 5: Commit owner composition**

```bash
git add explorers-earth/src/features/music/components/MusicWorkspaceShell.tsx explorers-earth/src/components/MusicDashboard.tsx explorers-earth/src/pages/Music.tsx explorers-earth/src/features/music/musicRollout.ts explorers-earth/src/components/__tests__/MusicDashboard.test.tsx explorers-earth/src/pages/__tests__/MusicPage.test.tsx explorers-earth/src/features/music/__tests__/musicRollout.test.ts
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

### Task 10: Harden identity retries and diagnostics

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

### Task 12: Run full review, deploy to test, UAT, canary, and production activation

**Files:**
- Modify: `docs/operations/music-deploy-runbook.md`
- Modify: test/prod workflow environment files only where the rollout flag is explicitly set

**Interfaces:**
- Consumes: Tasks 1-11, existing immutable Tunes deployment workflow, Explorers deployment workflow, test-server approval, and rollback image/flag.
- Produces: merge-ready PR, test UAT evidence, canary evidence, and reversible production activation.

- [ ] **Step 1: Document exact rollout and rollback controls**

Record `VITE_COMPLETE_MUSIC_WORKSPACE`, expected Tunes commit/digest/migration marker, test URL, readiness endpoints, identity request-ID lookup, flag rollback, and immutable image rollback. State that disabling the flag preserves all Music data.

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

Use the existing immutable deployment route. Confirm the deployed Tunes readiness commit/digest/migration marker and the Explorers asset revision. Enable `VITE_COMPLETE_MUSIC_WORKSPACE=true` only on the test deployment.

- [ ] **Step 6: Perform authenticated test-server UAT**

Run all Task 11 journeys against the actual test URL using existing, email, Google, owner, and guest cases. Inspect desktop/mobile UI, console, network, request IDs, socket reconnect, server telemetry, and the previously observed `identity/ensure` 503 scenario. Record screenshots and sanitized evidence.

- [ ] **Step 7: Promote through canary**

Remove draft only when CI, review, and UAT are green. Merge through the protected branch process. Deploy immutable artifacts with the production flag initially disabled, verify readiness, enable for the bounded canary, and monitor identity success/latency, Music route `5xx`, socket authorization failures, and player startup failures.

- [ ] **Step 8: Activate production or roll back**

Activate for all users only if canary thresholds remain green and the critical owner/guest journeys pass in production. On regression, disable `VITE_COMPLETE_MUSIC_WORKSPACE` immediately; if the server is implicated, redeploy the prior immutable Tunes digest. Verify the minimal workspace and identity readiness after rollback.

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
