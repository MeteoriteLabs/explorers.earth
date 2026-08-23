# ADR-004: PostgreSQL with Drizzle ORM

## Status
Superseded in part

## Context
tunes needs a relational database for structured data (users, playlists, songs, sessions) with support for complex queries (analytics, aggregations, regional statistics). The ORM choice affects developer experience, type safety, and query performance.

## Decision
Use **PostgreSQL** as the database with **Drizzle ORM** for type-safe database operations.

- PostgreSQL via `@neondatabase/serverless` (supports both Neon cloud and standard PostgreSQL)
- Drizzle ORM 0.39 for query building and schema definition
- `drizzle-zod` for automatic Zod validation schema generation from table definitions

The PostgreSQL and Drizzle choices remain accepted. The original implicit schema-synchronization decision is superseded: schema evolution uses reviewed, append-only SQL migrations checked into `tunes/migrations/`, bound to the executable migration chain, and applied by the same immutable image that is being promoted. See the [Tunes database guide](../tunes/database.md) and [immutable deployment runbook](../operations/music-deploy-runbook.md).

## Consequences

**Easier**:
- Full TypeScript type safety from schema definition through to query results
- Schema definitions in `shared/schema.ts` keep query and result types aligned with the reviewed migration state
- Drizzle's SQL-like API is intuitive for developers familiar with SQL
- `drizzle-zod` eliminates manual validation schema maintenance
- PostgreSQL's JSONB support handles flexible data (themes, device info, geo data)
- Checked-in migration bytes and a monotonic journal make schema state reproducible and auditable

**Harder**:
- Drizzle is newer than Prisma/TypeORM — smaller ecosystem and community
- Neon serverless driver has connection pooling considerations
- Schema changes require expand/contract compatibility and forward recovery; applied migration bytes are immutable
- Deployment rollback cannot move below the authenticated schema and security floors

## Alternatives Considered

**Prisma**: More mature ecosystem, better migration tooling with Prisma Migrate. Rejected because Drizzle's SQL-like API was preferred, and Drizzle generates lighter runtime overhead (no Prisma engine binary).

**TypeORM**: Well-established, decorator-based approach. Rejected because it's heavier, less type-safe, and the decorator pattern doesn't align with the project's functional style.

**MongoDB**: NoSQL flexibility. Rejected because the data model is inherently relational (users → playlists → songs, with many-to-many relationships and aggregation queries).
