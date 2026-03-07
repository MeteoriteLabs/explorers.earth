/**
 * Google OAuth Routes - LocalQR Auth Model
 * Handles Google OAuth flow for Strapi authentication
 */

import type { Express } from 'express';

const VITE_REST_API_URL = process.env.VITE_REST_API_URL || 'https://api.localqr.earth';

export function setupGoogleOAuthRoutes(app: Express) {
  // Redirect to Strapi's Google OAuth endpoint
  app.get('/api/connect/google', (req, res) => {
    console.log('Redirecting to Strapi Google OAuth...');
    res.redirect(`${VITE_REST_API_URL}/api/connect/google`);
  });

  // Note: The actual callback is handled by the client-side route
  // The client will exchange the access_token with Strapi directly
  console.log('Google OAuth routes configured');
}
