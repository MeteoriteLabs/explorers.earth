# Tunes runtime-table manifest (C0)

Source of truth: `tunes/shared/schema.ts`. C0 found no versioned migration
directory; `drizzle-kit push` is the current schema path. That absence is a
cutover blocker: the “fresh migrated database” check cannot become signed proof
until a versioned migration baseline exists. The contract test nonetheless
fails for any runtime reference missing here, or any manifest entry absent from
the supplied fresh-schema inventory.

| Table | Columns, key constraints, and data family | Lifecycle |
| --- | --- | --- |
| `team_members` | `id` PK serial; `name`, `role`, `regions[]`, `created_at`; PII | delete after reassignment |
| `users` | `id` PK; unique `username`, `email`, `guest_url`; password/OTP/verification secrets; venue flags; FK `account_manager_id`; PII/security | delete/anonymize identity; retain security evidence per policy |
| `playlists` | PK `id`; FK `user_id`; name/description/visibility/timestamps; user content | delete with user |
| `songs` | PK `id`; FK `user_id`; YouTube metadata, position/status/played_at; user content | delete with user |
| `played_songs` | PK `id`; FK `user_id`, `song_id`; play timestamp; analytics | anonymize/retain aggregate |
| `playlist_songs` | PK `id`; FK `playlist_id`; YouTube metadata/position/added_at; user content | delete with playlist |
| `guest_interactions` | PK `id`; FK `user_id`; `guest_id`, interaction flags/duration; analytics/PII | anonymize/retain aggregate |
| `youtube_api_usage` | PK `id`; optional FK `user_id`; endpoint/timestamp; analytics | retain aggregate |
| `user_sessions` | PK `id`; FK `user_id`; device, IP, country/region/geo JSON; PII/security audit | delete/anonymize by policy |
| `activity_logs` | PK `id`; FK `user_id`; event type/data/timestamp; security audit | retain per audit policy |
| `analytics_snapshots` | PK `id`; FK `user_id`; totals/date/metrics JSON; analytics | anonymize/retain aggregate |
| `user_activity` | PK `id`; FK `user_id`; path/method/timestamp; analytics | anonymize/retain aggregate |
| `session` | PK `sid`; `sess` JSON, `expire`; security audit | expire/delete |
| `api_tokens` | PK `id`; unique token; FK `user_id`; scopes, active/expiry; security audit | revoke/delete |
| `user_profiles` | PK `id`; unique FK `user_id`; names, photo, phone, address, socials; PII | delete/anonymize |
| `email_templates` | PK `id`; FK `created_by`; content/variables/active; user content | retain/delete by owner |
| `email_logs` | PK `id`; recipient, subject, FK template/token, status/error/message/metadata; PII/security audit | retain controlled; anonymize |
| `page_contents` | PK `id`; unique slug; content/timestamps/FKs creator/updater; user content | retain/delete by policy |
| `seo_settings` | PK `id`; site/metadata/tracking fields/FK updater; analytics/config | retain, remove identifiers |
| `system_settings` | PK `id`; unique key/value/secret flag/category/FK updater; security/config | rotate/delete secrets |

Constraints are those expressed in the Drizzle schema: primary keys, `notNull`,
`unique`, defaults and listed foreign keys. No explicit triggers or sequences
are declared beyond PostgreSQL `serial` sequences. C0 must still inspect a
live readonly catalog for unmanaged constraints, sequences, triggers and raw
SQL dependencies before cutover.

Known raw SQL references are in `tunes/server/storage.ts`: song position
arithmetic, last-30-day queries and `pg_stat_activity`; and in
`tunes/server/legacy-routes.ts`: request logging. All routes, storage, YouTube,
playback, widgets, analytics, subscriptions, session, and deletion code are
within the source scan boundary `tunes/server/**/*.ts` plus
`tunes/client/src/**/*.tsx`. External Strapi `songLimits` is a separate
dependent data family (analytics/entitlement) and is not a Tunes table.

## Runtime API / transport inventory

Registered REST sources: `auth.ts` (login/register/logout/check/CSRF),
`auth-bridge-routes.ts` (sync/user-data/onboarding), `user-routes.ts`
(user/devices), `legacy-routes.ts` (playlists, queue, public guest playlists,
profile, verification, admin users/team/tokens/email/system/page content,
YouTube, Strapi debug/config/GraphQL, analytics), `routes/*` (auth, playlist,
admin, Strapi, YouTube, email, page, reactivation, payment, subscriptions,
Gemini, Instagram, scrape), `seo-routes.ts` (SEO/robots/sitemaps), and
`google-oauth-routes.ts`. Public routes include guest playlist, robots, sitemap
and iTunes search. Native session routes are the Passport login/logout/check
paths; service-token calls are the `/graphql` proxy and `strapi-service.ts`.
Authorization is heterogeneous (`requireAuth`, `requireAnyAuth`, Passport
session, JWT `authenticateToken`, CSRF, rate limits, and some public routes),
which is itself a C0 cutover risk requiring route-by-route review.

Socket.IO is registered in `legacy-routes.ts`: connection, `player_state`, and
`disconnect`, with `message` broadcast events keyed by guest URL. The only
observed scheduler is the reactivation-service token cleanup interval. There is
no C0 evidence of a separate job runner. Delete/block/reactivate endpoints are
in legacy admin/user paths and `reactivationRoutes`; their Strapi lifecycle
equivalence remains unproven and blocks live provisioning.
