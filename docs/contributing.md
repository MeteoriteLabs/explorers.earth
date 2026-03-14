# Contributing

## Getting Started

1. Follow the [Getting Started](getting-started.md) guide to set up your development environment
2. Understand the [Architecture](architecture.md) to know how the codebase is organized
3. Read the relevant app overview ([explorers-earth](explorers-earth/overview.md) or [tunes](tunes/overview.md))

## Branch Strategy

| Branch | Purpose | Merges to |
|--------|---------|-----------|
| `main` | Production-ready code | — |
| `staging` | Pre-production testing | `main` |
| `develop` | Active development | `staging` |
| `feat/*` | Feature branches | `develop` |
| `fix/*` | Bug fix branches | `develop` |

### Workflow

1. Create a feature branch from `develop`:
   ```bash
   git checkout develop
   git pull
   git checkout -b feat/your-feature-name
   ```
2. Make your changes and commit
3. Push your branch and open a PR to `develop`
4. After review and approval, merge to `develop`

## Code Style

### TypeScript

- Use TypeScript strict mode (both apps enforce this)
- Prefer explicit types over `any` — use `unknown` if the type is truly unknown
- Use Zod for runtime validation at system boundaries (API inputs, external data)
- Export types from schema files, not inline definitions

### React

- Functional components only — no class components
- Use hooks for state and side effects
- Feature modules should be self-contained (components + hooks + logic together)
- Prefer composition over inheritance

### Naming

- **Files**: kebab-case for components (`auth-page.tsx`), camelCase for utilities (`useToast.ts`)
- **Components**: PascalCase (`DashboardPage`, `InteractiveMap`)
- **Functions/hooks**: camelCase (`useWebSocket`, `handleSubmit`)
- **Constants**: SCREAMING_SNAKE_CASE for true constants, camelCase for config objects

### Styling

- Use Tailwind CSS utility classes — avoid custom CSS unless necessary
- Use `cn()` utility (from `clsx` + `tailwind-merge`) for conditional classes
- Responsive design: mobile-first approach (`sm:`, `md:`, `lg:` breakpoints)

### API Conventions (tunes)

- RESTful routes under `/api/`
- Use Zod schemas for request validation
- Return consistent JSON response shapes
- HTTP status codes: 200 (success), 201 (created), 400 (bad request), 401 (unauthorized), 404 (not found), 500 (server error)

## Pull Request Process

### Before Submitting

1. TypeScript compiles without errors
2. ESLint passes (if configured for the app)
3. Manual smoke test of affected features
4. Test on mobile viewport if UI was changed

### PR Requirements

- Clear, descriptive title (under 70 characters)
- Description explaining what changed and why
- Reference related issues if applicable
- Keep PRs focused — one feature or fix per PR

### Review Process

- At least one approval required before merge
- Reviewer checks code quality, correctness, and adherence to patterns
- Address review feedback with new commits (don't force-push during review)

## Commit Messages

Use descriptive commit messages that explain the "why":

```
feat(tunes): add drag-and-drop queue reordering

fix(explorers-earth): fix QR code not rendering on mobile Safari

refactor(tunes): extract email service into dedicated module

docs: add WebSocket protocol documentation
```

**Prefixes**: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`

**Scope** (optional): `tunes`, `explorers-earth`, or omit for cross-cutting changes

## Documentation

When your changes affect documented behavior:
- Update relevant docs in `docs/`
- Update CLAUDE.md files if key file paths or patterns change
- Add troubleshooting entries for new failure modes
