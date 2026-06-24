import { describe, it, expect } from 'vitest';
import { sanitizeUser, publicUser, sanitizeUsers } from '../utils/sanitize-user';

const SECRETS = ['password', 'otp', 'otpExpiry', 'emailVerificationToken', 'emailVerificationExpiry'] as const;

const rawUser = {
  id: 1,
  username: 'tandavkrishna',
  password: 'scrypt$deadbeef',
  email: 'user@example.com',
  otp: '123456',
  otpExpiry: new Date('2026-01-01'),
  emailVerificationToken: 'verif-token',
  emailVerificationExpiry: new Date('2026-01-01'),
  isEmailVerified: true,
  guestUrl: '5421c0f86a03def8b54fe252cb7e2473',
  venueName: 'My Venue',
  theme: 'dark',
  allowSongRequests: true,
  allowGuestPlayOnDevice: false,
  allowPlaylistSharing: true,
  allowRecentlyPlayedVisibility: true,
  accountManagerId: 7,
  isAdmin: false,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-06-01'),
};

describe('sanitizeUser (self/admin projection)', () => {
  it('drops every secret field', () => {
    const s = sanitizeUser(rawUser) as Record<string, unknown>;
    for (const k of SECRETS) expect(k in s).toBe(false);
  });

  it('keeps the fields callers (SSO + dashboard + admin) read', () => {
    const s = sanitizeUser(rawUser) as Record<string, unknown>;
    for (const k of ['id', 'username', 'email', 'guestUrl', 'venueName', 'theme',
      'allowPlaylistSharing', 'isAdmin', 'accountManagerId', 'createdAt', 'updatedAt']) {
      expect(s[k]).toEqual((rawUser as Record<string, unknown>)[k]);
    }
  });

  it('returns undefined for null/undefined input', () => {
    expect(sanitizeUser(null)).toBeUndefined();
    expect(sanitizeUser(undefined)).toBeUndefined();
  });

  it('does not invent keys that were absent on the input', () => {
    const s = sanitizeUser({ id: 2, username: 'x', guestUrl: 'g' }) as Record<string, unknown>;
    expect('email' in s).toBe(false);
    expect('venueName' in s).toBe(false);
  });
});

describe('publicUser (public/guest projection)', () => {
  it('drops every secret field', () => {
    const p = publicUser(rawUser) as Record<string, unknown>;
    for (const k of SECRETS) expect(k in p).toBe(false);
  });

  it('also drops email, isAdmin, accountManagerId, and timestamps', () => {
    const p = publicUser(rawUser) as Record<string, unknown>;
    for (const k of ['email', 'isAdmin', 'accountManagerId', 'createdAt', 'updatedAt']) {
      expect(k in p).toBe(false);
    }
  });

  it('keeps only venue-facing fields the public page needs', () => {
    const p = publicUser(rawUser) as Record<string, unknown>;
    expect(p.guestUrl).toBe(rawUser.guestUrl);
    expect(p.venueName).toBe(rawUser.venueName);
    expect(p.allowPlaylistSharing).toBe(true);
  });
});

describe('sanitizeUsers (admin list)', () => {
  it('sanitizes each row and preserves order', () => {
    const list = sanitizeUsers([rawUser, { ...rawUser, id: 2, username: 'second' }]);
    expect(list).toHaveLength(2);
    expect((list[1] as Record<string, unknown>).username).toBe('second');
    for (const row of list) {
      for (const k of SECRETS) expect(k in (row as Record<string, unknown>)).toBe(false);
    }
  });

  it('handles null/empty input', () => {
    expect(sanitizeUsers(null)).toEqual([]);
    expect(sanitizeUsers([])).toEqual([]);
  });
});
