import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveIPToCountry, batchResolveIPsToCountries } from '../utils/geolocationService';

describe('geolocationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('resolveIPToCountry', () => {
    it('returns Local for private IPs', async () => {
      expect(await resolveIPToCountry('127.0.0.1')).toBe('Local');
      expect(await resolveIPToCountry('192.168.1.1')).toBe('Local');
      expect(await resolveIPToCountry('10.0.0.1')).toBe('Local');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('uses ipinfo.io as primary service', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ country: 'US' })
      });

      const result = await resolveIPToCountry('8.8.8.8');
      expect(result).toBe('US');
      expect(global.fetch).toHaveBeenCalledWith('https://ipinfo.io/8.8.8.8/json', expect.any(Object));
      expect(global.fetch).toHaveBeenCalledTimes(1); // Didn't fall back
    });

    it('falls back to ipapi.co if ipinfo.io fails', async () => {
      // ipinfo fails
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
      // ipapi succeeds
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ country_name: 'Canada' })
      });

      const result = await resolveIPToCountry('8.8.8.8');
      expect(result).toBe('Canada');
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenLastCalledWith('https://ipapi.co/8.8.8.8/json/', expect.any(Object));
    });

    it('returns null if all services fail', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await resolveIPToCountry('8.8.8.8');
      expect(result).toBeNull();
    });
  });

  describe('batchResolveIPsToCountries', () => {
    it('resolves unique IPs and caches them', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ country: 'FR' })
      });

      // Call with duplicate IPs
      const results = await batchResolveIPsToCountries(['1.1.1.1', '1.1.1.1']);
      
      expect(results.get('1.1.1.1')).toBe('FR');
      // Should only fetch once because of uniqueness and caching
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
