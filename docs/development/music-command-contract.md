# Music command contract (v1)

All commands accept `--format human|json`; fixture mode is the default and live
mode is opt-in with `--mode live`. Human output gives the next and recovery
command. JSON is a single final object with `schemaVersion`, `command`,
`runId`, `status`, `phase`, `durationMs`, `artifacts`, `checkpoint`, and a
redacted `error` when present.

| Exit | Meaning |
| --- | --- |
| 0 | successful verification/action |
| 1 | verification failure |
| 2 | usage or configuration error |
| 3 | prerequisite or state mismatch |
| 4 | dependency unavailable |
| 5 | safety refusal |
| 130 | SIGINT/SIGTERM; owned children stopped and checkpoint atomically written |

Root commands: `music:bootstrap`, `music:doctor`, `music:up`,
`music:test:smoke`, `music:test:all`, `music:down`, `music:db:status`,
`music:db:migrate`, `music:db:reset`, and `music:fixtures:capture`.

`music:bootstrap` creates only disposable secrets in ignored `.env.music.test`;
it never requests payment or production API credentials. `music:down` retains
volumes. Volume deletion requires `--volumes --confirm-project
explorers-music-fixture`; reset additionally requires `--mode fixture` and the
same confirmation. Resume must reject a changed commit, fixture version, gate
values, or environment fingerprint recorded in the checkpoint.

`music:fixtures:capture --mode live --format json` requires both
`LIVE_STRAPI_URL` and `LIVE_STRAPI_READ_ONLY_CREDENTIAL`, then remains blocked
until TK (identity owner) reviews the endpoint allowlist. No network call is
made before that gate. Fixture captures are schema-versioned, sanitized,
secret-scanned, and refreshed only after identity-owner review; drift is a
blocking change, never silently accepted.
