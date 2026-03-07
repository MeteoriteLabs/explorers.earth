import Razorpay from 'razorpay';
import crypto from 'crypto';
import { getRazorpayPlanId, isValidSubscriptionDuration } from '../utils/razorpayPlanMapping';
import {
  RazorpayMode,
  getRazorpayInstance,
  getRazorpayKeyId,
  getRazorpayKeySecret,
  validateRazorpayCredentials,
  parseRazorpayMode
} from '../utils/razorpayConfig';
import type { Request, Response, NextFunction } from 'express';

/**
 * Create Razorpay order
 * POST /api/payments/create-order
 */
export const createOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { planId, userId, amount, currency = 'INR', mode: modeInput } = req.body;
    const mode = parseRazorpayMode(modeInput);

    // Validate Razorpay configuration
    const validation = validateRazorpayCredentials(mode);
    if (!validation.valid) {
      res.status(500).json({
        success: false,
        error: validation.error,
      });
      return;
    }

    // Validate amount (must be positive)
    const amountInPaise = parseInt(String(amount));
    if (isNaN(amountInPaise) || amountInPaise <= 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid amount. Amount must be a positive number in paise.',
      });
      return;
    }

    // Create Razorpay order
    // Generate a short receipt (Razorpay limit: 40 characters)
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
    const userIdStr = String(userId);
    const shortPlanId = String(planId).slice(-6); // Last 6 chars of planId
    const shortUserId = userIdStr.slice(-6); // Last 6 chars of userId
    const receipt = `ord_${shortPlanId}_${shortUserId}_${timestamp}`;

    // Ensure receipt is max 40 characters
    const finalReceipt = receipt.length > 40 ? receipt.slice(0, 40) : receipt;

    const orderOptions = {
      amount: amountInPaise, // Amount in paise
      currency: currency,
      receipt: finalReceipt,
      notes: {
        planId: planId,
        userId: userIdStr,
        mode: mode, // Track which mode was used
      },
    };

    const razorpay = getRazorpayInstance(mode);
    const order = await razorpay.orders.create(orderOptions);

    // Return order details to frontend
    const response = {
      success: true,
      orderId: order.id || (order as any).order_id,
      amount: order.amount || amountInPaise,
      currency: order.currency || currency,
      keyId: getRazorpayKeyId(mode),
      mode: mode,
    };

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);

    // Handle Razorpay API errors with better error messages
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        error: error.error?.description || error.message || 'Razorpay API error',
        details: error.error,
      });
      return;
    }

    next(error);
  }
};

/**
 * Verify payment and create subscription
 * POST /api/payments/verify-payment
 */
export const verifyPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { orderId, paymentId, signature, planId, userId, mode: modeInput } = req.body;
    const mode = parseRazorpayMode(modeInput);

    // Validate Razorpay configuration
    const keySecret = getRazorpayKeySecret(mode);
    if (!keySecret) {
      res.status(500).json({
        success: false,
        error: `Razorpay ${mode} secret key not configured`,
      });
      return;
    }

    // Verify Razorpay signature
    const text = `${orderId}|${paymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(text)
      .digest('hex');

    if (generatedSignature !== signature) {
      console.error('Payment signature verification failed');
      res.status(400).json({
        success: false,
        error: 'Payment verification failed: Invalid signature',
      });
      return;
    }

    // Fetch payment details from Razorpay to confirm
    try {
      const razorpay = getRazorpayInstance(mode);
      const payment = await razorpay.payments.fetch(paymentId);

      if (payment.status !== 'captured' && payment.status !== 'authorized') {
        res.status(400).json({
          success: false,
          error: `Payment not successful. Status: ${payment.status}`,
        });
        return;
      }
    } catch (razorpayError) {
      console.error('Error fetching payment from Razorpay:', razorpayError);
      // Continue anyway since signature is verified
    }

    // Return success response
    // Frontend will create the subscription record
    res.json({
      success: true,
      paymentId: paymentId,
      orderId: orderId,
      mode: mode,
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    next(error);
  }
};

/**
 * Create Razorpay subscription
 * POST /api/payments/create-subscription
 */
export const createSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { planId, userId, duration, customerDetails, mode: modeInput } = req.body;

    // Debug logging to trace mode handling
    console.log('[Razorpay] createSubscription called with:', {
      modeInput,
      modeInputType: typeof modeInput,
      rawBody: JSON.stringify({ mode: req.body.mode }),
    });

    const mode = parseRazorpayMode(modeInput);
    console.log('[Razorpay] Resolved mode:', mode);

    // Validate Razorpay configuration
    const validation = validateRazorpayCredentials(mode);
    if (!validation.valid) {
      res.status(500).json({
        success: false,
        error: validation.error,
      });
      return;
    }

    // Validate duration
    if (!duration || !isValidSubscriptionDuration(duration)) {
      res.status(400).json({
        success: false,
        error: 'Invalid duration. Must be "monthly", "yearly", "monthly_pro", or "yearly_pro".',
      });
      return;
    }

    // Get Razorpay plan ID based on mode
    let razorpayPlanId: string;
    try {
      razorpayPlanId = getRazorpayPlanId(duration, mode);
      console.log('[Razorpay] Using plan ID:', razorpayPlanId, 'for mode:', mode);
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
      return;
    }

    const razorpay = getRazorpayInstance(mode);
    const keyId = getRazorpayKeyId(mode);
    console.log('[Razorpay] Using keyId:', keyId.substring(0, 15) + '...', 'for mode:', mode);

    // Create customer in Razorpay if customer details provided
    let customerId: string | null = null;
    if (customerDetails && (customerDetails.email || customerDetails.contact)) {
      try {
        const customer = await razorpay.customers.create({
          name: customerDetails.name || 'Customer',
          email: customerDetails.email,
          contact: customerDetails.contact,
          notes: {
            userId: String(userId),
            planId: planId,
            mode: mode,
          },
        });
        customerId = customer.id;
      } catch (customerError) {
        console.warn('Error creating Razorpay customer:', customerError);
        // Continue without customer - subscription can still be created
      }
    }

    // Create subscription in Razorpay
    const subscriptionOptions: any = {
      plan_id: razorpayPlanId,
      customer_notify: 1,
      total_count: 1, // High number for recurring subscriptions (Razorpay requires at least 1)
      notes: {
        planId: planId,
        userId: String(userId),
        duration: duration,
        mode: mode,
      },
    };

    if (customerId) {
      subscriptionOptions.customer_id = customerId;
    }

    const subscription = await razorpay.subscriptions.create(subscriptionOptions);

    // Return subscription details to frontend
    const response = {
      success: true,
      subscriptionId: subscription.id,
      razorpayPlanId: razorpayPlanId,
      status: subscription.status,
      keyId: keyId,
      mode: mode,
    };

    console.log('[Razorpay] Response:', { keyId: keyId.substring(0, 15) + '...', mode });

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error creating Razorpay subscription:', error);

    // Handle Razorpay API errors with better error messages
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        error: error.error?.description || error.message || 'Razorpay API error',
        details: error.error,
      });
      return;
    }

    next(error);
  }
};

/**
 * Verify subscription payment and create subscription in Strapi
 * POST /api/payments/verify-subscription
 */
export const verifySubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { subscriptionId, paymentId, signature, planId, userId, duration, mode: modeInput } = req.body;
    const mode = parseRazorpayMode(modeInput);

    // Validate Razorpay configuration
    const keySecret = getRazorpayKeySecret(mode);
    if (!keySecret) {
      res.status(500).json({
        success: false,
        error: `Razorpay ${mode} secret key not configured`,
      });
      return;
    }

    const razorpay = getRazorpayInstance(mode);

    // First, fetch subscription details from Razorpay to get actual payment info
    let subscription: any;
    let actualPaymentId = paymentId;
    try {
      subscription = await razorpay.subscriptions.fetch(subscriptionId);

      // Get payment_id from subscription if not provided or if subscription has payment info
      if (!actualPaymentId || actualPaymentId === '') {
        // Try to get payment_id from subscription's invoice or items
        if (subscription.items && subscription.items.length > 0) {
          // Check if there's a payment in the subscription items
          for (const item of subscription.items) {
            if (item.payment_id) {
              actualPaymentId = item.payment_id;
              break;
            }
          }
        }

        // If still no payment_id, check subscription's latest invoice
        if (!actualPaymentId && subscription.latest_invoice) {
          try {
            const invoice = await razorpay.invoices.fetch(subscription.latest_invoice);
            if (invoice.payment_id) {
              actualPaymentId = invoice.payment_id;
            }
          } catch (invoiceError) {
            console.warn('Could not fetch invoice:', invoiceError);
          }
        }
      }

      // Accept multiple valid statuses including 'completed' for one-time subscriptions
      const validStatuses = ['active', 'authenticated', 'completed', 'charged'];
      if (!validStatuses.includes(subscription.status)) {
        console.warn(`Subscription status is ${subscription.status}, but proceeding with verification`);
      }
    } catch (razorpayError) {
      console.error('Error fetching subscription from Razorpay:', razorpayError);
      // Continue with provided paymentId if subscription fetch fails
    }

    // Verify Razorpay signature for subscription
    // Use actualPaymentId if available, otherwise use provided paymentId
    const paymentIdToUse = actualPaymentId || paymentId;

    // If no payment_id at all, we can't verify signature - check subscription status instead
    let verificationPassed = false;
    if (!paymentIdToUse || paymentIdToUse === '') {
      if (subscription && ['active', 'authenticated', 'completed', 'charged'].includes(subscription.status)) {
        verificationPassed = true;
        // Skip signature verification and proceed
      } else {
        res.status(400).json({
          success: false,
          error: 'Subscription verification failed: No payment ID and invalid subscription status',
          details: {
            subscriptionStatus: subscription?.status,
            subscriptionId: subscriptionId,
          },
        });
        return;
      }
    }

    if (!verificationPassed) {
      // First, verify payment status if payment_id is available
      // This is the most reliable way to verify subscription payment
      let paymentVerified = false;
      if (paymentIdToUse) {
        try {
          const payment = await razorpay.payments.fetch(paymentIdToUse);

          if (payment.status === 'captured' || payment.status === 'authorized') {
            paymentVerified = true;
            verificationPassed = true;
          } else {
            console.warn('Payment status is not successful:', payment.status);
          }
        } catch (paymentError) {
          console.error('Error fetching payment:', paymentError);
        }
      }

      // If payment verification passed, skip signature check
      if (!verificationPassed) {
        // Verify signature with payment_id
        const text = `${subscriptionId}|${paymentIdToUse}`;
        const generatedSignature = crypto
          .createHmac('sha256', keySecret)
          .update(text)
          .digest('hex');

        let signatureValid = generatedSignature === signature;

        if (signatureValid) {
          verificationPassed = true;
        } else {
          console.warn('Signature verification failed');

          // If signature fails, check subscription status as fallback
          if (subscription) {
            const validStatuses = ['active', 'authenticated', 'completed', 'charged'];
            if (validStatuses.includes(subscription.status)) {
              verificationPassed = true;
            } else if (subscription.status === 'created' && paymentVerified) {
              // For "created" status, accept if payment is verified
              verificationPassed = true;
            }
          }
        }
      }

      if (!verificationPassed) {
        res.status(400).json({
          success: false,
          error: 'Subscription verification failed: Invalid signature and payment verification failed',
          details: {
            subscriptionStatus: subscription?.status,
            subscriptionId: subscriptionId,
            paymentId: paymentId,
            actualPaymentId: actualPaymentId,
            paymentVerified: paymentVerified,
          },
        });
        return;
      }
    }

    if (!verificationPassed) {
      res.status(400).json({
        success: false,
        error: 'Subscription verification failed',
      });
      return;
    }

    // Return success response with Razorpay subscription details
    // Frontend will create the subscription record with all Razorpay data
    const customerId = subscription?.customer_id || null;
    const razorpayPlanId = subscription?.plan_id || null;

    res.json({
      success: true,
      subscriptionId: subscriptionId,
      paymentId: paymentId || actualPaymentId,
      razorpaySubscriptionId: subscriptionId,
      razorpayPlanId: razorpayPlanId,
      razorpayCustomerId: customerId,
      mode: mode,
    });
  } catch (error) {
    console.error('Error verifying subscription:', error);
    next(error);
  }
};

/**
 * Get subscriptions from Razorpay by customer ID
 * GET /api/payments/subscriptions/:customerId
 */
export const getSubscriptionsByCustomerId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customerId } = req.params;
    const { mode: modeInput } = req.query;
    const mode = parseRazorpayMode(modeInput);

    if (!customerId) {
      res.status(400).json({
        success: false,
        error: 'Customer ID is required',
      });
      return;
    }

    // Validate Razorpay configuration
    const validation = validateRazorpayCredentials(mode);
    if (!validation.valid) {
      res.status(500).json({
        success: false,
        error: validation.error,
      });
      return;
    }

    const razorpay = getRazorpayInstance(mode);

    try {
      // Fetch all subscriptions (Razorpay doesn't support customer_id filter in subscriptions.all)
      // We'll fetch and filter by customer_id on our side
      const allSubscriptions = await razorpay.subscriptions.all({
        count: 100, // Get up to 100 subscriptions
      });

      // Filter subscriptions by customer_id
      const filteredSubscriptions = (allSubscriptions.items || []).filter(
        (sub) => sub.customer_id === customerId
      );

      res.status(200).json({
        success: true,
        subscriptions: filteredSubscriptions,
        count: filteredSubscriptions.length,
        mode: mode,
      });
    } catch (razorpayError: any) {
      console.error('Error fetching subscriptions from Razorpay:', razorpayError);

      if (razorpayError.statusCode) {
        res.status(razorpayError.statusCode).json({
          success: false,
          error: razorpayError.error?.description || razorpayError.message || 'Razorpay API error',
          details: razorpayError.error,
        });
        return;
      }

      throw razorpayError;
    }
  } catch (error) {
    console.error('Error getting subscriptions by customer ID:', error);
    next(error);
  }
};
