# tunes — Security

## Authentication Flows

### Registration

1. User submits username, password, email, venue name
2. Password is hashed with Node.js `scrypt` (crypto module)
3. Unique `guestUrl` is generated for the venue
4. Email verification token is created and sent via email
5. Account is created but `isEmailVerified` remains `false`
6. User can log in immediately but some features may require verification

### Login

1. User submits username + password
2. Passport.js local strategy validates credentials via `scrypt` comparison
3. On success, express-session creates a session stored in PostgreSQL
4. Session cookie is set with 7-day expiry
5. Client receives user data and stores auth state in Zustand

### Email Verification

1. During registration, a verification token is generated and stored in `emailVerificationToken`
2. Token has an expiry timestamp in `emailVerificationExpiry`
3. Verification email is sent via the email service (AWS SES or SMTP)
4. User clicks the verification link
5. Server validates token and expiry, sets `isEmailVerified = true`

### OTP (One-Time Password)

1. User requests OTP (e.g., for sensitive operations)
2. Server generates OTP, stores in `users.otp` with expiry in `users.otpExpiry`
3. OTP is sent via email
4. User submits OTP for verification
5. Server validates OTP and expiry, then clears the OTP fields

### Cross-App JWT Authentication (SSO from explorers-earth)

tunes supports a **dual auth system** — both session-based (native) and JWT-based (cross-app SSO).

The JWT flow (`server/jwt-auth-middleware.ts`):
1. explorers-earth authenticates user via Strapi CMS and obtains a JWT
2. explorers-earth calls tunes API with `Authorization: Bearer <jwt>` + `X-Username` header
3. `jwt-auth-middleware.ts` validates the JWT token
4. Server maps the Strapi user to a Neon DB user via `X-Username` lookup
5. Request proceeds as authenticated with the mapped user

**Middleware exports**:
- `requireAuth()` — Requires session auth (legacy)
- `requireAnyAuth()` — Accepts either session OR JWT auth

**Legacy routes** (`server/legacy-routes.ts`) support a multi-auth fallback chain: session → JWT → query params/body, ensuring backward compatibility during the auth migration.

### Logout

1. Client calls `POST /api/auth/logout`
2. Server destroys the session in PostgreSQL
3. Session cookie is cleared from the browser
4. Client clears auth state in Zustand store

## Session Management

### Configuration

- **Store**: PostgreSQL via `connect-pg-simple` (table: `session`)
- **Cookie settings**:
  - `maxAge`: 7 days (604,800,000 ms)
  - `httpOnly`: true (not accessible to JavaScript)
  - `secure`: true in production (HTTPS only)
  - `sameSite`: configured for cross-origin support
  - `path`: `/`
- **Session secret**: `SESSION_SECRET` environment variable

### Session Data Structure

```typescript
{
  cookie: {
    originalMaxAge: number,
    expires: Date,
    secure: boolean,
    httpOnly: boolean,
    path: string,
    sameSite: string
  },
  passport: {
    user: number  // User ID
  }
}
```

## API Token System

For programmatic API access, tunes supports API tokens (`api_tokens` table).

| Field | Purpose |
|-------|---------|
| `token` | Unique token string for authentication |
| `scopes` | Array of permission strings (e.g., `['read:playlists', 'write:songs']`) |
| `isAppWide` | Whether token has app-wide vs user-scoped access |
| `expiresAt` | Optional expiration timestamp |
| `isActive` | Can be revoked by setting to `false` |
| `lastUsedAt` | Tracks last usage for auditing |

## Rate Limiting

API endpoints are protected with rate limiting middleware to prevent abuse. Rate limits are applied per-IP and configured per-route group.

## CORS Configuration

- CORS is enabled with credential support for cross-origin requests
- Allowed origins are configured based on the deployment environment
- Credentials (cookies) are included in cross-origin requests via `credentials: 'include'` on the client

## Password Security

- Passwords are hashed using Node.js `scrypt` from the `crypto` module
- Scrypt parameters provide resistance against brute-force and GPU attacks
- Raw passwords are never stored or logged

## Protected Routes

### Server-side

The `requireAuth` middleware checks for valid session on protected API routes. Unauthenticated requests receive a 401 response.

Admin routes additionally check `user.isAdmin` for super admin access.

### Client-side

The auth store (`authStore.ts`) tracks authentication state. Protected pages redirect to the login page when no valid session exists.

## Guest Access Security

- Guest URLs are unique, randomly generated strings stored in `users.guestUrl`
- Guest URLs can be regenerated (invalidating the old one)
- Guests have read-only access scoped by the host's feature toggles
- Song requests from guests go through moderation
- Guest interactions are logged in `guest_interactions` table

## Key Files

| File | Purpose |
|------|---------|
| `server/auth.ts` | Passport.js setup, session config, login/register logic |
| `server/routes/authRoutes.ts` | Auth API endpoints |
| `server/storage.ts` | User lookup, password verification queries |
| `client/src/stores/authStore.ts` | Client-side auth state |
| `shared/schema.ts` | User table with auth fields |
