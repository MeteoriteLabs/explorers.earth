# FEATURE: Switch Tunes from Neon Cloud to Self-Hosted Postgres

**Date**: 2026-03-15
**Status**: Planned
**Scope**: Tunes app (`tunes/`) + root monorepo config

---

## Goal

Eliminate the paid Neon cloud PostgreSQL dependency by switching to the self-hosted Postgres container that already exists in the Tunes docker-compose. This solves three problems:

1. **Cost**: Paying for Neon when a free local Postgres container already exists
2. **Latency**: Every DB query travels Helsinki (app) to Singapore (Neon) and back
3. **CI/CD fragility**: Current deploys stop the entire stack (including DB) on every push

---

## Context (What Exists Today)

### Current infrastructure

```
Hetzner Helsinki (4 servers):
  - Explorers (CX22, 40 GB) — Explorers frontend
  - Tunes (CX23, 2 vCPU, 4 GB RAM, 40 GB) — Tunes app
  - LocalQR-Strapi-Prod (CAX21, 80 GB) — Strapi production
  - LocalQR-Strapi-Dev (CAX21, 80 GB) — Strapi dev

External:
  - Neon Cloud (Singapore) — PostgreSQL (PAID)
```

### Current Tunes docker-compose

- `app` service: Node.js/Express on port 5001
- `db` service: `postgres:15-alpine` — **exists but DATABASE_URL points to Neon, not here**
- Named volume `postgres-data` for persistence
- Both on `cosmic-network` bridge

### Current database driver (`tunes/server/db.ts`)

```ts
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
neonConfig.webSocketConstructor = ws;
```

Uses Neon's WebSocket-based serverless driver. Must be replaced with standard `pg` driver.

### Current CI/CD (`tunes/.github/workflows/main.yml`)

```
Push to main → SCP to server → docker compose down → docker compose up --build
```

Stops the database on every deploy. No automated schema migrations.

### Current migration strategy

Manual `drizzle-kit push` (interactive, no version history, no rollback).

---

## What Changes

### Architecture after

```
Hetzner Helsinki:
  - Tunes Server (CX23):
      Docker: app (Node.js/Express) ──local──> Docker: db (postgres:15-alpine)
                                                  + healthcheck
                                                  + memory limits (1 GB)
                                                  + daily backups
                                                  + localhost-only port

External:
  - Neon Cloud — CANCELLED
```

### Code changes summary

| # | File | Change |
|---|------|--------|
| 1 | `tunes/package.json` | Remove `@neondatabase/serverless` + `ws`. Add `pg` + `@types/pg`. Add `db:generate` and `db:migrate` scripts |
| 2 | `tunes/server/db.ts` | Full rewrite: Neon driver → standard `pg` + `drizzle-orm/node-postgres` |
| 3 | `tunes/docker-compose.yml` | Production hardening: memory limits (via `mem_limit`/`cpus`), healthcheck, Postgres tuning, log limits, localhost port, backup volume. Rename DB from `cosmic` to `tunes`. Rename volume `postgres-data` → `postgres-data-v2` |
| 4 | `tunes/Dockerfile` | Add `COPY migrations ./migrations` and `COPY shared ./shared` to runner stage so migration SQL files and schema are available in the production image |
| 5 | `tunes/.github/workflows/main.yml` | App-only rebuild (never stop DB). Add migration step + backup cron. Correct execution order: build → start → migrate |
| 6 | `tunes/.env.example` | Replace Neon connection string with local DB variables |
| 7 | `tunes/scripts/create-system-settings-table.ts` | Delete (obsolete — uses Neon imports, replaced by drizzle-kit) |
| 8 | `tunes/CLAUDE.md` | Update driver reference |
| 9 | `docs/tunes/database.md` | Update driver reference |
| 10 | `CLAUDE.md` (root) | Update `db:push` reference to `db:generate` + `db:migrate` |
| 11 | `package.json` (root) | Update/add `db:generate` and `db:migrate` scripts |

**Note**: `tunes/Dockerfile` was not in the original plan. Added after review found that the runner stage does not copy the `migrations/` or `shared/` folders.

---

## In Scope

- Swap `@neondatabase/serverless` driver for standard `pg` driver
- Rewrite `server/db.ts`
- Harden `docker-compose.yml` (memory limits via `mem_limit`/`cpus`, healthcheck, Postgres tuning, log limits, security)
- Update `Dockerfile` to copy `migrations/` folder into production image
- Rename database from `cosmic` to `tunes`
- Rework CI/CD to app-only rebuild (never stop DB during deploys)
- Switch migration strategy from `db:push` to `drizzle-kit generate` + `drizzle-kit migrate`
- Set up automated daily backups (pg_dump cron, 14-day retention)
- Update all documentation (CLAUDE.md, docs/tunes/database.md)
- Update root monorepo scripts
- Create DECISIONS.md and GOTCHAS.md for the project
- Cancel Neon subscription (clean cut, no fallback period)

## Out of Scope

- Data migration from Neon (fresh database — no existing data needed)
- Client-side "Neon" naming cleanup (`use-neon-user.ts`, `use-auth-compat.tsx`) — cosmetic, do later
- Adding a `/health` API endpoint — nice-to-have, not required for this change
- Zero-downtime deploys — acceptable brief downtime during app restart
- WAL archiving / point-in-time recovery — daily pg_dump is sufficient for now
- Explorers app changes — this only affects the Tunes app

---

## Data Model Changes

**No schema changes.** All 21 tables remain identical. The only change is:

- Database name: `cosmic` → `tunes`
- Database user: `cosmic` → `tunes`
- Docker volume: `postgres-data` → `postgres-data-v2` (forces fresh initialization — old volume with `cosmic` user is incompatible)
- Connection: Neon cloud URL → local Docker container (`db:5432`)

Tables created fresh by `drizzle-kit migrate` on first deploy.

---

## API / Interface Contract

**No API changes.** All REST endpoints, WebSocket events, and Strapi/SSO integrations remain identical. The driver swap is internal — no external interface changes.

Internal change only:
- `pool` export from `server/db.ts`: type changes from `@neondatabase/serverless.Pool` → `pg.Pool` (same interface, verified compatible with `connect-pg-simple` and all `pool.query()` callers)

---

## Business Logic & Edge Cases

**No business logic changes.** All Drizzle ORM queries, session management, WebSocket events, and payment flows remain identical.

### Edge cases to verify

1. **Session persistence**: `connect-pg-simple` uses the `pool` from `db.ts`. Verified that standard `pg.Pool` is accepted (same constructor signature).
2. **Legacy routes**: `server/legacy-routes.ts` imports `db` from `./db`. The Drizzle instance API is identical between `drizzle-orm/neon-serverless` and `drizzle-orm/node-postgres`.
3. **Setup script**: `scripts/setup-session-store.ts` imports `pool` and calls `pool.query()` + `pool.end()`. Standard `pg.Pool` has these methods.
4. **First deploy**: Database is empty. `drizzle-kit migrate` must create all tables before the app starts accepting requests.

---

## Acceptance Criteria

### AC1: Driver swap
- **Given** the app is deployed with the new `pg` driver
- **When** a user registers, creates a playlist, and adds songs
- **Then** all data is persisted in the local Postgres container (not Neon)

### AC2: Docker hardening
- **Given** the `db` service has the new configuration
- **When** I run `docker inspect` on the DB container
- **Then** I see: memory limit 1 GB, healthcheck configured, port bound to 127.0.0.1

### AC3: CI/CD app-only rebuild
- **Given** a code change is pushed to main
- **When** GitHub Actions deploys
- **Then** only the `app` container restarts; the `db` container remains running with the same uptime

### AC4: Schema migrations
- **Given** a developer adds a new table to `shared/schema.ts`
- **When** they run `npx drizzle-kit generate` and push the migration file
- **Then** CI/CD applies it automatically via `drizzle-kit migrate`

### AC5: Automated backups
- **Given** the backup cron is set up
- **When** 3:00 AM passes
- **Then** a gzipped `pg_dump` file exists in the backup volume, and files older than 14 days are removed

### AC6: Database tables exist
- **Given** the first deploy completes
- **When** I run `\dt` in the Postgres container
- **Then** all 21 tables from `shared/schema.ts` exist

### AC7: Documentation updated
- **Given** the implementation is complete
- **When** I read `tunes/CLAUDE.md`, `docs/tunes/database.md`, and root `CLAUDE.md`
- **Then** all references to Neon and `db:push` are updated to `pg` and `db:generate`/`db:migrate`

### AC8: Neon removed
- **Given** all verifications pass
- **When** I check `package.json`
- **Then** `@neondatabase/serverless` and `ws` are not in dependencies

---

## Review Findings (Post-Audit Fixes)

The following issues were found during code review and corrected in this spec:

### Issue 1: `deploy.resources.limits` doesn't work with plain docker compose
**Problem**: `deploy.resources.limits` only enforces in Docker Swarm mode. Plain `docker compose up` ignores them silently.
**Fix**: Use `mem_limit` and `cpus` properties instead — these work with standard docker compose.

### Issue 2: Dockerfile doesn't copy `migrations/` or `shared/` folders
**Problem**: The runner stage in `tunes/Dockerfile` copies `drizzle.config.ts` but NOT `migrations/` or `shared/`. Migration SQL files and the schema file (referenced by `drizzle.config.ts` as `./shared/schema.ts`) won't be available in the production container.
**Fix**: Add `COPY --from=builder /app/migrations ./migrations` and `COPY --from=builder /app/shared ./shared` to the Dockerfile runner stage. Added as a new file to modify (was not in original plan).

### Issue 3: Migration execution order was wrong
**Problem**: Original plan ran `drizzle-kit migrate` before starting the new app container. But `drizzle-kit migrate` needs `DATABASE_URL` env var, which is only injected when the container starts via `docker compose up`.
**Fix**: Correct order is: (1) build app, (2) start app with `--no-deps`, (3) exec `drizzle-kit migrate` inside the running container. The app startup will fail on missing tables, but migrations run immediately after and then the app self-heals (Express retries DB connections).

### Issue 4: Volume rename needed for `cosmic` → `tunes`
**Problem**: If the `postgres-data` volume exists on the server with data initialized under the `cosmic` user, changing `POSTGRES_USER` to `tunes` will cause Postgres to fail — it can't re-initialize an existing data directory with a different user.
**Fix**: Rename the volume from `postgres-data` to `postgres-data-v2` in docker-compose. This forces a fresh initialization with the `tunes` user. The old volume can be manually deleted later.

### Issue 5: Docker Compose variable substitution needs .env to exist
**Problem**: `DATABASE_URL=postgresql://${DB_USER:-tunes}:${DB_PASS}@db:5432/${DB_NAME:-tunes}` — if `.env` doesn't define `DB_PASS`, it expands to empty string.
**Fix**: CI/CD workflow always creates `.env` from GitHub secrets before running docker compose. The `:-tunes` default values handle `DB_USER` and `DB_NAME`. `DB_PASS` has no default intentionally (forces use of GitHub secret, never a default password).

### Issue 6: Dockerfile doesn't copy `shared/` folder
**Problem**: The runner stage copies `drizzle.config.ts` but NOT `shared/`. `drizzle.config.ts` references `./shared/schema.ts` as the schema source. Without it, `drizzle-kit migrate` fails at runtime because it can't resolve the schema.
**Fix**: Add `COPY --from=builder /app/shared ./shared` to the Dockerfile runner stage alongside the `migrations/` copy. Added to T5.

### Issue 7: `drizzle-kit` in devDependencies but needed at runtime
**Problem**: `drizzle-kit` is in `devDependencies` but `drizzle-kit migrate` runs inside the production container during CI/CD deploys. This works today because the Dockerfile runs `npm ci` without `--omit=dev`, so ALL dependencies (including devDependencies) are installed in the image.
**Fix**: No immediate change needed — it works as-is. Added as gotcha #11 in GOTCHAS.md. If someone optimizes the Docker image to exclude devDependencies (`npm ci --omit=dev`), migrations will break. Could move `drizzle-kit` to `dependencies` for safety, but that's a minor concern.

---

## Open Questions

None — all questions resolved during Phase 2 discussion and post-audit review.
