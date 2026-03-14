# Environment Variables

All environment variables for both applications. Each app has its own `.env` file in its respective directory.

## explorers-earth (`explorers-earth/.env`)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_URL` | Yes | GraphQL API endpoint (Strapi CMS) | `https://api.explorers.earth/graphql` |
| `VITE_REST_API_URL` | Yes | REST API endpoint (Strapi uploads) | `https://api.explorers.earth` |
| `VITE_GOOGLE_MAPS_API_KEY` | Yes | Google Maps JavaScript API key | `AIza...` |
| `VITE_GOOGLE_CUSTOM_SEARCH_API_KEY` | No | Google Custom Search API key (image search) | `AIza...` |
| `VITE_GOOGLE_CUSTOM_SEARCH_ENGINE_ID` | No | Custom Search Engine ID | `abc123...` |
| `VITE_PUBLIC_ACCESS_TOKEN` | No | Public access token for Strapi | `token...` |
| `VITE_PUBLIC_SHAREABLE_LINK` | No | Base URL for shareable profile links | `https://explorers.earth` |
| `VITE_LOCAL_TUNES_API_URL` | No | tunes API URL for cross-app integration | `https://localtunes.earth` |
| `VITE_LOCAL_TUNES_ENABLED` | No | Enable tunes integration | `true` |
| `VITE_LOCAL_TUNES_TIMEOUT` | No | Tunes API timeout in ms | `10000` |
| `VITE_LOCAL_TUNES_RETRY_ATTEMPTS` | No | Retry attempts for tunes API | `3` |

> Note: All explorers-earth env vars are prefixed with `VITE_` because Vite exposes these to the client bundle. Do not put secrets here.

## tunes (`tunes/.env`)

### Core

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/tunes` |
| `SESSION_SECRET` | Yes | Express session encryption secret | `a-long-random-string` |
| `COOKIE_SECRET` | No | Cookie signing secret | `another-random-string` |
| `NODE_ENV` | No | Environment mode | `development` / `production` |
| `PORT` | No | Server port (code defaults to 5000 if unset; .env.example sets 3000) | `5000` |
| `ALLOWED_ORIGINS` | No | CORS allowed origins (comma-separated) | `http://localhost:5173,https://explorers.earth` |
| `DEBUG` | No | Enable debug logging | `false` |
| `RATE_LIMIT` | No | Requests per minute rate limit | `60` |

### YouTube

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `YOUTUBE_API_KEY` | Yes | YouTube Data API v3 key | `AIza...` |

### Email (for verification)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `EMAIL_HOST` | No* | SMTP server hostname | `smtp.gmail.com` |
| `EMAIL_PORT` | No* | SMTP port | `587` |
| `EMAIL_USER` | No* | SMTP username | `noreply@example.com` |
| `EMAIL_PASS` | No* | SMTP password | `app-password` |
| `EMAIL_FROM` | No* | Sender email address | `no-reply@yourdomain.com` |

> *Required if email verification is enabled

### AWS SES (production email)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | No | AWS access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | No | AWS secret key | `secret...` |
| `AWS_REGION` | No | AWS region for SES | `us-east-1` |

### Spotify

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `SPOTIFY_CLIENT_ID` | No | Spotify app client ID (playlist import) | `abc123...` |
| `SPOTIFY_CLIENT_SECRET` | No | Spotify app client secret | `secret...` |

### Strapi CMS (Cross-App SSO)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `STRAPI_URL` | No | Strapi CMS URL (server-side) | `http://localhost:1337` |
| `STRAPI_ACCESS_TOKEN` | No | Strapi API token (server-side) | `token...` |
| `VITE_API_URL` | No | Strapi GraphQL endpoint (client-side, for embedded auth) | `http://localhost:1337/graphql` |
| `VITE_REST_API_URL` | No | Strapi REST endpoint (client-side) | `http://localhost:1337` |
| `VITE_PUBLIC_ACCESS_TOKEN` | No | Public access token for unauthenticated requests | `token...` |

### AI

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `GEMINI_API_KEY` | No | Google Gemini API key | `AIza...` |

### Analytics

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `CLARITY_PROJECT_ID` | No | Microsoft Clarity project ID | `abc123` |

### Payments

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `RAZORPAY_KEY_ID` | No | Razorpay API key | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | No | Razorpay secret | `secret...` |

## Security Notes

- Never commit `.env` files to version control
- Use `.env.example` files as templates (without real values)
- In production, use environment variable management from your hosting provider
- `VITE_` prefixed variables in explorers-earth are exposed to the browser — never put secrets in them
- Server-side variables in tunes are secure and not exposed to the client
