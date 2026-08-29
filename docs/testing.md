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
npm run music:fixture:public:verify  # fixture/harness contract verification
```

`music:test:public-fast`, `music:test:public-pr`, and `music:fixture:public:verify` never write. The live command first validates one exact ordered, non-secret argv and rejects missing, wrong, duplicate, reordered, or extra arguments. It also rejects ambient Music E2E, database, production, Docker, URL, token, or identity authority before generating a run ID or token, allocating artifacts, attesting, or attempting fixture lifecycle. There is no ambient compatibility path.

After the separately reviewed reset, zero-resource, free-port, and retired-authority prechecks, the exact live command is:

```powershell
npm run music:test:public-e2e -- --ack I_UNDERSTAND_THIS_MUTATES_A_DISPOSABLE_FIXTURE --fixture-version music-public-e2e-fixture/v1 --confirm-project explorers-music-fixture --confirm-namespace-reset RESET_EXPLORERS_MUSIC_FIXTURE_NAMESPACE
```

The runner derives a fresh `e2e-public-music-<run>` namespace, distinct owner/account/user document identifiers, and an ephemeral random local Strapi fixture token internally. It fixes PostgreSQL, Strapi, Tunes, Explorer, and the snapshot service to loopback ports `55432`, `51337`, `55000`, `55173`, and `55174`, respectively, including their reviewed health URLs. The token is never accepted on argv, printed, or retained in public evidence; exact fixture `down` retires it on every lifecycle-attempted failure path. The callback still mints the distinct private owner Tunes JWT only after snapshot and collection preflight, writes its protected auth path immediately before browser execution, and removes it during final restoration/teardown.

The live command runs the fixed repository fixture-authority attestation and starts the owned five-service `explorers-music-fixture` only after that gate accepts.

When retained fixture volumes require reset, the reviewed order is exact and must not be shortened: reset, prove zero exact-label volumes, prove the five fixture ports are free, attest retired fixture authority, then invoke the live runner (which repeats and manifests the attestation immediately before bootstrap). `music:db:reset` is a dedicated volume-only lane: it requires zero exact-project containers and never weakens or substitutes for generic `music:down` resource validation.

```powershell
npm run music:db:reset -- --mode fixture --target test --confirm-project explorers-music-fixture --confirm-reset "RESET explorers-music-fixture/music_fixture"
docker volume ls -q --filter "label=com.explorers.music.fixture=true" --filter "label=com.explorers.music.project=explorers-music-fixture" # require zero lines
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 55432,51337,55000,55173,55174 } # require zero rows
npm run --silent music:fixture:authority:attest # require exit 0 and one strict absent/tombstone JSON record
```

The accepted record has exactly `schemaVersion`, `state`, `safeToBootstrap`, and `usableRecords`: version `music-fixture-authority-attestation/v1`, state `absent` or `tombstone`, boolean `true`, and count `0`. A reference, raw/nonempty, malformed, unsupported, unreadable, symlinked, ambiguous, or credential-bearing state refuses.

Before any reset mutation, two equal read-only snapshots must prove zero Compose-project containers and a dual-label volume inventory containing the mandatory exact `explorers-music-fixture_music-fixture-postgres` plus only the optional exact `explorers-music-fixture_music-fixture-gates`. Each present volume must have one unambiguous inspection with its exact name, creation identity, mountpoint, fixture/project labels, Compose project, and Compose logical-volume label. Extra, missing-postgres, unlabeled, mismatched, malformed, duplicate, or changing targets refuse with byte-identical fixture authority and no delete command. After that authorization boundary, reset retires only authenticated fixture authority, rechecks the exact volume fingerprints, issues one allowlisted `docker volume rm` argv, proves both exact names absent and the dual-label enumeration empty, and repeats the retired-authority oracle before success. A deletion attempt that fails remains non-success and leaves authority retired for containment. Already-safe missing and tombstoned authority inputs are supported. A failed live-runner attestation occurs before the lifecycle-attempt flag and bootstrap; with the preceding volume/port proofs, no fixture `down` is required or attempted.

The runner captures the complete disposable PostgreSQL database plus a bounded private data-only dump and the original Strapi `public_music` value before each mutation journey. Database restoration is one `psql --single-transaction` operation against the attested immutable container ID. Before truncation and after replay it verifies the frozen public-table inventory, checked-in migration IDs and checksums, and exact trigger fingerprints; every SQL identifier comes from those reviewed constants. A failed replay is classified as rolled back only when a second dump proves the pre-attempt mutated hash is unchanged. A successful replay is accepted only when the committed hash equals the stored snapshot.

The state service atomically persists a fixed-code mutation guard as a direct, unlinked child of the exclusive run directory. Every worker checks that shared guard before entering a live mutation, a fresh worker refuses after another journey's restore failure, and the live Playwright child also uses `--max-failures=1 --retries=0`. Per-journey restore uses the worker token; the separately authorized final restore uses a distinct orchestration token and the original snapshot so cleanup can still recover after the mutation guard blocks. The private recovery record is deleted during teardown, while the strict guard record is embedded in `evidence.json` and retained as `mutation-guard.json`. Every started mutation writes one fixed-code terminal record for pass, body failure, restore failure, or mismatch; sanitized reconciliation represents skipped and unstarted journeys without inventing a pass. The runner never accepts a production or non-loopback origin.

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
