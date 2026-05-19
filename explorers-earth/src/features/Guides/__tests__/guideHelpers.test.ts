import { describe, it, expect } from 'vitest';
import { getAvailableTabs, getTransportSegments } from '../utils/guideHelpers';

describe('guideHelpers', () => {
  describe('getAvailableTabs', () => {
    it('returns empty array for empty section', () => {
      expect(getAvailableTabs({})).toEqual([]);
    });

    it('detects timeline tab', () => {
      const section = { Timeline: { morning: [{}] } };
      expect(getAvailableTabs(section)).toContain('timeline');
    });

    it('detects transportation tab', () => {
      const section = { Transport: { segments: [{}] } };
      expect(getAvailableTabs(section)).toContain('transportation');
    });

    it('detects stay tab', () => {
      const section = { Stay: { accommodations: [{}] } };
      expect(getAvailableTabs(section)).toContain('stay');
    });

    it('detects activities tab', () => {
      const section = { Recommendation_Activity: { activities: [{}] } };
      expect(getAvailableTabs(section)).toContain('activities');
    });

    it('detects tips tab when places have tips', () => {
      const section1 = { Timeline: { morning: [{ tips: 'Take umbrella' }] } };
      expect(getAvailableTabs(section1)).toContain('tips');
      
      const section2 = { Timeline: { morning: [{}] } };
      expect(getAvailableTabs(section2)).not.toContain('tips');
    });

    it('detects budget tab when places have price fields in Budget', () => {
      const section1 = { Budget: { afternoon: [{ priceLevel: 2 }] } };
      expect(getAvailableTabs(section1)).toContain('budget');

      const section2 = { Budget: { evening: [{ priceRange: '$$' }] } };
      expect(getAvailableTabs(section2)).toContain('budget');
      
      const section3 = { Budget: { evening: [{}] } };
      expect(getAvailableTabs(section3)).not.toContain('budget');
    });

    it('detects multiple tabs', () => {
      const section = {
        Timeline: { morning: [{ tips: 'yes' }] },
        Transport: { segments: [{}] },
      };
      const tabs = getAvailableTabs(section);
      expect(tabs).toContain('timeline');
      expect(tabs).toContain('tips');
      expect(tabs).toContain('transportation');
      expect(tabs).not.toContain('stay');
    });
  });

  describe('getTransportSegments', () => {
    it('returns empty array if no transport', () => {
      expect(getTransportSegments({})).toEqual([]);
      expect(getTransportSegments({ Transport: {} })).toEqual([]);
    });

    it('returns segments array', () => {
      const segments = [{ mode: 'bus' }, { mode: 'train' }];
      expect(getTransportSegments({ Transport: { segments } })).toEqual(segments);
    });
  });
});
