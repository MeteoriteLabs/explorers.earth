import { describe, it, expect } from 'vitest';
import { getAvailableTabs, getTransportSegments } from '../guideHelpers';

describe('guideHelpers extra cases', () => {
  it('should return empty tabs when section fields are missing', () => {
    const emptySection = {};
    expect(getAvailableTabs(emptySection)).toEqual([]);
  });

  it('should return available tabs based on timeline, stay, and transport fields', () => {
    const mockSection = {
      Timeline: {
        morning: [{ placeName: 'Eiffel Tower', tips: 'Go early!' }]
      },
      Transport: {
        segments: [{ mode: 'walk', duration: 15 }]
      }
    };
    expect(getAvailableTabs(mockSection)).toContain('timeline');
    expect(getAvailableTabs(mockSection)).toContain('transportation');
    expect(getAvailableTabs(mockSection)).toContain('tips');
  });

  it('should get transport segments successfully', () => {
    expect(getTransportSegments({})).toEqual([]);
    
    const mockSection = {
      Transport: {
        segments: [{ mode: 'bus', duration: 30 }]
      }
    };
    expect(getTransportSegments(mockSection).length).toBe(1);
    expect(getTransportSegments(mockSection)[0].mode).toBe('bus');
  });
});
