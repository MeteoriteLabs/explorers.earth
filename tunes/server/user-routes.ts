import { Express } from "express";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import { extractDeviceInfo, extractBrowserInfo, extractOSInfo } from "./auth";
import { getGeoInfo } from "./utils/geolocation";
import { createHash } from "crypto";

/**
 * Registers user-related routes
 * @param app Express application instance
 */
export function setupUserRoutes(app: Express) {
  // Admin endpoint to get user details by ID
  app.get("/api/admin/user/:userId", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.username !== 'yapral27') {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get additional user data
      const activity = await storage.getUserActivity(userId);
      const deviceSessions = await storage.getUserSessions(userId);
      const playlists = await storage.getPlaylists(userId);
      const profile = await storage.getUserProfile(userId);

      // Format device information for the frontend
      const formattedSessions = deviceSessions.map(session => {
        const deviceInfo = session.deviceInfo || {};
        return {
          id: session.id,
          startTime: session.startTime,
          endTime: session.endTime,
          ipAddress: session.ipAddress,
          country: session.country,
          region: session.region,
          geoData: session.geoData,
          device: {
            type: deviceInfo.device?.type || 'Unknown',
            model: deviceInfo.device?.model || 'Unknown',
            browser: `${deviceInfo.browser?.name || 'Unknown'} ${deviceInfo.browser?.version || ''}`,
            os: `${deviceInfo.os?.name || 'Unknown'} ${deviceInfo.os?.version || ''}`,
            isMobile: deviceInfo.isMobile || false,
            language: deviceInfo.language || 'Unknown',
          },
          isCurrent: req.sessionID === session.id.toString(),
          isActive: !session.endTime
        };
      });

      res.json({
        user,
        activity,
        deviceSessions: formattedSessions,
        playlists: playlists.length,
        profile
      });
    } catch (error) {
      console.error('Error fetching user details:', error);
      res.status(500).json({
        message: "Failed to fetch user details",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  // GET /api/user endpoint to check authentication status
  app.get("/api/user", (req, res) => {
    console.log('GET /api/user - Authentication check:', {
      isAuthenticated: req.isAuthenticated(),
      sessionID: req.sessionID,
      user: req.user ? req.user.id : null
    });

    if (req.isAuthenticated()) {
      res.status(200).json(req.user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // GET /api/user/devices endpoint to retrieve user devices
  app.get("/api/user/devices", async (req, res) => {
    // Support multiple auth methods:
    // 1. Session auth (old)
    // 2. JWT token (new)
    let userId: number;

    // 1. Try session auth first (old system)
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      userId = req.user.id;
      console.log('✅ User devices - session auth - User ID:', userId);
    }
    // 2. Try JWT token (new system)
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.substring(7);
      try {
        // Decode JWT to validate
        const decoded = jwt.decode(token) as any;
        if (!decoded || !decoded.id) {
          return res.status(401).json({ message: "Unauthorized - Invalid token" });
        }

        // Check expiration
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
          return res.status(401).json({ message: "Unauthorized - Token expired" });
        }

        console.log('✅ User devices - JWT validated for Strapi user:', decoded.id);

        // Look up Neon DB user by username from multiple sources
        let usernameForLookup = req.query.username || req.headers['x-username'];

        if (!usernameForLookup) {
          console.error('❌ Username not found in query or headers');
          return res.status(400).json({
            message: "Username required with JWT auth. Please provide username in query parameter or X-Username header"
          });
        }

        console.log('🔍 Looking up user by username:', usernameForLookup);
        const user = await storage.getUserByUsername(usernameForLookup as string);
        if (!user) {
          console.error('❌ User not found in database:', usernameForLookup);
          return res.status(404).json({ message: "User not found" });
        }

        console.log('✅ Mapped JWT to Neon DB user:', user.username, '(ID:', user.id, ')');
        userId = user.id;

        // Track JWT session
        try {
          const jwtSessionId = createHash('sha256').update(token).digest('hex').substring(0, 32);

          const userAgent = req.headers['user-agent'] || '';
          const ipAddress = (
            req.headers['x-forwarded-for'] as string ||
            req.socket.remoteAddress ||
            'Unknown'
          ).split(',')[0].trim();

          const deviceInfo = extractDeviceInfo(userAgent);
          const browserInfo = extractBrowserInfo(userAgent);
          const osInfo = extractOSInfo(userAgent);
          const { countryCode, region, geoData } = getGeoInfo(ipAddress);

          await storage.createUserSession(
            user.id,
            jwtSessionId,
            ipAddress,
            {
              device: {
                type: deviceInfo.type,
                model: deviceInfo.model
              },
              browser: browserInfo,
              os: osInfo,
              isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent.toLowerCase()),
              language: req.headers['accept-language'] || 'en-US'
            },
            countryCode,
            region,
            geoData ? JSON.stringify(geoData) : null
          );

          console.log('📱 JWT session tracked for user:', user.id);
        } catch (sessionError) {
          console.error('Failed to track JWT session:', sessionError);
          // Non-critical, continue anyway
        }
      } catch (error) {
        console.error('❌ JWT validation error:', error);
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }
    }
    else {
      return res.status(401).json({ message: "Unauthorized - authentication required" });
    }

    try {
      const sessions = await storage.getUserSessions(userId);

      // Format device information for the frontend
      const formattedSessions = sessions.map(session => {
        const deviceInfo = session.deviceInfo || {};
        return {
          id: session.id,
          startTime: session.startTime,
          endTime: session.endTime,
          ipAddress: session.ipAddress,
          country: session.countryCode,
          region: session.region,
          device: {
            type: deviceInfo.device?.type || 'Unknown',
            model: deviceInfo.device?.model || 'Unknown',
            browser: `${deviceInfo.browser?.name || 'Unknown'} ${deviceInfo.browser?.version || ''}`,
            os: `${deviceInfo.os?.name || 'Unknown'} ${deviceInfo.os?.version || ''}`,
            isMobile: deviceInfo.isMobile || false,
            language: deviceInfo.language || 'Unknown',
          },
          // Create a fingerprint for the device to identify duplicates
          fingerprint: `${deviceInfo.device?.type || 'Unknown'}-${deviceInfo.device?.model || 'Unknown'}-${deviceInfo.os?.name || 'Unknown'}-${deviceInfo.browser?.name || 'Unknown'}`,
          isCurrent: req.sessionID === session.id.toString(),
          isActive: !session.endTime
        };
      });

      // Deduplicate the sessions by fingerprint, keeping only the most recent session for each device
      const uniqueDevices = new Map();

      for (const session of formattedSessions) {
        // If we haven't seen this device before or this session is more recent, update the map
        if (!uniqueDevices.has(session.fingerprint) ||
          new Date(session.startTime) > new Date(uniqueDevices.get(session.fingerprint).startTime)) {
          uniqueDevices.set(session.fingerprint, session);
        }
      }

      // Convert map values back to array and sort by most recent first
      const dedupedSessions = Array.from(uniqueDevices.values())
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

      res.json(dedupedSessions);
    } catch (error) {
      console.error('Error retrieving user devices:', error);
      res.status(500).json({
        message: "Failed to retrieve user devices",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // POST /api/user/devices/:sessionId/terminate endpoint to terminate a session
  app.post("/api/user/devices/:sessionId/terminate", async (req, res) => {
    // Support multiple auth methods:
    // 1. Session auth (old)
    // 2. JWT token (new)
    let userId: number;
    let currentSessionId: string | undefined;

    // 1. Try session auth first (old system)
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      userId = req.user.id;
      currentSessionId = req.sessionID;
      console.log('✅ Terminate session - session auth - User ID:', userId);
    }
    // 2. Try JWT token (new system)
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.substring(7);
      try {
        // Decode JWT to validate
        const decoded = jwt.decode(token) as any;
        if (!decoded || !decoded.id) {
          return res.status(401).json({ message: "Unauthorized - Invalid token" });
        }

        // Check expiration
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
          return res.status(401).json({ message: "Unauthorized - Token expired" });
        }

        console.log('✅ Terminate session - JWT validated for Strapi user:', decoded.id);

        // Look up Neon DB user by username from query or header
        let usernameForLookup = req.query.username || req.headers['x-username'];

        if (!usernameForLookup) {
          console.error('❌ Username not found in query or headers');
          return res.status(400).json({
            message: "Username required with JWT auth. Please provide username in query parameter or X-Username header"
          });
        }

        console.log('🔍 Looking up user by username:', usernameForLookup);
        const user = await storage.getUserByUsername(usernameForLookup as string);
        if (!user) {
          console.error('❌ User not found in database:', usernameForLookup);
          return res.status(404).json({ message: "User not found" });
        }

        console.log('✅ Mapped JWT to Neon DB user:', user.username, '(ID:', user.id, ')');
        userId = user.id;

        // For JWT, use hash of token as session ID
        currentSessionId = createHash('sha256').update(token).digest('hex').substring(0, 32);
      } catch (error) {
        console.error('❌ JWT validation error:', error);
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }
    }
    else {
      return res.status(401).json({ message: "Unauthorized - authentication required" });
    }

    try {
      const sessionId = parseInt(req.params.sessionId);

      // Don't allow terminating the current session
      if (currentSessionId === sessionId.toString()) {
        return res.status(400).json({ message: "Cannot terminate current session" });
      }

      await storage.terminateUserSession(sessionId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error terminating session:', error);
      res.status(500).json({
        message: "Failed to terminate session",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}