import { Express } from 'express';
import { z } from 'zod';
import { generate, listModels } from '../controllers/geminiController';

/**
 * Validation schema for generate endpoint
 */
const generateSchema = z.object({
    prompt: z.string().min(1, 'Prompt is required'),
    model: z.string().optional().default('gemini-2.0-flash'),
    pipeline: z.enum(['single_city', 'multi_city', 'single_day', 'day_suggestions']).optional().default('single_city'),
    includeSystemPrompt: z.boolean().optional().default(true),
    username: z.string().optional(), // Optional username for tracking (frontend should send this)
});


/**
 * Validation middleware
 */
const validate = (schema: z.ZodSchema) => {
    return async (req: any, res: any, next: any) => {
        try {
            const validated = await schema.parseAsync(req.body);
            req.body = validated;
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: error.errors.map((err) => ({
                        path: err.path.join('.'),
                        message: err.message,
                    })),
                });
            }
            return res.status(400).json({ success: false, message: 'Invalid request data' });
        }
    };
};

/**
 * Setup Gemini API routes
 * @param app Express application instance
 */
export function setupGeminiRoutes(app: Express) {
    // POST /api/gemini/generate - Generate content
    app.post('/api/gemini/generate', validate(generateSchema), generate);

    // GET /api/gemini/models - List available models
    app.get('/api/gemini/models', listModels);

    console.log('✅ Gemini routes registered');
}

