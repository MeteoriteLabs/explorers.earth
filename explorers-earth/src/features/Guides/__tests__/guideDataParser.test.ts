import { describe, it, expect, vi } from 'vitest';
import { parseSectionData, parseTimeline, parseTransport, parseStay, parseActivity, parseBudget } from '../utils/guideDataParser';

describe('guideDataParser', () => {
  const originalConsoleError = console.error;
  
  beforeEach(() => {
    console.error = vi.fn();
  });
  
  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('parseSectionData', () => {
    it('returns empty object for falsy data', () => {
      expect(parseSectionData(null)).toEqual({});
      expect(parseSectionData(undefined)).toEqual({});
      expect(parseSectionData('')).toEqual({});
    });

    it('returns original object if already parsed', () => {
      const obj = { test: 123 };
      expect(parseSectionData(obj)).toBe(obj);
    });

    it('parses valid JSON string', () => {
      const json = '{"test": 123}';
      expect(parseSectionData(json)).toEqual({ test: 123 });
    });

    it('returns empty object and logs error on invalid JSON', () => {
      expect(parseSectionData('invalid json')).toEqual({});
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('specific parsers', () => {
    it('parses Timeline correctly', () => {
      const data = { morning: [{ id: 1 }], evening: [{ id: 2 }] };
      expect(parseTimeline(data)).toEqual({
        morning: [{ id: 1 }],
        afternoon: [],
        evening: [{ id: 2 }]
      });
    });

    it('parses Transport correctly', () => {
      const data = '{"segments": [{"type": "flight"}]}';
      expect(parseTransport(data)).toEqual({
        segments: [{ type: 'flight' }]
      });
    });

    it('parses Stay correctly', () => {
      expect(parseStay({ accommodations: [{ id: 1 }] })).toEqual({
        accommodations: [{ id: 1 }]
      });
      expect(parseStay(null)).toEqual({ accommodations: [] });
    });

    it('parses Activity correctly', () => {
      expect(parseActivity({ activities: [{ id: 1 }] })).toEqual({
        activities: [{ id: 1 }]
      });
    });

    it('parses Budget correctly', () => {
      const data = { afternoon: [{ cost: 10 }] };
      expect(parseBudget(data)).toEqual({
        morning: [],
        afternoon: [{ cost: 10 }],
        evening: []
      });
    });
  });
});
