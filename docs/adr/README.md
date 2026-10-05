# Architecture Decision Records (ADRs)

## What Are ADRs?

Architecture Decision Records capture important architectural decisions made during the project, along with their context and consequences. They help future developers (and AI agents) understand **why** things are built the way they are.

## Index

| ADR | Decision | Status |
|-----|----------|--------|
| [001](001-monorepo-structure.md) | Monorepo structure for explorers-earth and tunes | Accepted |
| [002](002-auth-strategies.md) | Different auth strategies per app (JWT vs sessions) | Superseded in part |
| [003](003-realtime-websockets.md) | Socket.IO for real-time communication | Accepted |
| [004](004-database-orm-choice.md) | PostgreSQL with Drizzle ORM | Superseded in part |
| [005](005-music-identity-migration-deployment-authority.md) | Canonical Music identity, migrations, and deployment authority | Accepted |
| [006](006-canonical-music-identity-supersedes-strapi-proof.md) | Canonical session ensure for Music identity, superseding ADR-005's Strapi proof boundary | Proposed |

> **Pending owner decision (2026-10-05).** ADR-006 is **Proposed**, not Accepted. It supersedes only ADR-005 `:16-20` and `:30` — the bodyless `POST /api/music/identity/ensure` proof boundary and its three distinct scopes; ADR-005's migration and deployment-authority decisions stay in force unchanged. Accepting ADR-006 is the repository owner's decision, and two things follow from it that must not be done pre-emptively: ADR-005's status row above stays **Accepted** until that decision, and the "superseded in part by ADR-006" pointer belongs inside ADR-005 at that point, following the precedent set by [002](002-auth-strategies.md). Until then ticket 6.1 stays blocked, because a writer following current ADR authority would rebuild the Strapi proof exchange that 6.1 exists to remove.

## Template

When creating a new ADR, use this template:

```markdown
# ADR-NNN: Title

## Status
Accepted | Superseded | Deprecated

## Context
What is the issue or situation that motivates this decision?

## Decision
What is the change that we're making?

## Consequences
What becomes easier or harder as a result?

## Alternatives Considered
What other options were evaluated and why were they rejected?
```

## Guidelines

- Number ADRs sequentially (001, 002, ...)
- ADRs are immutable once accepted — if a decision changes, create a new ADR that supersedes the old one
- Keep ADRs concise — focus on the "why" not the "how"
- Add new ADRs when making significant architectural decisions
