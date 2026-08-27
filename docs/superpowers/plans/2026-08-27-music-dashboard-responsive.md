# Responsive Music Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Explorers-native authenticated Music dashboard for desktop and mobile without weakening the secured owner-workspace contracts.

**Architecture:** Keep `MusicDashboard` as the owner coordinator and split presentation into focused discovery, player, navigation, guest-control, and playlist units. Extend existing secured clients only where an authenticated backend contract already exists; unsupported import/settings operations render honest unavailable states rather than legacy calls.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, Testing Library, Playwright, existing Music workspace clients.

**Spec:** `docs/superpowers/specs/2026-08-27-music-dashboard-responsive.md`

## Global Constraints

- Page actions remain inside Music page content, never in the global header.
- One unified input accepts search text, supported song URLs, and supported playlist URLs.
- Video is off by default.
- Minimum interactive target is 44px; mobile must not overflow horizontally.
- No retired legacy LocalTunes client or separate Tunes authentication.
- Public Music rendering remains out of scope.

---

### Task 1: Page action split control and workspace navigation

**Files:**
- Modify: `explorers-earth/src/components/MusicDashboard.tsx`
- Modify: `explorers-earth/src/features/music/components/MusicWorkspaceShell.tsx`
- Test: `explorers-earth/src/components/__tests__/MusicDashboard.test.tsx`
- Test: `explorers-earth/src/features/music/components/__tests__/MusicWorkspaceShell.test.tsx`

**Interfaces:**
- Produces: in-page `New playlist` split action and `queue | guest-controls | history | playlists` workspace navigation.
- Consumes: existing dialogs, playlist panels, and secured workspace data.

- [x] Write failing tests proving the split action is inside Music content, exposes `Sharing settings`, and the shell offers four accessible tabs with keyboard navigation.
- [x] Run the two focused test files and confirm failures are caused by missing split/tabs behavior.
- [x] Implement the minimal split action and tab model, retaining focus restoration and read-only behavior.
- [x] Run focused tests and confirm they pass (23/23).
- [x] Commit only Task 1 files (`ba20385`).

### Task 2: Unified discovery input and playlist targeting

**Files:**
- Modify: `explorers-earth/src/features/music/components/MusicSearch.tsx`
- Modify: `explorers-earth/src/features/music/musicSearchClient.ts`
- Modify: `explorers-earth/src/components/MusicDashboard.tsx`
- Test: `explorers-earth/src/features/music/components/__tests__/MusicSearch.test.tsx`
- Test: `explorers-earth/src/features/music/__tests__/musicSearchClient.test.ts`
- Test: `explorers-earth/src/components/__tests__/MusicDashboard.test.tsx`

**Interfaces:**
- Produces: `DiscoveryAction = "search" | "url" | "import-playlist"`, one input value, accessible split menu, optional playlist target.
- Consumes: `searchYouTube`, `videoFromUrl`, queue mutations, saved playlists.

- [x] Write failing tests for text search, URL mode, invalid/empty input, menu behavior, selected-result queue addition, and selected-result playlist targeting.
- [x] Confirm red failures correspond to the old separate-tab interface and missing playlist target.
- [x] Implement one input and split menu; route search and URL lookup through secured clients. Keep Import playlist visible but disabled with an explicit explanation because `/api/music/paid/import` is an intentionally retired 410 boundary.
- [x] Add playlist-target submission through a validated `musicWorkspaceClient.addPlaylistSong` method using `POST /api/playlists/:playlistId/songs` and a fresh idempotency key per selected song.
- [x] Run focused tests, then all Music search/dashboard tests (75/75).
- [ ] Commit Task 2 with `feat(music): unify discovery and playlist additions`.

### Task 3: Audio-first responsive player

**Files:**
- Modify: `explorers-earth/src/features/music/components/MusicPlayer.tsx`
- Modify: `explorers-earth/src/features/music/components/MusicWorkspaceShell.tsx`
- Test: `explorers-earth/src/features/music/components/__tests__/MusicPlayer.test.tsx`
- Test: `explorers-earth/src/features/music/components/__tests__/MusicWorkspaceShell.test.tsx`

**Interfaces:**
- Produces: audio-first compact player, `Show video` toggle, sticky mobile mini-player semantics.
- Consumes: existing ReactPlayer, queue transition, progress, volume, mute, and recovery logic.

- [x] Write failing tests proving video is hidden initially, toggle state is announced, playback controls remain available, and the mobile compact player is reachable.
- [x] Confirm tests fail because ReactPlayer is always visually expanded and no toggle exists.
- [x] Implement the minimal responsive player presentation without changing playback state transitions.
- [x] Run focused player/shell tests and confirm green (30/30).
- [ ] Commit Task 3 with `feat(music): add audio-first responsive player`.

### Task 4: Guest controls and playlist workflow integration

**Files:**
- Create: `explorers-earth/src/features/music/components/MusicGuestControls.tsx`
- Create: `explorers-earth/src/features/music/components/__tests__/MusicGuestControls.test.tsx`
- Modify: `explorers-earth/src/components/MusicDashboard.tsx`
- Modify: `explorers-earth/src/features/music/components/MusicWorkspaceShell.tsx`
- Test: `explorers-earth/src/components/__tests__/MusicDashboard.test.tsx`

**Interfaces:**
- Produces: persisted controls for the four existing server fields (`allowSongRequests`, `allowGuestPlayOnDevice`, `allowPlaylistSharing`, `allowRecentlyPlayedVisibility`) and truthful read-only explanations for any proposed visibility control without a secured mutation contract.
- Consumes: playlist CRUD/reorder/queue replacement operations and Task 2 unified discovery component.

- [x] First add a secured owner settings read/mutation contract in Tunes for the four existing persisted fields, including repository, route, OpenAPI, gateway-client, idempotency, and authorization tests. Do not add new public-page fields in this branch because another agent owns that surface.
- [x] Write failing UI tests for the four persisted guest settings, explanatory copy, read-only handling, playlist action retention, and unified discovery inside the active playlist.
- [x] Confirm red failures are missing guest controls and playlist discovery integration.
- [x] Implement the guest-control panel and reuse the unified discovery component for playlist targeting without duplicating request logic.
- [x] Preserve confirmations for destructive playlist operations and visible mutation errors.
- [x] Run focused tests and the full Music component suite.
- [ ] Commit Task 4 with `feat(music): complete guest and playlist workflows`.

### Task 5: Responsive qualification and local UAT

**Files:**
- Modify: `explorers-earth/e2e/music.spec.ts`
- Modify: `explorers-earth/e2e/music-accessibility.spec.ts`
- Modify: `explorers-earth/e2e/music-fixture-fullstack.spec.ts`
- Modify: `explorers-earth/src/components/__tests__/MusicDashboard.test.tsx`

**Interfaces:**
- Produces: repeatable desktop/mobile qualification for the accepted dashboard.
- Consumes: local Music fixture services and existing authenticated test harness.

- [ ] Write failing browser assertions for in-page action placement, unified discovery, audio/video modes, tab reachability, mobile touch layout, sticky player, and no horizontal overflow.
- [ ] Run those Playwright cases and confirm they fail against the pre-change UI for the expected reasons.
- [ ] Make only presentation/accessibility corrections needed for the browser contract.
- [ ] Run focused Vitest, the complete Music component suite, production build, and targeted Playwright suites.
- [ ] Start the local authenticated stack and perform UI UAT for search, URL, player, queue, history, playlists, sharing, guest controls, responsive layouts, console, and network failures.
- [ ] Commit Task 5 with `test(music): qualify responsive dashboard workflows`.

## Self-review

- Spec coverage: every approved desktop/mobile behavior maps to Tasks 1–5.
- Unsupported server behavior is surfaced honestly; no legacy authority is reintroduced.
- Type names and component boundaries are consistent across tasks.
- No placeholders or deferred implementation language exists for in-scope supported behavior.

## Review decisions (2026-08-27)

- Product: preserve the full owner workflow, but never imply retired playlist import works.
- Design: one always-visible input and attached split actions; New playlist remains an in-page action; no duplicate mobile navigation.
- Engineering: reuse the current secured owner gateway and idempotency model; never call the legacy Tunes browser client.
- DX/testing: every behavior ships through red-green focused tests, then full Music regression, build, Playwright, and authenticated local desktop/mobile UAT.
- Coordination: this branch does not edit the public Music page; settings contracts are shaped so the separate public-URL agent can consume them without conflicting UI edits.
