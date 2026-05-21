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
