# Music identity, REST, and Socket.IO contract

## Executable authority

`GET /api-docs` returns the live OpenAPI 3.1 contract. CI compares every canonical identity, owner, paid-owner, and guest route in the generated surface inventory with that document, including method, path parameters, security scheme, exact status codes, request correlation headers, error codes, and response schemas. Add or change a route in OpenAPI and the inventory in the same commit; this prose is a guide, not a second schema.

All REST errors use `music-error/v1`, return `X-Request-Id`, and contain `code`, a safe bounded `message`, `action`, `retryable`, and the same `requestId`. Known retry windows also return integer-seconds `Retry-After`. Raw upstream responses and identity or credential material are never included.

## Endpoint families

| Family | Operations | Authority and invariant |
|---|---|---|
| Contract | `GET /api-docs` | public machine-readable contract |
| Identity | `POST /api/music/identity/ensure`; `GET /api/music/identity/current` | authoritative Explorer bearer only at ensure; local Music bearer for current |
| Lifecycle | `POST .../lifecycle/prepare`, `GET .../status`, `POST .../boundary`, `POST .../cancel`, `POST .../suspend` | authoritative Explorer bearer plus immutable stored Account binding |
| Saved playlists | `GET/POST /api/playlists`; `GET/PATCH/DELETE /api/playlists/{playlistId}`; song add/delete/reorder/visibility children | local Music bearer; writes require exact allowed Origin; numeric owner predicate on every query |
| Queue/dashboard | `GET/POST /api/playlist/songs`; `GET /api/music/dashboard`; current-playing, bulk delete, song delete/position, and history delete | local Music bearer and server-derived owner |
| Lookups | `POST /api/youtube/search`; `POST /api/youtube/video-from-url` | bounded owner lookup; no browser service token |
| Publication | `POST /api/music/publication` | owner bearer, exact Origin, and required `Idempotency-Key`; response mode exactly matches request |
| Entitlement | `GET /api/music/entitlement`; `POST /api/music/paid/import` | current server-derived freshness; included core Music remains available; paid import is currently a typed retired boundary |
| Public/guest | `GET /api/playlist/{guestUrl}` and bounded request/YouTube children | explicit public discovery or a capability header bound to that slug; never URL capability authority |

The publication idempotency key is immutable per owner and has the exact form
`tunes-share-v1-<13-digit issued-at epoch milliseconds>-<UUIDv4>`. Same key and
same request replays the byte-equivalent protected response for 24 hours. A
different request conflicts while its tombstone is retained. PostgreSQL's clock
rejects keys older than 30 days before any owner lookup or mutation, so a key is
permanently retired even after its bounded archive tombstone is purged. Keys more
than five minutes in the future and malformed or legacy key shapes are invalid.

## Token and capability lifecycle

The embedded Music client forwards the Explorer bearer only to `POST /api/music/identity/ensure` at the identity/lifecycle boundary. Dedicated Account lifecycle requests use separately initiated authoritative Explorer proof on the lifecycle endpoints listed above. Neither proof is reused on canonical owner routes or decoded without verification. Ensure returns a ten-minute, audience-scoped Music credential. The client stores it only in memory, refreshes through a single-flight bodyless ensure, clears it on logout/session change, and never falls back to username or native-session ownership. An unexpired credential may continue local owner operations during a Strapi outage; mint/refresh cannot.

Signing rotation is verifier-first: distribute current plus previous verification authority, begin minting with the new key, wait through maximum TTL and skew, then remove the old key. `sessionVersion` provides immediate logout-all/security revocation.

An unlisted guest capability is 43-character base64url authority for one public slug. It is imported out-of-band and kept in session storage only for that slug. Owner publication rotation replaces the hash atomically; private/public publication or explicit revocation invalidates the old capability.

## Stable error codes

| Codes | Meaning and caller action |
|---|---|
| `AUTH_REQUIRED`, `AUTH_INVALID` | obtain or replace the authoritative Explorer proof |
| `TOKEN_INVALID`, `TOKEN_EXPIRED`, `TOKEN_REVOKED` | discard the Music credential and perform one bodyless refresh when the Explorer session is valid |
| `RESOURCE_FORBIDDEN`, `ENTITLEMENT_REQUIRED` | the verified principal lacks resource or fresh paid authority; do not retry unchanged |
| `PUBLIC_NOT_FOUND`, `GUEST_CAPABILITY_INVALID` | preserve safe public non-enumeration; reacquire capability out of band if appropriate |
| `SURFACE_REMOVED`, `SOCKET_EVENT_FORBIDDEN` | stop using the retired/forbidden operation |
| `ORIGIN_FORBIDDEN`, `PAYLOAD_TOO_LARGE`, `REQUEST_INVALID` | correct the origin or bounded request before retrying |
| `IDENTITY_INELIGIBLE`, `ONBOARDING_INCOMPLETE`, `ACCOUNT_AMBIGUOUS`, `ACCOUNT_SWITCH_CONFLICT` | resolve the authoritative Explorer/Account state |
| `IDEMPOTENCY_CONFLICT`, `PUBLICATION_REPLAY_EXPIRED` | use the original request result or a new operation key as permitted; never reuse the retired key |
| `IDENTITY_CONFLICT`, `IDENTITY_TOMBSTONED`, `IDENTITY_PENDING_DELETION`, `IDENTITY_SUSPENDED` | follow the lifecycle/incident path; never recreate or bypass locally |
| `LIFECYCLE_NOT_FOUND`, `LIFECYCLE_CANCEL_FORBIDDEN`, `LIFECYCLE_DEAD_LETTER` | locate the operation, respect the irreversible boundary, or escalate dead-letter recovery |
| `UPSTREAM_MALFORMED`, `UPSTREAM_UNAVAILABLE`, `DATABASE_UNAVAILABLE` | retry only when the envelope says so; operators use the request ID |
| `RATE_LIMITED` | wait for `Retry-After` |
| `ENTRY_DISABLED` | provisioning kill switch/cohort denies entry; do not bypass |
| `INTERNAL_ERROR` | safe unexpected failure; retry only when marked and escalate with request ID |

## Socket.IO

Owners connect with the Music credential; guests connect with the per-slug capability. Origin must exactly match the allowlist. The receive allowlist contains owner `player_state` and guest `guest_request` only with schema, size, rate, room, lifecycle, and event-time authority checks. Emitted `player_state` and `guest_request` are rechecked for each recipient before delivery. Authentication errors use the same stable error-code vocabulary and correlation ID; credentials, room authority, and capabilities never appear in payload diagnostics.
