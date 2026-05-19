import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  appendUtmParams,
  extractUtmParams,
  extractUtmParamsFromCurrentUrl,
  createUtmParams,
  validateUtmParams,
  sanitizeUtmParams,
  UTMParameters
} from '../urlHelpers';

describe('urlHelpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── appendUtmParams ────────────────────────────────────────────────────────
  describe('appendUtmParams', () => {
    it('appends UTM parameters to a base URL', () => {
      const url = 'https://example.com/page';
      const params: UTMParameters = { utm_source: 'twitter', utm_medium: 'social' };
      const result = appendUtmParams(url, params);
      expect(result).toBe('https://example.com/page?utm_source=twitter&utm_medium=social');
    });

    it('preserves existing query parameters', () => {
      const url = 'https://example.com/page?existing=1';
      const params: UTMParameters = { utm_source: 'fb', utm_medium: 'social' };
      const result = appendUtmParams(url, params);
      expect(result).toBe('https://example.com/page?existing=1&utm_source=fb&utm_medium=social');
    });

    it('returns the original string if url is empty', () => {
      const result = appendUtmParams('', { utm_source: 'test' });
      expect(result).toBe('');
    });

    it('returns the original url if utmParams object is empty', () => {
      const result = appendUtmParams('https://example.com', {});
      expect(result).toBe('https://example.com');
    });

    it('returns original url if parsing fails (invalid url)', () => {
      // Mock console.error to avoid cluttering test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = appendUtmParams('not-a-real-url', { utm_source: 'test' });
      expect(result).toBe('not-a-real-url');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('ignores empty string values in utmParams', () => {
      const url = 'https://example.com';
      const params: UTMParameters = { utm_source: 'test', utm_medium: '  ' };
      const result = appendUtmParams(url, params);
      expect(result).toBe('https://example.com/?utm_source=test');
    });
  });

  // ── extractUtmParams ───────────────────────────────────────────────────────
  describe('extractUtmParams', () => {
    it('extracts source and medium from URL', () => {
      const result = extractUtmParams('https://example.com/?utm_source=test&utm_medium=email');
      expect(result).toEqual({ utm_source: 'test', utm_medium: 'email' });
    });

    it('returns empty object if no UTM parameters are present', () => {
      const result = extractUtmParams('https://example.com/?other=1');
      expect(result).toEqual({});
    });

    it('returns empty object if URL is empty', () => {
      const result = extractUtmParams('');
      expect(result).toEqual({});
    });

    it('returns empty object on parse error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = extractUtmParams('invalid_url://??');
      expect(result).toEqual({});
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  // ── extractUtmParamsFromCurrentUrl ─────────────────────────────────────────
  describe('extractUtmParamsFromCurrentUrl', () => {
    it('extracts UTM parameters from window.location.href', () => {
      // Vitest's jsdom sets a default window.location, we can mock href
      Object.defineProperty(window, 'location', {
        value: {
          href: 'http://localhost/?utm_source=google&utm_medium=cpc'
        },
        writable: true
      });
      const result = extractUtmParamsFromCurrentUrl();
      expect(result).toEqual({ utm_source: 'google', utm_medium: 'cpc' });
    });
  });

  // ── createUtmParams ────────────────────────────────────────────────────────
  describe('createUtmParams', () => {
    it('creates correct params for qrCode', () => {
      expect(createUtmParams.qrCode()).toEqual({ utm_source: 'qr_code_scan', utm_medium: 'qr_code' });
    });

    it('creates correct params for socialMedia', () => {
      expect(createUtmParams.socialMedia('Twitter')).toEqual({ utm_source: 'twitter', utm_medium: 'social' });
    });

    it('creates correct params for directShare', () => {
      expect(createUtmParams.directShare()).toEqual({ utm_source: 'direct', utm_medium: 'share' });
    });

    it('creates correct params for email', () => {
      expect(createUtmParams.email()).toEqual({ utm_source: 'email', utm_medium: 'email' });
    });

    it('creates correct params for referral', () => {
      expect(createUtmParams.referral('alice')).toEqual({ utm_source: 'alice', utm_medium: 'referral' });
    });
  });

  // ── validateUtmParams ──────────────────────────────────────────────────────
  describe('validateUtmParams', () => {
    it('validates correct UTM parameters', () => {
      const result = validateUtmParams({ utm_source: 'test', utm_medium: 'test' });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns error if utm_source is missing', () => {
      const result = validateUtmParams({ utm_medium: 'test' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('utm_source is required');
    });

    it('returns error if utm_medium is missing', () => {
      const result = validateUtmParams({ utm_source: 'test' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('utm_medium is required');
    });

    it('returns error if parameter is too long', () => {
      const longStr = 'a'.repeat(101);
      const result = validateUtmParams({ utm_source: longStr, utm_medium: 'test' });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds maximum length'))).toBe(true);
    });
  });

  // ── sanitizeUtmParams ──────────────────────────────────────────────────────
  describe('sanitizeUtmParams', () => {
    it('trims whitespace', () => {
      const result = sanitizeUtmParams({ utm_source: '  test  ', utm_medium: '\tvalue\n' });
      expect(result).toEqual({ utm_source: 'test', utm_medium: 'value' });
    });

    it('removes invalid characters like quotes and angle brackets', () => {
      const result = sanitizeUtmParams({ utm_source: '<script>', utm_medium: '"quoted"' });
      expect(result).toEqual({ utm_source: 'script', utm_medium: 'quoted' });
    });

    it('ignores empty values after sanitization', () => {
      const result = sanitizeUtmParams({ utm_source: 'test', utm_medium: '  <"">  ' });
      expect(result).toEqual({ utm_source: 'test' }); // utm_medium becomes empty and is ignored
    });
  });
});
