# explorers-earth — Location Sharing Platform

[![CI Pipeline](https://github.com/explorers-earth/explorers-earth/actions/workflows/ci.yml/badge.svg)](https://github.com/explorers-earth/explorers-earth/actions/workflows/ci.yml)
[![Deploy](https://github.com/explorers-earth/explorers-earth/actions/workflows/deploy.yml/badge.svg)](https://github.com/explorers-earth/explorers-earth/actions/workflows/deploy.yml)
![Coverage](https://img.shields.io/badge/coverage-unit%20%2B%20integration-blue)

explorers-earth is a React-based web application that enables users to create personalized QR codes and shareable links for their favorite places and recommendations. Users can build curated lists of locations, organize them by cities or themes, and share them with others through QR codes and social media integration.

## Tech Stack

- **Frontend**: React 18 + TypeScript, Vite 6.4, Tailwind CSS, Framer Motion
- **Data**: Apollo Client (GraphQL), React Query, Zustand
- **UI**: Radix UI, React Router DOM, qrcode.react
- **Maps**: Google Maps API (Places, Geocoding, Maps)
- **Backend**: External Strapi CMS (GraphQL)

## Quick Start

```bash
# From explorers-earth/, use the lockfile workflow (Node >=22.12)
node --version
npm ci

# Set up environment variables
cp .env.example .env
# Edit .env with your values (see docs/environment-variables.md)

# Start development server
npm run dev
# App available at http://localhost:5173
```

Install the browser used by the deterministic Playwright suite once:

```bash
npx playwright install chromium
```

Public-profile verification has three safety tiers. `npm run verify:public-profile:env -- --mode=fixture --json` is deterministic and needs no live credentials. `npm run verify:public-api -- --username=<published-username> --json` is live read-only and reports a named failure when the public capability is absent or over-broad. Mutation checks are protected non-production work only and require the documented account marker and explicit opt-in. See [environment variables](../docs/environment-variables.md) and [testing](../docs/testing.md).

### Public-profile golden paths

Run from this `explorers-earth/` directory with Node `>=22.12` after `npm ci`
and `npx playwright install chromium`:

```bash
# Safe and deterministic: static analysis, unit/contract tests, fixture E2E, build
npm run verify:public-profile

# Inspect either command without executing child commands
npm run verify:public-profile -- --dry-run --json
npm run verify:public-profile:release -- --username=<published-username> --dry-run --json
```

The deterministic command is non-mutating and is expected to take about 15–25
minutes on a warm contributor machine. Add `--headed` to observe its Chrome
journeys. Reports are written below `playwright-report/deterministic/` and
`test-results/playwright/deterministic/`; the orchestration summary is
`test-results/public-profile-verification/verification-summary.json`.

`npm run verify:public-profile:release -- --username=<published-username>` is a
separate protected gate. It first proves live read capability, then the exact
dedicated-account marker, explicit mutation approval, restoration path, and
analytics cleanup contract before the serialized real-account journey can run.
Missing prerequisites fail with a stable code such as `ENV_MISSING` or
`PUBLIC_READ_UNAUTHORIZED`; they are never treated as a passing skip. Read the
[environment contract](../docs/environment-variables.md), [testing guide](../docs/testing.md),
and [recovery procedure](e2e/real-account/README.md) before requesting approval.

## Key Features

- User authentication with Google OAuth
- Location recommendations with photos, ratings, and notes
- QR code generation and social sharing
- Interactive Google Maps integration
- Curated lists organized by city or theme
- Public shareable profiles
- Image management with cropping and compression
- Internationalization (i18n)

## Documentation

Full documentation is in the [`docs/`](../docs/) folder:

- [Architecture](../docs/architecture.md) — How the codebase is structured
- [Getting Started](../docs/getting-started.md) — Setup and installation
- [Environment Variables](../docs/environment-variables.md) — All env vars
- [Overview](../docs/explorers-earth/overview.md) — Features and architecture
- [Integrations](../docs/explorers-earth/integrations.md) — Google Maps, Strapi, OAuth
- [State Management](../docs/explorers-earth/state-management.md) — Zustand, Apollo, React Query
- [Deployment](../docs/explorers-earth/deployment.md) — Netlify config
- [Contributing](../docs/contributing.md) — Code style, PR process

For AI agents, see [`CLAUDE.md`](CLAUDE.md).
