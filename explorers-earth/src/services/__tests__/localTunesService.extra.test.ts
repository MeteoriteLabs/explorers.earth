import { describe, it, expect, vi } from 'vitest';
import { prepareLocalTunesUserData, isLocalTunesEnabled, getLocalTunesConfig } from '../localTunesService';

describe('localTunesService helpers and configs', () => {
  it('should format raw fields into LocalTunes data shape', () => {
    const rawInput = {
      username: 'VenName',
      email: 'ven@test.com',
      password: 'Pass',
      accountName: 'The Venue'
    };
    const prepared = prepareLocalTunesUserData(rawInput as any);
    expect(prepared.username).toBe('VenName');
    expect(prepared.venueName).toBe('The Venue');
  });

  it('should check if integration is enabled/disabled via config flags', () => {
    const config = getLocalTunesConfig();
    expect(isLocalTunesEnabled()).toBe(config.enabled);
  });
});
