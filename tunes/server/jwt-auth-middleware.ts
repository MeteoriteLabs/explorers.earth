/**
 * JWT Authentication Middleware
 * Validates JWT tokens from Strapi and loads user from Neon DB
 */

import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import jwt from 'jsonwebtoken';

const STRAPI_JWT_SECRET = process.env.STRAPI_JWT_SECRET || 'your-strapi-jwt-secret';

interface JWTPayload {
  id: number;
  iat: number;
  exp: number;
}

/**
 * Middleware to check authentication from either:
 * 1. Express session (old auth)
 * 2. JWT token (new Strapi auth)
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Check if user is authenticated via old session system
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      console.log('✅ User authenticated via session:', req.user.username);
      return next();
    }

    // Check for JWT token in Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No authorization header or invalid format');
      return res.status(401).json({ message: 'Unauthorized - No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Decode and validate JWT
    let decoded: JWTPayload;
    try {
      // Verify JWT signature and decode
      decoded = jwt.verify(token, STRAPI_JWT_SECRET) as JWTPayload;

      if (!decoded || !decoded.id) {
        throw new Error('Invalid token payload');
      }

      // Check token expiration
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        console.log('❌ JWT token expired');
        return res.status(401).json({ message: 'Unauthorized - Token expired' });
      }

      console.log('✅ JWT validated for Strapi user ID:', decoded.id);
    } catch (error) {
      console.error('❌ Failed to decode JWT:', error);
      return res.status(401).json({ message: 'Unauthorized - Invalid token' });
    }

    // JWT is valid - now we need to map Strapi user to Neon DB user
    // The Strapi JWT only contains the numeric ID, not username
    // We need to look up the user in Neon DB

    // No username provided - mark as JWT authenticated but without Neon user
    // Strategy: Look for username in X-Username header first (preferred), then query params or body
    let username = (req.headers['x-username'] as string | undefined)
      || (req.query.username as string | undefined);

    if (!username && req.body && req.body.username) {
      username = req.body.username;
    }

    if (username) {
      // Verify the username exists in Neon DB
      try {
        const neonUser = await storage.getUserByUsername(username);
        if (neonUser) {
          console.log('✅ Mapped to Neon DB user:', neonUser.username, '(ID:', neonUser.id, ')');
          // Attach Neon DB user to request for route handlers
          (req as any).neonUser = neonUser;
          (req as any).user = neonUser; // For compatibility with session auth
          return next();
        } else {
          console.log('❌ Username not found in Neon DB:', username);
          return res.status(404).json({ message: 'User not found in database' });
        }
      } catch (error) {
        console.error('❌ Error looking up Neon DB user:', error);
        return res.status(500).json({ message: 'Error validating user' });
      }
    }

    // No username provided - mark as JWT authenticated but without Neon user
    // Routes can decide if they need the full user or just authentication
    console.log('⚠️ JWT valid but no username provided for Neon DB lookup');
    (req as any).jwtAuthenticated = true;
    (req as any).strapiUserId = decoded.id;

    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    res.status(401).json({ message: 'Unauthorized' });
  }
}

/**
 * Simpler middleware that just checks if ANY auth is present
 * Useful during migration period
 */
export function requireAnyAuth(req: Request, res: Response, next: NextFunction) {
  // Check session auth
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }

  // Check JWT token exists
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, STRAPI_JWT_SECRET);
      if (decoded) {
        (req as any).jwtAuthenticated = true;
        return next();
      }
    } catch (error) {
      // Invalid token, fall through to 401
    }
  }

  return res.status(401).json({ message: 'Unauthorized' });
}
