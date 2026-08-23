# Music identity testing and clean-checkout guide

## Prerequisites and safe target

Use Node 22.12 or newer, npm, and Docker Compose v2. Run from the repository root. Fixture mode is the default and uses deterministic fake Strapi plus disposable PostgreSQL 15. Never create or export `DATABASE_URL`; the only test database authority is `DATABASE_URL_TEST=postgresql://music_migrator@127.0.0.1:55432/music_fixture`, created and validated by bootstrap. Every migration/reset/integration command refuses any different host, port, user, or database name.

From a clean checkout:

```text
nvm use
npm ci
npm ci --prefix tunes --legacy-peer-deps
npm ci --prefix explorers-earth
npm run music:bootstrap -- --mode fixture
npm run music:doctor -- --mode fixture
npm run music:up -- --mode fixture --detach --wait
npm run music:test:smoke -- --mode fixture
npm run music:down -- --mode fixture
```

`music:down` preserves volumes. Volume deletion requires the exact isolated Compose project and matching `--confirm-project`; it refuses unlabeled or mismatched resources. Do not inspect, copy, or commit the generated `.env.music.test` or `.artifacts` credentials.

## Executable lanes

| Lane | Budget | Command | Proof |
|---|---:|---|---|
| fast | 3 minutes | `npm run music:test:fast -- --mode fixture` | scoped types plus focused Tunes and Explorer Music units |
| PR | 15 minutes | `npm run music:test:pr -- --mode fixture` | critical 100% coverage, normalized diagnostics, full units/contracts/security, disposable migrations/real DB, browser smoke |
| nightly | 45 minutes | `npm run music:test:nightly -- --mode fixture` | full-stack and accessibility browsers, load/chaos, interruption/resume, fixture drift |
| release | 60 minutes | native launcher only | exact fixture/digest, real Docker migration/readiness/rollback/kill-switch rehearsal and sanitized evidence |

`music:test:all` is the public non-production aggregate. Release has intentionally no root npm shortcut: use the checked-in native launcher through the approved release rehearsal. No test command opens `GATE_PROD`, deploys, pushes, or mutates a live service.

## Dependency order

CI gates static baseline, unit and per-file critical coverage, documentation/API/route/environment/migration contracts, disposable migrations, real PostgreSQL repositories, REST/Socket.IO security, Explorer frontend, browser E2E/accessibility, scheduled load/chaos, and image/deployment contracts in that order. Documentation-only changes run the same contract authority rather than bypassing CI.

Contract tests fail when a stable Music route lacks policy/OpenAPI coverage, a runtime table is absent from the manifest, a migration ID/file diverges, a stable error code is not documented, a public command disappears, a required fixture environment value is missing, a new TypeScript diagnostic appears, or a forbidden owner/auth pattern returns.

Critical identity, authorization, token, lifecycle, selection, precedence, and redaction modules require 100% lines, branches, functions, and statements per file. Repository-wide legacy debt may not regress. Tunes is Express 5.2 at runtime with Express 4.17 type definitions; the scoped gate protects new Music code while the normalized baseline prevents new legacy diagnostics. Both clients are React 18.3.

## Evidence and failures

Every CLI result uses the versioned human/JSON envelope, stable exit code, run ID, phase, duration, sanitized artifact paths, checkpoint, and recovery command. A prior green is not current evidence: rerun the focused test, the affected lane, `npm run music:types:scoped`, `npm run music:types:baseline`, and `git diff --check` before committing.

Exit 1 is a verification failure, 2 usage/config, 3 prerequisite/state mismatch, 4 dependency unavailable, 5 safety refusal, 78 native release authority refusal, 130 interruption. Interrupts clean owned children and write an atomic checkpoint; resume rejects a different commit, fixture version, gate set, migration epoch, thresholds, or environment fingerprint.
