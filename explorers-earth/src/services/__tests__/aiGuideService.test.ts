import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateAiGuide } from '../aiGuideService';
import axios from 'axios';

vi.mock('axios');

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

describe('aiGuideService tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. should call generate endpoint and format nested response data', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          text: 'Generated Paris Guide content',
          inputTokens: 10,
          outputTokens: 20,
          model: 'gemini-2.0-flash'
        }
      }
    };

    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

    const result = await generateAiGuide('Create Paris Guide');
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('Generated Paris Guide content');
    expect(result.totalTokens).toBe(30);
    expect(result.model).toBe('gemini-2.0-flash');
  });

  it('2. should format flat response data structure correctly', async () => {
    const mockResponse = {
      data: {
        text: 'Flat response text',
        inputTokens: 15,
        outputTokens: 25,
        model: 'gemini-1.5-pro'
      }
    };

    vi.mocked(axios.post).mockResolvedValueOnce(mockResponse);

    const result = await generateAiGuide('Flat test');
    expect(result.text).toBe('Flat response text');
    expect(result.inputTokens).toBe(15);
    expect(result.outputTokens).toBe(25);
    expect(result.totalTokens).toBe(40);
    expect(result.model).toBe('gemini-1.5-pro');
  });

  it('3. should handle plain string response format', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: 'Just plain guide text'
    });

    const result = await generateAiGuide('Plain test');
    expect(result.text).toBe('Just plain guide text');
    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.totalTokens).toBe(0);
  });

  it('4. should handle custom model and system prompt options', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: 'Custom options test'
    });

    await generateAiGuide('Options check', { model: 'gemini-ultra', includeSystemPrompt: false });
    
    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        model: 'gemini-ultra',
        includeSystemPrompt: false
      }),
      expect.any(Object)
    );
  });

  it('5. should handle API errors with success=false and throw exceptions', async () => {
    const mockErrorResponse = {
      data: {
        success: false,
        error: 'Rate limit exceeded'
      }
    };

    vi.mocked(axios.post).mockResolvedValueOnce(mockErrorResponse);

    await expect(generateAiGuide('Paris')).rejects.toThrow('Rate limit exceeded');
  });

  it('6. should throw exception for unexpected response format', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { invalid_key: 'value' }
    });

    await expect(generateAiGuide('Invalid')).rejects.toThrow('Unexpected response format from AI service');
  });

  it('7. should log tracking flow exceptions gracefully without blocking main generation', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: 'Successful text generation'
    });
    // Set malformed JSON in localStorage to cause parsing exception
    localStorage.setItem('auth-storage', '{invalid-json}');

    const result = await generateAiGuide('Tracking test');
    expect(result.text).toBe('Successful text generation');
    expect(console.error).toHaveBeenCalled();
  });

  it('8. should skip tracking flow if auth-storage does not exist', async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: 'Success guide'
    });
    
    const result = await generateAiGuide('No auth storage test');
    expect(result.text).toBe('Success guide');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('9. should handle axios error object with detailed response info', async () => {
    const axiosError = {
      response: {
        data: {
          error: 'Missing API key detail'
        }
      }
    };
    vi.mocked(axios.post).mockRejectedValueOnce(axiosError);

    await expect(generateAiGuide('Axios Error')).rejects.toThrow('Missing API key detail');
  });

  it('10. should handle general throw / system crash and fallback to generic error message', async () => {
    vi.mocked(axios.post).mockRejectedValueOnce(new Error('Internal system failure'));

    await expect(generateAiGuide('Fatal')).rejects.toThrow('Internal system failure');
  });
});
