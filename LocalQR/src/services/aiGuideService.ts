import axios from 'axios';

const PAYMENT_API_URL = import.meta.env.VITE_PAYMENT_API_URL || import.meta.env.VITE_REST_API_URL;

export interface GenerateGuideRequest {
    prompt: string;
    model?: string;
    includeSystemPrompt?: boolean;
}

export interface GenerateGuideResult {
    text: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
}

/**
 * Generate AI guide content using Gemini API
 * Requires authenticated user - backend will track ai_guide_requests automatically
 */
export const generateAiGuide = async (
    prompt: string,
    options: { model?: string; includeSystemPrompt?: boolean } = {}
): Promise<GenerateGuideResult> => {
    try {
        const response = await axios.post(
            `${PAYMENT_API_URL}/api/gemini/generate`,
            {
                prompt,
                model: options.model || 'gemini-2.0-flash',
                includeSystemPrompt: options.includeSystemPrompt ?? true,
            },
            {
                withCredentials: true, // Include cookies for authentication
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        // Handle different response structures
        const responseData = response.data;

        // Check if response has error
        if (responseData.success === false || responseData.error) {
            throw new Error(responseData.error || 'Failed to generate guide');
        }

        // Extract text from various possible response structures
        let text: string;
        let inputTokens: number | undefined;
        let outputTokens: number | undefined;
        let model: string | undefined;

        if (responseData.data && typeof responseData.data === 'object') {
            // Nested data structure: { success: true, data: { text, ... } }
            text = responseData.data.text || '';
            inputTokens = responseData.data.inputTokens;
            outputTokens = responseData.data.outputTokens;
            model = responseData.data.model;
        } else if (responseData.text) {
            // Flat structure: { text, inputTokens, ... }
            text = responseData.text;
            inputTokens = responseData.inputTokens;
            outputTokens = responseData.outputTokens;
            model = responseData.model;
        } else if (typeof responseData === 'string') {
            // Plain text response
            text = responseData;
        } else {
            throw new Error('Unexpected response format from AI service');
        }

        // Track AI guide request
        try {
            const authStorage = localStorage.getItem('auth-storage');
            if (authStorage) {
                const authData = JSON.parse(authStorage);
                const username = authData?.state?.user?.username;
                if (username) {
                    // Import and track asynchronously
                    import('./requestTrackingService').then(({ trackAIGuideRequest }) => {
                        trackAIGuideRequest(username).catch(err => {
                            console.error('[Tracking] Failed to track AI guide request:', err);
                        });
                    }).catch(err => {
                        console.error('[Tracking] Failed to load tracking service:', err);
                    });
                }
            }
        } catch (trackingError) {
            console.error('[Tracking] Error in tracking flow:', trackingError);
        }

        return {
            text,
            model,
            inputTokens: inputTokens ?? 0,
            outputTokens: outputTokens ?? 0,
            totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0),
        };
    } catch (error: any) {
        console.error('Error generating AI guide:', error);
        if (error.response?.data?.error) {
            throw new Error(error.response.data.error);
        }
        throw new Error(error.message || 'Failed to generate AI guide');

    }
};
