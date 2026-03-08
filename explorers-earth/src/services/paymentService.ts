import axios from 'axios';
import {
  PaymentOrder,
  PaymentVerificationRequest,
  PaymentVerificationResponse,
  CreateOrderRequest,
  RazorpayOptions,
  RazorpaySuccessResponse,
  CreateSubscriptionRequest,
  SubscriptionResponse,
  SubscriptionVerificationRequest,
  RazorpaySubscriptionOptions,
  RazorpaySubscriptionSuccessResponse,
} from '../types/payment';

const PAYMENT_API_URL = import.meta.env.VITE_PAYMENT_API_URL || import.meta.env.VITE_REST_API_URL;

// Razorpay keys for DEV and PROD modes
const RAZORPAY_KEY_ID_DEV = import.meta.env.VITE_RAZORPAY_KEY_ID_DEV;
const RAZORPAY_KEY_ID_PROD = import.meta.env.VITE_RAZORPAY_KEY_ID_PROD;

/**
 * Get the appropriate Razorpay key ID based on mode
 * @param mode - 'DEV' for test mode, 'PROD' for live mode (default: 'DEV')
 */
export const getRazorpayKeyId = (mode: 'DEV' | 'PROD' = 'DEV'): string => {
  const keyId = mode === 'PROD' ? RAZORPAY_KEY_ID_PROD : RAZORPAY_KEY_ID_DEV;
  if (!keyId) {
    console.warn(`Razorpay key for ${mode} mode not configured`);
  }
  return keyId || '';
};

// Get auth token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('qrtoken');
};

/**
 * Create Razorpay order via backend API
 */
export const createRazorpayOrder = async (
  request: CreateOrderRequest
): Promise<PaymentOrder> => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.post(
      `${PAYMENT_API_URL}/api/payments/create-order`,
      request,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.data || !response.data.orderId) {
      throw new Error('Invalid response from server');
    }

    return {
      orderId: response.data.orderId,
      amount: response.data.amount,
      currency: response.data.currency || 'INR',
      keyId: response.data.keyId || getRazorpayKeyId(request.mode),
    };
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    if (error.message) {
      throw error;
    }
    throw new Error('Failed to create payment order. Please try again.');
  }
};

/**
 * Verify payment with backend
 */
export const verifyPayment = async (
  request: PaymentVerificationRequest
): Promise<PaymentVerificationResponse> => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.post(
      `${PAYMENT_API_URL}/api/payments/verify-payment`,
      request,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    if (error.response?.data?.error) {
      return {
        success: false,
        error: error.response.data.error,
      };
    }
    return {
      success: false,
      error: error.message || 'Payment verification failed',
    };
  }
};

/**
 * Initialize Razorpay checkout
 */
export const initializeRazorpayCheckout = (
  options: RazorpayOptions
): Promise<RazorpaySuccessResponse> => {
  return new Promise((resolve, reject) => {
    // Check if Razorpay script is already loaded
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      initializeCheckout(options, resolve, reject);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      // Wait for script to load
      existingScript.addEventListener('load', () => {
        initializeCheckout(options, resolve, reject);
      });
      existingScript.addEventListener('error', () => {
        reject(new Error('Failed to load Razorpay SDK'));
      });
      return;
    }

    // Load Razorpay script dynamically
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      initializeCheckout(options, resolve, reject);
    };
    script.onerror = () => {
      reject(new Error('Failed to load Razorpay SDK'));
    };
    document.body.appendChild(script);
  });
};

/**
 * Initialize Razorpay checkout with loaded SDK
 */
const initializeCheckout = (
  options: RazorpayOptions,
  resolve: (value: RazorpaySuccessResponse) => void,
  reject: (reason: any) => void
) => {
  try {
    const Razorpay = (window as any).Razorpay;

    const razorpayOptions = {
      key: options.key,
      amount: options.amount,
      currency: options.currency,
      name: options.name,
      description: options.description,
      order_id: options.order_id,
      prefill: options.prefill || {},
      theme: {
        color: options.theme?.color || '#8B5CF6',
      },
      handler: (response: RazorpaySuccessResponse) => {
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          reject(new Error('Payment cancelled by user'));
        },
      },
    };

    const razorpay = new Razorpay(razorpayOptions);
    razorpay.on('payment.failed', (response: any) => {
      reject(
        new Error(
          response.error?.description ||
          response.error?.reason ||
          'Payment failed'
        )
      );
    });

    razorpay.open();
  } catch (error: any) {
    console.error('Error initializing Razorpay:', error);
    reject(error);
  }
};

/**
 * Create Razorpay subscription via backend API
 */
export const createRazorpaySubscription = async (
  request: CreateSubscriptionRequest
): Promise<SubscriptionResponse> => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.post(
      `${PAYMENT_API_URL}/api/payments/create-subscription`,
      request,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.data || !response.data.subscriptionId) {
      throw new Error('Invalid response from server');
    }

    return {
      subscriptionId: response.data.subscriptionId,
      razorpayPlanId: response.data.razorpayPlanId,
      status: response.data.status,
      keyId: response.data.keyId || getRazorpayKeyId(request.mode),
    };
  } catch (error: any) {
    console.error('Error creating Razorpay subscription:', error);
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    if (error.message) {
      throw error;
    }
    throw new Error('Failed to create subscription. Please try again.');
  }
};

/**
 * Verify subscription payment with backend
 */
export const verifySubscription = async (
  request: SubscriptionVerificationRequest
): Promise<PaymentVerificationResponse> => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.post(
      `${PAYMENT_API_URL}/api/payments/verify-subscription`,
      request,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Error verifying subscription:', error);
    if (error.response?.data?.error) {
      return {
        success: false,
        error: error.response.data.error,
      };
    }
    return {
      success: false,
      error: error.message || 'Subscription verification failed',
    };
  }
};

/**
 * Initialize Razorpay subscription checkout
 */
export const initializeRazorpaySubscriptionCheckout = (
  options: RazorpaySubscriptionOptions
): Promise<RazorpaySubscriptionSuccessResponse> => {
  return new Promise((resolve, reject) => {
    // Check if Razorpay script is already loaded
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      initializeSubscriptionCheckout(options, resolve, reject);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      // Wait for script to load
      existingScript.addEventListener('load', () => {
        initializeSubscriptionCheckout(options, resolve, reject);
      });
      existingScript.addEventListener('error', () => {
        reject(new Error('Failed to load Razorpay SDK'));
      });
      return;
    }

    // Load Razorpay script dynamically
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      initializeSubscriptionCheckout(options, resolve, reject);
    };
    script.onerror = () => {
      reject(new Error('Failed to load Razorpay SDK'));
    };
    document.body.appendChild(script);
  });
};

/**
 * Initialize Razorpay subscription checkout with loaded SDK
 */
const initializeSubscriptionCheckout = (
  options: RazorpaySubscriptionOptions,
  resolve: (value: RazorpaySubscriptionSuccessResponse) => void,
  reject: (reason: any) => void
) => {
  try {
    const Razorpay = (window as any).Razorpay;

    const razorpayOptions = {
      key: options.key,
      subscription_id: options.subscription_id,
      name: options.name,
      description: options.description,
      prefill: options.prefill || {},
      theme: {
        color: options.theme?.color || '#8B5CF6',
      },
      handler: (response: RazorpaySubscriptionSuccessResponse) => {
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          reject(new Error('Payment cancelled by user'));
        },
      },
    };

    const razorpay = new Razorpay(razorpayOptions);
    razorpay.on('payment.failed', (response: any) => {
      reject(
        new Error(
          response.error?.description ||
          response.error?.reason ||
          'Payment failed'
        )
      );
    });

    razorpay.open();
  } catch (error: any) {
    console.error('Error initializing Razorpay subscription:', error);
    reject(error);
  }
};

/**
 * Check if plan is free (cost is 0 or plan name is 'Free')
 */
export const isFreePlan = (plan: {
  cost: string | number;
  plan_name?: string;
}): boolean => {
  const cost = typeof plan.cost === 'string' ? parseFloat(plan.cost) : plan.cost;
  const planName = plan.plan_name?.toLowerCase() || '';
  return cost === 0 || planName === 'free';
};

/**
 * Get Razorpay subscriptions by customer ID
 */
export const getSubscriptionsByCustomerId = async (
  customerId: string,
  mode: 'DEV' | 'PROD' = 'DEV'
): Promise<{ success: boolean; subscriptions?: any[]; count?: number; error?: string }> => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication token not found');
    }

    const response = await axios.get(
      `${PAYMENT_API_URL}/api/payments/subscriptions/${customerId}?mode=${mode}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Error fetching subscriptions:', error);
    if (error.response?.data?.error) {
      return {
        success: false,
        error: error.response.data.error,
      };
    }
    return {
      success: false,
      error: error.message || 'Failed to fetch subscriptions',
    };
  }
};

