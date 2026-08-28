# Analytics Reliability and Public Music Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make analytics ranges truthful and timezone-safe, and ship Music as a secure, live, permission-complete public-profile destination.

**Architecture:** Analytics uses one bounded recent query and a date-only calendar model. Public Music is discovered through a stable Strapi Account document ID, authorized and served by Local Tunes through opaque publication identity, rendered through one shared content surface at both `/{username}/music` and `/music/share/{publicSlug}`, and refreshed by revisioned socket invalidations with a bounded polling fallback.

**Tech Stack:** React 18, TypeScript 5.6, React Router, Apollo Client, TanStack Query, Zod, Express 5, PostgreSQL, Socket.IO, Vitest, Testing Library, Playwright, axe-core.

**Spec:** `docs/superpowers/specs/2026-08-28-analytics-and-public-music-completion-design.md`

## Global Constraints

- Work only in the isolated `codex/profile-settings-tabs-rebase-20260828` worktree and preserve the separate user-sync agent's work.
- Use TDD for every production change: failing focused test, minimal implementation, focused pass, then wider regression pass.
- Do not change Strapi server code and do not add Redis.
- Do not authorize Music with username, email, numeric user ID, browser-supplied owner ID, or owner authority headers.
- Preserve existing `/music/share/{publicSlug}` public and unlisted URLs and `landingTab: "music"` data.
- Guest-device playback must never mutate owner playback or queue state.
- Local Tunes enforces all five guest permissions; UI visibility is defense in depth only.
- Never log or track unlisted capabilities, credentials, raw music searches, or media URLs.
- Local Tunes backend must deploy before the frontend that consumes its descriptor and live-event contracts.
- Keep all public Music DTOs strict, versioned, bounded, and fail-closed.
- Unit/contract tests cover all 32 guest-control combinations; browser E2E uses pairwise coverage plus one live journey for each individual control.

## File and Responsibility Map

### Analytics

- Create `explorers-earth/src/features/Analytics/components/AnalyticsDateRangeControls.tsx`: the single custom-date input renderer.
- Modify `explorers-earth/src/features/Analytics/utils/analyticsDateRange.ts`: canonical date-only parsing, formatting, validation, and bounded ranges.
- Modify `explorers-earth/src/features/Analytics/components/AnalyticsDashboard.tsx`: string state and shared controls.
- Modify `explorers-earth/src/pages/Home.tsx`: bounded recent count and explicit loading/error/zero states.
- Test `explorers-earth/src/features/Analytics/__tests__/analyticsDateRange.test.ts`, `AnalyticsDashboard.test.tsx`, and `explorers-earth/src/pages/__tests__/Home.analytics.test.tsx`.

### Local Tunes public Music

- Modify `tunes/server/repositories/musicDomainRepository.ts`: stable-account descriptor lookup, strict permission-filtered public snapshot, public revision.
- Modify `tunes/server/routes/musicSurfaceRoutes.ts`: descriptor route and versioned public DTO.
- Modify `tunes/server/routes/musicOpenApiRoutes.ts`: contract documentation.
- Modify `tunes/server/socket/musicSocketServer.ts`: read-only public admission and revisioned invalidation events.
- Modify owner mutation paths in `musicSurfaceRoutes.ts` and repository command returns only where required to emit invalidations.
- Test repository, route, OpenAPI, socket, security, integration, and load suites under `tunes/server/test/`.

### Explorers public Music

- Modify `explorers-earth/src/features/music/publicMusicClient.ts`: strict descriptor/resource parsing and guest request client.
- Create `explorers-earth/src/features/music/publicMusicLiveClient.ts`: socket lifecycle, coalescing, polling fallback, and refetch invalidation.
- Create `explorers-earth/src/features/music/components/PublicMusicPlayer.tsx`.
- Create `explorers-earth/src/features/music/components/PublicMusicRequest.tsx`.
- Create `explorers-earth/src/features/music/components/PublicMusicSections.tsx`: permission-derived queue, history, and playlist sections.
- Refactor `explorers-earth/src/pages/public/PublicMusic.tsx`: shared controller/content renderer for direct and friendly routes.
- Create `explorers-earth/src/pages/public/ProfileMusic.tsx`: stable-profile discovery wrapper.
- Modify `explorers-earth/src/routes/PublicRoutes.tsx`, `PublicNav.tsx`, and visibility/username guards.

### Presentation and verification

- Modify `explorers-earth/src/features/Profile/constants/recommendationsPresentation.ts` and appearance controls so Music remains a landing destination but not an ordered recommendation category.
- Modify `PublicProfile.tsx` landing resolution.
- Extend Playwright Music, profile presentation, analytics, accessibility, and full-stack suites.
- Create `docs/uat/2026-08-28-analytics-public-music-uat.md` from recorded live verification evidence.

---

### Task 1: Make analytics calendar dates timezone-safe

**Files:**
- Modify: `explorers-earth/src/features/Analytics/utils/analyticsDateRange.ts`
- Modify: `explorers-earth/src/features/Analytics/__tests__/analyticsDateRange.test.ts`

**Interfaces:**
- Produces: `formatLocalDateInput(date: Date): string`
- Produces: `parseLocalDateInput(value: string): Date | null`
- Produces: `getAnalyticsDateRange(filter: AnalyticsTimeFilter, now?: Date): AnalyticsDateRange | null`
- `AnalyticsTimeFilter` custom dates become canonical strings: `{ type: "custom"; startDate: string; endDate: string }`.

- [ ] **Step 1: Add failing date-only and timezone tests**

Add table tests proving canonical parsing and formatting:

```ts
it.each([
  ["2024-02-29", [2024, 1, 29]],
  ["2026-01-01", [2026, 0, 1]],
  ["2026-12-31", [2026, 11, 31]],
])("parses %s as a local calendar date", (input, expected) => {
  const parsed = parseLocalDateInput(input)!;
  expect([parsed.getFullYear(), parsed.getMonth(), parsed.getDate()]).toEqual(expected);
});

it.each(["", "2026-02-30", "2026-2-03", "not-a-date"])(
  "rejects non-canonical date-only input %s",
  (input) => expect(parseLocalDateInput(input)).toBeNull(),
);
```

Keep the existing 93-inclusive and 94-rejected assertions, but pass strings instead of `new Date("YYYY-MM-DD")`.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- --run src/features/Analytics/__tests__/analyticsDateRange.test.ts` from `explorers-earth`.

Expected: FAIL because the date-only utilities and string filter contract do not exist.

- [ ] **Step 3: Implement explicit local-calendar parsing**

Use this validation shape:

```ts
export function parseLocalDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  const day = Number(dayText);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : null;
}

export function formatLocalDateInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
```

Normalize API boundaries with local `setHours(0,0,0,0)` and `setHours(23,59,59,999)`. Preserve the server-safe 93-day elapsed-time clamp used by the existing test.

- [ ] **Step 4: Run focused tests in five time zones**

Run the same test under `TZ=UTC`, `America/New_York`, `America/Los_Angeles`, `Asia/Kolkata`, and `Pacific/Kiritimati` using PowerShell environment assignment.

Expected: PASS in every timezone, including DST and leap-day cases.

- [ ] **Step 5: Commit the date model**

```bash
git add explorers-earth/src/features/Analytics/utils/analyticsDateRange.ts explorers-earth/src/features/Analytics/__tests__/analyticsDateRange.test.ts
git commit -m "fix: keep analytics custom dates timezone safe"
```

### Task 2: Unify analytics date controls

**Files:**
- Create: `explorers-earth/src/features/Analytics/components/AnalyticsDateRangeControls.tsx`
- Modify: `explorers-earth/src/features/Analytics/components/AnalyticsDashboard.tsx`
- Modify: `explorers-earth/src/features/Analytics/__tests__/AnalyticsDashboard.test.tsx`

**Interfaces:**
- Consumes Task 1 date-only helpers.
- Produces:

```ts
interface AnalyticsDateRangeControlsProps {
  startDate: string;
  endDate: string;
  error: string | null;
  onStartDateChange(value: string): void;
  onEndDateChange(value: string): void;
}
```

- [ ] **Step 1: Write failing shared-control tests**

Assert that both empty and populated Analytics states render exactly one `From` input and one `To` input from the shared component, retain the entered string, and send the intended local calendar day to `readExplorersAnalyticsEvents`.

```ts
await user.type(screen.getByLabelText(/from/i), "03/08/2026");
await user.type(screen.getByLabelText(/to/i), "03/10/2026");
expect(screen.getByLabelText(/from/i)).toHaveValue("2026-03-08");
```

- [ ] **Step 2: Confirm RED**

Run: `npm test -- --run src/features/Analytics/__tests__/AnalyticsDashboard.test.tsx`.

Expected: FAIL because duplicated inputs still parse via `new Date(value)`.

- [ ] **Step 3: Extract the shared component and change state to strings**

Replace both custom-input branches with `AnalyticsDateRangeControls`. Keep native input `value`, `min`, and `max` as date-only strings. Derive validation through `getAnalyticsDateRange` and never call `toISOString()` to populate an input.

- [ ] **Step 4: Run focused tests and lint touched files**

Run the focused test, then `npx eslint src/features/Analytics/components/AnalyticsDateRangeControls.tsx src/features/Analytics/components/AnalyticsDashboard.tsx`.

Expected: PASS with zero lint errors.

- [ ] **Step 5: Commit the unified controls**

```bash
git add explorers-earth/src/features/Analytics/components/AnalyticsDateRangeControls.tsx explorers-earth/src/features/Analytics/components/AnalyticsDashboard.tsx explorers-earth/src/features/Analytics/__tests__/AnalyticsDashboard.test.tsx
git commit -m "refactor: unify analytics custom date controls"
```

### Task 3: Make the Home analytics card bounded and truthful

**Files:**
- Modify: `explorers-earth/src/pages/Home.tsx`
- Create: `explorers-earth/src/pages/__tests__/Home.analytics.test.tsx`
- Modify: relevant English i18n key and run the existing i18n synchronization script for locale parity.

**Interfaces:**
- Consumes Task 1 `getAnalyticsDateRange({ type: "90d" })` or an exported `getRecentAnalyticsDateRange(90, now)`.
- Produces explicit card state: `loading | ready | unavailable` and label `Views · last 90 days`.

- [ ] **Step 1: Write failing request and UI-state tests**

```ts
expect(readExplorersAnalyticsEvents).toHaveBeenCalledWith(expect.objectContaining({
  from: expect.any(String),
  to: expect.any(String),
}));
expect(Date.parse(call.to) - Date.parse(call.from)).toBeLessThanOrEqual(93 * 86_400_000);
```

Add separate assertions for loading, real zero, non-zero, and failed request. Failure must render `Unavailable`, not `0`.

- [ ] **Step 2: Confirm RED**

Run: `npm test -- --run src/pages/__tests__/Home.analytics.test.tsx`.

Expected: FAIL because Home requests from `new Date(0)` and collapses failure into zero.

- [ ] **Step 3: Implement the bounded query and explicit state**

Use the same range utility as Analytics. Count only normalized view events after a successful response. Update card copy and accessible label to state the 90-day period.

- [ ] **Step 4: Verify Home and analytics regression suites**

Run Home analytics, AnalyticsDashboard, analyticsDateRange, and `explorersAnalyticsClient` tests together.

Expected: PASS.

- [ ] **Step 5: Synchronize translations and commit**

Run `npm run i18n:sync` and `npm run i18n:check`, stage only intended locale changes, then commit:

```bash
git commit -m "fix: bound and label dashboard analytics views"
```

### Task 4: Add fail-closed public Music descriptor lookup

**Files:**
- Modify: `tunes/server/repositories/musicDomainRepository.ts`
- Modify: `tunes/server/routes/musicSurfaceRoutes.ts`
- Modify: `tunes/server/routes/musicOpenApiRoutes.ts`
- Modify: `tunes/server/test/music-domain-repository.test.ts`
- Modify: `tunes/server/test/music-domain-repository.integration.test.ts`
- Modify: `tunes/server/test/music-surface-routes.test.ts`
- Modify: `tunes/server/test/contracts/music-openapi-contract.test.ts`
- Modify: `tunes/server/test/security/music-security-qualification.test.ts`

**Interfaces:**
- Produces repository method:

```ts
resolvePublicDescriptor(accountDocumentId: string): Promise<{
  mode: "public";
  publicSlug: string;
  revision: number;
} | undefined>;
```

- Produces `GET /api/music/public-profile/:accountDocumentId` returning `music-public-descriptor/v1`.

- [ ] **Step 1: Write failing repository and route tests**

Cover active public success and indistinguishable 404 responses for private, unlisted, suspended, pending deletion, tombstoned, unknown, malformed, and collision inputs. Assert forbidden username/email/owner headers and query keys are rejected.

- [ ] **Step 2: Confirm RED in Local Tunes**

Run the four focused Vitest files from `tunes`.

Expected: FAIL because descriptor repository and route do not exist.

- [ ] **Step 3: Implement stable-account lookup**

Use a single parameterized query constrained by `strapi_account_document_id`, `identity_status='active'`, `guest_discoverable=true`, non-null canonical `guest_url`, and public publication state. Return no internal user ID.

- [ ] **Step 4: Add route validation, rate limiting, DTO, and OpenAPI**

Validate the account document ID with the same bounded character policy used for synchronized identity fields. The route must ignore no authority input: reject unexpected query/body/identity headers and use generic `PUBLIC_NOT_FOUND` for non-public states.

- [ ] **Step 5: Run focused, integration, OpenAPI, and security tests**

Expected: PASS, including SQL injection-shaped input and enumeration-safe failures.

- [ ] **Step 6: Commit the descriptor contract**

```bash
git commit -m "feat(music): resolve public publication by stable profile identity"
```

### Task 5: Normalize the strict public Music resource contract

**Files:**
- Modify: `tunes/server/repositories/musicDomainRepository.ts`
- Modify: `tunes/server/routes/musicSurfaceRoutes.ts`
- Modify: `tunes/server/routes/musicOpenApiRoutes.ts`
- Modify: backend repository, route, and contract tests.
- Modify: `explorers-earth/src/features/music/publicMusicClient.ts`
- Modify: `explorers-earth/src/features/music/__tests__/publicMusicClient.test.ts`

**Interfaces:**
- Produces required `revision`, `permissions`, `currentlyPlaying`, `queue`, `recentlyPlayed`, and `playlists` fields.
- Produces strict Zod parsers `parsePublicMusicDescriptor` and `parsePublicMusicResource`.

- [ ] **Step 1: Write failing backend permission-matrix tests**

Generate all 32 combinations of the five booleans. Assert disabled fields are empty/null and enabled fields contain only bounded public data. Assert private playlists never escape even when playlist sharing is enabled.

- [ ] **Step 2: Write failing frontend malformed-success tests**

Reject unknown keys, missing permissions, oversized arrays, invalid song IDs/status, invalid slug/revision, and legacy optional-boolean shapes.

- [ ] **Step 3: Confirm RED on both packages**

Run focused Local Tunes contract tests and the frontend `publicMusicClient` test.

- [ ] **Step 4: Implement the versioned canonical DTO and strict client parser**

Return the permission object explicitly and keep the five booleans required. Use bounded Zod arrays and `.strict()` objects. Parse before resolving `load()`.

- [ ] **Step 5: Run focused and integration tests**

Expected: all 32 matrix cases and malformed response cases pass.

- [ ] **Step 6: Commit the shared contract**

```bash
git commit -m "refactor(music): make public resource permission complete"
```

### Task 6: Separate Music landing destination from recommendation ordering

**Files:**
- Modify: `explorers-earth/src/features/Profile/constants/recommendationsPresentation.ts`
- Modify: `explorers-earth/src/features/Profile/types/themeTypes.ts`
- Modify: `explorers-earth/src/features/Profile/components/ThemeAppearanceSection.tsx`
- Modify: `explorers-earth/src/features/Profile/components/RecommendationsPresentationControls.tsx`
- Modify: associated Profile tests.
- Modify: `explorers-earth/src/features/PublicHome/components/PublicProfile.tsx`
- Modify: associated PublicProfile presentation tests.

**Interfaces:**
- Produces separate constants:

```ts
export const RECOMMENDATION_CATEGORY_IDS = [
  "places", "movies", "books", "games", "guides", "apps", "products", "people",
] as const;
export const PUBLIC_LANDING_DESTINATION_IDS = [
  "all-recommendations", ...RECOMMENDATION_CATEGORY_IDS, "gallery", "business", "music",
] as const;
```

- [ ] **Step 1: Write failing normalization and UI tests**

Assert Music does not appear in drag ordering or `Recommendations — Music first`, appears once as `Music page`, and saved `landingTab: "music"` survives normalization. Assert stale category orders containing Music normalize to the eight valid recommendation categories without corrupting other wire fields.

- [ ] **Step 2: Confirm RED**

Run constants, ThemeAppearanceSection, RecommendationsPresentationControls, reorder transaction, and PublicProfile presentation tests.

- [ ] **Step 3: Split category and destination metadata**

Keep `music` in landing-destination parsing but remove it from recommendation category metadata and ordering functions. Update fallback resolution to choose the first available normal profile tab when public Music is unavailable.

- [ ] **Step 4: Run focused profile tests**

Expected: PASS with no changed behavior for the eight recommendation categories.

- [ ] **Step 5: Commit presentation semantics**

```bash
git commit -m "fix: treat music as a dedicated public destination"
```

### Task 7: Add secure friendly Music routing and navigation

**Files:**
- Create: `explorers-earth/src/pages/public/ProfileMusic.tsx`
- Modify: `explorers-earth/src/pages/public/PublicMusic.tsx`
- Modify: `explorers-earth/src/routes/PublicRoutes.tsx`
- Modify: `explorers-earth/src/components/PublicNav.tsx`
- Modify: `explorers-earth/src/features/music/publicMusicClient.ts`
- Create/modify route, navigation, legacy-boundary, and public-page tests.

**Interfaces:**
- Consumes Task 4 descriptor endpoint and Task 5 strict resource parser.
- Produces `ProfileMusic` using Account `documentId` only for discovery.
- Produces shared `PublicMusicPageController` and `PublicMusicContent` used by friendly and share routes.

- [ ] **Step 1: Write failing route and security-boundary tests**

Assert `/{username}/music` exists under `PublicLayout`, is guarded by `public_music`, calls descriptor lookup with the Account document ID, and never passes username to Local Tunes. Update the legacy boundary test to forbid username authority while allowing the friendly presentation route.

- [ ] **Step 2: Write failing navigation tests**

Music appears only when Strapi visibility is `Yes` and Local Tunes descriptor is public. Descriptor loading must not flash an unauthorized Music tab. Descriptor failure must not remove other navigation items or crash the profile.

- [ ] **Step 3: Confirm RED**

Run PublicRoutes visibility, PublicNav, UsernameValidator, legacy Music boundary, and PublicMusic tests.

- [ ] **Step 4: Implement discovery wrapper and shared renderer**

`ProfileMusic` obtains the already-public Account document ID, loads the descriptor, then loads the public resource by slug. Direct share continues to capture optional unlisted capability without Strapi lookup.

- [ ] **Step 5: Implement dedicated first-view navigation**

When `landingTab === "music"`, route to `/{username}/music` only after descriptor availability. Otherwise invoke the existing public-profile fallback resolver without loops.

- [ ] **Step 6: Run focused route tests and inspect history behavior**

Verify direct URL, navigation click, refresh, back/forward, wrong username, visibility disabled, private Music, and Local Tunes outage.

- [ ] **Step 7: Commit routing and navigation**

```bash
git commit -m "feat(music): add secure public profile music route"
```

### Task 8: Complete permission-derived public Music sections

**Files:**
- Create: `explorers-earth/src/features/music/components/PublicMusicSections.tsx`
- Modify: `explorers-earth/src/pages/public/PublicMusic.tsx`
- Create: `explorers-earth/src/features/music/components/__tests__/PublicMusicSections.test.tsx`
- Modify: `explorers-earth/src/pages/__tests__/PublicMusic.test.tsx`

**Interfaces:**
- Consumes Task 5 `PublicMusicResource`.
- Produces presentational queue, history, and playlist sections with no network authority.

- [ ] **Step 1: Write all 32 UI matrix tests**

Use `it.each` over bit masks `0..31`. For each mask, build permissions and assert each section's presence exactly matches its permission and available content. Include empty enabled states and malicious non-empty disabled payloads to prove defense-in-depth hiding.

- [ ] **Step 2: Confirm RED**

Run the new component test and existing PublicMusic test.

- [ ] **Step 3: Implement focused accessible sections**

Use semantic headings/lists, decorative empty alt text, touch targets of at least 44 CSS pixels, and responsive cards. Do not duplicate permission logic in route controllers.

- [ ] **Step 4: Run component tests and axe checks**

Expected: 32 matrix cases pass and no serious/critical axe violations.

- [ ] **Step 5: Commit public sections**

```bash
git commit -m "feat(music): render guest-controlled public sections"
```

### Task 9: Add guest-device playback without owner mutation authority

**Files:**
- Create: `explorers-earth/src/features/music/components/PublicMusicPlayer.tsx`
- Create: `explorers-earth/src/features/music/components/__tests__/PublicMusicPlayer.test.tsx`
- Modify: `PublicMusicSections.tsx` and tests.
- Modify: production-bundle boundary tests if the player library changes the Music chunk.

**Interfaces:**
- Consumes public song YouTube identity only.
- Produces local component state and callbacks; imports neither `musicQueueClient` nor owner `musicApi`.

- [ ] **Step 1: Write failing player behavior and authority tests**

Cover explicit user gesture, play/pause, selected playlist song, autoplay denial, removed video, network/embed failure, permission revocation, unmount cleanup, and keyboard labels. Add a source-boundary assertion that public player files do not import owner queue/playback clients.

- [ ] **Step 2: Confirm RED**

Run the new player test and Music boundary tests.

- [ ] **Step 3: Implement local-only playback**

Use the existing `react-player` dependency or a narrowly wrapped YouTube embed. Set playing state only after a user click. On permission change to false, set playing false and unmount the player.

- [ ] **Step 4: Run tests, build, and inspect the production bundle guard**

Expected: component tests and `npm run build` pass; no owner credential or command code leaks into the public Music chunk.

- [ ] **Step 5: Commit guest playback**

```bash
git commit -m "feat(music): add local guest-device playback"
```

### Task 10: Add bounded public song requests

**Files:**
- Create: `explorers-earth/src/features/music/components/PublicMusicRequest.tsx`
- Create: `explorers-earth/src/features/music/components/__tests__/PublicMusicRequest.test.tsx`
- Modify: `explorers-earth/src/features/music/publicMusicClient.ts`
- Modify: client tests and backend guest request tests.

**Interfaces:**
- Produces client methods `search(publicSlug, query, capability?, signal?)`, `videoFromUrl(...)`, and `requestSong(publicSlug, song, capability?, idempotencyKey)`.
- Consumes existing public Local Tunes search, URL, and request endpoints.

- [ ] **Step 1: Write failing client and component tests**

Cover success, empty/oversized query, malformed URL, no results, rate limit with retry countdown, queue full, permission revoked between search and submit, publication revoked, duplicate click suppression, abort on query/navigation, and safe telemetry payloads.

- [ ] **Step 2: Confirm RED**

Run the new component/client tests and focused backend guest request tests.

- [ ] **Step 3: Implement strict guest request client**

Send only the public slug, optional capability header, canonical song fields, and an idempotency key. Never send username, Account ID, owner credential, raw capability telemetry, or owner queue revision.

- [ ] **Step 4: Implement the request UI**

Render only when `allowSongRequests` is true. Keep one active search and one active submission, expose normalized error copy, and cancel obsolete work.

- [ ] **Step 5: Run focused frontend/backend tests**

Expected: PASS, including direct API rejection when the UI control would be hidden.

- [ ] **Step 6: Commit song requests**

```bash
git commit -m "feat(music): complete public song request flow"
```

### Task 11: Add revisioned live invalidation and fallback refresh

**Files:**
- Modify: `tunes/server/socket/musicSocketServer.ts`
- Modify: `tunes/server/routes/index.ts`
- Modify: owner mutation/repository paths needed to publish events.
- Modify: socket, repository, route, and load tests.
- Create: `explorers-earth/src/features/music/publicMusicLiveClient.ts`
- Create: `explorers-earth/src/features/music/__tests__/publicMusicLiveClient.test.ts`
- Modify: `PublicMusic.tsx` and tests.

**Interfaces:**
- Produces socket events `{ version: "music-public-change/v1"; kind; revision }`.
- Produces `subscribeToPublicMusic({ publicSlug, capability, onInvalidate, signal }): PublicMusicSubscription`.

- [ ] **Step 1: Write failing server socket tests**

Cover public read-only admission, unlisted capability admission, private/revoked rejection, room isolation, monotonic revisions, all five event kinds, permission revocation, publication revocation, reconnect storms, and forbidden guest mutation events.

- [ ] **Step 2: Write failing browser live-client tests**

Use fake timers and a fake socket to prove burst coalescing, stale revision rejection, reconnect refetch, visibility/online refetch, bounded jittered backoff, foreground polling fallback, hidden/unmounted shutdown, and no duplicate concurrent fetches.

- [ ] **Step 3: Confirm RED**

Run focused server socket/load tests and browser live-client tests.

- [ ] **Step 4: Implement additive server invalidations**

Emit small change envelopes after committed owner mutations. Never put songs, capabilities, account IDs, or credentials in socket payloads. Recheck lifecycle and publication authority during admission and on sensitive events.

- [ ] **Step 5: Implement client invalidation/refetch**

Treat HTTP snapshot as canonical. Coalesce a burst into one refetch, compare revision, abort stale requests, and disconnect on component cleanup or revocation.

- [ ] **Step 6: Run focused, security, and load tests**

Expected: PASS within existing socket admission and fan-out thresholds; no cross-owner event delivery.

- [ ] **Step 7: Commit live synchronization**

```bash
git commit -m "feat(music): synchronize public permissions and playback live"
```

### Task 12: Add safe analytics for public Music interactions

**Files:**
- Modify: public analytics event types/normalization utilities.
- Modify: `ProfileMusic.tsx`, `PublicMusic.tsx`, player/request/section components only at interaction boundaries.
- Modify/create analytics wiring tests.

**Interfaces:**
- Emits normalized event names and non-sensitive properties only.

- [ ] **Step 1: Write failing privacy and exactly-once tests**

Assert navigation, playlist open, playback start, request success/failure code, and unavailable state emit once. Assert serialized events never contain capability, raw query, media URL, credential, Account document ID, or public slug.

- [ ] **Step 2: Confirm RED**

Run public category analytics and new Music analytics tests.

- [ ] **Step 3: Implement event boundaries**

Track after user-visible acknowledgement, not on render. Preserve inbound UTM through friendly navigation using existing UTM/session helpers.

- [ ] **Step 4: Run analytics regression tests**

Expected: PASS with existing public category and UTM suites.

- [ ] **Step 5: Commit Music analytics**

```bash
git commit -m "feat(analytics): track safe public music interactions"
```

### Task 13: Build the browser E2E and visual verification matrix

**Files:**
- Modify: `explorers-earth/e2e/analytics.spec.ts`
- Modify: `explorers-earth/e2e/music-public-contract.spec.ts`
- Modify: `explorers-earth/e2e/music-fullstack.spec.ts`
- Modify: `explorers-earth/e2e/music-accessibility.spec.ts`
- Modify: `explorers-earth/e2e/profile-theme.spec.ts`
- Modify: `explorers-earth/e2e/profile-presentation-visual.spec.ts`
- Modify: `explorers-earth/e2e/setup/music.ts`

**Interfaces:**
- Uses dedicated test-account state snapshot/restore helpers.
- Produces PR-safe read-only coverage and authorized live-write coverage as separate Playwright projects/tags.

- [ ] **Step 1: Add failing analytics browser cases**

Cover Home 90-day label, failure-not-zero, custom ranges at boundary dates, 93/94 days, and request payload dates under browser timezone overrides.

- [ ] **Step 2: Add failing friendly/direct route cases**

Cover `/{username}/music`, public share, unlisted share, invalid capability, private publication, refresh, history navigation, wrong username, and descriptor outage isolation.

- [ ] **Step 3: Add permission pairwise and five live-toggle journeys**

Use a deterministic pairwise matrix for browser combinations and one owner/guest two-context test for each control. Each test snapshots state first and restores it in `finally`.

- [ ] **Step 4: Add player/request/live/reconnect cases**

Cover guest playback isolation, request acceptance/revocation/rate limit, queue/player update, publication-to-private, socket interruption, reconnect and refetch.

- [ ] **Step 5: Add responsive/theme/accessibility coverage**

Run all themes with hero present/absent at 375x667, 390x844, 768x1024, and 1440x900. Use axe and keyboard navigation. Assert no horizontal overflow and capture screenshots only on failure in CI.

- [ ] **Step 6: Run PR-safe E2E**

Run: `PLAYWRIGHT_PR_SAFE=true npm run test:e2e`.

Expected: all read-only suites pass; live-write suites are explicitly skipped, not silently absent.

- [ ] **Step 7: Run authorized live-write E2E**

Run the existing full-stack Music environment with the dedicated test identity. Confirm restoration by comparing the post-run snapshot to the pre-run snapshot.

- [ ] **Step 8: Commit E2E coverage**

```bash
git commit -m "test: cover analytics and public music end to end"
```

### Task 14: Full regression, UAT, and PR evidence

**Files:**
- Create: `docs/uat/2026-08-28-analytics-public-music-uat.md`
- Modify: PR description/checklist only after all evidence exists.

**Interfaces:**
- Produces reproducible verification commands, results, environment, screenshots/video references, and restored-state proof.

- [ ] **Step 1: Run Local Tunes verification**

From `tunes`, run `npm run check`, `npm test`, the Music critical coverage lane, repository integration coverage, OpenAPI/security contracts, and load qualification.

Expected: zero failures and required coverage thresholds met.

- [ ] **Step 2: Run Explorers verification**

From `explorers-earth`, run `npm run lint`, `npm run build`, `npm run test:unit`, Music critical coverage, i18n checks, and PR-safe E2E.

Expected: zero lint errors, successful production build, all unit tests passing, coverage thresholds met, and E2E green.

- [ ] **Step 3: Run timezone qualification**

Run analytics date suites under all five specified timezones and record exact pass counts.

- [ ] **Step 4: Perform two-context Chrome UAT**

Use the authenticated owner dashboard and logged-out guest page. Verify every control live, playlist visibility, queue/player changes, request flow, publication revocation, reconnect, all themes, hero variants, and mobile/desktop sizes.

- [ ] **Step 5: Restore and prove account state**

Record the before/after normalized snapshot hash and list every test-created fixture removed. Do not claim UAT complete if restoration differs.

- [ ] **Step 6: Write the UAT evidence document**

Include commit SHA, commands, pass counts, skipped tests with reasons, tested URLs, viewport matrix, permission matrix, observed analytics events, screenshots/video paths, and remaining concerns.

- [ ] **Step 7: Run final diff review and secret scan**

Review `git diff origin/main...HEAD`, run repository secret scanning, confirm no unrelated Tune sync changes, and resolve every actionable review comment.

- [ ] **Step 8: Commit evidence and push**

```bash
git add docs/uat/2026-08-28-analytics-public-music-uat.md
git commit -m "docs: record analytics and public music UAT"
git push origin HEAD:codex/profile-settings-tabs
```

- [ ] **Step 9: Request final PR review and watch checks**

Comment `@codex review` on PR #103 after the pushed SHA is visible. Wait for all required checks and the fresh review. Investigate and fix any valid finding with the same red-green-verification process.

## Required Final Evidence Table

| Layer | Required evidence |
|---|---|
| Analytics unit | Five timezones, DST, leap day, 93/94-day boundaries |
| Home UI | loading, real zero, non-zero, unavailable, 90-day label |
| Music contract | strict DTO parsing and all 32 permission combinations |
| Music security | stable identity, no username authority, generic not-found, capability secrecy |
| Music integration | public/unlisted/private, lifecycle states, permission enforcement |
| Music live | all invalidations, reconnect, fallback polling, revocation, isolation |
| Component | player, request, queue, history, playlists, empty/error/stale states |
| Routing | friendly route, direct share, navigation, first view, fallback, history |
| Browser E2E | pairwise permissions, five live toggles, themes, heroes, viewports |
| Accessibility | axe, keyboard, focus, touch targets, reduced motion |
| Analytics/UTM | safe fields, exactly once, UTM preserved |
| UAT | owner and guest Chrome contexts, recorded evidence, restored account state |

## Stop Conditions

- Stop if implementation requires Strapi server code, Redis, or returning username-based Music authority; revise the design instead.
- Stop if a public API or event can reveal a capability, owner credential, internal numeric identity, or private publication existence.
- Stop if live-write E2E cannot restore the dedicated account exactly.
- Stop if the Music change overlaps unrelated user-sync work; isolate or coordinate before continuing.
- Do not merge while any required CI check, fresh PR review, or UAT restoration proof is missing.
