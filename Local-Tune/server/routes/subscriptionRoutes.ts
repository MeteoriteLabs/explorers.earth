import { Express } from 'express';
import { 
  getSubscriptionPlans, 
  getSubscriptionPlanById, 
  getUserSubscriptionPlans,
  createUserSubscriptionPlan,
  getSongLimits,
  createSongLimit,
  updateSongLimit
} from '../controllers/subscriptionController';

/**
 * Registers subscription-related routes
 * @param app Express application instance
 */
export function setupSubscriptionRoutes(app: Express) {
  // Subscription plan routes
  app.get('/api/subscriptions/plans', getSubscriptionPlans);
  app.get('/api/subscriptions/plans/:planId', getSubscriptionPlanById);
  
  // User subscription plan routes
  app.get('/api/subscriptions/user-plans/:userId', getUserSubscriptionPlans);
  app.post('/api/subscriptions/user-plans', createUserSubscriptionPlan);
  
  // Song limits routes
  app.get('/api/subscriptions/song-limits/:username', getSongLimits);
  app.post('/api/subscriptions/song-limits', createSongLimit);
  app.put('/api/subscriptions/song-limits/:documentId', updateSongLimit);
}

