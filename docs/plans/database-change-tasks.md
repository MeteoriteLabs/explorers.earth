# TASKS: Switch Tunes from Neon Cloud to Self-Hosted Postgres

**Date**: 2026-03-15
**Related**: [database-change-feature.md](./database-change-feature.md)

---

## Tasks

- [ ] T1: **Swap database driver in package.json** — Remove `@neondatabase/serverless` and `ws` from dependencies. Add `pg` (^8.13.1) to dependencies and `@types/pg` (^8.11.6) to devDependencies. Add scripts: `"db:generate": "drizzle-kit generate"` and `"db:migrate": "drizzle-kit migrate"`. Keep `"db:push"` for local dev. Run `npm install` to update lockfile.

- [ ] T2: **Rewrite server/db.ts** (depends: T1) — Replace Neon serverless driver with standard `pg` driver. Change imports from `@neondatabase/serverless` + `drizzle-orm/neon-serverless` to `pg` + `drizzle-orm/node-postgres`. Remove `import ws from "ws"`. Remove `neonConfig.webSocketConstructor = ws`. Note: `drizzle({ client: pool, schema })` call is compatible with both adapters — no change needed on that line. Keep all exports (`pool`, `db`) identical.

- [ ] T3: **Delete obsolete Neon script** (depends: T1) — Delete `tunes/scripts/create-system-settings-table.ts`. It uses Neon-specific imports (`neon()` function) and is obsolete — the `system_settings` table is defined in `shared/schema.ts` and handled by Drizzle migrations.

- [ ] T4: **Harden docker-compose.yml** — Production-harden the existing `db` service. Changes:
  - Rename database: `DB_USER` default `cosmic` → `tunes`, `DB_NAME` default `cosmic` → `tunes`
  - Rename volume: `postgres-data` → `postgres-data-v2` (forces fresh init — old volume has `cosmic` user, incompatible with `tunes` user)
  - Rename network: `cosmic-network` → `tunes-network`
  - Memory limit: use `mem_limit: 1g` (NOT `deploy.resources.limits` — that only works in Swarm mode)
  - CPU limit: use `cpus: '1.0'`
  - Postgres tuning via `command`: `shared_buffers=256MB`, `effective_cache_size=1GB`, `work_mem=4MB`, `maintenance_work_mem=64MB`, `max_connections=50`
  - Healthcheck: `pg_isready -U tunes -d tunes`, interval 10s, timeout 5s, retries 5, start_period 30s
  - `depends_on` with `condition: service_healthy`
  - Docker log limits: `logging: driver: json-file, options: max-size: "10m", max-file: "3"` on both services
  - Port: `127.0.0.1:5432:5432` (localhost only, not internet-exposed)
  - Backup volume: `postgres-backups:/backups`
  - Remove `ALLOWED_ORIGINS` from db env (not a Postgres variable)
  - Construct `DATABASE_URL` inline in app env: `postgresql://${DB_USER:-tunes}:${DB_PASS}@db:5432/${DB_NAME:-tunes}`
  - Remove standalone `DATABASE_URL=${DATABASE_URL}` from app env

- [ ] T5: **Update Dockerfile** (depends: T1) — Add two COPY lines to the runner stage (after line 51, before EXPOSE):
  - `COPY --from=builder /app/migrations ./migrations` — migration SQL files needed by `drizzle-kit migrate`
  - `COPY --from=builder /app/shared ./shared` — schema file needed by `drizzle.config.ts` (references `./shared/schema.ts`)
  Currently only `drizzle.config.ts` is copied but not the `migrations/` or `shared/` folders it depends on.

- [ ] T6: **Update .env.example** (depends: T4) — Replace Neon connection string with local DB variables (`DB_USER=tunes`, `DB_PASS=tunespass`, `DB_NAME=tunes`). Remove old `DATABASE_URL`, `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGPORT` entries. Add comment: `# DATABASE_URL is constructed automatically in docker-compose from DB_USER/DB_PASS/DB_NAME`.

- [ ] T7: **Rework CI/CD workflow** (depends: T4, T5) — Rewrite `tunes/.github/workflows/main.yml` deploy script. Key changes:
  - .env creation: Replace `DATABASE_URL=${{ secrets.DATABASE_URL }}` with `DB_USER`, `DB_PASS`, `DB_NAME` from secrets
  - Deploy sequence (correct order):
    ```
    1. docker compose up -d db                    # Ensure DB is running (no-op if already up)
    2. docker compose build app                   # Rebuild ONLY the app image
    3. docker compose up -d --no-deps app         # Restart ONLY the app container (injects env vars)
    4. sleep 5                                    # Wait for container to start
    5. docker compose exec -T app npx drizzle-kit migrate  # Apply pending migrations
    ```
  - Add backup cron setup (idempotent — uses `sort -u` to avoid duplicates)
  - Document new GitHub secrets: `DB_USER`, `DB_PASS`, `DB_NAME`
  - Remove old secret: `DATABASE_URL`
  - Note: migration runs AFTER app starts because `drizzle-kit migrate` needs `DATABASE_URL` env var which is only available inside the running container

- [ ] T8: **Generate initial migration** (depends: T1) — Run `npx drizzle-kit generate` to create the initial migration file from the existing `shared/schema.ts`. This migration creates all 21 tables on the first deploy. Commit the generated migration file to `migrations/` folder.

- [ ] T9: **Update root package.json scripts** (depends: T1) — Update root `package.json` to add/update `db:generate` and `db:migrate` scripts pointing to tunes directory.

- [ ] T10: **Update tunes documentation** (depends: T2, T4, T7) — Update `tunes/CLAUDE.md` line 11: change `@neondatabase/serverless` to `pg (node-postgres)`. Update `docs/tunes/database.md` lines 6-7: change driver reference. Update "Add a new database table" instructions to use `db:generate` + `db:migrate` instead of `db:push`. Update "Commands" section with new migration workflow.

- [ ] T11: **Update root documentation** (depends: T9) — Update root `CLAUDE.md`: change `npm run db:push` to `npm run db:generate` + `npm run db:migrate`. Add explanation of the generate → review → commit → deploy workflow.

- [ ] T12: **Create GOTCHAS.md** — Create `GOTCHAS.md` at the project root documenting known gotchas:
  1. Never use `docker compose down -v` in production (deletes DB data volumes)
  2. Never use `docker compose down` in CI/CD (stops the DB unnecessarily)
  3. Port 5432 in Docker bypasses `ufw`/`iptables` — must bind to `127.0.0.1`
  4. `drizzle-kit push` prompts interactively on destructive changes — use `generate` + `migrate` in CI/CD
  5. `ws` package is NOT shared with Socket.IO — they are independent WebSocket implementations
  6. Client files `use-neon-user.ts` and `use-auth-compat.tsx` have "Neon" in names but no Neon imports (cosmetic only)
  7. `deploy.resources.limits` in docker-compose only works in Swarm mode — use `mem_limit`/`cpus` for plain docker compose
  8. Renaming Postgres user requires a fresh volume — existing data directories are user-specific
  9. Dockerfile runner stage must explicitly COPY both `migrations/` and `shared/` folders — they're not included in `dist/` but are needed by `drizzle-kit migrate` and `drizzle.config.ts` at runtime
  10. `drizzle-kit` is in `devDependencies` but is needed at runtime in production for `drizzle-kit migrate`. This works today because the Dockerfile runs `npm ci` without `--omit=dev`, so devDependencies ARE installed. If someone adds `--omit=dev` to optimize the image, migrations will break. Consider moving `drizzle-kit` to `dependencies` or documenting this explicitly

- [ ] T13: **Verify and test** (depends: all above) — Since the project has **zero automated tests** (no test runner, no test files, no test framework), all verification is manual. This task covers static checks, local build validation, and post-deploy functional testing.

  **Phase 1: Static checks (pre-deploy, local machine)**
  - TypeScript compilation passes (`npm run check`)
  - `drizzle-kit generate` produces a valid initial migration with all 21 tables
  - Docker compose config is valid (`docker compose config` — no syntax errors)
  - Grep for leftover references: no `@neondatabase` in code, no `cosmic` in docker-compose/env
  - All driver references use `pg` (not `@neondatabase/serverless`)
  - Dockerfile copies both `migrations/` and `shared/` folders
  - CI/CD workflow uses correct deploy order (build → start → migrate)
  - `.env.example` has correct variables (`DB_USER`, `DB_PASS`, `DB_NAME`)
  - Memory limits use `mem_limit` not `deploy.resources.limits`

  **Phase 2: Local Docker build test (pre-deploy, local machine)**
  - `docker compose build app` succeeds without errors
  - `docker compose up -d db` starts Postgres and healthcheck passes within 30s
  - `docker compose up -d --no-deps app` starts the app container
  - `docker compose exec -T app npx drizzle-kit migrate` applies initial migration successfully
  - `docker compose exec db psql -U tunes -d tunes -c '\dt'` shows all 21 tables
  - App responds on `http://localhost:5001` (or configured port)
  - `docker compose logs db` shows no errors
  - `docker compose logs app` shows successful startup + DB connection

  **Phase 3: Functional testing (post-deploy, on server or local Docker)**
  - **User registration**: Create a new account → verify user row exists in `users` table
  - **Login/logout**: Login with created account → session persists → logout → session cleared
  - **Session persistence**: Login → restart app container (`docker compose restart app`) → session still valid (connect-pg-simple stores in DB)
  - **Playlist CRUD**: Create playlist → add songs → edit playlist → delete playlist → verify DB state
  - **Song queue**: Add songs to queue → verify `songs` table has entries with correct status
  - **WebSocket real-time**: Open two browser tabs → add song in one → verify it appears in the other (Socket.IO independence from `ws` package)
  - **YouTube search**: Search for a song → verify YouTube API integration works (not DB-dependent but validates app health)
  - **Guest access**: Open a playlist share URL → verify guest can view and interact
  - **Admin panel**: Login as admin → verify admin dashboard loads and shows data

  **Phase 4: Infrastructure verification (post-deploy, on server)**
  - `docker inspect <db-container>` shows: memory limit 1 GB, healthcheck configured
  - `ss -tlnp | grep 5432` confirms port is NOT listening on `0.0.0.0` (only `127.0.0.1`)
  - `docker compose exec db pg_isready -U tunes -d tunes` returns "accepting connections"
  - Test backup manually: `docker compose exec db pg_dump -U tunes tunes | gzip > /tmp/test-backup.gz` → verify file is non-empty
  - Verify backup cron is installed: `crontab -l` shows the 3 AM pg_dump job
  - Deploy test: push a trivial change → verify only `app` container restarts, `db` container uptime unchanged (`docker inspect --format='{{.State.StartedAt}}' <db-container>`)
  - Verify `docker compose exec -T app npx drizzle-kit migrate` is idempotent (running it twice doesn't error)

  **Phase 5: Cleanup verification**
  - `package.json` does NOT contain `@neondatabase/serverless` or `ws`
  - `node_modules/@neondatabase/` does NOT exist in the built image
  - `server/db.ts` imports from `pg` and `drizzle-orm/node-postgres`
  - `scripts/create-system-settings-table.ts` is deleted
  - All documentation references updated (CLAUDE.md, database.md)
  - `.env.example` has no Neon connection strings

---

## Dependency Graph

```
T1 (package.json + scripts)
├── T2 (db.ts) ──────────────────────┐
├── T3 (delete Neon script)          │
├── T8 (initial migration)          │
├── T9 (root package.json scripts)  │
│                                    │
T4 (docker-compose) ─┐              │
├── T6 (.env.example) │              │
│                     │              │
T5 (Dockerfile) ──────┤              │
│                     │              │
T7 (CI/CD workflow) ←─┤── T4, T5    │
│                                    │
T10 (tunes docs) ←── T2, T4, T7     │
T11 (root docs) ←── T9              │
T12 (GOTCHAS.md) ←── (none)         │
                                     │
T13 (verify) ←── ALL ───────────────┘
```

## Notes

- T1-T3 can be done in parallel with T4-T6 (independent concerns: driver swap vs infrastructure)
- T5 (Dockerfile) is a NEW task added after review — original plan missed that `migrations/` and `shared/` folders aren't copied
- T7 depends on T4 AND T5 (needs both docker-compose and Dockerfile changes)
- T8 depends on T1 (need `pg` installed to generate migrations)
- T9-T11 are documentation tasks, should be done after code tasks
- T12 (GOTCHAS.md) has no dependencies and can be created at any point
- T13 is the final verification gate before merge

## Critical Implementation Notes

1. **Migration execution order**: Migrations must run AFTER the app container starts (not before). The container needs to be running to have `DATABASE_URL` available as an env var. Correct order: build → start → sleep → migrate.

2. **Memory limits**: Use `mem_limit: 1g` and `cpus: '1.0'` in docker-compose, NOT `deploy.resources.limits` which only works in Docker Swarm mode.

3. **Volume rename**: Must rename `postgres-data` → `postgres-data-v2` when changing user from `cosmic` to `tunes`. Postgres cannot re-initialize an existing data directory with a different user.

4. **Dockerfile change**: Add `COPY --from=builder /app/migrations ./migrations` AND `COPY --from=builder /app/shared ./shared` BEFORE the EXPOSE line. Without these, `drizzle-kit migrate` will find no migration files, and `drizzle.config.ts` will fail because it references `./shared/schema.ts`.

5. **drizzle({ client: pool, schema })**: This call syntax is compatible with BOTH the Neon and node-postgres adapters. No change needed on this specific line — only the import statements change.

6. **drizzle-kit in devDependencies**: `drizzle-kit` is currently in `devDependencies` but is needed at runtime for `drizzle-kit migrate` in the production container. This works because the Dockerfile uses `npm ci` without `--omit=dev`. If the Dockerfile is ever optimized to exclude devDependencies, migrations will break silently.

7. **No automated tests**: The project has zero test files, no test runner, and no test framework. All verification in T13 is manual. Consider adding at minimum a smoke test that verifies DB connectivity after the migration.
