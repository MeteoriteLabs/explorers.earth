/**
 * Auth Bridge Routes
 * Bridge between Strapi authentication and Neon DB data
 */

import type { Express } from 'express';
import { userSyncService } from './services/user-sync-service';
import { storage } from './storage';
import { sanitizeUser } from './utils/sanitize-user';

export function setupAuthBridgeRoutes(app: Express) {
  /**
   * Sync authenticated user endpoint
   * Called by client after Strapi login to sync with Neon DB
   */
  app.post('/api/auth/sync', async (req, res) => {
    try {
      const { strapiUser } = req.body;

      if (!strapiUser || !strapiUser.username) {
        return res.status(400).json({
          message: 'Invalid request - strapiUser required',
        });
      }

      console.log('🔄 Auth bridge sync request for:', strapiUser.username);

      // Sync user with Neon DB
      const localUser = await userSyncService.syncUser(strapiUser);

      if (!localUser) {
        return res.status(500).json({
          message: 'Failed to sync user with database',
        });
      }

      console.log('✅ User synced successfully:', localUser.username);

      // Return the complete local user data
      // This includes all LocalTunes-specific fields
      res.json({
        success: true,
        user: sanitizeUser(localUser),
      });
    } catch (error) {
      console.error('❌ Auth bridge sync error:', error);
      res.status(500).json({
        message: 'Failed to sync user',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get current user data from Neon DB
   * Uses Strapi JWT token to identify user, returns Neon DB data
   */
  app.get('/api/auth/user-data', async (req, res) => {
    try {
      // Extract username from Strapi token (passed in headers)
      // For now, we'll use username from query/body
      const { username } = req.query;

      if (!username || typeof username !== 'string') {
        return res.status(400).json({
          message: 'Username required',
        });
      }

      console.log('📊 Fetching user data for:', username);

      // Get user from Neon DB
      const localUser = await storage.getUserByUsername(username);

      if (!localUser) {
        return res.status(404).json({
          message: 'User not found in database',
        });
      }

      // Return complete user data from Neon DB
      res.json({
        success: true,
        user: sanitizeUser(localUser),
      });
    } catch (error) {
      console.error('❌ Error fetching user data:', error);
      res.status(500).json({
        message: 'Failed to fetch user data',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Check if user needs onboarding
   * Returns whether user has completed venue setup
   */
  app.get('/api/auth/onboarding-status', async (req, res) => {
    try {
      const { username } = req.query;

      if (!username || typeof username !== 'string') {
        return res.status(400).json({
          message: 'Username required',
        });
      }

      const localUser = await storage.getUserByUsername(username);

      if (!localUser) {
        return res.json({
          needsOnboarding: true,
          reason: 'User not found in database',
        });
      }

      // Check if user has completed basic setup
      const needsOnboarding =
        !localUser.venueName ||
        localUser.venueName === `${localUser.username}'s Venue` || // Default venue name
        !localUser.guestUrl;

      res.json({
        needsOnboarding,
        user: sanitizeUser(localUser),
      });
    } catch (error) {
      console.error('❌ Error checking onboarding status:', error);
      res.status(500).json({
        message: 'Failed to check onboarding status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  console.log('✅ Auth bridge routes configured');
}
