# Responsive Music Dashboard Specification

## Goal

Restore the authenticated Music dashboard to the established Explorers management-page language while keeping the secured owner workspace introduced in PR #105 and stabilized through PR #111.

## Experience

- Keep the global dashboard header unchanged. Music actions live inside the page.
- Place a `New playlist` split action at the top of the page content. Its attached menu contains sharing/public-visibility controls.
- Use one unified discovery input for text search, a single supported music URL, or a supported playlist URL. The primary action is `Search`; an attached menu exposes `Add from URL` and `Import playlist`.
- Place the audio-first player directly below discovery. Video is hidden by default and exposed through an explicit `Show video` toggle.
- Present `Queue`, `Guest controls`, `Recent`, and `Playlists` as accessible tabs on desktop and a horizontally scrollable, touch-safe tab row on mobile.
- Guest controls describe and control the eventual public Music surface: search visibility, playlist visibility, queue visibility, recently-played visibility, song requests, and guest playback.
- Saved playlists retain create, rename, visibility, queue replacement, song removal, reorder, and guarded deletion. Adding songs to a selected playlist reuses the unified discovery control.
- On mobile, preserve the Explorers bottom navigation, avoid horizontal page overflow, use 44px minimum targets, and expose a sticky compact player above global navigation while the full player is out of view.

## Functional boundaries

- No separate Tunes login.
- Do not restore retired legacy LocalTunes endpoints or clients.
- Use the existing secured `musicApi`, `musicWorkspaceClient`, queue client, search client, publication commands, and rollout boundary.
- Playlist import and guest-control mutations must remain unavailable until backed by an authenticated server contract. The UI may expose a clear unavailable state only when the backend capability is absent; it must not pretend success.
- Existing public Music pages are outside this implementation except for the labels and settings that define their future visibility contract.

## Required states

- Loading, stale/read-only, empty queue, empty playlists, zero search results.
- Search, URL lookup, invalid input, import unavailable, request failure, retry.
- Audio-only player, expanded video, no current song, unavailable media, recovery/skip.
- Queue and playlist mutation pending, success, failure, confirmation, and refresh failure.
- Desktop, 768px tablet, 390px mobile, keyboard navigation, reduced motion, and screen-reader labels.

## Acceptance evidence

- Focused component tests follow red-green TDD.
- Existing Music component suite remains green.
- Production build succeeds.
- Playwright validates desktop and mobile layout, keyboard operation, no overflow, sticky player, and console/network health using local fixtures.
- Authenticated local UAT covers every available Music workflow before any deployment.
