import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import {
  generateGuideWithAI,
  getSystemPrompt,
  GenerateGuideOptions,
} from '../geminiService';

vi.mock('axios');

describe('geminiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('getSystemPrompt', () => {
    it('returns the correct system prompt for single_city pipeline', () => {
      const prompt = getSystemPrompt('single_city');
      expect(prompt).toContain('Role: Itinerary Guide Enrichment Engine');
    });

    it('returns the correct system prompt for multi_city pipeline', () => {
      const prompt = getSystemPrompt('multi_city');
      expect(prompt).toContain('Role: Multi-City Itinerary Generator & Data Compiler');
    });

    it('returns empty string for unknown pipeline', () => {
      const prompt = getSystemPrompt('unknown_pipeline' as any);
      expect(prompt).toBe('');
    });
  });

  describe('generateGuideWithAI', () => {
    const defaultOptions: GenerateGuideOptions = {
      locationName: 'Paris',
      locationType: 'single',
      numberOfDays: 3,
      categories: ['culture', 'food'],
      budgetType: 'Mid_Range',
      guideType: 'Itinerary',
    };

    it('generates a single city guide successfully', async () => {
      const mockAiResponse = {
        data: {
          guide: {
            title: 'Paris Adventure',
            description: 'A great trip to Paris',
            Tips_Notes: [{ type: 'paragraph', children: [{ text: 'Bring an umbrella' }] }],
            Guide_Tags: ['culture', 'food'],
            sections: [
              {
                title: 'Day 1',
                sequence: 1,
                Timeline: {
                  morning: [{ name: 'Louvre', tips: 'Go early' }]
                }
              }
            ]
          }
        }
      };

      (axios.post as any).mockResolvedValue({
        data: {
          success: true,
          data: { text: JSON.stringify(mockAiResponse) }
        }
      });

      const result = await generateGuideWithAI(defaultOptions);

      expect(axios.post).toHaveBeenCalledTimes(1);
      const callArgs = (axios.post as any).mock.calls[0];
      expect(callArgs[0]).toContain('/api/gemini/generate');
      expect(callArgs[1].pipeline).toBe('single_city');
      expect(callArgs[1].model).toBe('gemini-2.0-flash');

      expect(result.title).toBe('Paris Adventure');
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].places?.[0].name).toBe('Louvre');
      expect(result.numberOfDays).toBe(3); // Passed through from options
    });

    it('generates a multi city guide successfully', async () => {
      const multiOptions: GenerateGuideOptions = {
        ...defaultOptions,
        locationType: 'multi',
        fromLocation: 'London',
        toLocation: 'Rome',
        intermediateCities: ['Paris']
      };

      const mockAiResponse = {
        data: {
          guide: {
            title: 'Euro Trip',
            description: 'London to Rome',
            sections: [
              {
                title: 'Day 1 in London',
                sequence: 1,
                location: 'departure',
                Timeline: { morning: [{ name: 'Big Ben' }] }
              }
            ]
          }
        }
      };

      (axios.post as any).mockResolvedValue({
        data: {
          success: true,
          data: { text: JSON.stringify(mockAiResponse) }
        }
      });

      const result = await generateGuideWithAI(multiOptions);

      expect(axios.post).toHaveBeenCalledTimes(1);
      const callArgs = (axios.post as any).mock.calls[0];
      expect(callArgs[1].pipeline).toBe('multi_city');
      expect(callArgs[1].prompt).toContain('multi-city guide covering: London');

      expect(result.title).toBe('Euro Trip');
      expect(result.sections).toHaveLength(1);
    });

    it('throws error when API returns success: false', async () => {
      (axios.post as any).mockResolvedValue({
        data: {
          success: false,
          message: 'API limits reached'
        }
      });

      await expect(generateGuideWithAI(defaultOptions)).rejects.toThrow('API limits reached');
    });

    it('throws custom error for timeout', async () => {
      (axios.post as any).mockRejectedValue({ code: 'ECONNABORTED' });

      await expect(generateGuideWithAI(defaultOptions)).rejects.toThrow('AI generation timed out');
    });

    it('handles markdown formatted JSON correctly', async () => {
      const mockJson = JSON.stringify({
        title: 'Markdown Test',
        description: 'Test',
        sections: [{ title: 'Day 1', sequence: 1, places: [] }]
      });
      const markdownJson = `\`\`\`json\n${mockJson}\n\`\`\``;

      (axios.post as any).mockResolvedValue({
        data: {
          success: true,
          data: { text: markdownJson }
        }
      });

      const result = await generateGuideWithAI(defaultOptions);
      expect(result.title).toBe('Markdown Test');
    });

    it('throws error on malformed JSON', async () => {
      (axios.post as any).mockResolvedValue({
        data: {
          success: true,
          data: { text: '{ invalid_json }' }
        }
      });

      await expect(generateGuideWithAI(defaultOptions)).rejects.toThrow(/Failed to parse AI response/);
    });
  });
});
