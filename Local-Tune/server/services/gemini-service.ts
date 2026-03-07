import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Gemini API configuration
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Available Gemini models
export const GEMINI_MODELS = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash-thinking-exp-01-21',
    'gemini-exp-1206',
] as const;

export type GeminiModel = typeof GEMINI_MODELS[number];

// Response types
export interface GeminiTokenUsage {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
}

export interface GeminiResponse {
    success: boolean;
    text?: string;
    tokenUsage?: GeminiTokenUsage;
    error?: string;
    model: string;
}

// System prompt file paths based on pipeline type
export const PIPELINE_TYPES = [
    'single_city',
    'multi_city',
    'single_day',
    'day_suggestions',
] as const;

export type PipelineType = typeof PIPELINE_TYPES[number];

// Pipeline to prompt file mapping
const PIPELINE_PROMPTS: Record<PipelineType, string> = {
    'single_city': path.join(__dirname, '../prompts/single-city-prompt.txt'),
    'multi_city': path.join(__dirname, '../prompts/multi-city-prompt.txt'),
    'single_day': path.join(__dirname, '../prompts/single-day-prompt.txt'),
    'day_suggestions': path.join(__dirname, '../prompts/day-suggestions-prompt.txt'),
};

// Default pipeline (for backward compatibility)
const DEFAULT_PIPELINE: PipelineType = 'single_city';

/**
 * Load system prompt from text file based on pipeline type
 * @param pipeline - The pipeline type to load prompt for (default: single_city)
 */
export function loadSystemPrompt(pipeline: PipelineType = DEFAULT_PIPELINE): string | null {
    const promptPath = PIPELINE_PROMPTS[pipeline];

    if (!promptPath) {
        console.warn(`Unknown pipeline type: ${pipeline}, falling back to ${DEFAULT_PIPELINE}`);
        return loadSystemPrompt(DEFAULT_PIPELINE);
    }

    try {
        if (fs.existsSync(promptPath)) {
            const content = fs.readFileSync(promptPath, 'utf-8');
            console.log(`[Gemini Service] Loaded system prompt for pipeline: ${pipeline}`);
            return content.trim();
        }
        console.warn('System prompt file not found:', promptPath);
        return null;
    } catch (error) {
        console.error('Error loading system prompt:', error);
        return null;
    }
}

/**
 * Generate content using Gemini API
 * @param prompt - The user prompt
 * @param model - The Gemini model to use (default: gemini-2.0-flash)
 * @param options - Configuration options
 * @param options.pipeline - The pipeline type to use (default: single_city)
 * @param options.includeSystemPrompt - Whether to include the system prompt (default: true)
 */
export async function generateContent(
    prompt: string,
    model: GeminiModel = 'gemini-2.0-flash',
    options: { pipeline?: PipelineType; includeSystemPrompt?: boolean } = {}
): Promise<GeminiResponse> {
    const { pipeline = DEFAULT_PIPELINE, includeSystemPrompt = true } = options;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return {
            success: false,
            error: 'GEMINI_API_KEY is not configured in environment variables',
            model,
        };
    }

    // Validate model
    if (!GEMINI_MODELS.includes(model)) {
        return {
            success: false,
            error: `Invalid model: ${model}. Available models: ${GEMINI_MODELS.join(', ')}`,
            model,
        };
    }

    // Build request URL
    const url = `${GEMINI_API_BASE_URL}/${model}:generateContent?key=${apiKey}`;

    // Build request body
    const contents: any[] = [];

    // Add system prompt if enabled
    if (includeSystemPrompt) {
        const systemPrompt = loadSystemPrompt(pipeline);
        if (systemPrompt) {
            console.log(`[Gemini Service] Using pipeline: ${pipeline}`);
            contents.push({
                role: 'user',
                parts: [{ text: `System Instructions: ${systemPrompt}` }],
            });
            contents.push({
                role: 'model',
                parts: [{ text: 'Understood. I will follow these instructions.' }],
            });
        }
    }

    // Add user prompt
    contents.push({
        role: 'user',
        parts: [{ text: prompt }],
    });

    const requestBody = {
        contents,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
        },
    };

    try {
        console.log(`[Gemini Service] Calling ${model} API...`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[Gemini Service] API Error:', response.status, errorData);
            return {
                success: false,
                error: errorData.error?.message || `API request failed with status ${response.status}`,
                model,
            };
        }

        const data = await response.json();

        // Extract text from response
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Extract token usage
        const tokenUsage: GeminiTokenUsage = {
            promptTokenCount: data.usageMetadata?.promptTokenCount || 0,
            candidatesTokenCount: data.usageMetadata?.candidatesTokenCount || 0,
            totalTokenCount: data.usageMetadata?.totalTokenCount || 0,
        };

        console.log(`[Gemini Service] Success! Tokens - Input: ${tokenUsage.promptTokenCount}, Output: ${tokenUsage.candidatesTokenCount}`);

        return {
            success: true,
            text,
            tokenUsage,
            model,
        };
    } catch (error: any) {
        console.error('[Gemini Service] Error:', error);
        return {
            success: false,
            error: error.message || 'Failed to generate content',
            model,
        };
    }
}

/**
 * Get available models
 */
export function getAvailableModels(): string[] {
    return [...GEMINI_MODELS];
}
