import type { Express, Request, Response } from 'express';
import { requestIdFor, sendContainmentError } from '../security-containment';

function subscriptionReplacementPending(req: Request, res: Response) {
  return sendContainmentError(res, 410, 'LEGACY_OWNER_ROUTE_REMOVED', requestIdFor(req));
}

/**
 * Registers subscription-related routes
 * @param app Express application instance
 */
export function setupSubscriptionRoutes(app: Express) {
  // Subscription plan routes
  app.get('/api/subscriptions/plans', subscriptionReplacementPending);
  app.get('/api/subscriptions/plans/:planId', subscriptionReplacementPending);
  
  // User subscription plan routes
  app.get('/api/subscriptions/user-plans/:userId', subscriptionReplacementPending);
  app.post('/api/subscriptions/user-plans', subscriptionReplacementPending);
  
  // Song limits routes
  app.get('/api/subscriptions/song-limits/:username', subscriptionReplacementPending);
  app.post('/api/subscriptions/song-limits', subscriptionReplacementPending);
  app.put('/api/subscriptions/song-limits/:documentId', subscriptionReplacementPending);
}

