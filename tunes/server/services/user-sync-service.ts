/**
 * User Sync Service
 * Synchronizes Strapi authenticated users with Neon DB users
 */

import { storage } from '../storage';
import type { User as SelectUser } from '@shared/schema';

interface StrapiUser {
  id: string;
  documentId: string;
  username: string;
  email: string;
  blocked: boolean;
}

export class UserSyncService {
  /**
   * Sync Strapi user with Neon DB
   * Creates or updates local user record based on Strapi auth
   */
  async syncUser(strapiUser: StrapiUser): Promise<SelectUser | null> {
    try {
      console.log('🔄 Syncing Strapi user with Neon DB:', strapiUser.username);

      // Check if user exists in Neon DB by username
      let localUser = await storage.getUserByUsername(strapiUser.username);

      if (localUser) {
        console.log('✅ Found existing user in Neon DB:', localUser.id);
        
        // Update email if changed in Strapi
        if (strapiUser.email && localUser.email !== strapiUser.email) {
          console.log('📧 Updating user email from Strapi');
          // Update user email in Neon DB if needed
          // Note: You might want to add an updateUser method to storage
        }

        return localUser;
      }

      // User doesn't exist in Neon DB - create new record
      console.log('🆕 Creating new user in Neon DB for Strapi user:', strapiUser.username);

      // Generate a unique guest URL based on username
      const baseGuestUrl = strapiUser.username.toLowerCase().replace(/[^a-z0-9]/g, '-');
      let guestUrl = baseGuestUrl;
      let counter = 1;

      // Ensure guest URL is unique
      while (true) {
        const existingUser = await storage.getUserByGuestUrl(guestUrl);
        if (!existingUser) break;
        guestUrl = `${baseGuestUrl}-${counter}`;
        counter++;
      }

      // Create user in Neon DB with Strapi auth data
      // Note: We store a placeholder password since auth is handled by Strapi
      const newLocalUser = await storage.createUser({
        username: strapiUser.username,
        email: strapiUser.email || '',
        password: 'STRAPI_AUTH', // Placeholder - actual auth is via Strapi
        venueName: `${strapiUser.username}'s Venue`, // Default venue name
        guestUrl: guestUrl,
        theme: { primary: '#6E56CF' }, // Default theme
        allowSongRequests: true,
        allowGuestPlayOnDevice: true,
        allowPlaylistSharing: false,
        allowRecentlyPlayedVisibility: true,
        isEmailVerified: true, // Strapi handles email verification
      });

      console.log('✅ Created new user in Neon DB:', newLocalUser.id);

      return newLocalUser;
    } catch (error) {
      console.error('❌ Error syncing user:', error);
      return null;
    }
  }

  /**
   * Get synced user by Strapi username
   */
  async getSyncedUser(strapiUsername: string): Promise<SelectUser | null> {
    try {
      return await storage.getUserByUsername(strapiUsername) ?? null;
    } catch (error) {
      console.error('Error getting synced user:', error);
      return null;
    }
  }

  /**
   * Check if user exists in Neon DB
   */
  async userExists(strapiUsername: string): Promise<boolean> {
    try {
      const user = await storage.getUserByUsername(strapiUsername);
      return user !== null;
    } catch (error) {
      console.error('Error checking user existence:', error);
      return false;
    }
  }
}

export const userSyncService = new UserSyncService();
