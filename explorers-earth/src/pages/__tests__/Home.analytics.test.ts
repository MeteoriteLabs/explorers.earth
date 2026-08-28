import { describe, expect, it, vi } from 'vitest';

vi.mock('../../hooks/useTunesDashboard', () => ({
  useTunesDashboard: () => ({}),
  musicWorkspaceClient: {},
}));
import {
  getHomeAnalyticsCard,
  getHomeRecentAnalyticsScope,
} from '../Home';

describe('Home analytics', () => {
  it('requests exactly the recent 90 local calendar dates', () => {
    expect(
      getHomeRecentAnalyticsScope(
        new Date(2026, 10, 15, 14),
        'America/New_York',
      ),
    ).toEqual({
      fromDate: '2026-08-18',
      toDate: '2026-11-15',
      timeZone: 'America/New_York',
    });
  });

  it('does not render a loading or unavailable recent read as zero views', () => {
    expect(getHomeAnalyticsCard('loading', [])).toEqual({
      label: 'Views · last 90 days',
      value: '—',
    });
    expect(getHomeAnalyticsCard('unavailable', [])).toEqual({
      label: 'Views · last 90 days',
      value: '—',
    });
    expect(getHomeAnalyticsCard('ready', [])).toEqual({
      label: 'Views · last 90 days',
      value: '0',
    });
  });
});
