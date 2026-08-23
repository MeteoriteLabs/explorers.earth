# Analytics Reliability and Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore trustworthy public-profile analytics and replace browser-held Strapi write access with scalable, fraud-resistant server-side ingestion and account-scoped reporting.

**Architecture:** Ship through reversible gates: prove the existing mutation with a create-only UAT token, add a normalized versioned event contract and compatibility adapter, route production ingestion through an isolated module in the existing LocalTunes/Explorers Express backend, then remove the browser write capability. Keep the existing Strapi collection and preserve legacy records throughout.

**Tech Stack:** React 18, TypeScript, Apollo GraphQL, Strapi 5, Vitest/Testing Library, browser UI automation, Recharts.

**Spec:** `docs/superpowers/specs/2026-08-23-analytics-reliability-design.md`

## Global Constraints

- Work only on `codex/profile-dashboard-public-profile` in its existing isolated worktree.
- Do not modify or stage the unrelated `public/sitemap.xml` change.
- Do not modify LocalTunes synchronization code.
- Implement backend work in a dedicated LocalTunes worktree/branch; never use the dirty `codex/profile-settings-tabs` checkout.
- Do not change Strapi source code, the `PublicPageAnalytic` schema, or existing records.
- Preserve all historical `PublicPageAnalytic` data; no destructive migration.
- Never expose a general or full-access Strapi token through `VITE_*`.
- Tracking must never block public navigation or content rendering.
- Production rollout cannot finish while an anonymous browser token can write directly to generic Strapi CRUD.
- LocalTunes analytics uses separate server-only Strapi capabilities: read-only published profile/target lookup and create-only `PublicPageAnalytic` ingestion.
- Every implementation task follows red-green-refactor and ends with focused verification.

## Delivery and rollback gates

```text
Gate 0: Baseline evidence and frozen event inventory
   |
Gate 1: Temporary create-only UAT capability proves end-to-end writes
   |
Gate 2: Versioned client contract + legacy compatibility adapter
   |
Gate 3: LocalTunes gateway + versioned Stats payload + abuse controls
   |
Gate 4: Account-scoped aggregate reads + dashboard migration
   |
Gate 5: Full UI matrix, canary, remove browser write capability
```

Rollback at Gates 2-4 switches dashboard reads to the legacy adapter and disables gateway ingestion; historical data remains untouched.

### Task 1: Freeze the analytics inventory and executable baseline

**Files:**
- Create: `src/features/Analytics/contracts/analyticsEventCatalog.ts`
- Create: `src/features/Analytics/contracts/__tests__/analyticsEventCatalog.test.ts`
- Create: `docs/analytics/event-inventory.md`
- Modify: `.env.example`

**Interfaces:**
- Produces: `ANALYTICS_EVENT_CATALOG`, `AnalyticsEventName`, and a documented event-to-UI matrix used by all later tasks.

- [ ] Write a failing catalog test requiring unique event names, a deduplication policy, supported target types, and required properties for every catalog entry.
- [ ] Run `npx vitest run src/features/Analytics/contracts/__tests__/analyticsEventCatalog.test.ts` and confirm it fails because the catalog does not exist.
- [ ] Implement a readonly catalog containing profile view, section view, list view, item/detail open, external destination, social link, share, and gallery events across places, people, products, apps, movies, books, games, guides, recommendations, gallery, and business surfaces.
- [ ] Document for every event: emitting component, trigger, account/target/list identifiers, deduplication policy, dashboard metric, and expected UTM behavior.
- [ ] Clarify `.env.example`: the analytics-write capability is UAT-only and must be absent from production browser builds after Gate 5.
- [ ] Run the focused test and `npx tsc -b`.
- [ ] Commit only the catalog, its test, inventory, and `.env.example` with `test(analytics): freeze event contract inventory`.

### Task 2: Prove the existing Strapi collection without broadening access

**Files:**
- Create: `docs/analytics/strapi-uat-configuration.md`
- Create: `scripts/verify-analytics-capability.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing `CreatePublicPageAnalytic` mutation.
- Produces: `npm run verify:analytics-capability`, which distinguishes read, create, forbidden update, and forbidden delete behavior without printing tokens.

- [ ] In the live Strapi admin, inventory the `PublicPageAnalytic` content type and current API token permissions read-only; record names/types but never token values.
- [ ] Create a browser UAT token allowed only to `PublicPageAnalytic.create`. Permission creation is an external security change and requires action-time confirmation before saving.
- [ ] Write the verifier to use the browser token only for creation and a separate operator-only credential/authenticated dashboard session for read-back. Assert the browser token's `find`, `findOne`, update, and delete attempts return `401` or `403`; never place the operator credential in `VITE_*`.
- [ ] Add cleanup guidance using Strapi admin; the verifier itself must not delete production data.
- [ ] Run the verifier against UAT and capture redacted results in the configuration document.
- [ ] Configure `VITE_ANALYTICS_WRITE_ACCESS_TOKEN` only in the local/UAT environment and restart Vite.
- [ ] Use the public UI to create a profile view and one item click, then verify both appear in Strapi and the dashboard.
- [ ] Commit documentation and verifier with `test(analytics): verify least-privilege UAT writes`; never commit secrets.

### Task 3: Introduce the normalized client event contract

**Files:**
- Create: `src/features/Analytics/contracts/analyticsEventV2.ts`
- Create: `src/features/Analytics/contracts/__tests__/analyticsEventV2.test.ts`
- Create: `src/features/Analytics/attribution/sessionAttribution.ts`
- Create: `src/features/Analytics/attribution/__tests__/sessionAttribution.test.ts`
- Modify: `src/utils/urlHelpers.ts`
- Modify: `src/utils/__tests__/urlHelpers.test.ts`

**Interfaces:**
- Produces: `AnalyticsEventV2`, `buildAnalyticsEvent(input)`, `readTabSessionAttribution(location)`, and all five UTM fields.

- [ ] Write failing tests for required fields, allowlisted event names, bounded metadata, URL sanitization, five UTM parameters, initial tab-session attribution, same-tab navigation/refresh retention, direct new-tab behavior, duplicated-tab behavior, cross-profile isolation, tab closure/reset, and malformed input.
- [ ] Run the focused contract and URL test files and confirm the new expectations fail.
- [ ] Implement an immutable version-2 event builder. Client time is `clientOccurredAt`; server time remains authoritative.
- [ ] Extend UTM helpers with `utm_campaign`, `utm_content`, and `utm_term`, maximum lengths, normalization, and unsafe-character rejection.
- [ ] Implement explicitly tab-scoped attribution in `sessionStorage`, namespaced by public profile, while retaining first-touch UTM parameters through supported same-tab navigation and refresh. Do not introduce cookie/localStorage cross-tab tracking.
- [ ] Run focused tests, analytics unit tests, and `npx tsc -b`.
- [ ] Commit with `feat(analytics): add versioned event and attribution contract`.

### Task 4: Add legacy compatibility and metric semantics

**Files:**
- Create: `src/features/Analytics/adapters/legacyAnalyticsAdapter.ts`
- Create: `src/features/Analytics/adapters/__tests__/legacyAnalyticsAdapter.test.ts`
- Create: `src/features/Analytics/metrics/analyticsMetrics.ts`
- Create: `src/features/Analytics/metrics/__tests__/analyticsMetrics.test.ts`
- Modify: `src/features/Analytics/api/queries.ts`

**Interfaces:**
- Produces: `NormalizedAnalyticsEvent`, `normalizeLegacyRecord(record)`, and `calculateAnalyticsMetrics(events, range)`.

- [ ] Write fixtures for current views/clicks, missing `Stats`, missing country/IP, malformed JSON values, unknown elements, duplicate entries, and every supported target category.
- [ ] Write failing tests proving recommendation metrics count only recommendation events, social metrics accept catalogued social events, unknown legacy data is retained as unsupported, and unavailable historical fields produce `partial` rather than fabricated values.
- [ ] Implement a pure adapter and pure metric functions; components must not parse legacy `Stats` directly afterward.
- [ ] Add explicit `complete | partial | unavailable` field-quality metadata.
- [ ] Run focused tests, existing Analytics tests, and `npx tsc -b`.
- [ ] Commit with `refactor(analytics): normalize legacy event semantics`.

### Task 5: Implement the isolated LocalTunes analytics gateway

**Files (LocalTunes backend, in a new isolated worktree from `C:/Users/TK/OneDrive/Desktop/Claude Data/explorers.earth-main/explorers.earth-main`):**
- Create: `tunes/server/routes/analyticsRoutes.ts`
- Create: `tunes/server/services/analytics-ingestion-service.ts`
- Create: `tunes/server/services/analytics-strapi-client.ts`
- Create: `tunes/server/services/analytics-capability-check.ts`
- Create: `tunes/server/services/analytics-reporting-service.ts`
- Create: `tunes/server/validators/analytics-event.ts`
- Create: `tunes/server/services/analytics-idempotency-store.ts`
- Create: `tunes/scripts/create-analytics-idempotency-table.ts`
- Create: `tunes/server/routes/__tests__/analyticsRoutes.test.ts`
- Create: `tunes/server/test/analytics-ingestion.integration.test.ts`
- Create: `tunes/server/test/analytics-log-redaction.test.ts`
- Modify: `tunes/server/app.ts`
- Modify: `tunes/server/routes/index.ts`
- Modify: `tunes/shared/schema.ts`
- Modify: `tunes/.env.example`

**Interfaces:**
- Produces: `POST /api/analytics/events`, versioned payloads written to existing `PublicPageAnalytic.Stats`, durable idempotency by a client-generated UUID, and structured success/error responses.

- [ ] Obtain the user-sync agent's agreed integration commit, then create the dedicated analytics backend worktree/branch from that exact commit rather than the dirty `codex/profile-settings-tabs` checkout.
- [ ] Record one integration owner for `tunes/server/routes/index.ts`, `tunes/server/app.ts`, `tunes/shared/schema.ts`, `tunes/.env.example`, and deployment configuration. Restrict analytics edits in those files to the documented route registration, logging/proxy hardening, idempotency schema, and environment additions.
- [ ] Inspect `tunes/server/app.ts`, `tunes/server/routes/index.ts`, `tunes/server/services/strapi-service.ts`, authentication/CORS/proxy middleware, deployment configuration, and existing integration-test conventions before editing.
- [ ] Document the production CDN/load-balancer/Nginx/Express hop sequence and source ranges. Replace blanket `trust proxy: true` only after proving the exact hop-count/subnet policy preserves secure cookies and existing authenticated routes.
- [ ] Write failing validation tests for allowed events, public account resolution, identifier formats, timestamps, metadata depth/size, UTM limits, forbidden fields, missing profiles, unpublished targets, and spoofed account ownership.
- [ ] Write failing integration tests for anonymous ingestion, sequential and concurrent duplicate submission, process restart, multiple app instances sharing Postgres, key expiry, unavailable idempotency storage, Strapi failure after key claim, oversized bodies, malformed JSON, throttles, and CORS.
- [ ] Add an `analytics_ingestion_keys` Postgres/Drizzle table containing only the hashed UUID, state, bounded response reference, created/expiry timestamps, and a unique constraint; never store raw IP, referrer, UTM, or event metadata in this table.
- [ ] Implement atomic claim/complete/retry semantics. A committed duplicate returns the original accepted result; an in-progress duplicate receives a retryable response; an unavailable uniqueness store fails closed before any Strapi mutation.
- [ ] Configure `STRAPI_ANALYTICS_READ_TOKEN` with only published Account/target `find` and `findOne` actions and `STRAPI_ANALYTICS_CREATE_TOKEN` with only `PublicPageAnalytic.create`; both remain server-only.
- [ ] Implement separate read/create clients and a startup capability probe proving the read token cannot mutate and the create token cannot read, update, or delete. Analytics initialization fails closed when a capability is missing, unexpectedly broad, or replaced by the general `STRAPI_ACCESS_TOKEN`.
- [ ] Resolve the route username/account and referenced target through the read-only capability. Reject missing, private, unpublished, cross-account, or mismatched identifiers before claiming/writing the event.
- [ ] Implement ingestion that validates the client-generated UUID as an untrusted idempotency key, resolves the public account server-side, generates authoritative server timestamps, creates a versioned bounded `Stats` payload, derives coarse country/device information from trusted proxy headers, hashes ephemeral abuse keys, and never returns or exposes raw IP data.
- [ ] Add rate-limit headers, structured error codes, request IDs, metrics, and redacted logs.
- [ ] Narrow the global `tunes/server/app.ts` request logger so `/api/analytics/events` records only request ID, safe event-type label, response status, and duration. Add a captured-console regression test with sentinel route/referrer/UTM/identifier/session/metadata values proving none appear in logs or error responses.
- [ ] Add legitimate-proxy, direct-origin, forged and multi-hop `X-Forwarded-For`, untrusted country-header, and secure-cookie regression tests. Disable IP/country-derived behavior when the trusted ingress cannot be established, and retain global/account backstops that do not depend solely on IP.
- [ ] Confirm and document that UAT/production LocalTunes runs as exactly one application instance. Configure bounded in-process global/account/session/trusted-IP limits and an upstream CDN/Nginx emergency ceiling; add startup/deployment warnings that block analytics rollout on multiple replicas without a shared limiter.
- [ ] Define exact quotas, TTLs, maximum key cardinality, eviction behavior, and fail-open/fail-closed behavior. Emit bounded accepted/rejected/throttled counters without identifiers as metric labels.
- [ ] Verify the new module has no imports from `user-sync-service.ts`, `auth-bridge-routes.ts`, playlist routes, LocalTunes synchronization modules, or the general-purpose Strapi client/token.
- [ ] Rebase after user-sync lands, audit `git diff` against its integration commit to prove no user-sync hunks changed, and run both the user-sync regression suite and the analytics backend suite before any push.
- [ ] Run `npm test`, `npm run test:integration`, and `npm run check` from `tunes`, followed by a staging smoke test.
- [ ] Commit and deploy behind `ANALYTICS_GATEWAY_ENABLED=false`, then enable only for UAT.

### Task 6: Switch the frontend transport to server ingestion

**Files:**
- Create: `src/services/analyticsIngestionClient.ts`
- Create: `src/services/__tests__/analyticsIngestionClient.test.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `.env.example`
- Create: `scripts/verify-analytics-env.mjs`
- Create: `scripts/__tests__/verify-analytics-env.test.mjs`
- Modify: `package.json`
- Modify: `src/services/analyticsService.ts`
- Modify: `src/services/__tests__/analyticsService.test.ts`
- Modify: `src/lib/apolloTransport.ts`
- Modify: `src/lib/__tests__/apolloTransport.test.ts`

**Interfaces:**
- Consumes: the LocalTunes `POST /api/analytics/events` endpoint and `AnalyticsEventV2`.
- Produces: non-blocking `enqueueAnalyticsEvent(event)` with bounded retry and no production analytics-write token.

- [ ] Write failing tests for success, `202`, validation rejection, throttling, timeout, offline state, duplicate event IDs, abort on unload, bounded retry with jitter, queue capacity, and redacted errors.
- [ ] Implement a small fetch client; do not introduce a durable tracking queue until product requirements explicitly require cross-session delivery.
- [ ] Add typed `VITE_ANALYTICS_API_URL`, explicit local/UAT legacy-direct flag, and CI/build validation. Production builds fail when a browser Strapi write token or direct-write fallback is present.
- [ ] Update `useTrackAnalytics` to build catalogued version-2 events and send without blocking navigation.
- [ ] Keep the legacy mutation behind an explicit local/UAT-only flag for rollback; production never falls back to direct Strapi writes.
- [ ] Treat `503 ANALYTICS_DISABLED` as a non-blocking visitor outcome with bounded operational reporting; do not retry it indefinitely.
- [ ] Make production startup/tests fail if `VITE_ANALYTICS_WRITE_ACCESS_TOKEN` is present after migration.
- [ ] Run service/transport tests and `npx tsc -b`.
- [ ] Commit with `feat(analytics): use secure ingestion transport`.

### Task 7: Complete public-profile instrumentation

**Files:**
- Modify only emitting components identified in `docs/analytics/event-inventory.md`, including `src/features/PublicHome/components/PublicHome.tsx`, `src/features/PublicHome/components/PlaceDetails/PlaceDetails.tsx`, the adaptive public-profile header/social component, and public category components.
- Create or extend colocated `*.analytics.test.tsx` tests for every emitter.

**Interfaces:**
- Consumes: catalogued event helpers.
- Produces: complete, consistent event coverage with stable identifiers and explicit deduplication.

- [ ] Parameterize contract tests over every inventory row so a missing emitter or wrong payload fails by category.
- [ ] Restore social-link analytics through an explicit header callback; verify correct platform labels and destination metadata.
- [ ] Instrument tabs/sections, lists, cards, details, shares, gallery actions, and external links across every published category.
- [ ] Enforce semantics: views on completed content readiness, clicks on intentional activation, keyboard activation equivalent to click, and no events from skeletons/errors/disabled controls.
- [ ] Verify internal category navigation retains attribution without double-counting profile views.
- [ ] Run all emitter tests, public-route tests, and `npx tsc -b`.
- [ ] Commit in reviewable category groups without touching LocalTunes files.

### Task 8: Add authorized LocalTunes reporting and bounded aggregates

**Files (LocalTunes backend worktree):**
- Modify: `tunes/server/routes/analyticsRoutes.ts`
- Modify: `tunes/server/services/analytics-reporting-service.ts`
- Modify: `tunes/server/services/analytics-strapi-client.ts`
- Extend: `tunes/server/routes/__tests__/analyticsRoutes.test.ts`
- Extend: `tunes/server/test/analytics-ingestion.integration.test.ts`

**Files (frontend):**
- Modify: `src/features/Analytics/api/queries.ts`
- Create: `src/features/Analytics/api/analyticsRepository.ts`
- Create: `src/features/Analytics/api/__tests__/analyticsRepository.test.ts`
- Modify: `src/features/Analytics/components/AnalyticsDashboard.tsx`

**Interfaces:**
- Produces: an authenticated LocalTunes reporting endpoint that derives authorized account IDs plus bounded summary, timeseries, top targets, traffic sources, country distribution, social interactions, and data-quality results.

- [ ] Write authorization regression tests with two users/accounts proving anonymous, expired, forged, and cross-account requests are rejected even when the requested `Account_Id` exists.
- [ ] Verify the user's Strapi JWT/session, derive owned/administered accounts server-side, and never authorize from a browser-provided username or account ID alone.
- [ ] Verify Strapi GraphQL supports filters for `Account_Id` and `createdAt` through the server-only analytics read capability; if either filter is unavailable, stop and document the limitation rather than reintroducing `limit: -1`.
- [ ] Write frontend request tests proving every dashboard request supplies an explicit date range while account authorization remains server-derived.
- [ ] Write aggregate correctness tests against a fixed event fixture covering time zones, range boundaries, duplicates, legacy partial data, versioned `Stats`, all categories, and empty accounts.
- [ ] Define and test 7/30/90-day presets, a 30-day default, a 365-day custom-range maximum, capped Strapi page size, processed-row ceiling, endpoint timeout, maximum response size, and latency SLO using representative event volumes.
- [ ] Implement cancellable sequential paging and bounded-memory server-side aggregation behind the authorized endpoint. Return aggregates and data-quality status rather than raw events; prohibit unbounded, `limit: -1`, or cross-account reads.
- [ ] Return a stable `partial` response with the applied ceiling and user-facing explanation when row/time limits are reached; never silently present partial totals as complete.
- [ ] Write frontend repository tests for loading, empty, partial legacy, permission, unavailable, retry, and stale-response cancellation.
- [ ] Replace `limit: -1` and component-side raw parsing with repository results.
- [ ] Run representative high-volume, cancellation, timeout, response-size, backend query, focused frontend, and `npx tsc -b` checks.
- [ ] Commit the frontend query/aggregation migration separately for rollback.

### Task 9: Repair dashboard presentation and accessibility

**Files:**
- Modify: `src/features/Analytics/components/AnalyticsDashboard.tsx`
- Modify: chart components under `src/features/Analytics/components/charts/`
- Extend colocated component tests.

**Interfaces:**
- Consumes: normalized aggregate response and data-quality status.

- [ ] Write failing tests for loading, empty, partial-history explanation, error/retry, all metrics, date-range changes, and accessible chart summaries.
- [ ] Remove misleading geolocation-pending copy when historical country data is unavailable.
- [ ] Fix responsive chart container sizing so Recharts never receives negative dimensions.
- [ ] Provide tabular/text equivalents for charts, stable skeleton dimensions, and mobile layouts without overflow.
- [ ] Verify at 320, 375, 768, 1024, and 1440 CSS-pixel widths.
- [ ] Run Analytics component tests, axe/accessibility checks available in the repo, and `npx tsc -b`.
- [ ] Commit with `fix(analytics): make reporting states accurate and responsive`.

### Task 10: Execute the full browser and data-reconciliation matrix

**Files:**
- Create: `docs/analytics/uat-matrix.md`
- Create: browser test specs in the repository's established E2E directory; if none exists, first add the smallest supported browser harness as a separately reviewed change.

**Interfaces:**
- Produces: repeatable UI verification and a redacted event-to-dashboard reconciliation report.

- [ ] Seed a dedicated UAT profile with published, hidden, empty, and mixed lists for every category without changing production user content.
- [ ] Test anonymous and owner sessions on desktop and mobile: profile load, every tab/category/list/card/detail/social/share/gallery action, back/forward, refresh, multiple tabs, keyboard activation, and invalid/hidden routes.
- [ ] Test direct, referral, QR, and five-field UTM links; confirm attribution survives supported navigation and does not leak to a different profile/session.
- [ ] Test slow network, offline, `400`, `401`, `403`, `429`, `500`, timeout, duplicate submission, and recovery; public content/navigation must remain usable.
- [ ] Reconcile event IDs and expected counts across browser requests, Strapi stored events, aggregate API output, and every dashboard widget.
- [ ] Run the matrix in both Chromium and the user-visible Chrome session; record screenshots only for state/layout evidence and redact identifiers/tokens.
- [ ] Run the entire automated suite and production build. Record command, commit SHA, date, pass/fail counts, and any accepted limitations.
- [ ] Commit tests and UAT evidence with `test(analytics): verify end-to-end attribution matrix`.

### Task 11: Canary, remove temporary capability, and document operations

**Files:**
- Create: `docs/analytics/runbook.md`
- Create: `docs/analytics/rollback.md`
- Modify: deployment environment documentation.

**Interfaces:**
- Produces: operational alerts, rollout/rollback procedure, retention policy, and zero browser analytics-write credentials.

- [ ] Define service-level indicators for accepted, rejected, throttled, duplicate, failed, and lagged events plus dashboard query latency/error rate.
- [ ] Define and validate the environment contract: frontend `VITE_ANALYTICS_API_URL`; backend `ANALYTICS_GATEWAY_ENABLED`, separate analytics read/create tokens, idempotency retention, exact rate limits, and trusted-proxy settings. Reject unsafe or contradictory combinations at startup/build time.
- [ ] Roll out in order: deploy disabled backend; configure and probe capabilities; enable UAT; complete reconciliation; deploy gateway frontend; enable a production canary; verify; then revoke the browser token.
- [ ] Canary by internal/UAT accounts, then a small production percentage, comparing versioned gateway events with expected UI actions and legacy historical calculations within documented tolerances.
- [ ] Verify rate limits and bot filtering under controlled load without targeting unrelated production users.
- [ ] Remove `VITE_ANALYTICS_WRITE_ACCESS_TOKEN` from production deployment and disable/revoke the temporary browser token; keep only the server-held LocalTunes create-only token. Revocation is an external permission change requiring action-time confirmation.
- [ ] Verify anonymous browser bundles/network requests contain no Strapi write capability.
- [ ] Complete retention, incident response, schema-version, replay, backfill, and rollback documentation.
- [ ] Run final unit, integration, browser, security, performance, build, and production canary checks.
- [ ] Commit with `docs(analytics): add operations and rollback runbooks`, push the dedicated branch, and report exact verification evidence.

## Required test coverage summary

| Layer | Required proof |
|---|---|
| Contract | Event catalog, schema validation, five UTMs, sanitization, session attribution |
| Component | Every emitter, keyboard parity, no skeleton/error emission |
| Transport | Success, offline, timeout, retry, throttle, duplicate, unload, redaction |
| Backend | LocalTunes gateway validation, account resolution, idempotency, rate limit, CORS, Strapi failure |
| Data | Legacy mapping, partial history, aggregates, time zones, range boundaries, all categories |
| Routes | Valid, invalid, hidden, empty, fallback, query/hash preservation |
| Browser UI | Owner/anonymous, mobile/desktop, every category/action, dashboard reconciliation |
| Accessibility | Keyboard activation, labels, focus, chart text alternatives, responsive zoom |
| Security/abuse | Spoofing, oversized/malformed input, enumeration, cross-account reads, burst/duplicate traffic |
| Performance | Non-blocking navigation, representative query plans, dashboard latency, bounded client memory |

## Definition of done

- No event or dashboard claim is accepted based solely on mocked tests.
- Stored events, aggregate API output, and dashboard widgets reconcile for the UAT fixture.
- Production browsers contain no Strapi write credential; the LocalTunes backend holds only a create-only analytics credential.
- Historical analytics remain visible with accurate partial-data explanations.
- All supported public-profile categories and interaction combinations in the inventory have automated and UI evidence.
- Local and remote branch heads match after the final verified push; unrelated work remains untouched.

## Deferred scaling trigger

- Before LocalTunes runs more than one application replica, provision a shared Redis-compatible rate-limit store, migrate analytics limiters and short-lived abuse counters to it, test failover/expiry/cardinality behavior, and retain Postgres as the durable idempotency authority.

## What already exists

| Existing capability | Reuse decision |
|---|---|
| `PublicPageAnalytic` with `Account_Id`, optional location/recommendation IDs, and `Stats` JSON | Preserve unchanged; store versioned payloads in `Stats` and adapt legacy arrays. |
| `useTrackAnalytics` and `CreatePublicPageAnalytic` mutation | Reuse event-emitter call sites while replacing the production transport. |
| Apollo capability routing and analytics-write tests | Retain for local/UAT rollback only; production build forbids a browser write capability. |
| LocalTunes Express route registry and Supertest/Vitest harness | Add one isolated analytics route/service and follow existing test conventions. |
| LocalTunes Postgres/Drizzle database | Add the durable hashed idempotency-key table; do not store analytics payloads there. |
| `express-rate-limit` | Reuse for the explicitly single-instance first release with upstream limits; require a shared store before replicas. |
| LocalTunes Strapi integration | Do not reuse its broad token/client; create two analytics-only clients and capability probes. |
| Existing analytics dashboard/charts | Migrate to authorized bounded aggregate responses rather than replacing the product surface. |
| Existing deterministic and real-account Playwright projects | Extend them for mocked failure paths and protected UAT reconciliation respectively. |

## NOT in scope

- Strapi source, policy, content-type, schema, index, lifecycle, or collection changes.
- Destructive migration, deletion, or rewriting of historical analytics.
- LocalTunes user-sync, playlist, music, SSO, or auth-bridge behavior.
- Redis hosting before horizontal scaling; it becomes a blocking prerequisite for a second LocalTunes replica.
- Cross-tab/cross-device visitor identity, fingerprinting, exact geolocation, or raw-IP retention.
- Replacing Google Analytics or merging its consent model with first-party product analytics.
- Modifying the unrelated `public/sitemap.xml` worktree change.

## Reviewed failure modes

| Codepath | Production failure | Test | Handling and user outcome |
|---|---|---|---|
| Client event builder | Invalid/oversized metadata or UUID | Contract boundary tests | Drop before network; public interaction continues silently. |
| Attribution | UTMs leak across profile or tab | Refresh/new-tab/duplicate-tab/cross-profile tests | Tab/profile namespace and expiry; dashboard remains accurate. |
| Gateway environment | Missing/broad/reused Strapi token | Startup capability tests | Analytics initialization fails closed; health/operations identifies cause. |
| Idempotency claim | Concurrent retry or process restart | Postgres unique/concurrency/restart tests | Original result or retryable in-progress response; no uncertain second write. |
| Idempotency database | Postgres unavailable | Integration failure test | Fail before Strapi mutation; visitor navigation remains usable. |
| Profile/target resolution | Fabricated/private/cross-account IDs | Two-account and unpublished-target tests | Reject bounded request; no record created. |
| Proxy metadata | Forged forwarded IP/country | Direct/forged/multi-hop proxy tests | Ignore untrusted headers; non-IP limits remain active. |
| Rate limiting | Counter reset or second replica | Deployment/topology assertion and quota tests | First release blocks replica rollout; upstream emergency ceiling remains. |
| Logging | Analytics payload reaches global logs | Sentinel captured-console test | Only request ID, safe event type, status, and duration logged. |
| Strapi write | Timeout, `401`, `403`, `429`, `500` | Gateway integration matrix | Structured bounded error, no visitor-facing blocker, operational counter increments. |
| Reporting authentication | Forged/expired JWT or another account | Two-user authorization tests | `401`/`403`; no analytics rows or aggregates returned. |
| Reporting volume | Range/row/time/response ceiling exceeded | Representative high-volume tests | Stable `partial` state with explanation; never mislabeled complete. |
| Dashboard | Slow, empty, partial or failed aggregate | Component and browser tests | Distinct skeleton, empty, partial, retry, and unavailable states. |
| Rollout flag | Client enabled while gateway disabled | Environment/deployment contract tests | Stable `503 ANALYTICS_DISABLED`; non-blocking and observable, no production direct-write fallback. |

No reviewed codepath retains an untested, unhandled, silent critical failure in the plan.

## Test-path diagram

```text
PUBLIC VISITOR
  -> build + validate event
     -> invalid/oversized ---------------------- [UNIT: reject, no request]
     -> valid UUID + tab attribution
        -> LocalTunes POST --------------------- [E2E]
           -> disabled/timeout/offline/4xx/5xx -- [INTEGRATION: non-blocking]
           -> proxy + quota validation
              -> forged/limited ---------------- [SECURITY: reject]
              -> account/target read capability
                 -> missing/private/mismatch ---- [CONTRACT: reject]
                 -> Postgres idempotency claim
                    -> duplicate/in-progress ---- [CONCURRENCY: replay/retry]
                    -> unavailable -------------- [FAIL-CLOSED: no Strapi write]
                    -> claimed
                       -> Strapi create ---------- [INTEGRATION]
                          -> success ------------ [RECONCILE event ID]
                          -> failure ------------ [RETRY/operations]

AUTHENTICATED OWNER
  -> LocalTunes analytics report ---------------- [E2E]
     -> invalid/expired/cross-account ------------ [AUTHZ: 401/403]
     -> derived owned account + date range
        -> bounded Strapi paging
           -> complete aggregates --------------- [DATA fixtures]
           -> ceiling/timeout -------------------- [PARTIAL state]
        -> dashboard
           -> loading/empty/partial/error/content  [UI + responsive + a11y]
```

## Worktree and execution lanes

| Lane | Modules | Depends on |
|---|---|---|
| A — Contract and legacy adapter | frontend analytics contracts, attribution, metrics | Task 1 |
| B — LocalTunes gateway | backend analytics route/services, Postgres idempotency, proxy/logging | user-sync integration commit; Task 1 contract |
| C — Public emitters | frontend public-profile category components | Task 3 contract |
| D — Authorized reporting/dashboard | LocalTunes reporting plus frontend analytics dashboard | Tasks 4 and 5 |
| E — Browser reconciliation and rollout | E2E, operations, environment/deployment | A–D |

Run A and the isolated preparation for B in parallel only after the event contract is frozen. C may proceed after A. D waits for B and the legacy adapter. E is sequential after all implementation lanes. Shared LocalTunes files (`app.ts`, route registry, shared schema, environment/deployment) have one integration owner and are rebased after user-sync lands.

## Independent engineering review decisions

| # | Finding | Decision |
|---|---|---|
| 1 | Server-generated IDs could not provide durable retry idempotency | Client UUID plus atomic hashed Postgres claim; fail closed. |
| 2 | Create-only token could not resolve profiles/targets | Separate server-only least-privilege read and create capabilities. |
| 3 | UI account filters were not authorization | Authenticated LocalTunes reporting derives owned/administered accounts. |
| 4 | Global POST logger exposed analytics bodies | Earliest middleware exemption/redaction plus sentinel test. |
| 5 | Blanket proxy trust made IP/country spoofable | Verify topology and enforce exact trusted ingress before use. |
| 6 | In-memory limits were not replica-safe | Explicit single instance + upstream ceiling now; Redis blocks horizontal scale. |
| 7 | UAT browser token accidentally included read access | Create-only browser capability; separate operator read-back. |
| 8 | Shared LocalTunes files could conflict with user-sync | Exact integration commit, owner, narrow hunks, rebase and dual regression suites. |
| 9 | Paginated raw reporting remained unbounded | Authorized server aggregates with 7/30/90 presets and 365-day maximum. |
| 10 | `sessionStorage` was incorrectly called browser-session | Explicit tab-session semantics and multi-tab/profile tests. |
| 11 | Gateway environment and rollout were implicit | Typed environment contract, safe build validation and staged rollout. |

## Implementation Tasks

- [ ] **T1 (P1)** — Freeze the versioned event catalog and tab-attribution contract; verify focused contract tests and TypeScript.
- [ ] **T2 (P1)** — Prove create-only UAT capability with separate operator read-back; verify forbidden read/update/delete operations.
- [ ] **T3 (P1)** — Build the isolated LocalTunes gateway with least-privilege clients, Postgres idempotency, trusted-proxy policy and log redaction; verify unit/integration/security suites.
- [ ] **T4 (P1)** — Move production frontend tracking to the gateway with environment/build guards and no production direct-write fallback.
- [ ] **T5 (P1)** — Complete every catalogued public-profile emitter and regression test across all categories.
- [ ] **T6 (P1)** — Add authenticated LocalTunes reporting with server-derived account authorization and bounded aggregation.
- [ ] **T7 (P2)** — Repair dashboard states, charts, responsive behavior and accessible text alternatives.
- [ ] **T8 (P1)** — Reconcile browser requests, Strapi records, reporting aggregates and dashboard widgets through the full protected UAT matrix.
- [ ] **T9 (P1)** — Canary, revoke the browser token, verify no write credential in bundles/network, and publish operations/rollback evidence.
- [ ] **T10 (P3)** — Before a second LocalTunes replica, provision and verify a shared Redis-compatible limiter.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | Not run | Architectural direction was approved directly by the user. |
| Codex Review | independent subagent | Independent second opinion | 1 | CLEAR | 11 verified findings reviewed; all 11 decisions resolved and folded into the plan. |
| Eng Review | `/plan-eng-review` | Architecture, code quality, tests and performance | 1 | CLEAR | Complete scope accepted; 11 findings resolved; 0 critical gaps remain in the plan. |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | Not required yet | Dashboard UI verification is specified; visual review runs after implementation. |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | Not required | Internal application feature, not a public developer product. |

**CROSS-MODEL:** Both reviews require LocalTunes as the secure boundary, unchanged Strapi schema, least privilege, durable idempotency, server authorization, bounded reporting, and exhaustive UI reconciliation.

**VERDICT:** ENG + INDEPENDENT PLAN REVIEW CLEARED — ready for implementation after the user-sync integration commit is identified.

NO UNRESOLVED DECISIONS
