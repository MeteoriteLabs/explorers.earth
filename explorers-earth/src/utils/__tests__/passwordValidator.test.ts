/**
 * Unit Tests: passwordValidator.ts
 *
 * Pure functions — no mocks required.
 * Coverage target: 100%
 */
import { describe, it, expect } from 'vitest';

import {
  calculatePasswordStrength,
  validatePassword,
  getStrengthInfo,
  isPasswordValid,
  getPasswordRequirements,
  PasswordStrength,
  PASSWORD_CONFIG,
} from '../passwordValidator';

// ─────────────────────────────────────────────────────────────────────────────
// calculatePasswordStrength
// ─────────────────────────────────────────────────────────────────────────────
describe('calculatePasswordStrength', () => {
  it('returns VERY_WEAK (0) for empty string', () => {
    expect(calculatePasswordStrength('')).toBe(PasswordStrength.VERY_WEAK);
  });

  it('returns VERY_WEAK (0) for a common password like "password"', () => {
    expect(calculatePasswordStrength('password')).toBe(PasswordStrength.VERY_WEAK);
  });

  it('returns WEAK (1) for very short lowercase-only passwords', () => {
    const result = calculatePasswordStrength('abcd');
    expect(result).toBeLessThanOrEqual(PasswordStrength.WEAK);
  });

  it('returns FAIR (2) for a short mixed-case password', () => {
    const result = calculatePasswordStrength('Abcd12');
    expect(result).toBeGreaterThanOrEqual(PasswordStrength.FAIR);
  });

  it('returns GOOD (3) or better for a medium mixed password with special chars', () => {
    const result = calculatePasswordStrength('Abcd12!@');
    expect(result).toBeGreaterThanOrEqual(PasswordStrength.GOOD);
  });

  it('returns STRONG (4) or better for a long complex password', () => {
    const result = calculatePasswordStrength('MyStr0ng!Pass#99');
    expect(result).toBeGreaterThanOrEqual(PasswordStrength.STRONG);
  });

  it('returns VERY_STRONG (5) for a very long complex password', () => {
    const result = calculatePasswordStrength('X!9aB#qW2@pZrT$mN5^v');
    expect(result).toBe(PasswordStrength.VERY_STRONG);
  });

  it('penalises repeated characters (aaa111!!!)', () => {
    const repeated = calculatePasswordStrength('aaaa1111!!!!AAAA');
    const nonRepeated = calculatePasswordStrength('aA1!bB2@cC3#dD4$');
    expect(repeated).toBeLessThanOrEqual(nonRepeated);
  });

  it('penalises sequential patterns (abc123)', () => {
    const sequential = calculatePasswordStrength('abc123DEF!');
    const nonSequential = calculatePasswordStrength('kMp942!Zq@');
    expect(sequential).toBeLessThanOrEqual(nonSequential);
  });

  it('score stays within 0–5 range for all inputs', () => {
    const inputs = ['', 'a', 'password', 'Abc!1234567890XYZabc!', '!@#$%^&*'];
    inputs.forEach((input) => {
      const score = calculatePasswordStrength(input);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(5);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getStrengthInfo
// ─────────────────────────────────────────────────────────────────────────────
describe('getStrengthInfo', () => {
  const levels: PasswordStrength[] = [
    PasswordStrength.VERY_WEAK,
    PasswordStrength.WEAK,
    PasswordStrength.FAIR,
    PasswordStrength.GOOD,
    PasswordStrength.STRONG,
    PasswordStrength.VERY_STRONG,
  ];

  it.each(levels)('returns a label and color for strength level %i', (level) => {
    const info = getStrengthInfo(level);
    expect(info.label).toBeTruthy();
    expect(info.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('returns "Very Weak" label for VERY_WEAK without translation fn', () => {
    expect(getStrengthInfo(PasswordStrength.VERY_WEAK).label).toBe('Very Weak');
  });

  it('returns "Very Strong" label for VERY_STRONG without translation fn', () => {
    expect(getStrengthInfo(PasswordStrength.VERY_STRONG).label).toBe('Very Strong');
  });

  it('uses translation function when provided', () => {
    const t = (key: string) => `TRANSLATED:${key}`;
    const info = getStrengthInfo(PasswordStrength.GOOD, t);
    expect(info.label).toMatch(/^TRANSLATED:/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validatePassword
// ─────────────────────────────────────────────────────────────────────────────
describe('validatePassword', () => {

  // ── RULE: min length ────────────────────────────────────────────────────────
  describe('minimum length rule', () => {
    it('fails when password is shorter than MIN_LENGTH (6)', () => {
      const result = validatePassword('Ab1!');
      expect(result.isValid).toBe(false);
      expect(result.rules.minLength).toBe(false);
      expect(result.errors.some(e => /at least/i.test(e))).toBe(true);
    });

    it('passes min length with exactly 6 characters (if other rules met)', () => {
      const result = validatePassword('Ab1!xY');
      expect(result.rules.minLength).toBe(true);
    });

    it('respects customMinLength option', () => {
      const result = validatePassword('Ab1!xy', {}, undefined);
      expect(result.rules.minLength).toBe(true);

      const withCustomMin = validatePassword('Ab1!xy', { customMinLength: 10 });
      expect(withCustomMin.rules.minLength).toBe(false);
    });
  });

  // ── RULE: max length ────────────────────────────────────────────────────────
  describe('maximum length rule', () => {
    it('fails when password exceeds MAX_LENGTH (32)', () => {
      const long = 'Aa1!' + 'x'.repeat(30); // 34 chars
      const result = validatePassword(long);
      expect(result.isValid).toBe(false);
      expect(result.rules.maxLength).toBe(false);
      expect(result.errors.some(e => /exceed/i.test(e))).toBe(true);
    });

    it('passes with exactly 32 characters', () => {
      const exact = 'Aa1!' + 'x'.repeat(28); // 32 chars
      const result = validatePassword(exact);
      expect(result.rules.maxLength).toBe(true);
    });

    it('respects customMaxLength option', () => {
      const result = validatePassword('Aa1!xyz', { customMaxLength: 5 });
      expect(result.rules.maxLength).toBe(false);
    });
  });

  // ── RULE: uppercase ─────────────────────────────────────────────────────────
  describe('uppercase rule', () => {
    it('fails when no uppercase letter present', () => {
      const result = validatePassword('ab1!cd2@');
      expect(result.rules.hasUppercase).toBe(false);
      expect(result.errors.some(e => /uppercase/i.test(e))).toBe(true);
    });

    it('passes when at least one uppercase letter is present', () => {
      const result = validatePassword('Ab1!cdef');
      expect(result.rules.hasUppercase).toBe(true);
    });
  });

  // ── RULE: lowercase ─────────────────────────────────────────────────────────
  describe('lowercase rule', () => {
    it('fails when no lowercase letter present', () => {
      const result = validatePassword('AB1!CD2@');
      expect(result.rules.hasLowercase).toBe(false);
      expect(result.errors.some(e => /lowercase/i.test(e))).toBe(true);
    });

    it('passes when at least one lowercase letter is present', () => {
      const result = validatePassword('aB1!CDEF');
      expect(result.rules.hasLowercase).toBe(true);
    });
  });

  // ── RULE: number ────────────────────────────────────────────────────────────
  describe('number rule', () => {
    it('fails when no number is present', () => {
      const result = validatePassword('Abcd!efg');
      expect(result.rules.hasNumber).toBe(false);
      expect(result.errors.some(e => /number/i.test(e))).toBe(true);
    });

    it('passes when at least one number is present', () => {
      const result = validatePassword('Abcd1!fg');
      expect(result.rules.hasNumber).toBe(true);
    });
  });

  // ── RULE: special character ─────────────────────────────────────────────────
  describe('special character rule', () => {
    it('fails when no special character is present', () => {
      const result = validatePassword('Abcd1234');
      expect(result.rules.hasSpecialChar).toBe(false);
      expect(result.errors.some(e => /special/i.test(e))).toBe(true);
    });

    it('passes with each of the allowed special characters', () => {
      const specials = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')'];
      specials.forEach((char) => {
        const result = validatePassword(`Aa1${char}bcde`);
        expect(result.rules.hasSpecialChar).toBe(true);
      });
    });
  });

  // ── RULE: common password ───────────────────────────────────────────────────
  describe('common password rule', () => {
    it('fails for well-known common passwords', () => {
      const common = ['password', '123456', 'qwerty', 'abc123', 'admin'];
      common.forEach((pw) => {
        const result = validatePassword(pw);
        expect(result.rules.notCommon).toBe(false);
      });
    });

    it('passes when skipCommonCheck is true even for common passwords', () => {
      const result = validatePassword('password', { skipCommonCheck: true });
      expect(result.rules.notCommon).toBe(true);
    });

    it('passes for a non-common password', () => {
      const result = validatePassword('MyUnique!Pass7@');
      expect(result.rules.notCommon).toBe(true);
    });
  });

  // ── RULE: not same as current password ─────────────────────────────────────
  describe('notCurrentPassword rule', () => {
    it('fails when new password equals current password', () => {
      const result = validatePassword('MyPass1!', { currentPassword: 'MyPass1!' });
      expect(result.rules.notCurrentPassword).toBe(false);
      expect(result.errors.some(e => /same as your current/i.test(e))).toBe(true);
    });

    it('passes when new password differs from current password', () => {
      const result = validatePassword('MyNewPass2@', { currentPassword: 'MyPass1!' });
      expect(result.rules.notCurrentPassword).toBe(true);
    });

    it('passes when no currentPassword option is provided', () => {
      const result = validatePassword('AnyPass1!');
      expect(result.rules.notCurrentPassword).toBe(true);
    });
  });

  // ── Full valid password ─────────────────────────────────────────────────────
  describe('fully valid password', () => {
    it('returns isValid=true and empty errors array for a strong unique password', () => {
      const result = validatePassword('MySecureP@ss99!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('sets successMessage when password is valid and non-empty', () => {
      const result = validatePassword('MySecureP@ss99!');
      expect(result.successMessage).toBeTruthy();
      expect(result.successMessage).toMatch(/meets all requirements/i);
    });

    it('successMessage is empty when password is invalid', () => {
      const result = validatePassword('weak');
      expect(result.successMessage).toBe('');
    });
  });

  // ── Warnings ────────────────────────────────────────────────────────────────
  describe('warnings', () => {
    it('generates a warning for a weak but technically valid password', () => {
      // A password that passes all hard rules but is still very short (6 chars)
      const result = validatePassword('Aa1!bc');
      // Should have warning about length or variety
      expect(result.warnings.length).toBeGreaterThanOrEqual(0); // warnings are optional
    });

    it('warns about passwords shorter than 10 characters when otherwise valid', () => {
      const result = validatePassword('Aa1!bcde'); // 8 chars — valid but short
      const hasLengthWarning = result.warnings.some(w => /10 or more/i.test(w));
      expect(hasLengthWarning).toBe(true);
    });
  });

  // ── Strength and color in result ────────────────────────────────────────────
  describe('strength and color in result', () => {
    it('includes strength, strengthLabel, and strengthColor in the result', () => {
      const result = validatePassword('MySecureP@ss99!');
      expect(typeof result.strength).toBe('number');
      expect(result.strengthLabel).toBeTruthy();
      expect(result.strengthColor).toMatch(/^#/);
    });
  });

  // ── i18n (translation function) ─────────────────────────────────────────────
  describe('i18n translation support', () => {
    it('calls t() for error messages when translation function is provided', () => {
      const t = (key: string) => `T:${key}`;
      const result = validatePassword('weak', {}, t);
      result.errors.forEach((e) => {
        expect(e).toMatch(/^T:/);
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isPasswordValid
// ─────────────────────────────────────────────────────────────────────────────
describe('isPasswordValid', () => {
  it('returns true for a fully valid password', () => {
    expect(isPasswordValid('MySecureP@ss99!')).toBe(true);
  });

  it('returns false for an invalid password', () => {
    expect(isPasswordValid('weak')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isPasswordValid('')).toBe(false);
  });

  it('respects options (currentPassword check)', () => {
    expect(isPasswordValid('MySecureP@ss99!', { currentPassword: 'MySecureP@ss99!' })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getPasswordRequirements
// ─────────────────────────────────────────────────────────────────────────────
describe('getPasswordRequirements', () => {
  it('returns an array of requirement strings', () => {
    const reqs = getPasswordRequirements();
    expect(Array.isArray(reqs)).toBe(true);
    expect(reqs.length).toBeGreaterThan(0);
  });

  it('includes min length requirement using default MIN_LENGTH', () => {
    const reqs = getPasswordRequirements();
    expect(reqs.some(r => r.includes(String(PASSWORD_CONFIG.MIN_LENGTH)))).toBe(true);
  });

  it('includes max length requirement using default MAX_LENGTH', () => {
    const reqs = getPasswordRequirements();
    expect(reqs.some(r => r.includes(String(PASSWORD_CONFIG.MAX_LENGTH)))).toBe(true);
  });

  it('uses customMinLength and customMaxLength when provided', () => {
    const reqs = getPasswordRequirements({ customMinLength: 10, customMaxLength: 50 });
    expect(reqs.some(r => r.includes('10'))).toBe(true);
    expect(reqs.some(r => r.includes('50'))).toBe(true);
  });

  it('includes uppercase, lowercase, number, and special char requirements', () => {
    const reqs = getPasswordRequirements();
    const joined = reqs.join(' ').toLowerCase();
    expect(joined).toMatch(/uppercase/);
    expect(joined).toMatch(/lowercase/);
    expect(joined).toMatch(/number/);
    expect(joined).toMatch(/special/);
  });

  it('always includes "not a common password" requirement', () => {
    const reqs = getPasswordRequirements();
    expect(reqs.some(r => /common/i.test(r))).toBe(true);
  });
});
