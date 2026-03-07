export interface PaymentOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface PaymentVerificationRequest {
  orderId: string;
  paymentId: string;
  signature: string;
  planId: string;
  userId: string;
  mode?: 'DEV' | 'PROD';
}

export interface PaymentVerificationResponse {
  success: boolean;
  subscriptionId?: string;
  paymentId?: string;
  razorpaySubscriptionId?: string;
  razorpayPlanId?: string;
  razorpayCustomerId?: string;
  error?: string;
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
}

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayErrorResponse {
  error: {
    code: string;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: {
      order_id: string;
      payment_id: string;
    };
  };
}

export interface CreateOrderRequest {
  planId: string;
  userId: string;
  amount: number;
  currency: string;
  mode?: 'DEV' | 'PROD';
}

export interface CreateSubscriptionRequest {
  planId: string;
  userId: string;
  duration: string;
  customerDetails?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  mode?: 'DEV' | 'PROD';
}

export interface SubscriptionResponse {
  subscriptionId: string;
  razorpayPlanId: string;
  status: string;
  keyId: string;
}

export interface SubscriptionVerificationRequest {
  subscriptionId: string;
  paymentId: string;
  signature: string;
  planId: string;
  userId: string;
  duration: string;
  mode?: 'DEV' | 'PROD';
}

export interface RazorpaySubscriptionOptions {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
  handler: (response: RazorpaySubscriptionSuccessResponse) => void;
}

export interface RazorpaySubscriptionSuccessResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

