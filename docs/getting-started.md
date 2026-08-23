# Getting Started

## Prerequisites

- **Node.js 22.12+** — [Download](https://nodejs.org/)
- **PostgreSQL 15+** — Required for tunes only. [Download](https://www.postgresql.org/download/)
- **YouTube Data API key** — Required for tunes song search. [Get API Key](https://console.cloud.google.com/)
- **Google Maps API key** — Required for explorers-earth. [Get API Key](https://console.cloud.google.com/)
- **Strapi CMS** — explorers-earth requires an external Strapi instance for its backend

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd explorers.earth-main

# Install dependencies for both apps
npm run install:all
```

This runs `npm install` in both `tunes/` and `explorers-earth/` directories.

## Environment Setup

Both apps require `.env` files. See [Environment Variables](environment-variables.md) for the complete reference.

### explorers-earth

Create `explorers-earth/.env`:

```env
VITE_API_URL=your_graphql_api_endpoint
VITE_REST_API_URL=your_rest_api_endpoint
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### tunes

Create `tunes/.env` for non-database service values. The fixture database authority is generated separately and must not be copied into this file:

```env
SESSION_SECRET=your-session-secret
YOUTUBE_API_KEY=your-youtube-api-key
```

## Database Setup (tunes only)

For the supported isolated local Music environment:

1. Ensure Docker Compose v2 is available
2. Do not set or export `DATABASE_URL`; the fixture commands create a guarded `DATABASE_URL_TEST` authority
3. From the repository root, create, start, migrate, and verify the disposable fixture database:

```bash
npm run music:bootstrap -- --mode fixture
npm run music:up -- --mode fixture --detach --wait
npm run music:db:migrate -- --mode fixture
npm run music:db:verify -- --mode fixture
```

These commands accept only the isolated `music_migrator@127.0.0.1:55432/music_fixture` target. Application startup does not synchronize schemas, and production changes must use the reviewed immutable migration/deployment process in the [Music deployment runbook](operations/music-deploy-runbook.md).

## Running the Applications

### Both apps simultaneously

```bash
npm run dev
```

This uses `concurrently` to start both dev servers:
- **tunes**: `http://localhost:5000` (frontend + API + WebSocket)
- **explorers-earth**: `http://localhost:5173`

### Individual apps

```bash
# tunes only
npm run dev:tunes

# explorers-earth only
npm run dev:explorers-earth
```

### Building for production

```bash
# Build both
npm run build:all

# Build individually
cd tunes && npm run build
cd explorers-earth && npm run build
```

## Verifying It Works

### explorers-earth
- Open `http://localhost:5173`
- You should see the landing page
- Login/register functionality requires a running Strapi CMS backend

### tunes
- Open `http://localhost:5000`
- You should see the login/register page
- Register a new venue account
- After login, the dashboard should load with an empty playlist queue
- API docs are available at `http://localhost:5000/api-docs` (Swagger UI)

## Agentic Environments (Superpower Skills)

If you are developing this project using an AI agent (such as Claude Code, Cursor, or Gemini CLI) and the personal skills library is configured at `D:\superpowers\skills\`, you **must** use the superpower skills to guide your workflow.

Refer to the superpowers skills library to enforce best practices for:
- **Planning**: Use `writing-plans` and `executing-plans` to create and track implementation progress.
- **TDD (Test-Driven Development)**: Follow `test-driven-development` strictly to write tests before implementation.
- **Verification**: Use `verification-before-completion` to run checks and gather evidence before declaring a task complete.
- **Debugging**: Use `systematic-debugging` to trace and isolate root causes of issues.

## What's Next

- [Architecture](architecture.md) — Understand the codebase structure
- [Contributing](contributing.md) — Code style and PR process
- [Troubleshooting](troubleshooting.md) — Common issues and fixes
