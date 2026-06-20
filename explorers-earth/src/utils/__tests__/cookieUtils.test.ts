import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setLocalTunesAuthCookies,
  getLocalTunesAuthCookies,
  clearLocalTunesAuthCookies,
  hasLocalTunesAuthCookies,
  validateLocalTunesAuthCookies,
  debugCookies
} from '../cookieUtils';

describe('cookieUtils', () => {
  // Mock document.cookie
  let cookieStore = '';
  
  beforeEach(() => {
    cookieStore = '';
    vi.spyOn(document, 'cookie', 'get').mockImplementation(() => cookieStore);
    vi.spyOn(document, 'cookie', 'set').mockImplementation((newCookie) => {
      // Very basic mock implementation of document.cookie assignment
      const newCookieStr = newCookie.split(';')[0];
      const newCookieName = newCookieStr.split('=')[0];
      
      if (newCookie.includes('expires=Thu, 01 Jan 1970')) {
        // Delete cookie
        cookieStore = cookieStore
          .split(';')
          .filter(c => c.trim().split('=')[0] !== newCookieName)
          .join(';');
      } else {
        // Set cookie
        const existing = cookieStore
          .split(';')
          .filter(c => c.trim() && c.trim().split('=')[0] !== newCookieName);
        existing.push(newCookieStr);
        cookieStore = existing.join(';');
      }
    });

    // Mock console.log and console.error to avoid cluttering test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── setLocalTunesAuthCookies / getLocalTunesAuthCookies ──────────────────
  describe('set and get LocalTunesAuthCookies', () => {
    it('sets and retrieves auth cookies correctly', () => {
      const authData = {
        auth_token: 'mock-token-123',
        auth_user: 'mock-user-456'
      };

      setLocalTunesAuthCookies(authData);

      const retrieved = getLocalTunesAuthCookies();
      expect(retrieved).toEqual(authData);
    });

    it('returns null if cookies are not set', () => {
      const retrieved = getLocalTunesAuthCookies();
      expect(retrieved).toBeNull();
    });

    it('returns null if only one cookie is set', () => {
      cookieStore = 'localtunes_auth_token=mock-token';
      const retrieved = getLocalTunesAuthCookies();
      expect(retrieved).toBeNull();
    });
  });

  // ── clearLocalTunesAuthCookies ───────────────────────────────────────────
  describe('clearLocalTunesAuthCookies', () => {
    it('clears the auth cookies', () => {
      const authData = {
        auth_token: 'mock-token-123',
        auth_user: 'mock-user-456'
      };

      setLocalTunesAuthCookies(authData);
      expect(getLocalTunesAuthCookies()).toBeTruthy();

      clearLocalTunesAuthCookies();
      expect(getLocalTunesAuthCookies()).toBeNull();
    });
  });

  // ── hasLocalTunesAuthCookies ─────────────────────────────────────────────
  describe('hasLocalTunesAuthCookies', () => {
    it('returns true when cookies exist', () => {
      setLocalTunesAuthCookies({ auth_token: 't', auth_user: 'u' });
      expect(hasLocalTunesAuthCookies()).toBe(true);
    });

    it('returns false when cookies do not exist', () => {
      expect(hasLocalTunesAuthCookies()).toBe(false);
    });
  });

  // ── debugCookies ─────────────────────────────────────────────────────────
  describe('debugCookies', () => {
    it('runs without throwing errors (no cookies)', () => {
      expect(() => debugCookies()).not.toThrow();
    });

    it('runs without throwing errors (with cookies)', () => {
      setLocalTunesAuthCookies({ auth_token: 'mock-token', auth_user: 'mock-user' });
      expect(() => debugCookies()).not.toThrow();
    });
  });

  // ── validateLocalTunesAuthCookies ────────────────────────────────────────
  describe('validateLocalTunesAuthCookies', () => {
    it('returns false if no cookies exist', async () => {
      const result = await validateLocalTunesAuthCookies();
      expect(result).toBe(false);
    });

    it('returns true if fetch succeeds', async () => {
      setLocalTunesAuthCookies({ auth_token: 'valid', auth_user: 'user' });
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      const result = await validateLocalTunesAuthCookies();
      expect(result).toBe(true);
      expect(getLocalTunesAuthCookies()).toBeTruthy(); // Cookies should not be cleared
    });

    it('returns false and clears cookies if fetch fails (response not ok)', async () => {
      setLocalTunesAuthCookies({ auth_token: 'invalid', auth_user: 'user' });
      global.fetch = vi.fn().mockResolvedValue({ ok: false });

      const result = await validateLocalTunesAuthCookies();
      expect(result).toBe(false);
      expect(getLocalTunesAuthCookies()).toBeNull(); // Cookies should be cleared
    });

    it('returns false and clears cookies if fetch throws an error', async () => {
      setLocalTunesAuthCookies({ auth_token: 'error', auth_user: 'user' });
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await validateLocalTunesAuthCookies();
      expect(result).toBe(false);
      expect(getLocalTunesAuthCookies()).toBeNull(); // Cookies should be cleared
    });
  });
});
