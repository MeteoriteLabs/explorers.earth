// Vitest global setup — runs before any test file imports app code.
// Sets env BEFORE any module that reads it at import time (db.ts creates its
// pool on import). Pure-unit tests (sanitize-user) don't import the app, so the
// placeholder DATABASE_URL is only consumed by the integration tests, which
// require a reachable Postgres (set DATABASE_URL_TEST in your env to override).
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'test-cookie-secret';
// The integration suite CREATES + DELETES a user. NEVER inherit an ambient
// DATABASE_URL (it could point at dev/prod): use DATABASE_URL_TEST if provided,
// otherwise a local throwaway. Any inherited DATABASE_URL is deliberately ignored.
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ||
  'postgresql://tunes:tunes@127.0.0.1:5433/tunes_e2e';
