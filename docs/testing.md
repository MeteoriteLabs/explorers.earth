# Testing

## Current Testing Setup

### explorers-earth

| Tool | Purpose |
|------|---------|
| TypeScript (`tsc -b`) | Static type checking |
| ESLint | Code quality and style enforcement |
| Integration test script | `npm run test:local-tunes` — tests local tunes API integration |

```bash
# Type check
cd explorers-earth
npx tsc -b

# Lint
npm run lint

# Test tunes integration
npm run test:local-tunes
```

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

## Testing Strategy

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
- TypeScript compiles without errors
- ESLint passes without warnings
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

## Future Testing Improvements

Areas where test coverage could be added:

- **Unit tests**: Jest/Vitest for utility functions, store logic, and service methods
- **API tests**: Supertest for Express route handlers with test database
- **Component tests**: React Testing Library for component behavior
- **E2E tests**: Playwright or Cypress for critical user flows
- **WebSocket tests**: Socket.IO client testing for real-time event handling
