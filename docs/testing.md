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

#### Public-profile verification

Run these commands from `explorers-earth/` with Node `>=22.12` after `npm ci`. Install Chromium with `npx playwright install chromium` (CI uses `npx playwright install --with-deps chromium`).

| Tier | Command | Safety / expected duration | Artifacts |
|---|---|---|---|
| Deterministic fixture | `npm run verify:public-profile:env -- --mode=fixture --json` | Safe, no live credential; under a second | JSON only on stdout |
| Contract scripts | `npm run test:public-profile-contract` | Safe; under a second | Node test output |
| Live read-only | `npm run verify:public-api -- --username=<published-username> --json` | No mutation; usually seconds | Redacted JSON only |
| Protected mutation | `npm run verify:public-profile:env -- --mode=mutation --json` | Dedicated non-production account only | Any retained recovery path blocks further mutations |

The protected browser journey is documented in
[`explorers-earth/e2e/real-account/README.md`](../explorers-earth/e2e/real-account/README.md).
Run `npm run test:e2e:real-account:read-only` for the non-mutating guest route
audit. It requires the complete `E2E_PROFILE_ROUTE_FIXTURES` contract and runs
a query-only capability preflight before any page callback. Route IDs are
reconciled exactly against bootstrap visibility and the route contract;
profile-only, missing-detail, duplicate, extra, and stale fixtures fail with
`ROUTE_FIXTURE_COVERAGE_MISMATCH`. Run
`npm run test:e2e:real-account` only after the mutation doctor,
dedicated-account marker, backup/restore, and analytics-cleanup gates are all
ready, including browser-run cleanup and empty-remaining verification. The
run-wide cleanup/query operations are functionally proven with an isolated
preflight canary; `ANALYTICS_RUN_CLEANUP_UNAVAILABLE` blocks callbacks. The
mutation harness proves the captured real Profile/Appearance controls can
restore before it creates a backup or calls any mutation callback. A blocked
protected run is not a waived or skipped release check.

Use `npm run test:e2e -- --headed` for headed browser debugging and `PWDEBUG=1 npm run test:e2e` for Playwright step-through debugging. The normal policy is a clean browser console and no unexpected network failures; a named preflight failure is evidence of a release blocker, not a permitted empty-state fallback.

Stable verification codes include `ENV_MISSING`, `ACCOUNT_MARKER_MISMATCH`, `PUBLIC_READ_UNAUTHORIZED`, `LIVE_WRITE_NOT_APPROVED`, `RESTORE_FAILED`, and `ANALYTICS_CLEANUP_FAILED`. JSON results contain only `code`, `summary`, `safeContext`, `remediation`, and optionally `artifactPath`; they never contain credentials, storage state, or private API payloads.

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
| TypeScript (`tsc`) | Static type checking |
| Swagger UI | Manual API testing at `/api-docs` |

```bash
# Type check
cd tunes
npm run check

# Manual API testing
# Start dev server, then visit http://localhost:5000/api-docs
```

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

The Swagger UI at `/api-docs` provides an interactive API explorer for:
- Testing endpoints with real requests
- Viewing request/response schemas
- Trying different parameter combinations

### WebSocket Testing (tunes)

Test WebSocket events by:
1. Opening the app in two browser tabs (host + guest)
2. Performing actions in one tab
3. Verifying real-time updates appear in the other
4. Using browser DevTools Network tab → WS filter to inspect Socket.IO messages

### What Should Be Tested

**Before PRs**:
- Unit tests pass: `npm run test:unit`
- TypeScript compiles without errors: `npx tsc -b`
- ESLint passes without warnings: `npm run lint`
- Manual smoke test of affected features
- Cross-browser check for UI changes

**For API changes (tunes)**:
- Test endpoints via Swagger UI or curl
- Verify WebSocket events if playlist/player logic changed
- Check database state after operations

**For UI changes (both apps)**:
- Mobile and desktop viewport testing
- Browser DevTools for console errors
- Verify responsive layout

---

## Future Testing Improvements

- **Component tests**: React Testing Library for complex multi-step component interaction flows
- **E2E tests**: Playwright or Cypress for critical user flows (login, QR generation, list creation)
- **WebSocket tests**: Socket.IO client testing for real-time tunes event handling
- **Visual regression**: Screenshot testing for UI components
- **API tests (tunes)**: Supertest for Express route handlers with an isolated test database
