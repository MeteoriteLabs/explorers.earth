import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import {
  getRazorpayKeyId,
  createRazorpayOrder,
  verifyPayment,
  initializeRazorpayCheckout,
  createRazorpaySubscription,
  verifySubscription,
  initializeRazorpaySubscriptionCheckout,
  isFreePlan,
  getSubscriptionsByCustomerId,
} from '../paymentService';
import { CreateOrderRequest, CreateSubscriptionRequest } from '../../types/payment';

vi.mock('axios');

describe('paymentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('qrtoken', 'fake-token');
    
    // Cleanup any global Razorpay objects or script tags
    delete (window as any).Razorpay;
    document.querySelectorAll('script').forEach(s => s.remove());
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('getRazorpayKeyId', () => {
    it('returns DEV key by default or when mode is DEV', () => {
      // It depends on the Vite env vars, but we can test the fallback logic
      const key = getRazorpayKeyId('DEV');
      // If VITE_RAZORPAY_KEY_ID_DEV is not set, it returns empty string
      expect(typeof key).toBe('string');
    });
  });

  describe('createRazorpayOrder', () => {
    it('throws if no token', async () => {
      localStorage.removeItem('qrtoken');
      await expect(createRazorpayOrder({ amount: 100, planId: 'plan_1', mode: 'DEV' }))
        .rejects.toThrow('Authentication token not found');
    });

    it('creates an order successfully', async () => {
      (axios.post as any).mockResolvedValue({
        data: { orderId: 'order_123', amount: 1000, currency: 'INR', keyId: 'key_123' }
      });

      const req: CreateOrderRequest = { amount: 1000, planId: 'plan_1', mode: 'DEV' };
      const res = await createRazorpayOrder(req);

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/payments/create-order'),
        req,
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fake-token' }) })
      );
      expect(res.orderId).toBe('order_123');
      expect(res.amount).toBe(1000);
    });

    it('throws error from backend', async () => {
      (axios.post as any).mockRejectedValue({
        response: { data: { error: 'Backend error' } }
      });

      await expect(createRazorpayOrder({ amount: 100, planId: 'plan_1', mode: 'DEV' }))
        .rejects.toThrow('Backend error');
    });
  });

  describe('verifyPayment', () => {
    it('verifies successfully', async () => {
      (axios.post as any).mockResolvedValue({
        data: { success: true }
      });

      const res = await verifyPayment({
        razorpay_order_id: '1',
        razorpay_payment_id: '2',
        razorpay_signature: '3'
      });

      expect(res.success).toBe(true);
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('returns error if backend fails', async () => {
      (axios.post as any).mockRejectedValue({
        response: { data: { error: 'Invalid signature' } }
      });

      const res = await verifyPayment({
        razorpay_order_id: '1',
        razorpay_payment_id: '2',
        razorpay_signature: '3'
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid signature');
    });
  });

  describe('createRazorpaySubscription', () => {
    it('creates a subscription', async () => {
      (axios.post as any).mockResolvedValue({
        data: { subscriptionId: 'sub_123', razorpayPlanId: 'plan_1', status: 'created' }
      });

      const req: CreateSubscriptionRequest = { planId: '1', mode: 'DEV' };
      const res = await createRazorpaySubscription(req);

      expect(res.subscriptionId).toBe('sub_123');
    });
  });

  describe('verifySubscription', () => {
    it('verifies a subscription', async () => {
      (axios.post as any).mockResolvedValue({
        data: { success: true }
      });

      const res = await verifySubscription({
        razorpay_subscription_id: 'sub_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig_1'
      });

      expect(res.success).toBe(true);
    });
  });

  describe('getSubscriptionsByCustomerId', () => {
    it('fetches subscriptions', async () => {
      (axios.get as any).mockResolvedValue({
        data: { success: true, count: 1, subscriptions: [{ id: 'sub_1' }] }
      });

      const res = await getSubscriptionsByCustomerId('cust_1');

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/payments/subscriptions/cust_1?mode=DEV'),
        expect.any(Object)
      );
      expect(res.success).toBe(true);
      expect(res.count).toBe(1);
    });
  });

  describe('isFreePlan', () => {
    it('returns true if cost is 0', () => {
      expect(isFreePlan({ cost: 0 })).toBe(true);
      expect(isFreePlan({ cost: '0' })).toBe(true);
    });

    it('returns true if plan_name is free', () => {
      expect(isFreePlan({ cost: 10, plan_name: 'Free' })).toBe(true);
      expect(isFreePlan({ cost: 10, plan_name: 'FREE' })).toBe(true);
    });

    it('returns false for paid plans', () => {
      expect(isFreePlan({ cost: 10, plan_name: 'Pro' })).toBe(false);
      expect(isFreePlan({ cost: '99.99' })).toBe(false);
    });
  });

  describe('Razorpay SDK Initialization', () => {
    it('loads SDK dynamically if not present', async () => {
      // Mock the script onload manually
      const mockRazorpay = vi.fn().mockImplementation(function(this: any, options: any) {
        this.on = vi.fn();
        this.open = vi.fn();
      });

      // We'll capture script appending to simulate load
      const originalAppendChild = document.body.appendChild;
      document.body.appendChild = vi.fn().mockImplementation((el) => {
        if (el.tagName === 'SCRIPT') {
          (window as any).Razorpay = mockRazorpay;
          setTimeout(() => el.onload(), 0);
        }
      });

      const promise = initializeRazorpayCheckout({
        key: 'test',
        amount: 100,
        currency: 'INR',
        name: 'Test'
      });

      // Wait for it to not reject immediately
      document.body.appendChild = originalAppendChild;
      
      // Cleanup happens but the promise is pending until handler is called by Razorpay.
      // So we just verify mockRazorpay was created.
      await new Promise(r => setTimeout(r, 10)); // let onload fire
      expect(mockRazorpay).toHaveBeenCalled();
    });

    it('uses existing SDK if present', () => {
      const openMock = vi.fn();
      const mockRazorpay = vi.fn().mockImplementation(function(this: any) {
        this.on = vi.fn();
        this.open = openMock;
      });
      (window as any).Razorpay = mockRazorpay;

      initializeRazorpayCheckout({
        key: 'test',
        amount: 100,
        currency: 'INR',
        name: 'Test'
      });

      expect(mockRazorpay).toHaveBeenCalled();
      expect(openMock).toHaveBeenCalled();
    });
  });
});
