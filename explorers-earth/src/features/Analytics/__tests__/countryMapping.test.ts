import { describe, it, expect } from 'vitest';
import { getCountryName, getTranslatedCountryName } from '../utils/countryMapping';

describe('countryMapping', () => {
  describe('getCountryName', () => {
    it('returns full country name for known code', () => {
      expect(getCountryName('US')).toBe('United States');
      expect(getCountryName('IN')).toBe('India');
      expect(getCountryName('GB')).toBe('United Kingdom');
    });

    it('returns code itself for unknown code', () => {
      expect(getCountryName('XYZ')).toBe('XYZ');
      expect(getCountryName('')).toBe('');
    });
  });

  describe('getTranslatedCountryName', () => {
    it('returns translated name if translation exists', () => {
      const mockT = (key: string) => {
        if (key === 'countries.US') return 'Estados Unidos';
        return key;
      };

      expect(getTranslatedCountryName('US', mockT)).toBe('Estados Unidos');
    });

    it('falls back to English name if translation is missing', () => {
      // Mock t returns the key if missing
      const mockT = (key: string) => key;

      expect(getTranslatedCountryName('FR', mockT)).toBe('France');
    });

    it('falls back to code if translation is missing and code is unknown', () => {
      const mockT = (key: string) => key;

      expect(getTranslatedCountryName('XYZ', mockT)).toBe('XYZ');
    });
  });
});
