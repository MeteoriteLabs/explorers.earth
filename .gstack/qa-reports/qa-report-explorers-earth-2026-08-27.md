# Explorers Music production UAT — 2026-08-27

## Environment

- Frontend: `https://explorers.earth/recommendations/music`
- Tunes API: `https://localtunes.earth`
- Deployed commit at baseline: `1f8d571214d2a18e7e8cc6714e6bd8306af15fce`
- Authenticated account: existing owner account (credentials excluded)
- Rollout contract: owner workspace enabled; guest workspace and playlist imports disabled

## UAT matrix

| Area | Baseline result | Evidence / follow-up |
| --- | --- | --- |
| Identity and workspace bootstrap | Pass | Owner workspace loads after identity establishment. |
| Search | Partial | `Daft Punk Get Lucky`, `Coldplay Yellow`, and `Beatles Hey Jude` returned results. Pagination/empty/no-result still pending after ISSUE-001. |
| Player | Partial | Play-now starts the selected YouTube item and renders controls; blocked from sustained testing by ISSUE-001. |
| Queue | Partial | Added one and two selected results, persisted across reload, and moved `Hey Jude (Remastered 2015)` upward with the correct live-region update. Remove/clear still pending. |
| Recently played | Partial | Empty-state loads correctly; completion/history lifecycle still pending. |
| Playlist creation | Pass | Created `Codex UAT 2026-08-27` with a description and confirmed persistence. |
| Playlist editing and membership | Fail | Rename/privacy controls render, but the Explorers UI has no action for adding a discovered song to a saved playlist. ISSUE-002. |
| URL import/discovery | Pending | Must remain available for individual media URLs. Playlist imports must remain disabled by rollout. |
| Responsive UI | Pending | Desktop and mobile visual/interaction review after functional stability. |
| Console/network health | Partial | No app-origin exception during ISSUE-001; an unrelated browser-extension `share-modal.js` error was excluded. |

## ISSUE-001 — Music workspace disappears at rollout renewal

**Severity:** P1  
**Status:** Reproduced; fix under verification

### Reproduction

1. Open the authenticated Music route.
2. Wait for the owner workspace to load.
3. Search for a song such as `Coldplay Yellow`.
4. Observe results remain visible initially.
5. At the cached exposure boundary, the workspace, search results, player and queue disappear and the page returns to `Checking what's included…`.

Measured reproduction: results remained visible for 13 seconds and disappeared at second 14, aligned with the original server-issued exposure expiry.

### Root cause

The browser refreshes at the exposure's absolute `expiresAt`. A small client/server clock difference can make the Tunes service regard its cached decision as still valid and return the same exposure. The client correctly rejects that already-expired decision and fails closed. It then waits for the next retry, temporarily hiding all owner-workspace controls.

### Repair

Renew cached decisions inside a bounded five-second server-side clock-skew window. This preserves fail-closed behavior and keeps the maximum cache TTL at sixty seconds.

Regression coverage: `tunes/server/test/music-feature-decision-service.regression-1.test.ts`.

## ISSUE-002 — Songs cannot be added to saved playlists in Explorers

**Severity:** P1  
**Status:** Confirmed by production UI and source trace; repair pending after ISSUE-001 deployment

### Evidence

1. Create or select a saved playlist.
2. Search successfully and select one or more results.
3. The only available bulk action is `Add N selected to queue`; there is no saved-playlist target or add-to-playlist action.
4. Empty saved playlists consequently cannot exercise song reorder, removal, or queue replacement.

The Tunes backend already exposes `POST /api/playlists/:playlistId/songs`, but `explorers-earth/src/features/music/musicWorkspaceClient.ts` has no corresponding client method and `MusicSearch`/`MusicDashboard` expose no owner UI for it. This is a missing frontend workflow rather than an API outage.

## Notes

- The production UAT playlist is deliberately retained until the remaining playlist lifecycle tests are complete.
- This report is incremental. Final production verdict requires every pending row to pass on the exact deployed repair commit.
