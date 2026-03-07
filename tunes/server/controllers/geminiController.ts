import type { Request, Response, NextFunction } from 'express';
import { generateContent, getAvailableModels, GeminiModel, GEMINI_MODELS, PipelineType, PIPELINE_TYPES } from '../services/gemini-service';
import { strapiService } from '../services/strapi-service';

/**
 * Generate content using Gemini API
 * POST /api/gemini/generate
 */
export const generate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { prompt, model = 'gemini-2.0-flash', pipeline = 'single_city', includeSystemPrompt = true } = req.body;

        // Validate prompt
        if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
            res.status(400).json({
                success: false,
                error: 'Prompt is required and must be a non-empty string',
            });
            return;
        }

        // Validate model
        if (!GEMINI_MODELS.includes(model as GeminiModel)) {
            res.status(400).json({
                success: false,
                error: `Invalid model. Available models: ${GEMINI_MODELS.join(', ')}`,
            });
            return;
        }

        // Validate pipeline
        if (!PIPELINE_TYPES.includes(pipeline as PipelineType)) {
            res.status(400).json({
                success: false,
                error: `Invalid pipeline. Available pipelines: ${PIPELINE_TYPES.join(', ')}`,
            });
            return;
        }

        // Generate content
        const result = await generateContent(prompt.trim(), model as GeminiModel, {
            pipeline: pipeline as PipelineType,
            includeSystemPrompt,
        });

        if (result.success) {
            res.status(200).json({
                success: true,
                data: {
                    text: result.text,
                    model: result.model,
                    tokenUsage: {
                        inputTokens: result.tokenUsage?.promptTokenCount || 0,
                        outputTokens: result.tokenUsage?.candidatesTokenCount || 0,
                        totalTokens: result.tokenUsage?.totalTokenCount || 0,
                    },
                },
            });

            // Track AI guide request in Strapi after successful generation (non-blocking)
            // This runs in the background and won't delay the user's response

            // Get username from request body (preferred) or session
            const requestBodyUsername = req.body.username;
            const sessionUsername = req.user?.username;

            console.log('🔍 [STRAPI] Checking AI guide tracking conditions:', {
                isAuthenticated: req.isAuthenticated(),
                sessionUserId: req.user?.id,
                sessionUsername: sessionUsername,
                requestBodyUsername: requestBodyUsername,
                hasUser: !!req.user
            });

            // Detect session mismatch - this could indicate a stale session cookie
            if (requestBodyUsername && sessionUsername && requestBodyUsername !== sessionUsername) {
                console.warn('⚠️ [STRAPI] SESSION MISMATCH DETECTED!', {
                    sessionUsername: sessionUsername,
                    requestBodyUsername: requestBodyUsername,
                    message: 'Frontend sent different username than session. Using request body username.'
                });
            }

            // Use request body username if provided (frontend knows the actual logged-in user)
            // Fall back to session username if not provided
            const username = requestBodyUsername || sessionUsername;

            if (username) {
                console.log(`📊 [STRAPI] Starting AI guide tracking for username: ${username}`);
                strapiService.incrementAiGuideRequests(username)
                    .then((result) => {
                        console.log(`✅ [STRAPI] Successfully tracked AI guide request for user: ${username}, ai_guide_requests: ${result.ai_guide_requests}`);
                    })
                    .catch((strapiError) => {
                        // Log error but don't fail the request (already sent)
                        console.error(`❌ [STRAPI] Failed to track AI guide request for user: ${username}:`, strapiError);
                        if (strapiError instanceof Error) {
                            console.error(`❌ [STRAPI] Error details:`, strapiError.message);
                            console.error(`❌ [STRAPI] Error stack:`, strapiError.stack);
                        }
                    });
            } else {
                console.log('⚠️ [STRAPI] Skipping AI guide tracking - username not available:', {
                    isAuthenticated: req.isAuthenticated(),
                    hasUser: !!req.user,
                    sessionUsername: sessionUsername,
                    requestBodyUsername: requestBodyUsername
                });
            }


        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                model: result.model,
            });
        }
    } catch (error: any) {
        console.error('[Gemini Controller] Error:', error);
        next(error);
    }
};

/**
 * Get available Gemini models
 * GET /api/gemini/models
 */
export const listModels = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const models = getAvailableModels();
        res.status(200).json({
            success: true,
            models,
        });
    } catch (error: any) {
        console.error('[Gemini Controller] Error listing models:', error);
        next(error);
    }
};
