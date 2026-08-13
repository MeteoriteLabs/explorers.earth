/**
 * Account Reactivation Routes
 *
 * Two public (no auth required) endpoints:
 *
 *   POST /api/user/request-reactivation   → accepts { email }, sends magic link
 *   GET  /api/user/reactivate             → accepts ?token=, unblocks the user
 *
 * These routes are purely additive and do not touch any existing route.
 */

import type { Express, Request, Response } from 'express';
import { requestReactivation, confirmReactivation } from '../services/reactivation-service';
import rateLimit from 'express-rate-limit';

// Email validation shared by the route and the rate limiters, so malformed or
// oversized emails are rejected (400) and never create a rate-limit key or reach
// Strapi. RFC 5321 caps an address at 254 chars.
const MAX_EMAIL_LENGTH = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeReactivationEmail(req: Request): string {
  return typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
}

export function isValidReactivationEmail(email: string): boolean {
  return email.length > 0 && email.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(email);
}

// Skip the limiters for anything the route will reject with 400 anyway (missing,
// blank, oversized, or malformed email). Those responses are cheap and never hit
// Strapi, so they must not consume rate-limit buckets or create keys.
export function reactivationRateLimitSkip(req: Request): boolean {
  return !isValidReactivationEmail(normalizeReactivationEmail(req));
}

// Key the per-email limiter on the normalized email (NOT client IP): the app runs
// `trust proxy: true`, so an IP key would be bypassable by rotating X-Forwarded-For.
export function reactivationRateLimitKey(req: Request): string {
  return `reactivation:${normalizeReactivationEmail(req)}`;
}

// Per-email cap: stops targeted inbox flooding of ONE address.
const reactivationRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                   // 5 requests per email per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: reactivationRateLimitKey,
  skip: reactivationRateLimitSkip,
  message: {
    message: 'Too many reactivation requests. Please try again later.',
  },
});

// Global backstop: bounds TOTAL valid reactivation volume per hour regardless of
// how many distinct emails are used, so a unique-email spray cannot grow memory
// (rate-limit keys) or amplify Strapi lookups without bound. Constant key (not IP,
// which is spoofable under trust proxy). Threshold is generous so legitimate (rare)
// reactivation traffic is never affected; tune REACTIVATION_GLOBAL_MAX if real
// usage approaches it. Exported for deterministic test reset + assertions.
export const REACTIVATION_GLOBAL_MAX = 30; // total valid reactivation requests / hour
export const reactivationGlobalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: REACTIVATION_GLOBAL_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: () => 'reactivation:global',
  skip: reactivationRateLimitSkip,
  message: {
    message: 'Reactivation is temporarily busy. Please try again later.',
  },
});

export function setupReactivationRoutes(app: Express): void {

  /**
   * POST /api/user/request-reactivation
   * Body: { email: string }
   *
   * Always returns 200 with a generic message (security best practice).
   * If the email belongs to a blocked account, a reactivation link is sent.
   */
  app.post('/api/user/request-reactivation', reactivationGlobalLimiter, reactivationRequestLimiter, async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Normalize + validate (shared with the limiter skip). Rejects malformed or
    // oversized emails before any Strapi work.
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidReactivationEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Fire and forget — always return generic success
    // (requestReactivation catches and logs its own errors)
    requestReactivation(normalizedEmail).catch(() => {
      console.error('public_reactivation_request_failed');
    });

    return res.status(200).json({
      message: 'If this email belongs to a deactivated account, a reactivation link has been sent.',
    });
  });

  /**
   * GET /api/user/reactivate?token=<token>
   *
   * Validates the token and sets blocked = false on the Strapi user.
   * Returns JSON so the frontend can handle the result.
   */
  app.get('/api/user/reactivate', async (req: Request, res: Response) => {
    const token = req.query.token as string | undefined;

    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }

    const result = await confirmReactivation(token);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json({ success: true });
  });
}
