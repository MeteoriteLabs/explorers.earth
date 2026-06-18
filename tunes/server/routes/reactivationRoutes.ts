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

// Throttle the public reactivation-request endpoint: it sends an email on each
// call, so cap it to deter inbox flooding / quota abuse. Keyed by client IP.
const reactivationRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                   // 5 requests per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many reactivation requests. Please try again later.',
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
  app.post('/api/user/request-reactivation', reactivationRequestLimiter, async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // Fire and forget — always return generic success
    // (requestReactivation catches and logs its own errors)
    requestReactivation(normalizedEmail).catch((err) => {
      console.error('❌ Unhandled reactivation request error:', err);
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
