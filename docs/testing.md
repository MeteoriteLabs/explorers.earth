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

### Public Music browser lanes

The public browser harness is intentionally split by authority. These commands are run from the repository root:

```bash
npm run music:test:public-fast       # deterministic mocked Chromium feedback
npm run music:test:public-pr         # PR-safe read-only analytics/Music coverage
npm run music:test:public-e2e        # authorized live-write lane; hard-gated and exactly restored
npm run music:fixture:public:verify  # fixture/harness contract verification
```

`music:test:public-fast`, `music:test:public-pr`, and `music:fixture:public:verify` never write. The live command starts the owned five-service `explorers-music-fixture`, plus its loopback PostgreSQL/Strapi snapshot helper, and refuses before Playwright unless every value below is supplied. Origins and health URLs must all be loopback; the username/document ID must share the same `e2e-public-music-<run>` namespace. Use a dedicated local Strapi test token that can GET and PUT only that Account's `public_music` field.

```powershell
$env:MUSIC_E2E_LIVE_WRITE='true'
$env:MUSIC_E2E_LIVE_WRITE_CONFIRMATION='I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE'
$env:MUSIC_E2E_FIXTURE_VERSION='music-public-e2e-fixture/v1'
$env:MUSIC_E2E_ACCOUNT_USERNAME='e2e-public-music-local-owner'
$env:MUSIC_E2E_ACCOUNT_DOCUMENT_ID='e2e-public-music-local-account'
$env:MUSIC_E2E_OWNER_CREDENTIAL='Bearer <disposable-owner-token>'
$env:MUSIC_E2E_STRAPI_URL='http://127.0.0.1:1337'
$env:MUSIC_E2E_STRAPI_TOKEN='<account-scoped-local-test-token>'
$env:MUSIC_E2E_NAMESPACE_RESET_CONFIRMATION='RESET_EXPLORERS_MUSIC_FIXTURE_NAMESPACE'
$env:MUSIC_E2E_SERVICE_ORIGINS='tcp://127.0.0.1:55432,http://127.0.0.1:51337,http://127.0.0.1:55000,http://localhost:55173,http://127.0.0.1:55174'
$env:MUSIC_E2E_HEALTH_URLS='tcp://127.0.0.1:55432,http://127.0.0.1:51337/health,http://127.0.0.1:55000/api/music-fixture/readiness,http://localhost:55173/health,http://127.0.0.1:55174/health'
npm run music:test:public-e2e
```

The runner captures the complete disposable PostgreSQL database plus the original Strapi `public_music` value before each mutation journey, restores both in `finally`, re-reads them, and stops all later live tests on any hash mismatch. It never accepts a production or non-loopback origin.

Every command prints `music-public-e2e-fixture/v1`, service URLs, lane, result,
cleanup result, and a sanitized evidence path. PR-safe tests cannot acquire
write authority. Live-write tests require a loopback fixture, a namespaced
`e2e-public-music-<run>-owner` account, and the exact runtime confirmation;
they snapshot first and restore in `finally`. Capabilities and credentials are
never written to evidence. A restoration mismatch is a failed lane and blocks
subsequent live tests.

CI installs the browsers named by the configuration and runs
`chromium-pr-safe` plus the selected Firefox/WebKit visual projects. The
`chromium-music-fixture` and `chromium-music-live` projects are opt-in lanes;
tests report explicit runtime skip reasons when their authority is absent.

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
