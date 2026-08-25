# Complete Music Experience Restoration Design

**Status:** Approved in chat on 2026-08-25  
**Scope:** Explorers authenticated Music workspace, Tunes canonical Music surfaces, and guest/public Music experience  
**Behavioral reference:** The pre-PR #102 Music experience  
**Security baseline:** The post-PR #102 Music identity, authorization, database, publication, and socket boundaries

## Problem

PR #102 replaced insecure browser-side Music identity and mutable username authority with a verified Explorers-to-Tunes credential boundary. During that work, it also removed the existing player, search, queue, history, playlist-table, and guest-navigation components. The replacement `MusicDashboard` rebuilt only playlist metadata and sharing controls.

The deployed application therefore authenticates existing Explorers accounts without a separate Tunes login, but exposes only a partial Music product. This contradicts the approved identity-provisioning plan, which required the existing player and content experience to remain.

The restoration must recover the complete user experience without restoring legacy cookies, native Tunes login, caller-selected owner identifiers, browser service credentials, permissive sockets, or any retired authority surface.

## Goals

- Restore owner search, playback, queue, history, playlists, imports, sharing, and guest controls.
- Restore the guest/public Music experience and real-time request flow.
- Preserve one Explorers login for email, Google, and existing accounts.
- Reuse the secured canonical Tunes REST and Socket.IO boundaries.
- Preserve existing Music data and publication state.
- Provide contained failure states and an immediate application-level rollback.
- Verify the complete experience on desktop, mobile, the test deployment, and production.

## Non-goals

- Reintroducing native Tunes registration, login, password, SSO callback, or cross-domain cookie flows.
- Reusing legacy API calls that pass username, user ID, guest slug, or owner identity as authority.
- Redesigning the overall Explorers shell or unrelated dashboard/public URL work.
- Migrating or resetting existing playlist, queue, history, or publication data.
- Expanding Music beyond the behavior already represented by the previous product and current canonical contracts.

## Confirmed Current State

The canonical Tunes service already provides owner-authorized operations for playlist CRUD, playlist songs, queue reads and mutations, current playback, history clearing, YouTube search, YouTube URL lookup, entitlement, and publication. It also provides capability-scoped guest playlist reads, guest YouTube lookup, song requests, and role-restricted Socket.IO events.

The current Explorers `musicWorkspaceClient` exposes only workspace loading, playlist metadata, playlist visibility, playlist-song reorder, and publication. The UI does not consume the available queue, playback, history, search, or socket contracts.

Two material server gaps remain:

1. Canonical owner settings do not yet expose all former guest-control fields.
2. The canonical paid import route currently returns `410 SURFACE_REMOVED`; YouTube and Spotify playlist import require a secured replacement implementation.

The latest sanitized deployment evidence showed a healthy Tunes container and a successful identity ensure request (`200`, 3326 ms). Previously observed `502` and `503` responses were identity/bootstrap failures, not player failures. Identity latency and intermittent availability remain release-hardening concerns.

## Architecture

### Authority and ownership

Explorers remains the sole login and account authority. Authenticated email, Google, and existing accounts obtain the same short-lived Music credential through the current identity coordinator. Tunes derives owner identity exclusively from the verified Music principal.

Owner REST mutations never accept owner usernames or IDs in headers, query strings, or request bodies. Guest reads and requests use publication state plus bounded guest capabilities. Guests cannot emit owner playback authority. Socket recipients and events are reauthorized at delivery time.

### Frontend boundaries

`MusicDashboard` becomes a composition layer rather than a monolith. The restored experience is divided into independently testable modules:

- `MusicWorkspaceShell`: navigation, responsive layout, loading, stale, and global failure presentation.
- `MusicPlayer`: media element lifecycle, play/pause, seek, volume, next/previous, recovery, and state broadcast.
- `MusicSearch`: YouTube search, pagination, URL lookup, result selection, and queue/playlist destinations.
- `MusicQueue`: current item, ordered queue, play-now, add, remove, bulk clear, and reorder.
- `MusicHistory`: recently played list and clear action.
- `MusicPlaylists`: playlist metadata, songs, reorder, visibility, append, play, shuffle, and delete.
- `MusicGuestControls`: publication and guest behavior settings.
- `GuestMusicWorkspace`: capability-scoped public state, search, requests, allowed playback, and responsive navigation.

Frontend transport is split by domain responsibility while sharing the existing credential-aware request primitive:

- workspace/playlist client
- queue/playback client
- search/import client
- guest-settings client
- authenticated socket client

No module imports retired `localTunesRequest`, native Tunes auth services, or username-based authorization helpers.

### Tunes service additions

The canonical surface gains only the missing operations required for parity:

- owner-authorized guest-settings read/update with an explicit schema and no owner target
- secured YouTube playlist import
- secured Spotify playlist import when credentials and entitlement permit it
- import-to-queue and import-to-saved-playlist destinations with bounded item counts and idempotency

Existing queue, player, playlist, publication, guest, and socket contracts are reused. Any contract extension is added to the OpenAPI document and tested before frontend integration.

### State and synchronization

The canonical REST dashboard is the durable source of truth. Local component state controls only media interaction and optimistic presentation. Mutations update or invalidate narrowly scoped queries. Failed optimistic operations restore the previous snapshot.

Socket events accelerate updates but do not become authority. On connect, reconnect, credential refresh, or sequence uncertainty, clients refetch canonical REST state. Account change, logout, suspension, deletion, or credential revocation clears Music queries, media state, and socket rooms.

## User Experience

### Owner workspace

The player and current artwork are the primary visual anchor. The main owner navigation contains Queue, Guest controls, Recently played, and Playlists. Search remains immediately accessible.

Owners can:

- search YouTube and paginate results
- add a YouTube URL
- import supported YouTube or Spotify playlists
- add selections to the live queue or a saved playlist
- play, pause, seek, change volume, mute, skip, or return to a previous item where history permits
- play a queued or saved item immediately
- add, remove, reorder, or clear queued songs
- inspect and clear recently played history
- create, rename, describe, expose, populate, reorder, play, shuffle, append, or delete saved playlists
- configure publication and allowed guest behavior

An empty account leads with search and an “add your first song” action. It may also offer playlist creation, but playlist creation is not the only path forward.

### Guest/public workspace

Published or capability-linked visitors see only the state allowed by the owner. When enabled, guests can search, submit bounded song requests, inspect shared playlists or history, and use permitted local playback controls. Guest navigation remains usable on mobile. Private or revoked resources fail closed without revealing whether an owner exists.

### Responsive behavior

Desktop uses the wider Music workspace layout. Mobile restores compact navigation with persistent access to the player and primary queue/search actions. The player must remain reachable without scrolling through all playlist management content.

### Loading and failure states

The Explorers shell and stable Music layout remain visible during refreshes. Identity bootstrap failure presents a contained retry action. Search, queue, imports, playlists, publication, and sockets have independent failure states so one unavailable dependency does not erase already loaded content.

Unavailable videos use bounded recovery before offering skip/retry. Spotify import is presented only when configured and entitled. Stale content remains read-only until a canonical refresh succeeds.

## Identity Reliability

The identity coordinator reuses valid credentials and refreshes before expiry rather than calling `identity/ensure` for every Music action. Bootstrap applies bounded retries only to explicitly retryable failures and honors `Retry-After`.

Server responses and sanitized logs distinguish timeout, upstream unavailability, invalid session, ineligible account, lifecycle denial, malformed response, and internal failure using stable codes and request IDs. Logs include outcome and latency but exclude credentials, capabilities, service tokens, and private account data.

Repeated cold and warm identity requests must be measured against the deployed Strapi latency distribution before production activation. Timeout settings must allow normal observed latency while remaining bounded.

## Compatibility and Isolation

Existing Music rows, playlists, queue, history, guest slug, and publication state remain unchanged. New and old Explorers accounts use the same flow; no separate Tunes account action appears.

Work remains isolated to Music-specific frontend modules, Tunes canonical Music routes/services, Music tests, and Music documentation. Changes to shared public routing must be minimal and coordinated with the separate dashboard/public-URLs work before integration.

## Rollout and Rollback

The complete workspace is guarded by a frontend feature flag. The current minimal workspace remains the fallback during test and canary deployment. Switching the flag does not alter database state, credentials, or publication settings.

Release order:

1. Land canonical server gaps with contracts and tests, without exposing incomplete UI.
2. Land the secured frontend clients and component tests.
3. Integrate the complete owner workspace behind the flag.
4. Integrate the guest/public workspace behind the flag.
5. Deploy Tunes and Explorers to the test environment.
6. Run authenticated owner and guest UAT on desktop and mobile.
7. Enable the flag for a bounded canary and monitor identity, route, socket, and player outcomes.
8. Activate production after all gates pass.

Rollback disables the feature flag and restores the minimal workspace. Server additions remain backward-compatible and can stay deployed. A server rollback uses the existing immutable image and automatic deployment rollback route.

## Verification

### Automated tests

- REST contracts: authentication, owner isolation, schemas, idempotency, entitlement, origins, limits, lifecycle, and error envelopes.
- Guest contracts: capability scope, private/unlisted/public behavior, request policy, rate limits, and non-enumerability.
- Socket contracts: role/event allowlists, room isolation, reconnect, expiry, revocation, and delivery-time authorization.
- Frontend clients: credential attachment, retry classification, response parsing, mutation behavior, and contained errors.
- Components: player controls, media errors, search, queue, history, playlists, imports, guest settings, responsive navigation, loading, empty, stale, and partial failures.
- Regression boundary: no separate Tunes login, legacy browser identity, username authority, cross-domain cookie, raw service credential, or positional account selection.
- Builds and static analysis for both Explorers and Tunes.

### End-to-end journeys

- Existing account enters Music without another login.
- New email account completes onboarding and enters Music.
- New Google account completes onboarding and enters Music.
- Logout/login, account switching, suspension, and credential expiry clear or recover state correctly.
- Search → add → queue → play → seek/pause/skip → history.
- Create playlist → add/reorder/remove → play/shuffle/append → visibility.
- YouTube URL and supported playlist imports.
- Guest publication → open shared surface → search/request → owner receives update.
- Desktop and representative mobile viewport coverage.
- Browser console and network inspection contain no uncaught Music promise failures or unexpected 4xx/5xx responses.

### Deployment gates

- All unit, integration, contract, security, component, build, and end-to-end suites pass.
- Tunes readiness reports the expected immutable commit, digest, migration marker, and enabled Music entry.
- Repeated identity probes and authenticated UAT remain within agreed latency and error thresholds.
- Test-server UAT passes before production activation.
- Canary monitoring shows no regression in identity success, Music route errors, socket authorization, or player startup.

## Success Criteria

- Users experience the complete pre-PR #102 Music capability set through the secured post-PR #102 identity boundary.
- Email, Google, and existing accounts require no separate Tunes login.
- The deployed owner UI visibly includes player, search, queue, history, playlists, and guest controls.
- Guest/public Music works only within explicit publication and capability policy.
- No legacy authority or credential surface returns.
- Identity bootstrap is measurable, bounded, and reliable under live latency.
- Test and production UAT pass with a clean Music console/network trace.
- The full workspace can be disabled immediately without data loss.
