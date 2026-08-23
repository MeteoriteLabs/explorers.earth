# Architecture Decision Records (ADRs)

## What Are ADRs?

Architecture Decision Records capture important architectural decisions made during the project, along with their context and consequences. They help future developers (and AI agents) understand **why** things are built the way they are.

## Index

| ADR | Decision | Status |
|-----|----------|--------|
| [001](001-monorepo-structure.md) | Monorepo structure for explorers-earth and tunes | Accepted |
| [002](002-auth-strategies.md) | Different auth strategies per app (JWT vs sessions) | Superseded in part |
| [003](003-realtime-websockets.md) | Socket.IO for real-time communication | Accepted |
| [004](004-database-orm-choice.md) | PostgreSQL with Drizzle ORM | Accepted |

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
