# DECISIONS: Switch Tunes from Neon Cloud to Self-Hosted Postgres

**Date**: 2026-03-15
**Related**: [database-change-feature.md](./database-change-feature.md)

---

## Decision: Use self-hosted Postgres instead of Neon cloud

**Date**: 2026-03-14
**Context**: Tunes app runs on Hetzner Helsinki but its database is on Neon cloud in Singapore. This creates latency on every query and costs money for a paid plan. The `docker-compose.yml` already has a local Postgres container that isn't being used.

**Choice made**: Self-hosted PostgreSQL 15 in Docker on the same Hetzner server (CX23: 2 vCPU, 4 GB RAM, 40 GB disk).

**Rejected alternatives**:
- **Stay on Neon (free tier)**: Would eliminate cost but not latency (still Singapore). Free tier has compute/storage limits.
- **Hetzner Managed Database**: ~€10/month, same datacenter, managed backups. Rejected because the DB is small/low-traffic — self-hosted is simpler and free.
- **Supabase**: ~$25/month, includes dashboard/pooling. Overkill for this use case.

**Agent assumed**: Would have recommended Hetzner Managed DB as the safest middle ground. User preferred self-hosted for cost savings.

---

## Decision: App-only rebuild CI/CD strategy

**Date**: 2026-03-15
**Context**: Current CI/CD runs `docker compose down` then `docker compose up --build`, which stops the database on every deploy. Even a 1-line CSS fix causes DB downtime.

**Choice made**: App-only rebuild — CI/CD only rebuilds and restarts the `app` container. The `db` container runs independently and is never stopped during deploys. Uses `docker compose build app` + `docker compose up -d --no-deps app`.

**Rejected alternatives**:
- **Full stack restart** (current): Simpler but causes unnecessary DB downtime on every deploy.
- **Split docker-compose files**: Separate `docker-compose.db.yml` for DB. Most isolated but adds complexity managing two compose files.

**Agent assumed**: Would have kept full stack restart for simplicity. Research revealed the DB stop is unnecessary and risky.

---

## Decision: Use drizzle-kit generate + migrate instead of push

**Date**: 2026-03-15
**Context**: Current workflow uses `drizzle-kit push` which runs interactively and can prompt for confirmation on destructive changes. Not safe for CI/CD automation. No version history of schema changes.

**Choice made**: Switch to `drizzle-kit generate` (creates versioned SQL migration files locally) + `drizzle-kit migrate` (applies them in CI/CD). Migration files are committed to git alongside schema changes.

**Rejected alternatives**:
- **Keep db:push**: Simpler but unsafe for CI/CD (interactive prompts, no rollback, no version history).
- **Raw SQL migrations**: Full control but loses Drizzle's schema diffing capability.

**Agent assumed**: Would have kept `db:push` and added a `--force` flag. Research revealed there is no reliable `--yes`/`--force` flag for destructive operations (open issue #4921).

---

## Decision: Daily pg_dump backups only (no WAL archiving)

**Date**: 2026-03-15
**Context**: Self-hosted Postgres means we lose Neon's automatic backups. Need a backup strategy. Options: daily pg_dump (simple, max 24h data loss) or pg_dump + WAL archiving (complex, seconds-level recovery).

**Choice made**: Daily pg_dump at 3 AM, gzipped, 14-day retention. Maximum data loss: 24 hours.

**Rejected alternatives**:
- **pg_dump + WAL archiving**: Enables point-in-time recovery but adds complexity and disk usage. Overkill for a small, low-traffic app.
- **No backups**: Unacceptable — self-hosted means we're responsible.

**Agent assumed**: Would have included WAL archiving for safety. User confirmed daily backups are sufficient for the current scale.

---

## Decision: Clean cut from Neon (no fallback period)

**Date**: 2026-03-15
**Context**: When switching to self-hosted, we could keep Neon running for 2 weeks as a safety net, or do a clean cut.

**Choice made**: Clean cut. Cancel Neon immediately after verifying the self-hosted setup works. No data migration needed (fresh database).

**Rejected alternatives**:
- **Keep Neon 2 weeks**: Safer but costs money and there's no data to fall back to (fresh DB).

**Agent assumed**: Would have recommended keeping Neon for 2 weeks as safety. User confirmed there's no data worth preserving.

---

## Decision: Rename database from `cosmic` to `tunes`

**Date**: 2026-03-15
**Context**: The Docker Postgres container defaults to database name `cosmic`, user `cosmic`, password `cosmicpass` — legacy naming from the original project. Since this is a fresh start, we can rename.

**Choice made**: Rename to `tunes` (DB name: `tunes`, DB user: `tunes`). Clearer, matches the app name.

**Rejected alternatives**:
- **Keep `cosmic`**: No rename needed but confusing — "cosmic" doesn't match anything in the current project.
- **Use `localqr`**: Old project name, even more confusing.

**Agent assumed**: Would have kept `cosmic` to avoid unnecessary changes. User preferred `tunes` for clarity.

---

## Decision: Remove `ws` package from dependencies

**Date**: 2026-03-15
**Context**: The `ws` (WebSocket) package is in dependencies. Audit revealed it is ONLY used for `neonConfig.webSocketConstructor = ws` in `server/db.ts`. Socket.IO (used for real-time features) has its own independent WebSocket implementation and does NOT use the `ws` package.

**Choice made**: Remove `ws` from dependencies when removing Neon driver.

**Rejected alternatives**:
- **Keep `ws`**: No harm but unnecessary dependency. Adds ~100KB to node_modules for no reason.

**Agent assumed**: Would have kept `ws` to avoid breaking anything. Audit confirmed Socket.IO is independent.

---

## Decision: Bind Postgres port to localhost only

**Date**: 2026-03-15
**Context**: Current `docker-compose.yml` exposes port 5432 with `ports: - "5432:5432"`. Docker bypasses `ufw`/`iptables`, meaning Postgres is accessible from the public internet with default credentials.

**Choice made**: Change to `ports: - "127.0.0.1:5432:5432"`. The app connects via Docker network (not localhost), so this only affects external access. Could also remove `ports` entirely since app-to-db communication uses the Docker bridge network.

**Rejected alternatives**:
- **Remove ports entirely**: Safest but prevents SSH-based debugging with `psql` from the host.
- **Keep as-is**: Security risk — public internet access to the database.

**Agent assumed**: Would have removed ports entirely. Kept localhost binding for debugging convenience.

---

## Decision: Use `mem_limit`/`cpus` instead of `deploy.resources.limits`

**Date**: 2026-03-15
**Context**: Original plan used `deploy.resources.limits.memory: 1G` to cap Postgres memory. Code review revealed this only works in Docker Swarm mode — plain `docker compose up` silently ignores it.

**Choice made**: Use `mem_limit: 1g` and `cpus: '1.0'` properties instead. These are enforced by plain `docker compose` without Swarm.

**Rejected alternatives**:
- **`deploy.resources.limits`**: Standard Compose Specification syntax but NOT enforced without orchestration. Would silently fail.
- **No limits**: Risk of Postgres consuming all 4 GB RAM and OOM-killing the app.

**Agent assumed**: Would have used `deploy.resources.limits` (it's the "newer" syntax). Review caught that it doesn't work without Swarm.

---

## Decision: Rename Docker volume to force fresh initialization

**Date**: 2026-03-15
**Context**: Renaming the Postgres user from `cosmic` to `tunes` while keeping the same Docker volume name (`postgres-data`) will cause Postgres to fail. The existing data directory was initialized with the `cosmic` user and can't be re-initialized with `tunes`.

**Choice made**: Rename the volume from `postgres-data` to `postgres-data-v2`. This forces Docker to create a new empty volume, and Postgres initializes fresh with the `tunes` user.

**Rejected alternatives**:
- **Keep `postgres-data` name**: Would fail if the volume exists on the server. Postgres error: "directory is not empty and was not initialized".
- **Keep `cosmic` user**: Would work but user explicitly chose to rename to `tunes`.
- **Manual volume deletion**: Requires SSH to server + manual `docker volume rm`. Error-prone.

**Agent assumed**: Would have kept the `cosmic` user to avoid this issue entirely. Since user wants `tunes`, volume rename is the safest path.

---

## Decision: Add `migrations/` COPY to Dockerfile

**Date**: 2026-03-15
**Context**: Code review found that `tunes/Dockerfile` runner stage copies `drizzle.config.ts` but NOT the `migrations/` folder. Without migration files, `drizzle-kit migrate` would find nothing to apply in production.

**Choice made**: Add `COPY --from=builder /app/migrations ./migrations` to the runner stage. This was NOT in the original plan — discovered during review.

**Rejected alternatives**:
- **Run migrations in builder stage**: Would require `DATABASE_URL` at build time (not available — it's a runtime env var).
- **Mount migrations as a Docker volume**: Adds complexity and coupling between host filesystem and container.

**Agent assumed**: Would have missed this entirely without the review. The Dockerfile looked complete because `drizzle.config.ts` was copied — but the SQL migration files were not.

---

## Decision: Migration runs AFTER app start, not before

**Date**: 2026-03-15
**Context**: Original plan had `drizzle-kit migrate` running before the new app container starts. But `drizzle-kit migrate` needs `DATABASE_URL` env var, which is only injected when the container starts via `docker compose up`.

**Choice made**: Correct execution order: (1) build app, (2) start app, (3) exec migrate inside running container. The app may briefly fail to serve requests until migrations complete, but Express will retry DB connections.

**Rejected alternatives**:
- **Run migrations before app start**: Impossible — `DATABASE_URL` isn't available until the container runs.
- **Run migrations at app startup in code**: Would require modifying `server/index.ts` to programmatically run `drizzle-kit migrate`. More reliable but increases code complexity and couples migration logic to app startup.
- **Separate migration container**: Add a one-shot container to docker-compose that runs migrations. Clean but adds infrastructure complexity.

**Agent assumed**: Would have put migrations before app start (the "logical" order). Review caught the env var dependency.
