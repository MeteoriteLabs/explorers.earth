/**
 * Razorpay Plan ID Mapping
 * Maps local plan durations to Razorpay plan IDs based on mode (DEV/PROD)
 */
import { RazorpayMode } from './razorpayConfig';

const RAZORPAY_PLAN_MAPPING_DEV = {
  monthly: process.env.RAZORPAY_PLAN_ID_MONTHLY_DEV || '',
  yearly: process.env.RAZORPAY_PLAN_ID_YEARLY_DEV || '',
  monthly_pro: process.env.RAZORPAY_PLAN_ID_MONTHLY_PRO_DEV || '',
  yearly_pro: process.env.RAZORPAY_PLAN_ID_YEARLY_PRO_DEV || '',
};

const RAZORPAY_PLAN_MAPPING_PROD = {
  monthly: process.env.RAZORPAY_PLAN_ID_MONTHLY_PROD || '',
  yearly: process.env.RAZORPAY_PLAN_ID_YEARLY_PROD || '',
  monthly_pro: process.env.RAZORPAY_PLAN_ID_MONTHLY_PRO_PROD || '',
  yearly_pro: process.env.RAZORPAY_PLAN_ID_YEARLY_PRO_PROD || '',
};

type PlanDuration = 'monthly' | 'yearly' | 'monthly_pro' | 'yearly_pro';

const getPlanMapping = (mode: RazorpayMode) => {
  return mode === 'PROD' ? RAZORPAY_PLAN_MAPPING_PROD : RAZORPAY_PLAN_MAPPING_DEV;
};

export const getRazorpayPlanId = (duration: string, mode: RazorpayMode = 'DEV'): string => {
  const normalizedDuration = duration?.toLowerCase() as PlanDuration;
  if (!normalizedDuration) {
    throw new Error('Plan duration is required');
  }

  const mapping = getPlanMapping(mode);
  const planId = mapping[normalizedDuration];

  if (!planId) {
    throw new Error(`No Razorpay plan ID found for duration: ${duration} in ${mode} mode. Please set RAZORPAY_PLAN_ID_${duration.toUpperCase()}_${mode} environment variable.`);
  }

  return planId;
};

export const isValidSubscriptionDuration = (duration: string): boolean => {
  const normalizedDuration = duration?.toLowerCase();
  return ['monthly', 'yearly', 'monthly_pro', 'yearly_pro'].includes(normalizedDuration);
};
