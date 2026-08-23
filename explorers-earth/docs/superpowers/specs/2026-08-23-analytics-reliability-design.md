# Analytics Reliability and Attribution Design

**Status:** Approved for implementation planning

## Problem

Public-profile analytics currently fails to record new events because the browser uses a read-only Strapi API token for `createPublicPageAnalytic`. Existing event payloads are stored largely inside the `Stats` JSON field, analytics queries download every account's records with `limit: -1`, several public interactions are not represented consistently in the dashboard, and country/UTM reporting is incomplete or misleading.

## Confirmed evidence

- Live Strapi contains `PublicPageAnalytic` with required `Account_Id`, optional `Location_Id`, optional `Recommendation_Id`, and JSON `Stats`.
- The live token named `Vite Acesss token` is configured as `Read-only`.
- Anonymous browser analytics mutations return HTTP `401`.
- The frontend expects `VITE_ANALYTICS_WRITE_ACCESS_TOKEN`, but the local environment does not define it.
- Dashboard reads use `publicPageAnalytics(pagination: { limit: -1 })` and filter by account in the browser.
- Only `utm_source` and `utm_medium` are modeled today.
- Country enrichment depends on an event IP address that new tracking no longer stores.
- Social links are rendered without the analytics callback expected by the social chart.

## Chosen architecture

Use a phased gateway migration:

1. Restore development/UAT writes using a narrowly scoped, create-only analytics token.
2. Add a rate-limited analytics gateway to the existing LocalTunes/Explorers Express backend before production rollout.
3. Store normalized, versioned payloads inside the existing `PublicPageAnalytic.Stats` JSON while preserving every legacy record.
4. Route dashboard reads through authenticated LocalTunes authorization, then filter Strapi analytics by the derived account and date rather than downloading all accounts.
5. Read legacy and versioned payloads through one dashboard adapter.

The production browser sends one request to the LocalTunes backend. That backend holds a create-only Strapi token and writes to the existing collection. No Strapi source code, content type, or schema is changed. The temporary browser token is explicitly not the final production architecture because any `VITE_*` secret is retrievable by a visitor.

## Event contract

Every accepted event has a client-generated UUID `eventId`, `schemaVersion`, `accountId`, `eventType`, `occurredAt`, `page`, and `route`. The UUID is an untrusted idempotency key, not proof of identity. Optional fields include `section`, `targetType`, `targetId`, `listId`, `recommendationId`, five standard UTM fields, referrer, a pseudonymous tab-session identifier, country, device class, and bounded metadata.

Attribution is explicitly tab-scoped. First-touch UTMs persist through navigation and refreshes in the same tab and are namespaced by public profile. A separately opened direct tab is direct unless its URL contains UTMs; no cookie/localStorage cross-tab tracking is introduced.

Allowed event types are versioned and allowlisted. The initial set covers profile views, section/tab views, list views, recommendation/card clicks, detail opens, social-link clicks, share actions, gallery actions, and external destination clicks.

## Trust boundaries

- The client may describe the interaction but cannot assert privileged account ownership, country, IP address, or trusted timestamps.
- The isolated LocalTunes analytics module resolves public profiles and published targets through a server-held, read-only analytics capability, applies validation and size limits, generates authoritative timestamps, derives coarse request metadata, rate-limits, deduplicates, and writes through a separate server-held create-only analytics capability.
- The analytics module refuses initialization when either capability is missing or broader than the documented allowlist and never falls back to the existing general `STRAPI_ACCESS_TOKEN`.
- LocalTunes hashes the client event UUID and claims it through an atomic unique insert in Postgres before writing to Strapi. The claim has a bounded retention period and supports deterministic replay responses across retries, restarts, and replicas. If the uniqueness store is unavailable, ingestion fails closed and does not attempt an uncertain Strapi write.
- Raw IP addresses are not exposed to the dashboard and should not be retained unless a separately approved retention policy requires them.
- Dashboard reads go through an authenticated LocalTunes reporting endpoint. It verifies the user's Strapi identity/session, derives the accounts they own or administer, rejects all other account IDs, and performs bounded account/date-filtered Strapi reads server-side.
- LocalTunes returns aggregates rather than raw events. The dashboard defaults to 30 days, supports 7/30/90-day presets, caps custom ranges at 365 days, and exposes an explicit partial-data state when a documented row/time/response ceiling is reached.
- The analytics module must not import from or modify LocalTunes user-sync, playlist, SSO, or auth-bridge implementation modules.
- Analytics backend work begins from the user-sync agent's agreed integration commit. Shared registry, middleware, schema, environment, and deployment files have a single integration owner; the final diff and both regression suites must prove user-sync behavior was preserved.
- The global LocalTunes request logger treats `/api/analytics/events` as sensitive: it records only a request ID, safe event-type label, status, and duration and never logs the body, query string, referrer, UTM values, identifiers, session data, or abuse keys.
- IP throttling and coarse country derivation are disabled until the deployed CDN/reverse-proxy chain is documented and Express trusts only an exact hop count or proxy subnet. Forwarded client-IP/country headers are accepted only from the verified immediate ingress; raw IPs are never persisted.
- Version 1 assumes exactly one LocalTunes application instance. Durable idempotency uses Postgres; bounded rate limits use the existing in-process limiter plus an upstream CDN/Nginx emergency ceiling. Horizontal scaling is blocked until a shared Redis-compatible limiter is configured and verified.

## Loading and failure behavior

Tracking is non-blocking. Navigation never waits for analytics. Failed events are bounded, retry-safe, and observable without showing visitor-facing errors. Dashboard loading, empty, partial-history, permission, and unavailable states are distinct.

The gateway has an explicit environment contract and staged rollout. A disabled backend returns `503 ANALYTICS_DISABLED`; visitors continue using the public profile while operations records the failure. Production frontend builds fail if a direct Strapi analytics-write token or direct-write fallback is present.

## Compatibility and migration

Historical `PublicPageAnalytic` records remain readable. New records use a versioned object inside `Stats`; a compatibility adapter maps recognized legacy arrays and versioned records into the normalized dashboard model. Unknown legacy events are retained but excluded from metrics they cannot support. No destructive backfill, shadow-write, new collection, or deletion is required.

## Not in scope

- LocalTunes synchronization work owned by another task.
- Any Strapi source-code or schema change.
- A second analytics collection or shadow-writing migration.
- Hosting Redis before horizontal LocalTunes scaling; shared rate limiting becomes mandatory before a second application replica.
- Replacing Google Analytics as a separate marketing analytics system.
- Exact visitor location or long-term raw IP retention.
- Modifying unrelated `public/sitemap.xml` work.

## Acceptance criteria

- All public-profile event writes succeed through the isolated LocalTunes analytics gateway into the existing Strapi collection.
- Anonymous visitors never receive a general Strapi write token in production.
- Every supported public category and interaction produces the documented event exactly once according to its deduplication rule.
- Five-field UTM attribution survives supported profile navigation.
- Dashboard queries are account-authorized, date-bounded, paginated or aggregated server-side, and reconcile with stored events.
- Legacy analytics remain visible with an explicit partial-history state where fields were never captured.
- Automated unit, integration, contract, browser UI, mobile, failure, performance, and abuse tests pass.
