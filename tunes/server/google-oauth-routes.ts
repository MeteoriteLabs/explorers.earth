/**
 * Google OAuth Routes - explorers.earth Auth Model
 * Handles Google OAuth flow for Strapi authentication
 */

import type { Express } from 'express';

// Strapi backend that owns the Google OAuth provider. Hardcoded (not
// VITE_REST_API_URL) because in this deployment VITE_REST_API_URL is the
// same-origin "/api", which made this route redirect to
// localtunes.earth/api/api/connect/google (double "/api") and never reach
// Strapi. The client (new-auth-page.tsx) now links straight to Strapi; this
// route stays only as a correct fallback for any direct hit.
const STRAPI_OAUTH_BASE = 'https://api.localqr.earth/api';

export function setupGoogleOAuthRoutes(app: Express) {
  // Redirect to Strapi's Google OAuth endpoint
  app.get('/api/connect/google', (req, res) => {
    console.log('Redirecting to Strapi Google OAuth...');
    res.redirect(`${STRAPI_OAUTH_BASE}/connect/google`);
  });

  // Note: The actual callback is handled by the client-side route
  // The client will exchange the access_token with Strapi directly
  console.log('Google OAuth routes configured');
}
