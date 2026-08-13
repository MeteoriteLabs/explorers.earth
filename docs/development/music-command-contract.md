# Music command contract (v1)

All commands accept `--format human|json`; fixture mode is the default and live
mode is opt-in with `--mode live`. Human output gives the next and recovery
command. JSON is a single final object with `schemaVersion`, `command`,
`runId`, `status`, `phase`, `durationMs`, `artifacts`, `checkpoint`, and a
redacted `error` when present.

The documented public JSON invocation is `npm run --silent <music-command> --
--format json`. Run root `npm ci` first: the root lockfile supplies `tsx` and the
CLI's typed configuration dependency before either child dependency tree
exists. `music:bootstrap` then installs Tunes and Explorers. This is supported
at the pinned minimum Node 22.12.0; do not invoke the TypeScript entrypoint with
bare `node`.

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
`music:db:migrate`, `music:db:verify`, `music:db:reset`, and
`music:fixtures:capture`.

`music:bootstrap` creates only disposable secrets in ignored `.env.music.test`;
it never requests payment or production API credentials. `music:down` retains
volumes. Volume deletion requires `--volumes --confirm-project
explorers-music-fixture`; reset additionally requires `--mode fixture` and the
same confirmation. Before cleanup, the CLI renders the Compose model, resolves
and inspects every actual container, network, and volume, and refuses absent,
unlabeled, mismatched, or production-like resources. Project-name confirmation
alone is never sufficient.

Child output is captured and sanitized under `.artifacts/music-runs/<runId>`;
JSON stdout contains exactly one envelope. Verification, prerequisite,
dependency, and safety failures retain their distinct exit categories, with
phase-specific next and recovery commands. Resume uses the actual Git SHA and
rejects a changed commit, fixture/schema version, validated gate values, or
SHA-256 environment fingerprint. SIGINT/SIGTERM terminates only tracked child
process trees before the atomic checkpoint is written.

C3 database status, migrate, and verify require explicit `--target test` and
read only the exact allowlisted `DATABASE_URL_TEST` target
`127.0.0.1:55432/music_fixture`. They reject an ambient `DATABASE_URL` and emit
redacted target, expected/current ID, checksum and pending-list evidence.
Status and verify are read-only; migrate uses the checked-in forward-only
checksummed chain and never invokes `drizzle-kit push`.

Reset additionally requires `--mode fixture --target test --confirm-project
explorers-music-fixture --confirm-reset "RESET
explorers-music-fixture/music_fixture"`. It verifies the labeled Compose
resources before removing only that project's disposable volumes.

`music:fixtures:capture --mode live --format json` requires both
`LIVE_STRAPI_URL` and `LIVE_STRAPI_READ_ONLY_CREDENTIAL`, then remains blocked
until TK (identity owner) reviews the endpoint allowlist. No network call is
made before that gate. Fixture captures are schema-versioned, sanitized,
secret-scanned, and refreshed only after identity-owner review; drift is a
blocking change, never silently accepted.
