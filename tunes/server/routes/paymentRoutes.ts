import { Express } from 'express';
import { z } from 'zod';
import {
  createOrder,
  verifyPayment,
  createSubscription,
  verifySubscription,
  getSubscriptionsByCustomerId,
} from '../controllers/paymentController';
import { isValidSubscriptionDuration } from '../utils/razorpayPlanMapping';

/**
 * Helper to accept userId as string or number (convert to string)
 * This matches the working controller which treats userId as string
 */
const userIdSchema = z.union([z.string(), z.number()]).transform((val) => {
  return String(val);
});

/**
 * Validation schemas using Zod
 */
const createOrderSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  userId: userIdSchema,
  amount: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num) || num <= 0) {
      throw new z.ZodError([
        { code: 'custom', path: ['amount'], message: 'Amount must be a positive number' },
      ]);
    }
    return num;
  }),
  currency: z.string().optional().default('INR'),
  mode: z.enum(['DEV', 'PROD']).optional().default('DEV'),
});

const verifyPaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  paymentId: z.string().min(1, 'Payment ID is required'),
  signature: z.string().min(1, 'Signature is required'),
  planId: z.string().optional(),
  userId: userIdSchema.optional(),
  mode: z.enum(['DEV', 'PROD']).optional().default('DEV'),
});

const createSubscriptionSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  userId: userIdSchema,
  duration: z.string().refine(
    (val) => isValidSubscriptionDuration(val),
    { message: 'Duration must be either "monthly" or "yearly"' }
  ),
  customerDetails: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    contact: z.string().optional(),
  }).optional(),
  mode: z.enum(['DEV', 'PROD']).optional().default('DEV'),
});

const verifySubscriptionSchema = z.object({
  subscriptionId: z.string().min(1, 'Subscription ID is required'),
  paymentId: z.string().min(1, 'Payment ID is required'),
  signature: z.string().min(1, 'Signature is required'),
  planId: z.string().optional(),
  userId: userIdSchema.optional(),
  duration: z.string().optional(),
  mode: z.enum(['DEV', 'PROD']).optional().default('DEV'),
});

/**
 * Validation middleware factory
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
          message: 'Validation failed',
          errors: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      return res.status(400).json({ message: 'Invalid request data' });
    }
  };
};

/**
 * Registers payment-related routes
 * @param app Express application instance
 */
export function setupPaymentRoutes(app: Express) {
  // POST /api/payments/create-order - Create a Razorpay order
  app.post(
    '/api/payments/create-order',
    validate(createOrderSchema),
    createOrder
  );

  // POST /api/payments/verify-payment - Verify payment signature
  app.post(
    '/api/payments/verify-payment',
    validate(verifyPaymentSchema),
    verifyPayment
  );

  // POST /api/payments/create-subscription - Create a Razorpay subscription
  app.post(
    '/api/payments/create-subscription',
    validate(createSubscriptionSchema),
    createSubscription
  );

  // POST /api/payments/verify-subscription - Verify subscription payment
  app.post(
    '/api/payments/verify-subscription',
    validate(verifySubscriptionSchema),
    verifySubscription
  );

  // GET /api/payments/subscriptions/:customerId - Get subscriptions by customer ID
  app.get(
    '/api/payments/subscriptions/:customerId',
    getSubscriptionsByCustomerId
  );
}

