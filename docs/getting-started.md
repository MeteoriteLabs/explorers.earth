# Getting Started

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
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

Create `tunes/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/tunes
SESSION_SECRET=your-session-secret
YOUTUBE_API_KEY=your-youtube-api-key
```

## Database Setup (tunes only)

1. Ensure PostgreSQL is running and you have a database created
2. Set `DATABASE_URL` in `tunes/.env`
3. Push the schema:

```bash
npm run db:push
```

This uses Drizzle Kit to synchronize the schema from `tunes/shared/schema.ts` to your database.

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

## What's Next

- [Architecture](architecture.md) — Understand the codebase structure
- [Contributing](contributing.md) — Code style and PR process
- [Troubleshooting](troubleshooting.md) — Common issues and fixes
