# tunes — Collaborative Playlist Management Platform

tunes is a songs recommendation platform that transforms music sharing across diverse social and venue settings, creating immersive and interactive music experiences. The platform features responsive design, persistent user sessions, advanced music control capabilities with YouTube integration, and comprehensive administrative tools.
 
## Tech Stack

- **Frontend**: React 18 + TypeScript, TanStack Query v5, shadcn/ui, Socket.IO, Tailwind CSS
- **Backend**: Express.js + TypeScript, Socket.IO, Passport.js 
- **Database**: PostgreSQL + Drizzle ORM
- **Integrations**: YouTube Data API, Spotify, Razorpay, AWS SES, Google Gemini
 
 ## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values (see docs/environment-variables.md)

# Initialize database
npm run db:push

# Start development server
npm run dev
# App available at http://localhost:5000
# API docs at http://localhost:5000/api-docs
```

## Key Features

- Real-time playlist management with WebSocket sync
- YouTube-powered song search and playback
- Drag-and-drop queue reordering
- Guest song request system with moderation
- Customizable venue profiles and branding
- Admin dashboard with analytics
- Email verification and OTP authentication
- Spotify playlist import
- Multiple playlist support

## Documentation

Full documentation is in the [`docs/`](../docs/) folder:

- [Architecture](../docs/architecture.md) — How the codebase is structured
- [Getting Started](../docs/getting-started.md) — Setup and installation
- [Environment Variables](../docs/environment-variables.md) — All env vars
- [Database](../docs/tunes/database.md) — Schema, migrations, Drizzle patterns
- [WebSocket Protocol](../docs/tunes/websockets.md) — Socket.IO events
- [Security](../docs/tunes/security.md) — Auth flows, sessions, API tokens
- [Integrations](../docs/tunes/integrations.md) — YouTube, Spotify, Razorpay, etc.
- [State Management](../docs/tunes/state-management.md) — TanStack Query, Zustand, Socket.IO
- [Deployment](../docs/tunes/deployment.md) — Docker, AWS, CI/CD
- [Contributing](../docs/contributing.md) — Code style, PR process

For AI agents, see [`CLAUDE.md`](CLAUDE.md).

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.
