/**
 * Razorpay Configuration Utility
 * Provides mode-based (DEV/PROD) credential management for Razorpay integration
 */
import Razorpay from 'razorpay';

export type RazorpayMode = 'DEV' | 'PROD';

interface RazorpayCredentials {
    keyId: string;
    keySecret: string;
}

// Cache Razorpay instances by mode to avoid creating multiple instances
const razorpayInstances: Map<RazorpayMode, Razorpay> = new Map();

/**
 * Get Razorpay credentials based on mode
 */
export const getRazorpayCredentials = (mode: RazorpayMode): RazorpayCredentials => {
    if (mode === 'PROD') {
        return {
            keyId: process.env.RAZORPAY_KEY_ID_PROD || '',
            keySecret: process.env.RAZORPAY_KEY_SECRET_PROD || '',
        };
    }

    // Default to DEV
    return {
        keyId: process.env.RAZORPAY_KEY_ID_DEV || '',
        keySecret: process.env.RAZORPAY_KEY_SECRET_DEV || '',
    };
};

/**
 * Validate that Razorpay credentials are configured for the given mode
 */
export const validateRazorpayCredentials = (mode: RazorpayMode): { valid: boolean; error?: string } => {
    const credentials = getRazorpayCredentials(mode);

    if (!credentials.keyId || !credentials.keySecret) {
        const suffix = mode === 'PROD' ? 'PROD' : 'DEV';
        return {
            valid: false,
            error: `Razorpay ${mode} credentials not configured. Please set RAZORPAY_KEY_ID_${suffix} and RAZORPAY_KEY_SECRET_${suffix} in environment variables.`,
        };
    }

    return { valid: true };
};

/**
 * Get or create a Razorpay instance for the specified mode
 */
export const getRazorpayInstance = (mode: RazorpayMode = 'DEV'): Razorpay => {
    // Check if we already have an instance for this mode
    const existingInstance = razorpayInstances.get(mode);
    if (existingInstance) {
        return existingInstance;
    }

    // Validate credentials
    const validation = validateRazorpayCredentials(mode);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    // Create new instance
    const credentials = getRazorpayCredentials(mode);
    const instance = new Razorpay({
        key_id: credentials.keyId,
        key_secret: credentials.keySecret,
    });

    // Cache the instance
    razorpayInstances.set(mode, instance);

    return instance;
};

/**
 * Get the Razorpay Key ID for the specified mode (used for frontend checkout)
 */
export const getRazorpayKeyId = (mode: RazorpayMode = 'DEV'): string => {
    const credentials = getRazorpayCredentials(mode);
    return credentials.keyId;
};

/**
 * Get the Razorpay Key Secret for the specified mode (used for signature verification)
 */
export const getRazorpayKeySecret = (mode: RazorpayMode = 'DEV'): string => {
    const credentials = getRazorpayCredentials(mode);
    return credentials.keySecret;
};

/**
 * Parse and validate mode from request body or query
 */
export const parseRazorpayMode = (modeInput: unknown): RazorpayMode => {
    if (modeInput === 'PROD') {
        return 'PROD';
    }
    return 'DEV'; // Default to DEV for safety
};
