// Helpers for routing localtunes login through explorers (the auth hub that
// owns the single allowed Strapi OAuth callback).
export const TUNES_SSO_CALLBACK = 'https://localtunes.earth/google-auth/callback';
export const TUNES_SSO_RETURN_PATH = '/sso/tunes';
const SSO_REDIRECT_KEY = 'post_login_redirect';
const SSO_TTL_MS = 5 * 60 * 1000;

export function buildTunesCallbackUrl(jwt: string): string {
  // Hardcoded host (NOT a user param) so the Strapi JWT can only ever be
  // forwarded to tunes' own callback — never an attacker-controlled URL.
  return `${TUNES_SSO_CALLBACK}?access_token=${jwt}`;
}

// Exact allow-list: ONLY the known SSO return path is ever honored. Rejects
// other internal paths, protocol-relative ("//host"), and absolute URLs.
export function safeInternalRedirect(path: string | null | undefined): string | null {
  return path === TUNES_SSO_RETURN_PATH ? path : null;
}

export type TunesSsoAction = { kind: 'forward'; url: string } | { kind: 'login' };

export function decideTunesSso(jwt: string | null): TunesSsoAction {
  if (jwt) return { kind: 'forward', url: buildTunesCallbackUrl(jwt) };
  return { kind: 'login' };
}

// Wrapped so tests can mock it without redefining window.location (which
// modern jsdom makes hard to override).
export function hardRedirect(url: string): void {
  window.location.replace(url);
}

export function stashSsoReturn(now: number): void {
  sessionStorage.setItem(
    SSO_REDIRECT_KEY,
    JSON.stringify({ path: TUNES_SSO_RETURN_PATH, exp: now + SSO_TTL_MS }),
  );
}

// Consume-once: ALWAYS clears the key, then returns the path only if present,
// unexpired, and allow-listed. Prevents a stale stash from diverting a later
// unrelated login in the same tab.
export function consumeSsoReturn(now: number): string | null {
  const raw = sessionStorage.getItem(SSO_REDIRECT_KEY);
  sessionStorage.removeItem(SSO_REDIRECT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { path?: string; exp?: number };
    if (typeof parsed.exp !== 'number' || now > parsed.exp) return null;
    return safeInternalRedirect(parsed.path);
  } catch {
    return null;
  }
}
