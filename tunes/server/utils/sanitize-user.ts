/**
 * User-object sanitizers. The `users` table carries secrets (password, otp,
 * otpExpiry, emailVerificationToken, emailVerificationExpiry) and every
 * getUser* query is a SELECT *, so a raw row must NEVER reach a client.
 *
 * Two projections, both WHITELISTS (not blacklists) so a newly-added column
 * can never silently leak:
 *   - sanitizeUser  → self/admin responses (login, /check, /api/user, admin)
 *   - publicUser    → public/unauthenticated endpoints (the guest playlist/QR page)
 *
 * Fields consumed by explorers SSO (ssoService/localTunesService/useTunesDashboard):
 *   guestUrl, username, email, venueName, allow* — all covered by sanitizeUser.
 */

// Self/admin-facing fields: what the tunes dashboard, admin UI, and SSO callers read.
const SELF_FIELDS = [
  'id', 'username', 'email', 'isEmailVerified', 'guestUrl', 'venueName', 'theme',
  'allowSongRequests', 'allowGuestPlayOnDevice', 'allowPlaylistSharing',
  'allowRecentlyPlayedVisibility', 'isAdmin', 'accountManagerId', 'createdAt', 'updatedAt',
] as const;

// Public guest/QR page: no email, isAdmin, accountManagerId, or timestamps.
const PUBLIC_FIELDS = [
  'id', 'username', 'guestUrl', 'venueName', 'theme',
  'allowSongRequests', 'allowGuestPlayOnDevice', 'allowPlaylistSharing',
  'allowRecentlyPlayedVisibility',
] as const;

function pick<T extends Record<string, any>>(
  user: T | null | undefined,
  keys: readonly string[],
): Record<string, any> | undefined {
  if (!user) return undefined;
  const out: Record<string, any> = {};
  for (const key of keys) {
    if (key in user) out[key] = (user as Record<string, any>)[key];
  }
  return out;
}

/** Whitelist for self/admin responses. Drops all secret columns. */
export function sanitizeUser(user: Record<string, any> | null | undefined) {
  return pick(user, SELF_FIELDS);
}

/** Tighter whitelist for public/unauthenticated endpoints (guest playlist page). */
export function publicUser(user: Record<string, any> | null | undefined) {
  return pick(user, PUBLIC_FIELDS);
}

/** Map sanitizeUser over a list (admin user lists). Preserves array order. */
export function sanitizeUsers(users: Array<Record<string, any>> | null | undefined) {
  return (users ?? []).map((u) => sanitizeUser(u));
}
