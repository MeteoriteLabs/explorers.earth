# Testing

## Current Testing Setup

### explorers-earth

| Tool | Purpose |
|------|---------|
| Vitest 4.x | Unit test runner |
| @testing-library/react | Component testing |
| @testing-library/jest-dom | DOM assertion matchers |
| jsdom | Browser environment simulation |
| @vitest/coverage-v8 | Code coverage via V8 |
| TypeScript (`tsc -b`) | Static type checking |
| ESLint | Code quality and style enforcement |

#### Running Tests

```bash
# Run all unit tests once
npm test
# or
npm run test:unit

# Watch mode (re-runs on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Open interactive Vitest UI
npm run test:ui

# Type check only
npx tsc -b

# Lint only
npm run lint

# Integration test: tunes API
npm run test:local-tunes
```

#### Test File Structure

Test files live in `__tests__/` subdirectories within each module:

```
src/
├── features/
│   ├── Analytics/__tests__/          # Country mapping, analytics service tests
│   ├── Books/__tests__/              # Book helpers, list logic
│   ├── Movies/__tests__/
│   ├── Games/__tests__/
│   ├── Profile/__tests__/            # Geocoding hooks
│   └── Settings/__tests__/
├── hooks/__tests__/                  # useDeviceDetection, etc.
├── routes/__tests__/                 # DashboardRouteValidator
├── services/__tests__/               # paymentService, analyticsService
├── store/__tests__/                  # Zustand store tests
├── utils/__tests__/                  # uploadPathGenerator, etc.
└── test/
    └── setup.ts                      # Global test setup (jest-dom matchers, mocks)
```

#### Test Setup

Global test setup is in `src/test/setup.ts`. Vitest is configured in `vite.config.ts` under the `test` key (environment: `jsdom`, globals: `true`, setupFiles pointing to `src/test/setup.ts`).

### tunes

| Tool | Purpose |
|------|---------|
| Vitest and Supertest | Unit, route, API, security, and executable contract tests |
| Playwright | Browser smoke, end-to-end, and accessibility coverage |
| PostgreSQL 15 and Docker Compose | Disposable migration and real-repository integration coverage |
| TypeScript (`tsc`) | Scoped type gate and normalized legacy baseline |

```bash
# From the repository root: focused local feedback
npm run music:test:fast -- --mode fixture

# Required PR lane: contracts, security, real database, and browser smoke
npm run music:test:pr -- --mode fixture

# Scheduled full-stack, accessibility, load, and chaos lane
npm run music:test:nightly -- --mode fixture
```

The [Music identity testing guide](testing/music-identity-testing.md) is the canonical clean-checkout, lane, release-evidence, and recovery contract. `music:test:all` is the complete Tunes Vitest suite only; it does not replace the Explorer, real PostgreSQL, browser, load/chaos, or release lanes.

---

## Testing Strategy

### Unit Tests (explorers-earth)

Vitest runs in jsdom environment, simulating a browser. Tests cover:
- **Service layer** — API calls mocked, business logic verified
- **Store logic** — Zustand state transitions
- **Utility functions** — Pure function correctness
- **Custom hooks** — React hooks via `@testing-library/react`
- **Route validation** — Route guard and redirect behaviour

### Type Safety (Both Apps)

TypeScript strict mode catches many classes of bugs at compile time:
- Null/undefined access
- Incorrect function arguments
- Missing properties
- Type mismatches

Run `npm run check` (tunes) or `npx tsc -b` (explorers-earth) before committing.

### API Testing (tunes)

Vitest/Supertest route and OpenAPI contracts exercise supported request and response shapes, stable error codes, authorization policy coverage, and database-backed behavior. The PR lane runs those contracts together with disposable PostgreSQL integration tests. `/api-docs` remains a read-only discovery aid, not test evidence.

### WebSocket Testing (tunes)

Socket.IO contract and security suites verify connection authorization, room ownership, event behavior, and error handling. Browser lanes exercise the host/guest journey; nightly adds full-stack, interruption, load, and chaos coverage.

### What Should Be Tested

**Before PRs**:
- Unit tests pass: `npm run test:unit`
- TypeScript compiles without errors: `npx tsc -b`
- ESLint passes without warnings: `npm run lint`
- Tunes changes pass `npm run music:test:fast -- --mode fixture`
- Identity, API, database, security, or browser changes pass `npm run music:test:pr -- --mode fixture`

**For API changes (tunes)**:
- Add or update executable route/OpenAPI/error-code contracts
- Add Socket.IO contract coverage when playlist/player behavior changes
- Exercise repository behavior against the disposable PostgreSQL target

**For UI changes (both apps)**:
- Mobile and desktop viewport testing
- Browser DevTools for console errors
- Verify responsive layout

---

## Additional Testing Opportunities

- **Component tests**: React Testing Library for complex multi-step component interaction flows
- **Browser breadth**: extend Playwright journeys beyond the release-critical Music paths
- **Visual regression**: reviewed screenshot baselines for stable UI components
- **Property and fuzz tests**: expand hostile-input coverage for parsers and protocol boundaries
