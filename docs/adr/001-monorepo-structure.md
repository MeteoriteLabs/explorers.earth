# ADR-001: Monorepo Structure

## Status
Accepted

## Context
The team develops two web applications — **explorers-earth** (location sharing) and **tunes** (music playlists). These apps share a common user base and have a cross-app integration (explorers-earth embeds tunes features via `localTunesService`). They needed to be developed and maintained together while remaining independently deployable.

## Decision
Use a monorepo with a root `package.json` that runs both apps via `concurrently`. Each app has its own `package.json`, dependencies, and build process. There is no shared code library — only a cross-app REST API integration.

```
root/
├── package.json          # concurrently + workspace scripts
├── explorers-earth/      # independent React SPA
└── tunes/                # independent full-stack app
```

## Consequences

**Easier**:
- Single git history for both apps
- Coordinated releases when cross-app features change
- Shared documentation and CI/CD configuration
- One `npm run dev` starts both apps for integrated development

**Harder**:
- Git history is mixed — commits for both apps in one timeline
- CI/CD must handle both apps (or use path-based triggers)
- No compile-time type sharing between apps (only REST API contracts)

## Alternatives Considered

**Separate repositories**: Simpler git history per app, but harder to coordinate changes across the integration boundary. Cross-repo PRs are cumbersome.

**npm/yarn workspaces with shared packages**: Would enable compile-time type sharing, but the apps share very little code. The overhead of managing shared packages wasn't justified.
