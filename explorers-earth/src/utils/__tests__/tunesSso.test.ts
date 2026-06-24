import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildTunesCallbackUrl,
  safeInternalRedirect,
  decideTunesSso,
  stashSsoReturn,
  consumeSsoReturn,
  TUNES_SSO_CALLBACK,
  TUNES_SSO_RETURN_PATH,
} from '../tunesSso';

describe('buildTunesCallbackUrl', () => {
  it('targets the hardcoded tunes callback with the JWT as access_token', () => {
    expect(buildTunesCallbackUrl('jwt.abc')).toBe(
      'https://localtunes.earth/google-auth/callback?access_token=jwt.abc',
    );
    expect(TUNES_SSO_CALLBACK).toBe('https://localtunes.earth/google-auth/callback');
  });
});

describe('safeInternalRedirect (exact allow-list)', () => {
  it('allows ONLY the known SSO return path', () => {
    expect(safeInternalRedirect(TUNES_SSO_RETURN_PATH)).toBe('/sso/tunes');
  });
  it('rejects every other value (other internal paths, protocol-relative, absolute, junk)', () => {
    for (const bad of ['/home', '/sso/tunes/x', '//evil.com', 'https://evil.com', '', null, 'home']) {
      expect(safeInternalRedirect(bad)).toBeNull();
    }
  });
});

describe('decideTunesSso', () => {
  it('forwards to tunes when a JWT is present', () => {
    expect(decideTunesSso('jwt.abc')).toEqual({
      kind: 'forward',
      url: 'https://localtunes.earth/google-auth/callback?access_token=jwt.abc',
    });
  });
  it('routes through login when no JWT', () => {
    expect(decideTunesSso(null)).toEqual({ kind: 'login' });
    expect(decideTunesSso('')).toEqual({ kind: 'login' });
  });
});

describe('stashSsoReturn / consumeSsoReturn (consume-once + TTL)', () => {
  beforeEach(() => sessionStorage.clear());
  const NOW = 1_000_000;

  it('round-trips the return path within TTL', () => {
    stashSsoReturn(NOW);
    expect(consumeSsoReturn(NOW + 1000)).toBe('/sso/tunes');
  });
  it('consumes once — a second read returns null (no stale diversion)', () => {
    stashSsoReturn(NOW);
    consumeSsoReturn(NOW + 1000);
    expect(consumeSsoReturn(NOW + 2000)).toBeNull();
  });
  it('returns null when expired (and still clears the key)', () => {
    stashSsoReturn(NOW);
    expect(consumeSsoReturn(NOW + 6 * 60 * 1000)).toBeNull();
    expect(sessionStorage.getItem('post_login_redirect')).toBeNull();
  });
  it('returns null when nothing was stashed', () => {
    expect(consumeSsoReturn(NOW)).toBeNull();
  });
});
